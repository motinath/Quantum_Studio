"""
Middleware that extracts the authenticated user ID from JWT tokens
and stores it on request.state for downstream use (e.g. per-user rate limiting).
"""

from __future__ import annotations

from typing import Any

from fastapi import Request

from app.auth import decode_token


async def auth_state_middleware(request: Request, call_next: Any) -> Any:
    """Decode the Bearer token (if present) and attach user_id to request.state."""
    request.state.user_id = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
            if user_id:
                request.state.user_id = user_id
        except Exception:
            pass
    response = await call_next(request)
    return response
