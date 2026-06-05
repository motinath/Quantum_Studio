"""
Application configuration — loaded from environment / .env file.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_env: str = "development"
    max_qubits: int = 256

    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/quantum_studio"
    sync_database_url: str = "postgresql://postgres:password@localhost:5432/quantum_studio"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    secret_key: str = "dev-secret-key-change-in-production-minimum-32-chars"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:5174"

    # Claude
    anthropic_api_key: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


settings = Settings()
