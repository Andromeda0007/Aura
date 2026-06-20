"""In-memory live (Kahoot-style) quiz orchestration over Socket.IO.

State is intentionally ephemeral (process memory): a live game lasts minutes and
resetting on restart is acceptable for a classroom. Teacher events are guarded by
the teacher-only connection role; student events resolve the session from the
student's authenticated connection. All student-facing emits target the live room
ONLY, and the teacher (host) is addressed by its own sid — so a socket that sits in
both rooms never receives an event twice.
"""
from __future__ import annotations

import time
import uuid

from app.core.database import session_scope
from app.core.logging import get_logger
from app.models.quiz import Quiz
from app.models.session import Session
from app.websocket.connection import active_connections, live_room, sio

logger = get_logger("aura.ws.livequiz")

# session_id -> game state
_games: dict[str, dict] = {}


def _role_session(sid: str, role: str) -> str | None:
    info = active_connections.get(sid)
    if info and info.get("role") == role:
        return info["session_id"]
    return None


def _leaderboard(game: dict) -> list[dict]:
    players = [{"name": p["name"], "score": p["score"]} for p in game["players"].values()]
    players.sort(key=lambda p: -p["score"])
    return players[:10]


@sio.on("livequiz_start")
async def livequiz_start(sid: str, data: dict) -> None:
    session_id = _role_session(sid, "teacher")
    if not session_id:
        return
    quiz_id = (data or {}).get("quizId")
    if not quiz_id:
        return
    try:
        qid = uuid.UUID(str(quiz_id))
    except ValueError:
        return
    with session_scope() as db:
        quiz = db.get(Quiz, qid)
        if quiz is None:
            return
        sess = db.get(Session, quiz.session_id) if quiz.session_id else None
        # Only the owning teacher may host this quiz live.
        if sess is None or str(sess.teacher_id) != active_connections[sid]["user_id"]:
            return
        questions = (quiz.quiz_data or {}).get("questions", [])
        subject = sess.subject
    if not questions:
        return

    _games[session_id] = {
        "host": sid,
        "questions": questions,
        "subject": subject,
        "current": -1,
        "asked_at": 0.0,
        "players": {},  # sid -> {name, score}
        "answers": {},  # qindex -> {sid: choice}
    }
    await sio.emit(
        "livequiz_started", {"subject": subject, "total": len(questions)}, room=live_room(session_id)
    )
    await sio.emit("livequiz_started", {"subject": subject, "total": len(questions)}, to=sid)
    logger.info("livequiz.start", session_id=session_id, n=len(questions))


@sio.on("livequiz_join")
async def livequiz_join(sid: str, data: dict) -> None:
    session_id = _role_session(sid, "student")
    if not session_id:
        return
    game = _games.get(session_id)
    if not game:
        return
    name = ((data or {}).get("name") or "Player").strip()[:40] or "Player"
    game["players"][sid] = {"name": name, "score": 0}
    await sio.emit("livequiz_joined", {"name": name}, to=sid)
    await sio.emit("livequiz_players", {"count": len(game["players"])}, to=game["host"])


@sio.on("livequiz_question")
async def livequiz_question(sid: str, data: dict) -> None:
    session_id = _role_session(sid, "teacher")
    if not session_id:
        return
    game = _games.get(session_id)
    if not game:
        return
    idx = int((data or {}).get("index", game["current"] + 1))
    if idx < 0 or idx >= len(game["questions"]):
        return
    game["current"] = idx
    game["asked_at"] = time.monotonic()
    game["answers"][idx] = {}
    q = game["questions"][idx]
    payload = {
        "index": idx,
        "total": len(game["questions"]),
        "question": q.get("question", ""),
        "options": q.get("options", []),
    }
    # students never receive answer_index
    await sio.emit("livequiz_question", payload, room=live_room(session_id))
    await sio.emit("livequiz_question", {**payload, "count": 0}, to=sid)


@sio.on("livequiz_answer")
async def livequiz_answer(sid: str, data: dict) -> None:
    session_id = _role_session(sid, "student")
    if not session_id:
        return
    game = _games.get(session_id)
    if not game or game["current"] < 0:
        return
    player = game["players"].get(sid)
    if not player:
        return
    idx = game["current"]
    ans_map = game["answers"].setdefault(idx, {})
    if sid in ans_map:
        return  # one answer per question
    choice = int((data or {}).get("choice", -1))
    ans_map[sid] = choice
    correct = choice == game["questions"][idx].get("answer_index")
    if correct:
        elapsed = time.monotonic() - game["asked_at"]
        player["score"] += max(500, 1000 - int(elapsed * 25))  # speed bonus
    await sio.emit("livequiz_answered", {"received": True}, to=sid)
    await sio.emit(
        "livequiz_tally", {"index": idx, "count": len(ans_map)}, to=game["host"]
    )


@sio.on("livequiz_reveal")
async def livequiz_reveal(sid: str, data: dict) -> None:
    session_id = _role_session(sid, "teacher")
    if not session_id:
        return
    game = _games.get(session_id)
    if not game or game["current"] < 0:
        return
    idx = game["current"]
    q = game["questions"][idx]
    ans_map = game["answers"].get(idx, {})
    tally = [0] * len(q.get("options", []))
    for choice in ans_map.values():
        if 0 <= choice < len(tally):
            tally[choice] += 1
    leaderboard = _leaderboard(game)
    student_payload = {"index": idx, "answerIndex": q.get("answer_index"), "leaderboard": leaderboard}
    host_payload = {**student_payload, "tally": tally}
    await sio.emit("livequiz_reveal", student_payload, room=live_room(session_id))
    await sio.emit("livequiz_reveal", host_payload, to=sid)


@sio.on("livequiz_end")
async def livequiz_end(sid: str, data: dict) -> None:
    session_id = _role_session(sid, "teacher")
    if not session_id:
        return
    game = _games.pop(session_id, None)
    if not game:
        return
    leaderboard = _leaderboard(game)
    await sio.emit("livequiz_end", {"leaderboard": leaderboard}, room=live_room(session_id))
    await sio.emit("livequiz_end", {"leaderboard": leaderboard}, to=sid)
    logger.info("livequiz.end", session_id=session_id)
