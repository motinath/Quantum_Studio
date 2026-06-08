# Quantum Studio: Technical Architecture

This document outlines the technical architecture, modules, and underlying methods used in the `project-q` pipeline to convert high-level JSON into physical Qiskit Metal layouts.

## System Architecture Overview
The pipeline follows a classic compiler architecture:
1. **Frontend (AST parsing):** Validates and parses the JSON into strongly-typed Pydantic models.
2. **Intermediate Representation (IR):** Converts the AST into a `QuantumDesign` graph.
3. **Layout Engine:** Calculates physical positions and routing traces.
4. **Backend (Code Gen):** Emits Qiskit Metal python code.
5. **Extraction:** Executes the generated script to render GDSII geometry.

---

## 1. Core Models (`quantum_studio/models/`)

This module is responsible for Data Validation and the Intermediate Representation (IR).
* **Technology Used:** `pydantic`, `networkx`

### Methods & Classes:
* `CircuitSpec`: The root AST (Abstract Syntax Tree) model. It strictly validates the incoming JSON against physical constraints (e.g. anharmonicity limits, thickness rules) using Pydantic validators.
* `QuantumDesign`: The central IR graph. It converts the validated JSON list of components into a `networkx` graph where nodes are qubits/resonators and edges are couplers.
* `_assign_connection_pads`: A critical method inside `QuantumDesign` that maps logical connections (e.g., "Q0 to Q1") into physical port locations on a Transmon (`loc_W` and `loc_H` coordinates, strictly assigned to `+1` or `-1` to respect Metal's geometry logic).

## 2. Layout Engine (`quantum_studio/layout/`)

This module calculates the raw 2D mathematical coordinates for all components.
* **Technology Used:** `shapely` (for collision detection)

### Modules:
* **`placement.py` (`PlacementEngine`)**: 
  * Identifies the topological center of the graph (the hub).
  * Calculates `(x, y)` Euclidean coordinates. For a star topology, the central qubit is placed at `(0,0)`, and connected qubits are spaced out radially (e.g., `±2.5mm`). 
  * Places Readout Resonators (`CoupledLineTee`) offset dynamically along the Y-axis from their target qubits.
* **`routing.py` (`RoutingEngine`)**: 
  * Generates straight-line paths for buses (qubit-to-qubit).
  * Calculates meandering paths (`RouteMeander`) for readout resonators, calculating the necessary `total_length` to achieve the target resonance frequency.
  * Uses `shapely.geometry.LineString` and `Polygon.intersects()` to emit warnings if routes physically cross over each other (collision detection).

## 3. Code Generation (`quantum_studio/export/`)

This module acts as the "compiler backend", turning the `QuantumDesign` graph into executable Qiskit Metal code.
* **Technology Used:** Native Python string manipulation and templating.

### Modules:
* **`metal_codegen.py` (`MetalCodeGenerator`)**:
  * Iterates over all placed components and maps them to their respective Qiskit Metal library classes:
    * Qubits $\rightarrow$ `TransmonPocket`
    * Resonator Anchors $\rightarrow$ `CoupledLineTee`
    * Wires / Traces $\rightarrow$ `RouteMeander`
    * I/O Ports $\rightarrow$ `LaunchpadWirebond`
  * Emits formatted python code with the `Dict()` wrapper required by Qiskit Metal's parser.
  * Injects a raw string footer (`export_gds()`) into the generated file to automatically trigger the `QGDSRenderer` when the script runs.

## 4. Orchestration (`run_json.py`)

The main entrypoint for the user.
* **Technology Used:** `subprocess`, `pathlib`, `logging`

### Flow:
1. Opens and reads the `friend_star_topology.json` argument.
2. Passes it to `CircuitSpec.model_validate_json()`.
3. Instantiates `QuantumDesign`, `PlacementEngine`, and `RoutingEngine` in sequence.
4. Calls `MetalCodeGenerator.write()` to output the script to the `output/` directory.
5. Uses `subprocess.run()` to execute the generated python script in a separate child process. This forces Qiskit Metal to load the `gdstk` C++ libraries natively and drop the `.gds` file onto the filesystem.
