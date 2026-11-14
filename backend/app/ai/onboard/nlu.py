"""Onboard natural-language understanding.

* IntentClassifier — multinomial naive Bayes over unigrams+bigrams (weights from the model bundle).
* CheckinExtractor — turns a typed/dictated check-in into structured fields using the bundle's
  lexicon and a small pattern grammar, with negation handling ("no headache").
"""
from __future__ import annotations

import math
import re
from typing import Optional

from .text import tokens


class IntentClassifier:
    def __init__(self, weights: dict):
        self.w = weights["intents"]

    def predict(self, text: str) -> tuple[str, float]:
        """Return (intent, confidence 0..1)."""
        toks = tokens(text)
        scores = {}
        for intent, p in self.w.items():
            lp = p["log_prob"]
            scores[intent] = p["log_prior"] + sum(lp.get(t, p["log_unk"]) for t in toks)
        m = max(scores.values())
        exp = {k: math.exp(v - m) for k, v in scores.items()}
        z = sum(exp.values())
        best = max(exp, key=exp.get)
        known = sum(1 for t in toks if any(t in p["log_prob"] for p in self.w.values()))
        conf = exp[best] / z if known else 0.0
        return best, conf


_NUM_WORDS = {"zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
              "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "a": 1, "an": 1}
_NUM = r"(\d+(?:\.\d+)?|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|an?)\b)"
_NEG = re.compile(r"\b(no|not|without|never|zero|didn'?t have|haven'?t had|free of)\b[\w\s,]{0,25}$")


def _num(s: str) -> float:
    return float(_NUM_WORDS.get(s, s)) if s in _NUM_WORDS else float(s)


class CheckinExtractor:
    def __init__(self, lexicon: dict):
        self.lex = lexicon

    def extract(self, text: str) -> dict:
        t = " " + text.lower().replace("’", "'") + " "
        out: dict = {"symptoms": [], "unclear": []}
        used_spans: list[tuple[int, int]] = []

        def take(key: str, value: Optional[float], span: tuple[int, int]):
            if value is not None and key not in out:
                out[key] = value
                used_spans.append(span)

        # ---- blood pressure "121/78" or "121 over 78"
        if m := re.search(r"(?:bp|blood pressure|pressure)?\D{0,12}?\b(\d{2,3})\s*(?:/|over)\s*(\d{2,3})\b", t):
            take("sbp", float(m[1]), m.span()); take("dbp", float(m[2]), m.span())
        # ---- heart rate
        if m := re.search(r"\b(?:hr|heart rate|pulse|resting hr|heart)\b\D{0,15}?(\d{2,3})\b", t):
            take("hr", float(m[1]), m.span())
        # ---- SpO2
        if m := re.search(r"\b(?:spo2|spo₂|sat|sats|saturation|oxygen|o2)\b\D{0,12}?(\d{2,3})\s*%?", t):
            take("spo2", float(m[1]), m.span())
        # ---- temperature (°F converted)
        if m := re.search(r"\b(?:temp|temperature|fever of|fever)\b\D{0,12}?(\d{2,3}(?:\.\d)?)\s*(?:°|deg(?:rees)?)?\s*([cf])?\b", t):
            v = float(m[1])
            if (m[2] == "f") or v > 45:
                v = round((v - 32) * 5 / 9, 1)
            take("temp", v, m.span())
        # ---- body mass (lb converted)
        if m := re.search(r"\b(?:weigh(?:t|ed|ing)?|mass)\b\D{0,12}?(\d{2,3}(?:\.\d)?)\s*(kg|kilos?|lbs?|pounds)?", t):
            v = float(m[1])
            if m[2] and m[2].startswith(("lb", "pound")):
                v = round(v * 0.4536, 1)
            take("weight", v, m.span())
        # ---- sleep "slept 5 and a half hours", "about 6h of sleep", "slept five hours"
        if m := re.search(rf"\bslept\b\D{{0,12}}?{_NUM}(\s+and\s+a\s+half|\.5)?\s*(?:h\b|hours?|hrs?)?", t) or \
                re.search(rf"{_NUM}(\s+and\s+a\s+half)?\s*(?:h|hours?|hrs?)\s+(?:of\s+)?sleep", t):
            take("sleep", _num(m[1]) + (0.5 if m[2] else 0), m.span())
        # ---- exercise minutes "40 minutes on ARED", "30 min bike"
        for m in re.finditer(r"(\d{1,3})\s*(?:min(?:ute)?s?|m)\b\s*(?:on|of|doing)?\s*(?:the\s+)?(\w+)", t):
            kind = self.lex["exercise"].get(m[2])
            if kind:
                out[kind] = out.get(kind, 0) + float(m[1]); used_spans.append(m.span())
        for word, kind in self.lex["exercise"].items():   # "skipped the bike" → 0 if nothing else recorded
            if re.search(rf"\b(?:skipped|missed|no)\s+(?:the\s+|my\s+)?{word}\b", t) and kind not in out:
                out[kind] = 0.0
        # ---- fluid "2.5 litres", "drank 1800 ml"
        if m := re.search(r"(\d+(?:\.\d+)?)\s*(l|liters?|litres?|ml)\b", t):
            v = float(m[1]) / (1000 if m[2] == "ml" else 1)
            take("fluid", round(v, 2), m.span())
        # ---- blood glucose "glucose 95", "blood sugar 110 mg/dL", "BG 88"
        if m := re.search(r"\b(?:glucose|blood sugar|sugar|bg)\b\D{0,12}?(\d{2,3})\b", t):
            take("glucose", float(m[1]), m.span())
        # ---- energy "2400 kcal", "2,100 calories"
        if m := re.search(r"(\d{1,2},?\d{3}|\d{3,4})\s*(?:kcal|calories|cals?)\b", t):
            take("calories", float(m[1].replace(",", "")), m.span())
        # ---- protein "90 g protein", "protein 85g"
        if m := re.search(r"(\d{1,3})\s*(?:g|grams?)\s+(?:of\s+)?protein\b", t) or re.search(r"\bprotein\b\D{0,8}?(\d{1,3})\s*(?:g|grams?)\b", t):
            take("protein", float(m[1]), m.span())
        # ---- radiation "0.6 mSv"
        if m := re.search(r"(\d+(?:\.\d+)?)\s*msv\b", t):
            take("dose", float(m[1]), m.span())

        # ---- 1-5 scales from descriptive words (closest cue wins)
        for scale in ("mood", "stress", "fatigue"):
            for phrase, score in sorted(self.lex[scale].items(), key=lambda kv: -len(kv[0])):
                if m := re.search(rf"\b{re.escape(phrase)}\b", t):
                    if not _NEG.search(t[: m.start()]):
                        out[scale] = score
                        break
        if m := re.search(r"\bmood\b\D{0,8}(\d)\s*(?:/\s*5|out of 5)?", t):
            out["mood"] = max(1, min(5, int(m[1])))

        # ---- symptoms via synonyms, skipping negated mentions
        for sid, words in self.lex["symptoms"].items():
            for w in words:
                for m in re.finditer(rf"\b{re.escape(w)}\b", t):
                    if not _NEG.search(t[max(0, m.start() - 30): m.start()]):
                        if sid not in out["symptoms"]:
                            out["symptoms"].append(sid)
                        break

        # ---- sentences that produced nothing → 'unclear' so the astronaut can review them
        captured = set(out) - {"symptoms", "unclear"}
        for sent in re.split(r"(?<!\d)[.;!?\n]+|[.;!?\n]+(?!\d)", text):
            s = sent.strip()
            if len(s) < 4:
                continue
            got_metric = any(k in s.lower() for k in ("hr", "heart", "bp", "pressure", "slept", "sleep", "min", "weigh",
                                                      "temp", "litre", "liter", "msv", "sat", "oxygen", "mood", "glucose",
                                                      "sugar", "kcal", "calorie", "protein"))
            got_word = any(w in s.lower() for d in (self.lex["mood"], self.lex["stress"], self.lex["fatigue"]) for w in d)
            got_sym = any(w in s.lower() for ws in self.lex["symptoms"].values() for w in ws)
            if not (got_metric or got_word or got_sym):
                out["unclear"].append(s)
        if not captured and not out["symptoms"]:
            out["unclear"] = out["unclear"] or [text.strip()]
        return out
