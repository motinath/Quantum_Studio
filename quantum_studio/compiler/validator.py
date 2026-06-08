"""
QCLang Validator – two-pass validation engine for :class:`CircuitSpec`.

Pass 1 – **Syntax validation**:
    Checks that all required fields are present, have correct types,
    qubit count is within [1, 5], and chip dimensions are positive.

Pass 2 – **Semantic validation**:
    Checks physical-range constraints (qubit frequency, anharmonicity,
    Ej/Ec ratio, resonator detuning, coupling strength), reference
    integrity (resonator → qubit, coupler → qubit), duplicate IDs,
    and self-coupling.

The validator *raises* on hard errors and *returns* a list of warning
strings for soft issues.
"""

from __future__ import annotations

from quantum_studio.compiler.ast_nodes import CircuitSpec
from quantum_studio.compiler.errors import (
    QCLangSemanticError,
    QCLangSyntaxError,
    QCLangValidationError,
)
from quantum_studio.config import (
    CouplerParameterRanges,
    PlacementConfig,
    QubitParameterRanges,
    ResonatorParameterRanges,
    get_settings,
)
from quantum_studio.utils.logging import get_logger

logger = get_logger("compiler.validator")


class QCLangValidator:
    """Validate a :class:`CircuitSpec` AST in two passes.

    Usage::

        validator = QCLangValidator()
        warnings = validator.validate(spec)
        for w in warnings:
            print("⚠", w)

    The validator pulls physical parameter ranges from
    :func:`quantum_studio.config.get_settings` so that they can be
    overridden via environment variables at run-time.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._qubit_ranges: QubitParameterRanges = settings.qubit_ranges
        self._resonator_ranges: ResonatorParameterRanges = settings.resonator_ranges
        self._coupler_ranges: CouplerParameterRanges = settings.coupler_ranges
        self._placement: PlacementConfig = settings.placement

    # ── Public API ──────────────────────────────────────────────────────

    def validate(self, spec: CircuitSpec) -> list[str]:
        """Run both validation passes on *spec*.

        Args:
            spec: The :class:`CircuitSpec` AST to validate.

        Returns:
            A list of warning strings (may be empty).

        Raises:
            QCLangSyntaxError: For structural / type errors.
            QCLangSemanticError: For reference or uniqueness violations.
            QCLangValidationError: For parameter-range violations.
        """
        warnings: list[str] = []
        logger.debug("Starting validation of %r", spec)

        self._pass_syntax(spec, warnings)
        self._pass_semantic(spec, warnings)

        if warnings:
            logger.warning(
                "Validation completed with %d warning(s)", len(warnings)
            )
        else:
            logger.info("Validation passed – no warnings")

        return warnings

    # ── Pass 1: Syntax validation ───────────────────────────────────────

    def _pass_syntax(self, spec: CircuitSpec, warnings: list[str]) -> None:
        """Structural and type-level checks.

        Raises:
            QCLangSyntaxError: On any structural failure.
        """
        # -- Chip dimensions -----------------------------------------------
        if spec.chip.width_mm <= 0:
            raise QCLangSyntaxError(
                f"Chip width must be positive, got {spec.chip.width_mm} mm"
            )
        if spec.chip.height_mm <= 0:
            raise QCLangSyntaxError(
                f"Chip height must be positive, got {spec.chip.height_mm} mm"
            )

        # -- Qubit count ---------------------------------------------------
        qubit_count = len(spec.qubits)
        max_qubits = self._placement.max_qubits

        if qubit_count < 1:
            raise QCLangSyntaxError(
                "At least 1 qubit must be defined"
            )
        if qubit_count > max_qubits:
            raise QCLangSyntaxError(
                f"Too many qubits ({qubit_count}); "
                f"maximum supported is {max_qubits}"
            )

        # -- Required string fields ----------------------------------------
        for qubit in spec.qubits:
            if not qubit.id or not qubit.id.strip():
                raise QCLangSyntaxError("Qubit 'id' must be a non-empty string")

        for res in spec.resonators:
            if not res.id or not res.id.strip():
                raise QCLangSyntaxError("Resonator 'id' must be a non-empty string")
            if not res.target_qubit or not res.target_qubit.strip():
                raise QCLangSyntaxError("Resonator 'target_qubit' must be a non-empty string")

        for coup in spec.couplers:
            if not coup.id or not coup.id.strip():
                raise QCLangSyntaxError("Coupler 'id' must be a non-empty string")
            if not coup.source_qubit or not coup.source_qubit.strip():
                raise QCLangSyntaxError("Coupler 'source_qubit' must be a non-empty string")
            if not coup.target_qubit or not coup.target_qubit.strip():
                raise QCLangSyntaxError("Coupler 'target_qubit' must be a non-empty string")

        # -- Junction type -------------------------------------------------
        for qubit in spec.qubits:
            if qubit.junction.type not in ("single", "squid"):
                raise QCLangSyntaxError(
                    f"Qubit '{qubit.id}': invalid junction type "
                    f"'{qubit.junction.type}'; expected 'single' or 'squid'"
                )

    # ── Pass 2: Semantic validation ─────────────────────────────────────

    def _pass_semantic(self, spec: CircuitSpec, warnings: list[str]) -> None:
        """Physical-range, reference, and uniqueness checks.

        Raises:
            QCLangSemanticError: For reference or uniqueness problems.
            QCLangValidationError: For out-of-range parameters.
        """
        qubit_ids = set(spec.qubit_ids)

        self._check_duplicate_ids(spec)
        self._check_qubit_parameters(spec, warnings)
        self._check_resonator_parameters(spec, qubit_ids, warnings)
        self._check_coupler_parameters(spec, qubit_ids, warnings)

    # -- Duplicate ID checks -----------------------------------------------

    def _check_duplicate_ids(self, spec: CircuitSpec) -> None:
        """Ensure no two components share the same ID.

        Raises:
            QCLangSemanticError: If any duplicate is found.
        """
        all_ids: list[str] = []
        seen: set[str] = set()

        for qubit in spec.qubits:
            all_ids.append(qubit.id)
        for res in spec.resonators:
            all_ids.append(res.id)
        for coup in spec.couplers:
            all_ids.append(coup.id)

        for component_id in all_ids:
            if component_id in seen:
                raise QCLangSemanticError(
                    f"Duplicate component ID '{component_id}'. "
                    f"All qubit, resonator, and coupler IDs must be unique."
                )
            seen.add(component_id)

    # -- Qubit parameter checks --------------------------------------------

    def _check_qubit_parameters(
        self, spec: CircuitSpec, warnings: list[str]
    ) -> None:
        """Validate qubit frequency, anharmonicity, and Ej/Ec ratio.

        Raises:
            QCLangValidationError: For out-of-range parameters.
        """
        qr = self._qubit_ranges

        for qubit in spec.qubits:
            # -- Frequency -------------------------------------------------
            if not (qr.min_frequency_ghz <= qubit.frequency_ghz <= qr.max_frequency_ghz):
                raise QCLangValidationError(
                    f"Qubit '{qubit.id}': frequency {qubit.frequency_ghz} GHz "
                    f"is outside the valid range "
                    f"[{qr.min_frequency_ghz}, {qr.max_frequency_ghz}] GHz"
                )

            # -- Anharmonicity ---------------------------------------------
            if not (
                qr.min_anharmonicity_mhz
                <= qubit.anharmonicity_mhz
                <= qr.max_anharmonicity_mhz
            ):
                raise QCLangValidationError(
                    f"Qubit '{qubit.id}': anharmonicity {qubit.anharmonicity_mhz} MHz "
                    f"is outside the valid range "
                    f"[{qr.min_anharmonicity_mhz}, {qr.max_anharmonicity_mhz}] MHz"
                )

            # -- Ej / Ec ratio (only when both are specified) --------------
            junc = qubit.junction
            if junc.ej_ghz is not None and junc.ec_mhz is not None:
                if junc.ec_mhz == 0:
                    raise QCLangValidationError(
                        f"Qubit '{qubit.id}': Ec must not be zero "
                        f"(division by zero in Ej/Ec ratio)"
                    )
                # Convert Ec from MHz to GHz for ratio calculation
                ec_ghz = junc.ec_mhz / 1000.0
                ratio = junc.ej_ghz / ec_ghz

                if not (qr.min_ej_ec_ratio <= ratio <= qr.max_ej_ec_ratio):
                    raise QCLangValidationError(
                        f"Qubit '{qubit.id}': Ej/Ec ratio = {ratio:.1f} "
                        f"is outside the transmon regime "
                        f"[{qr.min_ej_ec_ratio}, {qr.max_ej_ec_ratio}]. "
                        f"(Ej = {junc.ej_ghz} GHz, Ec = {junc.ec_mhz} MHz)"
                    )

            # -- Warn if only one of Ej/Ec is specified --------------------
            if (junc.ej_ghz is None) != (junc.ec_mhz is None):
                warnings.append(
                    f"Qubit '{qubit.id}': only one of Ej/Ec is specified; "
                    f"provide both for transmon-regime validation"
                )

    # -- Resonator parameter checks ----------------------------------------

    def _check_resonator_parameters(
        self,
        spec: CircuitSpec,
        qubit_ids: set[str],
        warnings: list[str],
    ) -> None:
        """Validate resonator frequency, references, and detuning.

        Raises:
            QCLangSemanticError: For invalid qubit references.
            QCLangValidationError: For out-of-range parameters.
        """
        rr = self._resonator_ranges

        for res in spec.resonators:
            # -- Frequency -------------------------------------------------
            if not (rr.min_frequency_ghz <= res.frequency_ghz <= rr.max_frequency_ghz):
                raise QCLangValidationError(
                    f"Resonator '{res.id}': frequency {res.frequency_ghz} GHz "
                    f"is outside the valid range "
                    f"[{rr.min_frequency_ghz}, {rr.max_frequency_ghz}] GHz"
                )

            # -- Target qubit reference ------------------------------------
            if res.target_qubit not in qubit_ids:
                raise QCLangSemanticError(
                    f"Resonator '{res.id}': target_qubit '{res.target_qubit}' "
                    f"does not match any defined qubit. "
                    f"Available qubits: {sorted(qubit_ids)}"
                )

            # -- Detuning: resonator freq > qubit freq ---------------------
            target = spec.get_qubit(res.target_qubit)
            if res.frequency_ghz <= target.frequency_ghz:
                raise QCLangValidationError(
                    f"Resonator '{res.id}': frequency ({res.frequency_ghz} GHz) "
                    f"must be higher than its target qubit '{target.id}' "
                    f"frequency ({target.frequency_ghz} GHz) for proper detuning"
                )

            # -- Coupling strength (informational warning) -----------------
            if not (rr.min_coupling_mhz <= res.coupling_strength_mhz <= rr.max_coupling_mhz):
                warnings.append(
                    f"Resonator '{res.id}': coupling strength "
                    f"{res.coupling_strength_mhz} MHz is outside the typical "
                    f"range [{rr.min_coupling_mhz}, {rr.max_coupling_mhz}] MHz"
                )

    # -- Coupler parameter checks ------------------------------------------

    def _check_coupler_parameters(
        self,
        spec: CircuitSpec,
        qubit_ids: set[str],
        warnings: list[str],
    ) -> None:
        """Validate coupler references, self-coupling, and strength.

        Raises:
            QCLangSemanticError: For invalid references or self-coupling.
            QCLangValidationError: For out-of-range coupling strengths.
        """
        cr = self._coupler_ranges

        for coup in spec.couplers:
            # -- Self-coupling ---------------------------------------------
            if coup.source_qubit == coup.target_qubit:
                raise QCLangSemanticError(
                    f"Coupler '{coup.id}': source_qubit and target_qubit are "
                    f"both '{coup.source_qubit}' – self-coupling is not allowed"
                )

            # -- Source reference -------------------------------------------
            if coup.source_qubit not in qubit_ids:
                raise QCLangSemanticError(
                    f"Coupler '{coup.id}': source_qubit '{coup.source_qubit}' "
                    f"does not match any defined qubit. "
                    f"Available qubits: {sorted(qubit_ids)}"
                )

            # -- Target reference -------------------------------------------
            if coup.target_qubit not in qubit_ids:
                raise QCLangSemanticError(
                    f"Coupler '{coup.id}': target_qubit '{coup.target_qubit}' "
                    f"does not match any defined qubit. "
                    f"Available qubits: {sorted(qubit_ids)}"
                )

            # -- Coupling strength ------------------------------------------
            if not (cr.min_strength_mhz <= coup.strength_mhz <= cr.max_strength_mhz):
                raise QCLangValidationError(
                    f"Coupler '{coup.id}': coupling strength "
                    f"{coup.strength_mhz} MHz is outside the physical range "
                    f"[{cr.min_strength_mhz}, {cr.max_strength_mhz}] MHz"
                )
