"""Shared test helpers for the RBAC world (no signup endpoint anymore)."""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.main import app
from app.models.batch_member import BatchMember
from app.models.enums import UserRole
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


def make_user(role: UserRole = UserRole.TEACHER, batch_ids: tuple = ()) -> tuple[str, str]:
    """Create a user directly + batch memberships; return (user_id, token)."""
    email = f"{role.value}_{uuid.uuid4().hex[:8]}@aura.app"
    db = SessionLocal()
    try:
        u = User(
            email=email,
            password_hash=hash_password(_PW),
            full_name=role.value.title(),
            role=role,
        )
        db.add(u)
        db.flush()
        for bid in batch_ids:
            db.add(BatchMember(batch_id=uuid.UUID(str(bid)), user_id=u.id))
        db.commit()
        uid = str(u.id)
    finally:
        db.close()
    return uid, _login(email)


def make_batch(admin_h: dict, program: str = "CS", semester: int = 5, year: int = 2026) -> dict:
    r = client.post(
        "/batches", json={"program": program, "semester": semester, "year": year}, headers=admin_h
    )
    assert r.status_code == 201, r.text
    return r.json()


def make_hierarchy(h: dict, batch_id: str | None = None) -> dict:
    """Create (or reuse) batch → course → unit → session with the given staff token."""
    if batch_id is None:
        batch_id = client.post(
            "/batches", json={"program": "CS", "semester": 5, "year": 2026}, headers=h
        ).json()["id"]
    course = client.post(
        "/courses", json={"batch_id": batch_id, "name": "DBMS"}, headers=h
    ).json()
    unit = client.post(
        "/units", json={"course_id": course["id"], "name": "Unit 1"}, headers=h
    ).json()
    sess = client.post(
        "/sessions", json={"subject": "S1", "unit_id": unit["id"]}, headers=h
    ).json()
    return {"batch_id": batch_id, "course": course, "unit": unit, "session": sess}
