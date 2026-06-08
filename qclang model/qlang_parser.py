import re
import json
import os
from pydantic import BaseModel, Field, field_validator, ValidationError, ConfigDict
from typing import List, Optional

# Load rules dynamically
RULES_FILE = os.path.join(os.path.dirname(__file__), 'rules.json')
with open(RULES_FILE, 'r') as f:
    RULES = json.load(f)

CONSTRAINTS = RULES['constraints']
HW_DEFAULTS = RULES['hardware_defaults']
PHYSICS = RULES['physics_defaults']
VOCAB = RULES['vocabulary']

# ==========================================
# 1. STRICT DATA MODELS (PYDANTIC)
# ==========================================

class LayerDetail(BaseModel):
    name: str
    material: str
    thickness_nm: float

class ChipData(BaseModel):
    name: str
    width_mm: float = HW_DEFAULTS['chip_width_mm']
    height_mm: float = HW_DEFAULTS['chip_height_mm']
    substrate: str = HW_DEFAULTS['substrate']
    layers: List[LayerDetail] = Field(default_factory=lambda: [LayerDetail(**l) for l in HW_DEFAULTS['layers']])

class Junction(BaseModel):
    type: str = "single"
    ej_ghz: Optional[float] = PHYSICS['junction_ej_ghz']
    ec_mhz: Optional[float] = PHYSICS['junction_ec_mhz']

class QubitGeometry(BaseModel):
    model_config = ConfigDict(extra='allow')
    pos_x: str
    pos_y: str

class ResonatorGeometry(BaseModel):
    model_config = ConfigDict(extra='allow')

class CouplerGeometry(BaseModel):
    model_config = ConfigDict(extra='allow')

class Qubit(BaseModel):
    id: str
    component_type: str = HW_DEFAULTS['qubit_geometry']['component_type']
    frequency_ghz: float = Field(..., ge=1.0, le=10.0, description="Freq in GHz")
    anharmonicity_mhz: float = Field(..., le=0.0, description="Must be negative")
    junction: Junction = Field(default_factory=Junction)
    geometry: QubitGeometry

class Resonator(BaseModel):
    id: str
    component_type: str = HW_DEFAULTS['resonator_geometry']['component_type']
    frequency_ghz: float = Field(..., ge=1.0, le=12.0)
    target_qubit: str
    coupling_type: str = PHYSICS['resonator_coupling_type']
    coupling_strength_mhz: float = PHYSICS['resonator_coupling_strength_mhz']
    geometry: ResonatorGeometry = Field(default_factory=ResonatorGeometry)

class Coupler(BaseModel):
    id: str
    component_type: str = HW_DEFAULTS['coupler_geometry']['component_type']
    source_qubit: str
    target_qubit: str
    strength_mhz: float = Field(default=PHYSICS['coupler_strength_mhz'], ge=0.0)
    coupler_type: str = PHYSICS['coupler_type']
    geometry: CouplerGeometry = Field(default_factory=CouplerGeometry)

class QLangOutputModel(BaseModel):
    chip: ChipData
    qubits: List[Qubit]
    resonators: List[Resonator]
    couplers: List[Coupler]

    @field_validator('qubits')
    def validate_qubit_limit(cls, v):
        max_q = CONSTRAINTS['max_qubits']
        min_q = CONSTRAINTS['min_qubits']
        if len(v) > max_q:
            raise ValueError(f'Qiskit Metal constraints: Maximum of {max_q} qubits allowed.')
        if len(v) < min_q:
            raise ValueError(f'Must have at least {min_q} qubit(s).')
        return v

# ==========================================
# 2. THE NLP PARSER ENGINE (No LLM)
# ==========================================

