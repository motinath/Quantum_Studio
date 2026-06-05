"""
Verification Engine — runs all checks on a compiled design.

Checks:
  1. DRC (design rule check) — spacing, off-chip, duplicates
  2. Frequency collision detection
  3. Crosstalk estimation
  4. Yield estimation
  5. Coherence budget
"""

from __future__ import annotations

import math
from typing import Any


def run_verification(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Run full verification suite on a GenerateResponse payload.
    Returns a verification report dict.
    """
    violations: list[dict] = []
    freq_collisions: list[dict] = []
    crosstalk_warnings: list[dict] = []

    fp = payload.get("frequency_plan") or {}
    placement = payload.get("placement") or {}
    drc = payload.get("drc") or {}

    # 1. DRC violations
    for v in drc.get("violations", []):
        violations.append({
            "type": "drc",
            "severity": v.get("severity", "error"),
            "rule": v.get("rule", "UNKNOWN"),
            "message": v.get("message", ""),
        })

    # 2. Frequency collisions
    qubit_freqs = fp.get("qubit_frequencies_GHz", {})
    res_freqs = fp.get("resonator_frequencies_GHz", {})

    sorted_q = sorted(qubit_freqs.items(), key=lambda x: x[1])
    for (n1, f1), (n2, f2) in zip(sorted_q, sorted_q[1:]):
        delta = abs(f1 - f2)
        if delta < 0.05:
            freq_collisions.append({
                "type": "frequency_collision",
                "severity": "error",
                "qubits": [n1, n2],
                "delta_mhz": round(delta * 1000, 2),
                "message": f"{n1} ({f1:.3f} GHz) and {n2} ({f2:.3f} GHz) collision — "
                           f"only {delta*1000:.0f} MHz separation",
            })
        elif delta < 0.1:
            freq_collisions.append({
                "type": "frequency_collision",
                "severity": "warning",
                "qubits": [n1, n2],
                "delta_mhz": round(delta * 1000, 2),
                "message": f"{n1} and {n2} close in frequency — {delta*1000:.0f} MHz separation",
            })

    # Check qubit-resonator collision
    for q_name, q_freq in qubit_freqs.items():
        for r_name, r_freq in res_freqs.items():
            delta = abs(q_freq - r_freq)
            if delta < 0.2:
                freq_collisions.append({
                    "type": "qubit_resonator_collision",
                    "severity": "warning",
                    "components": [q_name, r_name],
                    "delta_mhz": round(delta * 1000, 2),
                    "message": f"Qubit {q_name} ({q_freq:.3f} GHz) close to resonator {r_name} ({r_freq:.3f} GHz)",
                })

    # 3. Crosstalk estimation (geometric)
    qubits = placement.get("qubits", [])
    for i in range(len(qubits)):
        for j in range(i + 1, len(qubits)):
            q1, q2 = qubits[i], qubits[j]
            dist = math.sqrt((q1["x"] - q2["x"]) ** 2 + (q1["y"] - q2["y"]) ** 2)
            if 0.4 < dist < 1.0:
                # Not directly coupled but close — ZZ crosstalk risk
                zz = round(0.1 * math.exp(-dist / 0.5), 4)  # MHz estimate
                crosstalk_warnings.append({
                    "type": "zz_crosstalk",
                    "severity": "warning" if zz > 0.05 else "info",
                    "qubits": [q1["name"], q2["name"]],
                    "distance_mm": round(dist, 3),
                    "zz_estimate_mhz": zz,
                    "message": f"ZZ coupling ~{zz:.3f} MHz between {q1['name']} and {q2['name']} "
                               f"({dist:.2f} mm apart)",
                })

    # 4. Yield estimate (based on number of violations)
    n_errors = sum(1 for v in violations if v["severity"] == "error")
    n_freq_errors = sum(1 for f in freq_collisions if f["severity"] == "error")
    total_issues = n_errors + n_freq_errors

    num_q = len(qubit_freqs)
    base_yield = 0.98 if num_q <= 10 else (0.95 if num_q <= 50 else 0.90)
    yield_est = max(0.3, base_yield - total_issues * 0.05)

    # 5. Coherence budget
    substrate = fp.get("substrate", "silicon")
    coherence_budget = {
        "silicon": {"T1_us": 100, "T2_us": 150},
        "sapphire": {"T1_us": 300, "T2_us": 400},
        "silicon_nitride": {"T1_us": 50, "T2_us": 80},
    }.get(substrate, {"T1_us": 100, "T2_us": 150})

    # 6. Overall status
    all_issues = violations + freq_collisions + crosstalk_warnings
    n_critical = sum(1 for i in all_issues if i["severity"] == "error")
    n_major = sum(1 for i in all_issues if i["severity"] == "warning")

    if n_critical > 0:
        status = "failed"
    elif n_major > 3:
        status = "warning"
    else:
        status = "passed"

    return {
        "status": status,
        "drc_passed": drc.get("passed", False),
        "violations": violations,
        "frequency_collisions": freq_collisions,
        "crosstalk_warnings": crosstalk_warnings,
        "summary": {
            "total_issues": len(all_issues),
            "critical": n_critical,
            "major": n_major,
            "minor": sum(1 for i in all_issues if i["severity"] == "info"),
            "yield_estimate": round(yield_est * 100, 1),
            "coherence_budget": coherence_budget,
            "num_qubits": num_q,
        },
    }
