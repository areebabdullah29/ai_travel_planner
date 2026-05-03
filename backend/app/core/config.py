from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Server
    APP_NAME: str = "Travel Buddy API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    MONGO_URI: str = "mongodb://localhost:27017/travel_buddy"

    # Security & JWT
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    JWT_SECRET_KEY: str = "jwt-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 24
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # External APIs
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENWEATHER_API_KEY: Optional[str] = None
    OPENTRIPMAP_API_KEY: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
