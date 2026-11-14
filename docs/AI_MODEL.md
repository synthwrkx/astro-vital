# Onboard AI model

AstroVital's AI features run on the **AstroVital Onboard Health Model v1**, a model bundle stored on
the spacecraft and executed locally on the CPU. It needs **no network, cloud service or API key**,
because a long-duration crew can't rely on an Earth link. The model card is
[`backend/models/astrovital-onboard-v1/MODEL_CARD.md`](../backend/models/astrovital-onboard-v1/MODEL_CARD.md).

## Features

| Feature | Endpoint | UI | Built from |
|---|---|---|---|
| Daily briefing | `POST /api/ai/briefing` | Dashboard → ✦ AI daily briefing | `BriefingWriter` over `Insights` |
| Health copilot chat | `POST /api/ai/chat` | AI Copilot tab (chat + "Try asking" card) | `CopilotResponder` (intent classifier + handlers) |
| Describe-your-day check-in | `POST /api/ai/parse-checkin` | Check-in → ✦ Describe your day (with browser dictation) | `CheckinExtractor` |
| Flight-surgeon report | `POST /api/ai/surgeon-report` | Dashboard → ✦ Surgeon report | `SurgeonReportWriter` |
| Anomaly detection & forecasts | inside the briefing, copilot and report | Briefing "Anomaly model" and "Forecast" | `AnomalyDetector`, `TrendForecaster` |

## Code map (`backend/app/ai/`)

```
base.py            HealthAssistant port (Protocol) + output schemas (Briefing, CheckinDraft, ChatReply) + errors
__init__.py        get_assistant() factory: loads the bundle, or returns the Null Object
disabled.py        DisabledHealthAssistant (Null Object)
onboard/
  __init__.py      OnboardHealthAssistant: adapter that composes the components below
  bundle.py        ModelBundle.load(): reads manifest.json, intents.json, lexicon.json
  text.py          tokenizer shared by training and inference (stemming, stop words, bigrams)
  nlu.py           IntentClassifier (naive Bayes) and CheckinExtractor (lexicon + grammar)
  analytics.py     AnomalyDetector, TrendForecaster, correlation()
  insights.py      InsightEngine: one analysis pass shared by every generator
  nlg.py           BriefingWriter, SurgeonReportWriter, shared phrasing helpers
  copilot.py       CopilotResponder: safety override, intent routing, per-intent handlers
```

## How each component works

### Intent classifier

Multinomial naive Bayes over stemmed unigrams and bigrams with Laplace smoothing (α = 0.5). The 14 intents
are `status`, `why_status`, `plan`, `trends`, `help`, `sleep`, `exercise`, `cardio`, `immune`, `mood`,
`alertness`, `radiation`, `environment` and `weight`. Confidence is the posterior of the top intent, or 0
if no token is in the vocabulary.

Routing order:

1. **Emergency regex**, which always wins (chest pain, can't breathe, fainted and similar) and returns checklist guidance.
2. The classifier, if confidence is ≥ 0.30.
3. Keyword fallback (`KEYWORDS` in `copilot.py`).
4. The previous user turn's intent, for follow-ups.
5. The help message.

### Check-in extractor

Regex grammar for vitals ("HR 68", "BP 121 over 78", "sats 97%", "temp 99.5 F", "weighed 162 lbs"),
nutrition ("blood sugar 96", "2,300 calories", "95 g protein"),
sleep ("slept five and a half hours"), exercise minutes mapped via the lexicon ("40 min on ARED" →
resistance; "skipped the bike" → aerobic 0), fluid (L/ml), and dose (mSv). Mood, stress and fatigue
come from descriptive words ("meh" → 3, "wiped out" → fatigue 5). Symptoms come from synonym lists
with a negation window ("no headache" isn't recorded). Out-of-range values are dropped, and sentences
that produced nothing are returned as `unclear` for review.

### Anomaly detector

For each core signal (HR, SBP, SpO₂, temp, sleep, mood, stress, fatigue, PVT, fasting glucose), take the z-score vs.
personal baseline, counting only deviation in the **harmful direction**. The score is
RMS(z) × √(n/4), so four signals all at 1σ score about 1. Days scoring ≥ 2.5 are anomalous.

Body mass is excluded: it drifts slowly by design and is handled by `BodyMassRule` and the forecaster.

### Trend forecaster

A least-squares trend over the last 21 days. It only applies when there are at least 10 points and r² ≥ 0.2.
It projects to the next rule threshold in the direction of travel (body mass −5% then −8%, sleep 6.5 h
then 5.5 h, mood 2.0, PVT +2σ then +3σ) and reports crossings within 45 days.

### Correlations

Pearson r over the last 30 days for sleep↔PVT, sleep↔mood, stress↔sleep and resistance↔mood. A pair
is stated only if |r| ≥ 0.4 with n ≥ 10, and the wording is always "has gone with", never causal.

## Mission-profile awareness

The surgeon report states the environment, Earth-link delay and gravity, and compares the measured dose rate with the
profile's published reference. The copilot's radiation answers do the same comparison (for example vs. MSL RAD's
1.84 mSv/day on Mars transit).

## Safety design

- The **rule engine is authoritative.** The model reads findings but can't change levels.
- The **emergency override** runs before any classification.
- **No silent writes.** Extracted check-ins only pre-fill the form.
- **Grounded output.** Every number in a response comes from the astronaut's records, and copilot
  answers list their `sources`.
- **Graceful degradation.** If the bundle is missing or `ASTROVITAL_AI=off`, the Null Object returns
  HTTP 503 with a reason, the UI shows a note, and all rule-engine monitoring keeps working.

## Retraining the intent classifier

```bash
cd backend
# 1. add {"text": "...", "intent": "..."} lines to training/intents.jsonl
.venv/bin/python training/train_intents.py      # rewrites models/astrovital-onboard-v1/intents.json
.venv/bin/pytest -q tests/test_onboard_model.py
```

Training is deterministic. The script prints training-set accuracy; add a held-out set before quoting accuracy.

## Extending or replacing the model

- **New copilot topic:** add a `Topic` to `TOPICS` in `copilot.py` (domain, metrics, symptoms, keywords),
  add training phrases with that intent name, and retrain.
- **New vocabulary:** edit `lexicon.json` (symptom synonyms, mood/stress/fatigue words, exercise words). No retraining is needed.
- **Different model** (for example a larger on-device language model): write a class implementing the
  `HealthAssistant` protocol in `ai/base.py` and return it from `get_assistant()`. Services, routes and UI stay
  unchanged. Use `InsightEngine` to keep its output grounded in the same analysis.
- **Different weights:** point `ASTROVITAL_MODEL_DIR` at another bundle directory with the same file layout.
