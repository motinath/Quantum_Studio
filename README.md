# Silicofeller Quantum Studio — V2

**Professional EDA Platform for Superconducting Quantum Chip Design**

Quantum Studio V2 is a constraint-driven electronic design automation (EDA) tool that mirrors the professional quantum hardware workflow:

```
Architecture Design → Chip Topology → Physical Layout → Routing
    → Frequency Planning → DRC → EM Simulation → Fabrication Review → Tapeout
```

---

## V2 Architecture

```
User Input (Prompt / Schematic Editor / Constraints JSON)
         │
         ▼
DesignConstraints          ← chip_size, topology, substrate, metal,
         │                    frequency band, fabrication rules
         ▼
build_graph_from_constraints()
         │
         ▼
DesignGraph                ← typed nodes: QubitNode, CouplerNode,
         │                    ResonatorNode, FeedlineNode, LaunchpadNode
         ▼
GraphValidator.validate()  ← structural checks before any physics
         │
         ▼
FrequencyPlanner.plan()    ← Schneider CPW ε_eff, IBM A/B coloring,
         │                    EJ/EC (Koch transmon), dispersive detuning
         ▼
place_qubits()             ← Kamada-Kawai graph layout → mm coordinates
         │
         ▼
route_design()             ← CPWRouter + ResonatorRouter + FeedlineRouter
         │
         ▼
run_full_drc()             ← 4-domain DRC (geometry, frequency,
         │                    fabrication, connectivity)
         ▼
generate_qiskit_code()     ← Qiskit Metal Python (TransmonPocket,
         │                    RouteMeander, LaunchpadWirebond)
         ▼
ExportEngine.export_all()  ← JSON, QCLang (.qc), GDS-II ASCII,
                              SVG, DXF, PDF report
```

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.10+ |
| Node.js | 18+ (or Bun 1.0+) |

### Backend

```bash
cd backend
py setup.py            # Windows — creates .venv + installs all deps
python3 setup.py       # macOS/Linux
cp .env.example .env   # then fill in SECRET_KEY and OAuth credentials (see below)
.venv\Scripts\python run.py     # Windows
.venv/bin/python run.py         # macOS/Linux
```

API: `http://localhost:5000` · Swagger: `http://localhost:5000/docs`

### Frontend

```bash
cd frontend
npm install            # or: bun install
npm run dev            # or: bun run dev
```

App: `http://localhost:8080`

### Docker (Production)

```bash
export SECRET_KEY=your-secret-minimum-32-chars
docker-compose up --build
```

---

## Backend Structure (V2)

