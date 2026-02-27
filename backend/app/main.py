from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import structlog
import socketio

from .core.config import get_settings
from .core.database import init_db
from .api import auth, sessions, quiz
from .websocket.connection import sio
from .workers.manager import worker_manager

settings = get_settings()
logger = structlog.get_logger()


def _migrate_enum_values():
    """Idempotently add new enum values that don't exist yet in PostgreSQL.
    NOTE: SQLAlchemy maps Python enum .name (UPPERCASE) → PostgreSQL enum label.
    Always use UPPERCASE labels here to match that convention."""
    from sqlalchemy import text
    from .core.database import engine
    new_values = ["GENERATE_DIAGRAM"]
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        for val in new_values:
            try:
                conn.execute(text(f"ALTER TYPE commandintent ADD VALUE IF NOT EXISTS '{val}'"))
                logger.info("Enum value ensured", value=val)
            except Exception as exc:
                logger.warning("Enum migration skipped", value=val, reason=str(exc))


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Aura API", version=settings.VERSION, environment=settings.ENVIRONMENT)
    init_db()
    _migrate_enum_values()
    await worker_manager.start_all()
    yield
    logger.info("Shutting down Aura API")
    await worker_manager.stop_all()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["Sessions"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["Quizzes"])


@app.get("/")
async def root():
    return {"name": settings.APP_NAME, "version": settings.VERSION, "status": "operational"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


combined_app = socketio.ASGIApp(sio, other_asgi_app=app)
app = combined_app
