from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "Aura API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    DATABASE_URL: str
    
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    GEMINI_API_KEY: str
    
    LOCAL_STORAGE_PATH: str = "D:/Aura-Storage"
    
    STORAGE_ENDPOINT: str = ""
    STORAGE_ACCESS_KEY: str = ""
    STORAGE_SECRET_KEY: str = ""
    STORAGE_BUCKET: str = "aura-storage"
    
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]
    
    MAX_CONCURRENT_SESSIONS: int = 100
    COMPRESSION_TOKEN_LIMIT: int = 10000
    
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
