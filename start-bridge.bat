@echo off
REM Starts the Qiskit Metal bridge backend on port 8000.
REM Required by the Schematic Editor for live component discovery, rendering, and code generation.
REM
REM Usage:
REM   .\start-bridge.bat   (PowerShell - from project root)
REM   start-bridge.bat     (CMD - from project root)

REM Move into editor/ so backend.app:app resolves correctly
cd /d "%~dp0editor"

set QISKIT_METAL_HEADLESS=1
set MPLBACKEND=Agg

echo.
echo === Qiskit Metal Bridge ===
echo URL  : http://localhost:8000
echo Stop : Ctrl+C
echo.

REM Use venv Python if it exists, otherwise fall back to system Python
if exist ".venv\Scripts\python.exe" (
    echo Using venv Python
    .venv\Scripts\python.exe -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
) else (
    echo Using system Python
    python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
)
