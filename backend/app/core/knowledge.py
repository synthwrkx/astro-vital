"""Educational content for astronauts, grounded in the Space Apps challenge resources.

* SOURCES       — the NASA and CSA resources this app's content is based on (with links).
* HAZARDS       — NASA HRP's five hazards of human spaceflight ("RIDGE"), what they do to the body,
                  and how AstroVital monitors each one.
* METRIC_GUIDES — how to take each measurement in space, why it matters, and when to escalate.

Facts are paraphrased or briefly quoted from the cited pages (retrieved November 2026). Re-check
before publication.
"""
from __future__ import annotations

SOURCES: dict[str, dict[str, str]] = {
    "hazards": {"title": "5 Hazards of Human Spaceflight", "org": "NASA Human Research Program",
                "url": "https://www.nasa.gov/hrp/hazards/"},
    "risks": {"title": "Human System Risks (Risks of Human Spaceflight)", "org": "NASA",
              "url": "https://www.nasa.gov/hhp/human-system-risks/"},
    "ongoing": {"title": "Ongoing HRP Research in Space", "org": "NASA Human Research Program",
                "url": "https://www.nasa.gov/hrp/ongoing-hrp-research/"},
    "csa_radiation": {"title": "Monitoring Radiation for Astronaut Health", "org": "Canadian Space Agency",
                      "url": "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp"},
    "csa_science": {"title": "Why Do We Conduct Science Experiments in Space?", "org": "Canadian Space Agency",
                    "url": "https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp"},
}

HAZARDS: list[dict] = [
    {
        "id": "radiation", "letter": "R", "name": "Space radiation",
        "summary": "NASA calls space radiation \"one of the most hazardous aspects of human spaceflight\". Exposure increases "
                   "cancer risk, can damage the central nervous system, and can affect cognition and motor function.",
        "facts": ["CSA: neutron radiation contributes about 30% of total radiation on the ISS and is especially harmful.",
                  "CSA monitors crews with bubble detectors and is developing CANS, an autonomous neutron spectrometer.",
                  "NASA-STD-3001 sets a 600 mSv career effective-dose limit."],
        "monitors": "Daily dosimeter dose, career budget vs. limit, end-of-mission projection, solar-particle-event spike alerts, "
                    "and an expected dose per mission profile.",
        "domains": ["radiation"], "risks": ["Risk of Radiation Carcinogenesis"], "sources": ["hazards", "csa_radiation"],
    },
    {
        "id": "isolation", "letter": "I", "name": "Isolation & confinement",
        "summary": "Small crews in confined spaces for long periods face behavioral and team challenges. NASA notes that sleep loss, "
                   "circadian desynchronization and work overload compound the problem.",
        "facts": ["NASA mitigations include behavioral-health monitoring, workload research and light therapy for circadian alignment.",
                  "Analogs: HERA (45-day stays) and CHAPEA (year-long Mars simulation).",
                  "Ongoing research: the ARCHeR study monitored Artemis II crew well-being, activity and sleep."],
        "monitors": "Daily mood, stress and fatigue; sleep hours; crew-tension reports; mood-trend detection "
                    "(the 'third-quarter' decline); the psychomotor vigilance test for alertness.",
        "domains": ["behavior"],
        "risks": ["Risk of Adverse Cognitive or Behavioral Changes and Psychiatric Disorders (Behavioral Health Risk)",
                  "Risk of Performance Decrements and Adverse Health Outcomes Resulting from Sleep Loss, Circadian Desynchronization, and Work Overload",
                  "Risk of Inadequate Cooperation, Coordination, Communication, and Psychosocial Adaptation within a Team (Team Risk)"],
        "sources": ["hazards", "ongoing"],
    },
    {
        "id": "distance", "letter": "D", "name": "Distance from Earth",
        "summary": "Mars is on average 140 million miles away, a mission of roughly three years, with communication delays "
                   "of up to 20 minutes one way. Crews must be self-sufficient, including for medical problems.",
        "facts": ["Evacuation isn't possible from deep space, so problems must be detected and handled onboard.",
                  "NASA's risk list includes Earth Independent Human-Systems Operations (EIHSO Risk)."],
        "monitors": "This is AstroVital's reason for existing: onboard rules and AI need no Earth link, and compact downlink "
                    "reports suit delayed, low-bandwidth contact. The Earth-link delay is shown per mission profile.",
        "domains": [], "risks": ["Risk of Adverse Mission Outcomes Due to Earth Independent Human-Systems Operations (EIHSO Risk)",
                                 "Risk of Adverse Health Outcomes and Decrements in Performance due to Inflight Medical Conditions"],
        "sources": ["hazards", "risks"],
    },
    {
        "id": "gravity", "letter": "G", "name": "Gravity fields",
        "summary": "Weightlessness and partial gravity cause bone and muscle loss, dizziness and vision changes. Fluids shift "
                   "toward the head, which can affect the eyes, and kidney-stone risk rises.",
        "facts": ["NASA: weight-bearing bones lose on average 1–1.5% of mineral density per month in space.",
                  "Ongoing research: Brain Fluid Pressure and Thigh Cuff studies target eye and brain changes (SANS).",
                  "CSA: the effects of weightlessness resemble accelerated aging and a sedentary lifestyle."],
        "monitors": "Resistance and aerobic exercise vs. targets, body mass, fluid intake (kidney stones), blood pressure "
                    "and dizziness (orthostatic tolerance), vision-change reports (SANS).",
        "domains": ["bone", "cardio", "env"],
        "risks": ["Risk of Bone Fracture due to Spaceflight-induced Changes to Bone",
                  "Risk of Reduced Physical Performance Capabilities Due to Reduced Muscle Size, Strength, and Endurance (Muscle Risk)",
                  "Risk of Cardiovascular Adaptations Contributing to Adverse Mission Performance and Health Outcomes (CV Risk)",
                  "Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS Risk)", "Risk of Renal Stone Formation"],
        "sources": ["hazards", "ongoing", "csa_science"],
    },
    {
        "id": "environment", "letter": "E", "name": "Hostile & closed environments",
        "summary": "In a closed habitat, microbes pass more easily between people, stress hormones can rise, and the immune "
                   "system can change, possibly raising the risk of allergies or illness.",
        "facts": ["NASA mitigations: habitat design (temperature, pressure, lighting, noise), microbial monitoring and immune tracking.",
                  "Ongoing research: Immune Biomarkers analysed Artemis II crew blood and saliva.",
                  "NASA's risk list includes cabin CO₂ exposure and hypoxia."],
        "monitors": "Temperature and infection symptoms (including herpesvirus reactivation), SpO₂, recurring headaches "
                    "(a cabin CO₂ cue), photos of rashes or lesions for downlink, nutrition and blood sugar.",
        "domains": ["immune", "env", "nutrition"],
        "risks": ["Risk of In Mission Impacts, Adverse Health Events or Long-Term Health Impacts due to Altered Immune Response (Immune Risk)",
                  "Risk of Adverse Health Effects Due to Host-Microorganism Interactions",
                  "Risk of Nominal Acute and Chronic Ambient Carbon Dioxide Exposure in Crewed Vehicles (CO2 Risk)",
                  "Risk of Reduced Crew Health and Performance Due to Hypoxia",
                  "Risk of Inadequate Food and Nutrition Causing Decrements in In-Mission Health and Performance and Long-term Health"],
        "sources": ["hazards", "risks", "ongoing"],
    },
]

