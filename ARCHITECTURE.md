# Architecture

AstroVital is a two-tier web app that runs entirely on the spacecraft: a **FastAPI** backend (with an
embedded SQLite database and an offline AI model) and a **React** single-page UI. In production the
backend also serves the built UI, so one process runs the whole app.

```
┌──────────────────────────── Spacecraft computer (offline) ─────────────────────────────┐
│                                                                                         │
│  React UI (frontend/)            FastAPI (backend/app)                                  │
│  ┌──────────────┐   /api/*      ┌──────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │ pages/       │ ───────────▶  │ api/     │──▶│ services/    │──▶│ persistence/     │  │
│  │ store.tsx    │   JSON        │ routes   │   │ HealthService│   │ repositories ─▶  │──▶ SQLite
│  │ api.ts       │ ◀───────────  │ deps.py  │   │ DataService  │   └──────────────────┘  │
│  └──────────────┘               └──────────┘   │ AIService    │                         │
│                                                └──────┬───────┘                         │
│                                       ┌───────────────┴────────────────┐                │
│                                       ▼                                ▼                │
│                              core/ (rule engine)              ai/ (HealthAssistant port)│
│                              HealthEvaluator                  OnboardHealthAssistant    │
│                              └─ HealthRule × 19               ├─ nlu (intents, extract) │
│                                                               ├─ analytics (anomaly,    │
│                                                               │   forecast, correlation)│
│                                                               ├─ insights (shared pass) │
│                                                               └─ nlg / copilot          │
│                                                               loads models/…-v1 bundle  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Backend layers (`backend/app/`)

Dependencies point inward only: `api → services → core / ai / persistence`. Nothing in `core` imports
FastAPI, SQLModel or the AI package.

| Layer | Path | Responsibility | Depends on |
|---|---|---|---|
| **Domain core** | `core/` | Catalog (metrics, symptoms, domains), mission profiles (`profiles.py`), baseline maths, health rules (each with `evidence`), evaluator, mission timeline replay (`timeline.py`), daily routine and gamification (`routine.py`), educational content with sources (`knowledge.py`: five hazards, measurement guides, NASA/CSA links), plain-text report, demo generator | stdlib only |
| **AI** | `ai/` | `HealthAssistant` port, onboard model adapter, Null Object | `core` |
| **Persistence** | `persistence/` | SQLModel tables (Entry, MissionSettings, Photo), engine/session, repositories | SQLModel |
| **Services** | `services/health.py` | Use-case workflows (save check-in, import, AI guards) | repository *protocols*, evaluator, AI port |
| **API** | `api/` | HTTP routes, validation (`schemas.py`), error→status mapping, DI wiring | services |
| **App factory** | `main.py` | `create_app()`: CORS, routers, static UI | api |

### Request flow: saving a check-in

1. `PUT /api/entries/{date}` → `api/routes/entries.py` validates the body with `schemas.EntryIn`
   (physiological ranges, known symptom ids).
2. `deps.get_health_service` builds a `HealthService` with `SqlEntryRepository`, `SqlSettingsRepository`
   and the shared `HealthEvaluator`.
3. `HealthService.save_entry` applies the first-check-in policy (sets launch day if none exists), upserts
   the entry, and returns `evaluate()`.
4. `HealthEvaluator` builds an `EvaluationContext` and runs each `HealthRule`, then rolls findings up
   into domain and overall levels, the radiation summary and the drift scan.
5. The UI calls `refresh()` in `store.tsx` and every page re-renders from the new server state.

### Request flow: mission story

`GET /api/timeline` → `HealthService.timeline` → `core/timeline.build_timeline` re-runs the evaluator on each day's
*prefix* of data, so there's no hindsight. It records a daily status ribbon and finding *episodes*: onset, peak level, and
resolution after a 3-day gap, so flicker doesn't count. The Story page groups the episodes into mission phases.

### Request flow: copilot question

`POST /api/ai/chat` → `AIService.chat` (rejects the request if there's no data) →
`HealthAssistant.chat` → `OnboardHealthAssistant`:

1. The `InsightEngine` runs one analysis pass: evaluation, anomaly scores, forecasts and correlations.
2. The `CopilotResponder` runs the emergency regex override, then the naive-Bayes intent classifier, then keyword fallback, then the previous turn's intent.
3. The handler for that intent writes a Markdown answer and the list of `sources` it used.

Inference runs in `asyncio.to_thread` so it doesn't block the event loop.

## Design patterns used

| Pattern | Where | Why |
|---|---|---|
| **Strategy** | `core/rules/*.py`: each `HealthRule` subclass | Each health check is an interchangeable algorithm with one interface |
| **Registry** | `core/rules/__init__.py` `default_rules()` | One place lists the active rules and their order |
| **Template Method** | `core/rules/bone.py` `InFlightRule.evaluate → check` | Shared "only after launch" guard for countermeasure rules |
| **Facade** | `core/__init__.py` (`evaluate`, `build_report`); `ai/onboard/__init__.py` | One simple entry point over many collaborators |
| **Repository** | `persistence/repositories.py` | Services never touch SQL; storage can be swapped |
| **Port / Adapter (Hexagonal)** | `ai/base.py` `HealthAssistant` + `ai/onboard` adapter | AI engine is replaceable without touching services, routes or UI |
| **Null Object** | `ai/disabled.py` | App works uniformly when the model bundle is missing |
| **Factory** | `ai/__init__.py` `get_assistant()`; `main.py` `create_app()` | Centralised construction from configuration |
| **Dependency Injection** | `api/deps.py` via FastAPI `Depends` | Wiring in one place; tests override any piece |
| **Command / dispatch table** | `ai/onboard/copilot.py` `handlers` | One handler per intent; add one without editing the others |
| **Context object** | `core/context.py` `EvaluationContext` | Rules share windows, baselines and z-scores computed once |
| **Value Object** | `core/models.py` `Finding` (frozen) | Immutable results |
| **Provider (React Context)** | `frontend/src/store.tsx` | One source of truth for server state across pages |
| **Custom hook / state machine** | `frontend/src/hooks/usePvt.ts` | PVT timing logic separated from rendering |

## SOLID mapping

- **S: Single responsibility.** Rules check one thing. Repositories persist. Services orchestrate. Routes
  translate HTTP. Writers format. On the frontend, `api.ts` handles transport, `store.tsx` holds state,
  `lib/` has pure helpers, `hooks/` holds behaviour, and `pages/` renders views.
- **O: Open/closed.** Add a `HealthRule` to the registry, an intent handler to the copilot, or a metric to
  the catalog. The evaluator, responder and API don't change.
- **L: Liskov substitution.** `OnboardHealthAssistant` and `DisabledHealthAssistant` are interchangeable
  wherever a `HealthAssistant` is expected (`test_ai_disabled_null_object`), and so is any
  `EntryRepository` implementation.
- **I: Interface segregation.** `EntryRepository` and `SettingsRepository` are separate small protocols.
  `HealthRule` has a single method.
- **D: Dependency inversion.** Services depend on repository protocols and the `HealthAssistant` port.
  `HealthEvaluator` receives its rules. Concrete classes are bound only in `api/deps.py` and `ai/__init__.py`.

## Frontend (`frontend/src/`)

| File / folder | Role |
|---|---|
| `main.tsx` | Mounts `BrowserRouter` and `StoreProvider` |
| `App.tsx` | Shell frame, top bar (pill nav, Settings, alerts and profile menus), lazy-loaded routes (code-split per page) |
| `api.ts` | Typed fetch client; turns server errors into readable messages |
| `types.ts` | TypeScript mirrors of the API shapes |
| `store.tsx` | Context provider: catalog, settings, entries, evaluation, AI status, toast, `refresh()` |
| `lib/format.ts`, `lib/download.ts` | Pure helpers |
| `hooks/usePvt.ts` | Alertness-test state machine |
| `components/ui.tsx` | Shared presentational components (Pill, Modal, Sparkline, Markdown, Spinner, AiOffNote) |
| `components/icons.tsx` | Inline SVG icon set and the `DOMAIN_ICON` map (offline; no icon font) |
| `components/HeaderMenus.tsx` | Top-bar popovers: **AlertsMenu** (bell: active findings and routine tasks due today) and **ProfileMenu** (avatar: crew profile, data and export). Each has one job; Settings is a separate page |
| `components/PhotoCapture.tsx` | Camera input on the check-in: capture, downscale on-device (≤1280 px JPEG), upload, thumbnails |
| `hooks/useRoutine.ts` | Loads `/api/routine` and refreshes it whenever check-ins change |
| `components/dashboard/*.tsx` | One component per dashboard card: StatusCard, SleepCard, RadiationCard, DomainsCard (+ Action plan), ReadingsCard, WeekCard, AiBriefingCard, plus ReportModal and DomainModal (with FindingCard) |
| `pages/*.tsx` | One file per route. In the nav: Dashboard (composes the cards, including **BodyMapCard** and **RoutineCard**), Checkin, Routine, Trends, Story, Learn, Copilot. Reached from other pages: Alertness (from Routine and Check-in), Data (from Settings and the profile menu), Settings (top-bar pill) |
| `index.css` | Design tokens and all styles (see STYLES.md) |

The UI holds **no business logic**. Status levels, findings and baselines all come from `/api/status`,
so the backend is the single source of truth. The catalog (`/api/catalog`) drives form fields and labels.

## Data model

- `MissionSettings`: a single row (id = 1) with crew name, launch date, mission length, radiation history
  and limit, countermeasure targets, and `mission_profile` (a key into `core/profiles.py`).
- `Photo`: images attached to a check-in date (`tag` = symptom id or `other`, `note`, `mime`, binary `data`).
  Photos are not included in JSON export, and they're cleared when data is replaced (demo/import) or reset.
- `Entry`: one row per date (`YYYY-MM-DD` primary key). There are 19 nullable numeric metrics, `symptoms`
  stored as a JSON list of ids, and optional `notes`.
- Mission day is derived, never stored: launch day = 1, preflight days ≤ 0. Preflight entries form the baseline.
- **Startup:** the app `lifespan` creates the engine, tables and the single settings row once, before serving.
  `get_engine()` is lock-guarded, and the settings repository tolerates a concurrent insert. This avoids races when
  the UI fires several requests at once on a fresh database.
- **Schema evolution:** `make_engine` runs a small forward-only migration (`_add_missing_columns`) that adds any new
  model column to an existing SQLite table with its default. That's how older databases gained `mission_profile`.
  Use Alembic once the schema grows.

## Configuration (environment variables)

| Variable | Default | Effect |
|---|---|---|
| `ASTROVITAL_DB` | `sqlite:///./astrovital.db` | Database URL |
| `ASTROVITAL_MODEL_DIR` | `backend/models/astrovital-onboard-v1` | Onboard model bundle to load |
| `ASTROVITAL_AI` | `on` | `off` forces the Null Object, so the app runs without AI |
| `ASTROVITAL_CORS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed dev origins |

## Key decisions

- **The rule engine is authoritative; AI is advisory.** Deterministic, explainable rules set every status.
  The AI explains, connects, forecasts and converses, and it can never downgrade a finding.
- **Offline first.** No runtime network dependency anywhere. The AI is a local model bundle loaded from disk.
- **Personal baselines.** Microgravity shifts "normal", so population thresholds alone would miss early drift.
- **Human in the loop.** AI-extracted check-in values only pre-fill the form; the astronaut confirms before saving.
