import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _token() -> str:
    email = f"c_{uuid.uuid4().hex[:8]}@gmail.com"
    r = client.post(
        "/auth/signup",
        json={"email": email, "password": "supersecret1", "full_name": "C", "role": "teacher"},
    )
    return r.json()["tokens"]["access_token"]


def _make_hierarchy(h: dict) -> dict:
    batch = client.post(
        "/batches", json={"program": "Computer Science", "semester": 5, "year": 2026}, headers=h
    ).json()
    course = client.post(
        "/courses", json={"batch_id": batch["id"], "name": "DBMS", "professor": "Dr. X"}, headers=h
    ).json()
    unit = client.post(
        "/units", json={"course_id": course["id"], "name": "Normalization"}, headers=h
    ).json()
    sess = client.post(
        "/sessions", json={"subject": "1NF/2NF", "unit_id": unit["id"]}, headers=h
    ).json()
    return {"batch": batch, "course": course, "unit": unit, "session": sess}


def test_hierarchy_crud_and_counts():
    h = {"Authorization": f"Bearer {_token()}"}
    hier = _make_hierarchy(h)
    assert hier["course"]["batch_id"] == hier["batch"]["id"]
    assert hier["session"]["unit_id"] == hier["unit"]["id"]

    # batch list shows counts
    batches = client.get("/batches", headers=h).json()
    row = next(b for b in batches if b["id"] == hier["batch"]["id"])
    assert row["courses"] == 1 and row["sessions"] == 1

    # courses under the batch carry unit/session counts
    courses = client.get(f"/courses?batch_id={hier['batch']['id']}", headers=h).json()
    crow = next(c for c in courses if c["id"] == hier["course"]["id"])
    assert crow["units"] == 1 and crow["sessions"] == 1 and "tokensUsed" in crow

    # course detail returns its units with session counts
    detail = client.get(f"/courses/{hier['course']['id']}", headers=h).json()
    assert detail["units"][0]["sessions"] == 1

    # unit detail returns its sessions
    udetail = client.get(f"/units/{hier['unit']['id']}", headers=h).json()
    assert udetail["sessions"][0]["id"] == hier["session"]["id"]


def test_scoped_stats_ok():
    h = {"Authorization": f"Bearer {_token()}"}
    hier = _make_hierarchy(h)
    for path in (
        f"/units/{hier['unit']['id']}/stats",
        f"/courses/{hier['course']['id']}/stats",
        f"/batches/{hier['batch']['id']}/stats",
    ):
        body = client.get(path, headers=h).json()
        assert body["totalSessions"] == 1
        assert "tokensUsed" in body and "hardestConcepts" in body


def test_hierarchy_owner_only():
    h1 = {"Authorization": f"Bearer {_token()}"}
    hier = _make_hierarchy(h1)
    h2 = {"Authorization": f"Bearer {_token()}"}
    assert client.get(f"/batches/{hier['batch']['id']}", headers=h2).status_code == 403
    assert client.get(f"/courses/{hier['course']['id']}", headers=h2).status_code == 403
    assert client.get(f"/units/{hier['unit']['id']}", headers=h2).status_code == 403
    # creating a course in someone else's batch is rejected
    assert (
        client.post(
            "/courses", json={"batch_id": hier["batch"]["id"], "name": "X"}, headers=h2
        ).status_code
        == 404
    )


def test_batch_roster_update():
    h = {"Authorization": f"Bearer {_token()}"}
    batch = client.post(
        "/batches", json={"program": "Math", "semester": 1, "year": 2026}, headers=h
    ).json()
    upd = client.patch(
        f"/batches/{batch['id']}", json={"roster": [{"name": "Ada"}, {"name": "Alan"}]}, headers=h
    ).json()
    assert len(upd["roster"]) == 2
