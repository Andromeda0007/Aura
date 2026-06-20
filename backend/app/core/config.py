"""Application configuration, loaded from environment / .env via Pydantic settings."""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "Aura API"
    version: str = "0.1.0"
    environment: str = "development"
    debug: bool = True
    log_level: str = "INFO"

    # Database
    database_url: str = "postgresql+psycopg://aura:aura@localhost:5432/aura_db"

    # Auth
    jwt_secret: str = "dev-only-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14

    # AI providers (free tiers)
    groq_api_key: str = ""
    gemini_api_key: str = ""

    # Seeded bootstrap admin (first admin only; admins manage admins after).
    admin_email: str = "admin@aura.app"
    admin_password: str = "ChangeMe!2026"
    admin_name: str = "Ankit Kumar"

    # CORS
    allowed_origins: str = "http://localhost:3000"

    # Context compression
    compression_token_limit: int = 10000

    # External rendering helpers (free, keyless). Only short prompts / compound
    # names are sent to these — never lecture content.
    pollinations_enabled: bool = True  # image generation (image.pollinations.ai)
    pubchem_enabled: bool = True  # chemistry structures (pubchem.ncbi.nlm.nih.gov)
    external_http_timeout: int = 15

    @field_validator("allowed_origins")
    @classmethod
    def _strip_origins(cls, v: str) -> str:
        return v.strip()

    @property
    def allowed_origins_list(self) -> list[str]:
        """ALLOWED_ORIGINS as a clean list (comma-separated string in env)."""
        raw = self.allowed_origins.strip()
        if not raw:
            return []
        if raw.startswith("["):
            # tolerate a JSON-array style value
            import json

            try:
                return [str(o).strip() for o in json.loads(raw)]
            except Exception:
                pass
        return [o.strip() for o in raw.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def ai_enabled(self) -> bool:
        return bool(self.groq_api_key or self.gemini_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