```
backend/app/
├── core/
│   └── design_graph/         ← V2 FOUNDATION — typed design graph
│       ├── node.py            — QubitNode, CouplerNode, ResonatorNode,
│       │                        FeedlineNode, LaunchpadNode
│       ├── edge.py            — DesignEdge, EdgeKind
│       ├── graph.py           — DesignGraph (single source of truth)
│       ├── validator.py       — Structural graph validation
│       └── serializer.py      — graph ↔ JSON (API / DB / frontend)
│
├── constraints/               ← CONSTRAINT-DRIVEN DESIGN
│   ├── constraints.py         — DesignConstraints, FabConstraints, FreqConstraints
│   └── builder.py             — build_graph_from_constraints()
│
├── drc/                       ← ADVANCED 4-DOMAIN DRC ENGINE
│   ├── geometry_drc.py        — overlap, spacing, off-chip, resonator collision
│   ├── frequency_drc.py       — qubit/readout collision, dispersive, Purcell risk
│   ├── fabrication_drc.py     — CPW dims, bend radius, process compatibility
│   ├── connectivity_drc.py    — disconnected qubits, missing resonators, broken feedlines
│   ├── report.py              — DRCViolation, DRCReport
│   └── runner.py              — run_full_drc(), run_drc_from_payload()
│
├── routing/                   ← AUTO-ROUTING ENGINE
│   ├── cpw_router.py          — L-shaped CPW meander between coupled qubits
│   ├── resonator_router.py    — λ/4 meander paths with direction optimisation
│   ├── feedline_router.py     — horizontal feedline + resonator tap stubs
│   ├── pipeline.py            — route_design() orchestrator
│   └── result.py              — RouteResult, RouteSegment
│
├── exports/                   ← MULTI-FORMAT EXPORT
│   ├── formats.py             — JSON, QCLang, GDS-II ASCII, SVG, DXF, PDF
│   └── engine.py              — ExportEngine (export_all / export)
│
├── services/
│   ├── design_pipeline.py     ← V2 MAIN ORCHESTRATOR
│   │                            run_design_pipeline(constraints)
│   │                            run_design_from_prompt(prompt)
│   │                            run_design_from_graph_json(graph_json)
│   ├── materials.py           — Single source of truth for all material params
│   ├── chip_generator.py      — V1 prompt→generator (still works as fallback)
│   ├── verification.py        — V2 verification (uses drc/ engine)
│   ├── tapeout.py             — V2 tapeout (uses exports/ engine)
│   └── physics/
│       ├── frequency_planner.py  — IBM-style frequency planning
│       ├── topology_router.py    — Kamada-Kawai placement
│       ├── drc.py                — V1 DRC (used by legacy endpoints)
│       └── ml_intent.py          — PyTorch intent classifier + regex fallback
│
├── routers/
│   ├── design.py              ← V2 API ENDPOINTS (/api/design/*)
│   ├── generate.py            — /health, /generate, /api/generate/* (V1 compat)
│   ├── projects.py            — /api/projects/*
│   ├── qclang.py              — /api/qclang/*
│   ├── verification.py        — /api/verification/*
│   ├── simulations.py         — /api/simulations/*
│   ├── tapeout.py             — /api/tapeout/*
│   ├── materials.py           — /api/materials
│   ├── claude.py              — /api/claude/chat
│   └── auth.py                — /api/auth/*
│
└── qclang/                    ← QCLANG COMPILER
    ├── lexer.py               — Single-pass tokeniser
    ├── parser.py              — Recursive-descent → AST
    ├── validator.py           — Semantic checks
    ├── compiler.py            — AST → placement + freq + Qiskit Metal code
    └── full/                  — Full .qcl dialect (braces, arrays, SPICE/JSON-IR)
```

---

## V2 API Endpoints

### Design Pipeline (V2)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/design/generate` | **Full V2 pipeline** — constraints → graph → freq plan → placement → routing → DRC → code → exports |
| `POST` | `/api/design/generate-from-graph` | Run V2 pipeline from schematic editor graph JSON |
| `POST` | `/api/design/validate` | Structural graph validation (fast, no physics) |
| `POST` | `/api/design/route` | Auto-routing from placement dict |
| `POST` | `/api/design/drc` | Advanced 4-domain DRC |
| `POST` | `/api/design/export` | Single-format export (json/qclang/gds/svg/dxf/pdf) |
| `POST` | `/api/design/export-all` | All formats at once |
| `POST` | `/api/design/frequency-plan` | Constraint-driven frequency planning |
| `GET`  | `/api/design/topologies` | Supported topologies with metadata |

### Legacy (V1 — still works)

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | System health |
| `POST` | `/generate` | Prompt → chip (now routes through V2 pipeline) |
| `POST` | `/api/generate/frequency-plan` | Standalone frequency plan |
| `POST` | `/api/generate/placement` | Standalone KK placement |
| `POST` | `/api/generate/drc` | V1 DRC (7 rules) |
| `POST` | `/api/generate/netlist` | Connectivity netlist |
| `POST` | `/api/generate/metal-code` | Qiskit Metal from editor JSON |
| `POST` | `/api/qclang/parse` | Parse QCLang → AST |
| `POST` | `/api/qclang/compile` | Compile QCLang → GenerateResponse |
| `POST` | `/api/verification/check` | Stateless verification |
| `POST` | `/api/tapeout/generate` | Generate tapeout package |

