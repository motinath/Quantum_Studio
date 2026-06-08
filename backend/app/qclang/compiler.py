"""
QCLang Compiler — transforms a validated AST into:
  1. Physical placement (qubit x/y coordinates) via NetworkX layout algorithms
  2. Frequency plan (qubit/resonator frequencies, EJ/EC, detunings)
  3. Qiskit Metal Python code
  4. GenerateResponse payload compatible with the frontend

This is the heart of the pipeline:
  QCLang (.qc) → AST → Compiler → GenerateResponse JSON
"""

from __future__ import annotations

import math
from typing import Any

import networkx as nx

from app.qclang.ast_nodes import ChipNode, Program

# ── Single source of truth for material parameters ────────────────────────────
from app.services.materials import MATERIALS, get_material


# ── Frequency planning ────────────────────────────────────────────────────────

def _compute_ec_from_geometry(pad_gap_um: float = 30.0) -> float:
    """Approximate EC (charging energy) in GHz from pad gap."""
    # Empirical fit: EC ≈ 0.3 GHz for 30 µm gap
    return 0.28 * (30.0 / pad_gap_um) ** 0.15


def _compute_ej_from_frequency(freq_ghz: float, ec_ghz: float) -> float:
    """Approximate EJ from target qubit frequency and EC using transmon formula:
    f_01 ≈ sqrt(8 * EJ * EC) - EC"""
    target = freq_ghz + ec_ghz
    return (target ** 2) / (8.0 * ec_ghz)


def _resonator_length_mm(freq_ghz: float, epsilon_eff: float) -> float:
    """Quarter-wave resonator length in mm."""
    c = 3e11  # mm/s speed of light
    return c / (4.0 * freq_ghz * 1e9 * math.sqrt(epsilon_eff)) * 1e3


def compute_frequency_plan(
    chip: ChipNode,
    target_freq_ghz: float = 5.0,
    substrate: str = "silicon",
    metal: str = "aluminum",
) -> dict[str, Any]:
    mat = get_material(substrate)
    epsilon_r = mat.get("epsilon_r", 11.45)

    # CPW effective dielectric constant (Schneider half-space approximation)
    cpw_w = mat.get("cpw_width_um", 10.0)
    cpw_g = mat.get("cpw_gap_um", 6.0)
    cpw_h = mat.get("substrate_thickness_um", 430.0)
    # Use the physics engine's accurate Schneider formula when available
    try:
        from app.services.physics.frequency_planner import cpw_effective_permittivity
        epsilon_eff = cpw_effective_permittivity(epsilon_r, cpw_w, cpw_g, cpw_h)
    except Exception:
        epsilon_eff = (epsilon_r + 1) / 2.0

    qubit_freqs: dict[str, float] = {}
    qubit_groups: dict[str, int] = {}
    ej: dict[str, float] = {}
    ec: dict[str, float] = {}
    res_freqs: dict[str, float] = {}
    res_lengths: dict[str, float] = {}
    detunings: dict[str, float] = {}
    warnings: list[str] = []

    num_q = len(chip.qubits)

    for i, q in enumerate(chip.qubits):
        # Alternate two frequency groups to avoid collisions (like IBM heavy-hex)
        group = i % 2
        qubit_groups[q.name] = group

        base = q.get("frequency", target_freq_ghz)
        if isinstance(base, (int, float)):
            base = float(base)
        else:
            base = target_freq_ghz

        # Stagger: group-0 slightly below target, group-1 slightly above
        stagger = (-1 if group == 0 else +1) * 0.1
        noise = (i * 0.013) % 0.06  # deterministic spread
        freq = base + stagger + noise
        qubit_freqs[q.name] = round(freq, 4)

        ec_val = _compute_ec_from_geometry()
        ej_val = _compute_ej_from_frequency(freq, ec_val)
        ec[q.name] = round(ec_val, 5)
        ej[q.name] = round(ej_val, 3)

    # Check frequency collisions (< 50 MHz separation)
    sorted_freqs = sorted(qubit_freqs.items(), key=lambda x: x[1])
    for (n1, f1), (n2, f2) in zip(sorted_freqs, sorted_freqs[1:]):
        if abs(f1 - f2) < 0.05:
            warnings.append(
                f"Frequency collision risk: {n1} ({f1:.3f} GHz) and {n2} ({f2:.3f} GHz) "
                f"are only {abs(f1-f2)*1000:.0f} MHz apart"
            )

    # Readout resonators
    for i, q in enumerate(chip.qubits):
        res_name = f"RO_{q.name}"
        # Readout resonator detuned ~1.5 GHz above qubit
        detuning = 1.5 + (i * 0.02) % 0.15
        rf = qubit_freqs[q.name] + detuning
        res_freqs[res_name] = round(rf, 4)
        res_lengths[res_name] = round(_resonator_length_mm(rf, epsilon_eff), 4)
        detunings[res_name] = round(detuning, 4)

    return {
        "epsilon_eff": round(epsilon_eff, 4),
        "qubit_frequencies_GHz": qubit_freqs,
        "qubit_groups": qubit_groups,
        "EJ_GHz": ej,
        "EC_GHz": ec,
        "resonator_frequencies_GHz": res_freqs,
        "resonator_lengths_mm": res_lengths,
        "detunings_GHz": detunings,
        "warnings": warnings,
        "substrate": substrate,
        "metal": metal,
    }