class QLangParser:
    def __init__(self):
        self.word_map = VOCAB['word_map']
        self.valid_topologies = VOCAB['valid_topologies']
        self.spacing = CONSTRAINTS['min_qubit_spacing_um']

    def parse_prompt(self, prompt: str) -> str:
        prompt = prompt.lower()
        
        try:
            num_qubits = self._extract_qubit_count(prompt)
        except ValueError as e:
            return json.dumps({"error": str(e)})
            
        topology = self._extract_topology(prompt)
        chip_name = f"{num_qubits}_qubit_{topology}_chip"
        
        raw_data = {
            "chip": {
                "name": chip_name, 
                "width_mm": HW_DEFAULTS['chip_width_mm'], 
                "height_mm": HW_DEFAULTS['chip_height_mm'], 
                "substrate": HW_DEFAULTS['substrate'],
                "layers": HW_DEFAULTS['layers']
            },
            "qubits": [],
            "resonators": [],
            "couplers": []
        }

        # Calculate coordinates for the qubits based on topology and constraints
        positions = self._calculate_positions(num_qubits, topology, self.spacing)

        freq_list = PHYSICS.get('qubit_frequencies_ghz', [])
        base_anh = PHYSICS['anharmonicity_base_mhz']
        step_anh = PHYSICS['anharmonicity_step_mhz']
        res_off = PHYSICS['resonator_offset_ghz']
        
        for i in range(num_qubits):
            if i < len(freq_list):
                q_freq = freq_list[i]
            else:
                q_freq = round(5.0 + (i * 0.1), 2)
                
            r_freq = round(q_freq + res_off, 2)
            pos_x, pos_y = positions[i]
            
            q_geo = { k: v for k, v in HW_DEFAULTS['qubit_geometry'].items() if k != 'component_type' }
            q_geo['pos_x'] = f"{pos_x}um"
            q_geo['pos_y'] = f"{pos_y}um"
            
            raw_data["qubits"].append({
                "id": f"Q{i}",
                "component_type": HW_DEFAULTS['qubit_geometry']['component_type'],
                "frequency_ghz": q_freq,
                "anharmonicity_mhz": base_anh + (i * step_anh),
                "junction": {"type": "single", "ej_ghz": PHYSICS['junction_ej_ghz'], "ec_mhz": PHYSICS['junction_ec_mhz']},
                "geometry": q_geo
            })
            
            r_geo = { k: v for k, v in HW_DEFAULTS['resonator_geometry'].items() if k != 'component_type' }
            raw_data["resonators"].append({
                "id": f"R{i}",
                "component_type": HW_DEFAULTS['resonator_geometry']['component_type'],
                "frequency_ghz": r_freq,
                "target_qubit": f"Q{i}",
                "coupling_type": PHYSICS['resonator_coupling_type'],
                "coupling_strength_mhz": PHYSICS['resonator_coupling_strength_mhz'],
                "geometry": r_geo
            })

        self._build_couplers(raw_data["couplers"], num_qubits, topology)

        try:
            validated_model = QLangOutputModel(**raw_data)
            return validated_model.model_dump_json(indent=2)
        except ValidationError as e:
            return f'{{"error": "Validation failed", "details": {e.json()}}}'

    def _extract_qubit_count(self, prompt: str) -> int:
        match = re.search(r'(\d+)\s*-?\s*(?:of\s+)?(qubit|transmon|qbit)s?', prompt)
        if match:
            return int(match.group(1))
            
        for word, num in self.word_map.items():
            if re.search(rf'\b{word}\b\s*-?\s*(?:of\s+)?(qubit|transmon|qbit)s?', prompt):
                return num
                
        raise ValueError("Could not determine the number of qubits from the prompt.")

    def _extract_topology(self, prompt: str) -> str:
        for t in self.valid_topologies:
            if re.search(rf'\b{t}\b', prompt):
                return t
        return "line"

    def _calculate_positions(self, num_qubits, topology, spacing):
        positions = []
        if topology in ["square", "ring"] and num_qubits >= 4:
            positions = [(0, spacing), (spacing, spacing), (0, 0), (spacing, 0)]
            for i in range(4, num_qubits):
                positions.append((spacing * (i-2), -spacing))
        elif topology == "star" and num_qubits >= 3:
            positions.append((0, 0)) # Center
            if num_qubits > 1: positions.append((0, spacing))    # Top
            if num_qubits > 2: positions.append((spacing, 0))    # Right
            if num_qubits > 3: positions.append((0, -spacing))   # Bottom
            if num_qubits > 4: positions.append((-spacing, 0))   # Left
            for i in range(5, num_qubits):
                positions.append((spacing * i, spacing * i))
        else: # Default line
            for i in range(num_qubits):
                positions.append((i * spacing, 0))
        return positions

    def _build_couplers(self, couplers_list, num_qubits, topology):
        def add(src, tgt):
            couplers_list.append({
                "id": f"C{src}{tgt}",
                "component_type": HW_DEFAULTS['coupler_geometry']['component_type'],
                "source_qubit": f"Q{src}", "target_qubit": f"Q{tgt}",
                "strength_mhz": PHYSICS['coupler_strength_mhz'],
                "coupler_type": PHYSICS['coupler_type'],
                "geometry": { k: v for k, v in HW_DEFAULTS['coupler_geometry'].items() if k != 'component_type' }
            })

        if topology in ["square", "ring"]:
            if num_qubits >= 4:
                add(0, 1); add(0, 2); add(1, 3); add(2, 3)
            else:
                topology = "line"
        
        if topology == "star":
            if num_qubits >= 3:
                for i in range(1, num_qubits): add(0, i)
            else:
                topology = "line"

        if topology == "line":
            for i in range(num_qubits - 1): add(i, i + 1)

# ==========================================
# 4. TESTING SUITE
# ==========================================
if __name__ == "__main__":
    parser = QLangParser()
    
    test_prompts = [
        "Create a 4 qubit square chip for qiskit metal",
        "Give me a square layout with four transmons",
        "I want a 5-qubit star topology",
        "Just a basic 2 qubit line",
        "Design a 10 qubit line chip"  # This should trigger validation error
    ]
    
    print("=== QLANG PARSER TEST SUITE ===\n")
    for p in test_prompts:
        print(f"PROMPT: '{p}'")
        result = parser.parse_prompt(p)
        print("RESULT:")
        print(result)
        print("-" * 50)
