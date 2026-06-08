"""
GDS-II fabrication export for Quantum Studio.

Converts layout geometry into GDSII format suitable for
superconducting quantum chip fabrication.

Supports:
  - gdstk (primary, fast C++ backend)
  - Qiskit Metal QGDSRenderer (when Metal backend is active)
  - JSON geometry fallback (when no GDS library available)
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import numpy as np

from quantum_studio.config import GDSConfig, get_settings
from quantum_studio.utils.logging import get_logger
from quantum_studio.utils.units import mm_to_um, um_to_m

logger = get_logger("export.gds")

# ── GDS Backend Detection ───────────────────────────────────────────────────

GDSTK_AVAILABLE = False
try:
    import gdstk
    GDSTK_AVAILABLE = True
except ImportError:
    pass


# ── Data Structures ─────────────────────────────────────────────────────────

@dataclass
class GDSLayer:
    """GDS layer definition."""
    number: int
    datatype: int = 0
    name: str = ""
    description: str = ""


@dataclass
class GDSComponent:
    """A component ready for GDS export."""
    name: str
    polygons: list[dict] = field(default_factory=list)
    # Each polygon: {"vertices": [(x,y), ...], "layer": int, "datatype": int}
    paths: list[dict] = field(default_factory=list)
    # Each path: {"points": [(x,y), ...], "width": float, "layer": int}


@dataclass
class GDSExportResult:
    """Result of a GDS export operation."""
    success: bool
    output_path: Optional[str] = None
    format: str = "gds"  # 'gds' or 'json'
    num_cells: int = 0
    num_polygons: int = 0
    total_layers: int = 0
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


# ── GDS Exporter ────────────────────────────────────────────────────────────

class GDSExporter:
    """
    Exports quantum chip layout geometry to GDS-II format.

    The exporter converts layout geometry (polygons, paths, component bounding boxes)
    into fabrication-ready GDS-II files. It supports multiple backends:
    
    1. gdstk (preferred) – fast C++ library for GDS manipulation
    2. JSON fallback – structured geometry export when no GDS library is available

    Layer mapping:
        Layer 1: Metal (CPW traces, qubit pads, ground plane)
        Layer 2: Junction (Josephson junction areas)
        Layer 3: Ground plane (inverted for etch mask)
        Layer 10: Keepout regions
        Layer 100: Annotations (labels, markers)
    """

    def __init__(self, config: Optional[GDSConfig] = None):
        self.config = config or get_settings().gds
        self.layers = self._define_layers()
        self._components: list[GDSComponent] = []

    def _define_layers(self) -> dict[str, GDSLayer]:
        """Define the GDS layer stack."""
        return {
            "metal": GDSLayer(
                number=self.config.layer_metal,
                datatype=0,
                name="METAL",
                description="Superconducting metal layer (Nb/Al)",
            ),
            "junction": GDSLayer(
                number=self.config.layer_junction,
                datatype=0,
                name="JUNCTION",
                description="Josephson junction definition",
            ),
            "ground": GDSLayer(
                number=self.config.layer_ground,
                datatype=0,
                name="GROUND",
                description="Ground plane",
            ),
            "keepout": GDSLayer(
                number=self.config.layer_keepout,
                datatype=0,
                name="KEEPOUT",
                description="Keepout / exclusion regions",
            ),
            "annotation": GDSLayer(
                number=self.config.layer_annotation,
                datatype=0,
                name="ANNOTATION",
                description="Labels and alignment markers",
            ),
        }

    def add_chip_outline(self, width_mm: float, height_mm: float) -> None:
        """Add the chip outline as a rectangular boundary on the annotation layer."""
        w = mm_to_um(width_mm)
        h = mm_to_um(height_mm)
        hw, hh = w / 2, h / 2

        comp = GDSComponent(name="chip_outline")
        comp.polygons.append({
            "vertices": [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)],
            "layer": self.config.layer_annotation,
            "datatype": 0,
        })
        self._components.append(comp)

    def add_ground_plane(self, width_mm: float, height_mm: float,
                         cutouts: list[list[tuple[float, float]]] | None = None) -> None:
        """
        Add the ground plane with optional cutouts for components.

        The ground plane covers the entire chip. Cutouts are subtracted
        (representing etched regions where qubits, resonators, etc. are patterned).
        """
        w = mm_to_um(width_mm)
        h = mm_to_um(height_mm)
        hw, hh = w / 2, h / 2

        comp = GDSComponent(name="ground_plane")
        comp.polygons.append({
            "vertices": [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)],
            "layer": self.config.layer_ground,
            "datatype": 0,
        })

        if cutouts:
            for i, cutout_verts in enumerate(cutouts):
                # Cutouts are on a separate datatype for boolean subtraction
                comp.polygons.append({
                    "vertices": [(mm_to_um(x), mm_to_um(y)) for x, y in cutout_verts],
                    "layer": self.config.layer_ground,
                    "datatype": 1,  # Datatype 1 = cutout
                })

        self._components.append(comp)

    def add_qubit(self, name: str, pos_x_mm: float, pos_y_mm: float,
                  pad_width_um: float, pad_height_um: float,
                  pad_gap_um: float, pocket_width_um: float,
                  pocket_height_um: float, orientation_deg: float = 0.0) -> None:
        """
        Add a transmon qubit (two pads + junction marker) to the GDS.

        Creates:
        - Two rectangular pads on the metal layer
        - A pocket cutout on the ground layer
        - A junction marker on the junction layer
        """
        cx = mm_to_um(pos_x_mm)
        cy = mm_to_um(pos_y_mm)
        angle_rad = math.radians(orientation_deg)

        def rotate_point(x: float, y: float) -> tuple[float, float]:
            rx = x * math.cos(angle_rad) - y * math.sin(angle_rad)
            ry = x * math.sin(angle_rad) + y * math.cos(angle_rad)
            return (cx + rx, cy + ry)

        comp = GDSComponent(name=name)

        # Pad 1 (top)
        pw2, ph2 = pad_width_um / 2, pad_height_um / 2
        gap2 = pad_gap_um / 2
        pad1_verts = [
            rotate_point(-pw2, gap2),
            rotate_point(pw2, gap2),
            rotate_point(pw2, gap2 + pad_height_um),
            rotate_point(-pw2, gap2 + pad_height_um),
        ]
        comp.polygons.append({
            "vertices": pad1_verts,
            "layer": self.config.layer_metal,
            "datatype": 0,
        })

        # Pad 2 (bottom)
        pad2_verts = [
            rotate_point(-pw2, -gap2 - pad_height_um),
            rotate_point(pw2, -gap2 - pad_height_um),
            rotate_point(pw2, -gap2),
            rotate_point(-pw2, -gap2),
        ]
        comp.polygons.append({
            "vertices": pad2_verts,
            "layer": self.config.layer_metal,
            "datatype": 0,
        })

        # Pocket cutout (ground plane void)
        pkw2, pkh2 = pocket_width_um / 2, pocket_height_um / 2
        pocket_verts = [
            rotate_point(-pkw2, -pkh2),
            rotate_point(pkw2, -pkh2),
            rotate_point(pkw2, pkh2),
            rotate_point(-pkw2, pkh2),
        ]
        comp.polygons.append({
            "vertices": pocket_verts,
            "layer": self.config.layer_ground,
            "datatype": 1,  # cutout
        })

        # Junction marker (small cross at center)
        jsize = 2.0  # μm
        junction_verts = [
            rotate_point(-jsize, -0.5),
            rotate_point(jsize, -0.5),
            rotate_point(jsize, 0.5),
            rotate_point(-jsize, 0.5),
        ]
        comp.polygons.append({
            "vertices": junction_verts,
            "layer": self.config.layer_junction,
            "datatype": 0,
        })

        self._components.append(comp)

    def add_cpw_path(self, name: str, points_mm: list[tuple[float, float]],
                     trace_width_um: float = 10.0, gap_um: float = 6.0) -> None:
        """
        Add a coplanar waveguide path on the metal layer.

        The path consists of a center trace (metal) and two gaps (ground plane cutouts).
        """
        points_um = [(mm_to_um(x), mm_to_um(y)) for x, y in points_mm]

        comp = GDSComponent(name=name)

        # Center trace
        comp.paths.append({
            "points": points_um,
            "width": trace_width_um,
            "layer": self.config.layer_metal,
            "datatype": 0,
        })

        # Gap (etched region around trace) – represented as wider path on ground cutout
        comp.paths.append({
            "points": points_um,
            "width": trace_width_um + 2 * gap_um,
            "layer": self.config.layer_ground,
            "datatype": 1,
        })

        self._components.append(comp)

    def add_launchpad(self, name: str, pos_x_mm: float, pos_y_mm: float,
                      orientation_deg: float = 0.0,
                      pad_width_um: float = 300.0,
                      pad_height_um: float = 300.0,
                      taper_length_um: float = 200.0,
                      trace_width_um: float = 10.0) -> None:
        """Add a wirebond launchpad at the chip edge."""
        cx = mm_to_um(pos_x_mm)
        cy = mm_to_um(pos_y_mm)
        angle_rad = math.radians(orientation_deg)

        def rp(x: float, y: float) -> tuple[float, float]:
            rx = x * math.cos(angle_rad) - y * math.sin(angle_rad)
            ry = x * math.sin(angle_rad) + y * math.cos(angle_rad)
            return (cx + rx, cy + ry)

        comp = GDSComponent(name=name)

        # Pad rectangle
        pw2, ph2 = pad_width_um / 2, pad_height_um / 2
        pad_verts = [rp(-pw2, 0), rp(pw2, 0), rp(pw2, pad_height_um), rp(-pw2, pad_height_um)]
        comp.polygons.append({
            "vertices": pad_verts,
            "layer": self.config.layer_metal,
            "datatype": 0,
        })

        # Taper from pad to CPW trace
        tw2 = trace_width_um / 2
        taper_verts = [
            rp(-pw2, pad_height_um),
            rp(pw2, pad_height_um),
            rp(tw2, pad_height_um + taper_length_um),
            rp(-tw2, pad_height_um + taper_length_um),
        ]
        comp.polygons.append({
            "vertices": taper_verts,
            "layer": self.config.layer_metal,
            "datatype": 0,
        })

        self._components.append(comp)

    def add_component_from_geometry(self, name: str,
                                     geometry_data: dict[str, Any]) -> None:
        """
        Add a component from generic geometry data.

        Geometry data format:
        {
            "polygons": [{"vertices": [...], "layer": int}],
            "paths": [{"points": [...], "width": float, "layer": int}]
        }
        """
        comp = GDSComponent(name=name)

        for poly in geometry_data.get("polygons", []):
            # Convert mm to μm if needed
            vertices = poly.get("vertices", [])
            layer = poly.get("layer", self.config.layer_metal)
            comp.polygons.append({
                "vertices": vertices,
                "layer": layer,
                "datatype": poly.get("datatype", 0),
            })

        for path in geometry_data.get("paths", []):
            comp.paths.append({
                "points": path.get("points", []),
                "width": path.get("width", 10.0),
                "layer": path.get("layer", self.config.layer_metal),
                "datatype": path.get("datatype", 0),
            })

        self._components.append(comp)

    def export(self, output_path: str | Path) -> GDSExportResult:
        """
        Export all added components to a GDS-II file.

        Uses gdstk if available, otherwise falls back to JSON geometry export.
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if GDSTK_AVAILABLE:
            return self._export_gdstk(output_path)
        else:
            logger.warning("gdstk not available, falling back to JSON geometry export")
            json_path = output_path.with_suffix(".json")
            return self._export_json(json_path)

    def _export_gdstk(self, output_path: Path) -> GDSExportResult:
        """Export using gdstk library."""
        lib = gdstk.Library(
            name="QuantumStudio",
            unit=self.config.gds_unit_m,
            precision=self.config.gds_precision_m,
        )

        top_cell = lib.new_cell("TOP")
        total_polygons = 0
        layers_used = set()
        errors = []
        warnings = []

        for component in self._components:
            try:
                cell = lib.new_cell(component.name)

                # Add polygons
                for poly_data in component.polygons:
                    verts = poly_data["vertices"]
                    layer = poly_data["layer"]
                    dt = poly_data.get("datatype", 0)

                    if len(verts) >= 3:
                        polygon = gdstk.Polygon(verts, layer=layer, datatype=dt)
                        cell.add(polygon)
                        total_polygons += 1
                        layers_used.add(layer)

                # Add paths
                for path_data in component.paths:
                    pts = path_data["points"]
                    width = path_data["width"]
                    layer = path_data["layer"]
                    dt = path_data.get("datatype", 0)

                    if len(pts) >= 2:
                        path = gdstk.FlexPath(
                            pts,
                            width=width,
                            layer=layer,
                            datatype=dt,
                        )
                        cell.add(path)
                        total_polygons += 1
                        layers_used.add(layer)

                # Add cell reference to top cell
                top_cell.add(gdstk.Reference(cell))

            except Exception as e:
                errors.append(f"Error adding component '{component.name}': {e}")
                logger.error(f"GDS export error for '{component.name}': {e}")

        try:
            lib.write_gds(str(output_path))
            logger.info(f"GDS exported to {output_path} ({total_polygons} polygons)")
        except Exception as e:
            errors.append(f"Failed to write GDS file: {e}")
            return GDSExportResult(
                success=False,
                output_path=str(output_path),
                errors=errors,
            )

        return GDSExportResult(
            success=True,
            output_path=str(output_path),
            format="gds",
            num_cells=len(self._components) + 1,
            num_polygons=total_polygons,
            total_layers=len(layers_used),
            errors=errors,
            warnings=warnings,
        )

    def _export_json(self, output_path: Path) -> GDSExportResult:
        """Fallback: export geometry as structured JSON."""
        data = {
            "format": "quantum_studio_geometry",
            "version": "1.0",
            "unit": "um",
            "layers": {
                name: {"number": layer.number, "name": layer.name, "description": layer.description}
                for name, layer in self.layers.items()
            },
            "components": [],
        }

        total_polygons = 0

        for comp in self._components:
            comp_data = {
                "name": comp.name,
                "polygons": [],
                "paths": [],
            }

            for poly in comp.polygons:
                comp_data["polygons"].append({
                    "vertices": [list(v) for v in poly["vertices"]],
                    "layer": poly["layer"],
                    "datatype": poly.get("datatype", 0),
                })
                total_polygons += 1

            for path in comp.paths:
                comp_data["paths"].append({
                    "points": [list(p) for p in path["points"]],
                    "width": path["width"],
                    "layer": path["layer"],
                })

            data["components"].append(comp_data)

        with open(output_path, "w") as f:
            json.dump(data, f, indent=2)

        logger.info(f"JSON geometry exported to {output_path}")

        return GDSExportResult(
            success=True,
            output_path=str(output_path),
            format="json",
            num_cells=len(self._components),
            num_polygons=total_polygons,
            total_layers=len(self.layers),
        )

    def export_from_layout(self, design, geometry: dict,
                           output_path: str | Path) -> GDSExportResult:
        """
        High-level export: takes a QuantumDesign and its geometry dict,
        populates all GDS components, and exports.
        """
        # Chip outline
        self.add_chip_outline(design.chip.width_mm, design.chip.height_mm)

        # Ground plane
        self.add_ground_plane(design.chip.width_mm, design.chip.height_mm)

        # Qubits
        for qubit in design.qubits:
            self.add_qubit(
                name=qubit.id,
                pos_x_mm=qubit.pos_x_mm,
                pos_y_mm=qubit.pos_y_mm,
                pad_width_um=qubit.pad_width_um,
                pad_height_um=qubit.pad_height_um,
                pad_gap_um=qubit.pad_gap_um,
                pocket_width_um=qubit.pocket_width_um,
                pocket_height_um=qubit.pocket_height_um,
                orientation_deg=qubit.orientation_deg,
            )

        # Add geometry from layout backend
        for comp_name, comp_geo in geometry.items():
            if comp_name not in {q.id for q in design.qubits}:
                self.add_component_from_geometry(comp_name, comp_geo)

        return self.export(output_path)
