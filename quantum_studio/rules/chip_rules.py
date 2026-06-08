"""
Complete rule catalog for building working superconducting quantum chips.

Covers every constraint required for a functional ≤5-qubit transmon chip:
physical parameter ranges, fabrication geometry, layout topology, readout
engineering, and Qiskit Metal compatibility.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any

from quantum_studio.config import get_settings
from quantum_studio.validation.constraints import ALL_RULE_CLASSES


class RuleCategory(str, Enum):
    """Rule grouping for documentation and reporting."""

    PHYSICS = "physics"
    FABRICATION = "fabrication"
    LAYOUT = "layout"
    READOUT = "readout"
    COUPLING = "coupling"
    METAL = "metal"
    VALIDATION = "validation"


@dataclass(frozen=True)
class ChipRule:
    """A single design or fabrication rule."""

    id: str
    category: RuleCategory
    name: str
    description: str
    constraint: str
    enforced_by: str
    severity: str = "error"

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "category": self.category.value,
            "name": self.name,
            "description": self.description,
            "constraint": self.constraint,
            "enforced_by": self.enforced_by,
            "severity": self.severity,
        }


class ChipRules:
    """Registry of all rules for extreme-quality ≤5-qubit superconducting chips.

    Use :meth:`all_rules` to enumerate every rule, :meth:`validate_design`
    to run the full DRC + semantic validation pipeline, and
    :meth:`summary` for human-readable documentation.
    """

    @staticmethod
    def all_rules() -> list[ChipRule]:
        """Return the complete rule catalog (physics + fabrication + layout)."""
        settings = get_settings()
        qr = settings.qubit_ranges
        rr = settings.resonator_ranges
        cr = settings.coupler_ranges
        fab = settings.fabrication
        place = settings.placement

        rules: list[ChipRule] = [
            # ── Scope ───────────────────────────────────────────────────
            ChipRule(
                id="scope.max_qubits",
                category=RuleCategory.LAYOUT,
                name="Maximum qubit count",
                description="Chip supports 1–5 transmon qubits.",
                constraint=f"1 ≤ qubits ≤ {place.max_qubits}",
                enforced_by="QCLangValidator, PlacementEngine",
            ),
            ChipRule(
                id="scope.chip_size",
                category=RuleCategory.FABRICATION,
                name="Maximum chip dimensions",
                description="Chip must fit standard dilution-fridge sample holders.",
                constraint="width_mm ≤ 20, height_mm ≤ 20",
                enforced_by="QuantumChip, DesignSizeRule",
            ),
            # ── Transmon physics ────────────────────────────────────────
            ChipRule(
                id="physics.qubit_frequency",
                category=RuleCategory.PHYSICS,
                name="Qubit transition frequency",
                description="Transmon 0→1 frequency must be in the tunable range.",
                constraint=f"{qr.min_frequency_ghz} GHz ≤ f01 ≤ {qr.max_frequency_ghz} GHz",
                enforced_by="QCLangValidator, TransmonQubit",
            ),
            ChipRule(
                id="physics.anharmonicity",
                category=RuleCategory.PHYSICS,
                name="Qubit anharmonicity",
                description="Negative anharmonicity ensures transmon qubit operation.",
                constraint=f"{qr.min_anharmonicity_mhz} MHz ≤ α ≤ {qr.max_anharmonicity_mhz} MHz",
                enforced_by="QCLangValidator, TransmonQubit",
            ),
            ChipRule(
                id="physics.ej_ec_ratio",
                category=RuleCategory.PHYSICS,
                name="Ej/Ec transmon regime",
                description="Josephson/charging energy ratio must place qubit in transmon limit.",
                constraint=f"{qr.min_ej_ec_ratio} ≤ Ej/Ec ≤ {qr.max_ej_ec_ratio}",
                enforced_by="QCLangValidator, TransmonQubit",
            ),
            ChipRule(
                id="physics.resonator_detuning",
                category=RuleCategory.READOUT,
                name="Readout resonator detuning",
                description="Resonator must be blue-detuned above qubit for dispersive readout.",
                constraint="f_resonator > f_qubit",
                enforced_by="QCLangValidator",
            ),
            ChipRule(
                id="physics.resonator_frequency",
                category=RuleCategory.READOUT,
                name="Resonator frequency range",
                description="Readout resonator frequency within CPW half-wave range.",
                constraint=f"{rr.min_frequency_ghz} GHz ≤ f_r ≤ {rr.max_frequency_ghz} GHz",
                enforced_by="QCLangValidator, Resonator",
            ),
            ChipRule(
                id="physics.coupler_strength",
                category=RuleCategory.COUPLING,
                name="Qubit-qubit coupling strength",
                description="Inter-qubit coupling must be strong enough for gates but not too strong.",
                constraint=f"{cr.min_strength_mhz} MHz ≤ J ≤ {cr.max_strength_mhz} MHz",
                enforced_by="QCLangValidator, Coupler",
            ),
            ChipRule(
                id="physics.readout_coupling",
                category=RuleCategory.READOUT,
                name="Readout coupling strength",
                description="Dispersive readout coupling g/2π.",
                constraint=f"{rr.min_coupling_mhz} MHz ≤ g ≤ {rr.max_coupling_mhz} MHz",
                enforced_by="QCLangValidator",
                severity="warning",
            ),
            ChipRule(
                id="physics.frequency_separation",
                category=RuleCategory.READOUT,
                name="Resonator frequency separation",
                description="Resonators on same feedline must not overlap in frequency.",
                constraint="Δf ≥ 100 MHz between multiplexed resonators",
                enforced_by="FrequencyCollisionRule",
                severity="warning",
            ),
            # ── Fabrication geometry ────────────────────────────────────
            ChipRule(
                id="fab.min_trace_width",
                category=RuleCategory.FABRICATION,
                name="Minimum CPW trace width",
                description="Centre conductor width must meet foundry resolution.",
                constraint=f"trace_width ≥ {fab.min_trace_width_um} μm",
                enforced_by="MinTraceWidthRule",
            ),
            ChipRule(
                id="fab.min_gap",
                category=RuleCategory.FABRICATION,
                name="Minimum CPW gap",
                description="Gap between centre trace and ground must prevent shorts.",
                constraint=f"gap ≥ {fab.min_gap_um} μm",
                enforced_by="MinGapRule",
            ),
            ChipRule(
                id="fab.min_spacing",
                category=RuleCategory.FABRICATION,
                name="Minimum component spacing",
                description="Edge-to-edge clearance between any two components.",
                constraint=f"spacing ≥ {fab.min_spacing_um} μm",
                enforced_by="MinSpacingRule",
            ),
            ChipRule(
                id="fab.chip_margin",
                category=RuleCategory.FABRICATION,
                name="Chip edge margin",
                description="Keep-out from chip edge to ground plane and bond pads.",
                constraint=f"margin ≥ {fab.ground_plane_margin_um} μm",
                enforced_by="BoundaryRule, QuantumChip",
            ),
            ChipRule(
                id="fab.junction_area",
                category=RuleCategory.FABRICATION,
                name="Josephson junction area",
                description="Junction area bounds Ej and fabrication yield.",
                constraint=f"{fab.min_junction_area_um2} μm² ≤ area ≤ {fab.max_junction_area_um2} μm²",
                enforced_by="FabricationConstraints",
            ),
            ChipRule(
                id="fab.fillet_radius",
                category=RuleCategory.FABRICATION,
                name="CPW bend fillet radius",
                description="Minimum bend radius to avoid current crowding and lithography issues.",
                constraint=f"fillet ≥ {fab.fillet_radius_um} μm",
                enforced_by="RoutingEngine, MetalCodeGenerator",
            ),
            # ── Layout topology ─────────────────────────────────────────
            ChipRule(
                id="layout.topology",
                category=RuleCategory.LAYOUT,
                name="Supported topologies",
                description="Automatic placement for standard connectivity graphs.",
                constraint="single, linear, triangle, grid, T-shape, cross/star",
                enforced_by="PlacementEngine",
            ),
            ChipRule(
                id="layout.qubit_spacing",
                category=RuleCategory.LAYOUT,
                name="Qubit spacing",
                description="Minimum centre-to-centre distance between adjacent qubits.",
                constraint=f"spacing ≥ {place.qubit_spacing_mm} mm",
                enforced_by="PlacementEngine",
            ),
            ChipRule(
                id="layout.no_overlap",
                category=RuleCategory.LAYOUT,
                name="No component overlap",
                description="Component bounding boxes must not intersect.",
                constraint="pairwise bbox non-overlap",
                enforced_by="OverlapRule",
            ),
            ChipRule(
                id="layout.boundary",
                category=RuleCategory.LAYOUT,
                name="Components within chip",
                description="All geometry inside usable chip area.",
                constraint="bbox inside chip safe region",
                enforced_by="BoundaryRule",
            ),
            ChipRule(
                id="layout.route_conflict",
                category=RuleCategory.LAYOUT,
                name="No route crossing",
                description="CPW routes must not cross or violate spacing.",
                constraint="no intersection, min route spacing",
                enforced_by="RouteConflictRule, ResonatorCollisionRule",
            ),
            ChipRule(
                id="layout.coupler_proximity",
                category=RuleCategory.COUPLING,
                name="Coupler midpoint placement",
                description="Coupler positioned between connected qubits.",
                constraint="coupler within 60% of qubit-qubit midpoint",
                enforced_by="CouplerProximityRule, PlacementEngine",
            ),
            # ── Reference integrity ─────────────────────────────────────
            ChipRule(
                id="validation.unique_ids",
                category=RuleCategory.VALIDATION,
                name="Unique component IDs",
                description="Every qubit, resonator, and coupler has a unique identifier.",
                constraint="no duplicate IDs across chip",
                enforced_by="QCLangValidator, QuantumDesign",
            ),
            ChipRule(
                id="validation.resonator_target",
                category=RuleCategory.VALIDATION,
                name="Resonator qubit reference",
                description="Each resonator targets an existing qubit.",
                constraint="target_qubit ∈ qubit_ids",
                enforced_by="QCLangValidator, QuantumDesign",
            ),
            ChipRule(
                id="validation.coupler_refs",
                category=RuleCategory.VALIDATION,
                name="Coupler qubit references",
                description="Couplers connect two distinct existing qubits.",
                constraint="source ≠ target, both ∈ qubit_ids",
                enforced_by="QCLangValidator",
            ),
            # ── Qiskit Metal ────────────────────────────────────────────
            ChipRule(
                id="metal.transmon_pocket",
                category=RuleCategory.METAL,
                name="TransmonPocket qubits",
                description="Each qubit instantiated as Qiskit Metal TransmonPocket.",
                constraint="connection_pads: readout + bus_N per coupler",
                enforced_by="MetalCodeGenerator",
            ),
            ChipRule(
                id="metal.readout_chain",
                category=RuleCategory.METAL,
                name="Readout chain",
                description="CoupledLineTee hanger + RouteMeander to qubit readout pad.",
                constraint="total_length = λ/2 at f_resonator",
                enforced_by="MetalCodeGenerator",
            ),
            ChipRule(
                id="metal.bus_coupling",
                category=RuleCategory.METAL,
                name="Qubit-qubit bus",
                description="Inter-qubit coupling via RouteMeander between bus pads.",
                constraint="pin_inputs: bus_N → bus_N",
                enforced_by="MetalCodeGenerator",
            ),
            ChipRule(
                id="metal.launchpad",
                category=RuleCategory.METAL,
                name="Wirebond launchpads",
                description="LaunchpadWirebond at chip edge for each readout line.",
                constraint="50 Ω CPW termination at chip boundary",
                enforced_by="MetalCodeGenerator",
            ),
            ChipRule(
                id="metal.coordinates",
                category=RuleCategory.METAL,
                name="Metal coordinate system",
                description="Chip-centred coordinates, mm/um unit strings.",
                constraint="origin at chip centre, DesignPlanar",
                enforced_by="PlacementEngine, MetalCodeGenerator",
            ),
        ]
        return rules

    @staticmethod
    def by_category(category: RuleCategory) -> list[ChipRule]:
        """Return rules filtered by category."""
        return [r for r in ChipRules.all_rules() if r.category == category]

    @staticmethod
    def drc_rule_names() -> list[str]:
        """Return names of all automated DRC rule classes."""
        return [cls.name for cls in ALL_RULE_CLASSES if hasattr(cls, "name")]

    @staticmethod
    def summary() -> str:
        """Human-readable summary of all rules grouped by category."""
        lines = ["═══ Superconducting Chip Rules (≤5 qubits) ═══", ""]
        current_cat: RuleCategory | None = None
        for rule in ChipRules.all_rules():
            if rule.category != current_cat:
                current_cat = rule.category
                lines.append(f"── {current_cat.value.upper()} ──")
            lines.append(f"  [{rule.id}] {rule.name}")
            lines.append(f"      {rule.constraint}")
            lines.append(f"      → {rule.enforced_by}")
        lines.append("")
        lines.append(f"Total rules: {len(ChipRules.all_rules())}")
        lines.append(f"DRC automation: {len(ChipRules.drc_rule_names())} checks")
        return "\n".join(lines)

    @staticmethod
    def to_json() -> list[dict[str, Any]]:
        """Serialize all rules for export."""
        return [r.to_dict() for r in ChipRules.all_rules()]
