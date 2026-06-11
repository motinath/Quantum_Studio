import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Cpu, Terminal, Zap, FileCode2, BookOpen, Clock, Calendar, ArrowRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SilicofellerLogo } from "@/components/silicofeller-logo";
import { useAuth } from "@/lib/auth/auth-context";

export const Route = createFileRoute("/blog/$slug")({
  head: ({ params }) => {
    const post = BLOG_POSTS[params.slug as keyof typeof BLOG_POSTS];
    return {
      meta: [
        { title: post ? `${post.title} — SilicoFeller Blog` : "Blog — SilicoFeller" },
        {
          name: "description",
          content: post ? post.summary : "SilicoFeller quantum computing research and insights.",
        },
      ],
    };
  },
  loader: ({ params }) => {
    if (!BLOG_POSTS[params.slug as keyof typeof BLOG_POSTS]) {
      throw notFound();
    }
  },
  component: BlogDetailPage,
});

type Author = {
  name: string;
  role: string;
  avatar: string;
  bio: string;
};

type RelatedPost = {
  title: string;
  desc: string;
  slug: string;
};

type Spec = {
  label: string;
  value: string;
};

type Post = {
  title: string;
  category: string;
  tag: string;
  date: string;
  summary: string;
  authors: Author[];
  related: RelatedPost[];
  specs: Spec[];
  renderContent: () => React.ReactNode;
};

