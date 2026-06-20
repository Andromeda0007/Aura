import uuid

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models.quiz import Quiz
from app.models.session import Session

client = TestClient(app)

QUIZ_DATA = {
    "questions": [
        {"question": "2+2?", "options": ["3", "4"], "answer_index": 1, "explanation": "m"},
        {"question": "Sky?", "options": ["Blue", "Green"], "answer_index": 0, "explanation": "p"},
    ]
}


def _teacher() -> tuple[str, str]:
    email = f"a_{uuid.uuid4().hex[:8]}@gmail.com"
    r = client.post(
        "/auth/signup",
        json={"email": email, "password": "supersecret1", "full_name": "A", "role": "teacher"},
    )
    return r.json()["user"]["id"], r.json()["tokens"]["access_token"]


def _seed_quiz(teacher_id: str) -> str:
    db = SessionLocal()
    try:
        sess = Session(teacher_id=uuid.UUID(teacher_id), subject="HW")
        db.add(sess)
        db.flush()
        quiz = Quiz(session_id=sess.id, quiz_data=QUIZ_DATA)
        db.add(quiz)
        db.commit()
        return str(quiz.id)
    finally:
        db.close()


def test_assignment_flow():
    tid, token = _teacher()
    h = {"Authorization": f"Bearer {token}"}
    quiz_id = _seed_quiz(tid)

    created = client.post(
        "/assignments",
        json={"title": "Homework 1", "instructions": "Do it", "quiz_id": quiz_id},
        headers=h,
    ).json()
    code = created["shareCode"]

    pub = client.get(f"/assignments/code/{code}").json()
    assert pub["title"] == "Homework 1"
    assert len(pub["quizData"]["questions"]) == 2

    res = client.post(f"/assignments/code/{code}/submit", json={"student_name": "Ada", "answers": [1, 0]})
    assert res.json() == {"score": 2, "total": 2}

    subs = client.get(f"/assignments/{created['id']}/submissions", headers=h).json()
    assert subs["submissions"][0]["name"] == "Ada"
    assert subs["submissions"][0]["score"] == 2

    listed = client.get("/assignments", headers=h).json()
    assert any(a["id"] == created["id"] and a["submissions"] == 1 for a in listed)


def test_assignment_public_404():
    assert client.get("/assignments/code/nope").status_code == 404
