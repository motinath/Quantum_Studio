"""Rate limiting configuration using slowapi + Redis."""

from __future__ import annotations

from typing import Any

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

# Use Redis storage in production, memory in dev/test
storage_uri = settings.redis_url if settings.is_production else "memory://"

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=storage_uri,
)


def get_user_id(request: Request) -> str:
    """Rate-limit key based on authenticated user ID or fallback to IP."""
    user_id: str | None = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"
    return f"ip:{get_remote_address(request)}"


user_limiter = Limiter(
    key_func=get_user_id,
    storage_uri=storage_uri,
)
