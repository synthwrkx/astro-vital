"""Onboard model components: NLU, analytics, generators, copilot."""
import json
from pathlib import Path

import pytest

from app.ai.onboard import ModelBundle, OnboardHealthAssistant
from app.ai.onboard.analytics import AnomalyDetector, TrendForecaster
from app.ai.onboard.nlu import CheckinExtractor, IntentClassifier
from app.core import EvaluationContext
from app.core.demo import generate_demo


@pytest.fixture(scope="module")
def bundle():
    return ModelBundle.load()


@pytest.fixture(scope="module")
def demo():
    return generate_demo()


def test_bundle_loads(bundle):
    assert bundle.id == "astrovital-onboard-v1" and "sleep" in bundle.intents["intents"]


@pytest.mark.parametrize("q,intent", [
    ("Why is my status what it is today?", "why_status"),
    ("Am I keeping up with exercise to protect my bones?", "exercise"),
    ("What happened around the radiation spike?", "radiation"),
    ("What should I focus on this week?", "plan"),
    ("how's my blood pressure looking", "cardio"),
    ("am I losing weight", "weight"),
])
def test_intents(bundle, q, intent):
    assert IntentClassifier(bundle.intents).predict(q)[0] == intent


def test_extractor_full_sentence(bundle):
    x = CheckinExtractor(bundle.lexicon).extract(
        "Slept about 5 and a half hours, woke up with a headache again. HR 68, BP 121 over 78. "
        "40 minutes on ARED, skipped the bike. Mood meh, pretty wiped out.")
    assert x["sleep"] == 5.5 and x["hr"] == 68 and (x["sbp"], x["dbp"]) == (121, 78)
    assert x["resistance"] == 40 and x["aerobic"] == 0 and x["mood"] == 3 and x["fatigue"] == 5
    assert x["symptoms"] == ["headache"]


def test_extractor_units_and_negation(bundle):
    x = CheckinExtractor(bundle.lexicon).extract("No headache today. Temp 99.5 F, sore throat. Weighed 162 lbs. Drank 2.5 litres.")
    assert x["temp"] == 37.5 and x["weight"] == 73.5 and x["fluid"] == 2.5
    assert "headache" not in x["symptoms"] and "sore_throat" in x["symptoms"]


def test_anomaly_detector_flags_fever_day(demo):
    settings, entries = demo
    fever = EvaluationContext(entries[: 13 + 46 + 1], settings)
    normal = EvaluationContext(entries[: 13 + 30 + 1], settings)
    d = AnomalyDetector(2.5)
    assert d.is_anomalous(d.score(fever, fever.latest))
    assert not d.is_anomalous(d.score(normal, normal.latest))


def test_forecaster_projects_late_mission_decline(demo):
    settings, entries = demo
    f = TrendForecaster().forecasts(EvaluationContext(entries, settings))
    assert {x.metric for x in f} & {"sleep", "pvt", "mood"}


async def test_assistant_end_to_end(bundle, demo):
    settings, entries = demo
    a = OnboardHealthAssistant(bundle)
    b = await a.briefing(entries, settings)
    assert b.headline.startswith("Alertness markedly reduced") and b.forecasts
    r = await a.chat(entries, settings, [{"role": "user", "content": "I have chest pain"}])
    assert "emergency" in r.reply.lower() and r.sources == ["safety override"]
    r = await a.chat(entries, settings, [{"role": "user", "content": "Have my headaches followed a pattern?"},
                                         {"role": "assistant", "content": "..."},
                                         {"role": "user", "content": "and what should I do?"}])
    assert r.reply
    d = await a.parse_checkin("HR 900, slept 7 hours")
    assert d.hr is None and d.sleep == 7 and any("implausible" in u for u in d.unclear)


def test_extractor_nutrition(bundle):
    x = CheckinExtractor(bundle.lexicon).extract("Blood sugar 96 this morning. Ate about 2,300 calories and 95 g protein.")
    assert x["glucose"] == 96 and x["calories"] == 2300 and x["protein"] == 95
