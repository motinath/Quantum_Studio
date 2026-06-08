"""
End-to-end Quantum Studio pipeline.

Compiles a ``.qclang`` specification into a placed design, validates
all chip rules, and exports Qiskit Metal Python code plus optional GDS.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from quantum_studio.compiler.lexer import QCLangLexer
from quantum_studio.compiler.parser import QCLangParser
from quantum_studio.compiler.validator import QCLangValidator
from quantum_studio.config import get_settings
from quantum_studio.export.metal_codegen import MetalCodeGenerator
from quantum_studio.layout.placement import PlacementEngine
from quantum_studio.layout.routing import RoutingEngine
from quantum_studio.models.design import QuantumDesign
from quantum_studio.rules.chip_rules import ChipRules
from quantum_studio.utils.logging import setup_logging, get_logger

logger = get_logger("pipeline")


@dataclass
class PipelineResult:
    """Result of a full pipeline run."""

    design: QuantumDesign
    warnings: list[str] = field(default_factory=list)
    metal_script_path: Path | None = None
    rules_report_path: Path | None = None
    output_dir: Path | None = None

    def summary(self) -> str:
        lines = [
            self.design.summary(),
            "",
            f"Warnings: {len(self.warnings)}",
        ]
        if self.metal_script_path:
            lines.append(f"Metal script: {self.metal_script_path}")
        if self.rules_report_path:
            lines.append(f"Rules report: {self.rules_report_path}")
        return "\n".join(lines)


class ChipPipeline:
    """Build a superconducting quantum chip from a QCLang specification.

    Pipeline stages:
        1. Lex + parse + validate QCLang
        2. Build ``QuantumDesign`` IR
        3. Place components (topology-aware)
        4. Route CPW connections
        5. Export Qiskit Metal Python script
        6. Export chip rules catalog

    Example::

        pipeline = ChipPipeline()
        result = pipeline.run(Path("examples/two_qubit.qclang"))
        print(result.summary())
    """

    def __init__(self, output_dir: Path | str | None = None) -> None:
        settings = get_settings()
        setup_logging(settings.log_level)
        self.output_dir = Path(output_dir or settings.output_dir)

    def run(
        self,
        qclang_path: Path | str,
        *,
        export_metal: bool = True,
        export_rules: bool = True,
    ) -> PipelineResult:
        """Execute the full chip build pipeline.

        Args:
            qclang_path: Path to a ``.qclang`` YAML specification.
            export_metal: Write Qiskit Metal Python script.
            export_rules: Write JSON chip rules catalog.

        Returns:
            :class:`PipelineResult` with design and output paths.

        Raises:
            QCLangSyntaxError: Invalid QCLang structure.
            QCLangValidationError: Parameter out of physical range.
            ValueError: Design consistency failure.
        """
        path = Path(qclang_path).resolve()
        logger.info("Running chip pipeline for %s", path)

        # ── Stage 1: Compile ────────────────────────────────────────────
        raw = QCLangLexer().load_file(path)
        spec = QCLangParser().parse(raw)
        warnings = QCLangValidator().validate(spec)
        logger.info("QCLang validated: %r", spec)

        # ── Stage 2: IR ─────────────────────────────────────────────────
        design = QuantumDesign.from_circuit_spec(spec)
        design.validate_design()
        design.metadata["source_file"] = str(path)

        # ── Stage 3: Place ──────────────────────────────────────────────
        design = PlacementEngine(design).place()

        # ── Stage 4: Route ──────────────────────────────────────────────
        design, routes = RoutingEngine(design).route()
        design.metadata["route_count"] = len(routes)

        # ── Stage 5: Export ─────────────────────────────────────────────
        out_dir = self.output_dir / design.chip.name
        out_dir.mkdir(parents=True, exist_ok=True)

        metal_path: Path | None = None
        if export_metal:
            gen = MetalCodeGenerator(design)
            result = gen.generate()
            warnings.extend(result.warnings or [])
            safe_name = design.chip.name.replace(" ", "_").replace("-", "_")
            metal_path = result.write(out_dir / f"{safe_name}_metal.py")

        rules_path: Path | None = None
        if export_rules:
            rules_path = out_dir / "chip_rules.json"
            rules_path.write_text(
                json.dumps(ChipRules.to_json(), indent=2),
                encoding="utf-8",
            )
            (out_dir / "chip_rules_summary.txt").write_text(
                ChipRules.summary(), encoding="utf-8"
            )

        design.status = "exported"
        design.metadata["metal_script"] = str(metal_path) if metal_path else None

        logger.info(
            "Pipeline complete: %d qubits, %d resonators, %d couplers",
            len(design.qubits),
            len(design.resonators),
            len(design.couplers),
        )

        return PipelineResult(
            design=design,
            warnings=warnings,
            metal_script_path=metal_path,
            rules_report_path=rules_path,
            output_dir=out_dir,
        )

    @staticmethod
    def list_rules() -> str:
        """Return human-readable catalog of all chip build rules."""
        return ChipRules.summary()
