"""
AST node definitions for QCLang.

These are plain Python dataclasses that represent the intermediate
representation (IR) produced by the parser. They are intentionally *not*
Pydantic models – validation is performed separately by the validator pass.

The top-level entry point is :class:`CircuitSpec`, which aggregates all
chip, qubit, resonator, and coupler nodes parsed from a ``.qclang`` file.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


# ── Leaf / Helper Nodes ─────────────────────────────────────────────────────


@dataclass
class LayerNode:
    """A metal or dielectric layer on the chip.

    Attributes:
        name: Descriptive name for the layer (e.g. ``"metal1"``).
        material: Material composition (default ``"niobium"``).
        thickness_nm: Film thickness in nanometers (default ``200.0``).
    """

    name: str
    material: str = "niobium"
    thickness_nm: float = 200.0

    def __repr__(self) -> str:
        return (
            f"LayerNode(name={self.name!r}, material={self.material!r}, "
            f"thickness_nm={self.thickness_nm})"
        )


@dataclass
class ChipNode:
    """Top-level chip definition.

    Attributes:
        name: Chip identifier (e.g. ``"my_chip_v1"``).
        width_mm: Physical chip width in millimeters.
        height_mm: Physical chip height in millimeters.
        substrate: Substrate material (default ``"silicon"``).
        layers: Ordered list of metal/dielectric layers.
    """

    name: str
    width_mm: float
    height_mm: float
    substrate: str = "silicon"
    layers: list[LayerNode] = field(default_factory=list)

    def __repr__(self) -> str:
        return (
            f"ChipNode(name={self.name!r}, "
            f"size={self.width_mm}×{self.height_mm} mm, "
            f"substrate={self.substrate!r}, "
            f"layers={len(self.layers)})"
        )


# ── Qubit Nodes ─────────────────────────────────────────────────────────────


@dataclass
class JunctionNode:
    """Josephson junction specification for a transmon qubit.

    Attributes:
        type: Junction topology – ``"single"`` or ``"squid"``.
        ej_ghz: Josephson energy *E_J* in GHz (optional; derived if absent).
        ec_mhz: Charging energy *E_C* in MHz (optional; derived if absent).
    """

    type: str = "single"
    ej_ghz: Optional[float] = None
    ec_mhz: Optional[float] = None

    def __repr__(self) -> str:
        parts = [f"type={self.type!r}"]
        if self.ej_ghz is not None:
            parts.append(f"Ej={self.ej_ghz} GHz")
        if self.ec_mhz is not None:
            parts.append(f"Ec={self.ec_mhz} MHz")
        return f"JunctionNode({', '.join(parts)})"


@dataclass
class QubitNode:
    """A transmon qubit in the circuit.

    Attributes:
        id: Unique qubit identifier (e.g. ``"Q0"``).
        frequency_ghz: Qubit transition frequency in GHz.
        anharmonicity_mhz: Anharmonicity α in MHz (negative for transmons).
        junction: Josephson junction specification.
    """

    id: str
    frequency_ghz: float
    anharmonicity_mhz: float = -330.0
    junction: JunctionNode = field(default_factory=JunctionNode)

    def __repr__(self) -> str:
        return (
            f"QubitNode(id={self.id!r}, "
            f"freq={self.frequency_ghz} GHz, "
            f"α={self.anharmonicity_mhz} MHz, "
            f"junction={self.junction!r})"
        )


# ── Resonator & Coupler Nodes ───────────────────────────────────────────────


@dataclass
class ResonatorNode:
    """A readout resonator coupled to a qubit.

    Attributes:
        id: Unique resonator identifier (e.g. ``"R0"``).
        frequency_ghz: Resonator frequency in GHz.
        target_qubit: ID of the qubit this resonator reads out.
        coupling_type: ``"capacitive"`` or ``"inductive"``.
        coupling_strength_mhz: Coupling strength *g* in MHz.
    """

    id: str
    frequency_ghz: float
    target_qubit: str
    coupling_type: str = "capacitive"
    coupling_strength_mhz: float = 50.0

    def __repr__(self) -> str:
        return (
            f"ResonatorNode(id={self.id!r}, "
            f"freq={self.frequency_ghz} GHz, "
            f"target={self.target_qubit!r}, "
            f"coupling={self.coupling_type}/{self.coupling_strength_mhz} MHz)"
        )


@dataclass
class CouplerNode:
    """A coupler between two qubits.

    Attributes:
        id: Unique coupler identifier (e.g. ``"C01"``).
        source_qubit: ID of the first qubit.
        target_qubit: ID of the second qubit.
        strength_mhz: Coupling strength *J* in MHz.
        coupler_type: ``"capacitive"`` or ``"bus_resonator"``.
    """

    id: str
    source_qubit: str
    target_qubit: str
    strength_mhz: float
    coupler_type: str = "capacitive"

    def __repr__(self) -> str:
        return (
            f"CouplerNode(id={self.id!r}, "
            f"{self.source_qubit!r}↔{self.target_qubit!r}, "
            f"J={self.strength_mhz} MHz, "
            f"type={self.coupler_type!r})"
        )


# ── Top-Level Circuit Specification ─────────────────────────────────────────


@dataclass
class CircuitSpec:
    """Complete circuit specification produced by the QCLang parser.

    This is the root AST node that holds every component defined in a
    ``.qclang`` file.

    Attributes:
        chip: Chip definition.
        qubits: List of qubit nodes.
        resonators: List of readout resonator nodes.
        couplers: List of qubit-qubit coupler nodes.
    """

    chip: ChipNode
    qubits: list[QubitNode] = field(default_factory=list)
    resonators: list[ResonatorNode] = field(default_factory=list)
    couplers: list[CouplerNode] = field(default_factory=list)

    # ── Lookup helpers ──────────────────────────────────────────────────

    def get_qubit(self, qubit_id: str) -> QubitNode:
        """Return the qubit node with the given *qubit_id*.

        Args:
            qubit_id: Unique qubit identifier to look up.

        Returns:
            The matching :class:`QubitNode`.

        Raises:
            KeyError: If no qubit with *qubit_id* exists.
        """
        for qubit in self.qubits:
            if qubit.id == qubit_id:
                return qubit
        raise KeyError(
            f"Qubit '{qubit_id}' not found. "
            f"Available qubits: {self.qubit_ids}"
        )

    @property
    def qubit_ids(self) -> list[str]:
        """Return an ordered list of all qubit IDs.

        Returns:
            List of qubit identifier strings.
        """
        return [q.id for q in self.qubits]

    def get_connectivity_graph(self) -> dict[str, list[str]]:
        """Build an adjacency-list representation of qubit connectivity.

        Edges are derived from :attr:`couplers`. The graph is undirected:
        both ``source → target`` and ``target → source`` entries are
        included.

        Returns:
            Dictionary mapping each qubit ID to its list of connected
            qubit IDs.

        Example:
            >>> spec.get_connectivity_graph()
            {'Q0': ['Q1'], 'Q1': ['Q0', 'Q2'], 'Q2': ['Q1']}
        """
        graph: dict[str, list[str]] = {q.id: [] for q in self.qubits}
        for coupler in self.couplers:
            src, tgt = coupler.source_qubit, coupler.target_qubit
            if src in graph and tgt not in graph[src]:
                graph[src].append(tgt)
            if tgt in graph and src not in graph[tgt]:
                graph[tgt].append(src)
        return graph

    def __repr__(self) -> str:
        return (
            f"CircuitSpec(chip={self.chip.name!r}, "
            f"qubits={len(self.qubits)}, "
            f"resonators={len(self.resonators)}, "
            f"couplers={len(self.couplers)})"
        )
