"""Train the onboard copilot's intent classifier (multinomial naive Bayes) and write its weights
into the model bundle. Run from backend/:

    .venv/bin/python training/train_intents.py

Reproducible: same data → same weights. No external ML libraries needed.
"""
from __future__ import annotations

import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.ai.onboard.text import tokens  # noqa: E402

DATA = ROOT / "training" / "intents.jsonl"
OUT = ROOT / "models" / "astrovital-onboard-v1" / "intents.json"
ALPHA = 0.5  # Laplace smoothing


def train(rows: list[dict]) -> dict:
    by_intent: dict[str, Counter] = defaultdict(Counter)
    docs = Counter()
    for r in rows:
        by_intent[r["intent"]].update(tokens(r["text"]))
        docs[r["intent"]] += 1
    vocab = sorted({t for c in by_intent.values() for t in c})
    V, N = len(vocab), sum(docs.values())
    model = {"vocab_size": V, "alpha": ALPHA, "intents": {}}
    for intent, counts in sorted(by_intent.items()):
        total = sum(counts.values())
        model["intents"][intent] = {
            "log_prior": math.log(docs[intent] / N),
            "log_unk": math.log(ALPHA / (total + ALPHA * V)),
            "log_prob": {t: round(math.log((counts[t] + ALPHA) / (total + ALPHA * V)), 5) for t in counts},
        }
    return model


def accuracy(model: dict, rows: list[dict]) -> float:
    from app.ai.onboard.nlu import IntentClassifier
    clf = IntentClassifier(model)
    return sum(clf.predict(r["text"])[0] == r["intent"] for r in rows) / len(rows)


if __name__ == "__main__":
    rows = [json.loads(line) for line in DATA.read_text().splitlines() if line.strip()]
    model = train(rows)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(model, indent=1, sort_keys=True))
    print(f"trained on {len(rows)} examples, {len(model['intents'])} intents, vocab {model['vocab_size']}")
    print(f"training accuracy: {accuracy(model, rows):.1%}  →  {OUT.relative_to(ROOT)}")
