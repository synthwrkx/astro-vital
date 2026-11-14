# Health rules reference

All rules live in `backend/app/core/rules/` and are registered in `rules/__init__.py`. Each returns
findings with a **level** (`watch` = Monitor, `act` = Act now), a data-backed **detail**, concrete
**actions**, and an **escalate** flag (shown as *Notify surgeon*). Thresholds are hackathon defaults
chosen from published spaceflight literature and common clinical cut-offs. They are **not clinically
validated**.

Every rule class has an `evidence` attribute: the NASA risk it addresses, using the **exact title** from NASA's
[Human System Risks](https://www.nasa.gov/hhp/human-system-risks/) list, plus the reference for its threshold. Facts
from the [5 Hazards](https://www.nasa.gov/hrp/hazards/), [Ongoing HRP Research](https://www.nasa.gov/hrp/ongoing-hrp-research/)
and CSA pages are woven in where relevant. It's copied onto each finding and shown in the UI as *Why this matters*.

## Definitions

- **Baseline:** mean and SD of each metric over preflight check-ins (mission day ≤ 0). If fewer than 5
  preflight entries exist, the first 14 check-ins are used instead. The SD has a floor per metric
  (`min_sd` in `core/catalog.py`) so tiny preflight variance doesn't make every reading look abnormal.
- **z / σ:** (value − baseline mean) / baseline SD.
- **Windows:** "today" is the latest entry, "3-day" the last 3 entries, "7-day" the last 7.
- Countermeasure rules (bone and muscle) only apply once the mission has launched.

## Cardiovascular (`cardio.py`)

| Rule | Monitor | Act now (escalates) | Rationale |
|---|---|---|---|
| HeartRateRule | 3-day avg ≥ +2σ or ≥ 100 bpm | today ≥ 110 bpm or ≥ +3σ | Fluid shift, deconditioning, fever, stress |
| BloodPressureRule | ≥ 140/90, or systolic ≤ 85 | ≥ 160/100 | Hypertension risk; low BP means orthostatic intolerance |
| Symptoms | dizziness | chest pain, palpitations, fainting | Red-flag cardiac symptoms |

## Bone & Muscle (`bone.py`)

| Rule | Monitor | Act now | Rationale |
|---|---|---|---|
| ExerciseComplianceRule | resistance 7-day avg (flight days only, needs ≥ 3) < 80% of target; aerobic < 60% | resistance < 50% (escalates) | Loaded exercise (ARED) is the main countermeasure against 1–1.5%/month bone loss |
| HydrationRule | 3-day fluid < target (default 2 L) | — | Bone demineralisation raises urinary calcium, so kidney-stone risk goes up |
| Symptoms | back pain, joint/muscle pain | flank pain / blood in urine | Spinal elongation; kidney stones |

## Nutrition & Metabolism (`nutrition.py`, plus `BodyMassRule` in `bone.py`)

| Rule | Monitor | Act now (escalates) | Rationale |
|---|---|---|---|
| GlucoseRule (fasting) | < 70 mg/dL, or ≥ 126 mg/dL, or ≥ +2.5σ | < 54 mg/dL, or ≥ 200 mg/dL | American Diabetes Association cut-offs; weightlessness resembles a sedentary lifestyle (CSA) |
| IntakeRule | energy 7-day avg < 85% of `calorie_target` (default 2800 kcal); protein < 1.0 g/kg | energy < 65% of target | Under-eating speeds muscle and bone loss |
| BodyMassRule | ≥ 5% below baseline (7-day avg) | ≥ 8% | Energy deficit, lean-mass loss |
| Symptoms | poor appetite | shaky, sweaty or confused (possible low sugar) | Hypoglycaemia warning signs |

## Immune (`immune.py`)

| Rule | Monitor | Act now | Rationale |
|---|---|---|---|
| TemperatureRule | ≥ 37.5 °C or ≥ +2.5σ | ≥ 38.0 °C (escalates) | Fever |
| InfectionSymptomsRule | cold sore or shingles-like rash | ≥ 2 infection-type symptoms (escalates) | Spaceflight immune dysregulation; latent herpesvirus reactivation |

## Behavioral & Cognition (`behavior.py`)

| Rule | Monitor | Act now (escalates) | Rationale |
|---|---|---|---|
| SleepRule | 7-day avg < 6.5 h | < 5.5 h | Sleep restriction is endemic in spaceflight |
| MoodRule | 7-day avg ≤ −2σ, **or** 14-day slope ≤ −0.35 points/week | 7-day avg ≤ 2.0/5, or low-mood symptom on ≥ 4 of 7 days | Isolation and confinement; gradual "third-quarter" decline |
| StressRule | 7-day avg ≥ 3.8/5 | ≥ 4.5/5 | Workload, conflict |
| CrewConflictRule | tension reported ≥ 2 of 7 days | — | Crew cohesion |
| AlertnessRule | PVT median ≥ +2σ or ≥ 5 lapses | ≥ +3σ or ≥ 10 lapses | Fatigue-related attention loss; restrict EVA, robotics, docking |

The PVT (in the UI's Alertness tab) uses random 2–10 s intervals. A lapse is a response over 500 ms,
and a response after 30 s with no reaction is recorded as a lapse.

## Radiation (`radiation.py`)

| Rule | Monitor | Act now (escalates) | Rationale |
|---|---|---|---|
| Daily spike | today ≥ 1.8× typical | today ≥ 3× typical **and** ≥ typical + 1 mSv | Solar particle event: move to the storm shelter |
| Career budget | ≥ 80% of limit, or projected to exceed it by mission end | ≥ 95% of limit | NASA-STD-3001 career limit of 600 mSv |
| Profile background | typical daily dose > 1.5× the mission profile's published reference | — | Dosimeter placement, shielding posture (see `core/profiles.py`) |
| Nausea after spike | — | nausea plus spike | Possible acute radiation effects |

"Typical" is the median daily dose over flight days. Projection = prior career dose + (average daily rate × mission length).

## Environment & Vision (`environment.py`)

| Rule | Monitor | Act now | Rationale |
|---|---|---|---|
| OxygenRule | SpO₂ < 95% | < 92% (escalates) | Hypoxia; cabin atmosphere |
| HeadacheRule | headache on ≥ 3 of 7 days | — | Elevated cabin CO₂ is a common cause |
| VisionRule | vision change (escalates) | — | Spaceflight-associated neuro-ocular syndrome (SANS) |

## Symptom catch-all (`symptoms.py`)

Runs last. Any symptom reported today that no specific rule already covered produces a finding at the
symptom's catalog level (`core/catalog.py` `SYMPTOMS`). Red-flag symptoms (`level: act`) always escalate.

## Evidence by rule

| Rule | Basis |
|---|---|
| HeartRate, BloodPressure | HRP cardiovascular adaptations; orthostatic intolerance; standard BP cut-offs |
| ExerciseCompliance | HRP bone fracture / muscle / aerobic risks; ~1–1.5%/month bone loss without countermeasures (LeBlanc et al., 2000) |
| BodyMass, Intake, Glucose | NASA risk: Inadequate Food and Nutrition…; ADA glucose thresholds; CSA (weightlessness ≈ sedentary lifestyle, Type-2 diabetes relevance) |
| Hydration | HRP renal stone risk |
| Temperature, InfectionSymptoms | HRP altered immune response; herpesvirus reactivation (Mehta et al.) |
| Sleep | HRP sleep loss / work overload; crews average < 6 h (Barger et al., Lancet Neurology 2014) |
| Mood | HRP behavioral conditions; third-quarter phenomenon (Bechtel & Berning, 1991) |
| Stress, CrewConflict | HRP behavioral conditions; team cooperation risk |
| Alertness | PVT (Dinges & Powell, 1985); NASA Cognition battery (Basner et al., 2015) |
| Radiation | HRP space radiation; NASA-STD-3001 600 mSv career limit; profile references (MSL RAD, Chang'e‑4 LND) |
| Oxygen | Clinical SpO₂ thresholds |
| Headache | ISS CO₂ and headache association (Law et al., 2014) |
| Vision | HRP SANS (Mader et al., 2011) |

Check the references against the primary literature before quoting them in a publication.

## Roll-up

- A domain takes the level of its worst finding, and the overall status takes the level of the worst domain.
- Findings are sorted most severe first. Within a level they keep registry order.
- The **drift scan** ranks every metric (except dose) by |z| of its 7-day mean vs. baseline.

## Onboard AI additions (advisory, never change levels)

See [AI_MODEL.md](AI_MODEL.md): multivariate anomaly score (alert ≥ 2.5), threshold forecasts
(≤ 45 days ahead), and data-backed correlations (|r| ≥ 0.4).
