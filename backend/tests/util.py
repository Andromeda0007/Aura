"""Shared test helpers for the v5 academic tree + RBAC (no signup endpoint)."""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.main import app
from app.models.enums import UserRole
from app.models.semester_member import SemesterMember
from app.models.user import User

client = TestClient(app)

_PW = "supersecret1"


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _login(email: str, password: str = _PW) -> str:
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["tokens"]["access_token"]


def admin_token() -> str:
    """Idempotent test admin (lifespan seed doesn't run under TestClient)."""
    email = "admin_test@aura.app"
    db = SessionLocal()
    try:
        if db.scalar(select(User).where(User.email == email)) is None:
            db.add(
                User(
                    email=email,
                    password_hash=hash_password(_PW),
                    full_name="Test Admin",
                    role=UserRole.ADMIN,
                )
            )
            db.commit()
    finally:
        db.close()
    return _login(email)


def make_user(role: UserRole = UserRole.TEACHER, semester_ids: tuple = ()) -> tuple[str, str]:
    """Create a user directly + semester memberships; return (user_id, token)."""
    email = f"{role.value}_{uuid.uuid4().hex[:8]}@aura.app"
    db = SessionLocal()
    try:
        u = User(email=email, password_hash=hash_password(_PW), full_name=role.value.title(), role=role)
        db.add(u)
        db.flush()
        for sid in semester_ids:
            db.add(SemesterMember(semester_id=uuid.UUID(str(sid)), user_id=u.id))
        db.commit()
        uid = str(u.id)
    finally:
        db.close()
    return uid, _login(email)


def make_batch(admin_h: dict, start: int = 2022, end: int = 2026) -> dict:
    r = client.post("/batches", json={"start_year": start, "end_year": end}, headers=admin_h)
    assert r.status_code == 201, r.text
    return r.json()


def make_department(admin_h: dict, batch_id: str, name: str = "CS") -> dict:
    r = client.post("/departments", json={"batch_id": batch_id, "name": name}, headers=admin_h)
    assert r.status_code == 201, r.text
    return r.json()


def semesters_of(admin_h: dict, department_id: str) -> list[dict]:
    return client.get(f"/departments/{department_id}", headers=admin_h).json()["semesters"]


def make_hierarchy(h: dict) -> dict:
    """Build Batch → Department (auto Sem 1–8) → Course → Unit → Session as the given staff."""
    batch = make_batch(h)
    dept = make_department(h, batch["id"])
    sems = semesters_of(h, dept["id"])
    semester = sems[0]
    course = client.post("/courses", json={"semester_id": semester["id"], "name": "DBMS"}, headers=h).json()
    unit = client.post("/units", json={"course_id": course["id"], "name": "Unit 1"}, headers=h).json()
    sess = client.post("/sessions", json={"subject": "S1", "unit_id": unit["id"]}, headers=h).json()
    return {"batch": batch, "department": dept, "semester": semester, "course": course, "unit": unit, "session": sess}
