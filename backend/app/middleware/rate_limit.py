"""Rate limiting configuration using slowapi + Redis."""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

# Use Redis storage in production, memory in dev/test
storage_uri = settings.redis_url if settings.is_production else "memory://"

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=storage_uri,
)
