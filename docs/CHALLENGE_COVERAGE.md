# Challenge coverage

How AstroVital answers each part of the NASA Space Apps challenge brief and uses the required resources.

## Objectives

| The brief asks for | AstroVital | Where |
|---|---|---|
| A visual tool for astronauts to assess their own health | Dashboard: status card, health domains, action plan, latest readings, body map | Dashboard |
| Guidance on treatments and health improvements | Every finding carries numbered onboard actions and a *Notify surgeon* flag; the AI briefing prioritises them | Dashboard → any finding; AI briefing |
| Input through any kind of input: keyboard, mouse, camera | Keyboard form, mouse/tap 1–5 scales and symptom chips, **voice dictation**, **camera photos** attached to the check-in | Check-in |
| Any data that represents a health indicator | 19 indicators: HR, BP, SpO₂, temperature, body mass, sleep, exercise, fluid, mood, stress, fatigue, PVT reaction time and lapses, radiation dose, **blood glucose (mg/dL)**, energy and protein intake, and photos | Check-in; `core/catalog.py` |
| Indicators named in the brief: blood pressure, heart rate, blood sugar, body temperature, daily sleep hours, mood | All six are captured and evaluated against a personal baseline | Check-in → Vitals, Nutrition & metabolism, How are you doing? |
| Use NASA HRP and partner resources | Hazards, risk titles, research and CSA radiation facts come from the required resources (below) | Learn; *Why this matters* on every finding |
| Which measurements can be performed in space? | Each indicator's guide names the device that works in space (e.g. mass-measurement device, since scales don't work in weightlessness) | Learn → *How to measure*; ⓘ on each check-in field |
| Why is an exam needed? | *Why it matters in space* per indicator; *Why this matters* per finding | Learn; finding cards |
| How do the hazards affect these indicators? | Five-hazards cards link each hazard to its domains and the indicators AstroVital monitors; body map *In space* text | Learn; body map |
| When does a result warrant crew or flight-surgeon attention? | Nominal / Monitor / Act now levels, escalation flags, and *Escalate if* thresholds per indicator | Everywhere; `docs/HEALTH_RULES.md` |
| Actions to prevent a critical condition | Countermeasure tracking, forecasts of threshold crossings, the daily routine | Dashboard, AI briefing, Routine |
| Clear presentation of metrics and diagnosis | Status colors with labels, big numbers, explainable findings | — |
| Animations and interactivity; a clickable human figure | **Body map**: animated heartbeat, pulsing Act now regions and a radiation aura. Clicking a body part shows its function, how space affects it, its findings, readings and how to measure | Dashboard → Body map |

## Potential considerations

| Consideration | AstroVital | Where |
|---|---|---|
| Different environments: spacecraft, station, rover, planetary base | Mission profiles: ISS, lunar surface/base, **pressurized lunar rover**, Mars transit, Mars surface/base, plus two Earth analogs. Each sets expected dose, Earth-link delay and gravity from published data | Settings → Mission profile |
| Prompt astronauts to take measurements as part of the routine | **Daily routine** of 10 tasks with suggested times. Tasks complete automatically from check-ins, and due tasks show in the bell menu | Routine; bell menu; Dashboard routine card |
| Gamification | Day streaks, a daily score, XP and levels, and 8 badges (Week streak, Countermeasure champion, Hydration hero, Sharp mind…). Rewards are for logging consistently, never for "good" numbers | Routine |
| Dynamic charts over time | Trends with baseline band, sparklines, sleep chart, radiation ring, week symptom calendar, mission-story ribbon | Trends, Dashboard, Mission story |
| Color coding at a glance | Green/amber/red status with text labels everywhere, including the body map | — |
| Don't assume astronauts know how to assess their health | **Learn page**: the five hazards, how to measure each indicator, when to escalate. ⓘ guide on every check-in field. Plain-language copilot | Learn; Check-in; AI Copilot |

## Required resources and how they're used

| Resource | Used for |
|---|---|
| [NASA: 5 Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/) | The RIDGE hazard cards on the Learn page (summaries, facts such as 1–1.5% bone loss per month, Mars about 140 million miles away with up to 20 min one-way delay); body-map *In space* text; the Mars-profile delay |
| [NASA: Human System Risks (Risks of Human Spaceflight)](https://www.nasa.gov/hhp/human-system-risks/) | Exact risk titles in every rule's *Why this matters* and in each hazard's *Related NASA risks* list |
| [NASA: Ongoing HRP Research in Space](https://www.nasa.gov/hrp/ongoing-hrp-research/) | Current studies cited in the hazards (ARCHeR sleep and well-being, Immune Biomarkers, Brain Fluid Pressure, Thigh Cuff) and in the SANS rule evidence |
| [CSA: Monitoring Radiation for Astronaut Health](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp) | Radiation hazard and rule evidence: neutrons are about 30% of ISS dose; bubble detectors and the CANS neutron spectrometer; the dosimeter measurement guide |
| [CSA: Why Do We Conduct Science Experiments in Space?](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp) | Gravity hazard (weightlessness resembles accelerated aging and a sedentary lifestyle); the Type-2 diabetes link behind the blood-glucose rule |

All five links are listed on the Learn page and in `backend/app/core/knowledge.py` (`SOURCES`). Content was paraphrased
from the pages as retrieved in November 2026. Re-check before final submission, since NASA pages are updated.

## Judging questions and AI-use rules

| Item | Where it is answered |
|---|---|
| What does it do, and how does it work? | Deck slides 3–5 (five-step flow); README; ARCHITECTURE.md |
| What benefits does it have? | Deck slide 3 (Benefits) |
| What is the intended impact? | Deck slide 7; MISSION_CONCEPT.md |
| What tools did you use? | Deck slide 7 (Tools); README *Tech stack* |
| How is your project creative? | Deck slide 6 (Creative) |
| What factors did your team consider? | Deck slide 6 (Factors we considered) |
| No NASA branding or design elements | None used; "NASA" appears only as text naming the event and cited sources |
| Clearly indicate where and how SI was used | README *AI use (SI disclosure)*; deck slide 7; app footer |
| Visible watermark on SI images and videos | "AI-assisted (SI)" badge on every deck screenshot and on the video |
| Acknowledge SI audio, code and data in text and metadata | README table; MP4 title/comment metadata; PPTX subject/comments/keywords |
