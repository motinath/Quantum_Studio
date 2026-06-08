"""
Electromagnetic simulation export for Quantum Studio.

Generates geometry and configuration files suitable for EM simulation tools
including HFSS, Sonnet, and generic simulation frameworks.

Exports include:
  - Geometry definitions (polygons, paths)
  - Port definitions at feedline launches
  - Boundary conditions
  - Material definitions
  - Mesh hints
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import numpy as np

from quantum_studio.config import get_settings, SILICON_EPSILON_R, SAPPHIRE_EPSILON_R
from quantum_studio.utils.logging import get_logger
from quantum_studio.utils.units import mm_to_m, mm_to_um, ghz_to_hz

logger = get_logger("export.simulation")


# ── Data Structures ─────────────────────────────────────────────────────────

@dataclass
class Material:
    """Material definition for EM simulation."""
    name: str
    type: str  # 'conductor', 'dielectric', 'vacuum'
    conductivity: Optional[float] = None  # S/m
    epsilon_r: Optional[float] = None
    loss_tangent: Optional[float] = None
    thickness_m: Optional[float] = None

    def to_dict(self) -> dict:
        d = {"name": self.name, "type": self.type}
        if self.conductivity is not None:
            d["conductivity_S_m"] = self.conductivity
        if self.epsilon_r is not None:
            d["epsilon_r"] = self.epsilon_r
        if self.loss_tangent is not None:
            d["loss_tangent"] = self.loss_tangent
        if self.thickness_m is not None:
            d["thickness_m"] = self.thickness_m
        return d


@dataclass
class Port:
    """Simulation port definition."""
    name: str
    port_type: str  # 'lumped', 'wave', 'terminal'
    position_mm: tuple[float, float]
    impedance_ohm: float = 50.0
    orientation_deg: float = 0.0
    width_mm: float = 0.01  # port width

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "type": self.port_type,
            "position_mm": list(self.position_mm),
            "impedance_ohm": self.impedance_ohm,
            "orientation_deg": self.orientation_deg,
            "width_mm": self.width_mm,
        }


@dataclass
class BoundaryCondition:
    """Simulation boundary condition."""
    name: str
    boundary_type: str  # 'radiation', 'pec', 'pmc', 'impedance'
    faces: list[str]  # e.g., ['top', 'bottom', 'left', 'right', 'front', 'back']

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "type": self.boundary_type,
            "faces": self.faces,
        }


@dataclass
class SimulationSetup:
    """Complete simulation setup configuration."""
    solver_type: str = "eigenmode"  # 'eigenmode', 'driven_modal', 'q3d'
    min_frequency_ghz: float = 1.0
    max_frequency_ghz: float = 12.0
    num_modes: int = 10
    max_passes: int = 20
    convergence_delta_s: float = 0.01
    mesh_refinement: str = "adaptive"

    def to_dict(self) -> dict:
        return {
            "solver_type": self.solver_type,
            "frequency_range_ghz": [self.min_frequency_ghz, self.max_frequency_ghz],
            "num_modes": self.num_modes,
            "max_passes": self.max_passes,
            "convergence_delta_s": self.convergence_delta_s,
            "mesh_refinement": self.mesh_refinement,
        }


@dataclass
class SimulationExportResult:
    """Result of simulation export."""
    success: bool
    output_path: str
    format: str
    num_ports: int = 0
    num_materials: int = 0
    errors: list[str] = field(default_factory=list)


# ── Default Materials ───────────────────────────────────────────────────────

NIOBIUM = Material(
    name="niobium",
    type="conductor",
    conductivity=1e20,  # Superconducting (effectively infinite)
    thickness_m=200e-9,
)

ALUMINUM = Material(
    name="aluminum",
    type="conductor",
    conductivity=1e20,
    thickness_m=100e-9,
)

SILICON_SUBSTRATE = Material(
    name="silicon",
    type="dielectric",
    epsilon_r=SILICON_EPSILON_R,
    loss_tangent=1e-6,
    thickness_m=500e-6,
)

SAPPHIRE_SUBSTRATE = Material(
    name="sapphire",
    type="dielectric",
    epsilon_r=SAPPHIRE_EPSILON_R,
    loss_tangent=1e-7,
    thickness_m=500e-6,
)

VACUUM = Material(
    name="vacuum",
    type="vacuum",
    epsilon_r=1.0,
)


# ── Simulation Exporter ────────────────────────────────────────────────────

class SimulationExporter:
    """
    Exports quantum chip layout for electromagnetic simulation.

    Generates a comprehensive simulation setup including:
    - Full geometry in a structured format
    - Port definitions at all feedline terminations
    - Material stack (substrate + metal + vacuum)
    - Boundary conditions
    - Solver configuration
    - Mesh control hints

    Supported output formats:
    - HFSS-compatible JSON
    - Generic simulation JSON
    """

    def __init__(self):
        self.materials: list[Material] = []
        self.ports: list[Port] = []
        self.boundaries: list[BoundaryCondition] = []
        self.geometry_components: dict[str, dict] = {}
        self.setup = SimulationSetup()

    def configure_for_design(self, design, geometry: dict,
                              routes: list | None = None) -> None:
        """
        Auto-configure simulation setup from a QuantumDesign.

        Sets up materials, ports, boundaries, and frequency range
        based on the design's qubit and resonator parameters.
        """
        # Materials
        substrate_material = {
            "silicon": SILICON_SUBSTRATE,
            "sapphire": SAPPHIRE_SUBSTRATE,
        }.get(design.chip.substrate, SILICON_SUBSTRATE)

        self.materials = [
            substrate_material,
            NIOBIUM,
            VACUUM,
        ]

        # Frequency range: cover all qubit and resonator frequencies with margin
        all_freqs = [q.frequency_ghz for q in design.qubits]
        all_freqs.extend(r.frequency_ghz for r in design.resonators)

        if all_freqs:
            self.setup.min_frequency_ghz = max(0.5, min(all_freqs) - 2.0)
            self.setup.max_frequency_ghz = max(all_freqs) + 3.0

        # Number of modes: at least qubits + resonators
        self.setup.num_modes = max(10, len(design.qubits) + len(design.resonators) + 5)

        # Ports at feedline launches (left and right of chip)
        chip_half_w = design.chip.width_mm / 2
        feedline_y = -(design.chip.height_mm / 2 - 1.5)  # 1.5mm from bottom

        self.ports = [
            Port(
                name="P1_feedline_in",
                port_type="lumped",
                position_mm=(-chip_half_w + 0.3, feedline_y),
                impedance_ohm=50.0,
                orientation_deg=0.0,
            ),
            Port(
                name="P2_feedline_out",
                port_type="lumped",
                position_mm=(chip_half_w - 0.3, feedline_y),
                impedance_ohm=50.0,
                orientation_deg=180.0,
            ),
        ]

        # Boundary conditions
        self.boundaries = [
            BoundaryCondition(
                name="radiation",
                boundary_type="radiation",
                faces=["top", "left", "right", "front", "back"],
            ),
            BoundaryCondition(
                name="ground",
                boundary_type="pec",
                faces=["bottom"],
            ),
        ]

        # Geometry
        self.geometry_components = geometry

    def export_hfss(self, output_path: str | Path) -> SimulationExportResult:
        """
        Export simulation setup in HFSS-compatible JSON format.

        This format can be parsed by custom HFSS automation scripts
        to set up an Ansys HFSS eigenmode or driven-modal simulation.
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            "format": "quantum_studio_hfss",
            "version": "1.0",
            "solver": self.setup.to_dict(),
            "materials": [m.to_dict() for m in self.materials],
            "ports": [p.to_dict() for p in self.ports],
            "boundaries": [b.to_dict() for b in self.boundaries],
            "geometry": {
                "unit": "mm",
                "components": {},
            },
            "substrate": {
                "thickness_um": 500.0,
                "material": "silicon",
            },
            "vacuum_box": {
                "height_above_um": 600.0,
                "height_below_um": 100.0,
            },
            "mesh_control": {
                "max_element_length_um": 50.0,
                "junction_refinement_um": 1.0,
                "cpw_refinement_um": 5.0,
            },
        }

        # Add geometry components
        for comp_name, comp_geo in self.geometry_components.items():
            data["geometry"]["components"][comp_name] = self._serialize_geometry(
                comp_geo
            )

        with open(output_path, "w") as f:
            json.dump(data, f, indent=2)

        logger.info(f"HFSS simulation export written to {output_path}")

        return SimulationExportResult(
            success=True,
            output_path=str(output_path),
            format="hfss_json",
            num_ports=len(self.ports),
            num_materials=len(self.materials),
        )

    def export_generic(self, output_path: str | Path) -> SimulationExportResult:
        """
        Export simulation setup in a generic JSON format.

        Suitable for custom simulation frameworks, Sonnet import scripts,
        or post-processing tools.
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            "format": "quantum_studio_simulation",
            "version": "1.0",
            "setup": self.setup.to_dict(),
            "materials": [m.to_dict() for m in self.materials],
            "ports": [p.to_dict() for p in self.ports],
            "boundaries": [b.to_dict() for b in self.boundaries],
            "geometry": {
                "unit": "mm",
                "components": {},
            },
            "analysis_requests": [
                {
                    "type": "eigenmode",
                    "description": "Find qubit and resonator modes",
                    "num_modes": self.setup.num_modes,
                },
                {
                    "type": "capacitance_matrix",
                    "description": "Extract capacitance matrix between all conductors",
                },
            ],
        }

        for comp_name, comp_geo in self.geometry_components.items():
            data["geometry"]["components"][comp_name] = self._serialize_geometry(
                comp_geo
            )

        with open(output_path, "w") as f:
            json.dump(data, f, indent=2)

        logger.info(f"Generic simulation export written to {output_path}")

        return SimulationExportResult(
            success=True,
            output_path=str(output_path),
            format="generic_json",
            num_ports=len(self.ports),
            num_materials=len(self.materials),
        )

    def _serialize_geometry(self, geo_data: Any) -> dict:
        """Serialize geometry data, converting numpy arrays to lists."""
        if isinstance(geo_data, dict):
            return {k: self._serialize_geometry(v) for k, v in geo_data.items()}
        elif isinstance(geo_data, (list, tuple)):
            return [self._serialize_geometry(item) for item in geo_data]
        elif isinstance(geo_data, np.ndarray):
            return geo_data.tolist()
        elif isinstance(geo_data, (np.floating, np.integer)):
            return float(geo_data)
        else:
            return geo_data
