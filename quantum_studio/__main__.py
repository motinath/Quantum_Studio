"""
Quantum Studio CLI — build superconducting quantum chips from QCLang.

Usage::

    python -m quantum_studio examples/two_qubit.qclang
    python -m quantum_studio --rules
    python -m quantum_studio --list-examples
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from quantum_studio.pipeline import ChipPipeline
from quantum_studio.rules.chip_rules import ChipRules


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Quantum Studio — build ≤5-qubit superconducting chips with Qiskit Metal",
    )
    parser.add_argument(
        "qclang",
        nargs="?",
        help="Path to .qclang specification file",
    )
    parser.add_argument(
        "-o", "--output",
        default="./output",
        help="Output directory (default: ./output)",
    )
    parser.add_argument(
        "--rules",
        action="store_true",
        help="Print all chip build rules and exit",
    )
    parser.add_argument(
        "--list-examples",
        action="store_true",
        help="List bundled example .qclang files",
    )
    parser.add_argument(
        "--no-metal",
        action="store_true",
        help="Skip Qiskit Metal script export",
    )

    args = parser.parse_args(argv)

    if args.rules:
        print(ChipRules.summary())
        return 0

    if args.list_examples:
        examples = Path(__file__).resolve().parent.parent / "examples"
        if examples.is_dir():
            for f in sorted(examples.glob("*.qclang")):
                print(f"  {f.name}")
        else:
            print("No examples directory found.")
        return 0

    if not args.qclang:
        parser.print_help()
        return 1

    qclang_path = Path(args.qclang)
    if not qclang_path.exists():
        print(f"Error: file not found: {qclang_path}", file=sys.stderr)
        return 1

    try:
        result = ChipPipeline(output_dir=args.output).run(
            qclang_path,
            export_metal=not args.no_metal,
        )
        summary = result.summary().encode("ascii", errors="replace").decode("ascii")
        print(summary)
        if result.warnings:
            print("\nWarnings:")
            for w in result.warnings:
                print(f"  ! {w}")
        if result.metal_script_path:
            print(f"\nOK Qiskit Metal script: {result.metal_script_path}")
            print("  Run with: python", result.metal_script_path.name)
        raise SystemExit(0)
    except Exception as exc:
        print(f"Pipeline failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