# ── Physical placement ────────────────────────────────────────────────────────

def compute_placement(chip: ChipNode, topology_hint: str = "auto") -> dict[str, Any]:
    """Use NetworkX graph layout to derive mm-scale qubit coordinates."""
    G = nx.Graph()

    for q in chip.qubits:
        G.add_node(q.name)

    for c in chip.couplers:
        G.add_edge(c.qubit_a, c.qubit_b)

    n = len(chip.qubits)
    if n == 0:
        return {"solver": "none", "qubits": []}

    # Choose layout algorithm
    if topology_hint in ("chain", "linear"):
        pos = {q.name: (i * 2.0, 0.0) for i, q in enumerate(chip.qubits)}
        solver = "linear"
    elif topology_hint == "ring":
        pos = {}
        for i, q in enumerate(chip.qubits):
            angle = 2 * math.pi * i / n
            pos[q.name] = (math.cos(angle) * 3.0, math.sin(angle) * 3.0)
        solver = "ring"
    elif G.number_of_edges() > 0:
        try:
            raw = nx.kamada_kawai_layout(G, scale=4.0)
            pos = raw
            solver = "kamada-kawai"
        except Exception:
            raw = nx.spring_layout(G, seed=42, k=2.0, scale=4.0)
            pos = raw
            solver = "spring"
    else:
        # No edges — grid layout
        cols = max(1, math.ceil(math.sqrt(n)))
        pos = {}
        for i, q in enumerate(chip.qubits):
            r, c = divmod(i, cols)
            pos[q.name] = (c * 2.0, -r * 2.0)
        solver = "grid"

    qubits = [
        {"name": name, "x": round(float(xy[0]), 4), "y": round(float(xy[1]), 4)}
        for name, xy in pos.items()
    ]
    # Build placement edges from the chip's coupler list so the frontend
    # canvas can draw coupling meanders without falling back to proximity.
    edges = [
        {
            "qubit_a": c.qubit_a,
            "pin_a": "a",
            "qubit_b": c.qubit_b,
            "pin_b": "b",
            "label": c.name,
        }
        for c in chip.couplers
    ]
    return {"solver": solver, "qubits": qubits, "edges": edges}


# ── DRC ───────────────────────────────────────────────────────────────────────

def run_drc(
    chip: ChipNode,
    placement: dict[str, Any],
    chip_size_mm: float = 10.0,
    min_spacing_mm: float = 0.4,
) -> dict[str, Any]:
    violations = []
    qubit_positions = {q["name"]: (q["x"], q["y"]) for q in placement.get("qubits", [])}

    names = list(qubit_positions.keys())
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            n1, n2 = names[i], names[j]
            x1, y1 = qubit_positions[n1]
            x2, y2 = qubit_positions[n2]
            dist = math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)
            if dist < min_spacing_mm:
                violations.append({
                    "severity": "error",
                    "rule": "MIN_SPACING",
                    "message": f"{n1} and {n2} are {dist:.3f}mm apart (min {min_spacing_mm}mm)",
                })

    half = chip_size_mm / 2
    for name, (x, y) in qubit_positions.items():
        if abs(x) > half or abs(y) > half:
            violations.append({
                "severity": "warning",
                "rule": "OFF_CHIP",
                "message": f"{name} at ({x:.2f}, {y:.2f}) is outside the {chip_size_mm}mm chip",
            })

    return {
        "passed": not any(v["severity"] == "error" for v in violations),
        "violations": violations,
    }


# ── Qiskit Metal code generation ─────────────────────────────────────────────

