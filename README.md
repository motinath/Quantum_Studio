# Silicofeller Quantum Studio

**AI-Augmented EDA Platform for Superconducting Quantum Chip Design**

Quantum Studio is a full-stack electronic design automation (EDA) tool for designing, simulating, verifying, and taping out IBM-grade superconducting transmon quantum processors. It turns natural-language requirements into physics-accurate chip layouts, frequency plans, Qiskit Metal Python code, and GDS-II fabrication packages.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (React)                   │
│  TanStack Router · TanStack Query · Vite · Tailwind v4  │
│  http://localhost:8080                                   │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────┐
│                   Backend (FastAPI)                     │
│  Python 3.10+ · SQLAlchemy async · Pydantic v2          │
│  http://localhost:5000    /docs (Swagger UI)             │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │             Physics Engine (Pure Python)         │   │
│  │  ML Intent → Frequency Planner → KK Placement   │   │
│  │  → 7-Rule DRC → Qiskit Metal Codegen            │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │ SQLite (dev)                │ PostgreSQL (prod)
          │ ./backend/dev.db            │ via Docker Compose
          └─────────────────────────────┘
```

---

## Quick Start (Local Dev — No Docker Required)

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.10 or newer |
| Node.js | 18 or newer |
| npm | bundled with Node.js |

### 1 — Clone

```bash
git clone <repo-url>
cd Quantum_Studio-work
```

### 2 — Backend

```bash
cd backend

# Create venv + install all dependencies automatically
py setup.py            # Windows
python3 setup.py       # macOS / Linux

# Copy example env (SQLite is the default — no Postgres needed)
cp .env.example .env

# Start the API server (hot-reload enabled)
.venv\Scripts\python run.py     # Windows
.venv/bin/python run.py         # macOS / Linux
```

**API available at:** `http://localhost:5000`
**Swagger UI:** `http://localhost:5000/docs`
**ReDoc:** `http://localhost:5000/redoc`

### 3 — Frontend

```bash
cd frontend
npm install
npm run dev
```

**App available at:** `http://localhost:8080`

> The frontend works fully offline when the backend is unreachable. Every API call has a client-side fallback that simulates realistic quantum chip data.

---

## Docker (Production Stack)

Starts PostgreSQL, Redis, backend, and frontend in one command.

```bash
# Optional: set secrets
export SECRET_KEY=your-secret-key-minimum-32-chars
export ANTHROPIC_API_KEY=sk-ant-...   # optional — Claude AI assistant

docker-compose up --build
```

| Service | Port |
|---------|------|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

---

## Project Structure

