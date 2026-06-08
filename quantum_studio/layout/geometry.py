"""
Geometry primitives and utilities for superconducting quantum chip layout.

Provides foundational geometric types (Point, BoundingBox, Polygon, CPWPath)
and utility functions for overlap detection, distance computation, meander
waypoint generation, and coplanar-waveguide polygon construction.

All spatial coordinates are in **millimeters** unless explicitly stated.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

from quantum_studio.utils.logging import get_logger

logger = get_logger("layout.geometry")


# ── Point ───────────────────────────────────────────────────────────────────


@dataclass
class Point:
    """2-D point in the chip coordinate system.

    Attributes:
        x: Horizontal coordinate in mm.
        y: Vertical coordinate in mm.
    """

    x: float  # mm
    y: float  # mm

    # -- Measurement ----------------------------------------------------------

    def distance_to(self, other: Point) -> float:
        """Euclidean distance to *other* in mm.

        Args:
            other: The target point.

        Returns:
            Distance in mm.
        """
        return math.hypot(self.x - other.x, self.y - other.y)

    # -- Transformations ------------------------------------------------------

    def translate(self, dx: float, dy: float) -> Point:
        """Return a new point shifted by *(dx, dy)* mm.

        Args:
            dx: Horizontal translation in mm.
            dy: Vertical translation in mm.

        Returns:
            Translated point.
        """
        return Point(self.x + dx, self.y + dy)

    def rotate(self, angle_deg: float, origin: Optional[Point] = None) -> Point:
        """Return a new point rotated *angle_deg* degrees around *origin*.

        Rotation follows the standard mathematical convention
        (counter-clockwise positive).

        Args:
            angle_deg: Rotation angle in degrees.
            origin: Centre of rotation (defaults to the coordinate origin).

        Returns:
            Rotated point.
        """
        cx, cy = (origin.x, origin.y) if origin is not None else (0.0, 0.0)
        rad = math.radians(angle_deg)
        cos_a, sin_a = math.cos(rad), math.sin(rad)
        dx, dy = self.x - cx, self.y - cy
        return Point(
            cx + dx * cos_a - dy * sin_a,
            cy + dx * sin_a + dy * cos_a,
        )

    # -- Arithmetic operators -------------------------------------------------

    def __add__(self, other: Point) -> Point:  # type: ignore[override]
        if not isinstance(other, Point):
            return NotImplemented
        return Point(self.x + other.x, self.y + other.y)

    def __sub__(self, other: Point) -> Point:
        if not isinstance(other, Point):
            return NotImplemented
        return Point(self.x - other.x, self.y - other.y)

    def __repr__(self) -> str:
        return f"Point({self.x:.6f}, {self.y:.6f})"


# ── BoundingBox ─────────────────────────────────────────────────────────────


@dataclass
class BoundingBox:
    """Axis-aligned bounding box in chip coordinates.

    Attributes:
        x_min: Left edge (mm).
        y_min: Bottom edge (mm).
        x_max: Right edge (mm).
        y_max: Top edge (mm).
    """

    x_min: float
    y_min: float
    x_max: float
    y_max: float

    def __post_init__(self) -> None:
        if self.x_min > self.x_max:
            self.x_min, self.x_max = self.x_max, self.x_min
        if self.y_min > self.y_max:
            self.y_min, self.y_max = self.y_max, self.y_min

    # -- Properties -----------------------------------------------------------

    @property
    def width(self) -> float:
        """Width in mm."""
        return self.x_max - self.x_min

    @property
    def height(self) -> float:
        """Height in mm."""
        return self.y_max - self.y_min

    @property
    def center(self) -> Point:
        """Geometric centre."""
        return Point(
            (self.x_min + self.x_max) / 2.0,
            (self.y_min + self.y_max) / 2.0,
        )

    @property
    def area(self) -> float:
        """Area in mm²."""
        return self.width * self.height

    # -- Queries --------------------------------------------------------------

    def contains_point(self, p: Point) -> bool:
        """Return ``True`` if *p* lies inside or on the boundary.

        Args:
            p: Query point.

        Returns:
            Whether the point is contained.
        """
        return self.x_min <= p.x <= self.x_max and self.y_min <= p.y <= self.y_max

    def overlaps(self, other: BoundingBox) -> bool:
        """Return ``True`` if this box overlaps *other*.

        Args:
            other: Another bounding box.

        Returns:
            Whether the two boxes overlap (share any interior area).
        """
        if self.x_max <= other.x_min or other.x_max <= self.x_min:
            return False
        if self.y_max <= other.y_min or other.y_max <= self.y_min:
            return False
        return True

    def expand(self, margin: float) -> BoundingBox:
        """Return a new box expanded uniformly by *margin* mm on all sides.

        Args:
            margin: Expansion distance in mm (may be negative to shrink).

        Returns:
            Expanded bounding box.
        """
        return BoundingBox(
            self.x_min - margin,
            self.y_min - margin,
            self.x_max + margin,
            self.y_max + margin,
        )

    def pad(self, margin: float) -> BoundingBox:
        """Alias for :meth:`expand` – adds *margin* mm on every side.

        Args:
            margin: Padding distance in mm.

        Returns:
            Padded bounding box.
        """
        return self.expand(margin)

    def merge_with(self, other: BoundingBox) -> BoundingBox:
        """Return the smallest box enclosing both *self* and *other*.

        Args:
            other: Another bounding box.

        Returns:
            Merged bounding box.
        """
        return BoundingBox(
            min(self.x_min, other.x_min),
            min(self.y_min, other.y_min),
            max(self.x_max, other.x_max),
            max(self.y_max, other.y_max),
        )


# ── Polygon ─────────────────────────────────────────────────────────────────


@dataclass
class Polygon:
    """Simple polygon defined by an ordered list of vertices.

    The polygon is assumed to be *non-self-intersecting* and the vertex
    winding order determines the orientation (CCW = positive area).

    Attributes:
        vertices: Ordered list of corner :class:`Point` objects.
        layer: GDS layer number for this polygon (default 1 = metal).
    """

    vertices: list[Point]
    layer: int = 1

    # -- Properties -----------------------------------------------------------

    @property
    def bounding_box(self) -> BoundingBox:
        """Axis-aligned bounding box of the polygon."""
        if not self.vertices:
            return BoundingBox(0.0, 0.0, 0.0, 0.0)
        xs = [v.x for v in self.vertices]
        ys = [v.y for v in self.vertices]
        return BoundingBox(min(xs), min(ys), max(xs), max(ys))

    @property
    def area(self) -> float:
        """Signed area via the shoelace formula (positive = CCW)."""
        n = len(self.vertices)
        if n < 3:
            return 0.0
        total = 0.0
        for i in range(n):
            j = (i + 1) % n
            total += self.vertices[i].x * self.vertices[j].y
            total -= self.vertices[j].x * self.vertices[i].y
        return total / 2.0

    @property
    def centroid(self) -> Point:
        """Centroid of the polygon computed from vertex average.

        For a simple polygon this uses the standard formula weighted by
        the signed area.  Falls back to a plain vertex average when the
        area is degenerate.
        """
        n = len(self.vertices)
        if n == 0:
            return Point(0.0, 0.0)
        a = self.area
        if abs(a) < 1e-15:
            cx = sum(v.x for v in self.vertices) / n
            cy = sum(v.y for v in self.vertices) / n
            return Point(cx, cy)
        cx = 0.0
        cy = 0.0
        for i in range(n):
            j = (i + 1) % n
            cross = (
                self.vertices[i].x * self.vertices[j].y
                - self.vertices[j].x * self.vertices[i].y
            )
            cx += (self.vertices[i].x + self.vertices[j].x) * cross
            cy += (self.vertices[i].y + self.vertices[j].y) * cross
        factor = 1.0 / (6.0 * a)
        return Point(cx * factor, cy * factor)

    # -- Queries --------------------------------------------------------------

    def contains_point(self, p: Point) -> bool:
        """Ray-casting test for point-in-polygon.

        Args:
            p: Query point.

        Returns:
            ``True`` if *p* is inside (or on) the polygon.
        """
        n = len(self.vertices)
        if n < 3:
            return False
        inside = False
        j = n - 1
        for i in range(n):
            vi, vj = self.vertices[i], self.vertices[j]
            if ((vi.y > p.y) != (vj.y > p.y)) and (
                p.x < (vj.x - vi.x) * (p.y - vi.y) / (vj.y - vi.y) + vi.x
            ):
                inside = not inside
            j = i
        return inside

    # -- Transformations ------------------------------------------------------

    def translate(self, dx: float, dy: float) -> Polygon:
        """Return a copy translated by *(dx, dy)*.

        Args:
            dx: Horizontal shift in mm.
            dy: Vertical shift in mm.

        Returns:
            Translated polygon.
        """
        return Polygon(
            [v.translate(dx, dy) for v in self.vertices],
            self.layer,
        )

    def rotate(self, angle_deg: float, origin: Optional[Point] = None) -> Polygon:
        """Return a copy rotated about *origin*.

        Args:
            angle_deg: Rotation angle in degrees (CCW positive).
            origin: Centre of rotation (defaults to the polygon centroid).

        Returns:
            Rotated polygon.
        """
        centre = origin if origin is not None else self.centroid
        return Polygon(
            [v.rotate(angle_deg, centre) for v in self.vertices],
            self.layer,
        )


# ── CPWPath ─────────────────────────────────────────────────────────────────


@dataclass
class CPWPath:
    """Coplanar-waveguide path segment.

    Stores the centreline waypoints together with trace and gap widths so
    that the full conductor / gap geometry can be reconstructed.

    Attributes:
        points: Centreline waypoints (mm).
        trace_width_mm: Centre conductor width (default 10 µm).
        gap_mm: Gap between conductor and ground plane (default 6 µm).
        layer: GDS layer number.
    """

    points: list[Point]
    trace_width_mm: float = 0.010  # 10 µm
    gap_mm: float = 0.006  # 6 µm
    layer: int = 1

    # -- Properties -----------------------------------------------------------

    @property
    def total_length(self) -> float:
        """Total arc-length of the centreline in mm."""
        length = 0.0
        for i in range(len(self.points) - 1):
            length += self.points[i].distance_to(self.points[i + 1])
        return length

    @property
    def bounding_box(self) -> BoundingBox:
        """Bounding box enclosing the full CPW (trace + gap)."""
        if not self.points:
            return BoundingBox(0.0, 0.0, 0.0, 0.0)
        half = self.trace_width_mm / 2.0 + self.gap_mm
        xs = [p.x for p in self.points]
        ys = [p.y for p in self.points]
        return BoundingBox(
            min(xs) - half,
            min(ys) - half,
            max(xs) + half,
            max(ys) + half,
        )

    # -- Geometry generation --------------------------------------------------

    def to_polygons(self) -> list[Polygon]:
        """Convert the path into a list of polygons (trace + gap outlines).

        Returns a list containing four :class:`Polygon` objects per
        segment pair:

        * Trace polygon (centre conductor) on the base layer.
        * Left-gap polygon (``layer + 10``).
        * Right-gap polygon (``layer + 10``).

        For the complete set, call :func:`generate_cpw_polygon` with the
        stored parameters.

        Returns:
            List of polygons representing the CPW structure.
        """
        trace_polys, gap_polys = generate_cpw_polygon(
            self.points, self.trace_width_mm, self.gap_mm
        )
        for p in trace_polys:
            p.layer = self.layer
        for p in gap_polys:
            p.layer = self.layer + 10  # gap on a separate GDS layer
        return trace_polys + gap_polys


# ═══════════════════════════════════════════════════════════════════════════
# Utility Functions
# ═══════════════════════════════════════════════════════════════════════════


def check_overlap(bb1: BoundingBox, bb2: BoundingBox) -> bool:
    """Return ``True`` when *bb1* and *bb2* overlap.

    This is a module-level convenience wrapper around
    :meth:`BoundingBox.overlaps`.

    Args:
        bb1: First bounding box.
        bb2: Second bounding box.

    Returns:
        Whether the two boxes share interior area.
    """
    return bb1.overlaps(bb2)


def min_distance(bb1: BoundingBox, bb2: BoundingBox) -> float:
    """Minimum axis-aligned distance between two bounding boxes.

    Returns ``0.0`` when the boxes overlap or touch.

    Args:
        bb1: First bounding box.
        bb2: Second bounding box.

    Returns:
        Minimum separating distance in mm.
    """
    dx = max(0.0, max(bb1.x_min - bb2.x_max, bb2.x_min - bb1.x_max))
    dy = max(0.0, max(bb1.y_min - bb2.y_max, bb2.y_min - bb1.y_max))
    return math.hypot(dx, dy)


# ── Meander Generation ─────────────────────────────────────────────────────


def compute_meander_points(
    start: Point,
    end: Point,
    total_length: float,
    spacing_mm: float = 0.200,
) -> list[Point]:
    """Generate meander waypoints between *start* and *end*.

    The meander is constructed perpendicular to the straight-line axis
    between the two endpoints.  Turns alternate left/right of the axis
    until the accumulated path length reaches *total_length*.

    Args:
        start: Starting point (mm).
        end: Ending point (mm).
        total_length: Desired total meander arc-length in mm (must be ≥
            the straight-line distance).
        spacing_mm: Distance between successive meander legs in mm.

    Returns:
        Ordered list of waypoints including *start* and *end*.

    Raises:
        ValueError: If *total_length* is shorter than the straight-line
            distance between *start* and *end*.
    """
    direct = start.distance_to(end)
    if direct < 1e-9:
        # Start and end coincide – generate a symmetric meander in-place.
        return _meander_in_place(start, total_length, spacing_mm)

    if total_length < direct - 1e-9:
        raise ValueError(
            f"Requested total_length ({total_length:.4f} mm) is shorter than "
            f"the straight-line distance ({direct:.4f} mm)."
        )

    # Tolerance: if the requested length is essentially the direct
    # distance, return a straight segment.
    if total_length <= direct + 1e-6:
        return [start, end]

    # Unit vectors along and perpendicular to start→end.
    ux = (end.x - start.x) / direct
    uy = (end.y - start.y) / direct
    # Perpendicular (90° CCW)
    nx, ny = -uy, ux

    # Strategy: lay down meander legs of height *h* perpendicular to the
    # axis, spaced by *spacing_mm* along the axis.  We solve for *h* so
    # that the total path length equals *total_length*.
    #
    # Number of half-period spacings that fit:
    n_legs = max(1, int(math.floor(direct / spacing_mm)))
    # Actual spacing along the axis
    actual_spacing = direct / n_legs

    # Each meander period adds two vertical legs of height *h* and one
    # horizontal leg of *actual_spacing*.  We need:
    #   n_legs * sqrt(actual_spacing² + h²) + (extra) ≈ total_length
    #
    # More accurately, the polyline goes:
    #   straight segments at an angle: sqrt(spacing² + (2h)²) each, with
    #   n_legs such segments.  Solve for h.
    #
    # Simplified model:
    #   total ≈ n_legs * actual_spacing  (in axis direction)
    #   + n_legs * 2 * h                 (perpendicular excursions)
    # => h = (total_length - direct) / (2 * n_legs)
    extra_length = total_length - direct
    amplitude = extra_length / (2.0 * n_legs) if n_legs > 0 else 0.0

    # Clamp minimum amplitude to avoid degenerate meanders.
    amplitude = max(amplitude, 1e-6)

    waypoints: list[Point] = [start]
    for i in range(1, n_legs):
        # Position along the axis
        t = i * actual_spacing
        ax, ay = start.x + ux * t, start.y + uy * t

        # Alternate perpendicular offset direction
        sign = 1.0 if i % 2 == 1 else -1.0
        px = ax + nx * amplitude * sign
        py = ay + ny * amplitude * sign
        waypoints.append(Point(px, py))

    waypoints.append(end)
    return waypoints


def _meander_in_place(center: Point, total_length: float, spacing_mm: float) -> list[Point]:
    """Generate a symmetric meander around a single point.

    Used when start and end coincide.  The meander is oriented along the
    positive-x axis.

    Args:
        center: Centre point.
        total_length: Target path length in mm.
        spacing_mm: Leg spacing in mm.

    Returns:
        Ordered list of waypoints.
    """
    if total_length <= 1e-9:
        return [center]

    n_legs = max(2, int(math.ceil(total_length / spacing_mm)))
    half_span = (n_legs * spacing_mm) / 2.0
    amplitude = max(total_length / (2.0 * n_legs), 1e-6)

    waypoints: list[Point] = []
    for i in range(n_legs + 1):
        x = center.x - half_span + i * spacing_mm
        sign = 1.0 if i % 2 == 0 else -1.0
        y = center.y + sign * amplitude
        waypoints.append(Point(x, y))
    return waypoints


# ── CPW Polygon Generation ─────────────────────────────────────────────────


def _offset_polyline(
    centerline: list[Point], offset: float
) -> list[Point]:
    """Offset a polyline by *offset* mm (positive = left of travel direction).

    Uses a simple per-segment normal offset with mitre joins.

    Args:
        centerline: Ordered list of centreline points.
        offset: Perpendicular offset distance in mm.

    Returns:
        Offset polyline as a list of points.
    """
    if len(centerline) < 2:
        return list(centerline)

    result: list[Point] = []
    n = len(centerline)

    for i in range(n):
        if i == 0:
            # Use the normal of the first segment.
            seg_dx = centerline[1].x - centerline[0].x
            seg_dy = centerline[1].y - centerline[0].y
        elif i == n - 1:
            # Use the normal of the last segment.
            seg_dx = centerline[-1].x - centerline[-2].x
            seg_dy = centerline[-1].y - centerline[-2].y
        else:
            # Average the normals of the two adjacent segments.
            seg_dx = centerline[i + 1].x - centerline[i - 1].x
            seg_dy = centerline[i + 1].y - centerline[i - 1].y

        seg_len = math.hypot(seg_dx, seg_dy)
        if seg_len < 1e-15:
            result.append(centerline[i])
            continue

        # Left-hand normal: (-dy, dx) / length
        nx = -seg_dy / seg_len * offset
        ny = seg_dx / seg_len * offset
        result.append(Point(centerline[i].x + nx, centerline[i].y + ny))

    return result


def generate_cpw_polygon(
    centerline: list[Point],
    trace_width: float,
    gap: float,
) -> tuple[list[Polygon], list[Polygon]]:
    """Build trace and gap polygons from a CPW centreline.

    The trace is the centre conductor strip of width *trace_width*.  The
    gap polygons are two strips of width *gap* on either side of the trace.

    Each resulting polygon is a closed loop formed by running along one
    offset side of the centreline and returning along the other.

    Args:
        centerline: Ordered centreline points (mm).
        trace_width: Centre conductor width in mm.
        gap: Gap width between conductor and ground in mm.

    Returns:
        Tuple ``(trace_polygons, gap_polygons)`` where each element is a
        list of :class:`Polygon` objects.
    """
    if len(centerline) < 2:
        logger.warning("generate_cpw_polygon called with fewer than 2 centreline points.")
        return ([], [])

    half_trace = trace_width / 2.0
    half_outer = half_trace + gap

    # Trace polygon: strip of width trace_width centred on the line.
    left_trace = _offset_polyline(centerline, half_trace)
    right_trace = _offset_polyline(centerline, -half_trace)
    trace_verts = left_trace + list(reversed(right_trace))
    trace_poly = Polygon(trace_verts, layer=1)

    # Gap polygons: strips between the trace edges and the outer boundary.
    left_outer = _offset_polyline(centerline, half_outer)
    right_outer = _offset_polyline(centerline, -half_outer)

    left_gap_verts = left_outer + list(reversed(left_trace))
    right_gap_verts = right_trace + list(reversed(right_outer))

    left_gap_poly = Polygon(left_gap_verts, layer=1)
    right_gap_poly = Polygon(right_gap_verts, layer=1)

    return ([trace_poly], [left_gap_poly, right_gap_poly])
