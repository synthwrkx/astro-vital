# AstroVital: crew health self-monitoring for long-duration spaceflight

> NASA Space Apps Challenge entry. Prototype decision-support software, **not a medical device**.

On a Mars-class mission, messages to Earth can take 20+ minutes each way, and sometimes there's no
link at all. Astronauts have to **spot and act on their own health changes**. AstroVital gathers daily
health indicators, learns each astronaut's personal normal, flags drift across the risks named in the
challenge, and tells the crew member what to do. Everything runs **onboard and offline**, including the AI.

## What it does

| Capability | How |
|---|---|
| **2-minute daily check-in** | Vitals, countermeasures (exercise, fluid, sleep), mood/stress/fatigue, radiation dose, blood glucose, energy and protein intake, 20 space-relevant symptoms |
| **Describe your day** | Type or dictate in plain words; the onboard model fills the form for you to review |
| **Personal baseline** | Preflight mean ± SD per metric, so the comparison is *you vs. you*, not population averages |
| **Six risk domains** | Cardiovascular · Bone & Muscle · Immune · Behavioral & Cognition · Radiation · Environment & Vision |
| **Traffic-light status + action plan** | Nominal / Monitor / Act now; each finding carries concrete onboard actions and a "notify surgeon" flag |
| **Alertness test (PVT)** | Built-in psychomotor vigilance test, the standard objective fatigue measure in spaceflight |
| **Trends & drift scan** | Baseline ±2σ bands, 14-day slope, every metric ranked by deviation |
| **Radiation budget** | Mission/career dose vs. the 600 mSv limit, end-of-mission projection, solar-particle-event spike detection |
| **Onboard AI** | Daily briefing, multivariate anomaly detection, threshold forecasts, health copilot chat, flight-surgeon report |
| **Mission profiles** | ISS, lunar surface, pressurized lunar rover, Mars transit and surface, plus Earth analogs. Expected dose, Earth-link delay and gravity come from published instrument data (Curiosity RAD, Chang'e‑4 LND) |
| **Scientific basis on every finding** | Each rule shows the NASA HRP risk it addresses and the reference behind its threshold |
| **Mission story** | The whole mission replayed day by day with no hindsight, told as chapters with a status ribbon |
| **Blood sugar & nutrition** | Fasting glucose (mg/dL) with hypo- and hyperglycaemia rules, plus energy and protein intake vs. targets (*Nutrition & Metabolism* domain) |
| **Clickable body map** | An animated human figure. Brain, eyes, lungs, heart, digestion, kidneys, bones and muscles, the immune system and a radiation aura are colored by status; click one for its function, findings, readings and how to measure |
| **Daily routine & gamification** | 10 routine tasks that tick off automatically from check-ins, due-task prompts in the bell menu, streaks, a daily score, XP levels and badges |
| **Learn** | NASA's five hazards of human spaceflight (RIDGE), a how-to-measure guide for every indicator (also an ⓘ on each check-in field), and links to the NASA/CSA sources |
| **Camera photos** | Attach photos of a rash, cold sore or wound to a check-in; downscaled on-device, stored onboard, listed in the downlink report |
| **Downlink reports** | A compact plain-text report and a clinical Markdown report for low-bandwidth comms |
| **Data portability** | JSON import/export and CSV export; data stays in the onboard database |

## Quick start

Requirements: Python ≥ 3.10 and Node ≥ 18.

```bash
./start.sh                      # builds the UI and serves everything on http://127.0.0.1:8000
```

Then open http://127.0.0.1:8000 and click **Load demo mission**. You get a Mars-transit mission with 14 preflight days
and 124 flight days, including a fever episode, a solar particle event and a late-mission decline.

### Development (hot reload)

```bash
# terminal 1: API on :8000 (interactive docs at /docs)
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt pytest pytest-asyncio httpx
.venv/bin/uvicorn app.main:app --reload

# terminal 2: UI on :5173 (proxies /api to :8000)
cd frontend && npm install && npm run dev
```

### Tests

```bash
cd backend && .venv/bin/pytest -q          # rule engine, API, onboard model
cd frontend && npx tsc -b && npx eslint src # type check + lint
```

## Repository layout

```
backend/            FastAPI + SQLModel API, rule engine, onboard AI model
  app/core/         framework-free domain: catalog, rules (Strategy), evaluator, reports
  app/ai/           AI port + onboard model adapter (NLU, analytics, NLG, copilot)
  app/persistence/  SQLModel tables + repositories
  app/services/     business workflows
  app/api/          HTTP routes + dependency injection
  models/           the onboard model bundle (manifest, weights, model card)
  training/         training data + script for the model's intent classifier
frontend/           React + TypeScript + Vite UI (Recharts charts)
docs/               detailed documentation (see below)
prototype/          original single-file HTML version, kept for reference only
```

## Documentation

| Doc | Read it for |
|---|---|
| [docs/CHALLENGE_COVERAGE.md](docs/CHALLENGE_COVERAGE.md) | Every item in the challenge brief, and every required NASA/CSA resource, mapped to where it is in the app |
| [MISSION_CONCEPT.md](MISSION_CONCEPT.md) | Concept of operations, onboard system, Earth applications, roadmap to flight |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, layers, design patterns, SOLID mapping, request flow |
| [STYLES.md](STYLES.md) | UI design system: color tokens, status colors, components, chart rules |
| [docs/HEALTH_RULES.md](docs/HEALTH_RULES.md) | Every health rule, its threshold, and the science behind it |
| [docs/AI_MODEL.md](docs/AI_MODEL.md) | How the onboard model works, its safety behaviour, and how to retrain or swap it |
| [docs/API.md](docs/API.md) | REST endpoints with request and response shapes |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | How to make common changes safely (add a rule, metric, symptom, intent, page) |
| [backend/models/astrovital-onboard-v1/MODEL_CARD.md](backend/models/astrovital-onboard-v1/MODEL_CARD.md) | Model card |

## AI use (SI disclosure)

In line with the Space Apps rules on AI ("SI") usage:

| What | How AI was used |
|---|---|
| **Code** (backend, frontend, tests, training script) | Written with the help of **an AI coding assistant**, directed, reviewed and tested by the team |
| **Documentation** (this README and all `*.md` files) | Drafted with an AI coding assistant, reviewed by the team |
| **Demo video** (`demo/AstroVital-30s.mp4`) | Screen recording of the real app, captured automatically with Playwright. **Voiceover is synthetic** (macOS text-to-speech, voice "Samantha"). It carries a visible *"AI-assisted (SI) · synthetic voice"* watermark, and the disclosure is in its metadata |
| **Slide deck** (`demo/AstroVital.pptx`) | Generated with an AI coding assistant (pptxgenjs). Screenshots carry an *"AI-assisted (SI)"* watermark; disclosure on slide 7 and in the file properties |
| **Demo data** | **Simulated** by our own generator (`backend/app/core/demo.py`), not real astronaut data |
| **The app's onboard AI** | Not generative AI: small, explainable models (naive Bayes intent classifier, lexicon NLU, statistical anomaly and trend models) trained on our own labelled phrases. They run offline |

Science content is paraphrased from the NASA and CSA resources listed below, with links. No NASA logos or design elements are used.

## Sources

Content is grounded in the challenge's required resources:
[NASA 5 Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/) ·
[NASA Human System Risks](https://www.nasa.gov/hhp/human-system-risks/) ·
[NASA Ongoing HRP Research in Space](https://www.nasa.gov/hrp/ongoing-hrp-research/) ·
[CSA Monitoring Radiation for Astronaut Health](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp) ·
[CSA Why Do We Conduct Science Experiments in Space?](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp)

## Tech stack

- **Backend:** Python, FastAPI, SQLModel (SQLAlchemy + Pydantic), SQLite, pytest
- **Frontend:** React 19, TypeScript, Vite, React Router, Recharts, react-markdown
- **AI:** AstroVital Onboard Health Model v1. Pure Python, CPU-only, no network calls.
