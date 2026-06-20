from fastapi.testclient import TestClient

from app.main import app
from app.models.enums import UserRole
from tests.util import admin_token, auth, make_hierarchy, make_user

client = TestClient(app)


def test_login_and_wrong_password():
    _, token = make_user(UserRole.TEACHER)
    assert token  # login succeeded during make_user
    assert (
        client.post("/auth/login", json={"email": "nobody@aura.app", "password": "x"}).status_code
        == 401
    )


def test_me_authed():
    _, token = make_user(UserRole.TEACHER)
    r = client.get("/auth/me", headers=auth(token))
    assert r.status_code == 200 and r.json()["role"] == "teacher"


def test_signup_removed():
    assert client.post("/auth/signup", json={}).status_code in (404, 405)


def test_session_lifecycle_admin():
    h = auth(admin_token())
    sid = make_hierarchy(h)["session"]["id"]
    assert client.get(f"/sessions/{sid}", headers=h).status_code == 200
    ended = client.post(f"/sessions/{sid}/end", headers=h).json()
    assert ended["status"] == "completed" and ended["end_time"]


def test_stats_overview_authed():
    r = client.get("/stats/overview", headers=auth(admin_token()))
    assert r.status_code == 200 and "totalSessions" in r.json()


def test_stats_deep_authed():
    r = client.get("/stats/deep", headers=auth(admin_token()))
    assert r.status_code == 200
    body = r.json()
    assert "bySubject" in body and "hardestConcepts" in body and "quizPerformance" in body


def test_unauthenticated_rejected():
    assert client.get("/sessions").status_code == 401
    assert client.get("/stats/overview").status_code == 401


def test_public_quiz_404():
    assert client.get("/quizzes/does-not-exist").status_code == 404


def test_health():
    assert client.get("/health").json()["status"] == "ok"
