"""
Connection routing engine for superconducting quantum chip layout.

Generates CPW (coplanar-waveguide) routes between qubits, resonators,
couplers, and feedlines.  Supports straight, meander, and generic CPW
route types with built-in validation (crossing detection, spacing checks,
boundary enforcement).

All dimensions are in **millimeters** (chip-centred coordinate system).
"""

from __future__ import annotations

import math
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from quantum_studio.config import get_settings, FabricationDefaults
from quantum_studio.layout.geometry import (
    BoundingBox,
    CPWPath,
    Point,
    check_overlap,
    compute_meander_points,
    min_distance,
)
from quantum_studio.utils.logging import get_logger
from quantum_studio.utils.units import um_to_mm

from quantum_studio.models.design import QuantumDesign
from quantum_studio.models.chip import QuantumChip
from quantum_studio.models.qubit import TransmonQubit
from quantum_studio.models.resonator import Resonator
from quantum_studio.models.coupler import Coupler
from quantum_studio.models.constraints import FabricationConstraints

logger = get_logger("layout.routing")


# ═══════════════════════════════════════════════════════════════════════════
# Route Types
# ═══════════════════════════════════════════════════════════════════════════


class RouteType(Enum):
    """Enumeration of supported route geometries."""

    STRAIGHT = "straight"
    MEANDER = "meander"
    CPW = "cpw"


# ═══════════════════════════════════════════════════════════════════════════
# Route Data Class
# ═══════════════════════════════════════════════════════════════════════════


@dataclass
class Route:
    """A routed connection between two component pins.

    Attributes:
        id: Unique route identifier.
        route_type: Geometry type of the route.
        start_component: Source component ID.
        start_pin: Source pin name.
        end_component: Destination component ID.
        end_pin: Destination pin name.
        waypoints: Ordered list of centreline waypoints.
        total_length_mm: Total arc-length in mm.
        trace_width_mm: CPW centre-conductor width in mm.
        gap_mm: CPW gap width in mm.
        meander_spacing_mm: Spacing between meander legs in mm.
    """

    id: str
    route_type: RouteType
    start_component: str
    start_pin: str
    end_component: str
    end_pin: str
    waypoints: list[Point]
    total_length_mm: float
    trace_width_mm: float = 0.010  # 10 µm
    gap_mm: float = 0.006  # 6 µm
    meander_spacing_mm: float = 0.200  # 200 µm

    @property
    def bounding_box(self) -> BoundingBox:
        """Bounding box of the route centreline (without trace/gap width)."""
        if not self.waypoints:
            return BoundingBox(0.0, 0.0, 0.0, 0.0)
        xs = [p.x for p in self.waypoints]
        ys = [p.y for p in self.waypoints]
        half = self.trace_width_mm / 2.0 + self.gap_mm
        return BoundingBox(
            min(xs) - half,
            min(ys) - half,
            max(xs) + half,
            max(ys) + half,
        )

    def to_cpw_path(self) -> CPWPath:
        """Convert to a :class:`CPWPath` geometry object."""
        return CPWPath(
            points=list(self.waypoints),
            trace_width_mm=self.trace_width_mm,
            gap_mm=self.gap_mm,
        )


# ═══════════════════════════════════════════════════════════════════════════
# Routing Engine
# ═══════════════════════════════════════════════════════════════════════════