# How to measure each indicator in space. "when" = suggested time of day; "escalate" = when to involve the flight surgeon.
METRIC_GUIDES: dict[str, dict[str, str]] = {
    "hr": {"device": "Pulse oximeter, chest strap or smart shirt (CSA Bio-Monitor class)", "when": "Morning, before activity",
           "how": "Sit or restrain yourself quietly for 5 minutes, then record your resting pulse in beats per minute.",
           "why": "Microgravity fluid shifts and deconditioning change heart rate; a rise vs. your baseline can signal illness or stress.",
           "escalate": "Resting HR of 110 bpm or more, palpitations, chest pain or fainting."},
    "sbp": {"device": "Automatic blood-pressure cuff", "when": "Morning, seated, before caffeine",
            "how": "Cuff on the bare upper arm at heart level, arm supported, feet anchored. Rest 5 minutes, take 2 readings 1 minute apart and record the lower.",
            "why": "Fluid shifts alter blood pressure; low pressure means orthostatic intolerance, high pressure is a cardiovascular risk.",
            "escalate": "160/100 mmHg or higher, or fainting."},
    "dbp": {"device": "Automatic blood-pressure cuff", "when": "Same reading as systolic",
            "how": "Recorded together with systolic: the lower number.", "why": "See systolic BP.", "escalate": "100 mmHg or higher."},
    "spo2": {"device": "Fingertip pulse oximeter", "when": "Morning, and when you feel short of breath",
             "how": "Warm your hand, rest it still for 1 minute and read the steady value.",
             "why": "Low oxygen saturation can indicate a cabin atmosphere problem or illness.", "escalate": "Below 92%."},
    "temp": {"device": "Digital or forehead thermometer", "when": "Morning, or when you feel unwell",
             "how": "Oral under the tongue for 1 minute (no drink for 15 minutes before), or forehead scan.",
             "why": "Fever is an early sign of infection; spaceflight alters immune response.", "escalate": "38.0 °C or higher."},
    "weight": {"device": "Body-mass measurement device (spring or linear-acceleration based; scales don't work in weightlessness)",
               "when": "Weekly or daily, same time",
               "how": "Follow the device procedure (hold still while it oscillates or accelerates you) and record mass in kg.",
               "why": "Mass loss signals an energy deficit and muscle loss.", "escalate": "8% or more below baseline."},
    "sleep": {"device": "Self-report or actigraphy watch", "when": "On waking",
              "how": "Record the hours actually slept, not time in the sleep station.",
              "why": "Sleep loss impairs judgement, mood and immunity.", "escalate": "Average below 5.5 h for a week."},
    "aerobic": {"device": "Treadmill / cycle ergometer log", "when": "After each session",
                "how": "Total minutes of aerobic exercise today.", "why": "Protects aerobic capacity and cardiovascular fitness for landing.",
                "escalate": "Well below target for over a week."},
    "resistance": {"device": "Resistance device (e.g. ARED) log", "when": "After each session",
                   "how": "Total minutes of loaded resistance exercise today.",
                   "why": "Loaded exercise is the main defence against 1–1.5%/month bone loss.", "escalate": "Under 50% of target for a week."},
    "fluid": {"device": "Drink bag volume", "when": "End of day", "how": "Total litres drunk today.",
              "why": "Bone loss raises urinary calcium, and fluid lowers kidney-stone risk.", "escalate": "Flank pain or blood in urine."},
    "mood": {"device": "Self-rating", "when": "Evening", "how": "Rate your overall mood today: 1 very low … 5 great. Be honest; it's private.",
             "why": "Isolation and confinement can erode mood gradually.", "escalate": "Average 2/5 or lower, or hopelessness."},
    "stress": {"device": "Self-rating", "when": "Evening", "how": "Rate stress: 1 calm … 5 very high.",
               "why": "Work overload compounds isolation stress.", "escalate": "Average 4.5/5 or higher."},
    "fatigue": {"device": "Self-rating", "when": "Morning", "how": "Rate fatigue: 1 fresh … 5 exhausted.",
                "why": "Fatigue predicts errors on safety-critical tasks.", "escalate": "Combined with poor alertness-test results."},
    "pvt": {"device": "Alertness test (in this app)", "when": "Morning, and before EVA, robotics or docking",
            "how": "Run the 3-minute test; tap or press Space as soon as the counter appears. The median reaction time is saved.",
            "why": "An objective measure of fatigue that self-ratings miss.", "escalate": "3σ slower than baseline or 10+ lapses."},
    "lapses": {"device": "Alertness test", "when": "With the PVT", "how": "Saved automatically: responses slower than 500 ms.",
               "why": "Lapses are attention failures.", "escalate": "10 or more."},
    "dose": {"device": "Personal dosimeter (e.g. bubble detector) or area monitor", "when": "Daily",
             "how": "Read the daily dose in mSv from your dosimeter or the module monitor.",
             "why": "Tracks career dose and detects solar particle events.", "escalate": "3× your typical daily dose: shelter, then report."},
    "glucose": {"device": "Glucometer (finger-stick) or continuous glucose monitor", "when": "Morning, fasting (before breakfast)",
                "how": "Clean and dry the fingertip, prick the side, apply the second drop to the strip and record mg/dL.",
                "why": "Weightlessness resembles a sedentary lifestyle and can reduce insulin sensitivity; low sugar impairs alertness.",
                "escalate": "Below 54 or above 200 mg/dL, or shakiness and confusion."},
    "calories": {"device": "Food log (meal packages list kcal)", "when": "End of day",
                 "how": "Add up the kcal from the labels of everything you ate today.",
                 "why": "Astronauts often under-eat, and an energy deficit speeds muscle and bone loss.", "escalate": "Under 65% of target for a week."},
    "protein": {"device": "Food log", "when": "End of day", "how": "Add up grams of protein from meal labels.",
                "why": "Protein (about 1.2 g/kg/day) supports muscle maintenance.", "escalate": "Persistently under 1.0 g/kg/day."},
}
