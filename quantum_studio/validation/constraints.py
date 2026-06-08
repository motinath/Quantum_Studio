"""
Design Rule Check (DRC) constraint rules for superconducting quantum chips.

Each rule validates a specific aspect of the chip design — geometry, spacing,
frequency allocation, or physical feasibility — and returns a list of
violations when the design does not meet fabrication or physics constraints.
"""

from __future__ import annotations

import math
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING, Any

from quantum_studio.config import FabricationDefaults
from quantum_studio.utils.logging import get_logger
from quantum_studio.utils.units import mm_to_m, um_to_m, um_to_mm

if TYPE_CHECKING:
    pass  # forward references handled via string annotations

logger = get_logger("validation.constraints")


# ── Severity & Violation ────────────────────────────────────────────────────


class Severity(Enum):
    """Severity level for a design-rule violation."""

    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class Violation:
    """A single design-rule violation found during DRC.

    Attributes:
        rule_name: Name of the DRC rule that was violated.
        severity: Severity level of this violation.
        component: Component name or ``'global'`` for chip-level violations.
        message: Human-readable description of the violation.
        suggestion: Optional suggestion for fixing the violation.
        location_mm: Optional (x, y) location of the violation in mm.
    """

    rule_name: str
    severity: Severity
    component: str
    message: str
    suggestion: str = ""
    location_mm: tuple[float, float] | None = None

    def to_dict(self) -> dict[str, Any]:
        """Serialize the violation to a plain dictionary.

        Returns:
            Dictionary representation of this violation.
        """
        return {
            "rule_name": self.rule_name,
            "severity": self.severity.value,
            "component": self.component,
            "message": self.message,
            "suggestion": self.suggestion,
            "location_mm": list(self.location_mm) if self.location_mm is not None else None,
        }


# ── Abstract Base Rule ──────────────────────────────────────────────────────


class DRCRule(ABC):
    """Abstract base class for all DRC rules.

    Subclasses must provide ``name``, ``description``, ``severity``, and
    implement the :meth:`check` method.

    Attributes:
        name: Short machine-readable rule name.
        description: Human-readable explanation of the rule.
        severity: Default severity for violations produced by this rule.
    """

    name: str
    description: str
    severity: Severity = Severity.ERROR

    @abstractmethod
    def check(
        self,
        design: Any,
        geometry: dict[str, Any],
        routes: list[Any],
    ) -> list[Violation]:
        """Evaluate the rule against a design.

        Args:
            design: The ``QuantumDesign`` instance (or compatible mapping)
                containing qubits, resonators, couplers, chip, and feedline
                metadata.
            geometry: Mapping of component names to their geometry dicts.
                Each geometry dict is expected to contain at least
                ``position_mm`` (tuple), ``bounding_box_mm``
                ((min_x, min_y, max_x, max_y)), and component-specific
                parameters such as ``trace_width_um``, ``gap_um``, etc.
            routes: List of route dicts, each with ``name``, ``points_mm``
                (list of (x, y) tuples), ``trace_width_um``, ``gap_um``,
                ``source``, and ``target`` keys.

        Returns:
            List of :class:`Violation` objects (empty if the rule passes).
        """
        ...


# ── Helper Utilities ────────────────────────────────────────────────────────


def _bounding_boxes_overlap(
    a: tuple[float, float, float, float],
    b: tuple[float, float, float, float],
) -> bool:
    """Return *True* if two axis-aligned bounding boxes overlap.

    Each bbox is ``(min_x, min_y, max_x, max_y)`` in mm.
    """
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


def _bbox_center(bbox: tuple[float, float, float, float]) -> tuple[float, float]:
    """Return the centre ``(x, y)`` of a bounding box in mm."""
    return ((bbox[0] + bbox[2]) / 2.0, (bbox[1] + bbox[3]) / 2.0)


def _distance(p1: tuple[float, float], p2: tuple[float, float]) -> float:
    """Euclidean distance between two 2-D points."""
    return math.hypot(p2[0] - p1[0], p2[1] - p1[1])


