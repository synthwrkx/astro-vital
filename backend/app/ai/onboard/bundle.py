"""Loads the onboard model bundle (manifest + weights) from disk."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

DEFAULT_DIR = Path(__file__).resolve().parents[3] / "models" / "astrovital-onboard-v1"


class BundleMissing(Exception):
    pass


@dataclass(frozen=True)
class ModelBundle:
    path: Path
    manifest: dict
    intents: dict
    lexicon: dict

    @property
    def id(self) -> str:
        return self.manifest["id"]

    @property
    def version(self) -> str:
        return self.manifest["version"]

    @classmethod
    def load(cls, path: str | Path | None = None) -> "ModelBundle":
        p = Path(path or os.getenv("ASTROVITAL_MODEL_DIR") or DEFAULT_DIR)
        try:
            manifest = json.loads((p / "manifest.json").read_text())
            comps = manifest["components"]
            intents = json.loads((p / comps["intent_classifier"]["file"]).read_text())
            lexicon = json.loads((p / comps["checkin_extractor"]["file"]).read_text())
        except (OSError, KeyError, json.JSONDecodeError) as e:
            raise BundleMissing(f"Onboard model bundle not found or invalid at {p}: {e}") from e
        return cls(p, manifest, intents, lexicon)
