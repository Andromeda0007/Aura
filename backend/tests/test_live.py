import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _teacher_token() -> str:
    email = f"l_{uuid.uuid4().hex[:8]}@gmail.com"
    r = client.post(
        "/auth/signup",
        json={"email": email, "password": "supersecret1", "full_name": "L", "role": "teacher"},
    )
    return r.json()["tokens"]["access_token"]


def test_live_resolve_happy_and_404():
    token = _teacher_token()
    h = {"Authorization": f"Bearer {token}"}
    sess = client.post("/sessions", json={"subject": "Live subject"}, headers=h).json()
    code = sess["join_code"]
    assert code and len(code) == 6

    r = client.get(f"/live/{code}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["sessionId"] == sess["id"]
    assert body["subject"] == "Live subject"

    # lowercase still resolves (codes are normalized)
    assert client.get(f"/live/{code.lower()}").status_code == 200
    assert client.get("/live/ZZZZZZ").status_code == 404


def test_ask_tutor_404():
    # invalid code is rejected before any LLM call
    r = client.post("/live/ZZZZZZ/ask", json={"question": "what is photosynthesis?"})
    assert r.status_code == 404
