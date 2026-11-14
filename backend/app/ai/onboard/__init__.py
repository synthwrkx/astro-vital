"""OnboardHealthAssistant — adapter that implements the HealthAssistant port with the offline
AstroVital Onboard Health Model. Composes the model's components (Facade over NLU, analytics, NLG)."""
from __future__ import annotations

import asyncio

from ...core import METRICS, HealthEvaluator
from ..base import AIUnavailable, Briefing, ChatReply, CheckinDraft
from .analytics import AnomalyDetector, TrendForecaster
from .bundle import ModelBundle
from .copilot import CopilotResponder
from .insights import InsightEngine
from .nlg import BriefingWriter, SurgeonReportWriter
from .nlu import CheckinExtractor, IntentClassifier


class OnboardHealthAssistant:
    enabled = True

    def __init__(self, bundle: ModelBundle, evaluator: HealthEvaluator | None = None):
        self.bundle = bundle
        self.model, self.version = bundle.id, bundle.version
        m = bundle.manifest
        self.insights = InsightEngine(evaluator or HealthEvaluator(),
                                      AnomalyDetector(m.get("anomaly_threshold", 2.5)),
                                      TrendForecaster(m.get("forecast_horizon_days", 45)))
        self.extractor = CheckinExtractor(bundle.lexicon)
        self.copilot = CopilotResponder(IntentClassifier(bundle.intents))
        self.briefing_writer = BriefingWriter()
        self.report_writer = SurgeonReportWriter()

    # Inference is CPU-bound but fast; run it off the event loop so the API stays responsive.
    async def _run(self, fn, *a):
        return await asyncio.to_thread(fn, *a)

    def _analyze(self, entries: list[dict], settings: dict):
        ins = self.insights.analyze(entries, settings)
        if not ins.has_data:
            raise AIUnavailable("No check-ins to analyse yet.")
        return ins

    async def briefing(self, entries: list[dict], settings: dict) -> Briefing:
        return await self._run(lambda: self.briefing_writer.write(self._analyze(entries, settings)))

    async def chat(self, entries: list[dict], settings: dict, turns: list[dict]) -> ChatReply:
        def go():
            a = self.copilot.respond(self._analyze(entries, settings), turns)
            return ChatReply(reply=a.text, sources=a.sources)
        return await self._run(go)

    async def parse_checkin(self, text: str) -> CheckinDraft:
        def go():
            raw = self.extractor.extract(text)
            for k, m in METRICS.items():   # never pass implausible numbers to the form
                v = raw.get(k)
                if v is not None and not (m["min"] <= v <= m["max"]):
                    raw["unclear"].append(f"{m['label']} value {v} looked implausible and was dropped")
                    raw.pop(k)
            return CheckinDraft(**raw)
        return await self._run(go)

    async def surgeon_report(self, entries: list[dict], settings: dict) -> str:
        return await self._run(lambda: self.report_writer.write(self._analyze(entries, settings), settings))


__all__ = ["OnboardHealthAssistant", "ModelBundle"]
