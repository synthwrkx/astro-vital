"""Shared text normalisation for the onboard NLU (used identically at training and inference)."""
from __future__ import annotations

import re

_TOKEN = re.compile(r"[a-z0-9₂]+")
_STOP = {"a", "an", "the", "is", "are", "am", "i", "my", "me", "of", "to", "and", "for", "on", "in", "it", "be", "do", "did",
         "has", "have", "been", "with", "this", "that", "what", "how", "s", "you", "your", "can"}


def stem(w: str) -> str:
    for suf in ("ing", "ies", "ed", "es", "s"):
        if len(w) > len(suf) + 2 and w.endswith(suf):
            return w[: -len(suf)] + ("y" if suf == "ies" else "")
    return w


def tokens(text: str) -> list[str]:
    words = [stem(w) for w in _TOKEN.findall(text.lower()) if w not in _STOP]
    return words + [f"{a}_{b}" for a, b in zip(words, words[1:])]  # unigrams + bigrams
