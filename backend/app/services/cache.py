"""
Redis caching utilities for expensive computations.

Used by the design pipeline to cache frequency plans, placements,
and DRC results keyed by constraint hashes.
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

import redis

from app.config import settings

log = logging.getLogger(__name__)

_redis: redis.Redis | None = None


def _get_redis() -> redis.Redis | None:
    """Lazy-init Redis connection."""
    global _redis
    if _redis is None:
        try:
            _redis = redis.from_url(settings.redis_url, decode_responses=True)
            _redis.ping()
        except Exception as exc:
            log.warning("Redis unavailable — caching disabled: %s", exc)
            _redis = None
    return _redis


def _make_key(namespace: str, *parts: Any) -> str:
    """Build a cache key from namespace and ordered parts."""
    payload = json.dumps(parts, sort_keys=True, default=str)
    hash_part = hashlib.sha256(payload.encode()).hexdigest()[:16]
    return f"qs:cache:{namespace}:{hash_part}"


def get_cache(key: str) -> Any | None:
    """Get a JSON-deserialized value from cache."""
    r = _get_redis()
    if r is None:
        return None
    try:
        raw = r.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        log.warning("Cache get error: %s", exc)
        return None


def set_cache(key: str, value: Any, ttl_seconds: int = 3600) -> bool:
    """Store a JSON-serialized value in cache with TTL."""
    r = _get_redis()
    if r is None:
        return False
    try:
        r.setex(key, ttl_seconds, json.dumps(value, default=str))
        return True
    except Exception as exc:
        log.warning("Cache set error: %s", exc)
        return False


def delete_cache(key: str) -> bool:
    """Delete a cache key."""
    r = _get_redis()
    if r is None:
        return False
    try:
        r.delete(key)
        return True
    except Exception as exc:
        log.warning("Cache delete error: %s", exc)
        return False


def invalidate_namespace(namespace: str) -> int:
    """Delete all keys matching a namespace pattern."""
    r = _get_redis()
    if r is None:
        return 0
    try:
        pattern = f"qs:cache:{namespace}:*"
        keys = list(r.scan_iter(match=pattern))
        if keys:
            return r.delete(*keys)
        return 0
    except Exception as exc:
        log.warning("Cache invalidate error: %s", exc)
        return 0


# ── Convenience helpers for design pipeline ──────────────────────────────────


def cache_key_for_constraints(namespace: str, constraints: Any) -> str:
    """Generate a cache key from a constraints object."""
    return _make_key(namespace, constraints)


def get_cached_design(namespace: str, constraints: Any) -> Any | None:
    key = cache_key_for_constraints(namespace, constraints)
    return get_cache(key)


def set_cached_design(namespace: str, constraints: Any, result: Any, ttl: int = 3600) -> bool:
    key = cache_key_for_constraints(namespace, constraints)
    return set_cache(key, result, ttl)