def _min_segment_distance(
    seg_a: tuple[tuple[float, float], tuple[float, float]],
    seg_b: tuple[tuple[float, float], tuple[float, float]],
) -> float:
    """Approximate minimum distance between two line segments.

    Uses a simple sampling approach: checks endpoints of each segment
    against the other segment and the point-to-segment distance at a
    few internal sample points.  This is accurate enough for DRC purposes
    without pulling in a full computational-geometry library.
    """

    def _point_to_segment_dist(
        p: tuple[float, float],
        a: tuple[float, float],
        b: tuple[float, float],
    ) -> float:
        abx, aby = b[0] - a[0], b[1] - a[1]
        apx, apy = p[0] - a[0], p[1] - a[1]
        ab_sq = abx * abx + aby * aby
        if ab_sq < 1e-30:
            return _distance(p, a)
        t = max(0.0, min(1.0, (apx * abx + apy * aby) / ab_sq))
        proj = (a[0] + t * abx, a[1] + t * aby)
        return _distance(p, proj)

    dists: list[float] = [
        _point_to_segment_dist(seg_a[0], seg_b[0], seg_b[1]),
        _point_to_segment_dist(seg_a[1], seg_b[0], seg_b[1]),
        _point_to_segment_dist(seg_b[0], seg_a[0], seg_a[1]),
        _point_to_segment_dist(seg_b[1], seg_a[0], seg_a[1]),
    ]
    return min(dists)


def _segments_intersect(
    p1: tuple[float, float],
    p2: tuple[float, float],
    p3: tuple[float, float],
    p4: tuple[float, float],
) -> bool:
    """Return *True* if line segments (p1-p2) and (p3-p4) cross each other.

    Uses the standard cross-product orientation test.
    """

    def _cross(o: tuple[float, float], a: tuple[float, float], b: tuple[float, float]) -> float:
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    d1 = _cross(p3, p4, p1)
    d2 = _cross(p3, p4, p2)
    d3 = _cross(p1, p2, p3)
    d4 = _cross(p1, p2, p4)

    if ((d1 > 0 and d2 < 0) or (d1 < 0 and d2 > 0)) and (
        (d3 > 0 and d4 < 0) or (d3 < 0 and d4 > 0)
    ):
        return True

    # Collinear-overlap cases (simplified: treat as non-intersecting for DRC)
    return False


def _get_attr_safe(obj: Any, attr: str, default: Any = None) -> Any:
    """Retrieve an attribute from an object or a key from a dict."""
    if isinstance(obj, dict):
        return obj.get(attr, default)
    return getattr(obj, attr, default)


# ── Concrete DRC Rules ──────────────────────────────────────────────────────


class MinTraceWidthRule(DRCRule):
    """Checks that all CPW traces meet the minimum trace width.

    Attributes:
        name: ``'min_trace_width'``
        min_trace_width_um: Minimum allowed CPW centre-trace width in μm.
    """

    name: str = "min_trace_width"
    description: str = "All CPW trace widths must meet the minimum fabrication limit."
    severity: Severity = Severity.ERROR

    def __init__(self, constraints: FabricationDefaults | None = None) -> None:
        self.min_trace_width_um: float = (
            constraints.min_trace_width_um if constraints else 10.0
        )

    def check(
        self,
        design: Any,
        geometry: dict[str, Any],
        routes: list[Any],
    ) -> list[Violation]:
        """Validate CPW trace widths in geometry and routes.

        Args:
            design: Quantum design object (unused by this rule).
            geometry: Component geometry mapping.
            routes: List of route dicts.

        Returns:
            Violations for any trace thinner than the minimum.
        """
        violations: list[Violation] = []

        # Check component geometries
        for comp_name, geom in geometry.items():
            tw = _get_attr_safe(geom, "trace_width_um")
            if tw is not None and tw < self.min_trace_width_um:
                violations.append(
                    Violation(
                        rule_name=self.name,
                        severity=self.severity,
                        component=comp_name,
                        message=(
                            f"Trace width {tw:.2f} μm is below minimum "
                            f"{self.min_trace_width_um:.2f} μm."
                        ),
                        suggestion=f"Increase trace width to at least {self.min_trace_width_um:.2f} μm.",
                        location_mm=_get_attr_safe(geom, "position_mm"),
                    )
                )

        # Check routes
        for route in routes:
            r_name = _get_attr_safe(route, "name", "unknown_route")
            tw = _get_attr_safe(route, "trace_width_um")
            if tw is not None and tw < self.min_trace_width_um:
                violations.append(
                    Violation(
                        rule_name=self.name,
                        severity=self.severity,
                        component=r_name,
                        message=(
                            f"Route trace width {tw:.2f} μm is below minimum "
                            f"{self.min_trace_width_um:.2f} μm."
                        ),
                        suggestion=f"Increase route trace width to at least {self.min_trace_width_um:.2f} μm.",
                    )
                )

        return violations


