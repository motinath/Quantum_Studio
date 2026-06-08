# Project Q: QCLang to Qiskit Metal Generator

This pipeline takes a high-level JSON specification of a quantum chip architecture (such as output from a Natural Language processing model) and automatically places, routes, and compiles it into physically valid **Qiskit Metal** Python code. **It then automatically extracts the GDSII file for fabrication!**

---

## 🚀 How to Run the Pipeline (Windows Guide)

You only need to run a few commands to go from your JSON file to a physical `.gds` file.

### Step 1: Install the Environment

Because Qiskit Metal relies on complex C++ geometry libraries for physics layouts, standard Python on Windows can run into issues. You **MUST** use Anaconda to get the pre-compiled versions.

Open your **Anaconda Prompt** and run these commands exactly:

```powershell
# 1. Create a clean Python 3.9 environment
conda create -n qmetal python=3.9 -y
conda activate qmetal

# 2. Install pre-compiled C++ geometry packages via Conda
conda install -c conda-forge geopandas=0.12.2 gdspy shapely=2.0.1 -y

# 3. Install remaining dependencies via Pip (including older pandas for Metal compatibility)
pip install pydantic pydantic-settings networkx matplotlib fastapi uvicorn scipy addict pyEPR-quantum pyside2
pip install pandas==1.5.3

# 4. Install PyAEDT without build isolation
pip install pyaedt --no-build-isolation

# 5. Finally, install Qiskit Metal without bringing in conflicting dependencies
pip install qiskit-metal --no-deps
```

### Step 2: Run the Generator
Once the environment is installed, you can pass your JSON file (e.g., `friend_star_topology.json`) into the generator script:

```powershell
python run_json.py friend_star_topology.json
```

### Step 3: View Your Results
The script will do all the heavy lifting automatically:
1. It reads the JSON and builds the topological graph.
2. It calculates the exact physical coordinates for all qubits and routes the waveguides.
3. It writes the Qiskit Metal Python script into the newly created `output/` folder.
4. **Automatic Extraction:** It silently executes the generated script in the background to physically draw the polygons and drops the final `.gds` layout file right next to your Python script!

To view your generated `.gds` file, we highly recommend downloading **KLayout**, the industry-standard open-source layout viewer.

### Step 4: Viewing the Chip in KLayout
1. Download the 64-bit Windows installer from the KLayout website: [klayout.de/build.html](https://www.klayout.de/build.html)
2. Run the `.exe` file to install it.
3. Open KLayout and simply drag-and-drop the generated `output/5_qubit_star_chip/5_qubit_star_chip_metal.gds` file directly into the KLayout window to see your physical quantum chip!
