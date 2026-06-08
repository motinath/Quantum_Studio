"""
Tapeout Engine — generates the final fabrication package.

Produces:
  - GDS-II ASCII layout (ASCII text; real binary GDSII via gdspy in production)
  - Fabrication specification sheet
  - Layer map
  - Process compatibility report
"""

from __future__ import annotations

from datetime import datetime
from typing import Any


LAYER_MAP = {
    "base_metal": 1,
    "josephson_junction": 2,
    "dielectric": 3,
    "via": 4,
    "top_metal": 5,
    "ground_plane": 6,
    "probe_pads": 7,
    "dicing_line": 8,
}


def generate_tapeout_package(
    payload: dict[str, Any],
    project_name: str = "QuantumChip",
    version: str = "v1.0",
    fab_notes: str = "",
) -> dict[str, Any]:
    """
    Generate a complete tapeout package from a compiled design payload.
    Returns manifest + GDS ASCII content + fab spec.
    """
    placement = payload.get("placement", {})
    fp = payload.get("frequency_plan", {})
    material = payload.get("material", {})
    substrate = material.get("substrate", fp.get("substrate", "silicon"))
    metal = material.get("metal", fp.get("metal", "aluminum"))
    num_qubits = payload.get("num_qubits", 0)
    topology = payload.get("topology", "custom")

    gds = _generate_gds_ascii(payload, project_name, version)
    fab_spec = _generate_fab_spec(substrate, metal, num_qubits, topology)
    process_check = _process_compatibility_check(substrate, metal)

    manifest = {
        "project": project_name,
        "version": version,
        "topology": topology,
        "num_qubits": num_qubits,
        "substrate": substrate,
        "metal": metal,
        "layer_map": LAYER_MAP,
        "files": [
            f"{project_name}_{version}.gds",
            f"{project_name}_{version}_fab_spec.pdf",
            f"{project_name}_{version}_layer_map.json",
            f"{project_name}_{version}_drc_report.txt",
        ],
        "generated_at": datetime.utcnow().isoformat(),
        "fab_notes": fab_notes,
        "process_check": process_check,
    }

    return {
        "manifest": manifest,
        "gds_content": gds,
        "fab_spec": fab_spec,
    }


def _generate_gds_ascii(
    payload: dict[str, Any],
    name: str,
    version: str,
) -> str:
    """Generate ASCII representation of GDS-II layout."""
    placement = payload.get("placement", {})
    qubits = placement.get("qubits", [])
    lines = [
        "HEADER 600",
        "BGNLIB",
        f"LIBNAME {name}_{version}.DB",
        "UNITS 0.001 1e-09",
        "",
        "BGNSTR",
        f"STRNAME {name}_TOP",
        "",
        "# ── Ground plane ──────────────────────────────────────────",
        "BOUNDARY",
        f"LAYER {LAYER_MAP['ground_plane']}",
        "DATATYPE 0",
        "XY 0 0 10000 0 10000 10000 0 10000 0 0",
        "ENDEL",
        "",
        "# ── Qubits (TransmonPocket patterns) ─────────────────────",
    ]

    for q in qubits:
        # Support both x/y (frontend-normalised) and x_mm/y_mm (raw placement)
        x = int(q.get("x", q.get("x_mm", 0)) * 1000)
        y = int(q.get("y", q.get("y_mm", 0)) * 1000)
        half = 200  # µm half-size → nm units (0.001 µm/unit)
        lines += [
            f"# Qubit {q.get('name','?')} @ ({q.get('x', q.get('x_mm', 0)):.3f}, {q.get('y', q.get('y_mm', 0)):.3f}) mm",
            "BOUNDARY",
            f"LAYER {LAYER_MAP['base_metal']}",
            "DATATYPE 0",
            f"XY {x-half} {y-half} {x+half} {y-half} {x+half} {y+half} {x-half} {y+half} {x-half} {y-half}",
            "ENDEL",
            "",
            "# Josephson Junction",
            "BOUNDARY",
            f"LAYER {LAYER_MAP['josephson_junction']}",
            "DATATYPE 0",
            f"XY {x-20} {y-20} {x+20} {y-20} {x+20} {y+20} {x-20} {y+20} {x-20} {y-20}",
            "ENDEL",
            "",
        ]

    lines += ["ENDSTR", "", "ENDLIB"]
    return "\n".join(lines)


