"""
Database engine, session factory, and base declarative model.
Uses SQLAlchemy 2.0 async engine with asyncpg driver.
Falls back gracefully when a real DB is not available (SQLite for dev).
"""

from __future__ import annotations

import logging
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
import sqlalchemy as sa

from app.config import settings

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

_db_url = settings.database_url

# Allow easy SQLite fallback for local dev without Postgres
if _db_url.startswith("sqlite"):
    engine = create_async_engine(_db_url, echo=False, connect_args={"check_same_thread": False})
else:
    engine = create_async_engine(
        _db_url,
        echo=False,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
    )

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


# ---------------------------------------------------------------------------
# Base model
# ---------------------------------------------------------------------------


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Dependency
# ---------------------------------------------------------------------------


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ---------------------------------------------------------------------------
# Init tables
# ---------------------------------------------------------------------------


async def init_db() -> None:
    """Create all tables if they do not exist (dev/test only; use Alembic in prod)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Auto-upgrade database tables by adding new columns if missing
        for col_name, col_type in [("oauth_provider", "VARCHAR(32)"), ("oauth_subject", "VARCHAR(255)")]:
            try:
                await conn.execute(sa.text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                log.info(f"Database migration: Added column {col_name} to users table.")
            except Exception:
                # Column already exists, ignore
                pass
    log.info("Database tables ensured.")
