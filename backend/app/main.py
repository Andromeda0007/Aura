"""Aura backend — FastAPI application entry point.

P0 scaffold: app factory, CORS, GZip, structured logging, health checks.
Routers, Socket.IO, and workers are mounted in later phases.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine
from app.core.logging import configure_logging, get_logger

configure_logging()
logger = get_logger("aura.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "aura.startup",
        environment=settings.environment,
        ai_enabled=settings.ai_enabled,
        version=settings.version,
    )
    yield
    logger.info("aura.shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        debug=settings.debug,
        docs_url="/docs" if settings.debug else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    @app.get("/health", tags=["health"])
    def health() -> dict:
        """Liveness probe."""
        return {"status": "ok", "service": settings.app_name, "version": settings.version}

    @app.get("/health/db", tags=["health"])
    def health_db() -> dict:
        """Readiness probe — verifies the database connection."""
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return {"status": "ok", "database": "reachable"}
        except Exception as exc:  # noqa: BLE001
            logger.warning("aura.health.db_unreachable", error=str(exc))
            return {"status": "degraded", "database": "unreachable"}

    @app.get("/", tags=["meta"])
    def root() -> dict:
        return {"app": settings.app_name, "version": settings.version, "docs": "/docs"}

    # Routers
    from app.routers import auth, courses, export, library, live, quizzes, sessions, stats

    app.include_router(auth.router)
    app.include_router(sessions.router)
    app.include_router(courses.router)
    app.include_router(quizzes.router)
    app.include_router(export.router)
    app.include_router(stats.router)
    app.include_router(library.router)
    app.include_router(live.router)

    return app


import socketio as _socketio  # noqa: E402

from app.websocket.connection import sio  # noqa: E402
import app.websocket.handlers  # noqa: E402, F401  (registers data-event handlers)
import app.websocket.livequiz  # noqa: E402, F401  (registers live-quiz handlers)

fastapi_app = create_app()

# Combined ASGI app: Socket.IO at /socket.io/, FastAPI for everything else.
app = _socketio.ASGIApp(sio, other_asgi_app=fastapi_app)
