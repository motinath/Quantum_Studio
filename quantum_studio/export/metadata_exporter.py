"""
Design metadata export for Quantum Studio.

Produces a comprehensive summary of the quantum chip design including
component inventory, connectivity, fabrication notes, and version tracking.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from quantum_studio import __version__
from quantum_studio.utils.logging import get_logger

logger = get_logger("export.metadata")


@dataclass
class MetadataExportResult:
    """Result of metadata export."""
    success: bool
    output_path: str


class MetadataExporter:
    """
    Exports comprehensive design metadata for documentation and tracking.

    Produces a structured JSON file containing:
    - Design summary (qubit count, connectivity, chip dimensions)
    - Component inventory with positions and parameters
    - Connectivity map
    - Fabrication notes and constraints used
    - Pipeline version and timestamp
    """

    def export(self, design, geometry: dict | None = None,
               drc_report: Any = None,
               output_path: str | Path = "design_metadata.json") -> MetadataExportResult:
        """
        Export full design metadata.

        Args:
            design: QuantumDesign instance.
            geometry: Layout geometry dict (optional).
            drc_report: DRC validation report (optional).
            output_path: Output file path.

        Returns:
            MetadataExportResult with success status and path.
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        metadata = {
            "format": "quantum_studio_metadata",
            "version": "1.0",
            "generator": f"Quantum Studio v{__version__}",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "design_status": design.status,
        }

        # Design summary
        metadata["summary"] = {
            "chip_name": design.chip.name,
            "chip_width_mm": design.chip.width_mm,
            "chip_height_mm": design.chip.height_mm,
            "chip_area_mm2": design.chip.area_mm2,
            "substrate": design.chip.substrate,
            "num_qubits": len(design.qubits),
            "num_resonators": len(design.resonators),
            "num_couplers": len(design.couplers),
            "total_components": (
                len(design.qubits) + len(design.resonators) + len(design.couplers)
            ),
        }

        # Component inventory
        metadata["components"] = {
            "qubits": [],
            "resonators": [],
            "couplers": [],
        }

        for qubit in design.qubits:
            metadata["components"]["qubits"].append({
                "id": qubit.id,
                "frequency_ghz": qubit.frequency_ghz,
                "anharmonicity_mhz": qubit.anharmonicity_mhz,
                "position_mm": [qubit.pos_x_mm, qubit.pos_y_mm],
                "orientation_deg": qubit.orientation_deg,
                "junction_type": qubit.junction_type,
                "pocket_size_um": [qubit.pocket_width_um, qubit.pocket_height_um],
                "pad_size_um": [qubit.pad_width_um, qubit.pad_height_um],
                "pad_gap_um": qubit.pad_gap_um,
            })

        for res in design.resonators:
            metadata["components"]["resonators"].append({
                "id": res.id,
                "frequency_ghz": res.frequency_ghz,
                "target_qubit": res.target_qubit_id,
                "physical_length_mm": res.physical_length_mm,
                "coupling_strength_mhz": res.coupling_strength_mhz,
                "coupling_type": res.coupling_type,
                "position_mm": [res.pos_x_mm, res.pos_y_mm],
                "cpw_trace_width_um": res.cpw_trace_width_um,
                "cpw_gap_um": res.cpw_gap_um,
            })

        for coupler in design.couplers:
            metadata["components"]["couplers"].append({
                "id": coupler.id,
                "source_qubit": coupler.source_qubit_id,
                "target_qubit": coupler.target_qubit_id,
                "strength_mhz": coupler.strength_mhz,
                "type": coupler.coupler_type,
                "position_mm": [coupler.pos_x_mm, coupler.pos_y_mm],
            })

        # Connectivity map
        metadata["connectivity"] = {
            "qubit_qubit": [],
            "qubit_resonator": [],
        }

        for coupler in design.couplers:
            metadata["connectivity"]["qubit_qubit"].append({
                "source": coupler.source_qubit_id,
                "target": coupler.target_qubit_id,
                "coupler_id": coupler.id,
                "strength_mhz": coupler.strength_mhz,
            })

        for res in design.resonators:
            metadata["connectivity"]["qubit_resonator"].append({
                "qubit": res.target_qubit_id,
                "resonator": res.id,
                "coupling_strength_mhz": res.coupling_strength_mhz,
            })

        # Fabrication constraints
        constraints = design.chip.constraints
        metadata["fabrication"] = {
            "min_trace_width_um": constraints.min_trace_width_mm * 1000,
            "min_gap_um": constraints.min_gap_mm * 1000,
            "min_component_spacing_um": constraints.min_component_spacing_mm * 1000,
            "chip_margin_um": constraints.chip_margin_mm * 1000,
            "cpw_trace_width_um": constraints.cpw_trace_width_mm * 1000,
            "cpw_gap_um": constraints.cpw_gap_mm * 1000,
            "fillet_radius_um": constraints.fillet_radius_mm * 1000,
        }

        # DRC results
        if drc_report is not None:
            metadata["drc"] = {
                "status": drc_report.status,
                "total_violations": drc_report.total_violations,
                "errors": drc_report.errors,
                "warnings": drc_report.warnings,
            }

        # Layout statistics
        if geometry:
            total_polygons = 0
            total_paths = 0
            for comp_geo in geometry.values():
                if isinstance(comp_geo, dict):
                    total_polygons += len(comp_geo.get("polygons", []))
                    total_paths += len(comp_geo.get("paths", []))

            metadata["layout_statistics"] = {
                "total_geometry_components": len(geometry),
                "total_polygons": total_polygons,
                "total_paths": total_paths,
            }

        with open(output_path, "w") as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"Design metadata exported to {output_path}")

        return MetadataExportResult(
            success=True,
            output_path=str(output_path),
        )
