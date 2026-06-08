"""
Exception hierarchy for the QCLang compiler.

Provides structured, context-rich error classes for every phase of
QCLang compilation: lexing, parsing, validation, and file I/O.

Example:
    >>> raise QCLangSyntaxError(
    ...     "Missing required key 'qubits'",
    ...     line=5,
    ...     column=1,
    ...     source_snippet="chip:\\n  width_mm: 10",
    ... )
"""

from __future__ import annotations

from typing import Optional


class QCLangError(Exception):
    """Base exception for all QCLang compiler errors.

    Attributes:
        message: Human-readable error description.
        line: 1-indexed line number where the error occurred, if known.
        column: 1-indexed column number where the error occurred, if known.
        source_snippet: Fragment of source text surrounding the error site.
    """

    def __init__(
        self,
        message: str,
        *,
        line: Optional[int] = None,
        column: Optional[int] = None,
        source_snippet: Optional[str] = None,
    ) -> None:
        self.message = message
        self.line = line
        self.column = column
        self.source_snippet = source_snippet
        super().__init__(self._format())

    # ── Formatting helpers ──────────────────────────────────────────────

    def _format(self) -> str:
        """Build the full, human-readable error string."""
        parts: list[str] = [self._error_label()]

        location = self._format_location()
        if location:
            parts.append(location)

        parts.append(self.message)

        if self.source_snippet:
            parts.append(self._format_snippet())

        return "\n".join(parts)

    def _error_label(self) -> str:
        """Return the error kind label used in the formatted output.

        Subclasses override this to provide a specific label such as
        ``SyntaxError`` or ``SemanticError``.
        """
        return "QCLangError"

    def _format_location(self) -> str:
        """Format the ``line:column`` location string.

        Returns:
            A string like ``  --> line 12, column 4``, or an empty string
            when neither *line* nor *column* is available.
        """
        if self.line is not None and self.column is not None:
            return f"  --> line {self.line}, column {self.column}"
        if self.line is not None:
            return f"  --> line {self.line}"
        return ""

    def _format_snippet(self) -> str:
        """Indent and frame the source snippet for display.

        Returns:
            A block like::

                  |
                5 | chip:
                6 |   width_mm: 10
                  |

        If *line* is unknown the lines are numbered starting from 1.
        """
        if not self.source_snippet:
            return ""

        lines = self.source_snippet.splitlines()
        start_line = (self.line or 1) - min(len(lines) - 1, 2)
        start_line = max(start_line, 1)

        width = len(str(start_line + len(lines) - 1))
        border = " " * width + " |"

        formatted_lines: list[str] = [border]
        for idx, content in enumerate(lines):
            line_no = start_line + idx
            formatted_lines.append(f"{line_no:>{width}} | {content}")
        formatted_lines.append(border)

        return "\n".join(formatted_lines)

    def __repr__(self) -> str:
        cls = type(self).__name__
        parts = [repr(self.message)]
        if self.line is not None:
            parts.append(f"line={self.line}")
        if self.column is not None:
            parts.append(f"column={self.column}")
        return f"{cls}({', '.join(parts)})"


class QCLangSyntaxError(QCLangError):
    """Raised when QCLang source is syntactically malformed.

    Typical causes:
    - Invalid YAML structure
    - Missing required top-level sections (``chip``, ``qubits``)
    - Wrong data types for expected fields
    """

    def _error_label(self) -> str:
        return "QCLang SyntaxError"


class QCLangSemanticError(QCLangError):
    """Raised for semantic violations that pass syntax checks.

    Typical causes:
    - Resonator referencing a non-existent qubit
    - Coupler with source equal to target (self-coupling)
    - Duplicate component identifiers
    """

    def _error_label(self) -> str:
        return "QCLang SemanticError"


class QCLangValidationError(QCLangError):
    """Raised when parameter values violate physical constraints.

    Typical causes:
    - Qubit frequency outside [3.5, 8.0] GHz
    - Anharmonicity outside [-400, -150] MHz
    - Ej/Ec ratio outside transmon regime [20, 100]
    """

    def _error_label(self) -> str:
        return "QCLang ValidationError"


class QCLangFileError(QCLangError):
    """Raised for file-system I/O errors during source loading.

    Typical causes:
    - File not found
    - Permission denied
    - Encoding issues
    """

    def __init__(
        self,
        message: str,
        *,
        path: Optional[str] = None,
        line: Optional[int] = None,
        column: Optional[int] = None,
        source_snippet: Optional[str] = None,
    ) -> None:
        self.path = path
        super().__init__(
            message,
            line=line,
            column=column,
            source_snippet=source_snippet,
        )

    def _error_label(self) -> str:
        label = "QCLang FileError"
        if self.path:
            label += f" [{self.path}]"
        return label

    def __repr__(self) -> str:
        cls = type(self).__name__
        parts = [repr(self.message)]
        if self.path is not None:
            parts.append(f"path={self.path!r}")
        if self.line is not None:
            parts.append(f"line={self.line}")
        return f"{cls}({', '.join(parts)})"