class MinGapRule(DRCRule):
    """Checks that all CPW gaps meet the minimum gap width.

    Attributes:
        name: ``'min_gap'``
        min_gap_um: Minimum allowed CPW gap width in μm.
    """

    name: str = "min_gap"
    description: str = "All CPW gaps must meet the minimum fabrication limit."
    severity: Severity = Severity.ERROR

    def __init__(self, constraints: FabricationDefaults | None = None) -> None:
        self.min_gap_um: float = constraints.min_gap_um if constraints else 6.0

    def check(
        self,
        design: Any,
        geometry: dict[str, Any],
        routes: list[Any],
    ) -> list[Violation]:
        """Validate CPW gap widths in geometry and routes.

        Args:
            design: Quantum design object (unused by this rule).
            geometry: Component geometry mapping.
            routes: List of route dicts.

        Returns:
            Violations for any gap narrower than the minimum.
        """
        violations: list[Violation] = []

        for comp_name, geom in geometry.items():
            gap = _get_attr_safe(geom, "gap_um")
            if gap is not None and gap < self.min_gap_um:
                violations.append(
                    Violation(
                        rule_name=self.name,
                        severity=self.severity,
                        component=comp_name,
                        message=(
                            f"Gap width {gap:.2f} μm is below minimum "
                            f"{self.min_gap_um:.2f} μm."
                        ),
                        suggestion=f"Increase gap width to at least {self.min_gap_um:.2f} μm.",
                        location_mm=_get_attr_safe(geom, "position_mm"),
                    )
                )

        for route in routes:
            r_name = _get_attr_safe(route, "name", "unknown_route")
            gap = _get_attr_safe(route, "gap_um")
            if gap is not None and gap < self.min_gap_um:
                violations.append(
                    Violation(
                        rule_name=self.name,
                        severity=self.severity,
                        component=r_name,
                        message=(
                            f"Route gap width {gap:.2f} μm is below minimum "
                            f"{self.min_gap_um:.2f} μm."
                        ),
                        suggestion=f"Increase route gap to at least {self.min_gap_um:.2f} μm.",
                    )
                )

        return violations


class MinSpacingRule(DRCRule):
    """Checks minimum spacing between components.

    Ensures no two components are placed closer together than the fabrication
    minimum spacing (default 50 μm).

    Attributes:
        name: ``'min_spacing'``
        min_spacing_mm: Minimum centre-to-centre spacing in mm.
    """

    name: str = "min_spacing"
    description: str = "Minimum spacing between components must be maintained."
    severity: Severity = Severity.ERROR

    def __init__(self, constraints: FabricationDefaults | None = None) -> None:
        min_spacing_um = constraints.min_spacing_um if constraints else 50.0
        self.min_spacing_mm: float = um_to_mm(min_spacing_um)

    def check(
        self,
        design: Any,
        geometry: dict[str, Any],
        routes: list[Any],
    ) -> list[Violation]:
        """Validate pairwise spacing between components.

        Args:
            design: Quantum design object (unused by this rule).
            geometry: Component geometry mapping.
            routes: List of route dicts (unused by this rule).

        Returns:
            Violations for any pair of components closer than minimum spacing.
        """
        violations: list[Violation] = []

        # Collect bounding boxes
        comps: list[tuple[str, tuple[float, float, float, float]]] = []
        for comp_name, geom in geometry.items():
            bbox = _get_attr_safe(geom, "bounding_box_mm")
            if bbox is not None:
                comps.append((comp_name, tuple(bbox)))  # type: ignore[arg-type]

        for i in range(len(comps)):
            for j in range(i + 1, len(comps)):
                name_a, bbox_a = comps[i]
                name_b, bbox_b = comps[j]

                # Compute minimum edge-to-edge distance between two AABBs
                dx = max(0.0, max(bbox_a[0] - bbox_b[2], bbox_b[0] - bbox_a[2]))
                dy = max(0.0, max(bbox_a[1] - bbox_b[3], bbox_b[1] - bbox_a[3]))
                edge_dist_mm = math.hypot(dx, dy)

                if edge_dist_mm < self.min_spacing_mm:
                    violations.append(
                        Violation(
                            rule_name=self.name,
                            severity=self.severity,
                            component=f"{name_a} <-> {name_b}",
                            message=(
                                f"Edge-to-edge spacing {edge_dist_mm * 1e3:.1f} μm "
                                f"is below minimum {self.min_spacing_mm * 1e3:.1f} μm."
                            ),
                            suggestion="Increase the distance between these components.",
                        )
                    )

        return violations


