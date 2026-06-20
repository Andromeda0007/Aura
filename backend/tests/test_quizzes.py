import uuid

from app.core.database import SessionLocal
from app.models.enums import UserRole
from app.models.quiz import Quiz
from app.models.session import Session
from tests.util import admin_token, auth, client, make_user

QUIZ_DATA = {
    "questions": [
        {"question": "2+2?", "options": ["3", "4"], "answer_index": 1, "explanation": "math"},
        {"question": "Sky color?", "options": ["Blue", "Green"], "answer_index": 0, "explanation": "physics"},
    ]
}


def _seed_quiz() -> tuple[str, str]:
    owner_id, _ = make_user(UserRole.TEACHER)
    db = SessionLocal()
    try:
        sess = Session(teacher_id=uuid.UUID(owner_id), subject="Quiz subject")
        db.add(sess)
        db.flush()
        quiz = Quiz(session_id=sess.id, quiz_data=QUIZ_DATA)
        db.add(quiz)
        db.commit()
        return str(quiz.id), quiz.share_code
    finally:
        db.close()


def test_submit_and_results_flow():
    h = auth(admin_token())  # admin can read any quiz's results
    quiz_id, code = _seed_quiz()

    r = client.post(f"/quizzes/{code}/submit", json={"student_name": "Ada", "answers": [1, 0]})
    assert r.status_code == 200, r.text
    assert r.json() == {"score": 2, "total": 2, "correct": [True, True]}

    r = client.post(f"/quizzes/{code}/submit", json={"answers": [0, 0]})
    assert r.json()["score"] == 1

    res = client.get(f"/quizzes/{quiz_id}/results", headers=h).json()
    assert res["attempts"] == 2
    assert res["avgScore"] == 1.5
    assert res["mostMissed"][0]["question"] == "2+2?"


def test_results_denied_for_outsider():
    quiz_id, _ = _seed_quiz()
    _, t = make_user(UserRole.TEACHER)  # teacher with no batch access
    assert client.get(f"/quizzes/{quiz_id}/results", headers=auth(t)).status_code == 404


def test_public_quiz_submit_404():
    assert client.post("/quizzes/nope/submit", json={"answers": []}).status_code == 404
