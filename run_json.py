import json
import argparse
from pathlib import Path
from pydantic import TypeAdapter

from quantum_studio.compiler.ast_nodes import CircuitSpec
from quantum_studio.models.design import QuantumDesign
from quantum_studio.layout.placement import PlacementEngine
from quantum_studio.layout.routing import RoutingEngine
from quantum_studio.export.metal_codegen import MetalCodeGenerator

def main():
    parser = argparse.ArgumentParser(description="Test model using an external JSON file")
    parser.add_argument("json_file", help="Path to the JSON file sent by your friend")
    parser.add_argument("-o", "--output", default="./output", help="Output directory")
    args = parser.parse_args()

    json_path = Path(args.json_file)
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Convert the raw JSON dictionary into our CircuitSpec AST
    # Pydantic's TypeAdapter automatically unpacks nested dicts into dataclasses
    adapter = TypeAdapter(CircuitSpec)
    spec = adapter.validate_python(data)
    print(f"Successfully loaded JSON into CircuitSpec: {spec.chip.name}")

    # 2. Build the IR model
    design = QuantumDesign.from_circuit_spec(spec)
    print("Successfully built QuantumDesign IR.")

    # 3. Run Placement
    design = PlacementEngine(design).place()
    print("Placement complete.")

    # 4. Run Routing
    design, routes = RoutingEngine(design).route()
    print("Routing complete.")

    # 5. Generate Qiskit Metal Code
    out_dir = Path(args.output) / design.chip.name
    out_dir.mkdir(parents=True, exist_ok=True)
    
    gen = MetalCodeGenerator(design)
    result = gen.generate()
    
    safe_name = design.chip.name.replace(" ", "_").replace("-", "_")
    metal_path = result.write(out_dir / f"{safe_name}_metal.py")
    
    print(f"\nDone! Qiskit Metal code successfully generated at:")
    print(f"  {metal_path}")

    # 6. Automatically attempt to extract the GDS file
    import subprocess
    import sys
    print("\n--- Attempting automatic GDS extraction ---")
    try:
        # Run the generated script which contains the GDS export trigger
        result = subprocess.run([sys.executable, str(metal_path)], check=True, capture_output=True, text=True)
        gds_path = metal_path.with_suffix(".gds")
        print(f"SUCCESS! GDS file automatically extracted to:\n  {gds_path}")
    except subprocess.CalledProcessError as e:
        print(f"SKIPPED: GDS extraction failed with error:\n{e.stderr}")

if __name__ == "__main__":
    main()
