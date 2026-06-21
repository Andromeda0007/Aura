"""Edit/Delete: uniqueness guards (create + update, exclude-self, case-insensitive),
session subject edit + delete, and department-list enrichment."""
from __future__ import annotations

from app.models.enums import UserRole
from tests.util import admin_token, auth, client, make_batch, make_department, make_hierarchy, make_user, semesters_of


def test_department_name_unique_within_batch():
    h = auth(admin_token())
    batch = make_batch(h)
    cs = client.post("/departments", json={"batch_id": batch["id"], "name": "Computer Science"}, headers=h)
    assert cs.status_code == 201
    # exact + case-insensitive duplicate
    assert client.post("/departments", json={"batch_id": batch["id"], "name": "Computer Science"}, headers=h).status_code == 409
    assert client.post("/departments", json={"batch_id": batch["id"], "name": "computer science"}, headers=h).status_code == 409
    it = client.post("/departments", json={"batch_id": batch["id"], "name": "IT"}, headers=h)
    assert it.status_code == 201
    # rename IT -> CS collides; renaming CS to its own name is fine (exclude self)
    assert client.patch(f"/departments/{it.json()['id']}", json={"name": "Computer Science"}, headers=h).status_code == 409
    assert client.patch(f"/departments/{cs.json()['id']}", json={"name": "Computer Science"}, headers=h).status_code == 200


def test_course_name_unique_within_semester():
    h = auth(admin_token())
    dept = make_department(h, make_batch(h)["id"])
    sem = semesters_of(h, dept["id"])[0]
    c1 = client.post("/courses", json={"semester_id": sem["id"], "name": "DBMS"}, headers=h)
    assert c1.status_code == 201
    assert client.post("/courses", json={"semester_id": sem["id"], "name": "dbms"}, headers=h).status_code == 409
    c2 = client.post("/courses", json={"semester_id": sem["id"], "name": "OS"}, headers=h)
    assert c2.status_code == 201
    assert client.patch(f"/courses/{c2.json()['id']}", json={"name": "DBMS"}, headers=h).status_code == 409
    assert client.patch(f"/courses/{c1.json()['id']}", json={"name": "DBMS"}, headers=h).status_code == 200


def test_unit_name_unique_within_course():
    h = auth(admin_token())
    course_id = make_hierarchy(h)["course"]["id"]  # already has "Unit 1"
    assert client.post("/units", json={"course_id": course_id, "name": "Unit 1"}, headers=h).status_code == 409
    u2 = client.post("/units", json={"course_id": course_id, "name": "Unit 2"}, headers=h)
    assert u2.status_code == 201
    assert client.patch(f"/units/{u2.json()['id']}", json={"name": "unit 1"}, headers=h).status_code == 409


def test_batch_update_year_collision():
    h = auth(admin_token())
    b1 = make_batch(h, 2040, 2044)
    b2 = make_batch(h, 2041, 2045)
    assert client.patch(f"/batches/{b2['id']}", json={"start_year": 2040, "end_year": 2044}, headers=h).status_code == 409
    assert client.patch(f"/batches/{b1['id']}", json={"start_year": 2040, "end_year": 2044}, headers=h).status_code == 200


def test_session_subject_edit_and_delete():
    h = auth(admin_token())
    sid = make_hierarchy(h)["session"]["id"]
    r = client.patch(f"/sessions/{sid}", json={"subject": "New Subject"}, headers=h)
    assert r.status_code == 200 and r.json()["subject"] == "New Subject"
    assert client.delete(f"/sessions/{sid}", headers=h).status_code == 204
    assert client.delete(f"/sessions/{sid}", headers=h).status_code == 404  # gone


def test_department_list_enriched_with_courses_and_tokens():
    h = auth(admin_token())
    hier = make_hierarchy(h)
    depts = client.get(f"/departments?batch_id={hier['batch']['id']}", headers=h).json()
    assert depts
    d = depts[0]
    assert {"semesters", "courses", "tokensUsed"} <= set(d)
    assert d["courses"] >= 1  # make_hierarchy created one course


def test_student_cannot_delete_course():
    h = auth(admin_token())
    hier = make_hierarchy(h)
    _, stoken = make_user(UserRole.STUDENT, semester_ids=(hier["semester"]["id"],))
    assert client.delete(f"/courses/{hier['course']['id']}", headers=auth(stoken)).status_code in (403, 404)
