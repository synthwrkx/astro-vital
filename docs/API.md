# REST API

Base path `/api`. Interactive OpenAPI docs are at **http://127.0.0.1:8000/docs** while the backend runs.
Everything is JSON unless noted. Validation errors return `422` with FastAPI's `detail` array.

## Meta & settings

| Method | Path | Description |
|---|---|---|
| GET | `/api/catalog` | `{metrics, symptoms, domains, levels, profiles, guides, hazards, sources}`: definitions that drive the UI. `guides[metric]` = `{device, when, how, why, escalate}`; `hazards[]` = the five RIDGE hazards `{id, letter, name, summary, facts[], monitors, domains[], risks[], sources[]}`; `sources[key]` = `{title, org, url}`. `profiles[key]` = `{name, kind (space or earth_analog), dose_msv_day, dose_note, dose_source, delay, delay_s, gravity_g, support}` |
| GET | `/api/settings` | Mission settings |
| PUT | `/api/settings` | Replace settings. Body: `{crew_name, mission_start (YYYY-MM-DD or null), mission_length, prior_career_dose, career_limit, aerobic_target, resistance_target, fluid_target, mission_profile, calorie_target}`. `mission_profile` must be a key of `catalog.profiles` (`422` otherwise) |

## Check-ins

| Method | Path | Description |
|---|---|---|
| GET | `/api/entries` | All entries, oldest first |
| GET | `/api/entries/{date}` | One entry; `404` if none |
| PUT | `/api/entries/{date}` | Create or replace. Body is an `Entry` and `date` must match the path. **Returns the new evaluation.** The first-ever entry sets `mission_start` if it is unset |
| PATCH | `/api/entries/{date}` | Merge fields into the entry (creates it if missing); the result is re-validated. Used by the alertness test |
| DELETE | `/api/entries/{date}` | `204`; `404` if none |

`Entry`:

```json
{ "date": "2026-11-10", "hr": 64, "sbp": 118, "dbp": 76, "spo2": 98, "temp": 36.7, "weight": 74.2,
  "sleep": 6.5, "aerobic": 45, "resistance": 40, "fluid": 2.4, "mood": 3, "stress": 3, "fatigue": 3,
  "pvt": 290, "lapses": 3, "dose": 1.86, "glucose": 94, "calories": 2350, "protein": 90,
  "symptoms": ["headache"], "notes": "optional" }
```

All metrics are optional. Ranges are enforced from the catalog (for example HR 30–200). `symptoms` must be catalog ids.

## Evaluation

| Method | Path | Description |
|---|---|---|
| GET | `/api/status` | Full rule-engine evaluation (below) |
| GET | `/api/report` | `text/plain` fixed-width downlink report (deterministic, no AI); ends with `PHOTOS ATTACHED: n (…)` when photos exist |
| GET | `/api/routine` | Today's routine `{today, mission_day, tasks[{id, title, when, how, metrics[], link?, done}], done, total, score, streak, best_streak, xp, level, level_progress, badges[{id, title, desc, earned, progress, goal}]}` |
| GET | `/api/timeline` | Mission story: `{ribbon[{date, mission_day, level, findings}], episodes[{key, domain, title, level, peak_level, escalate, start, start_md, end, end_md, days, detail}], events[], summary{days, days_by_level, episodes, act_episodes, resolved, open}, phases[]}` |

`Evaluation`:

```json
{ "overall": "act", "overall_label": "Act now", "mission_day": 124,
  "findings": [{ "domain": "behavior", "level": "act", "title": "Alertness markedly reduced",
                 "detail": "Reaction time 309 ms (3.5 SD slower than baseline), 3 lapses.",
                 "actions": ["..."], "escalate": true,
                 "evidence": "The Psychomotor Vigilance Test (Dinges & Powell, 1985) is ..." }],
  "domains": { "cardio": { "level": "ok", "findings": [] }, "...": {} },
  "latest": { "...Entry" },
  "baseline": { "metrics": { "hr": { "mean": 62.1, "sd": 3.0, "median": 62, "n": 14 } }, "n": 14, "source": "preflight" },
  "radiation": { "mission_dose": 256.1, "career": 351.1, "rate": 2.07, "projected": 467, "pct": 58.5, "limit": 600, "prior": 95, "expected_rate": 1.84 },
  "drift": [{ "key": "weight", "recent": 74.1, "baseline": 78.0, "z": -9.9 }] }
```

## Photos

| Method | Path | Description |
|---|---|---|
| GET | `/api/photos?day=YYYY-MM-DD` | Photo metadata `[{id, date, tag, note, mime, bytes, created}]` (all photos if `day` omitted) |
| POST | `/api/photos` | `{date, tag, note?, data_url}`. `data_url` is a base64 `data:image/jpeg|png|webp;base64,…`, max 3 MB decoded (`422` otherwise). Returns `201` with metadata |
| GET | `/api/photos/{id}` | The raw image bytes with their content type |
| DELETE | `/api/photos/{id}` | `204`; `404` if none |

## Data management

| Method | Path | Description |
|---|---|---|
| GET | `/api/export` | `{settings, entries}` |
| POST | `/api/import` | Body `{settings?, entries[]}` (validated). **Replaces all entries and clears photos.** Returns `{imported}` |
| POST | `/api/demo` | Replace all data with the 138-day Mars-transit demo mission ending today |
| DELETE | `/api/data` | Delete all entries and reset settings (`204`) |

## Onboard AI

All AI endpoints run locally. Errors: `400` no check-ins yet, `503` AI unavailable (bundle missing or
`ASTROVITAL_AI=off`; `detail` says why), `422` invalid input.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/ai/status` | — | `{enabled, model, version, offline: true, reason}` |
| POST | `/api/ai/briefing` | — | `{headline, summary, priorities[{title, why, action, urgency}], going_well[], contact_flight_surgeon, contact_reason, forecasts[], anomaly_note}` |
| POST | `/api/ai/chat` | `{messages: [{role: "user"\|"assistant", content}]}` (1–40 turns; must start and end with `user`) | `{reply (Markdown), sources[]}` |
| POST | `/api/ai/parse-checkin` | `{text}` (2–4000 chars) | Draft entry fields (nullable), `symptoms[]`, `notes`, `unclear[]` |
| POST | `/api/ai/surgeon-report` | — | `{markdown}` |

`urgency` is one of `now`, `today`, `this_week` or `keep_monitoring`.
