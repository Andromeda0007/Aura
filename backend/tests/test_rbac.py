import uuid

from tests.util import _PW, _login, admin_token, auth, client, make_batch, make_department, semesters_of


def _create_account(admin_h: dict, role: str, semester_ids: list[str]) -> str:
    email = f"{role}_{uuid.uuid4().hex[:8]}@aura.app"
    r = client.post(
        "/admin/users",
        json={"email": email, "full_name": role.title(), "password": _PW, "role": role, "semester_ids": semester_ids},
        headers=admin_h,
    )
    assert r.status_code == 201, r.text
    return email


def test_teacher_scoped_to_assigned_semesters():
    ah = auth(admin_token())
    batch = make_batch(ah)
    cs = make_department(ah, batch["id"], "CS")
    it = make_department(ah, batch["id"], "IT")
    cs_sems = semesters_of(ah, cs["id"])
    it_sems = semesters_of(ah, it["id"])

    # teacher assigned CS Sem 1 + 2
    th = auth(_login(_create_account(ah, "teacher", [cs_sems[0]["id"], cs_sems[1]["id"]])))

    # can read assigned semester, create a course there
    assert client.get(f"/semesters/{cs_sems[0]['id']}", headers=th).status_code == 200
    assert (
        client.post("/courses", json={"semester_id": cs_sems[0]["id"], "name": "DBMS"}, headers=th).status_code
        == 201
    )
    # cannot touch a semester they're not assigned to (other dept)
    assert client.get(f"/semesters/{it_sems[0]['id']}", headers=th).status_code == 404
    assert (
        client.post("/courses", json={"semester_id": it_sems[0]["id"], "name": "X"}, headers=th).status_code
        == 404
    )
    # teachers can't create batches/departments (admin only)
    assert client.post("/batches", json={"start_year": 2023, "end_year": 2027}, headers=th).status_code == 403
    assert (
        client.post("/departments", json={"batch_id": batch["id"], "name": "Z"}, headers=th).status_code == 403
    )


def test_student_is_read_only():
    ah = auth(admin_token())
    batch = make_batch(ah)
    cs = make_department(ah, batch["id"], "CS")
    sem = semesters_of(ah, cs["id"])[0]
    course = client.post("/courses", json={"semester_id": sem["id"], "name": "DBMS"}, headers=ah).json()
    sh = auth(_login(_create_account(ah, "student", [sem["id"]])))

    assert client.get(f"/semesters/{sem['id']}", headers=sh).status_code == 200
    assert client.get(f"/courses/{course['id']}", headers=sh).status_code == 200
    # no writes
    assert client.post("/courses", json={"semester_id": sem["id"], "name": "No"}, headers=sh).status_code == 403


def test_assignment_validation():
    ah = auth(admin_token())
    b1 = make_batch(ah)
    b2 = make_batch(ah)
    cs1 = semesters_of(ah, make_department(ah, b1["id"], "CS")["id"])
    cs2 = semesters_of(ah, make_department(ah, b2["id"], "CS")["id"])

    # student must have exactly one semester
    assert (
        client.post(
            "/admin/users",
            json={"email": f"s_{uuid.uuid4().hex[:8]}@aura.app", "full_name": "S", "password": _PW, "role": "student", "semester_ids": []},
            headers=ah,
        ).status_code
        == 400
    )
    # a teacher CAN span semesters across different batches
    r = client.post(
        "/admin/users",
        json={"email": f"t_{uuid.uuid4().hex[:8]}@aura.app", "full_name": "T", "password": _PW, "role": "teacher", "semester_ids": [cs1[4]["id"], cs2[2]["id"]]},
        headers=ah,
    )
    assert r.status_code == 201, r.text
    assert len(r.json()["semesterIds"]) == 2


def test_non_admin_cannot_use_admin_api():
    ah = auth(admin_token())
    batch = make_batch(ah)
    sem = semesters_of(ah, make_department(ah, batch["id"], "CS")["id"])[0]
    th = auth(_login(_create_account(ah, "teacher", [sem["id"]])))
    assert client.get("/admin/users", headers=th).status_code == 403
    assert client.get("/admin/stats", headers=th).status_code == 403
