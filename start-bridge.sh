#!/usr/bin/env bash
# Starts the Qiskit Metal bridge backend on port 8000.
# Required by the Schematic Editor for live component rendering and code generation.
#
# Prerequisites:
#   pip install qiskit-metal==0.1.5 fastapi uvicorn pydantic shapely matplotlib
#
# Usage: ./start-bridge.sh (run from project root)

set -e
cd "$(dirname "$0")"

export QISKIT_METAL_HEADLESS=1
export MPLBACKEND=Agg

python -m uvicorn editor.backend.app:app --host 0.0.0.0 --port 8000 --reload
