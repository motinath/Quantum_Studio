# Quantum Studio CAD

**AI-Augmented CAD Platform for Superconducting Quantum Chip Design**

Quantum Studio is a desktop-and-web computer-aided design (CAD) platform designed for layout, routing, verification, and simulation of IBM-grade superconducting transmon quantum processors.

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** (with `npm` or `bun` package managers)
- **Git**

### Backend Setup (FastAPI)
The backend is a FastAPI application that serves the physics engine, compiler, and API endpoints.

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Run the quick setup script to automatically create a virtual environment (`.venv`) and install dependencies:
   ```bash
   python setup.py
   ```
3. Start the backend developer server:
   ```bash
   .venv\Scripts\python run.py      # On Windows
   # OR
   .venv/bin/python run.py          # On macOS/Linux
   ```
   - **API Documentation (Swagger):** `http://localhost:5000/docs`
   - **Alternative deployment:** `docker-compose up` at the project root runs PG, Redis, backend, and frontend.

### Frontend Setup (React + TanStack Start)
The frontend is built using Vite, TailwindCSS (v4), TanStack React Router, and TanStack Start for SSR error resilience.

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install      # or: bun install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev      # or: bun dev
   ```
   - **Local URL:** `http://localhost:8080/`

---

## 📁 Repository Structure

The workspace has been refactored and cleaned to remove all obsolete prototype directories.

```
Quantum_Studio/
├── backend/                    # FastAPI Backend Application
│   ├── app/
│   │   ├── qclang/             # Unified QCLang compiler engine
│   │   │   ├── simple/         # Simple compiler (.qc syntax: chip...end)
│   │   │   └── full/           # Full compiler (.qcl syntax: chip {} braces, SPICE/IR)
│   │   ├── routers/            # API routing modules (Auth, Projects, QCLang, Generate)
│   │   ├── services/
│   │   │   ├── physics/        # Pure Python physics engine (staggering, DRC, placement)
│   │   │   ├── chip_generator.py # Primary AI generation & routing service
│   │   │   └── tapeout.py      # GDS export and layout compiler
│   │   ├── main.py             # Server entrypoint and router registration
│   │   └── models.py           # SQL Alchemy schemas (Project, Versions, QCLangFile)
│   ├── run.py                  # Server runner
│   ├── setup.py                # Automatic dependency installer
│   └── smoke_test.py           # Integration validation suite
├── frontend/                   # React + Vite Client Application
│   ├── src/
│   │   ├── routes/             # Client-side page routes
│   │   ├── components/         # Reusable UI widgets & canvas editors
│   │   └── lib/                # API wrappers and client state
│   └── package.json
└── docker-compose.yml          # Container configuration for production stack
```

---

## 🛠️ The 15-Step CAD Workflow

```
1  New Project     → Dashboard → Projects → Create with topology/qubits/freq/substrate/metal
2  Architecture    → Architecture Explorer → Visualise & compare 6 topologies (Heavy-Hex, Surface Code, etc.)
3  AI Design       → Designer → Chat prompt → Generates QCLang + layout + frequency plan
4  Schematic       → QCLang Editor (Schematic Editor) → Live parse, compile, templates (.qc/.qcl)
5  QCLang          → project.qc/project.qcl = Source of truth → Compile → Canvas + layout sync
6  Component Lib   → Browse all Qiskit Metal components with parameters + Python snippets
7  Canvas Editor   → Drag-drop, pin-connect, undo/redo, DRC, export .py/.gds/.json
8  Layout Viewer   → Canvas editor IS the layout viewer (physical mm-scale SVG canvas)
9  Simulations     → Eigenmode / Driven Modal / Physics / Transient solvers
10 Physics         → T₁/T₂, anharmonicity, EJ/EC, gate fidelity per qubit
11 Verification    → DRC + Frequency collision + Crosstalk + Yield check
12 Results         → Frequency tables, Hamiltonian params, coherence estimates, placement grid
13 Version Control → Git timeline: AI sessions + DB snapshots; diff, restore, download
14 Reports         → Generate Design/Verification/Simulation/Tapeout reports
15 Tapeout         → GDS layer map, fab spec, process compatibility
```

---

## 📐 Physics and Compilation Engine

The backend implements a multi-stage physics-informed layout compilation pipeline:

### 1. Natural Language Intent Resolution
- Pre-trained PyTorch bag-of-words model (`ml_intent.py`) parses design intent (e.g. "5-qubit heavy-hex on sapphire with niobium").
- Falls back gracefully to high-accuracy regular expressions if `torch` is not installed on the system.

### 2. Frequency Planning
- Staggers qubit operating frequencies in bipartite grids to avoid frequency collisions and minimize crosstalk.
- Calculates CPW effective permittivity ($\epsilon_{eff}$) using Schneider's conformal mapping equations for microstrip lines.
- Computes Josephson junction charging energy ($E_C$) and Josephson energy ($E_J$) using the Koch transmon model.

### 3. Physical Graph Placement
- Runs Kamada-Kawai force-directed layout algorithms via NetworkX to map logical qubits to physical coordinates.
- Adapts coordinate scaling dynamically for 6 pre-coded topologies: Heavy-Hex, Surface Code, Ring, Linear Chain, Star, and All-to-All.

### 4. 7-Rule DRC Checker
Verifies fabrication feasibility against a configurable design rule check (DRC) file:
1. **SPACING:** Min gap between CPW traces and ground plane.
2. **CPW:** Trace width constraints to hit target impedance (e.g. 50 $\Omega$).
3. **FREQUENCY:** Detuning checks to avoid frequency collision.
4. **RESONATOR:** Boundary clearance and resonator meander spacing.
5. **DISPERSIVE:** Insufficient qubit-resonator detuning.
6. **FEEDLINE:** Readout bus overlapping and feedline routing constraints.
7. **GEOMETRY.OVERLAP:** Intersection of physical boundaries.

---

## 📜 QCLang Dialect Specifications

Quantum Studio compiles two dialects of **Quantum Chip Language (QCL)**:

### 1. Simple Dialect (`.qc`)
A clean, Python-like declarative syntax for quick layouts.
```python
chip LinearChain2Q
  variable target_frequency = 5.0
  variable substrate = "sapphire"
  variable metal = "tantalum"

  qubit Q0 type=transmon frequency=4.9
  qubit Q1 type=transmon frequency=5.1

  coupler C0 connect(Q0, Q1)
  readout R0 connect(Q0)
  readout R1 connect(Q1)
end
```

### 2. Full Dialect (`.qcl`)
A robust C-style curly brace dialect with structural blocks, design rules, tiles, and stitch-able qubit arrays.
```c
chip HeavyHexGrid {
    version: "1.0"
    qubit_count: 7
    qubit_type: transmon
    frequency_band: [4.8GHz, 5.2GHz]
}

qubit q0 {
    type: transmon
    frequency: 5.0GHz
    pad_gap: 30um
    position: (0um, 0um)
}

design_rules {
    min_gap: 4um
    check_frequency_collision: true
    collision_threshold: 20MHz
}
```

---

## ⚡ Integration Tests
Verify system integrity using the included test suite. Runs all compiler variants, frequency staggered plans, placements, and mock layouts:
```bash
cd backend
.venv\Scripts\python smoke_test.py
```