```
Quantum_Studio-work/
├── backend/                         # FastAPI backend
│   ├── app/
│   │   ├── main.py                  # App entry, CORS, routers, lifespan
│   │   ├── config.py                # Pydantic settings from .env
│   │   ├── database.py              # SQLAlchemy async engine (SQLite/Postgres)
│   │   ├── models.py                # ORM: User, Project, Simulation, etc.
│   │   ├── auth.py                  # JWT + bcrypt authentication
│   │   ├── routers/
│   │   │   ├── auth.py              # POST /api/auth/register|token, GET /api/auth/me
│   │   │   ├── generate.py          # POST /generate, /api/generate/*
│   │   │   ├── projects.py          # CRUD /api/projects/*
│   │   │   ├── qclang.py            # POST /api/qclang/parse|compile|save|templates
│   │   │   ├── simulations.py       # /api/simulations/*
│   │   │   ├── verification.py      # /api/verification/*
│   │   │   ├── tapeout.py           # /api/tapeout/*
│   │   │   ├── materials.py         # GET /api/materials
│   │   │   ├── claude.py            # POST /api/claude/chat
│   │   │   └── reports.py           # /api/reports/*
│   │   ├── services/
│   │   │   ├── materials.py         # Single source of truth for all material params
│   │   │   ├── chip_generator.py    # Main AI generation orchestrator
│   │   │   ├── verification.py      # DRC + freq collision + crosstalk engine
│   │   │   ├── tapeout.py           # GDS-II ASCII + fab spec generator
│   │   │   ├── physics/
│   │   │   │   ├── frequency_planner.py  # Schneider CPW, A/B qubit coloring, EJ/EC
│   │   │   │   ├── topology_router.py    # Kamada-Kawai placement solver
│   │   │   │   ├── drc.py                # 7-rule DRC checker
│   │   │   │   └── ml_intent.py          # PyTorch BoW classifier + regex fallback
│   │   │   └── metal_codegen/
│   │   │       ├── metal_codegen.py      # Qiskit Metal Python script generator
│   │   │       ├── adapter.py            # Editor JSON → QuantumDesign IR
│   │   │       └── models/               # TransmonQubit, Resonator, Coupler, Chip IR
│   │   └── qclang/
│   │       ├── lexer.py             # Single-pass QCLang tokeniser
│   │       ├── parser.py            # Recursive-descent parser → AST
│   │       ├── validator.py         # Semantic validation (5 checks)
│   │       ├── compiler.py          # AST → placement + freq plan + Qiskit Metal code
│   │       └── full/                # Full .qcl dialect (braces, arrays, SPICE/JSON-IR)
│   ├── run.py                       # uvicorn launcher (hot-reload)
│   ├── setup.py                     # Auto venv + pip installer
│   ├── smoke_test.py                # Integration test suite
│   ├── requirements.txt
│   ├── .env                         # Local secrets (not committed)
│   ├── .env.example                 # Template
│   └── Dockerfile
├── frontend/                        # React frontend
│   ├── src/
│   │   ├── routes/
│   │   │   ├── __root.tsx           # Root shell: QueryClient + AuthProvider
│   │   │   ├── index.tsx            # Landing page
│   │   │   ├── _app.tsx             # Authenticated layout: sidebar + topbar
│   │   │   ├── _app/
│   │   │   │   ├── dashboard.tsx
│   │   │   │   ├── projects.tsx
│   │   │   │   ├── designer.tsx
│   │   │   │   ├── architecture-explorer.tsx
│   │   │   │   ├── schematic-editor.tsx   # Full EDA visual schematic editor
│   │   │   │   ├── quantum-editor.tsx     # Drag-drop component canvas
│   │   │   │   ├── layout-viewer.tsx
│   │   │   │   ├── component-library.tsx
│   │   │   │   ├── simulations.tsx
│   │   │   │   ├── physics-analysis.tsx
│   │   │   │   ├── verification.tsx
│   │   │   │   ├── results.tsx
│   │   │   │   ├── version-control.tsx
│   │   │   │   ├── reports.tsx
│   │   │   │   ├── team.tsx
│   │   │   │   ├── integrations.tsx
│   │   │   │   ├── settings.tsx
│   │   │   │   ├── billing.tsx
│   │   │   │   ├── profile.tsx
│   │   │   │   ├── admin.tsx
│   │   │   │   └── about.tsx
│   │   │   └── _auth/
│   │   │       ├── sign-in.tsx
│   │   │       └── sign-up.tsx
│   │   ├── components/
│   │   │   ├── app/
│   │   │   │   ├── app-sidebar.tsx       # Collapsible nav sidebar (5 groups)
│   │   │   │   └── claude-assistant.tsx  # Floating AI chat panel
│   │   │   ├── quantum-editor/           # Canvas editor components
│   │   │   └── ui/                       # shadcn/ui component library
│   │   └── lib/
│   │       ├── api/backend.ts            # All API calls + client-side fallbacks
│   │       ├── auth/auth-context.tsx     # Auth state (JWT + localStorage)
│   │       ├── design-context.tsx        # AI design conversation state
│   │       └── project-context.tsx       # Active project management
│   └── package.json
└── docker-compose.yml
```

---