class BoundaryRule(DRCRule):
    """Checks that all components lie within chip boundaries.

    A configurable margin (from ``ground_plane_margin_um``) is subtracted from
    each edge of the chip to define the safe region.

    Attributes:
        name: ``'boundary'``
        margin_mm: Required margin from chip edge in mm.
    """

    name: str = "boundary"
    description: str = "All components must be within chip boundaries (with margin)."
    severity: Severity = Severity.ERROR

    def __init__(self, constraints: FabricationDefaults | None = None) -> None:
        margin_um = constraints.ground_plane_margin_um if constraints else 200.0
        self.margin_mm: float = um_to_mm(margin_um)

    def check(
        self,
        design: Any,
        geometry: dict[str, Any],
        routes: list[Any],
    ) -> list[Violation]:
        """Validate that every component fits inside the chip area.

        Args:
            design: Quantum design with ``chip`` containing ``width_mm``
                and ``height_mm``.
            geometry: Component geometry mapping with ``bounding_box_mm``.
            routes: Route dicts with ``points_mm``.

        Returns:
            Violations for any element outside the chip boundary.
        """
        violations: list[Violation] = []

        # Determine chip extents
        chip = _get_attr_safe(design, "chip")
        if chip is None:
            logger.warning("BoundaryRule: design has no 'chip' attribute; skipping.")
            return violations

        chip_w = _get_attr_safe(chip, "width_mm", 10.0)
        chip_h = _get_attr_safe(chip, "height_mm", 10.0)

        # Safe region (centred at origin)
        half_w = chip_w / 2.0 - self.margin_mm
        half_h = chip_h / 2.0 - self.margin_mm

        for comp_name, geom in geometry.items():
            bbox = _get_attr_safe(geom, "bounding_box_mm")
            if bbox is None:
                continue
            min_x, min_y, max_x, max_y = bbox
            if min_x < -half_w or max_x > half_w or min_y < -half_h or max_y > half_h:
                violations.append(
                    Violation(
                        rule_name=self.name,
                        severity=self.severity,
                        component=comp_name,
                        message=(
                            f"Component extends beyond chip boundary "
                            f"(safe region ±{half_w:.3f} mm × ±{half_h:.3f} mm). "
                            f"Bounding box: ({min_x:.3f}, {min_y:.3f}) – "
                            f"({max_x:.3f}, {max_y:.3f})."
                        ),
                        suggestion="Move the component inside the chip boundary or increase chip size.",
                        location_mm=_bbox_center(bbox),
                    )
                )

        # Check route points
        for route in routes:
            r_name = _get_attr_safe(route, "name", "unknown_route")
            points = _get_attr_safe(route, "points_mm", [])
            for px, py in points:
                if px < -half_w or px > half_w or py < -half_h or py > half_h:
                    violations.append(
                        Violation(
                            rule_name=self.name,
                            severity=self.severity,
                            component=r_name,
                            message=(
                                f"Route point ({px:.3f}, {py:.3f}) mm extends "
                                f"beyond chip boundary."
                            ),
                            suggestion="Re-route to stay within chip boundaries.",
                            location_mm=(px, py),
                        )
                    )
                    break  # one violation per route is sufficient

        return violations


