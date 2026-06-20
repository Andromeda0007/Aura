"""Test DB isolation: reset the schema once per session so tests start clean
(batches are globally unique now, so a persistent DB would collide across runs)."""
import pytest
from sqlalchemy import text

import app.models  # noqa: F401  (register all models on Base.metadata)
from app.core.database import Base, engine


@pytest.fixture(scope="session", autouse=True)
def reset_database():
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    Base.metadata.create_all(bind=engine)
    yield
