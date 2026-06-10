"""
SQLAlchemy ORM models for Quantum Studio.

Tables:
  users          – platform users
  projects       – quantum chip projects
  versions       – project version snapshots
  qclang_files   – .qc source files (QCLang)
  layouts        – compiled physical layouts
  simulations    – simulation jobs
  verification_reports – DRC / freq-collision reports
  tapeout_packages     – final tapeout exports
  chat_history         – Claude assistant history
  materials            – material library
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ── helpers ────────────────────────────────────────────────────────────────

def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── enums ───────────────────────────────────────────────────────────────────

class UserRole(str, PyEnum):
    admin = "admin"
    org_manager = "org_manager"
    engineer = "engineer"


class ProjectStatus(str, PyEnum):
    draft = "draft"
    in_progress = "in_progress"
    review = "review"
    completed = "completed"


class SimulationStatus(str, PyEnum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class VerificationStatus(str, PyEnum):
    pending = "pending"
    passed = "passed"
    failed = "failed"
    warning = "warning"


# ── User ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(256))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.engineer)
    organization: Mapped[str] = mapped_column(String(120), default="Independent")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    projects: Mapped[list["Project"]] = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    chat_history: Mapped[list["ChatHistory"]] = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")


# ── Project ─────────────────────────────────────────────────────────────────

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    topology: Mapped[str] = mapped_column(String(64), default="custom")
    num_qubits: Mapped[int] = mapped_column(Integer, default=0)
    target_frequency_ghz: Mapped[float] = mapped_column(Float, default=5.0)
    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus), default=ProjectStatus.draft)
    # Substrate / material metadata
    substrate_material: Mapped[str] = mapped_column(String(64), default="silicon")
    metal_layer: Mapped[str] = mapped_column(String(64), default="aluminum")
    # Full GenerateResponse JSON payload from designer/compiler
    design_payload: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    owner: Mapped["User"] = relationship("User", back_populates="projects")
    versions: Mapped[list["Version"]] = relationship("Version", back_populates="project", cascade="all, delete-orphan")
    qclang_files: Mapped[list["QCLangFile"]] = relationship("QCLangFile", back_populates="project", cascade="all, delete-orphan")
    layouts: Mapped[list["Layout"]] = relationship("Layout", back_populates="project", cascade="all, delete-orphan")
    simulations: Mapped[list["Simulation"]] = relationship("Simulation", back_populates="project", cascade="all, delete-orphan")
    verification_reports: Mapped[list["VerificationReport"]] = relationship("VerificationReport", back_populates="project", cascade="all, delete-orphan")
    tapeout_packages: Mapped[list["TapeoutPackage"]] = relationship("TapeoutPackage", back_populates="project", cascade="all, delete-orphan")


# ── Version ──────────────────────────────────────────────────────────────────

class Version(Base):
    __tablename__ = "versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    tag: Mapped[str] = mapped_column(String(64))
    message: Mapped[str] = mapped_column(Text, default="")
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)  # full design payload
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    project: Mapped["Project"] = relationship("Project", back_populates="versions")


# ── QCLang file ──────────────────────────────────────────────────────────────

class QCLangFile(Base):
    __tablename__ = "qclang_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(120), default="project.qc")
    content: Mapped[str] = mapped_column(Text, default="")
    ast_json: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    is_valid: Mapped[bool] = mapped_column(Boolean, default=False)
    errors: Mapped[Optional[list[Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    project: Mapped["Project"] = relationship("Project", back_populates="qclang_files")


# ── Layout ───────────────────────────────────────────────────────────────────

class Layout(Base):
    __tablename__ = "layouts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    version_tag: Mapped[str] = mapped_column(String(64), default="latest")
    placement_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    gds_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    qiskit_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    project: Mapped["Project"] = relationship("Project", back_populates="layouts")


# ── Simulation ───────────────────────────────────────────────────────────────

class Simulation(Base):
    __tablename__ = "simulations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    solver: Mapped[str] = mapped_column(String(64), default="eigenmode")  # eigenmode | driven_modal | transient
    status: Mapped[SimulationStatus] = mapped_column(Enum(SimulationStatus), default=SimulationStatus.queued)
    config: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    results: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    runtime_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    memory_gb: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    project: Mapped["Project"] = relationship("Project", back_populates="simulations")


# ── Verification Report ──────────────────────────────────────────────────────

class VerificationReport(Base):
    __tablename__ = "verification_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    status: Mapped[VerificationStatus] = mapped_column(Enum(VerificationStatus), default=VerificationStatus.pending)
    drc_passed: Mapped[bool] = mapped_column(Boolean, default=False)
    violations: Mapped[list] = mapped_column(JSON, default=list)
    frequency_collisions: Mapped[list] = mapped_column(JSON, default=list)
    crosstalk_warnings: Mapped[list] = mapped_column(JSON, default=list)
    summary: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    project: Mapped["Project"] = relationship("Project", back_populates="verification_reports")


# ── Tapeout Package ───────────────────────────────────────────────────────────

class TapeoutPackage(Base):
    __tablename__ = "tapeout_packages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    version_tag: Mapped[str] = mapped_column(String(64))
    gds_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    manifest: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    fab_notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    project: Mapped["Project"] = relationship("Project", back_populates="tapeout_packages")


# ── Chat History ──────────────────────────────────────────────────────────────

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    session_id: Mapped[str] = mapped_column(String(64), index=True)
    role: Mapped[str] = mapped_column(String(16))  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text)
    context_type: Mapped[str] = mapped_column(String(64), default="designer")  # designer | canvas | layout | verification
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    user: Mapped["User"] = relationship("User", back_populates="chat_history")
