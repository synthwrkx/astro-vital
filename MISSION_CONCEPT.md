# Mission concept: AstroVital onboard health self-monitoring

## Need

On long-duration exploration missions, astronauts face space radiation, isolation and confinement,
altered gravity and a hostile closed environment. These bring immune changes, bone loss, cardiovascular
events and behavioral-health risks. Beyond the Moon, **ground support is delayed and sometimes absent**:

| Environment | One-way Earth link | Evacuation |
|---|---|---|
| ISS (LEO) | < 1 s | Hours |
| Lunar surface | ≈ 1.3 s | Days |
| Mars transit / surface | Up to 20 min (NASA), plus about 2 weeks of solar-conjunction blackout | None |

The crew must detect, evaluate and act on health changes themselves. Ground medicine reviews later.

## Concept of operations

```
 Crew member ──(2-min check-in, voice or form; PVT; dosimeter)──▶ AstroVital (onboard computer)
     ▲                                                              │
     │  status, action plan, briefing, copilot answers              │  rule engine + onboard AI
     └──────────────────────────────────────────────────────────────┘
                                                                    │ store-and-forward
                                                                    ▼
                                         Downlink packet (plain-text report + JSON) ──▶ Flight surgeon (Earth)
                                                                    ▲                          │
                                                                    └──── advice / plan changes ┘  (delayed)
```

1. **Daily:** a 2-minute check-in (vitals, countermeasures, wellbeing, symptoms), typed or dictated.
   The PVT runs before safety-critical tasks such as EVA, robotics or docking.
2. **Immediately:** the rule engine evaluates against the personal baseline and shows Nominal / Monitor / Act now
   with concrete onboard actions. Red-flag symptoms always route to the emergency checklist.
3. **Onboard AI** explains the status, detects combined anomalies, forecasts threshold crossings and answers
   questions, all without the link.
4. **Downlink** when bandwidth allows: the compact text report (a few KB) plus the clinical summary for the flight surgeon.
   During conjunction blackouts, packets queue locally.
5. **Ground** reviews and sends advice back; the crew logs outcomes in the next check-in.

## Onboard system

| Element | Concept | Status in prototype |
|---|---|---|
| Compute | Any crew laptop or tablet-class computer (e.g. an ISS SSC laptop) | Runs on a laptop: Python + SQLite, CPU only |
| Storage | Local encrypted database, one per crew member | SQLite (encryption is future work) |
| Inputs | Manual check-in, voice dictation, camera photos, PVT, glucometer, personal dosimeter | Implemented (device values are entered manually) |
| Crew routine | Daily task list prompted by the app (morning vitals, fasting glucose, PVT before EVA, hydration, exercise) | Implemented, with streaks and badges |
| Sensors (future) | Wearable vitals (e.g. CSA Bio-Monitor class shirts), actigraphy for sleep, area radiation monitors, cabin CO₂ | Planned: a sensor service writes entries through the same API |
| AI | Onboard Health Model bundle loaded from disk; swappable for a larger on-device model | Implemented (`backend/models/astrovital-onboard-v1`) |
| Mission profile | Sets expected dose, comm delay and gravity from published measurements | Implemented (6 profiles, including 2 Earth analogs) |

## Design principles

- **Deterministic first, AI second.** Explainable rules own every status level. The AI advises but can't override.
- **Personal baselines.** Microgravity changes "normal", so preflight self-comparison catches drift early.
- **Human in the loop.** The AI pre-fills the check-in form, and the astronaut confirms before anything is saved.
- **Degrade gracefully.** No link, no AI bundle or missing sensors: monitoring continues with whatever data exists.
- **Low crew time.** One check-in a day and an optional 1–3 minute PVT.

## Risks addressed (NASA Human Research Program risk areas)

Space radiation exposure · bone fracture and reduced muscle and aerobic capacity · cardiovascular adaptations ·
altered immune response · adverse cognitive or behavioral conditions · sleep loss and work overload ·
team cooperation · renal stone formation · nutrition · Spaceflight Associated Neuro-ocular Syndrome (SANS) ·
closed-environment hazards (CO₂). The rule for each is described in [docs/HEALTH_RULES.md](docs/HEALTH_RULES.md).

## Earth applications

The same software, set to an Earth-analog profile, serves Antarctic stations, ships, offshore platforms,
mines and remote clinics. These are places where people are isolated from healthcare and connectivity is poor.

## Roadmap to flight

1. Ingest wearable and sensor data automatically (BLE or onboard data bus).
2. Clinical validation of thresholds with flight-surgeon input, and analog campaigns (e.g. HERA, Antarctic winter-over).
3. Encryption at rest, crew privacy controls, and multi-crew support with a crew-medical-officer view.
4. A conjunction-aware downlink queue and compression.
5. Certification path and integration with onboard medical procedures.