class OverlapRule(DRCRule):
    """Checks that no two components' bounding boxes overlap.

    Attributes:
        name: ``'overlap'``
    """

    name: str = "overlap"
    description: str = "No two component bounding boxes may overlap."
    severity: Severity = Severity.ERROR

    def __init__(self, constraints: FabricationDefaults | None = None) -> None:
        # No constraint-specific parameters needed.
        pass

    def check(
        self,
        design: Any,
        geometry: dict[str, Any],
        routes: list[Any],
    ) -> list[Violation]:
        """Validate that no two component bounding boxes overlap.

        Args:
            design: Quantum design object (unused by this rule).
            geometry: Component geometry mapping with ``bounding_box_mm``.
            routes: Route dicts (unused by this rule).

        Returns:
            Violations for any overlapping component pair.
        """
        violations: list[Violation] = []

        comps: list[tuple[str, tuple[float, float, float, float]]] = []
        for comp_name, geom in geometry.items():
            bbox = _get_attr_safe(geom, "bounding_box_mm")
            if bbox is not None:
                comps.append((comp_name, tuple(bbox)))  # type: ignore[arg-type]

        for i in range(len(comps)):
            for j in range(i + 1, len(comps)):
                name_a, bbox_a = comps[i]
                name_b, bbox_b = comps[j]
                if _bounding_boxes_overlap(bbox_a, bbox_b):
                    violations.append(
                        Violation(
                            rule_name=self.name,
                            severity=self.severity,
                            component=f"{name_a} <-> {name_b}",
                            message=(
                                f"Bounding boxes of '{name_a}' and '{name_b}' overlap."
                            ),
                            suggestion="Move components apart to eliminate overlap.",
                        )
                    )

        return violations


class ResonatorCollisionRule(DRCRule):
    """Checks that no resonator paths cross each other.

    Resonator paths are extracted from the geometry dict; each resonator is
    expected to have a ``path_mm`` key containing a list of ``(x, y)`` points.

    Attributes:
        name: ``'resonator_collision'``
    """

    name: str = "resonator_collision"
    description: str = "No resonator paths may cross each other."
    severity: Severity = Severity.ERROR

    def __init__(self, constraints: FabricationDefaults | None = None) -> None:
        pass

    def check(
        self,
        design: Any,
        geometry: dict[str, Any],
        routes: list[Any],
    ) -> list[Violation]:
        """Validate that resonator paths do not intersect.

        Args:
            design: Quantum design object (unused by this rule).
            geometry: Component geometry mapping; resonator components
                should contain a ``path_mm`` list of (x, y) points.
            routes: Route dicts (unused by this rule).

        Returns:
            Violations for any pair of crossing resonator paths.
        """
        violations: list[Violation] = []

        # Collect resonator paths
        resonators: list[tuple[str, list[tuple[float, float]]]] = []
        for comp_name, geom in geometry.items():
            comp_type = _get_attr_safe(geom, "component_type", "")
            if "resonator" in str(comp_type).lower() or "resonator" in comp_name.lower():
                path = _get_attr_safe(geom, "path_mm", [])
                if path and len(path) >= 2:
                    resonators.append((comp_name, path))

        for i in range(len(resonators)):
            for j in range(i + 1, len(resonators)):
                name_a, path_a = resonators[i]
                name_b, path_b = resonators[j]
                if self._paths_cross(path_a, path_b):
                    violations.append(
                        Violation(
                            rule_name=self.name,
                            severity=self.severity,
                            component=f"{name_a} <-> {name_b}",
                            message=(
                                f"Resonator paths of '{name_a}' and '{name_b}' "
                                f"intersect."
                            ),
                            suggestion="Adjust resonator lengths or routing to avoid crossing.",
                        )
                    )

        return violations

    @staticmethod
    def _paths_cross(
        path_a: list[tuple[float, float]],
        path_b: list[tuple[float, float]],
    ) -> bool:
        """Return *True* if any segments of *path_a* and *path_b* intersect."""
        for ia in range(len(path_a) - 1):
            for ib in range(len(path_b) - 1):
                if _segments_intersect(path_a[ia], path_a[ia + 1], path_b[ib], path_b[ib + 1]):
                    return True
        return False


