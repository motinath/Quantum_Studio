"""
SILICOFELLER Quantum Studio — FastAPI Backend
=============================================

Startup order:
  1. Create DB tables (dev) or run Alembic migrations (prod)
  2. Mount all routers
  3. Add CORS middleware

Run:
  uvicorn app.main:app --reload --port 5000
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from app.config import settings
from app.database import init_db
from app.middleware.auth_state import auth_state_middleware
from app.middleware.rate_limit import limiter
from app.routers import admin, auth, claude, generate, materials, projects, qclang, simulations, tapeout, verification
from app.routers import design  # V2 design pipeline

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")


# ── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    log.info("Starting Quantum Studio backend …")

    # Initialise database tables (dev; use Alembic in prod)
    try:
        await init_db()
        log.info("Database ready.")
    except Exception as e:
        log.warning(f"Database init skipped (will run without persistence): {e}")

    yield
    log.info("Shutting down Quantum Studio backend.")


# ── App ───────────────────────────────────────────────────────────────────────

# ── Sentry ────────────────────────────────────────────────────────────────────

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=0.2 if settings.is_production else 1.0,
        profiles_sample_rate=0.1 if settings.is_production else 1.0,
    )


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="SILICOFELLER Quantum Studio API",
    description=(
        "AI-augmented quantum hardware EDA platform — V2. "
        "DesignGraph → Constraints → Placement → Routing → DRC → Qiskit Metal → Tapeout."
    ),
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)
app.state.limiter = limiter


# ── Prometheus metrics ──────────────────────────────────────────────────────

from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


# ── CORS ──────────────────────────────────────────────────────────────────────

# In development, allow ANY origin so preflight OPTIONS never returns 400.
# In production, lock down to the explicit allow-list from settings.
_cors_origins: list[str] = ["*"] if not settings.is_production else settings.cors_origins_list

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=settings.is_production,   # must be False when origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth state middleware (must run before rate limiting) ─────────────────────

@app.middleware("http")
async def auth_state(request: Request, call_next):
    return await auth_state_middleware(request, call_next)


# ── Request timing + structured logging + telemetry middleware ─────────────────

async def _log_usage(request: Request, response, elapsed_ms: float) -> None:
    """Fire-and-forget telemetry logging to the database."""
    try:
        from app.database import engine
        from app.models import ApiUsage
        from sqlalchemy.ext.asyncio import AsyncSession

        async with AsyncSession(engine) as session:
            usage = ApiUsage(
                user_id=getattr(request.state, "user_id", None),
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=elapsed_ms,
                user_agent=request.headers.get("User-Agent"),
                ip_address=request.client.host if request.client else None,
            )
            session.add(usage)
            await session.commit()
    except Exception:
        # Telemetry must never break the request
        pass


@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    import asyncio
    import uuid

    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:12])
    request.state.request_id = request_id
    t0 = time.perf_counter()
    response = await call_next(request)
    elapsed = round((time.perf_counter() - t0) * 1000, 2)
    response.headers["X-Process-Time-Ms"] = str(elapsed)
    response.headers["X-Request-ID"] = request_id
    log.info(
        "method=%s path=%s status=%s ms=%s request_id=%s",
        request.method,
        request.url.path,
        response.status_code,
        elapsed,
        request_id,
    )
    asyncio.create_task(_log_usage(request, response, elapsed))
    return response


# ── Global error handler ──────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.exception(f"Unhandled exception on {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please slow down."},
    )


# ── Routers ───────────────────────────────────────────────────────────────────

# Legacy / unversioned routes (backward compatibility)
app.include_router(generate.router)          # /health  /generate
app.include_router(generate.sub_router)      # /api/generate/...
app.include_router(auth.router)              # /api/auth/...
app.include_router(projects.router)          # /api/projects/...
app.include_router(qclang.router)            # /api/qclang/...
app.include_router(simulations.router)       # /api/simulations/...
app.include_router(verification.router)      # /api/verification/...
app.include_router(tapeout.router)           # /api/tapeout/...
app.include_router(materials.router)         # /api/materials/...
app.include_router(claude.router)            # /api/claude/...
app.include_router(design.router)            # /api/design/... (V2 pipeline)
app.include_router(admin.router)             # /api/admin/...

# API v1 versioned aliases (recommended for new clients)
app.include_router(auth.router,       prefix="/api/v1")
app.include_router(projects.router,   prefix="/api/v1")
app.include_router(qclang.router,    prefix="/api/v1")
app.include_router(simulations.router, prefix="/api/v1")
app.include_router(verification.router, prefix="/api/v1")
app.include_router(tapeout.router,   prefix="/api/v1")
app.include_router(materials.router, prefix="/api/v1")
app.include_router(claude.router,    prefix="/api/v1")
app.include_router(admin.router,     prefix="/api/v1")


# ── Frequency plan (legacy frontend compat) ───────────────────────────────────

from fastapi import APIRouter
from pydantic import BaseModel

legacy = APIRouter(tags=["legacy"])


class FreqPlanRequest(BaseModel):
    num_qubits: int
    substrate: str = "silicon"
    metal: str = "aluminum"
    target_freq_ghz: float = 5.0


@legacy.post("/frequency-plan")
async def frequency_plan(body: FreqPlanRequest):
    from app.qclang.ast_nodes import QubitNode, ChipNode
    from app.qclang.compiler import compute_frequency_plan
    # Use 1-indexed names matching the rest of the pipeline
    qubits = [QubitNode(name=f"Q{i+1}", qubit_type="transmon") for i in range(body.num_qubits)]
    chip = ChipNode(name="Temp", qubits=qubits)
    return compute_frequency_plan(chip, body.target_freq_ghz, body.substrate, body.metal)


@legacy.post("/drc")
async def drc(body: dict):
    from app.services.verification import run_verification
    return run_verification(body)


@legacy.post("/netlist")
async def netlist(body: dict):
    from app.services.chip_generator import generate_chip
    prompt = f"{body.get('num_qubits', 5)} qubit {body.get('topology', 'grid')} chip"
    result = await generate_chip(prompt)
    return {"netlist": result.get("code", ""), "num_qubits": result.get("num_qubits")}


@legacy.post("/placement")
async def placement(body: dict):
    from app.qclang.ast_nodes import QubitNode, ChipNode
    from app.qclang.compiler import compute_placement
    n = body.get("num_qubits", 5)
    # Use 1-indexed names matching the rest of the pipeline
    qubits = [QubitNode(name=f"Q{i+1}", qubit_type="transmon") for i in range(n)]
    chip = ChipNode(name="Temp", qubits=qubits)
    return compute_placement(chip)


app.include_router(legacy)