def _generate_fab_spec(
    substrate: str,
    metal: str,
    num_qubits: int,
    topology: str,
) -> dict[str, Any]:
    """Generate fabrication specification."""
    specs = {
        "silicon": {
            "substrate_spec": "High-resistivity float-zone silicon, ρ > 10 kΩ·cm, <100> orientation",
            "thickness_um": 500,
            "cleaning": "RCA clean + HF dip before deposition",
        },
        "sapphire": {
            "substrate_spec": "C-plane sapphire, 2-inch wafer, EPI-polished",
            "thickness_um": 430,
            "cleaning": "Piranha + UV-ozone before deposition",
        },
        "silicon_nitride": {
            "substrate_spec": "LPCVD stoichiometric Si₃N₄ on silicon",
            "thickness_um": 200,
            "cleaning": "Standard solvent clean",
        },
    }.get(substrate, {})

    metal_spec = {
        "aluminum": {
            "deposition": "DC magnetron sputtering, 100 nm Al",
            "process_temp_C": 25,
            "junction_process": "Manhattan-junction double-angle evaporation",
        },
        "niobium": {
            "deposition": "DC magnetron sputtering, 150 nm Nb",
            "process_temp_C": 25,
            "junction_process": "Al Manhattan junction (Dolan bridge)",
        },
        "tantalum": {
            "deposition": "DC magnetron sputtering, 200 nm α-Ta (anneal at 450°C)",
            "process_temp_C": 450,
            "junction_process": "Al/Al2O3 Josephson junction",
        },
        "nbtin": {
            "deposition": "Reactive RF sputtering, 20 nm NbTiN",
            "process_temp_C": 25,
            "junction_process": "Al Manhattan junction",
        },
    }.get(metal, {})

    return {
        "design_summary": {
            "num_qubits": num_qubits,
            "topology": topology,
            "substrate": substrate,
            "metal": metal,
        },
        "substrate_spec": specs,
        "metal_spec": metal_spec,
        "lithography": {
            "tool": "E-beam lithography (JEOL JBX-9300FS recommended)",
            "resist": "PMMA A6 / MMA 8.5 EL11 bilayer",
            "developer": "MIBK:IPA 1:3, 60 sec at -10°C",
            "min_feature_um": 0.2,
        },
        "layers": [
            {"layer": 1, "name": "Base metal", "material": metal, "thickness_nm": 100},
            {"layer": 2, "name": "Josephson junction", "material": "Al/Al₂O₃/Al", "thickness_nm": 30},
            {"layer": 3, "name": "Dielectric (optional)", "material": "SiO₂", "thickness_nm": 200},
        ],
        "dicing": {
            "method": "Laser dicing (preferred) or diamond-blade saw",
            "chip_size_mm": "7x7",
        },
    }


def _process_compatibility_check(substrate: str, metal: str) -> dict[str, Any]:
    """Check process compatibility between substrate and metal choices."""
    compatibility: dict[str, Any] = {"compatible": True, "notes": [], "warnings": []}

    if substrate == "silicon" and metal == "tantalum":
        compatibility["warnings"].append(
            "Ta on Si requires careful adhesion layer (typically 5nm Ti or TiN)"
        )
    if substrate == "sapphire" and metal == "aluminum":
        compatibility["notes"].append(
            "Al on sapphire gives excellent T1 times (>200 µs reported)"
        )
    if substrate == "sapphire" and metal == "niobium":
        compatibility["notes"].append(
            "Nb on sapphire standard process; consider annealing at 800°C"
        )
    if metal == "nbtin":
        compatibility["notes"].append(
            "NbTiN deposition requires N₂/Ar reactive sputtering at elevated temperature"
        )

    return compatibility