## Feature Pages

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | Dashboard | KPI cards, project table, simulation donut, activity feed, notifications |
| `/projects` | Projects | Full CRUD for chip design projects — topology, substrate, metal, status |
| `/designer` | AI Designer | Chat-driven chip generation → Physical CAD / Spectrum / Qiskit Metal code |
| `/architecture-explorer` | Architecture Explorer | Compare topologies, resource estimates, connectivity graphs |
| `/schematic-editor` | Schematic Editor | **Full EDA-style visual editor** — drag qubits, draw couplers, inspect properties, compile to QCLang |
| `/quantum-editor` | Quantum Editor | Drag-drop component canvas — pins, connections, undo/redo, DRC |
| `/layout-viewer` | Layout Viewer | Physical mm-scale layout view of compiled designs |
| `/component-library` | Component Library | Browse all Qiskit Metal components with parameters and code snippets |
| `/simulations` | Simulations | Create and run Eigenmode / Driven Modal / Physics simulations |
| `/physics-analysis` | Physics Analysis | T₁, T₂, anharmonicity, EJ/EC, fidelity per qubit |
| `/verification` | Verification | DRC + frequency collision + crosstalk + yield estimate |
| `/results` | Results | Frequency tables, Hamiltonian params, coherence budget, placement grid |
| `/version-control` | Version Control | Design version timeline, diff, restore, download snapshots |
| `/reports` | Reports | Generate Design / Verification / Simulation / Tapeout reports |
| `/team` | Users & Teams | Invite/manage team members, role management |
| `/integrations` | Integrations | Backend, Qiskit Metal, AWS Palace, scqubits, Claude, GitHub, PostgreSQL |
| `/settings` | Settings | Workspace preferences, backend URL, API keys, security |

---

## API Reference

All endpoints are documented at `http://localhost:5000/docs` (Swagger UI).

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | System health, version, ML status, pipeline list |
| `POST` | `/generate` | **Main chip generation** — NL prompt → layout + freq plan + code |
| `POST` | `/api/generate/frequency-plan` | Standalone IBM-style frequency planning |
| `POST` | `/api/generate/placement` | Standalone Kamada-Kawai physical placement |
| `POST` | `/api/generate/drc` | Standalone 7-rule DRC check |
| `POST` | `/api/generate/netlist` | Chip connectivity netlist |
| `POST` | `/api/generate/metal-code` | Qiskit Metal Python from editor JSON |
| `POST` | `/api/qclang/parse` | Parse QCLang source → AST + errors |
| `POST` | `/api/qclang/compile` | Parse + compile → GenerateResponse |
| `GET` | `/api/qclang/templates` | Built-in QCLang templates |
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/token` | Login → JWT |
| `GET` | `/api/projects` | List user's projects |
| `POST` | `/api/projects` | Create project |
| `POST` | `/api/projects/{id}/save-design` | Save design payload to project |
| `POST` | `/api/verification/check` | Run full verification suite |
| `POST` | `/api/simulations` | Create simulation job |
| `POST` | `/api/simulations/{id}/run` | Run simulation (analytical physics engine) |
| `POST` | `/api/tapeout/generate` | Generate GDS-II + fab spec package |
| `GET` | `/api/materials` | Full material library (substrates + metals) |
| `POST` | `/api/claude/chat` | AI assistant (Claude API or rule-based fallback) |

---

## QCLang — Quantum Chip Language

The source of truth for every design. Two dialects are supported.

### Simple dialect `.qc`

```
chip LinearChain5Q
  variable target_frequency = 5.0
  variable substrate = "silicon"
  variable metal = "aluminum"

  qubit Q1 type=transmon frequency=4.9
  qubit Q2 type=transmon frequency=5.1
  qubit Q3 type=transmon frequency=4.92
  qubit Q4 type=transmon frequency=5.08
  qubit Q5 type=transmon frequency=4.95

  coupler C1 connect(Q1,Q2)
  coupler C2 connect(Q2,Q3)
  coupler C3 connect(Q3,Q4)
  coupler C4 connect(Q4,Q5)

  readout RO_Q1 connect(Q1)
  readout RO_Q2 connect(Q2)
  readout RO_Q3 connect(Q3)
  readout RO_Q4 connect(Q4)
  readout RO_Q5 connect(Q5)
end
```

### Full dialect `.qcl`

```
chip HeavyHex7Q {
    version: "1.0"
    qubit_count: 7
    qubit_type: transmon
    frequency_band: [4.8GHz, 5.2GHz]
}

qubit q1 { type: transmon  frequency: 4.9GHz  pad_gap: 30um  position: (0um, 0um) }
qubit q2 { type: transmon  frequency: 5.1GHz  pad_gap: 30um  position: (1100um, 0um) }