Full docs: `http://localhost:5000/docs`

---

## V2 Design Graph

The `DesignGraph` is the single source of truth. Every subsystem reads from it.

```python
from app.core.design_graph import (
    DesignGraph, DesignEdge, EdgeKind,
    QubitNode, CouplerNode, ResonatorNode, FeedlineNode, LaunchpadNode,
)

g = DesignGraph(chip_name="MyChip", topology="heavy_hex",
                substrate="silicon", metal="aluminum")

q1 = QubitNode(id="Q1", frequency_ghz=4.9, group="A")
q2 = QubitNode(id="Q2", frequency_ghz=5.1, group="B")
c1 = CouplerNode(id="C1", qubit_a_id="Q1", qubit_b_id="Q2", strength_mhz=10.0)
r1 = ResonatorNode(id="RO_Q1", target_qubit_id="Q1", frequency_ghz=6.4)

for node in [q1, q2, c1, r1]:
    g.add_node(node)

g.add_edge(DesignEdge("Q1", "C1", EdgeKind.COUPLING))
g.add_edge(DesignEdge("C1", "Q2", EdgeKind.COUPLING))
g.add_edge(DesignEdge("Q1", "RO_Q1", EdgeKind.READOUT))

print(g.stats())
```

---

## Constraint-Driven Design

```python
from app.constraints import DesignConstraints, build_graph_from_constraints

c = DesignConstraints(
    qubit_count    = 20,
    chip_size_mm   = 10.0,
    topology       = "heavy_hex",
    substrate      = "silicon",
    metal          = "aluminum",
    target_freq_ghz = 5.0,
)
# fab and freq constraints have sensible IBM defaults
# override: c.fab.min_cpw_gap_um = 5.0
# override: c.freq.qubit_freq_min_ghz = 4.6

graph = build_graph_from_constraints(c)
# → 20 qubits, couplers, resonators, feedline, launchpads
```

---

## V2 DRC (4 Domains)

```python
from app.drc import run_full_drc

report = run_full_drc(graph, constraints)
print(f"Passed: {report.passed}")
print(f"Errors: {len(report.errors)}")
for v in report.violations:
    print(f"  [{v.severity}] {v.domain}.{v.rule}: {v.message}")
```

| Domain | Checks |
|--------|--------|
| **geometry** | QUBIT_SPACING, QUBIT_OVERLAP, OFF_CHIP, RESONATOR_COLLISION |
| **frequency** | QUBIT_COLLISION, GLOBAL_QUBIT_COLLISION, READOUT_COLLISION, DISPERSIVE_LOW/HIGH, PURCELL_RISK, BAND_VIOLATION |
| **fabrication** | MIN_CPW_WIDTH, MIN_CPW_GAP, MIN_BEND_RADIUS, PROCESS_COMPAT |
| **connectivity** | DISCONNECTED_QUBIT, MISSING_RESONATOR, FLOATING_RESONATOR, BROKEN_FEEDLINE, MISSING_LAUNCHPAD |

---

## Auto-Routing

```python
from app.routing import route_design

# graph must have placed qubits (x_mm, y_mm set)
routes = route_design(graph, constraints)
print(f"Segments: {routes.routed_count}")
print(f"Total length: {routes.total_length_mm:.2f} mm")
# routes.coupler_routes   — CPW segments between coupled qubits
# routes.resonator_routes — λ/4 meander paths
# routes.feedline_routes  — horizontal feedline + tap stubs
```

---

## Export System

```python
from app.exports import ExportEngine

engine = ExportEngine(graph, freq_plan=fp, drc_report=drc, constraints=c.to_dict())
exports = engine.export_all(project_name="HeavyHex_20Q", version="v1.0")

# exports["json"]       — full design JSON
# exports["qclang"]     — .qc source file
# exports["gds"]        — GDS-II ASCII
# exports["svg"]        — SVG chip diagram
# exports["dxf"]        — AutoCAD DXF
# exports["pdf_report"] — Human-readable design report
```

---

## QCLang