def generate_qiskit_code(chip: ChipNode, placement: dict[str, Any], material: str = "aluminum") -> str:
    lines = [
        "# ── SILICOFELLER Quantum Studio — QCLang-compiled Qiskit Metal script ──",
        f"# Chip: {chip.name}",
        f"# Qubits: {chip.num_qubits}",
        "",
        "from qiskit_metal import designs",
        "from qiskit_metal.qlibrary.qubits.transmon_pocket import TransmonPocket",
        "from qiskit_metal.qlibrary.qubits.transmon_cross import TransmonCross",
        "from qiskit_metal.qlibrary.tlines.meandered import RouteMeander",
        "from qiskit_metal.qlibrary.terminations.open_to_ground import OpenToGround",
        "",
        "design = designs.DesignPlanar()",
        "design.overwrite_enabled = True",
        f"design.chips.main.size['size_x'] = '10mm'",
        f"design.chips.main.size['size_y'] = '10mm'",
        "",
    ]

    qubit_pos = {q["name"]: q for q in placement.get("qubits", [])}

    for q in chip.qubits:
        pos = qubit_pos.get(q.name, {"x": 0.0, "y": 0.0})
        cls = "TransmonCross" if q.qubit_type in ("xmon", "gmon") else "TransmonPocket"
        var_name = f"q_{q.name.lower()}"
        lines.append(f"{var_name} = {cls}(design, '{q.name}', options=dict(")
        lines.append(f"    pos_x='{pos['x']:.3f}mm',")
        lines.append(f"    pos_y='{pos['y']:.3f}mm',")
        lines.append(f"    orientation='0',")
        lines.append( "    pad_width='455um',")
        lines.append( "    pad_height='90um',")
        lines.append( "    pad_gap='30um',")
        lines.append( "    pocket_width='650um',")
        lines.append( "    pocket_height='650um',")
        lines.append("))")
        lines.append("")

    for c in chip.couplers:
        var_name = f"route_{c.qubit_a.lower()}_{c.qubit_b.lower()}"
        lines.append(f"{var_name} = RouteMeander(design, 'CPW_{c.qubit_a}_{c.qubit_b}', options=dict(")
        lines.append(f"    pin_inputs=dict(")
        lines.append(f"        start_pin=dict(component='{c.qubit_a}', pin='readout'),")
        lines.append(f"        end_pin=dict(component='{c.qubit_b}', pin='readout'),")
        lines.append(f"    ),")
        lines.append( "    fillet='90um',")
        lines.append( "    total_length='7.8mm',")
        lines.append( "    lead=dict(start_straight='100um', end_straight='100um'),")
        lines.append( "    meander=dict(asymmetry='0um'),")
        lines.append("))")
        lines.append("")

    lines.extend([
        "design.rebuild()",
        "print(f'Chip {chip.name!r} compiled — {chip.num_qubits} qubits, {len(chip.couplers)} couplers')",
    ])
    return "\n".join(lines)


# ── Main compile entry point ──────────────────────────────────────────────────

def compile_program(
    program: Program,
    target_freq_ghz: float = 5.0,
    substrate: str = "silicon",
    metal: str = "aluminum",
    chip_size_mm: float = 10.0,
) -> dict[str, Any]:
    """
    Compile a parsed QCLang Program into a GenerateResponse-compatible dict.
    """
    chip = program.primary_chip
    if chip is None:
        return {"error": "No chip defined in program"}

    # Derive topology from coupler graph structure
    topology = _detect_topology(chip)

    freq_plan = compute_frequency_plan(chip, target_freq_ghz, substrate, metal)
    placement = compute_placement(chip, topology)
    drc = run_drc(chip, placement, chip_size_mm)
    code = generate_qiskit_code(chip, placement, metal)

    return {
        "label": f"{chip.name} · {chip.num_qubits}Q",
        "num_qubits": chip.num_qubits,
        "topology": topology,
        "engine": "qclang-compiler",
        "interpretation": (
            f"QCLang-compiled {chip.num_qubits}-qubit {chip.name} chip on {substrate}/{metal}. "
            f"Frequencies: {target_freq_ghz:.2f} GHz target. "
            f"DRC: {'PASS' if drc['passed'] else 'FAIL'}."
        ),
        "drc": drc,
        "frequency_plan": freq_plan,
        "placement": placement,
        "code": code,
        "qclang_source": None,  # filled by caller if needed
        "material": {"substrate": substrate, "metal": metal},
    }


def _detect_topology(chip: ChipNode) -> str:
    if not chip.couplers:
        return "isolated"

    n = chip.num_qubits
    edges = [(c.qubit_a, c.qubit_b) for c in chip.couplers]
    G = nx.Graph()
    G.add_nodes_from([q.name for q in chip.qubits])
    G.add_edges_from(edges)

    avg_deg = sum(dict(G.degree()).values()) / max(n, 1)

    if avg_deg <= 1.1:
        return "chain"
    elif avg_deg <= 2.1:
        # check if ring
        if all(d == 2 for _, d in G.degree()) and nx.is_connected(G):
            return "ring"
        return "chain"
    elif avg_deg <= 2.5:
        return "heavy-hex"
    elif avg_deg <= 4.1:
        return "grid"
    else:
        return "all-to-all"
