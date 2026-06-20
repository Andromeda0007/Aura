"""Idempotent bootstrap seed — ensure the first admin exists.

Only the FIRST admin is seeded (from .env). After that, admins create and
manage other admins/teachers/students from the Users panel.
"""
from __future__ import annotations

from sqlalchemy import select

from app.core.config import settings
from app.core.database import session_scope
from app.core.logging import get_logger
from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User

logger = get_logger("aura.seed")


def seed_admin() -> None:
    with session_scope() as db:
        existing_admin = db.scalar(select(User).where(User.role == UserRole.ADMIN))
        if existing_admin is not None:
            return
        email = settings.admin_email.lower()
        # Don't collide with a non-admin already holding that email.
        if db.scalar(select(User).where(User.email == email)) is not None:
            logger.warning("seed.admin_email_taken", email=email)
            return
        db.add(
            User(
                email=email,
                password_hash=hash_password(settings.admin_password),
                full_name=settings.admin_name,
                role=UserRole.ADMIN,
            )
        )
        logger.info("seed.admin_created", email=email)
