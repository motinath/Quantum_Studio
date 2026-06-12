# Starts the Qiskit Metal bridge backend on port 8000.
# Required by the Schematic Editor for live component discovery, rendering, and code generation.
#
# Usage (from project root in PowerShell):
#   .\start-bridge.ps1

$ProjectRoot = $PSScriptRoot
$BridgeDir   = Join-Path $ProjectRoot "editor"
$VenvPython  = Join-Path $BridgeDir ".venv\Scripts\python.exe"

if (-not (Test-Path $BridgeDir)) {
    Write-Host "ERROR: Cannot find editor/ at: $BridgeDir" -ForegroundColor Red
    exit 1
}

# Use venv Python if available, fall back to system Python
if (Test-Path $VenvPython) {
    $PythonExe = $VenvPython
    Write-Host "Using venv Python: $VenvPython" -ForegroundColor Gray
} else {
    $PythonExe = "python"
    Write-Host "Using system Python (venv not found at $VenvPython)" -ForegroundColor Yellow
}

$env:QISKIT_METAL_HEADLESS = "1"
$env:MPLBACKEND             = "Agg"

Write-Host ""
Write-Host "=== Qiskit Metal Bridge ===" -ForegroundColor Cyan
Write-Host "URL  : http://localhost:8000" -ForegroundColor Green
Write-Host "Stop : Ctrl+C" -ForegroundColor Yellow
Write-Host ""

# Run uvicorn from inside editor/ so 'backend.app:app' resolves correctly
Set-Location $BridgeDir
& $PythonExe -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
