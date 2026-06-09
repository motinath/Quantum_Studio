"""
Role-Based Access Control (RBAC) dependencies.

Provides reusable FastAPI dependencies for enforcing role-based
permissions on endpoints.
"""

from __future__ import annotations

from typing import Sequence

from fastapi import Depends, HTTPException, status

from app.auth import get_current_user
from app.models import User, UserRole


def require_role(*allowed_roles: UserRole):
    """Factory that returns a dependency enforcing one or more allowed roles."""

    async def _check_role(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for this resource",
            )
        return user

    return _check_role


# ── Convenience shortcuts ────────────────────────────────────────────────────

require_admin = require_role(UserRole.admin)
require_org_manager = require_role(UserRole.admin, UserRole.org_manager)
require_engineer = require_role(UserRole.admin, UserRole.org_manager, UserRole.engineer)
