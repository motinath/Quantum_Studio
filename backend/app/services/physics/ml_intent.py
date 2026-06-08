"""
Quantum chip intent classifier (from ML_model notebook).

Neural network reads natural-language prompts and predicts:
  - Number of qubits (1–7) for layout generation
  - Suggested topology (grid, star, line, …)

Uses bag-of-words features + a small feedforward net (QuantumIntentModel).
"""
import re
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    _TORCH_OK = True
except ImportError:
    torch = None  # type: ignore
    nn = None     # type: ignore
    optim = None  # type: ignore
    _TORCH_OK = False

# Training corpus from notebook Cell 3
TRAINING_CORPUS = [
    ("create a single qubit chip", 0),
    ("build 1 qubit processor", 0),
    ("design a 2 qubit layout with standard coupling", 1),
    ("make a pair of qubits", 1),
    ("route a 3 qubit triangular architecture", 2),
    ("generate a three qubit setup", 2),
    ("synthesize a 4-qubit grid configuration", 3),
    ("build a four qubit processor", 3),
    ("compile a 5 qubit star network hub", 4),
    ("design five qubits on silicon", 4),
    ("initialize a 6 qubit hexagonal processor", 5),
    ("route a six qubit system", 5),
    ("generate a heavy hex 7 qubit core topology", 6),
    ("compile a seven qubit quantum chip", 6),
]

# Keyword → feature index (8-dim bag-of-words vector)
KEYWORD_VOCAB = {
    "1": 1, "one": 1, "single": 1,
    "2": 2, "two": 2, "pair": 2,
    "3": 3, "three": 3, "triangular": 3,
    "4": 4, "four": 4, "grid": 4,
    "5": 5, "five": 5, "star": 5, "hub": 5,
    "6": 6, "six": 6, "hexagonal": 6, "hex": 6,
    "7": 7, "seven": 7, "heavy": 7,
}

# ML class index → default topology for chip layout
CLASS_TOPOLOGY = {
    0: "grid",
    1: "line",
    2: "line",
    3: "grid",
    4: "star",
    5: "grid",
    6: "grid",
}

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "intent_model.pt"

# ML classifier only covers 1–7 qubits (classes 0–6). Above that → regex/rules.
ML_QUBIT_MIN = 1
ML_QUBIT_MAX = 7

WORD_TO_NUM = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
    "nineteen": 19, "twenty": 20, "twenty-four": 24,
}

_model: Optional[Any] = None


class QuantumIntentModel:
    """Placeholder when torch is not installed."""


if _TORCH_OK:
    class QuantumIntentModel(nn.Module):  # type: ignore[no-redef]
        """8 → 16 → 7 classifier: maps prompt features to qubit-count class 0–6 (= 1–7 qubits)."""

        def __init__(self):
            super().__init__()
            self.network = nn.Sequential(
                nn.Linear(8, 16),
                nn.ReLU(),
                nn.Linear(16, 7),
            )

        def forward(self, x: "torch.Tensor") -> "torch.Tensor":
            return self.network(x)


def text_to_features(text: str) -> "torch.Tensor":
    if not _TORCH_OK:
        raise ImportError("torch is required for ML intent classification")
    features = [0.0] * 8
    for word in re.findall(r"\w+", text.lower()):
        if word in KEYWORD_VOCAB:
            features[KEYWORD_VOCAB[word]] = 1.0
    return torch.FloatTensor(features)


def _train_model(epochs: int = 100) -> QuantumIntentModel:
    if not _TORCH_OK:
        raise ImportError("torch is required for ML model training")
    torch.manual_seed(42)
    model = QuantumIntentModel()
    optimizer = optim.Adam(model.parameters(), lr=0.05)
    criterion = nn.CrossEntropyLoss()
    model.train()
    for _ in range(epochs):
        for text, label in TRAINING_CORPUS:
            optimizer.zero_grad()
            x = text_to_features(text)
            y = torch.LongTensor([label])
            out = model(x).unsqueeze(0)
            loss = criterion(out, y)
            loss.backward()
            optimizer.step()
    model.eval()
    return model


def save_model(model: QuantumIntentModel, path: Path = MODEL_PATH) -> None:
    if not _TORCH_OK:
        raise ImportError("torch is required")
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "version": 1}, path)


def load_model(path: Path = MODEL_PATH) -> QuantumIntentModel:
    if not _TORCH_OK:
        raise ImportError("torch is required for ML intent model")
    model = QuantumIntentModel()
    if path.is_file():
        try:
            checkpoint = torch.load(path, map_location="cpu", weights_only=True)
        except TypeError:
            checkpoint = torch.load(path, map_location="cpu")
        model.load_state_dict(checkpoint["state_dict"])
    else:
        model = _train_model()
        save_model(model, path)
    model.eval()
    return model


def get_model() -> QuantumIntentModel:
    if not _TORCH_OK:
        raise ImportError("torch is required for ML intent classification")
    global _model
    if _model is None:
        _model = load_model()
    return _model


def predict_intent(prompt: str) -> Dict[str, Any]:
    """
    Run ML inference on user prompt.
    Returns qubits (1–7), topology hint, confidence, and class index.
    Raises ImportError if torch is not installed.
    """
    if not _TORCH_OK:
        raise ImportError("torch is required for ML intent classification")
    model = get_model()
    features = text_to_features(prompt)
    with torch.no_grad():
        logits = model(features)
        probs = torch.softmax(logits, dim=0)
        class_idx = int(torch.argmax(logits).item())
        confidence = float(probs[class_idx].item())

    qubits = class_idx + 1
    topology = CLASS_TOPOLOGY.get(class_idx, "grid")

    p = prompt.lower()
    if any(w in p for w in ("star", "hub")):
        topology = "star"
    elif any(w in p for w in ("line", "chain", "linear", "bell", "entangle")):
        topology = "line"
    elif any(w in p for w in ("grid", "square", "lattice", "2x2", "fabricat")):
        topology = "grid"
    elif any(w in p for w in ("triangular",)):
        topology = "line"
    elif any(w in p for w in ("hexagonal", "hex", "heavy")):
        topology = "grid"

    return {
        "qubits": qubits,
        "topology": topology,
        "class_index": class_idx,
        "confidence": round(confidence, 3),
        "method": "ml",
    }


