"""
DRC Validator engine.

Orchestrates all design-rule-check rules against a quantum chip design,
collecting violations and producing a :class:`DRCReport`.
"""

from __future__ import annotations

from typing import Any

from quantum_studio.config import FabricationDefaults
from quantum_studio.utils.logging import get_logger
from quantum_studio.validation.constraints import (
    ALL_RULE_CLASSES,
    DRCRule,
    Severity,
    Violation,
)
from quantum_studio.validation.report import DRCReport, ViolationRecord

logger = get_logger("validation.drc")


class DRCValidator:
    """Runs all DRC rules against a quantum chip design.

    The validator instantiates every registered :class:`DRCRule` subclass with
    the supplied (or default) :class:`FabricationDefaults`, evaluates them
    against the design, and aggregates the results into a :class:`DRCReport`.

    Args:
        constraints: Fabrication constraints to apply.  If *None*, sensible
            defaults are used.
        extra_rules: Additional :class:`DRCRule` instances to include beyond
            the built-in set.

    Example::

        validator = DRCValidator()
        report = validator.validate(design, geometry_dict, route_list)
        print(report.summary())
    """

    def __init__(
        self,
        constraints: FabricationDefaults | None = None,
        extra_rules: list[DRCRule] | None = None,
    ) -> None:
        self.constraints: FabricationDefaults = constraints or FabricationDefaults()
        self.rules: list[DRCRule] = self._build_rules()
        if extra_rules:
            self.rules.extend(extra_rules)

    # ── Rule construction ───────────────────────────────────────────────

    def _build_rules(self) -> list[DRCRule]:
        """Instantiate all built-in DRC rules with the current constraints.

        Returns:
            List of :class:`DRCRule` instances.
        """
        rules: list[DRCRule] = []
        for rule_cls in ALL_RULE_CLASSES:
            try:
                rules.append(rule_cls(constraints=self.constraints))
            except Exception:
                logger.exception(
                    "Failed to instantiate DRC rule %s", rule_cls.__name__
                )
        return rules

    # ── Validation entry-point ──────────────────────────────────────────

    def validate(
        self,
        design: Any,
        geometry: dict[str, Any],
        routes: list[Any],
        design_name: str = "",
    ) -> DRCReport:
        """Run all DRC rules against a design.

        Args:
            design: The ``QuantumDesign`` (or compatible dict/object)
                containing high-level design data such as qubits,
                resonators, couplers, and chip metadata.
            geometry: Mapping of component names to geometry dicts.  See
                :meth:`DRCRule.check` for the expected schema.
            routes: List of route dicts with ``name``, ``points_mm``,
                ``trace_width_um``, ``gap_um``, ``source``, and ``target``.
            design_name: Optional human-readable design name for the report.

        Returns:
            A fully-populated :class:`DRCReport`.
        """
        all_violations: list[Violation] = []
        rules_passed = 0

        for rule in self.rules:
            try:
                rule_violations = rule.check(design, geometry, routes)
            except Exception:
                logger.exception("Rule '%s' raised an exception.", rule.name)
                rule_violations = [
                    Violation(
                        rule_name=rule.name,
                        severity=Severity.ERROR,
                        component="global",
                        message=f"Rule '{rule.name}' failed with an internal error.",
                        suggestion="Check logs for the full traceback.",
                    )
                ]

            if not rule_violations:
                rules_passed += 1
            all_violations.extend(rule_violations)

        # Aggregate counts
        error_count = sum(1 for v in all_violations if v.severity == Severity.ERROR)
        warning_count = sum(1 for v in all_violations if v.severity == Severity.WARNING)
        info_count = sum(1 for v in all_violations if v.severity == Severity.INFO)

        status: str = "FAIL" if error_count > 0 else "PASS"

        # Serialize violations
        violation_records = [
            ViolationRecord(
                rule_name=v.rule_name,
                severity=v.severity.value,
                component=v.component,
                message=v.message,
                suggestion=v.suggestion,
                location_mm=list(v.location_mm) if v.location_mm is not None else None,
            )
            for v in all_violations
        ]

        report = DRCReport(
            status=status,  # type: ignore[arg-type]
            violations=violation_records,
            total_violations=len(all_violations),
            errors=error_count,
            warnings=warning_count,
            infos=info_count,
            rules_checked=len(self.rules),
            rules_passed=rules_passed,
            design_name=design_name,
        )

        logger.info("DRC complete: %s", report.summary())
        return report

    # ── Convenience helpers ─────────────────────────────────────────────

    def list_rules(self) -> list[dict[str, str]]:
        """Return metadata for all registered rules.

        Returns:
            List of dicts with ``name``, ``description``, and ``severity``
            keys.
        """
        return [
            {
                "name": rule.name,
                "description": rule.description,
                "severity": rule.severity.value,
            }
            for rule in self.rules
        ]

    def __repr__(self) -> str:
        return f"DRCValidator(rules={len(self.rules)})"
