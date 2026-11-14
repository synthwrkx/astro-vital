# Development guide

How to make common changes safely, written for anyone, human or AI assistant, picking this project
up later. Read [ARCHITECTURE.md](../ARCHITECTURE.md) first for the big picture.

## Ground rules

1. **The rule engine owns status levels.** Never let AI code set or lower a level.
2. **Keep `core/` framework-free.** No FastAPI, SQLModel or AI imports in `backend/app/core/`.
3. **Dependencies point inward:** `api → services → core / ai / persistence`.
4. **The backend is the source of truth.** The UI renders `/api/status` and `/api/catalog`; don't duplicate
   thresholds or labels in TypeScript.
5. **Offline only.** Don't add runtime network calls (CDNs, cloud APIs). The app must work with no Earth link.
6. **Tests must pass:** `cd backend && .venv/bin/pytest -q` and `cd frontend && npx tsc -b && npx eslint src && npm run build`.

## Recipes

### Add a health rule

1. Create a `HealthRule` subclass in the matching `backend/app/core/rules/<domain>.py`. Set `domain` and
   implement `evaluate(ctx) -> list[Finding]`, building findings with `self.finding(level, title, detail, actions, escalate)`.
   Use `ctx.latest`, `ctx.avg7()`, `ctx.avg3()`, `ctx.z()`, `ctx.base()`, `ctx.symptom_days()` and
   `ctx.in_flight`, rather than recomputing.
   For a countermeasure rule, subclass `InFlightRule` and implement `check()`.
2. Register it in `default_rules()` in `rules/__init__.py`. Order only matters for rules that read
   earlier findings, and `SymptomCatchAllRule` must stay last.
3. Add a test in `tests/test_engine.py` and a row in `docs/HEALTH_RULES.md`.
4. If its title can appear in copilot topic answers, check the `keywords` on the matching `Topic` in `ai/onboard/copilot.py`.

### Add a metric

1. Add it to `METRICS` in `core/catalog.py` (label, short, unit, min, max, step, min_sd, dec).
2. Add a nullable column to `Entry` in `persistence/db.py` and a field to `EntryIn` in `schemas.py`.
   SQLite has no migrations here, so delete `backend/astrovital.db` in development or write an `ALTER TABLE`.
3. Add it to `METRIC_KEYS` in `frontend/src/types.ts`, and to a field group in `pages/Checkin.tsx`.
4. Optionally add extraction patterns in `ai/onboard/nlu.py` and a field in `CheckinDraft` (`ai/base.py`).

### Add a mission profile

Add an entry to `PROFILES` in `backend/app/core/profiles.py` (name, kind, `dose_msv_day` and its source, delay, gravity,
support note). Cite a published measurement for the dose. The Settings picker, the Dashboard chips, the radiation card,
the profile-background rule and the AI texts all pick it up automatically.

### Add a symptom

Add `{id, label, domain, level}` to `SYMPTOMS` in `core/catalog.py`. The form, validation and catch-all
rule pick it up automatically. Add synonyms under `symptoms` in `backend/models/astrovital-onboard-v1/lexicon.json`
so dictation recognises it.

### Teach the copilot a new question type

- For a topic answer (findings + metrics + symptoms): add a `Topic` to `TOPICS` in `copilot.py`.
- For custom logic: add a method and register it in `self.handlers`.
- Then add training phrases with the intent name to `backend/training/intents.jsonl`, run
  `.venv/bin/python training/train_intents.py`, and add a parametrized case to `tests/test_onboard_model.py`.

### Swap or upgrade the AI model

Implement the `HealthAssistant` protocol (`ai/base.py`) and return it from `get_assistant()` in
`ai/__init__.py`. Nothing else changes. Keep output grounded by building on `InsightEngine`. See [AI_MODEL.md](AI_MODEL.md).

### Add an API endpoint

Put the business logic in a service method (`services/health.py`). Add a thin route in the matching
`api/routes/*.py` that validates input with a schema in `schemas.py`, calls the service and maps
exceptions to HTTP codes. Wire any new dependency in `api/deps.py`. Add a test in `tests/test_api.py`
using the `client` fixture, which gives each test its own temporary database.

### Add a routine task or badge

Routine tasks live in `TASKS` in `backend/app/core/routine.py`. Each has an `id`, `title`, `when`, `how`, `metrics`, and a
`check(entry, settings)` function that decides completion from check-in data (no manual ticking). Badges are built in
`build_routine` with `badge(id, title, desc, progress, goal)`. Reward consistency, never "good" values, so crews have no
reason to hide symptoms.

### Add a body-map region

Add an entry to `REGIONS` in `frontend/src/components/dashboard/BodyMapCard.tsx` (name, what it does, how space affects it,
hazard, metrics, and a `match(finding)` predicate), then draw its SVG shape with `{...part('id')}`.

### Edit educational content

The five hazards, measurement guides and source links are in `backend/app/core/knowledge.py`. Keep every fact traceable to a
URL in `SOURCES`; the Learn page renders them automatically. A test requires a guide for every metric.

### Add a dashboard card

1. Create `frontend/src/components/dashboard/MyCard.tsx`. It renders a `<section className="card">` and reads data from `useStore()`.
2. Place it in the `.dash-grid` in `pages/Dashboard.tsx`; use `span-2` or `row-span-2` to size it.
3. Follow STYLES.md: black for actions, yellow for "current", status colors only for status, and a text label with every color.

### Add a page

1. Create `frontend/src/pages/MyPage.tsx` with a default export.
2. Add a lazy import and a `<Route>` in `App.tsx`, and an entry in `NAV` if it belongs in the top bar (the bar holds 7 items).
3. Read state with `useStore()` and call `api.*` for mutations, then `refresh()`.
4. Style it with existing classes or new tokens (see [STYLES.md](../STYLES.md)).

## Testing notes

- `tests/test_engine.py` uses the deterministic demo (`generate_demo`, seed 42) ending on a fixed date.
  The demo is a **Mars-transit** mission (dose ≈ 1.84 mSv/day, SPE on day 72). It ends with one **Act now** (alertness)
  plus several **Monitor** findings. If you change the demo generator, update these expectations deliberately.
- Timeline tests assert the story beats (fever on day 45, SPE on day 72). A migration test checks that an old database gains new columns.
- The demo's nutrition fields use a separate random generator (`nrng`) so adding fields doesn't change the original story.
- Routine, glucose, intake, photo and knowledge tests cover the newer features (44 backend tests in total).
- `tests/test_api.py` overrides `get_session` with a temp SQLite file, and `get_assistant` to test the Null Object.
- `tests/test_onboard_model.py` covers the bundle, intents, extractor, anomaly detector, forecaster and copilot safety override.
- The frontend has no unit tests yet. Type-check, lint and build are the gate. The smallest next step
  would be Vitest tests for `hooks/usePvt.ts` `score()` and `lib/format.ts`.

## Known limitations and next steps

- Single astronaut per database. Crew support would need a `crew_id` on `Entry` and `MissionSettings`.
- No auth, because this is a single-user onboard device. Add it before any multi-user or networked deployment.
- No database migrations; consider Alembic once the schema stabilises.
- Intent-classifier accuracy is measured on training data only; collect real phrasing for a held-out set.
- Wearable or sensor ingestion (BLE heart rate, actigraphy) would be a new service writing entries through `HealthService`.
- The UI is light theme only, to match the design references. A dark variant would be a second set of token values
  under `prefers-color-scheme: dark` in `index.css`.
- UI checks so far were manual screenshots with a headless browser. Playwright end-to-end tests would be a good addition.
- `prototype/` is the original single-file version and isn't used by the app.
