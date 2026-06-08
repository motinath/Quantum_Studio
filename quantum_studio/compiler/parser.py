"""
QCLang Parser – raw ``dict`` → :class:`CircuitSpec` AST.

The parser receives the validated top-level dictionary produced by
:class:`QCLangLexer` and constructs a tree of typed AST nodes.  It fills
in default values for optional fields and raises :class:`QCLangSyntaxError`
when the data cannot be coerced into a valid node.
"""

from __future__ import annotations

from typing import Any

from quantum_studio.compiler.ast_nodes import (
    ChipNode,
    CircuitSpec,
    CouplerNode,
    JunctionNode,
    LayerNode,
    QubitNode,
    ResonatorNode,
)
from quantum_studio.compiler.errors import QCLangSyntaxError
from quantum_studio.utils.logging import get_logger

logger = get_logger("compiler.parser")


class QCLangParser:
    """Transform a raw dictionary into a :class:`CircuitSpec` AST.

    Usage::

        parser = QCLangParser()
        spec = parser.parse(raw_dict)
    """

    # ── Public API ──────────────────────────────────────────────────────

    def parse(self, raw: dict[str, Any]) -> CircuitSpec:
        """Parse a validated raw dictionary into a :class:`CircuitSpec`.

        Args:
            raw: Dictionary with top-level keys ``chip``, ``qubits``,
                and optionally ``resonators`` and ``couplers``.

        Returns:
            Fully constructed :class:`CircuitSpec` AST.

        Raises:
            QCLangSyntaxError: If any section contains malformed data.
        """
        logger.debug("Parsing raw dict into CircuitSpec")

        chip = self._parse_chip(raw.get("chip"))
        qubits = self._parse_qubits(raw.get("qubits"))
        resonators = self._parse_resonators(raw.get("resonators"))
        couplers = self._parse_couplers(raw.get("couplers"))

        spec = CircuitSpec(
            chip=chip,
            qubits=qubits,
            resonators=resonators,
            couplers=couplers,
        )
        logger.info("Parsed CircuitSpec: %r", spec)
        return spec

    # ── Chip ────────────────────────────────────────────────────────────

    def _parse_chip(self, data: Any) -> ChipNode:
        """Parse the ``chip`` section into a :class:`ChipNode`.

        Args:
            data: Raw value under the ``chip`` key.

        Returns:
            A :class:`ChipNode`.

        Raises:
            QCLangSyntaxError: If *data* is missing or malformed.
        """
        if data is None:
            raise QCLangSyntaxError(
                "Missing 'chip' section – every .qclang file must define a chip"
            )

        if not isinstance(data, dict):
            raise QCLangSyntaxError(
                f"'chip' section must be a mapping, got {type(data).__name__}"
            )

        name = self._require_field(data, "name", str, section="chip")
        width_mm = self._require_numeric(data, "width_mm", section="chip")
        height_mm = self._require_numeric(data, "height_mm", section="chip")

        substrate = str(data.get("substrate", "silicon"))
        layers = self._parse_layers(data.get("layers"))

        return ChipNode(
            name=name,
            width_mm=width_mm,
            height_mm=height_mm,
            substrate=substrate,
            layers=layers,
        )

    def _parse_layers(self, data: Any) -> list[LayerNode]:
        """Parse an optional list of layer definitions.

        Args:
            data: Raw value under the ``chip.layers`` key, or ``None``.

        Returns:
            List of :class:`LayerNode` (empty if *data* is ``None``).
        """
        if data is None:
            return []

        if not isinstance(data, list):
            raise QCLangSyntaxError(
                f"'chip.layers' must be a list, got {type(data).__name__}"
            )

        layers: list[LayerNode] = []
        for idx, entry in enumerate(data):
            if not isinstance(entry, dict):
                raise QCLangSyntaxError(
                    f"Layer entry {idx} must be a mapping, got {type(entry).__name__}"
                )
            name = self._require_field(entry, "name", str, section=f"layers[{idx}]")
            material = str(entry.get("material", "niobium"))
            thickness_nm = float(entry.get("thickness_nm", 200.0))
            layers.append(
                LayerNode(name=name, material=material, thickness_nm=thickness_nm)
            )
        return layers

    # ── Qubits ──────────────────────────────────────────────────────────

    def _parse_qubits(self, data: Any) -> list[QubitNode]:
        """Parse the ``qubits`` section.

        Args:
            data: Raw value under the ``qubits`` key.

        Returns:
            List of :class:`QubitNode`.

        Raises:
            QCLangSyntaxError: If the section is missing or malformed.
        """
        if data is None:
            raise QCLangSyntaxError(
                "Missing 'qubits' section – at least one qubit must be defined"
            )

        if not isinstance(data, list):
            raise QCLangSyntaxError(
                f"'qubits' section must be a list, got {type(data).__name__}"
            )

        if len(data) == 0:
            raise QCLangSyntaxError("'qubits' list must not be empty")

        qubits: list[QubitNode] = []
        for idx, entry in enumerate(data):
            qubits.append(self._parse_single_qubit(entry, idx))
        return qubits

    def _parse_single_qubit(self, data: Any, idx: int) -> QubitNode:
        """Parse a single qubit entry.

        Args:
            data: Raw mapping for one qubit.
            idx: 0-based index of the qubit in the source list.

        Returns:
            A :class:`QubitNode`.
        """
        section = f"qubits[{idx}]"
        if not isinstance(data, dict):
            raise QCLangSyntaxError(
                f"Qubit entry {idx} must be a mapping, got {type(data).__name__}"
            )

        qubit_id = self._require_field(data, "id", str, section=section)
        frequency_ghz = self._require_numeric(data, "frequency_ghz", section=section)
        anharmonicity_mhz = float(data.get("anharmonicity_mhz", -330.0))

        junction = self._parse_junction(data.get("junction"), section)

        return QubitNode(
            id=qubit_id,
            frequency_ghz=frequency_ghz,
            anharmonicity_mhz=anharmonicity_mhz,
            junction=junction,
        )

    def _parse_junction(self, data: Any, parent_section: str) -> JunctionNode:
        """Parse an optional junction sub-section.

        Args:
            data: Raw junction mapping, or ``None``.
            parent_section: Parent section label for error messages.

        Returns:
            A :class:`JunctionNode` (defaults used when *data* is ``None``).
        """
        if data is None:
            return JunctionNode()

        if not isinstance(data, dict):
            raise QCLangSyntaxError(
                f"'{parent_section}.junction' must be a mapping, "
                f"got {type(data).__name__}"
            )

        junction_type = str(data.get("type", "single"))
        if junction_type not in ("single", "squid"):
            raise QCLangSyntaxError(
                f"Invalid junction type '{junction_type}' in {parent_section}; "
                f"expected 'single' or 'squid'"
            )

        ej_ghz = self._optional_numeric(data, "ej_ghz", section=f"{parent_section}.junction")
        ec_mhz = self._optional_numeric(data, "ec_mhz", section=f"{parent_section}.junction")

        return JunctionNode(type=junction_type, ej_ghz=ej_ghz, ec_mhz=ec_mhz)

    # ── Resonators ──────────────────────────────────────────────────────

    def _parse_resonators(self, data: Any) -> list[ResonatorNode]:
        """Parse the optional ``resonators`` section.

        Args:
            data: Raw value under the ``resonators`` key, or ``None``.

        Returns:
            List of :class:`ResonatorNode` (empty if *data* is ``None``).
        """
        if data is None:
            return []

        if not isinstance(data, list):
            raise QCLangSyntaxError(
                f"'resonators' section must be a list, got {type(data).__name__}"
            )

        resonators: list[ResonatorNode] = []
        for idx, entry in enumerate(data):
            resonators.append(self._parse_single_resonator(entry, idx))
        return resonators

    def _parse_single_resonator(self, data: Any, idx: int) -> ResonatorNode:
        """Parse a single resonator entry.

        Args:
            data: Raw mapping for one resonator.
            idx: 0-based index in the source list.

        Returns:
            A :class:`ResonatorNode`.
        """
        section = f"resonators[{idx}]"
        if not isinstance(data, dict):
            raise QCLangSyntaxError(
                f"Resonator entry {idx} must be a mapping, got {type(data).__name__}"
            )

        res_id = self._require_field(data, "id", str, section=section)
        frequency_ghz = self._require_numeric(data, "frequency_ghz", section=section)
        target_qubit = self._require_field(data, "target_qubit", str, section=section)

        coupling_type = str(data.get("coupling_type", "capacitive"))
        if coupling_type not in ("capacitive", "inductive"):
            raise QCLangSyntaxError(
                f"Invalid coupling_type '{coupling_type}' in {section}; "
                f"expected 'capacitive' or 'inductive'"
            )

        coupling_strength_mhz = float(data.get("coupling_strength_mhz", 50.0))

        return ResonatorNode(
            id=res_id,
            frequency_ghz=frequency_ghz,
            target_qubit=target_qubit,
            coupling_type=coupling_type,
            coupling_strength_mhz=coupling_strength_mhz,
        )

    # ── Couplers ────────────────────────────────────────────────────────

    def _parse_couplers(self, data: Any) -> list[CouplerNode]:
        """Parse the optional ``couplers`` section.

        Args:
            data: Raw value under the ``couplers`` key, or ``None``.

        Returns:
            List of :class:`CouplerNode` (empty if *data* is ``None``).
        """
        if data is None:
            return []

        if not isinstance(data, list):
            raise QCLangSyntaxError(
                f"'couplers' section must be a list, got {type(data).__name__}"
            )

        couplers: list[CouplerNode] = []
        for idx, entry in enumerate(data):
            couplers.append(self._parse_single_coupler(entry, idx))
        return couplers

    def _parse_single_coupler(self, data: Any, idx: int) -> CouplerNode:
        """Parse a single coupler entry.

        Args:
            data: Raw mapping for one coupler.
            idx: 0-based index in the source list.

        Returns:
            A :class:`CouplerNode`.
        """
        section = f"couplers[{idx}]"
        if not isinstance(data, dict):
            raise QCLangSyntaxError(
                f"Coupler entry {idx} must be a mapping, got {type(data).__name__}"
            )

        coupler_id = self._require_field(data, "id", str, section=section)
        source_qubit = self._require_field(data, "source_qubit", str, section=section)
        target_qubit = self._require_field(data, "target_qubit", str, section=section)
        strength_mhz = self._require_numeric(data, "strength_mhz", section=section)

        coupler_type = str(data.get("coupler_type", "capacitive"))
        if coupler_type not in ("capacitive", "bus_resonator"):
            raise QCLangSyntaxError(
                f"Invalid coupler_type '{coupler_type}' in {section}; "
                f"expected 'capacitive' or 'bus_resonator'"
            )

        return CouplerNode(
            id=coupler_id,
            source_qubit=source_qubit,
            target_qubit=target_qubit,
            strength_mhz=strength_mhz,
            coupler_type=coupler_type,
        )

    # ── Field extraction helpers ────────────────────────────────────────

    @staticmethod
    def _require_field(
        data: dict[str, Any],
        key: str,
        expected_type: type,
        *,
        section: str,
    ) -> Any:
        """Extract a mandatory field, raising on absence or type mismatch.

        Args:
            data: The mapping to extract from.
            key: The key to look up.
            expected_type: Expected Python type (e.g. ``str``).
            section: Section label for error context.

        Returns:
            The field value, cast to *expected_type*.

        Raises:
            QCLangSyntaxError: If the key is missing or the value
                cannot be coerced to *expected_type*.
        """
        if key not in data:
            raise QCLangSyntaxError(
                f"Missing required field '{key}' in '{section}'"
            )

        value = data[key]

        if value is None:
            raise QCLangSyntaxError(
                f"Field '{key}' in '{section}' must not be null"
            )

        try:
            return expected_type(value)
        except (TypeError, ValueError) as exc:
            raise QCLangSyntaxError(
                f"Field '{key}' in '{section}' must be {expected_type.__name__}, "
                f"got {type(value).__name__}: {exc}"
            ) from exc

    @staticmethod
    def _require_numeric(
        data: dict[str, Any],
        key: str,
        *,
        section: str,
    ) -> float:
        """Extract a mandatory numeric field as ``float``.

        Args:
            data: The mapping to extract from.
            key: The key to look up.
            section: Section label for error context.

        Returns:
            The field value as a ``float``.

        Raises:
            QCLangSyntaxError: If the key is missing or the value is
                not numeric.
        """
        if key not in data:
            raise QCLangSyntaxError(
                f"Missing required numeric field '{key}' in '{section}'"
            )

        value = data[key]

        if value is None:
            raise QCLangSyntaxError(
                f"Field '{key}' in '{section}' must not be null"
            )

        if not isinstance(value, (int, float)):
            raise QCLangSyntaxError(
                f"Field '{key}' in '{section}' must be numeric, "
                f"got {type(value).__name__}"
            )

        return float(value)

    @staticmethod
    def _optional_numeric(
        data: dict[str, Any],
        key: str,
        *,
        section: str,
    ) -> float | None:
        """Extract an optional numeric field as ``float`` or ``None``.

        Args:
            data: The mapping to extract from.
            key: The key to look up.
            section: Section label for error context.

        Returns:
            The field value as a ``float``, or ``None`` if absent.

        Raises:
            QCLangSyntaxError: If the value is present but not numeric.
        """
        if key not in data or data[key] is None:
            return None

        value = data[key]

        if not isinstance(value, (int, float)):
            raise QCLangSyntaxError(
                f"Field '{key}' in '{section}' must be numeric, "
                f"got {type(value).__name__}"
            )

        return float(value)