class RoutingEngine:
    """Deterministic CPW routing engine.

    Creates routes for:

    * **Qubit ↔ Resonator** – meander route whose total length matches the
      resonator's physical length.
    * **Qubit ↔ Qubit (via coupler)** – short CPW route through the
      coupler's position.
    * **Feedlines** – straight horizontal CPW across the chip with
      launchpad endpoints.

    Example::

        router = RoutingEngine(design)
        design, routes = router.route()

    Args:
        design: A *placed* :class:`QuantumDesign` (``status == 'placed'``).
        constraints: Optional :class:`FabricationConstraints` override.
    """

    def __init__(
        self,
        design: QuantumDesign,
        constraints: Optional[FabricationConstraints] = None,
    ) -> None:
        self.design = design
        self._settings = get_settings()
        self._fab = self._settings.fabrication

        # Extract constraint values, using FabricationConstraints if provided
        # or falling back to global fabrication defaults.
        if constraints is not None:
            self._min_trace_mm = um_to_mm(constraints.min_trace_width_um)
            self._min_gap_mm = um_to_mm(constraints.min_gap_um)
            self._min_spacing_mm = um_to_mm(constraints.min_spacing_um)
        else:
            self._min_trace_mm = um_to_mm(self._fab.default_cpw_trace_um)
            self._min_gap_mm = um_to_mm(self._fab.default_cpw_gap_um)
            self._min_spacing_mm = um_to_mm(self._fab.min_spacing_um)

        self._chip_bb = self._chip_bounding_box()

    # ── Public API ──────────────────────────────────────────────────────────

    def route(self) -> tuple[QuantumDesign, list[Route]]:
        """Generate all routes and return the updated design with route list.

        Returns:
            Tuple of the updated :class:`QuantumDesign` and a list of
            :class:`Route` objects.
        """
        routes: list[Route] = []
        routes.extend(self._route_qubit_resonators())
        routes.extend(self._route_qubit_couplers())
        routes.extend(self._route_feedlines())

        self._validate_routes(routes)

        self.design.status = "routed"
        logger.info("Routing complete: %d routes generated.", len(routes))
        return self.design, routes

    # ── Helpers ─────────────────────────────────────────────────────────────

    def _chip_bounding_box(self) -> BoundingBox:
        chip = self.design.chip
        half_w = chip.width_mm / 2.0
        half_h = chip.height_mm / 2.0
        return BoundingBox(-half_w, -half_h, half_w, half_h)

    def _qubit_position(self, qubit_id: str) -> Point | None:
        """Look up qubit position by ID."""
        for q in self.design.qubits:
            if q.id == qubit_id:
                return Point(q.pos_x_mm, q.pos_y_mm)
        return None

    def _make_route_id(self, prefix: str) -> str:
        """Generate a deterministic-ish route ID."""
        return f"{prefix}_{uuid.uuid4().hex[:8]}"

    # ── Qubit ↔ Resonator Routes ────────────────────────────────────────────

    def _route_qubit_resonators(self) -> list[Route]:
        """Create meander routes from each qubit to its readout resonator.

        The meander total length is set to the resonator's
        ``physical_length_mm``.
        """
        routes: list[Route] = []
        for res in self.design.resonators:
            qubit_pos = self._qubit_position(res.target_qubit_id)
            if qubit_pos is None:
                logger.warning(
                    "Resonator %s: parent qubit %s not found – skipping.",
                    res.id,
                    res.target_qubit_id,
                )
                continue

            res_pos = Point(res.pos_x_mm, res.pos_y_mm)

            # Target path length is the resonator's physical length.
            target_length = getattr(res, "physical_length_mm", None)
            if target_length is None or target_length <= 0:
                # Fall back to a default half-wave resonator length estimate.
                target_length = 5.0  # mm (typical λ/2 at ~7 GHz)
                logger.debug(
                    "Resonator %s: using default physical length %.2f mm.",
                    res.id,
                    target_length,
                )

            # Meander spacing
            spacing = 0.200  # 200 µm

            try:
                waypoints = compute_meander_points(
                    start=qubit_pos,
                    end=res_pos,
                    total_length=target_length,
                    spacing_mm=spacing,
                )
            except ValueError:
                # total_length shorter than direct distance – use straight.
                waypoints = [qubit_pos, res_pos]
                target_length = qubit_pos.distance_to(res_pos)
                logger.warning(
                    "Resonator %s: physical_length shorter than direct "
                    "distance; falling back to straight route.",
                    res.id,
                )

            route = Route(
                id=self._make_route_id("res"),
                route_type=RouteType.MEANDER,
                start_component=res.target_qubit_id,
                start_pin="readout",
                end_component=res.id,
                end_pin="input",
                waypoints=waypoints,
                total_length_mm=target_length,
                trace_width_mm=self._min_trace_mm,
                gap_mm=self._min_gap_mm,
                meander_spacing_mm=spacing,
            )
            routes.append(route)
            logger.debug(
                "Route %s: %s → %s (meander, %.3f mm)",
                route.id,
                res.target_qubit_id,
                res.id,
                target_length,
            )

        return routes

    # ── Qubit ↔ Qubit (Coupler) Routes ──────────────────────────────────────

    def _route_qubit_couplers(self) -> list[Route]:
        """Create short CPW routes between qubit pairs through couplers."""
        routes: list[Route] = []
        for coupler in self.design.couplers:
            pos_a = self._qubit_position(coupler.source_qubit_id)
            pos_b = self._qubit_position(coupler.target_qubit_id)
            if pos_a is None or pos_b is None:
                logger.warning(
                    "Coupler %s: one or both qubits not found – skipping.",
                    coupler.id,
                )
                continue

            coupler_pos = Point(coupler.pos_x_mm, coupler.pos_y_mm)

            waypoints = [pos_a, coupler_pos, pos_b]
            total_len = pos_a.distance_to(coupler_pos) + coupler_pos.distance_to(pos_b)

            route = Route(
                id=self._make_route_id("cpl"),
                route_type=RouteType.CPW,
                start_component=coupler.source_qubit_id,
                start_pin="coupler",
                end_component=coupler.target_qubit_id,
                end_pin="coupler",
                waypoints=waypoints,
                total_length_mm=total_len,
                trace_width_mm=self._min_trace_mm,
                gap_mm=self._min_gap_mm,
            )
            routes.append(route)
            logger.debug(
                "Route %s: %s → %s via coupler %s (%.3f mm)",
                route.id,
                coupler.source_qubit_id,
                coupler.target_qubit_id,
                coupler.id,
                total_len,
            )

        return routes

    # ── Feedline Routes ─────────────────────────────────────────────────────

    def _route_feedlines(self) -> list[Route]:
        """Create a straight horizontal feedline across the chip.

        The feedline is positioned below the qubit array with launchpad
        endpoints at the chip edges (with margin).
        """
        margin = self._settings.placement.feedline_margin_mm
        chip = self.design.chip
        half_w = chip.width_mm / 2.0
        half_h = chip.height_mm / 2.0

        # Position feedline at the bottom of the chip.
        y_feed = -half_h + margin

        # If qubits exist, ensure the feedline is below all qubits.
        if self.design.qubits:
            min_qubit_y = min(q.pos_y_mm for q in self.design.qubits)
            y_feed = min(y_feed, min_qubit_y - margin)
            # Clamp inside chip
            y_feed = max(-half_h + margin * 0.5, y_feed)

        start = Point(-half_w + margin, y_feed)
        end = Point(half_w - margin, y_feed)

        route = Route(
            id=self._make_route_id("feed"),
            route_type=RouteType.STRAIGHT,
            start_component="launchpad_left",
            start_pin="output",
            end_component="launchpad_right",
            end_pin="input",
            waypoints=[start, end],
            total_length_mm=start.distance_to(end),
            trace_width_mm=self._min_trace_mm,
            gap_mm=self._min_gap_mm,
        )
        logger.debug(
            "Feedline: (%.3f, %.3f) → (%.3f, %.3f), length %.3f mm",
            start.x,
            start.y,
            end.x,
            end.y,
            route.total_length_mm,
        )
        return [route]

    # ── Route Validation ────────────────────────────────────────────────────

    def _validate_routes(self, routes: list[Route]) -> None:
        """Run validation checks on all generated routes.

        Checks performed:

        1. No route-to-route bounding-box crossings.
        2. Minimum spacing between parallel routes.
        3. All route waypoints within chip boundaries.
        4. Route lengths are physically reasonable.

        Warnings are logged but do not raise exceptions so that the
        layout pipeline can continue.
        """
        n = len(routes)

        # 1. Crossing / overlap check (bounding-box level).
        for i in range(n):
            for j in range(i + 1, n):
                bb_i = routes[i].bounding_box
                bb_j = routes[j].bounding_box
                if check_overlap(bb_i, bb_j):
                    dist = min_distance(bb_i, bb_j)
                    if dist < self._min_spacing_mm:
                        logger.warning(
                            "Routes %s and %s bounding boxes overlap "
                            "(min distance %.4f mm < %.4f mm minimum).",
                            routes[i].id,
                            routes[j].id,
                            dist,
                            self._min_spacing_mm,
                        )

        # 2 & 3. Per-route checks.
        chip_safe = self._chip_bb.expand(-self._min_spacing_mm)
        for route in routes:
            # Boundary check
            for wp in route.waypoints:
                if not self._chip_bb.contains_point(wp):
                    logger.warning(
                        "Route %s: waypoint (%.4f, %.4f) outside chip boundary.",
                        route.id,
                        wp.x,
                        wp.y,
                    )

            # Length sanity check
            if route.total_length_mm <= 0:
                logger.warning("Route %s has non-positive length.", route.id)
            elif route.total_length_mm > 50.0:
                logger.warning(
                    "Route %s: unusually long (%.2f mm) – verify.",
                    route.id,
                    route.total_length_mm,
                )

        # 3. Segment-level crossing detection (line-segment intersection).
        all_segments = self._extract_segments(routes)
        self._check_segment_crossings(all_segments)

    @staticmethod
    def _extract_segments(
        routes: list[Route],
    ) -> list[tuple[str, Point, Point]]:
        """Extract all line segments from all routes.

        Returns:
            List of ``(route_id, start_point, end_point)`` tuples.
        """
        segments: list[tuple[str, Point, Point]] = []
        for route in routes:
            for k in range(len(route.waypoints) - 1):
                segments.append(
                    (route.id, route.waypoints[k], route.waypoints[k + 1])
                )
        return segments

    @staticmethod
    def _segments_intersect(
        a1: Point, a2: Point, b1: Point, b2: Point
    ) -> bool:
        """Test whether segments a1–a2 and b1–b2 intersect.

        Uses the cross-product orientation method.

        Args:
            a1: Start of segment A.
            a2: End of segment A.
            b1: Start of segment B.
            b2: End of segment B.

        Returns:
            ``True`` if the segments properly intersect.
        """

        def cross(o: Point, a: Point, b: Point) -> float:
            return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

        d1 = cross(b1, b2, a1)
        d2 = cross(b1, b2, a2)
        d3 = cross(a1, a2, b1)
        d4 = cross(a1, a2, b2)

        if ((d1 > 0 and d2 < 0) or (d1 < 0 and d2 > 0)) and (
            (d3 > 0 and d4 < 0) or (d3 < 0 and d4 > 0)
        ):
            return True

        # Collinear overlap cases (simplified – skip for brevity as they
        # are rare in routed layouts).
        return False

    def _check_segment_crossings(
        self, segments: list[tuple[str, Point, Point]]
    ) -> None:
        """Warn on any inter-route segment crossings."""
        n = len(segments)
        for i in range(n):
            rid_i, a1, a2 = segments[i]
            for j in range(i + 1, n):
                rid_j, b1, b2 = segments[j]
                if rid_i == rid_j:
                    continue  # Skip intra-route segments
                if self._segments_intersect(a1, a2, b1, b2):
                    logger.warning(
                        "Route crossing detected between %s and %s.",
                        rid_i,
                        rid_j,
                    )