class CouplerProximityRule(DRCRule):
    """Checks that couplers are positioned between their source/target qubits.

    Each coupler in the design specifies ``qubit_a`` and ``qubit_b``.  This
    rule verifies that the coupler's position is geometrically between those
    qubits and within a reasonable distance.

    Attributes:
        name: ``'coupler_proximity'``
        max_deviation_factor: Maximum ratio of coupler distance from the
            midpoint to the qubit-qubit distance (default 0.6).
    """

    name: str = "coupler_proximity"
    description: str = (
        "Couplers must be positioned between their source and target qubits "
        "and within a reasonable distance."
    )
    severity: Severity = Severity.ERROR

    def __init__(self, constraints: FabricationDefaults | None = None) -> None:
        self.max_deviation_factor: float = 0.6

    def check(
        self,
        design: Any,
        geometry: dict[str, Any],
        routes: list[Any],
    ) -> list[Violation]:
        """Validate coupler placement relative to its paired qubits.

        Args:
            design: Quantum design object with ``couplers`` and ``qubits``
                attributes (or keys).
            geometry: Component geometry mapping with ``position_mm``.
            routes: Route dicts (unused by this rule).

        Returns:
            Violations for improperly positioned couplers.
        """
        violations: list[Violation] = []

        couplers = _get_attr_safe(design, "couplers", [])
        if not couplers:
            return violations

        for coupler in couplers:
            coupler_name = _get_attr_safe(coupler, "name", "unknown_coupler")
            qubit_a_name = _get_attr_safe(coupler, "qubit_a", None)
            qubit_b_name = _get_attr_safe(coupler, "qubit_b", None)

            if qubit_a_name is None or qubit_b_name is None:
                violations.append(
                    Violation(
                        rule_name=self.name,
                        severity=self.severity,
                        component=coupler_name,
                        message="Coupler is missing qubit_a or qubit_b reference.",
                        suggestion="Ensure both qubit references are set on the coupler.",
                    )
                )
                continue

            coupler_geom = geometry.get(coupler_name)
            qa_geom = geometry.get(str(qubit_a_name))
            qb_geom = geometry.get(str(qubit_b_name))

            if coupler_geom is None or qa_geom is None or qb_geom is None:
                continue  # geometry not available; skip silently

            pos_c = _get_attr_safe(coupler_geom, "position_mm")
            pos_a = _get_attr_safe(qa_geom, "position_mm")
            pos_b = _get_attr_safe(qb_geom, "position_mm")

            if pos_c is None or pos_a is None or pos_b is None:
                continue

            midpoint = ((pos_a[0] + pos_b[0]) / 2.0, (pos_a[1] + pos_b[1]) / 2.0)
            qubit_dist = _distance(pos_a, pos_b)
            if qubit_dist < 1e-9:
                continue  # qubits at the same point; nothing to check

            coupler_to_mid = _distance(pos_c, midpoint)

            if coupler_to_mid > self.max_deviation_factor * qubit_dist:
                violations.append(
                    Violation(
                        rule_name=self.name,
                        severity=self.severity,
                        component=coupler_name,
                        message=(
                            f"Coupler '{coupler_name}' is {coupler_to_mid:.3f} mm "
                            f"from the midpoint of its qubits "
                            f"(max {self.max_deviation_factor * qubit_dist:.3f} mm)."
                        ),
                        suggestion=(
                            "Reposition the coupler closer to the midpoint of its "
                            "source and target qubits."
                        ),
                        location_mm=pos_c,
                    )
                )

        return violations


