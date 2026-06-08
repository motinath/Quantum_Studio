"""
Automatic component placement engine for superconducting quantum chips.

Positions qubits, readout resonators, and couplers on the chip surface
based on the desired connectivity graph.  Supports 1–5 transmon qubits
with topology-aware layout strategies (linear, star/cross, triangular,
grid, T-shape).

All coordinates follow the Qiskit Metal convention where the chip centre
is at (0, 0) and dimensions are in **millimeters**.
"""

from __future__ import annotations

import math
from collections import Counter
from typing import Optional

from quantum_studio.config import PlacementConfig, get_settings
from quantum_studio.layout.geometry import BoundingBox, Point
from quantum_studio.utils.logging import get_logger

# Late / conditional imports — model types are resolved at runtime to
# avoid circular-import issues while the models package is still growing.
from quantum_studio.models.design import QuantumDesign
from quantum_studio.models.chip import QuantumChip
from quantum_studio.models.qubit import TransmonQubit
from quantum_studio.models.resonator import Resonator
from quantum_studio.models.coupler import Coupler

logger = get_logger("layout.placement")


# ═══════════════════════════════════════════════════════════════════════════
# Placement Engine
# ═══════════════════════════════════════════════════════════════════════════


class PlacementEngine:
    """Deterministic placement engine for 1–5 transmon qubits.

    The engine analyses the coupler connectivity graph, selects an
    appropriate spatial topology, and assigns absolute (x, y) positions
    (in mm, chip-centred) to every component in the design.

    Example::

        engine = PlacementEngine(design)
        design = engine.place()
        assert design.status == 'placed'

    Args:
        design: The :class:`QuantumDesign` to lay out.
        settings: Optional :class:`PlacementConfig` override.  When
            ``None`` the global settings are used.
    """

    def __init__(
        self,
        design: QuantumDesign,
        settings: Optional[PlacementConfig] = None,
    ) -> None:
        self.design = design
        self.settings = settings or get_settings().placement
        self._chip_bb = self._chip_bounding_box()
        self._qubit_positions: dict[str, Point] = {}

    # ── Public API ──────────────────────────────────────────────────────────

    def place(self) -> QuantumDesign:
        """Place all components and return the updated design.

        Placement proceeds in three phases:

        1. **Qubits** – placed according to the detected topology.
        2. **Resonators** – anchored at their parent qubit and meandered
           outward toward the nearest chip edge.
        3. **Couplers** – centred on the midpoint between connected
           qubits.

        Returns:
            The same :class:`QuantumDesign` instance with updated
            position attributes and ``status == 'placed'``.

        Raises:
            ValueError: If the design has more qubits than
                :pyattr:`PlacementConfig.max_qubits`.
        """
        n_qubits = len(self.design.qubits)
        if n_qubits > self.settings.max_qubits:
            raise ValueError(
                f"PlacementEngine supports up to {self.settings.max_qubits} "
                f"qubits, but the design has {n_qubits}."
            )
        if n_qubits == 0:
            logger.warning("Design contains no qubits – nothing to place.")
            self.design.status = "placed"
            return self.design

        self._place_qubits()
        self._place_resonators()
        self._place_couplers()

        self.design.status = "placed"
        logger.info(
            "Placement complete: %d qubits, %d resonators, %d couplers.",
            len(self.design.qubits),
            len(self.design.resonators),
            len(self.design.couplers),
        )
        return self.design

    # ── Chip helpers ────────────────────────────────────────────────────────

    def _chip_bounding_box(self) -> BoundingBox:
        """Return the chip BoundingBox centred at the origin."""
        chip = self.design.chip
        half_w = chip.width_mm / 2.0
        half_h = chip.height_mm / 2.0
        return BoundingBox(-half_w, -half_h, half_w, half_h)

    def _chip_safe_box(self, margin_mm: float | None = None) -> BoundingBox:
        """Return a shrunk chip box that respects the edge margin."""
        margin = margin_mm if margin_mm is not None else self.settings.feedline_margin_mm
        return self._chip_bb.expand(-margin)

    # ── Qubit Placement ─────────────────────────────────────────────────────

    def _place_qubits(self) -> None:
        """Assign qubit positions based on the detected topology."""
        n = len(self.design.qubits)
        topology = self._detect_topology(n)
        positions = self._topology_positions(n, topology)

        safe = self._chip_safe_box()
        for i, qubit in enumerate(self.design.qubits):
            pos = positions[i]
            # Clamp to safe area
            pos = Point(
                max(safe.x_min, min(safe.x_max, pos.x)),
                max(safe.y_min, min(safe.y_max, pos.y)),
            )
            qubit.pos_x_mm = pos.x
            qubit.pos_y_mm = pos.y
            self._qubit_positions[qubit.id] = pos
            logger.debug("Qubit %s placed at (%.4f, %.4f) mm", qubit.id, pos.x, pos.y)

    # ── Topology Detection ──────────────────────────────────────────────────

    def _build_adjacency(self) -> dict[str, set[str]]:
        """Build an adjacency set from the coupler list."""
        adj: dict[str, set[str]] = {}
        for q in self.design.qubits:
            adj.setdefault(q.id, set())
        for c in self.design.couplers:
            adj.setdefault(c.source_qubit_id, set()).add(c.target_qubit_id)
            adj.setdefault(c.target_qubit_id, set()).add(c.source_qubit_id)
        return adj

    def _detect_topology(self, n: int) -> str:
        """Detect the best placement topology for the connectivity graph.

        Returns one of: ``'single'``, ``'linear'``, ``'triangle'``,
        ``'grid'``, ``'t_shape'``, ``'star'``, ``'cross'``.

        Args:
            n: Number of qubits.

        Returns:
            Topology identifier string.
        """
        if n == 1:
            return "single"
        if n == 2:
            return "linear"

        adj = self._build_adjacency()
        degrees = sorted((len(adj[qid]) for qid in adj), reverse=True)
        degree_counter = Counter(degrees)

        if n == 3:
            # All-to-all → triangle; otherwise linear
            if all(d >= 2 for d in degrees):
                return "triangle"
            return "linear"

        if n == 4:
            # 2×2 grid: all nodes degree 2 (ring) or degree-sequence [3,2,2,1]
            if degree_counter.get(2, 0) >= 3:
                return "grid"
            # T-shape: one node degree 3
            if max(degrees) == 3:
                return "t_shape"
            return "linear"

        if n == 5:
            # Star / IBM cross: one centre node degree 4 (or 3+)
            if max(degrees) >= 3:
                return "cross"
            return "linear"

        return "linear"  # fallback

    # ── Topology → Position Map ─────────────────────────────────────────────

    def _topology_positions(self, n: int, topology: str) -> list[Point]:
        """Compute absolute positions for each qubit index.

        Args:
            n: Number of qubits.
            topology: Topology identifier returned by
                :meth:`_detect_topology`.

        Returns:
            List of :class:`Point` objects, one per qubit, in the same
            order as ``self.design.qubits``.
        """
        s = self.settings.qubit_spacing_mm

        if topology == "single":
            return [Point(0.0, 0.0)]

        if topology == "linear":
            return self._linear_positions(n, s)

        if topology == "triangle":
            return self._triangle_positions(s)

        if topology == "grid":
            return self._grid_2x2_positions(s)

        if topology == "t_shape":
            return self._t_shape_positions(n, s)

        if topology in ("star", "cross"):
            return self._cross_positions(s)

        # Fallback
        return self._linear_positions(n, s)

    @staticmethod
    def _linear_positions(n: int, spacing: float) -> list[Point]:
        """Horizontal line centred on the origin.

        Args:
            n: Number of qubits.
            spacing: Distance between adjacent qubits in mm.

        Returns:
            List of qubit positions.
        """
        total_width = (n - 1) * spacing
        start_x = -total_width / 2.0
        return [Point(start_x + i * spacing, 0.0) for i in range(n)]

    @staticmethod
    def _triangle_positions(spacing: float) -> list[Point]:
        """Equilateral triangle centred on the origin.

        The bottom edge is horizontal.

        Args:
            spacing: Side length of the triangle in mm.

        Returns:
            Three qubit positions.
        """
        h = spacing * math.sqrt(3.0) / 2.0
        cy = -h / 3.0  # shift so centroid at origin
        return [
            Point(-spacing / 2.0, cy),
            Point(spacing / 2.0, cy),
            Point(0.0, cy + h),
        ]

    @staticmethod
    def _grid_2x2_positions(spacing: float) -> list[Point]:
        """2×2 grid centred on the origin.

        Args:
            spacing: Distance between adjacent grid nodes in mm.

        Returns:
            Four qubit positions (row-major: TL, TR, BL, BR).
        """
        half = spacing / 2.0
        return [
            Point(-half, half),
            Point(half, half),
            Point(-half, -half),
            Point(half, -half),
        ]

    @staticmethod
    def _t_shape_positions(n: int, spacing: float) -> list[Point]:
        """T-shaped topology (hub at top with arms + tail).

        For 4 qubits: hub at centre-top, two arms left/right, one tail
        downward.

        Args:
            n: Number of qubits (expected 4).
            spacing: Arm length in mm.

        Returns:
            Qubit positions.
        """
        if n != 4:
            # Fallback for unexpected sizes.
            return PlacementEngine._linear_positions(n, spacing)
        return [
            Point(0.0, spacing / 2.0),       # hub
            Point(-spacing, spacing / 2.0),   # left arm
            Point(spacing, spacing / 2.0),    # right arm
            Point(0.0, -spacing / 2.0),       # tail
        ]

    @staticmethod
    def _cross_positions(spacing: float) -> list[Point]:
        """IBM-style cross / plus topology for 5 qubits.

        Centre qubit at the origin, four arms along ±x and ±y.

        Args:
            spacing: Distance from centre to arm qubits in mm.

        Returns:
            Five qubit positions: [centre, +x, -x, +y, -y].
        """
        return [
            Point(0.0, 0.0),
            Point(spacing, 0.0),
            Point(-spacing, 0.0),
            Point(0.0, spacing),
            Point(0.0, -spacing),
        ]

    # ── Resonator Placement ─────────────────────────────────────────────────

    def _place_resonators(self) -> None:
        """Place each resonator near its parent qubit.

        The resonator anchor is offset perpendicular to the nearest chip
        edge so that the meander folds away from the chip centre.
        """
        offset = self.settings.resonator_offset_mm
        safe = self._chip_safe_box()

        for res in self.design.resonators:
            qubit_pos = self._qubit_positions.get(res.target_qubit_id)
            if qubit_pos is None:
                logger.warning(
                    "Resonator %s references unknown qubit %s – skipping.",
                    res.id,
                    res.target_qubit_id,
                )
                continue

            # Determine perpendicular direction: toward the nearest
            # horizontal chip edge (top or bottom).
            direction_y = -1.0 if qubit_pos.y >= 0.0 else 1.0

            anchor_x = qubit_pos.x
            anchor_y = qubit_pos.y + direction_y * offset

            # Clamp to safe area
            anchor_x = max(safe.x_min, min(safe.x_max, anchor_x))
            anchor_y = max(safe.y_min, min(safe.y_max, anchor_y))

            res.pos_x_mm = anchor_x
            res.pos_y_mm = anchor_y
            res.orientation_deg = 0.0 if direction_y < 0 else 180.0
            logger.debug(
                "Resonator %s placed at (%.4f, %.4f) mm", res.id, anchor_x, anchor_y
            )

    # ── Coupler Placement ───────────────────────────────────────────────────

    def _place_couplers(self) -> None:
        """Place each coupler at the midpoint between its two qubits.

        The coupler is oriented along the axis connecting the two qubits.
        """
        for coupler in self.design.couplers:
            pos_a = self._qubit_positions.get(coupler.source_qubit_id)
            pos_b = self._qubit_positions.get(coupler.target_qubit_id)
            if pos_a is None or pos_b is None:
                logger.warning(
                    "Coupler %s references unknown qubit(s) (%s, %s) – skipping.",
                    coupler.id,
                    coupler.source_qubit_id,
                    coupler.target_qubit_id,
                )
                continue

            mid = Point((pos_a.x + pos_b.x) / 2.0, (pos_a.y + pos_b.y) / 2.0)
            coupler.pos_x_mm = mid.x
            coupler.pos_y_mm = mid.y
            logger.debug(
                "Coupler %s placed at (%.4f, %.4f) mm",
                coupler.id,
                mid.x,
                mid.y,
            )