coupler c1 { connects: [q1, q2]  type: fixed  strength: 10MHz }
readout r1 { connects: q1  frequency: 6.4GHz }

design_rules {
    min_gap: 4um
    check_frequency_collision: true
    collision_threshold: 20MHz
}
```

---

## Physics Engine

### Supported Qubit Topologies

| Name | Keyword | IBM Architecture |
|------|---------|-----------------|
| Grid | `grid` | Surface Code basis |
| Heavy-Hex | `heavy_hex` | Falcon / Eagle / Heron |
| Linear Chain | `line` | Simple test chips |
| Ring | `ring` | Closed-loop designs |
| Star | `star` | Hub-and-spoke |
| All-to-All | `all-to-all` | Small research chips |

### Supported Materials

**Substrates**

| Key | ε_r | Loss Tangent | Use |
|-----|-----|-------------|-----|
| `silicon` | 11.45 | 1×10⁻⁶ | Standard CQED |
| `sapphire` | 9.3 | 3×10⁻⁸ | High coherence |
| `silicon_nitride` | 7.5 | 5×10⁻⁵ | KID / SNAIL |

**Metals**

| Key | Tc (K) | λ_L (nm) | Notes |
|-----|--------|----------|-------|
| `aluminum` | 1.2 | 16 | Standard CQED |
| `niobium` | 9.2 | 39 | High-Tc resonators |
| `tantalum` | 4.5 | 96 | State-of-the-art T₁ |
| `nbtin` | 15.0 | 200 | KID detectors |

### DRC Rules (7 checks)

| Rule | Type | Description |
|------|------|-------------|
| `SPACING.QUBIT` | Error | Centre-to-centre < 0.6 mm |
| `CPW.GAP` | Error | Gap < 4 µm fabrication limit |
| `CPW.WIDTH` | Error | Width < 5 µm fabrication limit |
| `FREQUENCY.QUBIT_COLLISION` | Error | Adjacent qubits < 100 MHz apart |
| `FREQUENCY.RESONATOR_COLLISION` | Error | Resonators < 50 MHz apart |
| `FREQUENCY.DISPERSIVE_DETUNING_LOW` | Error | │f_r − f_q│ < 1.0 GHz |
| `FREQUENCY.DISPERSIVE_DETUNING_HIGH` | Warning | │f_r − f_q│ > 3.0 GHz |
| `SPACING.FEEDLINE_CLEARANCE` | Warning | Feedline too close to qubit pocket |
| `GEOMETRY.OVERLAP` | Warning | Resonator route bounding box overlap (pre-check) |

---

## Demo Accounts

When the backend is offline, the following demo accounts work for local testing:

| Role | Email | Password |
|------|-------|---------|
| Admin | `admin@silicofeller.com` | any |
| Org Manager | `manager@quantumlabs.com` | any |
| Engineer | `engineer@quantumlabs.com` | any |

When the backend is running, create a real account via `/sign-up` or `POST /api/auth/register`.

---

## Running Tests

```bash
cd backend
.venv\Scripts\python smoke_test.py   # Windows
.venv/bin/python smoke_test.py       # macOS / Linux
```

All 7 integration tests cover:
1. FrequencyPlanner (Schneider CPW ε_eff, A/B bipartite coloring, EJ/EC)
2. TopologyRouter (Kamada-Kawai placement)
3. DRC checker (7 rules)
4. ML intent (PyTorch + regex fallback)
5. QCLang full compiler → JSON-IR target
6. QCLang full compiler → SPICE target
7. `generate_chip()` full pipeline end-to-end

---

## Development Notes

- **Max qubits:** 256 (configurable via `MAX_QUBITS` in `.env`)
- **Database:** SQLite by default in dev (`dev.db` created automatically). Switch to Postgres via `DATABASE_URL` in `.env`.
- **Hot reload:** Both frontend (`npm run dev`) and backend (`python run.py`) support hot reload.
- **CORS:** Dev origins `localhost:3000`, `localhost:5173`, `localhost:5174`, `localhost:8080` are pre-allowed.
- **Auth tokens:** JWT, 7-day expiry, stored in `localStorage` as `qs_token`.
- **Offline mode:** All API calls fall back gracefully — the designer, verification, and schematic editor work without a backend.
