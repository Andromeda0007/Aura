import uuid

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models.quiz import Quiz
from app.models.session import Session

client = TestClient(app)

QUIZ_DATA = {
    "questions": [
        {"question": "2+2?", "options": ["3", "4"], "answer_index": 1, "explanation": "math"},
        {"question": "Sky color?", "options": ["Blue", "Green"], "answer_index": 0, "explanation": "physics"},
    ]
}


def _teacher() -> tuple[str, str]:
    email = f"q_{uuid.uuid4().hex[:8]}@gmail.com"
    r = client.post(
        "/auth/signup",
        json={"email": email, "password": "supersecret1", "full_name": "Q", "role": "teacher"},
    )
    assert r.status_code == 201, r.text
    return r.json()["user"]["id"], r.json()["tokens"]["access_token"]


def _seed_quiz(teacher_id: str) -> tuple[str, str]:
    db = SessionLocal()
    try:
        sess = Session(teacher_id=uuid.UUID(teacher_id), subject="Quiz subject")
        db.add(sess)
        db.flush()
        quiz = Quiz(session_id=sess.id, quiz_data=QUIZ_DATA)
        db.add(quiz)
        db.commit()
        return str(quiz.id), quiz.share_code
    finally:
        db.close()


def test_submit_and_results_flow():
    teacher_id, token = _teacher()
    quiz_id, code = _seed_quiz(teacher_id)
    h = {"Authorization": f"Bearer {token}"}

    # full marks
    r = client.post(f"/quizzes/{code}/submit", json={"student_name": "Ada", "answers": [1, 0]})
    assert r.status_code == 200, r.text
    assert r.json() == {"score": 2, "total": 2, "correct": [True, True]}

    # one wrong, anonymous
    r = client.post(f"/quizzes/{code}/submit", json={"answers": [0, 0]})
    assert r.json()["score"] == 1

    res = client.get(f"/quizzes/{quiz_id}/results", headers=h).json()
    assert res["attempts"] == 2
    assert res["avgScore"] == 1.5
    assert res["recent"][0]["name"] in {"Ada", "Anonymous"}
    # the missed question (2+2) should top most-missed
    assert res["mostMissed"][0]["question"] == "2+2?"


def test_results_owner_only():
    owner_id, _ = _teacher()
    quiz_id, _ = _seed_quiz(owner_id)
    _, other_token = _teacher()
    r = client.get(f"/quizzes/{quiz_id}/results", headers={"Authorization": f"Bearer {other_token}"})
    assert r.status_code == 403
