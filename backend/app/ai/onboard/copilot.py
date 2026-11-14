"""Onboard copilot: intent → handler (Command pattern via a registry).

Flow: safety override → intent classification → handler builds a Markdown answer grounded in
the astronaut's data and records which data it used ("sources").
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable

from ...core import DOMAINS, LEVEL_LABEL, METRICS, SYMPTOM_BY_ID, Finding
from ...core.profiles import profile
from ...core.stats import is_num, median, values
from .insights import Insights
from .nlg import anomaly_note, metric_line
from .nlu import IntentClassifier

EMERGENCY = re.compile(r"\b(chest pain|chest pressure|can'?t breathe|cannot breathe|short(ness)? of breath|fainted|passed out|"
                       r"blacked out|severe pain|vomiting blood|confus(ed|ion)|seizure|unconscious)\b", re.I)
MIN_CONFIDENCE = 0.3
# Keyword fallback (hybrid NLU): strong domain words route to a topic when the classifier is unsure.
KEYWORDS = {
    "environment": ("headache", "co2", "vision", "eye", "oxygen", "spo2", "congestion"),
    "sleep": ("sleep", "insomnia", "nap"), "radiation": ("radiation", "dose", "msv", "solar", "dosimeter"),
    "exercise": ("exercise", "ared", "treadmill", "bike", "bone", "workout"), "cardio": ("heart", "pulse", "blood pressure", "bp"),
    "immune": ("fever", "temperature", "infection", "rash", "cold sore", "throat"),
    "weight": ("weight", "mass", "eat", "food", "nutrition", "glucose", "sugar", "calorie", "protein", "diet"),
    "mood": ("mood", "stress", "lonely", "anxious", "sad", "crew"), "alertness": ("reaction", "alert", "pvt", "focus", "eva"),
}


@dataclass(frozen=True)
class Topic:
    """Declarative description of a health topic the copilot can discuss."""
    domain: str
    title: str
    metrics: tuple[str, ...]
    symptoms: tuple[str, ...] = ()
    keywords: tuple[str, ...] = ()        # filter findings within a shared domain
    link_terms: tuple[str, ...] = ()      # which correlation sentences are relevant
    forecast_metrics: tuple[str, ...] = ()


TOPICS: dict[str, Topic] = {
    "sleep": Topic("behavior", "Sleep", ("sleep", "fatigue"), ("insomnia",), ("sleep",), ("sleep",), ("sleep",)),
    "exercise": Topic("bone", "Exercise & bone health", ("resistance", "aerobic"), ("back_pain", "joint_pain"),
                      ("exercise",), ("resistance",)),
    "cardio": Topic("cardio", "Heart & blood pressure", ("hr", "sbp", "dbp"), ("palpitations", "dizziness", "faint", "chest_pain")),
    "immune": Topic("immune", "Immune health", ("temp",), ("sore_throat", "cold_sore", "rash", "wound")),
    "mood": Topic("behavior", "Mood & stress", ("mood", "stress"), ("low_mood", "conflict"), ("mood", "stress", "crew"),
                  ("mood", "stress"), ("mood",)),
    "alertness": Topic("behavior", "Alertness", ("pvt", "lapses", "fatigue"), (), ("alertness",), ("reaction",), ("pvt",)),
    "radiation": Topic("radiation", "Radiation", ("dose",), ("nausea",)),
    "environment": Topic("env", "Environment & vision", ("spo2",), ("headache", "congestion", "vision")),
    "weight": Topic("nutrition", "Nutrition, body mass & blood sugar", ("weight", "calories", "protein", "glucose", "fluid"),
                    ("poor_appetite", "shaky"), (), (), ("weight",)),
}


@dataclass
class Answer:
    text: str
    sources: list[str]


Handler = Callable[[Insights], Answer]


class CopilotResponder:
    def __init__(self, classifier: IntentClassifier):
        self.clf = classifier
        self.handlers: dict[str, Handler] = {
            "help": self._help, "status": self._status, "why_status": self._why, "plan": self._plan, "trends": self._trends,
            **{name: (lambda ins, t=topic: self._topic(ins, t)) for name, topic in TOPICS.items()},
        }

    # ---------------------------------------------------------------- entry point
    def respond(self, ins: Insights, turns: list[dict]) -> Answer:
        question = turns[-1]["content"]
        if EMERGENCY.search(question):
            return self._emergency()
        intent, conf = self.clf.predict(question)
        if conf < MIN_CONFIDENCE and (kw := self._keyword_intent(question)):
            intent, conf = kw, max(conf, MIN_CONFIDENCE)
        if conf < MIN_CONFIDENCE:
            # follow-up like "and last month?" → reuse the previous user question's intent
            prev = [t["content"] for t in turns[:-1] if t["role"] == "user"]
            if prev:
                p_intent, p_conf = self.clf.predict(prev[-1])
                if p_conf >= MIN_CONFIDENCE:
                    intent, conf = p_intent, p_conf
        if conf < MIN_CONFIDENCE:
            intent = "help"
        ans = self.handlers[intent](ins)
        ans.sources.insert(0, f"intent: {intent} ({conf:.0%})")
        return ans

    @staticmethod
    def _keyword_intent(text: str) -> str | None:
        t = text.lower()
        hits = {intent: sum(w in t for w in words) for intent, words in KEYWORDS.items()}
        best = max(hits, key=hits.get)
        return best if hits[best] else None

    # ---------------------------------------------------------------- handlers
    @staticmethod
    def _emergency() -> Answer:
        return Answer(
            "**This may be an emergency.**\n\n"
            "1. Stop what you are doing and tell a crewmate now.\n"
            "2. Open the onboard **emergency medical checklist** and follow it.\n"
            "3. Contact the **flight surgeon** on the priority channel. Don't wait for the next scheduled conference.\n\n"
            "Log the symptom in today's check-in when you're safe so the timeline is captured.",
            ["safety override"])

    @staticmethod
    def _help(ins: Insights) -> Answer:
        return Answer(
            "I'm the onboard health copilot. I run entirely on this spacecraft, using your own records. You can ask me things like:\n\n"
            "- *How am I doing?* or *Why is my status what it is?*\n"
            "- *How is my sleep / mood / alertness / exercise / heart rate?*\n"
            "- *What happened with the radiation spike?*\n"
            "- *Have my headaches followed a pattern?*\n"
            "- *What changed since preflight?*\n"
            "- *What should I focus on this week?*\n\n"
            "I explain the rule-engine findings and add forecasts and patterns; I don't replace the flight surgeon.", [])

    def _status(self, ins: Insights) -> Answer:
        ev = ins.ev
        L = [f"**Overall: {LEVEL_LABEL[ev.overall]}** (mission day {ev.mission_day}).", ""]
        L += [f"- {DOMAINS[k]['name']}: {LEVEL_LABEL[d['level']]}" + (f" ({d['findings'][0]['title']})" if d["findings"] else "")
              for k, d in ev.domains.items()]
        if note := anomaly_note(ins):
            L += ["", note]
        if ins.forecasts:
            L += ["", ins.forecasts[0].description]
        return Answer("\n".join(L), ["current status", "anomaly model", "trend forecaster"])

    def _why(self, ins: Insights) -> Answer:
        ev = ins.ev
        if not ev.findings:
            return Answer("Everything is within your personal baseline, so your status is **Nominal**. Nothing is driving an alert.", ["current status"])
        L = [f"Your status is **{LEVEL_LABEL[ev.overall]}** because of these findings (most serious first):", ""]
        for f in ev.findings[:6]:
            L.append(f"- **{f.title}** [{LEVEL_LABEL[f.level]}{', notify surgeon' if f.escalate else ''}]: {f.detail}")
        if ins.links:
            L += ["", "**How these connect:** " + " ".join(ins.links[:2])]
        return Answer("\n".join(L), ["current status", "correlation analysis"])

    def _plan(self, ins: Insights) -> Answer:
        ev = ins.ev
        if not ev.findings:
            return Answer("No issues to act on. Keep your countermeasure schedule, protect sleep, and check in tomorrow.", ["current status"])
        L = ["Here's what to focus on, most urgent first:", ""]
        for i, f in enumerate(ev.findings[:5], 1):
            when = "today" if f.level == "act" else "this week"
            L.append(f"{i}. **{f.title}** ({when}): {f.actions[0]}" + (" Then notify the flight surgeon." if f.escalate else ""))
        if ins.forecasts:
            L += ["", f"Looking ahead: {ins.forecasts[0].description}"]
        return Answer("\n".join(L), ["current status", "trend forecaster"])

    def _trends(self, ins: Insights) -> Answer:
        drift = [d for d in ins.ev.drift if abs(d["z"]) >= 1][:6]
        if not drift:
            return Answer("Your last 7 days look like your preflight baseline: no metric is more than 1σ away.", ["drift scan"])
        L = ["Biggest changes vs. your preflight baseline (7-day average):", ""]
        L += [f"- **{METRICS[d['key']]['label']}**: {d['recent']:.{METRICS[d['key']]['dec']}f} vs {d['baseline']:.{METRICS[d['key']]['dec']}f} "
              f"{METRICS[d['key']]['unit']} ({d['z']:+.1f}σ)" for d in drift]
        if ins.forecasts:
            L += ["", "**Forecast:** " + " ".join(f.description for f in ins.forecasts[:2])]
        return Answer("\n".join(L), ["drift scan", "trend forecaster"])

    def _topic(self, ins: Insights, t: Topic) -> Answer:
        ctx, ev = ins.ctx, ins.ev
        sources = [f"{METRICS[m]['label']} history" for m in t.metrics]
        findings: list[Finding] = [f for f in ev.findings if f.domain == t.domain and
                                   (not t.keywords or any(k in f.title.lower() for k in t.keywords))]
        L = [f"### {t.title}"]
        if findings:
            L += [f"- **{f.title}** [{LEVEL_LABEL[f.level]}]: {f.detail}" for f in findings]
        else:
            L.append(f"No active findings: {t.title.lower()} is within your baseline.")
        L += ["", *[metric_line(ins, m) for m in t.metrics]]
        if t.domain == "radiation" and ev.radiation:
            r = ev.radiation
            typical = median(values(ctx.flight_entries, "dose"))
            spikes = [e for e in ctx.flight_entries if is_num(e.get("dose")) and e["dose"] >= 3 * typical and e["dose"] >= typical + 1]
            L.append(f"- Mission dose {r['mission_dose']:.1f} mSv; career {r['career']:.0f}/{r['limit']:.0f} mSv ({r['pct']:.0f}%); "
                     f"projected {r['projected']:.0f} mSv at mission end.")
            p = profile(ctx.settings.get("mission_profile"))
            if p["dose_msv_day"]:
                L.append(f"- Typical {typical:.2f} mSv/day vs {p['dose_msv_day']} expected for {p['name']} ({p['dose_source']}).")
            if spikes:
                L.append("- Dose spikes (possible solar particle events): " +
                         ", ".join(f"{e['date']}: {e['dose']:.1f} mSv" for e in spikes[:5]) + f" vs typical {typical:.2f} mSv/day.")
            sources.append("radiation budget")
        for sid in t.symptoms:
            days = [e["date"] for e in ctx.entries[-30:] if sid in (e.get("symptoms") or [])]
            if days:
                L.append(f"- {SYMPTOM_BY_ID[sid]['label']}: reported on {len(days)} of the last 30 days "
                         f"(most recent {days[-1]}{', ' + self._pattern(days) if len(days) >= 3 else ''}).")
                sources.append(f"'{SYMPTOM_BY_ID[sid]['label']}' reports")
        links = [s for s in ins.links if any(term in s for term in t.link_terms)]
        fc = [f for f in ins.forecasts if f.metric in t.forecast_metrics]
        if links or fc:
            L += ["", *(f"*{s}*" for s in links), *(f"**Forecast:** {f.description}" for f in fc)]
        if findings:
            L += ["", "**What to do:**", *[f"- {a}" for a in dict.fromkeys(a for f in findings for a in f.actions[:2])]]
            if any(f.escalate for f in findings):
                L.append("- Flag this for the flight surgeon at your next opportunity.")
        return Answer("\n".join(L), sources)

    @staticmethod
    def _pattern(days: list[str]) -> str:
        from datetime import date
        ds = [date.fromisoformat(d) for d in days]
        gaps = [(b - a).days for a, b in zip(ds, ds[1:])]
        streak = all(g <= 2 for g in gaps[-3:])
        return "clustered in recent days" if streak else f"roughly every {round(sum(gaps) / len(gaps))} days"
