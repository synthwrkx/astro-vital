# Model card: AstroVital Onboard Health Model v1

| | |
|---|---|
| **ID** | `astrovital-onboard-v1` (see `manifest.json`) |
| **Runs on** | Spacecraft computer, CPU only, fully offline. Pure Python, no network or GPU. |
| **Loaded by** | `app/ai/onboard/bundle.py` → `OnboardHealthAssistant` |
| **Intended users** | Astronauts doing health self-assessment on long-duration missions |
| **Not intended for** | Diagnosis, treatment decisions, or replacing the flight surgeon |

## Components

| Component | File | Method | Purpose |
|---|---|---|---|
| Intent classifier | `intents.json` | Multinomial naive Bayes over unigrams and bigrams, Laplace smoothing (α = 0.5) | Routes copilot questions to one of 14 intents |
| Check-in extractor | `lexicon.json` | Lexicon plus a regex pattern grammar, unit conversion (°F→°C, lb→kg, ml→L), negation scope | Turns free text or dictation into check-in fields (including glucose, kcal and protein) |
| Anomaly detector | in code, calibrated at runtime | Multivariate z-score (diagonal Mahalanobis), counting deviation only in the harmful direction | Flags days where many signals are off together |
| Trend forecaster | in code | Least-squares trend over 21 days with an r² ≥ 0.2 gate, projected to rule thresholds | Predicts days until a threshold is crossed |
| Generators | in code | Template-based NLG over a shared `Insights` object | Briefing, copilot answers, surgeon report |

The anomaly detector and forecaster are **personalised**: they calibrate on each astronaut's own
preflight baseline, so no population data leaves or enters the spacecraft.

## Training

- Intent data: `training/intents.jsonl` (178 labelled phrases, 14 intents, including blood-sugar and nutrition questions).
- Retrain: `.venv/bin/python training/train_intents.py` (deterministic, so the same data gives the same weights).
- Training-set accuracy is printed by the script (~99%). There is no held-out set yet. Before
  relying on accuracy figures, collect real crew phrasing and evaluate on it.

## Safety behaviour

- A **safety override** (regex for chest pain, breathing difficulty, fainting and similar) runs *before* the
  classifier and always returns emergency-checklist guidance.
- The deterministic rule engine owns all status levels. The model only explains and prioritises; it never
  downgrades a finding.
- Extracted values outside physiological ranges are dropped and listed as "unclear". Nothing is saved
  until the astronaut reviews the form.
- Low-confidence questions fall back to keyword routing, then to a help message, rather than guessing.

## Limitations

- English only. The lexicon covers common phrasing, but unusual wording may be missed and then appears under "unclear".
- Correlations (Pearson r over 30 days) are associations, not causes.
- Forecasts assume the current linear trend continues. Treat them as early warnings.

## Swapping in a different model

Implement the `HealthAssistant` protocol (`app/ai/base.py`) and return it from `get_assistant()`
(`app/ai/__init__.py`). Point `ASTROVITAL_MODEL_DIR` at a different bundle directory to load other weights.
