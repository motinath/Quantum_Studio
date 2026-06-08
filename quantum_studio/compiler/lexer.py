"""
QCLang Lexer – YAML front-end for ``.qclang`` files.

Responsibilities:
    1. Load YAML source from a string or a file path.
    2. Validate that the result is a mapping with the expected top-level keys.
    3. Return the raw ``dict`` for consumption by :class:`QCLangParser`.

The lexer intentionally does *not* interpret field values – that is the
parser's job. It only enforces structural soundness at the document level.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from quantum_studio.compiler.errors import QCLangFileError, QCLangSyntaxError
from quantum_studio.utils.logging import get_logger

logger = get_logger("compiler.lexer")

# Keys that MUST appear in every valid .qclang document.
_REQUIRED_KEYS: frozenset[str] = frozenset({"chip", "qubits"})

# Keys that MAY appear.  Anything outside this set is flagged.
_OPTIONAL_KEYS: frozenset[str] = frozenset({"resonators", "couplers"})

_ALL_KNOWN_KEYS: frozenset[str] = _REQUIRED_KEYS | _OPTIONAL_KEYS


class QCLangLexer:
    """Load and structurally validate QCLang YAML source.

    Usage::

        lexer = QCLangLexer()
        raw = lexer.load_file(Path("my_design.qclang"))
        # raw is now a validated dict ready for the parser.
    """

    # ── Public API ──────────────────────────────────────────────────────

    def load(self, source: str) -> dict[str, Any]:
        """Parse a YAML string and validate its top-level structure.

        Args:
            source: Raw YAML text (the contents of a ``.qclang`` file).

        Returns:
            Validated ``dict`` with top-level keys such as ``chip``,
            ``qubits``, and optionally ``resonators`` / ``couplers``.

        Raises:
            QCLangSyntaxError: If the YAML is malformed or required
                top-level keys are missing.
        """
        logger.debug("Lexing QCLang source (%d chars)", len(source))
        raw = self._parse_yaml(source)
        raw = self._normalize_aliases(raw)
        self._validate_top_level(raw, source)
        logger.info(
            "Lexing complete – found keys: %s",
            sorted(raw.keys()),
        )
        return raw

    def load_file(self, path: Path) -> dict[str, Any]:
        """Read a ``.qclang`` file from disk and lex its contents.

        Args:
            path: Filesystem path to the YAML source file.

        Returns:
            Validated top-level ``dict``.

        Raises:
            QCLangFileError: If the file cannot be read.
            QCLangSyntaxError: If the YAML content is invalid.
        """
        resolved = Path(path).resolve()
        logger.debug("Loading QCLang file: %s", resolved)

        try:
            source = resolved.read_text(encoding="utf-8")
        except FileNotFoundError:
            raise QCLangFileError(
                f"QCLang source file not found: {resolved}",
                path=str(resolved),
            )
        except PermissionError:
            raise QCLangFileError(
                f"Permission denied reading file: {resolved}",
                path=str(resolved),
            )
        except OSError as exc:
            raise QCLangFileError(
                f"I/O error reading file: {exc}",
                path=str(resolved),
            )

        if not source.strip():
            raise QCLangSyntaxError(
                "QCLang source file is empty",
                line=1,
                column=1,
            )

        return self.load(source)

    # ── Internal helpers ────────────────────────────────────────────────

    @staticmethod
    def _normalize_aliases(raw: dict[str, Any]) -> dict[str, Any]:
        """Map short QCLang field aliases to canonical parser keys."""
        chip = raw.get("chip")
        if isinstance(chip, dict):
            if "width" in chip and "width_mm" not in chip:
                chip["width_mm"] = chip.pop("width")
            if "height" in chip and "height_mm" not in chip:
                chip["height_mm"] = chip.pop("height")

        qubits = raw.get("qubits")
        if isinstance(qubits, list):
            for entry in qubits:
                if not isinstance(entry, dict):
                    continue
                if "frequency" in entry and "frequency_ghz" not in entry:
                    entry["frequency_ghz"] = entry.pop("frequency")
                if "anharmonicity" in entry and "anharmonicity_mhz" not in entry:
                    entry["anharmonicity_mhz"] = entry.pop("anharmonicity")

        resonators = raw.get("resonators")
        if isinstance(resonators, list):
            for entry in resonators:
                if not isinstance(entry, dict):
                    continue
                if "target" in entry and "target_qubit" not in entry:
                    entry["target_qubit"] = entry.pop("target")
                if "frequency" in entry and "frequency_ghz" not in entry:
                    entry["frequency_ghz"] = entry.pop("frequency")
                if "coupling_strength" in entry and "coupling_strength_mhz" not in entry:
                    entry["coupling_strength_mhz"] = entry.pop("coupling_strength")

        couplers = raw.get("couplers")
        if isinstance(couplers, list):
            for entry in couplers:
                if not isinstance(entry, dict):
                    continue
                if "source" in entry and "source_qubit" not in entry:
                    entry["source_qubit"] = entry.pop("source")
                if "target" in entry and "target_qubit" not in entry:
                    entry["target_qubit"] = entry.pop("target")
                if "strength" in entry and "strength_mhz" not in entry:
                    entry["strength_mhz"] = entry.pop("strength")
                if "type" in entry and "coupler_type" not in entry:
                    entry["coupler_type"] = entry.pop("type")

        return raw

    def _parse_yaml(self, source: str) -> dict[str, Any]:
        """Attempt to parse *source* as YAML and return a dict.

        Raises:
            QCLangSyntaxError: On any YAML parsing failure or if the
                document root is not a mapping.
        """
        try:
            data = yaml.safe_load(source)
        except yaml.YAMLError as exc:
            line: int | None = None
            column: int | None = None
            if hasattr(exc, "problem_mark") and exc.problem_mark is not None:
                line = exc.problem_mark.line + 1  # YAML uses 0-indexed
                column = exc.problem_mark.column + 1

            raise QCLangSyntaxError(
                f"Invalid YAML: {exc}",
                line=line,
                column=column,
                source_snippet=self._snippet_around(source, line),
            ) from exc

        if data is None:
            raise QCLangSyntaxError(
                "QCLang source is empty or contains only comments",
                line=1,
                column=1,
            )

        if not isinstance(data, dict):
            raise QCLangSyntaxError(
                f"Expected a YAML mapping at document root, got {type(data).__name__}",
                line=1,
                column=1,
            )

        return data

    def _validate_top_level(
        self, raw: dict[str, Any], source: str
    ) -> None:
        """Ensure required keys are present and warn on unknown keys.

        Raises:
            QCLangSyntaxError: If any required key is missing.
        """
        present = set(raw.keys())
        missing = _REQUIRED_KEYS - present
        if missing:
            raise QCLangSyntaxError(
                f"Missing required top-level section(s): {sorted(missing)}. "
                f"A valid .qclang file must contain: {sorted(_REQUIRED_KEYS)}",
                line=1,
                column=1,
                source_snippet=self._snippet_around(source, 1),
            )

        unknown = present - _ALL_KNOWN_KEYS
        if unknown:
            logger.warning(
                "Unknown top-level key(s) will be ignored: %s",
                sorted(unknown),
            )

    @staticmethod
    def _snippet_around(
        source: str,
        line: int | None,
        context: int = 3,
    ) -> str | None:
        """Extract a few lines of *source* around *line* for diagnostics.

        Args:
            source: Full source text.
            line: 1-indexed line number (``None`` → return ``None``).
            context: Number of lines to show above and below *line*.

        Returns:
            Substring of *source* centred on *line*, or ``None``.
        """
        if line is None:
            return None

        lines = source.splitlines()
        start = max(0, line - 1 - context)
        end = min(len(lines), line + context)
        return "\n".join(lines[start:end])