class RouteConflictRule(DRCRule):
    """Checks that no routes cross or come too close to each other.

    Attributes:
        name: ``'route_conflict'``
        min_route_spacing_mm: Minimum edge-to-edge clearance between routes
            in mm.
    """

    name: str = "route_conflict"
    description: str = "No routes may cross or have insufficient spacing."
    severity: Severity = Severity.ERROR

    def __init__(self, constraints: FabricationDefaults | None = None) -> None:
        min_spacing_um = constraints.min_spacing_um if constraints else 50.0
        self.min_route_spacing_mm: float = um_to_mm(min_spacing_um)

    def check(
        self,
        design: Any,
        geometry: dict[str, Any],
        routes: list[Any],
    ) -> list[Violation]:
        """Validate that routes don't cross or approach too closely.

        Args:
            design: Quantum design object (unused by this rule).
            geometry: Component geometry mapping (unused by this rule).
            routes: List of route dicts with ``name`` and ``points_mm``.

        Returns:
            Violations for crossing or too-close routes.
        """
        violations: list[Violation] = []

        parsed_routes: list[tuple[str, list[tuple[float, float]]]] = []
        for route in routes:
            r_name = _get_attr_safe(route, "name", "unknown_route")
            points = _get_attr_safe(route, "points_mm", [])
            if points and len(points) >= 2:
                parsed_routes.append((r_name, points))

        for i in range(len(parsed_routes)):
            for j in range(i + 1, len(parsed_routes)):
                name_a, pts_a = parsed_routes[i]
                name_b, pts_b = parsed_routes[j]

                crossing_found = False
                too_close_found = False

                for ia in range(len(pts_a) - 1):
                    for ib in range(len(pts_b) - 1):
                        seg_a = (pts_a[ia], pts_a[ia + 1])
                        seg_b = (pts_b[ib], pts_b[ib + 1])

                        if _segments_intersect(seg_a[0], seg_a[1], seg_b[0], seg_b[1]):
                            crossing_found = True

                        seg_dist = _min_segment_distance(seg_a, seg_b)
                        if seg_dist < self.min_route_spacing_mm:
                            too_close_found = True

                    if crossing_found and too_close_found:
                        break

                if crossing_found:
                    violations.append(
                        Violation(
                            rule_name=self.name,
                            severity=self.severity,
                            component=f"{name_a} <-> {name_b}",
                            message=f"Routes '{name_a}' and '{name_b}' cross each other.",
                            suggestion="Re-route to avoid crossing.",
                        )
                    )
                elif too_close_found:
                    violations.append(
                        Violation(
                            rule_name=self.name,
                            severity=self.severity,
                            component=f"{name_a} <-> {name_b}",
                            message=(
                                f"Routes '{name_a}' and '{name_b}' are closer than "
                                f"the minimum spacing of {self.min_route_spacing_mm * 1e3:.1f} μm."
                            ),
                            suggestion="Increase spacing between routes.",
                        )
                    )

        return violations


class FrequencyCollisionRule(DRCRule):
    """Checks that no two resonators on the same feedline have frequencies
    too close together (< 100 MHz apart by default).

    This is a WARNING-level rule because small frequency collisions can
    sometimes be tolerated but may cause readout crosstalk.

    Attributes:
        name: ``'frequency_collision'``
        min_separation_ghz: Minimum frequency separation between resonators
            on the same feedline in GHz.
    """

    name: str = "frequency_collision"
    description: str = (
        "Resonators on the same feedline must have sufficient frequency "
        "separation to avoid readout crosstalk."
    )
    severity: Severity = Severity.WARNING

    def __init__(
        self,
        constraints: FabricationDefaults | None = None,
        min_separation_mhz: float = 100.0,
    ) -> None:
        self.min_separation_ghz: float = min_separation_mhz * 1e-3  # to GHz

    def check(
        self,
        design: Any,
        geometry: dict[str, Any],
        routes: list[Any],
    ) -> list[Violation]:
        """Validate frequency separation of resonators on the same feedline.

        Args:
            design: Quantum design with ``resonators`` and optionally
                ``feedline`` attributes. Each resonator should have
                ``frequency_ghz`` and optionally ``feedline`` attributes.
            geometry: Component geometry mapping (unused by this rule).
            routes: Route dicts (unused by this rule).

        Returns:
            Violations for resonator pairs with insufficient frequency
            separation.
        """
        violations: list[Violation] = []

        resonators = _get_attr_safe(design, "resonators", [])
        if not resonators or len(resonators) < 2:
            return violations

        # Group resonators by feedline
        feedline_groups: dict[str, list[Any]] = {}
        for res in resonators:
            fl = str(_get_attr_safe(res, "feedline", "default"))
            feedline_groups.setdefault(fl, []).append(res)

        for fl_name, fl_resonators in feedline_groups.items():
            for i in range(len(fl_resonators)):
                for j in range(i + 1, len(fl_resonators)):
                    res_a = fl_resonators[i]
                    res_b = fl_resonators[j]
                    freq_a = _get_attr_safe(res_a, "frequency_ghz")
                    freq_b = _get_attr_safe(res_b, "frequency_ghz")

                    if freq_a is None or freq_b is None:
                        continue

                    separation = abs(freq_a - freq_b)
                    if separation < self.min_separation_ghz:
                        name_a = _get_attr_safe(res_a, "name", "resonator_?")
                        name_b = _get_attr_safe(res_b, "name", "resonator_?")
                        violations.append(
                            Violation(
                                rule_name=self.name,
                                severity=self.severity,
                                component=f"{name_a} <-> {name_b}",
                                message=(
                                    f"Resonators '{name_a}' ({freq_a:.4f} GHz) and "
                                    f"'{name_b}' ({freq_b:.4f} GHz) on feedline "
                                    f"'{fl_name}' are only {separation * 1e3:.1f} MHz "
                                    f"apart (minimum {self.min_separation_ghz * 1e3:.0f} MHz)."
                                ),
                                suggestion="Adjust resonator lengths to increase frequency separation.",
                            )
                        )

        return violations


