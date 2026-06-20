import uuid

from tests.util import _PW, _login, admin_token, auth, client, make_batch


def _create_account(admin_h: dict, role: str, batch_ids: list[str]) -> str:
    email = f"{role}_{uuid.uuid4().hex[:8]}@aura.app"
    r = client.post(
        "/admin/users",
        json={"email": email, "full_name": role.title(), "password": _PW, "role": role, "batch_ids": batch_ids},
        headers=admin_h,
    )
    assert r.status_code == 201, r.text
    return email


def test_teacher_scoped_to_assigned_batches():
    ah = auth(admin_token())
    b1 = make_batch(ah, program="CS")["id"]
    b2 = make_batch(ah, program="EE")["id"]
    th = auth(_login(_create_account(ah, "teacher", [b1])))

    ids = {b["id"] for b in client.get("/batches", headers=th).json()}
    assert b1 in ids and b2 not in ids
    assert client.get(f"/batches/{b1}", headers=th).status_code == 200
    assert client.get(f"/batches/{b2}", headers=th).status_code == 404  # not a member

    # can create a course in the assigned batch, not in the other
    assert client.post("/courses", json={"batch_id": b1, "name": "DBMS"}, headers=th).status_code == 201
    assert client.post("/courses", json={"batch_id": b2, "name": "X"}, headers=th).status_code == 404
    # teachers can't create batches (admin only)
    assert (
        client.post("/batches", json={"program": "X", "semester": 1, "year": 2026}, headers=th).status_code
        == 403
    )


def test_student_is_read_only():
    ah = auth(admin_token())
    b1 = make_batch(ah, program="CS")["id"]
    course = client.post("/courses", json={"batch_id": b1, "name": "DBMS"}, headers=ah).json()
    sh = auth(_login(_create_account(ah, "student", [b1])))

    # can read their batch + course
    assert client.get(f"/batches/{b1}", headers=sh).status_code == 200
    assert client.get(f"/courses/{course['id']}", headers=sh).status_code == 200
    # cannot write
    assert client.post("/courses", json={"batch_id": b1, "name": "Nope"}, headers=sh).status_code == 403
    assert (
        client.post("/units", json={"course_id": course["id"], "name": "U"}, headers=sh).status_code
        == 403
    )


def test_student_requires_exactly_one_batch():
    ah = auth(admin_token())
    b1 = make_batch(ah)["id"]
    b2 = make_batch(ah)["id"]
    base = {"email": f"s_{uuid.uuid4().hex[:8]}@aura.app", "full_name": "S", "password": _PW, "role": "student"}
    assert client.post("/admin/users", json={**base, "batch_ids": []}, headers=ah).status_code == 400
    assert client.post("/admin/users", json={**base, "batch_ids": [b1, b2]}, headers=ah).status_code == 400


def test_non_admin_cannot_use_admin_api():
    ah = auth(admin_token())
    b1 = make_batch(ah)["id"]
    th = auth(_login(_create_account(ah, "teacher", [b1])))
    assert client.get("/admin/users", headers=th).status_code == 403
    assert client.get("/admin/stats", headers=th).status_code == 403