def has_explicit_qubit_count(prompt: str) -> Optional[int]:
    """If prompt contains an explicit N-qubit phrase, return N (digits or number words)."""
    p = prompt.lower()
    for pattern in [
        r"\b(\d+)\s*-?\s*qubits?\b",
        r"\bqubits?\s*(\d+)\b",
    ]:
        m = re.search(pattern, p)
        if m:
            return int(m.group(1))
    for word, num in WORD_TO_NUM.items():
        if re.search(rf"\b{word}\s*-?\s*qubits?\b", p) or re.search(rf"\bqubits?\s*{word}\b", p):
            return num
    return None


def _detect_topology_regex(prompt: str, n: int) -> str:
    """Rule-based topology detection for all qubit counts."""
    p = prompt.lower()
    # Explicit topology keywords — checked first, highest priority
    if re.search(r"heavy.?hex", p):
        return "heavy_hex"
    if any(w in p for w in ("line", "chain", "linear", "bell", "entangle")):
        return "line"
    if any(w in p for w in ("ring", "circular", "loop")):
        return "ring"
    if any(w in p for w in ("star", "hub")):
        return "star"
    if any(w in p for w in ("grid", "square", "lattice", "2x2", "2×2", "surface")):
        return "grid"
    # Size-based defaults for common IBM architectures
    if n == 27:
        return "heavy_hex"   # Falcon / Hummingbird
    if n == 53:
        return "heavy_hex"   # Eagle / Sycamore-class
    if n == 127:
        return "heavy_hex"   # Eagle r3
    if n in (16, 65):
        return "heavy_hex"
    return "grid"            # sensible default for everything else


def _apply_topology_keywords(prompt: str, default: str) -> str:
    p = prompt.lower()
    if re.search(r"heavy.?hex", p):
        return "heavy_hex"
    if any(w in p for w in ("star", "hub")):
        return "star"
    if any(w in p for w in ("line", "chain", "linear", "bell", "entangle")):
        return "line"
    if any(w in p for w in ("grid", "square", "lattice", "2x2", "fabricat")):
        return "grid"
    if any(w in p for w in ("triangular",)):
        return "line"
    if any(w in p for w in ("hexagonal", "hex")):
        return "heavy_hex"
    if any(w in p for w in ("ring", "circular", "loop")):
        return "ring"
    return default


def _resolve_regex_only(prompt: str, requested: int, max_qubits: int) -> Tuple[int, int, str, Dict[str, Any]]:
    """8+ qubits (or explicit 0): original regex/rules path — no ML qubit prediction."""
    n = max(1, min(max_qubits, requested if requested > 0 else 4))
    topology = _detect_topology_regex(prompt, n)
    ml_info = {
        "qubits": n,
        "topology": topology,
        "class_index": None,
        "confidence": None,
        "method": "regex",
        "ml_skipped": True,
        "reason": (
            f"Using rule-based parser ({requested} qubits > ML range 1–{ML_QUBIT_MAX})"
            if requested > ML_QUBIT_MAX
            else f"Using rule-based parser (qubit count {requested} outside ML range)"
        ),
    }
    return n, requested, topology, ml_info


def resolve_design_params(prompt: str, max_qubits: int = 24) -> Tuple[int, int, str, Dict[str, Any]]:
    """
    1–7 qubits: ML intent model (+ keyword topology).
    8+ qubits (or explicit 0): regex/rule-based detection (pre-ML behavior).
    Falls back to regex-only if torch is not installed.
    """
    requested = has_explicit_qubit_count(prompt)

    # 8+ or invalid → regex only (no ML for qubit count)
    if requested is not None and (requested > ML_QUBIT_MAX or requested < ML_QUBIT_MIN):
        return _resolve_regex_only(prompt, requested, max_qubits)

    # If torch is unavailable, always fall back to regex
    if not _TORCH_OK:
        n = max(1, min(max_qubits, requested if requested is not None else 4))
        topology = _detect_topology_regex(prompt, n)
        ml_info = {
            "qubits": n, "topology": topology,
            "class_index": None, "confidence": None,
            "method": "regex", "ml_skipped": True,
            "reason": "torch not installed — using rule-based parser",
        }
        return n, n, topology, ml_info

    # Explicit 1–7: use that count; ML helps topology
    if requested is not None and ML_QUBIT_MIN <= requested <= ML_QUBIT_MAX:
        n = max(ML_QUBIT_MIN, min(max_qubits, requested))
        ml_info = predict_intent(prompt)
        topology = _apply_topology_keywords(prompt, ml_info["topology"])
        ml_info = {
            **ml_info,
            "qubits": requested,
            "topology": topology,
            "method": "ml+regex",
            "ml_skipped": False,
            "reason": f"Explicit {requested} qubits in ML range; topology from ML + keywords",
        }
        return n, requested, topology, ml_info

    # No explicit count → ML predicts 1–7
    ml_info = predict_intent(prompt)
    n = max(ML_QUBIT_MIN, min(max_qubits, ml_info["qubits"]))
    topology = _apply_topology_keywords(prompt, ml_info["topology"])
    ml_info = {**ml_info, "topology": topology, "ml_skipped": False, "reason": "ML intent (1–7 qubits)"}
    return n, ml_info["qubits"], topology, ml_info
