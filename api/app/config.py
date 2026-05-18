from __future__ import annotations
import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://fittracker:fittracker@postgres:5432/fittracker"
    redis_url: str = "redis://redis:6379/0"
    jwt_secret: str = "changeme-em-producao"
    jwt_expires_min: int = 60
    openai_api_key: str = ""
    taco_db_path: str = "/app/data/taco.sqlite"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
