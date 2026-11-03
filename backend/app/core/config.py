from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List
import os


class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    APP_SECRET_KEY: str = "dev-secret-key-change-in-production"

    # Database
    DATABASE_URL: str = "sqlite:///./loopbreak.db"

    # AI
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"
    AI_PROVIDER: str = "gemini"
    AI_MODE: str = "auto"

    # Files
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 10

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,https://loop-break-ai.vercel.app,*"

    # Embeddings
    USE_EMBEDDINGS: bool = False
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    SIMILARITY_THRESHOLD: float = 0.75

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_ai_enabled(self) -> bool:
        if self.AI_MODE == "demo":
            return False
        if self.AI_MODE == "ai":
            return bool(self.GEMINI_API_KEY)
        # auto
        return bool(self.GEMINI_API_KEY)

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

