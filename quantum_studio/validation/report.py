"""
DRC report data model.

Provides a Pydantic-based report container for design-rule-check results,
with human-readable text, JSON, and one-line summary serialization.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field, computed_field

from quantum_studio.utils.logging import get_logger

logger = get_logger("validation.report")


class ViolationRecord(BaseModel):
    """Serialized representation of a single DRC violation.

    Attributes:
        rule_name: Name of the violated DRC rule.
        severity: Severity level (``'error'``, ``'warning'``, or ``'info'``).
        component: Component name or ``'global'``.
        message: Human-readable violation description.
        suggestion: Optional fix suggestion.
        location_mm: Optional ``[x, y]`` in mm, or *None*.
    """

    rule_name: str
    severity: str
    component: str
    message: str
    suggestion: str = ""
    location_mm: list[float] | None = None


class DRCReport(BaseModel):
    """Complete report produced by the DRC validator.

    Attributes:
        status: Overall result — ``'PASS'`` if no error-severity violations,
            ``'FAIL'`` otherwise.
        violations: List of serialized violation records.
        total_violations: Total number of violations (all severities).
        errors: Count of error-severity violations.
        warnings: Count of warning-severity violations.
        infos: Count of info-severity violations.
        rules_checked: Number of DRC rules evaluated.
        rules_passed: Number of rules that produced zero violations.
        timestamp: ISO-8601 timestamp of the report generation.
        design_name: Optional name of the design that was checked.
    """

    status: Literal["PASS", "FAIL"]
    violations: list[ViolationRecord] = Field(default_factory=list)
    total_violations: int = 0
    errors: int = 0
    warnings: int = 0
    infos: int = 0
    rules_checked: int = 0
    rules_passed: int = 0
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    design_name: str = ""

    # ── Serialisation helpers ───────────────────────────────────────────

    def to_text(self) -> str:
        """Produce a human-readable multi-line text report.

        Returns:
            Formatted text string suitable for console output or log files.
        """
        lines: list[str] = [
            "=" * 72,
            f"  DESIGN RULE CHECK REPORT — {self.status}",
            "=" * 72,
        ]

        if self.design_name:
            lines.append(f"  Design : {self.design_name}")
        lines.append(f"  Date   : {self.timestamp}")
        lines.append(f"  Rules  : {self.rules_passed}/{self.rules_checked} passed")
        lines.append(
            f"  Issues : {self.errors} error(s), {self.warnings} warning(s), "
            f"{self.infos} info(s)"
        )
        lines.append("-" * 72)

        if not self.violations:
            lines.append("  ✓ No violations found. Design passes all checks.")
        else:
            for idx, v in enumerate(self.violations, 1):
                sev_icon = {
                    "error": "✗",
                    "warning": "⚠",
                    "info": "ℹ",
                }.get(v.severity, "?")

                lines.append(
                    f"  {idx:>3}. [{v.severity.upper():^7}] {sev_icon}  "
                    f"{v.rule_name} — {v.component}"
                )
                lines.append(f"       {v.message}")
                if v.suggestion:
                    lines.append(f"       → {v.suggestion}")
                if v.location_mm is not None:
                    lines.append(
                        f"       @ ({v.location_mm[0]:.3f}, "
                        f"{v.location_mm[1]:.3f}) mm"
                    )

        lines.append("=" * 72)
        return "\n".join(lines)

    def to_json(self, indent: int = 2) -> str:
        """Serialize the full report to a JSON string.

        Args:
            indent: JSON indentation level.

        Returns:
            JSON-encoded report string.
        """
        return self.model_dump_json(indent=indent)

    def summary(self) -> str:
        """Return a one-line summary of the DRC result.

        Returns:
            Compact summary string, e.g.
            ``"DRC PASS — 0 violations (5 rules checked)"`` or
            ``"DRC FAIL — 3 errors, 1 warning (10 rules checked)"``.
        """
        if self.status == "PASS":
            return (
                f"DRC PASS — {self.total_violations} violation(s) "
                f"({self.rules_checked} rules checked)"
            )
        return (
            f"DRC FAIL — {self.errors} error(s), {self.warnings} warning(s) "
            f"({self.rules_checked} rules checked)"
        )

    def get_errors(self) -> list[ViolationRecord]:
        """Return only error-severity violations.

        Returns:
            Filtered list of error violations.
        """
        return [v for v in self.violations if v.severity == "error"]

    def get_warnings(self) -> list[ViolationRecord]:
        """Return only warning-severity violations.

        Returns:
            Filtered list of warning violations.
        """
        return [v for v in self.violations if v.severity == "warning"]

    def passed(self) -> bool:
        """Return *True* if the design passes DRC (no error-level violations).

        Returns:
            Boolean pass/fail status.
        """
        return self.status == "PASS"
