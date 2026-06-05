"""
QCLang Lexer — tokenises .qc source text.

Grammar overview:
  chip <name>
    qubit <name> [key=value ...]
    coupler <name> connect(<q1>, <q2>) [key=value ...]
    readout <name> connect(<q>) [key=value ...]
    resonator <name> connect(<q>) [key=value ...]
  end

Supported attribute types: strings, floats, ints, booleans.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum, auto
from typing import Iterator


# ── Token types ──────────────────────────────────────────────────────────────

class TT(Enum):
    CHIP     = auto()
    END      = auto()
    QUBIT    = auto()
    COUPLER  = auto()
    READOUT  = auto()
    RESONATOR= auto()
    VARIABLE = auto()
    IDENT    = auto()
    EQ       = auto()
    LPAREN   = auto()
    RPAREN   = auto()
    COMMA    = auto()
    STRING   = auto()
    NUMBER   = auto()
    BOOL     = auto()
    CONNECT  = auto()
    NEWLINE  = auto()
    COMMENT  = auto()
    EOF      = auto()
    UNKNOWN  = auto()


@dataclass
class Token:
    type: TT
    value: str
    line: int
    col: int

    def __repr__(self) -> str:
        return f"Token({self.type.name}, {self.value!r}, {self.line}:{self.col})"


# ── Token patterns ────────────────────────────────────────────────────────────

_PATTERNS: list[tuple[TT, str]] = [
    (TT.COMMENT,   r"#[^\n]*"),
    (TT.CHIP,      r"\bchip\b"),
    (TT.END,       r"\bend\b"),
    (TT.QUBIT,     r"\bqubit\b"),
    (TT.COUPLER,   r"\bcoupler\b"),
    (TT.READOUT,   r"\breadout\b"),
    (TT.RESONATOR, r"\bresonator\b"),
    (TT.VARIABLE,  r"\bvariable\b"),
    (TT.CONNECT,   r"\bconnect\b"),
    (TT.BOOL,      r"\b(true|false|True|False)\b"),
    (TT.NUMBER,    r"-?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?"),
    (TT.STRING,    r'"[^"]*"'),
    (TT.IDENT,     r"[A-Za-z_][A-Za-z0-9_]*"),
    (TT.EQ,        r"="),
    (TT.LPAREN,    r"\("),
    (TT.RPAREN,    r"\)"),
    (TT.COMMA,     r","),
    (TT.NEWLINE,   r"\n"),
]

_MASTER = re.compile(
    "|".join(f"(?P<_{tt.name}>{pat})" for tt, pat in _PATTERNS)
)


# ── Lexer ─────────────────────────────────────────────────────────────────────

class LexerError(Exception):
    def __init__(self, message: str, line: int, col: int):
        super().__init__(f"[Lexer] line {line}:{col} — {message}")
        self.line = line
        self.col = col


def tokenise(source: str) -> list[Token]:
    """Tokenise QCLang source text.  Returns list of Tokens (comments excluded)."""
    tokens: list[Token] = []
    line = 1
    line_start = 0

    for mo in _MASTER.finditer(source):
        kind_name = mo.lastgroup[1:]  # strip leading underscore
        tt = TT[kind_name]
        value = mo.group()
        col = mo.start() - line_start + 1

        if tt == TT.COMMENT:
            # skip comments
            pass
        elif tt == TT.NEWLINE:
            line += 1
            line_start = mo.end()
        else:
            tokens.append(Token(tt, value, line, col))

        # advance position tracking
        if tt == TT.NEWLINE:
            pass  # already updated above

    # Handle characters not matched by any pattern
    pos = 0
    for mo in _MASTER.finditer(source):
        if mo.start() > pos:
            # gap = unrecognised character
            bad_char = source[pos:mo.start()].strip()
            if bad_char:
                # count line
                bad_line = source[:pos].count("\n") + 1
                bad_col = pos - source.rfind("\n", 0, pos)
                raise LexerError(f"Unexpected character {bad_char!r}", bad_line, bad_col)
        pos = mo.end()

    tokens.append(Token(TT.EOF, "", line, 0))
    return tokens
