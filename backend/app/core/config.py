import json
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Any
from functools import lru_cache


_DEFAULT_ORIGIN = "http://localhost:3000"


def _parse_origins(v: str) -> List[str]:
    v = (v or "").strip()
    if not v:
        return [_DEFAULT_ORIGIN]
    if v.startswith("["):
        try:
            return [str(x).strip() for x in json.loads(v) if str(x).strip()]
        except Exception:
            pass
    return [o.strip() for o in v.split(",") if o.strip()]


class Settings(BaseSettings):
    APP_NAME: str = "Aura API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    DATABASE_URL: str
    
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    GROQ_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    
    # Plain str so env is never JSON-parsed; use .allowed_origins_list for CORS
    ALLOWED_ORIGINS: str = _DEFAULT_ORIGIN

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def normalize_allowed_origins(cls, v: Any) -> str:
        if isinstance(v, list):
            return ",".join(str(x).strip() for x in v if str(x).strip()) or _DEFAULT_ORIGIN
        if isinstance(v, str):
            return v.strip() or _DEFAULT_ORIGIN
        return _DEFAULT_ORIGIN

    @property
    def allowed_origins_list(self) -> List[str]:
        return _parse_origins(self.ALLOWED_ORIGINS)

    MAX_CONCURRENT_SESSIONS: int = 100
    COMPRESSION_TOKEN_LIMIT: int = 10000
    
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
