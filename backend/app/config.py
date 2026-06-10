"""
Application configuration — loaded from environment / .env file.

Dev tip: copy .env.example → .env and set DATABASE_URL=sqlite+aiosqlite:///./dev.db
for zero-setup local development (no Postgres required).
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_env: str = "development"
    max_qubits: int = 256

    # Database — defaults to SQLite for zero-setup local dev
    database_url: str = "sqlite+aiosqlite:///./dev.db"
    sync_database_url: str = "sqlite:///./dev.db"

    # Redis (optional — only needed for task queues in production)
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    secret_key: str = "dev-secret-key-change-in-production-minimum-32-chars"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10  # 10 minutes

    # SMTP Settings (optional for registration verification email)
    smtp_host: str = "smtp.office365.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "Quantum Studio"
    
    # Outlook SMTP fields requested by user (maps to SMTP_USER, SMTP_PASSWORD, MAIL_FROM)
    smtp_user: str = ""
    mail_from: str = ""

    # CORS — localhost ports used by Vite dev server
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:5174"

    # Claude / Anthropic (optional — falls back to rule-based assistant if empty)
    anthropic_api_key: str = ""

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""

    # GitHub OAuth
    github_client_id: str = ""
    github_client_secret: str = ""
    frontend_url: str = "http://localhost:8080"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


settings = Settings()