```
chip HeavyHex7Q
  variable substrate = "silicon"
  variable metal = "niobium"

  qubit Q1 type=transmon frequency=4.9
  qubit Q2 type=transmon frequency=5.1
  qubit Q3 type=transmon frequency=4.92
  qubit Q4 type=transmon frequency=5.08
  qubit Q5 type=transmon frequency=4.95
  qubit Q6 type=transmon frequency=5.12
  qubit Q7 type=transmon frequency=4.88

  coupler C1 connect(Q1,Q2)
  coupler C2 connect(Q2,Q3)
  coupler C3 connect(Q3,Q4)
  coupler C4 connect(Q4,Q5)
  coupler C5 connect(Q5,Q6)
  coupler C6 connect(Q6,Q7)
  coupler C7 connect(Q1,Q4)
  coupler C8 connect(Q4,Q7)

  readout RO_Q1 connect(Q1)
  readout RO_Q2 connect(Q2)
  ...
end
```

Compile: `POST /api/qclang/compile` → returns GenerateResponse with Qiskit Metal code.

---

## Running Tests

```bash
cd backend

# V2 architecture tests (8 tests)
.venv\Scripts\python check_v2.py     # Windows
.venv/bin/python check_v2.py         # macOS/Linux

# V1 integration tests (7 tests)
.venv\Scripts\python smoke_test.py
```

---

## Supported Topologies

| Key | Label | IBM Name | Max Degree |
|-----|-------|----------|-----------|
| `grid` | Grid | Surface Code basis | 4 |
| `heavy_hex` | Heavy Hex | Falcon / Eagle / Heron | 3 |
| `line` | Linear Chain | Test chips | 2 |
| `ring` | Ring | Research | 2 |
| `star` | Star | Research | N-1 |
| `all-to-all` | All-to-All | Small research | N-1 |

## Supported Materials

**Substrates:** `silicon` (ε_r=11.45), `sapphire` (ε_r=9.3), `silicon_nitride` (ε_r=7.5)

**Metals:** `aluminum` (Tc=1.2 K), `niobium` (Tc=9.2 K), `tantalum` (Tc=4.5 K), `nbtin` (Tc=15 K)

---

## Demo Accounts

| Role | Email |
|------|-------|
| Admin | `admin@silicofeller.com` |
| Org Manager | `manager@quantumlabs.com` |
| Engineer | `engineer@quantumlabs.com` |

Any password works with the demo accounts when the backend is offline.

---

## Environment

Copy `.env.example` to `.env` and fill in the values below.

```env
# ── Required ──────────────────────────────────────────────────────────────────
DATABASE_URL=sqlite+aiosqlite:///./dev.db   # or Postgres URL in production
SECRET_KEY=your-secret-key-min-32-chars    # any random 32+ char string
APP_ENV=development
MAX_QUBITS=256
CORS_ORIGINS=http://localhost:8080,http://localhost:5173,http://localhost:3000

# ── Google OAuth (optional — enables "Continue with Google") ──────────────────
# Create at: https://console.cloud.google.com/apis/credentials
# Authorised JS origin: http://localhost:8080
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...

# ── GitHub OAuth (optional — enables "Continue with GitHub") ──────────────────
# Create at: https://github.com/settings/applications/new
#   Homepage URL:               http://localhost:8080
#   Authorization callback URL: http://localhost:5000/api/auth/github/callback
GITHUB_CLIENT_ID=Ov23li...
GITHUB_CLIENT_SECRET=...
FRONTEND_URL=http://localhost:8080   # where backend redirects after GitHub login

# ── AI Assistant (optional) ───────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── SMTP (optional — OTP emails; prints to terminal if not configured) ─────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=you@gmail.com
SMTP_PASSWORD=your-app-password
```

### Authentication Methods

| Method | What to configure |
|--------|-------------------|
| Email + OTP | Nothing — works out of the box (OTP printed to backend terminal) |
| Google OAuth | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` |
| GitHub OAuth | `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` + `FRONTEND_URL` |