class DesignSizeRule(DRCRule):
    """Checks that the chip does not exceed maximum dimensions (20 mm × 20 mm).

    Attributes:
        name: ``'design_size'``
        max_width_mm: Maximum chip width in mm.
        max_height_mm: Maximum chip height in mm.
    """

    name: str = "design_size"
    description: str = "Chip dimensions must not exceed maximum size (20 mm × 20 mm)."
    severity: Severity = Severity.ERROR

    def __init__(
        self,
        constraints: FabricationDefaults | None = None,
        max_width_mm: float = 20.0,
        max_height_mm: float = 20.0,
    ) -> None:
        self.max_width_mm: float = max_width_mm
        self.max_height_mm: float = max_height_mm

    def check(
        self,
        design: Any,
        geometry: dict[str, Any],
        routes: list[Any],
    ) -> list[Violation]:
        """Validate chip dimensions against maximum allowed size.

        Args:
            design: Quantum design with ``chip`` containing ``width_mm``
                and ``height_mm``.
            geometry: Component geometry mapping (unused by this rule).
            routes: Route dicts (unused by this rule).

        Returns:
            Violations if the chip exceeds maximum dimensions.
        """
        violations: list[Violation] = []

        chip = _get_attr_safe(design, "chip")
        if chip is None:
            logger.warning("DesignSizeRule: design has no 'chip' attribute; skipping.")
            return violations

        chip_w = _get_attr_safe(chip, "width_mm", 0.0)
        chip_h = _get_attr_safe(chip, "height_mm", 0.0)

        if chip_w > self.max_width_mm:
            violations.append(
                Violation(
                    rule_name=self.name,
                    severity=self.severity,
                    component="global",
                    message=(
                        f"Chip width {chip_w:.2f} mm exceeds maximum "
                        f"{self.max_width_mm:.2f} mm."
                    ),
                    suggestion=f"Reduce chip width to at most {self.max_width_mm:.2f} mm.",
                )
            )

        if chip_h > self.max_height_mm:
            violations.append(
                Violation(
                    rule_name=self.name,
                    severity=self.severity,
                    component="global",
                    message=(
                        f"Chip height {chip_h:.2f} mm exceeds maximum "
                        f"{self.max_height_mm:.2f} mm."
                    ),
                    suggestion=f"Reduce chip height to at most {self.max_height_mm:.2f} mm.",
                )
            )

        return violations


# ── Convenience: list of all rule classes ────────────────────────────────────

ALL_RULE_CLASSES: list[type[DRCRule]] = [
    MinTraceWidthRule,
    MinGapRule,
    MinSpacingRule,
    BoundaryRule,
    OverlapRule,
    ResonatorCollisionRule,
    CouplerProximityRule,
    RouteConflictRule,
    FrequencyCollisionRule,
    DesignSizeRule,
]