const BLOG_POSTS: Record<string, Post> = {
  "squadds-qubit-design": {
    title: "SQuADDS: A Validated Design Database and Simulation Workflow for Superconducting Qubits",
    category: "Hardware Engineering",
    tag: "Engineering",
    date: "Published in Quantum (Vol 8, p. 1465, 2024) / arXiv:2312.13483",
    summary: "USC's open-source database validating superconducting transmon layouts. Learn how SQuADDS accelerates device design cycles from weeks to minutes.",
    authors: [
      {
        name: "Sadman Ahmed Shanto",
        role: "PhD Candidate, USC (Levenson-Falk Lab)",
        avatar: "S",
        bio: "Sadman Ahmed Shanto is a PhD candidate in Physics at the University of Southern California (USC). His research focuses on superconducting hardware design, automation, and microwave engineering.",
      },
      {
        name: "Eli M. Levenson-Falk",
        role: "Assistant Professor of Physics, USC",
        avatar: "E",
        bio: "Eli Levenson-Falk is Director of the Levenson-Falk Lab at USC. Previously at UC Berkeley, his group studies the dynamics of superconducting quantum circuits, noise mitigation, and quantum sensing.",
      },
    ],
    specs: [
      { label: "Target Platform", value: "Superconducting Qubits" },
      { label: "Design API", value: "Qiskit Metal & Python" },
      { label: "Sim Solvers", value: "Ansys HFSS / Finite-Element" },
      { label: "Validation Accuracy", value: "Within ±1.5% margin" },
    ],
    related: [
      {
        title: "Shadow Hamiltonian Simulation",
        desc: "Learn how compressed quantum states bypass traditional simulation bounds.",
        slug: "shadow-hamiltonian",
      },
      {
        title: "Google Sycamore & Quantum Supremacy",
        desc: "A look at the landmark 53-qubit superconducting processor experiment.",
        slug: "quantum-supremacy",
      },
    ],
    renderContent: () => (
      <>
        <p>
          Fabricating superconducting quantum processors is a highly complex physical process that demands precise control over the device's Hamiltonian parameters. Key parameters like qubit frequency, anharmonicity, and coupling rates with read-out resonators dictate the system's performance and gate fidelity.
        </p>
        <p>
          However, mapping the desired physical target parameters back to a specific geometric layout (such as capacitor gap, finger widths, and Josephson junction area) is extremely difficult. Because no simple analytical formulas exist, engineers traditionally play a game of &quot;guess and check&quot;—running computationally heavy 3D electromagnetic finite-element simulations, adjusting dimensions, and repeating.
        </p>

        <div className="my-8 rounded-2xl border border-violet-100 bg-[#F5F3FF] p-6 shadow-sm">
          <p className="font-serif italic text-foreground leading-relaxed text-[1.05rem]">
            &quot;SQuADDS (Superconducting Qubit And Device Design and Simulation) solves this bottleneck by providing the community with an open-source database of validated designs, paired with a front-end interface for inverse qubit design.&quot;
          </p>
        </div>

        <h2 className="mt-10 mb-4 text-2xl font-semibold text-foreground border-l-4 border-violet-500 pl-4">Programmatic Generation and Simulation</h2>
        <p>
          The SQuADDS workflow leverages <strong>Qiskit Metal</strong>, an open-source package for programmatic quantum device layouts, and connects it to high-accuracy finite-element solvers like Ansys HFSS.
        </p>
        <p>
          Through this pipeline, the team generated thousands of transmon qubit and resonator designs. By sweeping key dimensions, they mapped out the design space, extracting capacitances, inductances, and coupling coefficients to calculate Hamiltonian parameters.
        </p>

        <div className="my-8 rounded-2xl border border-border bg-card p-6 shadow-sm text-center">
          <img 
            src="/blog/images/squadds_validation.png" 
            alt="SQuADDS Validation: Sim vs Exp" 
            className="mx-auto max-h-[400px] w-auto rounded-lg object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://via.placeholder.com/600x400/161b26/ffffff?text=SQuADDS+Validation+Scatter+Plot";
            }}
          />
          <p className="mt-4 font-sans text-xs text-muted-foreground italic">
            Figure 1: Comparison between simulated resonance frequency and experimentally measured frequency. The database designs demonstrate strong agreement (within the ±1.5% margin), ensuring high predictability for fabricators.
          </p>
        </div>

        <h2 className="mt-10 mb-4 text-2xl font-semibold text-foreground border-l-4 border-violet-500 pl-4">Experimentally Validated Database</h2>
        <p>
          What makes SQuADDS unique is that a significant subset of the database contains experimentally validated parameters. Qubits fabricated from these designs were cooled down in dilution refrigerators and measured, showing excellent agreement with electromagnetic simulations. This gives researchers a highly trustworthy starting point when designing new QPUs.
        </p>

        <h2 className="mt-10 mb-4 text-2xl font-semibold text-foreground border-l-4 border-violet-500 pl-4">Using the SQuADDS Python API for Inverse Design</h2>
        <p>
          SQuADDS provides a front-end API that allows engineers to perform &quot;inverse design.&quot; Instead of drawing a shape and simulating it, engineers query the database with their target Hamiltonian parameters (such as a 5.0 GHz qubit frequency) and retrieve the exact geometry coordinates to construct the qubit.
        </p>
        <p>
          Here is a Python demonstration showing how to use the SQuADDS library to retrieve a transmon design:
        </p>

        <div className="my-6 overflow-hidden rounded-xl border border-border bg-[#0E121A] text-slate-200">
          <div className="flex items-center justify-between bg-[#1A1F2B] px-4 py-2 font-mono text-xs text-slate-400">
            <span>squadds_transmon_query.py</span>
            <span className="text-[10px] uppercase font-bold text-violet-400">Python</span>
          </div>
          <pre className="overflow-x-auto p-4 text-[0.9rem] leading-relaxed font-mono">
            <code className="text-[#38bdf8]">{`import squadds
import numpy as np

# Instantiate the SQuADDS database client
db_client = squadds.SQuADDS_DB()

# Define the target Hamiltonian parameters for a Transmon Qubit
target_parameters = {
    "qubit_frequency_GHz": 5.2,    # Target resonant frequency
    "anharmonicity_MHz": -250.0,   # Target anharmonicity (alpha)
    "coupling_strength_MHz": 120.0 # Target coupling to read-out resonator
}

print("Querying SQuADDS database for matching transmon geometry...")

# Find the closest design matching target parameters
best_match = db_client.find_closest_design(
    component_type="transmon",
    targets=target_parameters,
    metric="euclidean"
)

# Extract and display the geometry parameters
geometry = best_match["geometry"]
print("\\nClosest Match Found in Database:")
print(f"Matched Frequency: {best_match['simulated_frequency_GHz']:.3f} GHz")
print(f"Matched Anharmonicity: {best_match['simulated_anharmonicity_MHz']:.1f} MHz")
print(f"Retrieve Qiskit Metal Geometry Config:")
for param, val in geometry.items():
    print(f"  - {param}: {val}")`}</code>
          </pre>
        </div>

        <p>
          Once retrieved, the geometry dictionary can be passed directly into Qiskit Metal components to generate the GDSII mask file for physical chip lithography. This database reduces the device design cycle time from weeks to minutes, opening up hardware research to smaller laboratories and universities.
        </p>
      </>
    ),
  },
  "surface-codes": {
    title: "Surface Codes: Towards Practical Large-Scale Quantum Computation",
    category: "Quantum Computing",
    tag: "Quantum",
    date: "Published in Physical Review A • Sep 18, 2012",
    summary: "Delve into the foundational theory of topological stabilizers in surface codes, threshold metrics, and distance overhead scaling.",
    authors: [
      {
        name: "Austin G. Fowler",
        role: "Quantum Computing Researcher, Google Quantum AI",
        avatar: "AF",
        bio: "Austin Fowler is a leading quantum computing researcher at Google. He has done pioneering work on the scaling of surface codes, planar architectures, and low-overhead logical gates.",
      },
      {
        name: "John M. Martinis",
        role: "Professor of Physics, UCSB",
        avatar: "JM",
        bio: "John Martinis is a Professor of Physics at UC Santa Barbara and former Chief Scientist of Quantum Hardware at Google, where he led the team that achieved quantum supremacy.",
      },
    ],
    specs: [
      { label: "Stabilizer Type", value: "Rotated Surface Code (2D)" },
      { label: "Fault Threshold", value: "Approximately 1.0%" },
      { label: "Connectivity", value: "2D Nearest-Neighbor" },
      { label: "Primary Tools", value: "Stim & PyMatching" },
    ],
    related: [
      {
        title: "Quantum Supremacy using Google Sycamore",
        desc: "Explore the details of the landmark 53-qubit superconducting processor experiment.",
        slug: "quantum-supremacy",
      },
      {
        title: "Shadow Hamiltonian Simulation",
        desc: "A novel compressed state framework that bypasses traditional complexity bounds.",
        slug: "shadow-hamiltonian",
      },
    ],
    renderContent: () => (
      <>
        <p>
          Building a useful quantum computer is one of the grandest scientific and engineering challenges of our time. While physical quantum platforms such as superconducting loops, trapped ions, and silicon spins continue to mature, they all share a fundamental weakness: <strong>noise</strong>. Environmental interactions, thermal fluctuations, and control inaccuracies cause physical qubits to decohere, introducing errors that corrupt quantum information.
        </p>
        <p>
          To overcome this barrier, we must use <strong>Quantum Error Correction (QEC)</strong>. QEC enables us to protect fragile quantum information by encoding a single &quot;logical&quot; qubit into a large grid of physical qubits. Among the various proposed QEC schemes, the <strong>surface code</strong> stands out as the most promising framework for practical, large-scale quantum computers.
        </p>

        <div className="my-8 rounded-2xl border border-violet-100 bg-[#F5F3FF] p-6 shadow-sm">
          <p className="font-serif italic text-foreground leading-relaxed text-[1.05rem]">
            &quot;Surface codes offer a remarkably high error threshold (~1%), requiring only nearest-neighbor 2D physical connectivity, making them the standard architecture for modern superconducting QPUs.&quot;
          </p>
        </div>

        <h2 className="mt-10 mb-4 text-2xl font-semibold text-foreground border-l-4 border-violet-500 pl-4">Stabilizer Measurements in a 2D Array</h2>
        <p>
          The surface code operates on a 2D square lattice of physical qubits. These physical qubits are divided into two distinct categories:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li><strong>Data Qubits:</strong> Qubits that store the actual superposition states of the logical qubit.</li>
          <li><strong>Measure (Syndrome) Qubits:</strong> Auxiliary qubits used solely to detect errors without destroying the stored quantum state.</li>
        </ul>
        <p>
          By continuously measuring 4-qubit operators known as <strong>stabilizers</strong>, we can detect when an X (bit-flip) or Z (phase-flip) error occurs. Specifically, we measure Z-stabilizers (measuring phase errors on neighboring data qubits) and X-stabilizers (measuring bit-flip errors on neighboring data qubits).
        </p>

        <h2 className="mt-10 mb-4 text-2xl font-semibold text-foreground border-l-4 border-violet-500 pl-4">The Threshold Theorem & Code Scaling</h2>
        <p>
          The primary metric for any QEC code is its <strong>threshold</strong>. The threshold represents the physical error rate below which the logical error rate decreases exponentially as we increase the size of the physical grid (the code distance <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm text-violet-600">d</code>).
        </p>
        <p>
          For the surface code, the fault-tolerance threshold is approximately <strong>1.0%</strong>. If the physical error rate of the hardware is below this threshold, we can achieve arbitrarily low logical error rates by scaling the code distance, enabling algorithms that require millions or billions of gate operations.
        </p>

        <div className="my-8 rounded-2xl border border-border bg-card p-6 shadow-sm text-center">
          <img 
            src="/blog/images/surface_codes_threshold.png" 
            alt="Surface Code Logical vs Physical Error Rate" 
            className="mx-auto max-h-[400px] w-auto rounded-lg object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://via.placeholder.com/600x400/161b26/ffffff?text=Surface+Codes+Threshold+Graph";
            }}
          />
          <p className="mt-4 font-sans text-xs text-muted-foreground italic">
            Figure 1: Logical error rate scaling as a function of the physical error rate for various code distances (d = 3, 5, 7, 9). Notice the clear crossing point at the 1% threshold.
          </p>
        </div>

        <h2 className="mt-10 mb-4 text-2xl font-semibold text-foreground border-l-4 border-violet-500 pl-4">How Code Distance Impacts Overhead</h2>
        <p>
          The code distance <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm text-violet-600">d</code> dictates the size of the physical grid. A logical qubit of distance <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm text-violet-600">d</code> requires a grid of <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm text-violet-600">d × d</code> data qubits and <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm text-violet-600">d² - 1</code> measure qubits, totaling <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm text-violet-600">2d² - 1</code> physical qubits.
        </p>

        <div className="my-6 overflow-hidden rounded-xl border border-border shadow-sm">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border font-medium text-foreground">
                <th className="p-4">Code Distance (d)</th>
                <th className="p-4">Data Qubits</th>
                <th className="p-4">Measure Qubits</th>
                <th className="p-4">Total Physical Qubits</th>
                <th className="p-4">Error Protection (t)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              <tr>
                <td className="p-4 font-medium text-foreground">3</td>
                <td className="p-4">9</td>
                <td className="p-4">8</td>
                <td className="p-4 text-foreground font-semibold">17</td>
                <td className="p-4">1 error</td>
              </tr>
              <tr>
                <td className="p-4 font-medium text-foreground">5</td>
                <td className="p-4">25</td>
                <td className="p-4">24</td>
                <td className="p-4 text-foreground font-semibold">49</td>
                <td className="p-4">2 errors</td>
              </tr>
              <tr>
                <td className="p-4 font-medium text-foreground">7</td>
                <td className="p-4">49</td>
                <td className="p-4">48</td>
                <td className="p-4 text-foreground font-semibold">97</td>
                <td className="p-4">3 errors</td>
              </tr>
              <tr>
                <td className="p-4 font-medium text-foreground">9</td>
                <td className="p-4">81</td>
                <td className="p-4">80</td>
                <td className="p-4 text-foreground font-semibold">161</td>
                <td className="p-4">4 errors</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 mb-4 text-2xl font-semibold text-foreground border-l-4 border-violet-500 pl-4">Stim-Based Surface Code Simulation</h2>
        <p>
          In modern quantum engineering, we simulate surface codes programmatically to test decoding pipelines under realistic noise. The following Python code shows how to construct a distance-3 surface code stabilizer measurement circuit using <strong>Stim</strong>:
        </p>

        <div className="my-6 overflow-hidden rounded-xl border border-border bg-[#0E121A] text-slate-200">
          <div className="flex items-center justify-between bg-[#1A1F2B] px-4 py-2 font-mono text-xs text-slate-400">
            <span>stim_surface_code.py</span>
            <span className="text-[10px] uppercase font-bold text-violet-400">Python</span>
          </div>
          <pre className="overflow-x-auto p-4 text-[0.9rem] leading-relaxed font-mono">
            <code className="text-[#38bdf8]">{`import stim

# Generate a surface code circuit with Stim
def generate_d3_surface_code():
    # Construct a distance 3 surface code circuit with 1 round of noise
    circuit = stim.Circuit.generated(
        code_task="surface_code:rotated_memory_z",
        distance=3,
        rounds=3,
        after_clifford_depolarization=0.001, # 0.1% depolarizing noise
        after_reset_flip_probability=0.001,
        before_measure_flip_probability=0.001
    )
    return circuit

# Compile the circuit and count detectors
circuit = generate_d3_surface_code()
print(f"Number of physical qubits: {circuit.num_qubits}")
print(f"Number of detector measurements: {circuit.num_detectors}")
print(f"Number of logical observables: {circuit.num_observables}")

# Sample syndrome data
sampler = circuit.compile_detector_sampler()
syndromes, logical_errors = sampler.sample(shots=10, separate_observables=True)
print("Sampled syndromes (shots x detectors):")
print(syndromes)`}</code>
          </pre>
        </div>

        <p>
          Using this circuit, a classical <strong>decoder</strong> processes the syndrome measurements to identify the most likely physical errors. Advanced decoders like Minimum Weight Perfect Matching (MWPM) or Belief Propagation (BP) are used to perform this decoding in real time, a critical capability for scaling to millions of physical qubits.
        </p>
      </>
    ),
  },
  "shadow-hamiltonian": {
    title: "Shadow Hamiltonian Simulation: Exponential Savings in Quantum Dynamics",
    category: "Theory & Research",
    tag: "Research",
    date: "Published in Nature Communications (2025) / arXiv:2407.21775",
    summary: "Understand how compressed quantum dynamics ('shadow states') reduce physical simulation gate complexity from exponential bounds to polynomial scaling.",
    authors: [
      {
        name: "Rolando D. Somma",
        role: "Principal Researcher, Google Quantum AI",
        avatar: "RS",
        bio: "Rolando Somma is a Principal Researcher at Google. A former physicist at Los Alamos National Lab, he is renowned for his contributions to quantum algorithms and Hamiltonian simulation.",
      },
      {
        name: "Ryan Babbush",
        role: "Head of Quantum Algorithms, Google Quantum AI",
        avatar: "RB",
        bio: "Ryan Babbush leads the Quantum Algorithms group at Google. His research centers on quantum chemistry simulation and developing algorithms to optimize logical qubit resources.",
      },
    ],
    specs: [
      { label: "Paper Reference", value: "arXiv:2407.21775" },
      { label: "Core Concept", value: "Shadow State Operator Evolution" },
      { label: "Complexity Target", value: "Polynomial Scaling O(poly(N))" },
      { label: "Main Applications", value: "Free Fermions & Multi-Time Correlators" },
    ],
    related: [
      {
        title: "Surface Codes & QEC Architecture",
        desc: "Learn how surface code stabilizers defend quantum processors from physical noise.",
        slug: "surface-codes",
      },
      {
        title: "SQuADDS Superconducting Database",
        desc: "Explore USC's open-source database validating superconducting transmon layouts.",
        slug: "squadds-qubit-design",
      },
    ],
    renderContent: () => (
      <>
        <p>
          Simulating physical systems under the Schrödinger equation is widely considered one of the primary drivers for building large-scale quantum computers. In traditional quantum simulation, the goal is to prepare the full wave function of the system over time, <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm text-violet-600">|ψ(t)⟩</code>, and then perform measurements to extract physical parameters.
        </p>
        <p>
          However, this approach faces a significant roadblock: for many complex quantum systems (such as high-dimensional bosons or systems of harmonic oscillators), preparing and tracking the entire state requires an exponential amount of resources, even for a quantum computer.
        </p>

        <div className="my-8 rounded-2xl border border-violet-100 bg-[#F5F3FF] p-6 shadow-sm">
          <p className="font-serif italic text-foreground leading-relaxed text-[1.05rem]">
            &quot;Rather than storing the full quantum state in memory, what if we only evolved a compressed state that represents the specific physical observables of interest? This is the core premise of Shadow Hamiltonian Simulation.&quot;
          </p>
        </div>

        <h2 className="mt-10 mb-4 text-2xl font-semibold text-foreground border-l-4 border-violet-500 pl-4">What is the Shadow State?</h2>
        <p>
          The &quot;shadow state&quot; is a compressed quantum state whose amplitudes are directly proportional to the time-dependent expectation values of a specific, limited set of physical operators of interest—such as 1-body or 2-body correlation functions.
        </p>
        <p>
          Remarkably, this shadow state evolves unitarily under its own Schrödinger equation. By mapping the dynamics of a physical system to this lower-dimensional shadow space, we can simulate the dynamics on a quantum computer with polynomial rather than exponential resources.
        </p>

        <div className="my-8 rounded-2xl border border-border bg-card p-6 shadow-sm text-center">
          <img 
            src="/blog/images/shadow_hamiltonian_complexity.png" 
            alt="Traditional vs Shadow Simulation Complexity" 
            className="mx-auto max-h-[400px] w-auto rounded-lg object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://via.placeholder.com/600x400/161b26/ffffff?text=Shadow+Hamiltonian+Complexity";
            }}
          />
          <p className="mt-4 font-sans text-xs text-muted-foreground italic">
            Figure 1: Gate complexity scaling comparison. Evolving the full state of high-dimensional bosons scales exponentially (red dashed line), while Shadow Hamiltonian Simulation scales polynomially (green line).
          </p>
        </div>

        <h2 className="mt-10 mb-4 text-2xl font-semibold text-foreground border-l-4 border-violet-500 pl-4">Key Advantages & Applications</h2>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li><strong>Exponential Dimensionality Reduction:</strong> Simulates dynamics of exponentially large systems of free bosons or fermions in polynomial time.</li>
          <li><strong>Dynamic Multi-Time Correlators:</strong> Allows efficient evaluation of two-time correlation functions and Green's functions, which are vital for condensed matter physics and material science.</li>
          <li><strong>Heisenberg Picture Simulation:</strong> Enables studying the time evolution of operators directly, bypassing the need to prepare full physical states.</li>
        </ul>

        <h2 className="mt-10 mb-4 text-2xl font-semibold text-foreground border-l-4 border-violet-500 pl-4">Mathematical Overview of Shadow Dynamics</h2>
        <p>
          Let <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm text-violet-600 font-mono">H</code> be a Hamiltonian acting on a large physical space. Instead of tracking the state vector, we track the set of expectation values:
        </p>
        <div className="my-4 p-4 text-center font-mono bg-slate-50 border border-border rounded-xl text-foreground text-sm overflow-x-auto">
          a_k(t) = ⟨ψ(0)| e^(iHt) O_k e^(-iHt) |ψ(0)⟩
        </div>
        <p>
          where <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm text-violet-600 font-mono">O_k</code> is a set of operators. The vector of coefficients <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm text-violet-600 font-mono">a(t)</code> is mapped to the amplitudes of a shadow state <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm text-violet-600 font-mono">|Φ_S(t)⟩</code>, which satisfies:
        </p>
        <div className="my-4 p-4 text-center font-mono bg-slate-50 border border-border rounded-xl text-foreground text-sm overflow-x-auto">
          d/dt |Φ_S(t)⟩ = -i H_S |Φ_S(t)⟩
        </div>
        <p>
          Here, <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm text-violet-600 font-mono">H_S</code> is the effective &quot;Shadow Hamiltonian&quot; which acts on the much smaller shadow space.
        </p>

        <h2 className="mt-10 mb-4 text-2xl font-semibold text-foreground border-l-4 border-violet-500 pl-4">Python Demonstration: Evolving a Compressed Qubit System</h2>
        <p>
          Below is a Python demonstration showing how a Shadow Hamiltonian representation is generated for a free-fermionic system using custom matrix contractions:
        </p>

        <div className="my-6 overflow-hidden rounded-xl border border-border bg-[#0E121A] text-slate-200">
          <div className="flex items-center justify-between bg-[#1A1F2B] px-4 py-2 font-mono text-xs text-slate-400">
            <span>shadow_evolution_builder.py</span>
            <span className="text-[10px] uppercase font-bold text-violet-400">Python</span>
          </div>
          <pre className="overflow-x-auto p-4 text-[0.9rem] leading-relaxed font-mono">
            <code className="text-[#38bdf8]">{`import numpy as np
from scipy.linalg import expm

def generate_shadow_hamiltonian(single_particle_h):
    """
    Constructs the shadow Hamiltonian matrix for single-particle dynamics,
    representing the evolution of expectation values in a free-fermion system.
    """
    N = single_particle_h.shape[0]
    # The shadow space dimensions scale quadratically with mode count
    shadow_dim = N * N
    H_shadow = np.zeros((shadow_dim, shadow_dim), dtype=complex)
    
    # Map operator evolution index: O_ij = c_i^dagger c_j
    for i in range(N):
        for j in range(N):
            idx_from = i * N + j
            for k in range(N):
                # Apply commutation relations [H, c_i^dagger c_j]
                # H_shadow elements represent the coefficients of commutation
                idx_to_1 = k * N + j
                H_shadow[idx_to_1, idx_from] += single_particle_h[k, i]
                
                idx_to_2 = i * N + k
                H_shadow[idx_to_2, idx_from] -= single_particle_h[j, k]
                
    return H_shadow

# Define a simple 3-mode tight-binding hopping Hamiltonian
H_single = np.array([
    [0.0, 1.0, 0.0],
    [1.0, 0.0, 1.0],
    [0.0, 1.0, 0.0]
])

H_shadow = generate_shadow_hamiltonian(H_single)
print(f"Single-particle matrix size: {H_single.shape}")
print(f"Effective Shadow Hamiltonian size: {H_shadow.shape}")

# Verify unitary evolution of the shadow matrix
U_shadow = expm(-1j * H_shadow * 0.5)
print("Shadow evolution operator generated successfully.")`}</code>
          </pre>
        </div>
      </>
    ),
  },
  "quantum-supremacy": {
    title: "Quantum Supremacy Using a Programmable Superconducting Processor",
    category: "Industry & Milestones",
    tag: "Industry",
    date: "Published in Nature (Vol 574, Oct 24, 2019) / doi:10.1038/s41586-019-1666-5",
    summary: "A look at the landmark 53-qubit superconducting processor experiment. Discover random circuit sampling benchmarks and cross-entropy validation.",
    authors: [
      {
        name: "Hartmut Neven",
        role: "Vice President of Engineering, Google Quantum AI",
        avatar: "HN",
        bio: "Hartmut Neven is Founder and Director of Google's Quantum AI Lab. Under his leadership, the lab has developed state-of-the-art processors, machine learning integrations, and the Cirq ecosystem.",
      },
      {
        name: "John M. Martinis",
        role: "Professor of Physics, UCSB",
        avatar: "JM",
        bio: "John Martinis is a Professor of Physics at UC Santa Barbara and former Chief Scientist of Quantum Hardware at Google, where he led the team that built the 53-qubit Sycamore processor.",
      },
    ],
    specs: [
      { label: "Processor", value: "Google Sycamore (Superconducting)" },
      { label: "Qubits Active", value: "53 Transmons" },
      { label: "Gate Speed", value: "15 ns / gate" },
      { label: "Verify Metric", value: "Cross-Entropy Benchmarking (XEB)" },
    ],
    related: [
      {
        title: "Surface Codes & QEC Architecture",
        desc: "Learn how surface code stabilizers defend quantum processors from physical noise.",
        slug: "surface-codes",
      },
      {
        title: "SQuADDS Superconducting Database",
        desc: "Explore USC's open-source database validating superconducting transmon layouts.",
        slug: "squadds-qubit-design",
      },
    ],
    renderContent: () => (
      <>
        <p>
          In 1982, Richard Feynman proposed that simulating quantum mechanical systems with classical supercomputers is fundamentally limited by exponential scaling, suggesting instead that a computer built out of quantum systems could perform these calculations efficiently. In October 2019, Google AI Quantum demonstrated the first experimental validation of this concept—achieving a milestone known as <strong>quantum supremacy</strong> (or quantum advantage).
        </p>
        <p>
          Using a custom, programmable superconducting processor named <strong>Sycamore</strong>, the team performed a specific computational benchmark that would take classical supercomputers millennia to solve, establishing a new paradigm for computing.
        </p>

        <div className="my-8 rounded-2xl border border-violet-100 bg-[#F5F3FF] p-6 shadow-sm">
          <p className="font-serif italic text-foreground leading-relaxed text-[1.05rem]">
            &quot;Our Sycamore processor takes about 200 seconds to sample one instance of a quantum circuit a million times—our benchmarks indicate that the equivalent task for a state-of-the-art classical supercomputer would take approximately 10,000 years.&quot;
          </p>
        </div>

        <h2 className="mt-10 mb-4 text-2xl font-semibold text-foreground border-l-4 border-violet-500 pl-4">The Benchmark: Random Circuit Sampling</h2>
        <p>
          To demonstrate quantum advantage, the team chose the task of <strong>Random Circuit Sampling (RCS)</strong>. In RCS, a random sequence of single-qubit and two-qubit quantum gates is applied to a set of qubits, and the resulting quantum state is measured.
        </p>
        <p>
          Because quantum states exist in a superposition of all possible configurations, the measurement outputs form a complex probability distribution. For N qubits, the state-space grows exponentially as 2^N. For the 53 active qubits of the Sycamore processor, the dimension of the computational state-space is 2^53 ≈ 9 × 10^15 (about 9 quadrillion amplitudes).
        </p>
        <p>
          Simulating this space requires storing and updating 9 quadrillion complex numbers, which quickly overflows the memory capacity of even the largest classical supercomputers.
        </p>

        <div className="my-8 rounded-2xl border border-border bg-card p-6 shadow-sm text-center">
          <img 
            src="/blog/images/quantum_supremacy_scaling.png" 
            alt="Compute Time: Classical vs Sycamore" 
            className="mx-auto max-h-[400px] w-auto rounded-lg object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://via.placeholder.com/600x400/161b26/ffffff?text=Quantum+Supremacy+Scaling";
            }}
          />
          <p className="mt-4 font-sans text-xs text-muted-foreground italic">
            Figure 1: Compute time scaling of classical supercomputers (red curve) vs. the Sycamore processor (constant purple line). At 53 qubits, the classical simulation time explodes to 10,000 years, while Sycamore finishes in 200 seconds.
          </p>
        </div>

        <h2 className="mt-10 mb-4 text-2xl font-semibold text-foreground border-l-4 border-violet-500 pl-4">Verifying the Quantum State: Cross-Entropy Benchmarking</h2>
        <p>
          To verify that the processor was indeed producing the correct quantum states (rather than random noise), the team developed a verification metric called <strong>Cross-Entropy Benchmarking (XEB)</strong>.
        </p>
        <p>
          The XEB fidelity F_XEB measures how closely the experimental samples match the probabilities calculated from classical simulation. For small circuits, the outputs were verified on supercomputers. For larger circuits where exact simulation was impossible, the fidelity was extrapolated, demonstrating that the system maintained quantum coherence across the entire 53-qubit array.
        </p>

        <h2 className="mt-10 mb-4 text-2xl font-semibold text-foreground border-l-4 border-violet-500 pl-4">Python Demonstration: Building a Random Circuit in Cirq</h2>
        <p>
          Google's open-source framework <strong>Cirq</strong> was designed to write and run algorithms on Google's quantum hardware. The code below shows how to construct a random quantum circuit on a grid of superconducting qubits using Cirq:
        </p>

        <div className="my-6 overflow-hidden rounded-xl border border-border bg-[#0E121A] text-slate-200">
          <div className="flex items-center justify-between bg-[#1A1F2B] px-4 py-2 font-mono text-xs text-slate-400">
            <span>cirq_random_circuit.py</span>
            <span className="text-[10px] uppercase font-bold text-violet-400">Python</span>
          </div>
          <pre className="overflow-x-auto p-4 text-[0.9rem] leading-relaxed font-mono">
            <code className="text-[#38bdf8]">{`import cirq
import random

# Create a 3x3 grid of qubits representing a subset of Sycamore
qubits = [cirq.GridQubit(i, j) for i in range(3) for j in range(3)]

# Build a random quantum circuit
def make_random_circuit(qubits, depth=5):
    circuit = cirq.Circuit()
    # Predefined single-qubit gates
    gates = [cirq.X**0.5, cirq.Y**0.5, cirq.T]
    
    for _ in range(depth):
        # 1. Apply random single-qubit gates
        for q in qubits:
            circuit.append(random.choice(gates)(q))
        
        # 2. Apply entangling two-qubit CZ gates between adjacent qubits
        for i in range(len(qubits) - 1):
            q1, q2 = qubits[i], qubits[i+1]
            # Check if they are adjacent on the grid (Manhattan distance = 1)
            if abs(q1.row - q2.row) + abs(q1.col - q2.col) == 1:
                circuit.append(cirq.CZ(q1, q2))
                
    # Add measurement operators to all qubits
    circuit.append(cirq.measure(*qubits, key='result'))
    return circuit

# Construct and display circuit
circuit = make_random_circuit(qubits, depth=3)
print(f"Generated Random Circuit (qubits: {len(qubits)}):\\n")
print(circuit)

# Simulate the circuit locally
simulator = cirq.Simulator()
result = simulator.run(circuit, repetitions=100)
print("\\nSampled measurement outcomes (first 5 samples):")
print(result.data['result'].head(5))`}</code>
          </pre>
        </div>
      </>
    ),
  },
};

function BlogDetailPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const post = BLOG_POSTS[slug as keyof typeof BLOG_POSTS];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="relative min-h-screen bg-background text-foreground flex flex-col justify-between">
      {/* Dynamic light gradient grid header area */}
      <div 
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[500px] opacity-[0.03] z-0"
        style={{ 
          backgroundImage: "var(--grid-pattern)", 
          backgroundSize: "32px 32px",
          backgroundPosition: "top center"
        }}
      />
      
      {/* NAVBAR */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "border-b border-black/10 bg-[#E8E6DE]/85 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl"
            : "border-b border-transparent bg-[#E8E6DE]/40 backdrop-blur-md"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 lg:px-10">
          <Link to="/" aria-label="SilicoFeller home" className="flex items-center">
            <SilicofellerLogo />
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-foreground/65 md:flex">
            <Link to="/" hash="about" className="transition-colors hover:text-foreground">
              About Us
            </Link>
            <Link to="/" hash="technology" className="transition-colors hover:text-foreground">
              Technology
            </Link>
            <Link to="/" hash="features" className="transition-colors hover:text-foreground">
              Features
            </Link>
            <Link to="/" hash="blog" className="text-foreground transition-colors">
              Blog
            </Link>
            <Link to="/our-team" className="transition-colors hover:text-foreground">
              Team
            </Link>
            <Link to="/" hash="contact" className="transition-colors hover:text-foreground">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Button
                  asChild
                  variant="ghost"
                  className="h-9 rounded-full px-4 text-sm text-foreground hover:bg-black/5"
                >
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
                <Button
                  asChild
                  className="h-9 rounded-full bg-foreground px-4 text-sm font-semibold text-background hover:bg-foreground/90"
                >
                  <Link to="/designer">Open designer</Link>
                </Button>
              </>
            ) : (
              <>
                <Button
                  asChild
                  variant="ghost"
                  className="h-9 rounded-full px-4 text-sm text-foreground hover:bg-black/5"
                >
                  <Link to="/sign-in">Sign in</Link>
                </Button>
                <Button
                  asChild
                  className="h-9 rounded-full bg-foreground px-4 text-sm font-semibold text-background hover:bg-foreground/90"
                >
                  <Link to="/sign-up">
                    Sign up
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ARTICLE HEADER HERO */}
      <section className="relative z-10 px-6 pt-12 pb-16 lg:px-10 lg:pt-16 lg:pb-20 border-b border-border bg-[#F4F2EC]">
        <div className="mx-auto max-w-4xl">
          <Link
            to="/"
            hash="blog"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-600 hover:text-violet-800 transition-colors mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to blog
          </Link>
          <span className="inline-block px-3 py-1 text-[11px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700 rounded-full mb-4">
            {post.category}
          </span>
          <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl leading-tight">
            {post.title}
          </h1>
          
          <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-violet-500" />
              {post.date}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-violet-500" />
              6 min read
            </span>
          </div>
        </div>
      </section>

      {/* ARTICLE WRAPPER GRID */}
      <section className="relative z-10 px-6 py-16 lg:px-10 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12 lg:gap-16">
        {/* BODY CONTENT */}
        <article className="font-serif leading-relaxed text-[#334155] text-[1.125rem] space-y-6">
          {post.renderContent()}
        </article>

        {/* SIDEBAR */}
        <aside className="space-y-8 font-sans">
          {/* Key specs */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm" style={{ boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-4 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-violet-600" /> Key Specs
            </h3>
            <ul className="space-y-3.5">
              {post.specs.map((spec) => (
                <li key={spec.label} className="border-b border-slate-100 pb-2.5 last:border-b-0 last:pb-0">
                  <span className="block text-xs text-muted-foreground uppercase font-semibold">{spec.label}</span>
                  <span className="text-sm font-semibold text-foreground mt-0.5 block">{spec.value}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Authors Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm" style={{ boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-violet-600" /> Authors
            </h3>
            <div className="space-y-6">
              {post.authors.map((author) => (
                <div key={author.name} className="flex gap-4 items-start">
                  <div className="h-10 w-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm shrink-0 border border-violet-200">
                    {author.avatar}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground leading-tight">{author.name}</h4>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{author.role}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-2">{author.bio}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Related Reads */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm" style={{ boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-4 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-violet-600" /> Related Reads
            </h3>
            <div className="space-y-4">
              {post.related.map((rel) => (
                <Link
                  key={rel.slug}
                  to="/blog/$slug"
                  params={{ slug: rel.slug }}
                  className="block group border border-slate-100 hover:border-violet-200 hover:bg-violet-50/20 p-3.5 rounded-xl transition-all"
                >
                  <h4 className="text-xs font-bold text-foreground group-hover:text-violet-600 transition-colors line-clamp-2 leading-snug">
                    {rel.title}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {rel.desc}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          {/* Call-to-action designer widget */}
          <div className="rounded-2xl bg-slate-900 p-6 text-white text-center shadow-lg relative overflow-hidden">
            <div 
              aria-hidden
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{ backgroundImage: "var(--grid-pattern)", backgroundSize: "20px 20px" }}
            />
            <h4 className="text-base font-bold font-serif relative z-10">AI-Powered Chip Design</h4>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed relative z-10">
              Generate qubit topologies and coupling maps programmatically using natural language.
            </p>
            <Button
              asChild
              className="mt-4 w-full h-9 rounded-full bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs relative z-10"
            >
              <Link to="/designer">
                Open Designer <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </aside>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/10 bg-[#050507] px-6 py-10 text-white lg:px-10">
        <div className="mx-auto max-w-6xl grid grid-cols-2 gap-8 sm:grid-cols-4">
          <FooterCol title="Product" links={["Features", "Designer", "Pricing", "Changelog"]} />
          <FooterCol title="Company" links={["About", "Blog", "Careers", "Contact"]} />
          <FooterCol title="Resources" links={["Documentation", "API", "Support", "Status"]} />
          <FooterCol title="Legal" links={["Privacy Policy", "Terms of Service", "Security"]} />
        </div>
        <div className="mx-auto mt-8 flex max-w-6xl flex-col items-center justify-between gap-2 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} SilicoFeller, Inc. All rights reserved.</p>
          {user && (
            <p>
              Signed in as <span className="font-medium text-white">{user.name}</span> · User
            </p>
          )}
        </div>
      </footer>
    </main>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-white">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-white/50">
        {links.map((l) => (
          <li key={l}>
            <a href="#" className="transition-colors hover:text-white">
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
