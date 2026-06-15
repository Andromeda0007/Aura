import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _signup() -> tuple[str, str]:
    email = f"t_{uuid.uuid4().hex[:8]}@gmail.com"
    r = client.post(
        "/auth/signup",
        json={"email": email, "password": "supersecret1", "full_name": "T", "role": "teacher"},
    )
    assert r.status_code == 201, r.text
    return email, r.json()["tokens"]["access_token"]


def test_auth_flow_and_wrong_password():
    email, token = _signup()
    h = {"Authorization": f"Bearer {token}"}
    assert client.get("/auth/me", headers=h).status_code == 200
    assert client.post("/auth/login", json={"email": email, "password": "WRONG"}).status_code == 401


def test_session_lifecycle():
    _, token = _signup()
    h = {"Authorization": f"Bearer {token}"}
    sid = client.post("/sessions", json={"subject": "X"}, headers=h).json()["id"]
    assert client.get(f"/sessions/{sid}", headers=h).status_code == 200
    ended = client.post(f"/sessions/{sid}/end", headers=h).json()
    assert ended["status"] == "completed" and ended["end_time"]


def test_stats_overview_authed():
    _, token = _signup()
    r = client.get("/stats/overview", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert "totalSessions" in r.json()


def test_unauthenticated_rejected():
    assert client.get("/sessions").status_code == 401
    assert client.get("/stats/overview").status_code == 401


def test_public_quiz_404():
    assert client.get("/quizzes/does-not-exist").status_code == 404


def test_health():
    assert client.get("/health").json()["status"] == "ok"
