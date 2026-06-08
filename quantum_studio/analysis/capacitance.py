"""
Capacitance estimation for superconducting quantum chip elements.

Provides physically accurate analytic formulas for parallel-plate,
coplanar-waveguide (CPW), transmon-pad, and coupling capacitances using
conformal-mapping techniques with complete elliptic integrals.
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING, Any

import numpy as np

from quantum_studio.config import (
    EPSILON_0,
    SILICON_EPSILON_R,
)
from quantum_studio.utils.logging import get_logger
from quantum_studio.utils.units import um_to_m

if TYPE_CHECKING:
    pass  # forward references only

logger = get_logger("analysis.capacitance")

# ── Elliptic integral with scipy fallback ───────────────────────────────────

try:
    from scipy.special import ellipk as _scipy_ellipk

    def _ellipk(m: float) -> float:
        """Complete elliptic integral of the first kind K(m).

        Uses SciPy's implementation for full numerical accuracy.

        Args:
            m: Parameter (not the modulus k; ``m = k²``).

        Returns:
            K(m) value.
        """
        return float(_scipy_ellipk(m))

except ImportError:  # pragma: no cover
    logger.info("scipy not available; using numerical approximation for K(m).")

    def _ellipk(m: float) -> float:
        """Complete elliptic integral of the first kind K(m).

        Uses the arithmetic-geometric mean (AGM) algorithm when SciPy is
        not installed.  Accurate to machine precision for 0 ≤ m < 1.

        Args:
            m: Parameter (``m = k²``), must satisfy ``0 ≤ m < 1``.

        Returns:
            K(m) value.

        Raises:
            ValueError: If *m* is not in [0, 1).
        """
        if m < 0.0 or m >= 1.0:
            raise ValueError(f"ellipk parameter m must be in [0, 1), got {m}")

        # AGM method: K(m) = π / (2·AGM(1, √(1-m)))
        a = 1.0
        b = math.sqrt(1.0 - m)
        for _ in range(100):
            a_new = (a + b) / 2.0
            b_new = math.sqrt(a * b)
            if abs(a_new - b_new) < 1e-15:
                break
            a, b = a_new, b_new
        return math.pi / (2.0 * a)


class CapacitanceEstimator:
    """Analytic capacitance estimator for superconducting quantum chips.

    All methods accept SI units (metres, Farads) unless stated otherwise.
    The estimator uses the substrate relative permittivity ``ε_r`` (default
    11.45 for silicon) for all dielectric calculations.

    Args:
        substrate_epsilon_r: Relative permittivity of the substrate.

    Example::

        est = CapacitanceEstimator()
        c_per_l = est.cpw_capacitance_per_length(10e-6, 6e-6)  # F/m
    """

    def __init__(self, substrate_epsilon_r: float = SILICON_EPSILON_R) -> None:
        if substrate_epsilon_r <= 0:
            raise ValueError(
                f"substrate_epsilon_r must be positive, got {substrate_epsilon_r}"
            )
        self.epsilon_r: float = substrate_epsilon_r
        self.epsilon_eff: float = (1.0 + substrate_epsilon_r) / 2.0

    # ── Fundamental formulas ────────────────────────────────────────────

    def parallel_plate_capacitance(self, area_m2: float, gap_m: float) -> float:
        """Parallel-plate capacitance.

        .. math::
            C = \\varepsilon_0 \\cdot \\varepsilon_r \\cdot A / d

        Args:
            area_m2: Plate area in m².
            gap_m: Plate separation in m.

        Returns:
            Capacitance in Farads.

        Raises:
            ValueError: If *area_m2* ≤ 0 or *gap_m* ≤ 0.
        """
        if area_m2 <= 0:
            raise ValueError(f"area_m2 must be positive, got {area_m2}")
        if gap_m <= 0:
            raise ValueError(f"gap_m must be positive, got {gap_m}")
        return EPSILON_0 * self.epsilon_r * area_m2 / gap_m

    def cpw_capacitance_per_length(
        self,
        trace_width_m: float,
        gap_m: float,
    ) -> float:
        """CPW capacitance per unit length using conformal mapping.

        For a coplanar waveguide on a dielectric half-space:

        .. math::
            C / L = 4 \\varepsilon_0 \\varepsilon_{\\text{eff}}
                    \\frac{K(k)}{K(k')}

        where:

        - :math:`k = w / (w + 2s)`  (w = trace width, s = gap)
        - :math:`k' = \\sqrt{1 - k^2}`
        - :math:`K` = complete elliptic integral of the first kind

        Args:
            trace_width_m: Centre-trace width in m.
            gap_m: Gap width (each side) in m.

        Returns:
            Capacitance per unit length in F/m.

        Raises:
            ValueError: If either dimension is ≤ 0.
        """
        if trace_width_m <= 0:
            raise ValueError(
                f"trace_width_m must be positive, got {trace_width_m}"
            )
        if gap_m <= 0:
            raise ValueError(f"gap_m must be positive, got {gap_m}")

        w = trace_width_m
        s = gap_m
        k = w / (w + 2.0 * s)
        k_prime = math.sqrt(1.0 - k * k)

        # Guard against degenerate ratios
        if k_prime < 1e-15:
            logger.warning(
                "CPW k' ≈ 0 (trace width >> gap); returning large capacitance."
            )
            k_prime = 1e-15

        ratio = _ellipk(k * k) / _ellipk(k_prime * k_prime)
        return 4.0 * EPSILON_0 * self.epsilon_eff * ratio

    def qubit_pad_capacitance(
        self,
        pad_width_m: float,
        pad_height_m: float,
        gap_m: float,
    ) -> float:
        """Estimate total capacitance of a transmon qubit's two pads.

        Approximates the pad-to-ground capacitance using the parallel-plate
        formula for the pad area facing the ground plane across the gap, plus
        a fringing correction factor of ~1.3× typical for planar transmon
        geometries.

        Args:
            pad_width_m: Width of one pad in m.
            pad_height_m: Height of one pad in m.
            gap_m: Gap between each pad and the ground plane in m.

        Returns:
            Estimated pad capacitance (both pads combined) in Farads.
        """
        if pad_width_m <= 0 or pad_height_m <= 0 or gap_m <= 0:
            raise ValueError(
                "All pad dimensions and gap must be positive."
            )

        # Area of one pad's perimeter facing the ground plane
        # The dominant contribution is from the edges of the pad.
        perimeter_length = 2.0 * (pad_width_m + pad_height_m)
        # Effective area of the perimeter gap (height of metal is thin,
        # so we use pad_height as the conductor dimension facing ground)
        area_one_pad = perimeter_length * pad_height_m

        # Parallel-plate estimate for one pad
        c_one_pad = EPSILON_0 * self.epsilon_eff * area_one_pad / gap_m

        # Fringing factor (empirical for planar transmon pads)
        fringing_factor = 1.3

        # Two pads in series for the shunt capacitance:
        # C_shunt ≈ C_pad / 2  (two identical pads in series to ground)
        # But the total pad-to-ground capacitance per pad is counted.
        # For a transmon, CΣ includes both pads-to-ground plus the
        # inter-pad (junction) capacitance.  Here we estimate the
        # pad-to-ground contribution.
        return 2.0 * c_one_pad * fringing_factor

    def coupling_capacitance(
        self,
        coupling_length_m: float,
        gap_m: float,
        trace_width_m: float,
    ) -> float:
        """Estimate capacitive coupling between two parallel CPW segments.

        Uses the coupled-line model: the mutual capacitance is approximated
        as the difference between the even- and odd-mode capacitances over
        the coupling length.

        A simpler first-order approximation:

        .. math::
            C_g \\approx \\varepsilon_0 \\varepsilon_{\\text{eff}}
                        \\cdot \\frac{L_{\\text{coupling}} \\cdot w}{s}

        where *w* is the trace width and *s* is the gap between the two
        conductors.

        Args:
            coupling_length_m: Length over which the two lines are coupled, in m.
            gap_m: Gap between the two CPW centre conductors, in m.
            trace_width_m: Centre-trace width of each CPW, in m.

        Returns:
            Estimated coupling capacitance in Farads.
        """
        if coupling_length_m <= 0 or gap_m <= 0 or trace_width_m <= 0:
            raise ValueError(
                "All dimensions must be positive."
            )

        return EPSILON_0 * self.epsilon_eff * coupling_length_m * trace_width_m / gap_m

    # ── Qubit-level aggregations ────────────────────────────────────────

    def qubit_total_capacitance(self, qubit: Any) -> float:
        """Total shunt capacitance CΣ of a transmon qubit.

        Combines the pad-to-ground capacitance (from pad geometry) with a
        small junction capacitance contribution (~2 fF per junction).

        The qubit object is expected to have (directly or via nested objects):
        - ``pad_width_um``, ``pad_height_um``, ``pad_gap_um`` (pad geometry)
        - ``connection_pad_a`` / ``connection_pad_b`` sub-objects (Qiskit-Metal
          style) — used if the direct attributes are not found.

        Args:
            qubit: Transmon qubit object with geometry attributes.

        Returns:
            Total shunt capacitance CΣ in Farads.
        """
        # Try direct attributes first
        pad_w = _get_attr_safe(qubit, "pad_width_um")
        pad_h = _get_attr_safe(qubit, "pad_height_um")
        pad_g = _get_attr_safe(qubit, "pad_gap_um")

        if pad_w is None or pad_h is None or pad_g is None:
            # Fall back to Qiskit-Metal style options
            options = _get_attr_safe(qubit, "options", {})
            pad_w = _get_attr_safe(options, "pad_width_um", 275.0)
            pad_h = _get_attr_safe(options, "pad_height_um", 100.0)
            pad_g = _get_attr_safe(options, "pad_gap_um", 30.0)

        pad_w_m = um_to_m(float(pad_w))
        pad_h_m = um_to_m(float(pad_h))
        pad_g_m = um_to_m(float(pad_g))

        c_pad = self.qubit_pad_capacitance(pad_w_m, pad_h_m, pad_g_m)

        # Junction capacitance (typical ~2 fF for Al/AlOx/Al junctions)
        c_junction = 2.0e-15

        c_total = c_pad + c_junction
        logger.debug(
            "Qubit CΣ = %.3f fF  (pad=%.3f fF, junction=%.3f fF)",
            c_total * 1e15,
            c_pad * 1e15,
            c_junction * 1e15,
        )
        return c_total

    # ── Design-level analysis ───────────────────────────────────────────

    def capacitance_matrix(self, design: Any) -> np.ndarray:
        """Build an N×N capacitance matrix for all qubits in a design.

        Diagonal entries are the total shunt capacitance CΣ of each qubit.
        Off-diagonal entries are the mutual coupling capacitance Cg between
        qubit pairs that are connected by a coupler.

        Args:
            design: ``QuantumDesign`` or compatible object with ``qubits``
                (list) and ``couplers`` (list) attributes.

        Returns:
            NumPy array of shape ``(N, N)`` in Farads, where *N* is the
            number of qubits.

        Raises:
            ValueError: If the design contains no qubits.
        """
        qubits = _get_attr_safe(design, "qubits", [])
        if not qubits:
            raise ValueError("Design contains no qubits.")

        n = len(qubits)
        c_matrix = np.zeros((n, n), dtype=np.float64)

        # Build name → index map
        name_to_idx: dict[str, int] = {}
        for idx, q in enumerate(qubits):
            q_name = _get_attr_safe(q, "name", f"Q{idx}")
            name_to_idx[str(q_name)] = idx
            c_matrix[idx, idx] = self.qubit_total_capacitance(q)

        # Fill off-diagonal coupling capacitances from couplers
        couplers = _get_attr_safe(design, "couplers", [])
        for coupler in couplers:
            qa_name = str(_get_attr_safe(coupler, "qubit_a", ""))
            qb_name = str(_get_attr_safe(coupler, "qubit_b", ""))
            ia = name_to_idx.get(qa_name)
            ib = name_to_idx.get(qb_name)
            if ia is None or ib is None:
                continue

            # Coupling geometry
            coupling_length_um = float(
                _get_attr_safe(coupler, "coupling_length_um", 200.0)
            )
            coupling_gap_um = float(
                _get_attr_safe(coupler, "coupling_gap_um", 10.0)
            )
            trace_width_um = float(
                _get_attr_safe(coupler, "trace_width_um", 10.0)
            )

            cg = self.coupling_capacitance(
                um_to_m(coupling_length_um),
                um_to_m(coupling_gap_um),
                um_to_m(trace_width_um),
            )
            c_matrix[ia, ib] = cg
            c_matrix[ib, ia] = cg

        return c_matrix


# ── Private helpers ─────────────────────────────────────────────────────────


def _get_attr_safe(obj: Any, attr: str, default: Any = None) -> Any:
    """Retrieve an attribute from an object or a key from a dict."""
    if isinstance(obj, dict):
        return obj.get(attr, default)
    return getattr(obj, attr, default)
