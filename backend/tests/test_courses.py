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


def test_course_crud_and_session_link():
    h = {"Authorization": f"Bearer {_token()}"}
    course = client.post("/courses", json={"name": "Bio 9", "color": "emerald"}, headers=h).json()
    cid = course["id"]

    # create a session inside the course
    sess = client.post("/sessions", json={"subject": "Cells", "course_id": cid}, headers=h).json()
    assert sess["course_id"] == cid

    detail = client.get(f"/courses/{cid}", headers=h).json()
    assert len(detail["sessions"]) == 1

    # roster update
    upd = client.patch(
        f"/courses/{cid}", json={"roster": [{"name": "Ada"}, {"name": "Alan"}]}, headers=h
    ).json()
    assert len(upd["roster"]) == 2

    listed = client.get("/courses", headers=h).json()
    row = next(c for c in listed if c["id"] == cid)
    assert row["sessions"] == 1 and row["students"] == 2

    # delete keeps the session (course_id -> null)
    assert client.delete(f"/courses/{cid}", headers=h).status_code == 204
    after = client.get(f"/sessions/{sess['id']}", headers=h).json()
    assert after["course_id"] is None


def test_course_owner_only():
    h1 = {"Authorization": f"Bearer {_token()}"}
    cid = client.post("/courses", json={"name": "Mine"}, headers=h1).json()["id"]
    h2 = {"Authorization": f"Bearer {_token()}"}
    assert client.get(f"/courses/{cid}", headers=h2).status_code == 403
