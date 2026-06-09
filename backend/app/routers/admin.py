"""
Admin endpoints for user and organization management.

Protected by RBAC — only admin and org_manager roles can access.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.middleware.rbac import require_admin, require_org_manager
from app.models import ApiUsage, Project, User, UserRole

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    organization: str
    is_active: bool
    created_at: str


class UserRoleUpdate(BaseModel):
    role: UserRole


class UserActiveUpdate(BaseModel):
    is_active: bool


# ── Helpers ──────────────────────────────────────────────────────────────────

def _user_out(u: User) -> dict[str, Any]:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role.value,
        "organization": u.organization,
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/users", dependencies=[Depends(require_org_manager)])
async def list_users(
    db: AsyncSession = Depends(get_db),
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    """List all platform users (admin + org_manager)."""
    result = await db.execute(
        select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
    )
    return [_user_out(u) for u in result.scalars().all()]


@router.get("/users/{user_id}", dependencies=[Depends(require_org_manager)])
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get a single user by ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _user_out(user)


@router.patch("/users/{user_id}/role", dependencies=[Depends(require_admin)])
async def update_user_role(
    user_id: str,
    body: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update a user's role (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.role = body.role
    await db.commit()
    await db.refresh(user)
    return _user_out(user)


@router.patch("/users/{user_id}/active", dependencies=[Depends(require_admin)])
async def update_user_active(
    user_id: str,
    body: UserActiveUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Activate or deactivate a user account (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = body.is_active
    await db.commit()
    await db.refresh(user)
    return _user_out(user)


@router.post("/data-retention/cleanup", dependencies=[Depends(require_admin)])
async def data_retention_cleanup(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Permanently delete projects soft-deleted older than `days` (admin only)."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        delete(Project).where(Project.is_deleted == True, Project.deleted_at < cutoff)
    )
    await db.commit()
    return {"message": f"Deleted {result.rowcount} projects permanently", "deleted_count": result.rowcount}


@router.get("/analytics/usage", dependencies=[Depends(require_admin)])
async def get_usage_analytics(
    db: AsyncSession = Depends(get_db),
    days: int = 7,
) -> dict:
    """Aggregated API usage stats for the last N days (admin only)."""
    from sqlalchemy import func

    cutoff = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(
            ApiUsage.method,
            ApiUsage.path,
            func.count(ApiUsage.id).label("count"),
            func.avg(ApiUsage.duration_ms).label("avg_duration_ms"),
        )
        .where(ApiUsage.created_at >= cutoff)
        .group_by(ApiUsage.method, ApiUsage.path)
        .order_by(func.count(ApiUsage.id).desc())
    )
    rows = result.all()
    return {
        "period_days": days,
        "total_endpoints": len(rows),
        "endpoints": [
            {
                "method": r.method,
                "path": r.path,
                "requests": r.count,
                "avg_duration_ms": round(r.avg_duration_ms or 0, 2),
            }
            for r in rows
        ],
    }
