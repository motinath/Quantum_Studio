"""
Quantum analysis parameter export for Quantum Studio.

Exports qubit characterization parameters, coupling maps,
and energy level data for downstream quantum analysis tools.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import numpy as np

from quantum_studio.config import get_settings, PLANCK_H, ELECTRON_CHARGE
from quantum_studio.utils.logging import get_logger
from quantum_studio.utils.units import ghz_to_hz, mhz_to_hz, hz_to_ghz, hz_to_mhz

logger = get_logger("export.analysis")


@dataclass
class QubitParameters:
    """Extracted parameters for a single qubit."""
    id: str
    frequency_ghz: float
    anharmonicity_mhz: float
    ej_ghz: float
    ec_mhz: float
    ej_ec_ratio: float
    t1_estimate_us: Optional[float] = None
    t2_estimate_us: Optional[float] = None
    energy_levels_ghz: list[float] = field(default_factory=list)


@dataclass
class ResonatorParameters:
    """Extracted parameters for a readout resonator."""
    id: str
    frequency_ghz: float
    target_qubit: str
    physical_length_mm: float
    coupling_strength_mhz: float
    dispersive_shift_mhz: Optional[float] = None
    kappa_khz: Optional[float] = None  # linewidth


@dataclass
class CouplingParameters:
    """Coupling parameters between two qubits."""
    qubit_1: str
    qubit_2: str
    g_mhz: float  # coupling strength
    j_mhz: Optional[float] = None  # exchange coupling
    chi_mhz: Optional[float] = None  # cross-Kerr
    zz_khz: Optional[float] = None  # ZZ interaction


@dataclass
class AnalysisExportResult:
    """Result of analysis parameter export."""
    success: bool
    output_path: str
    format: str
    num_qubits: int = 0
    num_resonators: int = 0
    num_couplings: int = 0


class AnalysisExporter:
    """
    Exports quantum characterization parameters for analysis tools.

    Generates structured output containing:
    - Qubit parameters (frequencies, anharmonicities, Ej/Ec, energy levels)
    - Resonator parameters (frequencies, lengths, coupling strengths)
    - Coupling map (qubit-qubit and qubit-resonator couplings)
    - Hamiltonian parameters for quantum simulation

    Supports JSON and CSV output formats.
    """

    def __init__(self):
        self.qubit_params: list[QubitParameters] = []
        self.resonator_params: list[ResonatorParameters] = []
        self.coupling_params: list[CouplingParameters] = []

    def extract_from_design(self, design, analysis_results: dict | None = None) -> None:
        """
        Extract all quantum parameters from a QuantumDesign.

        Uses the design model parameters and optionally supplements with
        results from the analysis modules (capacitance, coupling, frequency).
        """
        # Extract qubit parameters
        for qubit in design.qubits:
            # Compute Ec from anharmonicity: α ≈ -Ec for transmon
            ec_mhz = abs(qubit.anharmonicity_mhz)
            ec_hz = mhz_to_hz(ec_mhz)

            # Compute Ej from f01: Ej = (f01 + Ec)² / (8·Ec)
            f01_hz = ghz_to_hz(qubit.frequency_ghz)
            ej_hz = (f01_hz + ec_hz) ** 2 / (8.0 * ec_hz)
            ej_ghz = hz_to_ghz(ej_hz)
            ej_ec_ratio = ej_hz / ec_hz

            # Compute energy levels
            energy_levels = self._compute_transmon_levels(ej_hz, ec_hz, n_levels=5)
            energy_levels_ghz = [hz_to_ghz(e) for e in energy_levels]

            self.qubit_params.append(QubitParameters(
                id=qubit.id,
                frequency_ghz=qubit.frequency_ghz,
                anharmonicity_mhz=qubit.anharmonicity_mhz,
                ej_ghz=ej_ghz,
                ec_mhz=ec_mhz,
                ej_ec_ratio=ej_ec_ratio,
                energy_levels_ghz=energy_levels_ghz,
            ))

        # Extract resonator parameters
        for res in design.resonators:
            dispersive_shift = None
            if analysis_results and "dispersive_shifts" in analysis_results:
                dispersive_shift = analysis_results["dispersive_shifts"].get(res.id)

            self.resonator_params.append(ResonatorParameters(
                id=res.id,
                frequency_ghz=res.frequency_ghz,
                target_qubit=res.target_qubit_id,
                physical_length_mm=res.physical_length_mm,
                coupling_strength_mhz=res.coupling_strength_mhz,
                dispersive_shift_mhz=dispersive_shift,
            ))

        # Extract coupling parameters
        for coupler in design.couplers:
            # Estimate coupling parameters
            src_qubit = design.get_qubit(coupler.source_qubit_id)
            tgt_qubit = design.get_qubit(coupler.target_qubit_id)

            g_hz = mhz_to_hz(coupler.strength_mhz)
            delta_hz = abs(ghz_to_hz(src_qubit.frequency_ghz) - ghz_to_hz(tgt_qubit.frequency_ghz))

            # Exchange coupling: J = g² / Δ
            j_mhz = None
            if delta_hz > 0:
                j_hz = g_hz ** 2 / delta_hz
                j_mhz = hz_to_mhz(j_hz)

            # Cross-Kerr: χ = -2g²α / (Δ(Δ-α))
            alpha_hz = mhz_to_hz(abs(src_qubit.anharmonicity_mhz))
            chi_mhz = None
            if delta_hz > 0 and abs(delta_hz - alpha_hz) > 1e3:
                chi_hz = 2.0 * g_hz ** 2 * alpha_hz / (delta_hz * abs(delta_hz - alpha_hz))
                chi_mhz = hz_to_mhz(chi_hz)

            # ZZ interaction: ζ ≈ -2χ (simplified)
            zz_khz = None
            if chi_mhz is not None:
                zz_khz = -2.0 * chi_mhz * 1e3  # MHz to kHz

            self.coupling_params.append(CouplingParameters(
                qubit_1=coupler.source_qubit_id,
                qubit_2=coupler.target_qubit_id,
                g_mhz=coupler.strength_mhz,
                j_mhz=j_mhz,
                chi_mhz=chi_mhz,
                zz_khz=zz_khz,
            ))

    def _compute_transmon_levels(self, ej_hz: float, ec_hz: float,
                                  n_levels: int = 5, n_charge: int = 30) -> list[float]:
        """
        Compute transmon energy levels by diagonalizing the Hamiltonian.

        H = 4·Ec·n² - Ej·cos(φ)

        Diagonalized in charge basis with 2*n_charge+1 states.
        """
        dim = 2 * n_charge + 1
        n_values = np.arange(-n_charge, n_charge + 1)

        # Charging energy: 4·Ec·n²
        h_diag = 4.0 * ec_hz * n_values ** 2

        # Josephson energy: -Ej/2 · (|n><n+1| + |n+1><n|)
        h_off = -ej_hz / 2.0 * np.ones(dim - 1)

        # Build Hamiltonian
        hamiltonian = np.diag(h_diag) + np.diag(h_off, 1) + np.diag(h_off, -1)

        # Diagonalize
        eigenvalues = np.linalg.eigh(hamiltonian)[0]

        # Return lowest n_levels, relative to ground state
        ground = eigenvalues[0]
        levels = [(eigenvalues[i] - ground) for i in range(min(n_levels, len(eigenvalues)))]

        return levels

    def export_json(self, output_path: str | Path) -> AnalysisExportResult:
        """Export all analysis parameters as structured JSON."""
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            "format": "quantum_studio_analysis",
            "version": "1.0",
            "summary": {
                "num_qubits": len(self.qubit_params),
                "num_resonators": len(self.resonator_params),
                "num_couplings": len(self.coupling_params),
            },
            "qubits": [],
            "resonators": [],
            "couplings": [],
            "hamiltonian_parameters": {},
        }

        # Qubits
        for qp in self.qubit_params:
            data["qubits"].append({
                "id": qp.id,
                "frequency_ghz": round(qp.frequency_ghz, 6),
                "anharmonicity_mhz": round(qp.anharmonicity_mhz, 3),
                "ej_ghz": round(qp.ej_ghz, 6),
                "ec_mhz": round(qp.ec_mhz, 3),
                "ej_ec_ratio": round(qp.ej_ec_ratio, 2),
                "energy_levels_ghz": [round(e, 6) for e in qp.energy_levels_ghz],
            })

        # Resonators
        for rp in self.resonator_params:
            data["resonators"].append({
                "id": rp.id,
                "frequency_ghz": round(rp.frequency_ghz, 6),
                "target_qubit": rp.target_qubit,
                "physical_length_mm": round(rp.physical_length_mm, 4),
                "coupling_strength_mhz": round(rp.coupling_strength_mhz, 3),
                "dispersive_shift_mhz": (
                    round(rp.dispersive_shift_mhz, 6) if rp.dispersive_shift_mhz else None
                ),
            })

        # Couplings
        for cp in self.coupling_params:
            data["couplings"].append({
                "qubit_1": cp.qubit_1,
                "qubit_2": cp.qubit_2,
                "g_mhz": round(cp.g_mhz, 3),
                "j_mhz": round(cp.j_mhz, 6) if cp.j_mhz else None,
                "chi_mhz": round(cp.chi_mhz, 6) if cp.chi_mhz else None,
                "zz_khz": round(cp.zz_khz, 3) if cp.zz_khz else None,
            })

        # Hamiltonian parameters (for quantum simulation input)
        data["hamiltonian_parameters"] = self._build_hamiltonian_params()

        with open(output_path, "w") as f:
            json.dump(data, f, indent=2)

        logger.info(f"Analysis parameters exported to {output_path}")

        return AnalysisExportResult(
            success=True,
            output_path=str(output_path),
            format="json",
            num_qubits=len(self.qubit_params),
            num_resonators=len(self.resonator_params),
            num_couplings=len(self.coupling_params),
        )

    def export_csv(self, output_dir: str | Path) -> AnalysisExportResult:
        """Export analysis parameters as CSV files (one per category)."""
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Qubits CSV
        qubit_csv = output_dir / "qubits.csv"
        with open(qubit_csv, "w") as f:
            f.write("id,frequency_ghz,anharmonicity_mhz,ej_ghz,ec_mhz,ej_ec_ratio\n")
            for qp in self.qubit_params:
                f.write(
                    f"{qp.id},{qp.frequency_ghz:.6f},{qp.anharmonicity_mhz:.3f},"
                    f"{qp.ej_ghz:.6f},{qp.ec_mhz:.3f},{qp.ej_ec_ratio:.2f}\n"
                )

        # Resonators CSV
        res_csv = output_dir / "resonators.csv"
        with open(res_csv, "w") as f:
            f.write("id,frequency_ghz,target_qubit,physical_length_mm,coupling_strength_mhz\n")
            for rp in self.resonator_params:
                f.write(
                    f"{rp.id},{rp.frequency_ghz:.6f},{rp.target_qubit},"
                    f"{rp.physical_length_mm:.4f},{rp.coupling_strength_mhz:.3f}\n"
                )

        # Couplings CSV
        coupling_csv = output_dir / "couplings.csv"
        with open(coupling_csv, "w") as f:
            f.write("qubit_1,qubit_2,g_mhz,j_mhz,chi_mhz,zz_khz\n")
            for cp in self.coupling_params:
                f.write(
                    f"{cp.qubit_1},{cp.qubit_2},{cp.g_mhz:.3f},"
                    f"{cp.j_mhz:.6f if cp.j_mhz else ''},"
                    f"{cp.chi_mhz:.6f if cp.chi_mhz else ''},"
                    f"{cp.zz_khz:.3f if cp.zz_khz else ''}\n"
                )

        logger.info(f"Analysis CSVs exported to {output_dir}")

        return AnalysisExportResult(
            success=True,
            output_path=str(output_dir),
            format="csv",
            num_qubits=len(self.qubit_params),
            num_resonators=len(self.resonator_params),
            num_couplings=len(self.coupling_params),
        )

    def _build_hamiltonian_params(self) -> dict:
        """
        Build Hamiltonian parameter dict for quantum simulation tools.

        Provides the parameters needed to construct:
        H = Σ_i ω_i a†_i a_i + α_i/2 a†_i a†_i a_i a_i
            + Σ_{i,j} g_{ij} (a†_i a_j + a_i a†_j)
        """
        qubit_params = {}
        for qp in self.qubit_params:
            qubit_params[qp.id] = {
                "omega_ghz": qp.frequency_ghz,
                "alpha_mhz": qp.anharmonicity_mhz,
                "ej_ghz": qp.ej_ghz,
                "ec_mhz": qp.ec_mhz,
            }

        coupling_map = {}
        for cp in self.coupling_params:
            key = f"{cp.qubit_1}-{cp.qubit_2}"
            coupling_map[key] = {
                "g_mhz": cp.g_mhz,
                "j_mhz": cp.j_mhz,
                "chi_mhz": cp.chi_mhz,
            }

        return {
            "qubits": qubit_params,
            "couplings": coupling_map,
            "num_levels_per_qubit": 3,
            "rotating_frame": True,
        }
