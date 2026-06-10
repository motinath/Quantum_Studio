const fs = require('fs');
const file = 'src/routes/_app/architecture-explorer.tsx';
let d = fs.readFileSync(file, 'utf8');

// 1. Add new imports
d = d.replace(
  'import { useProject } from "@/lib/project-context";',
  'import { useProject } from "@/lib/project-context";\nimport { QuantumArchitectureEngine } from "@/lib/architecture/QuantumArchitectureEngine";\nimport { ArchConfig, ArchResult, ArchGraph, GNode, GEdge, TechnologyType, TopologyType, ConnectivityConstraint, ControlArchitecture, PackagingType, EnvironmentType } from "@/lib/architecture/types";'
);

// 2. Delete old types
d = d.replace(/interface ArchConfig \{[\s\S]*?\} as const;/g, '');

const techConsts = `const TECHNOLOGIES = [
  { id: "transmon", name: "Transmon", chipAreaPerQubit: 0.12, baseFidelity: 99.2, powerPerQubit: 0.02, coolingPerQubit: 0.01047, coherenceFactor: 1.0 },
  { id: "silicon-spin", name: "Silicon Spin", chipAreaPerQubit: 0.04, baseFidelity: 98.8, powerPerQubit: 0.008, coolingPerQubit: 0.005, coherenceFactor: 0.9 },
  { id: "trapped-ion", name: "Trapped Ion", chipAreaPerQubit: 0.08, baseFidelity: 99.5, powerPerQubit: 0.05, coolingPerQubit: 0.002, coherenceFactor: 1.0 },
  { id: "photonic", name: "Photonic", chipAreaPerQubit: 0.08, baseFidelity: 98.5, powerPerQubit: 0.03, coolingPerQubit: 0.001, coherenceFactor: 1.1 },
  { id: "fluxonium", name: "Fluxonium", chipAreaPerQubit: 0.18, baseFidelity: 99.5, powerPerQubit: 0.025, coolingPerQubit: 0.012, coherenceFactor: 1.2 },
] as const;

const TOPOLOGIES = [
  { id: "heavy-hex", name: "Heavy Hex" },
  { id: "square-grid", name: "Square Grid" },
  { id: "line", name: "Line" },
  { id: "circular", name: "Circular" },
  { id: "custom", name: "Custom" },
] as const;

const COUPLER_TYPES = [
  { id: "fixed", name: "Fixed", fidelityBonus: 0, dcFluxFactor: 1.5, controlMul: 1.0 },
  { id: "tunable", name: "Tunable", fidelityBonus: 0.3, dcFluxFactor: 2.5, controlMul: 1.2 },
  { id: "resonator", name: "Resonator-Mediated", fidelityBonus: 0.1, dcFluxFactor: 1.0, controlMul: 1.05 },
] as const;
`;
d = d.replace('const DETAIL_LEVELS', techConsts + '\nconst DETAIL_LEVELS');

// 3. Delete old computation functions
d = d.replace(/function getCouplerCount\([\s\S]*?function buildGraph\([\s\S]*?return \{ nodes, edges \};\n\}/g, '');

fs.writeFileSync(file, d);
