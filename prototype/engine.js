/*
 * AstroVital — health evaluation engine
 * Pure logic (no DOM). Works in the browser (window.Engine) and in Node (require).
 *
 * Core idea: every astronaut is compared to THEIR OWN preflight baseline
 * (mean ± SD of preflight check-ins), plus a small set of absolute safety
 * thresholds. Findings are grouped into risk domains and each carries
 * concrete self-care actions and an escalation flag.
 *
 * DISCLAIMER: prototype decision-support for a hackathon. Not a medical device.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- catalog
  const DOMAINS = {
    cardio:    { name: 'Cardiovascular',        blurb: 'Fluid shifts and deconditioning alter heart rate, blood pressure and rhythm.' },
    bone:      { name: 'Bone & Muscle',         blurb: 'Microgravity drives ~1–1.5% bone loss per month and muscle atrophy without countermeasures.' },
    immune:    { name: 'Immune',                blurb: 'Spaceflight dysregulates immunity; latent viruses (e.g. herpes) can reactivate.' },
    behavior:  { name: 'Behavioral & Cognition', blurb: 'Isolation, confinement and sleep loss erode mood, alertness and crew cohesion.' },
    radiation: { name: 'Radiation',             blurb: 'Cumulative dose vs. career limit, and acute spikes from solar particle events.' },
    env:       { name: 'Environment & Vision',  blurb: 'Closed-loop air (CO₂, O₂) and fluid shifts affecting the eyes (SANS).' },
  };

  const METRICS = {
    hr:         { label: 'Resting heart rate',    short: 'HR',      unit: 'bpm',  min: 30,  max: 200,  step: 1,    minSd: 3,    dec: 0 },
    sbp:        { label: 'Systolic BP',           short: 'SYS',     unit: 'mmHg', min: 60,  max: 250,  step: 1,    minSd: 5,    dec: 0 },
    dbp:        { label: 'Diastolic BP',          short: 'DIA',     unit: 'mmHg', min: 30,  max: 150,  step: 1,    minSd: 4,    dec: 0 },
    spo2:       { label: 'Oxygen saturation',     short: 'SpO₂',    unit: '%',    min: 70,  max: 100,  step: 1,    minSd: 0.7,  dec: 0 },
    temp:       { label: 'Body temperature',      short: 'Temp',    unit: '°C',   min: 34,  max: 42,   step: 0.1,  minSd: 0.15, dec: 1 },
    weight:     { label: 'Body mass',             short: 'Mass',    unit: 'kg',   min: 30,  max: 200,  step: 0.1,  minSd: 0.4,  dec: 1 },
    sleep:      { label: 'Sleep duration',        short: 'Sleep',   unit: 'h',    min: 0,   max: 14,   step: 0.25, minSd: 0.4,  dec: 1 },
    aerobic:    { label: 'Aerobic exercise',      short: 'Aerobic', unit: 'min',  min: 0,   max: 300,  step: 5,    minSd: 5,    dec: 0 },
    resistance: { label: 'Resistance exercise',   short: 'Resist.', unit: 'min',  min: 0,   max: 300,  step: 5,    minSd: 5,    dec: 0 },
    fluid:      { label: 'Fluid intake',          short: 'Fluid',   unit: 'L',    min: 0,   max: 8,    step: 0.1,  minSd: 0.2,  dec: 1 },
    mood:       { label: 'Mood (1 low – 5 great)', short: 'Mood',   unit: '/5',   min: 1,   max: 5,    step: 1,    minSd: 0.4,  dec: 1 },
    stress:     { label: 'Stress (1 calm – 5 high)', short: 'Stress', unit: '/5', min: 1,   max: 5,    step: 1,    minSd: 0.4,  dec: 1 },
    fatigue:    { label: 'Fatigue (1 fresh – 5 exhausted)', short: 'Fatigue', unit: '/5', min: 1, max: 5, step: 1, minSd: 0.4, dec: 1 },
    pvt:        { label: 'Reaction time (median)', short: 'RT',     unit: 'ms',   min: 100, max: 2000, step: 1,    minSd: 15,   dec: 0 },
    lapses:     { label: 'Attention lapses',      short: 'Lapses',  unit: '',     min: 0,   max: 100,  step: 1,    minSd: 0.8,  dec: 0 },
    dose:       { label: 'Daily radiation dose',  short: 'Dose',    unit: 'mSv',  min: 0,   max: 2000, step: 0.01, minSd: 0.05, dec: 2 },
  };

  const SYMPTOMS = [
    { id: 'chest_pain',   label: 'Chest pain or pressure',                 domain: 'cardio',   level: 'act' },
    { id: 'palpitations', label: 'Palpitations / irregular heartbeat',     domain: 'cardio',   level: 'act' },
    { id: 'faint',        label: 'Fainting or near-fainting',              domain: 'cardio',   level: 'act' },
    { id: 'dizziness',    label: 'Dizziness / lightheadedness',            domain: 'cardio',   level: 'watch' },
    { id: 'back_pain',    label: 'Back pain',                              domain: 'bone',     level: 'watch' },
    { id: 'joint_pain',   label: 'Joint or muscle pain',                   domain: 'bone',     level: 'watch' },
    { id: 'flank_pain',   label: 'Flank pain / blood in urine',            domain: 'bone',     level: 'act' },
    { id: 'sore_throat',  label: 'Sore throat / cough',                    domain: 'immune',   level: 'watch' },
    { id: 'cold_sore',    label: 'Cold sore or shingles-like rash',        domain: 'immune',   level: 'watch' },
    { id: 'rash',         label: 'Skin rash / irritation',                 domain: 'immune',   level: 'watch' },
    { id: 'wound',        label: 'Slow-healing cut or infection',          domain: 'immune',   level: 'watch' },
    { id: 'low_mood',     label: 'Persistent low mood / loss of interest', domain: 'behavior', level: 'watch' },
    { id: 'insomnia',     label: 'Trouble falling or staying asleep',      domain: 'behavior', level: 'watch' },
    { id: 'conflict',     label: 'Tension or conflict with crew',          domain: 'behavior', level: 'watch' },
    { id: 'nausea',       label: 'Nausea / vomiting',                      domain: 'radiation', level: 'watch' },
    { id: 'headache',     label: 'Headache',                               domain: 'env',      level: 'watch' },
    { id: 'congestion',   label: 'Head fullness / nasal congestion',       domain: 'env',      level: 'watch' },
    { id: 'vision',       label: 'Blurred or changed vision',              domain: 'env',      level: 'watch' },
  ];
  const SYMPTOM_BY_ID = Object.fromEntries(SYMPTOMS.map(s => [s.id, s]));

  const LEVELS = { ok: 0, watch: 1, act: 2 };
  const LEVEL_LABEL = { ok: 'Nominal', watch: 'Monitor', act: 'Act now' };

  const DEFAULT_SETTINGS = {
    crewName: 'Crew member',
    missionStart: null,          // YYYY-MM-DD, day 1 = launch
    missionLength: 180,          // days
    priorCareerDose: 0,          // mSv before this mission
    careerLimit: 600,            // mSv (NASA-STD-3001 career effective dose limit)
    aerobicTarget: 60,           // min/day
    resistanceTarget: 60,        // min/day
    fluidTarget: 2.0,            // L/day
  };

  // ---------------------------------------------------------------- helpers
  const isNum = v => typeof v === 'number' && isFinite(v);
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const sd = a => {
    if (a.length < 2) return 0;
    const m = mean(a);
    return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
  };
  const median = a => {
    const s = [...a].sort((x, y) => x - y);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  // least-squares slope of y over x
  const slope = (xs, ys) => {
    const n = xs.length;
    if (n < 3) return 0;
    const mx = mean(xs), my = mean(ys);
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    return den ? num / den : 0;
  };
  const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

  const pad = n => String(n).padStart(2, '0');
  const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayStr = () => toDateStr(new Date());
  const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const diffDays = (a, b) => Math.round((parseDate(a) - parseDate(b)) / 86400000);
  const addDays = (s, n) => { const t = new Date(parseDate(s) + n * 86400000); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };

  const missionDay = (date, settings) => settings && settings.missionStart ? diffDays(date, settings.missionStart) + 1 : null;
  const sortEntries = entries => [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const values = (entries, key) => entries.map(e => e[key]).filter(isNum);
  const fmt = (key, v) => (isNum(v) ? v.toFixed(METRICS[key] ? METRICS[key].dec : 1) : '—');

  // ---------------------------------------------------------------- baseline
  function computeBaseline(entries, settings) {
    const sorted = sortEntries(entries);
    let base = sorted.filter(e => { const d = missionDay(e.date, settings); return d !== null && d <= 0; });
    let source = 'preflight';
    if (base.length < 5) { base = sorted.slice(0, Math.min(14, sorted.length)); source = 'first check-ins'; }
    const metrics = {};
    for (const k of Object.keys(METRICS)) {
      const v = values(base, k);
      if (v.length < 3) continue;
      metrics[k] = { mean: mean(v), sd: Math.max(sd(v), METRICS[k].minSd), median: median(v), n: v.length };
    }
    return { metrics, n: base.length, source };
  }
  const zOf = (baseline, key, v) => {
    const b = baseline.metrics[key];
    return b && isNum(v) ? (v - b.mean) / b.sd : null;
  };

  // ---------------------------------------------------------------- evaluation
  function evaluate(entriesIn, settingsIn) {
    const settings = Object.assign({}, DEFAULT_SETTINGS, settingsIn || {});
    const entries = sortEntries(entriesIn || []);
    const result = {
      overall: 'ok', findings: [], domains: {}, latest: null, missionDay: null,
      baseline: computeBaseline(entries, settings), radiation: null, recent: [], drift: [],
    };
    for (const d of Object.keys(DOMAINS)) result.domains[d] = { level: 'ok', findings: [] };
    if (!entries.length) return result;

    const latest = entries[entries.length - 1];
    const recent = entries.slice(-7);
    const recent3 = entries.slice(-3);
    const last14 = entries.slice(-14);
    const base = result.baseline;
    result.latest = latest;
    result.recent = recent;
    result.missionDay = missionDay(latest.date, settings);
    const inFlight = result.missionDay === null || result.missionDay >= 1;
    const syms = new Set(latest.symptoms || []);
    const symCount = id => recent.filter(e => (e.symptoms || []).includes(id)).length;

    const add = (domain, level, title, detail, actions, escalate = false) =>
      result.findings.push({ domain, level, title, detail, actions, escalate });
    const avg = (arr, k) => { const v = values(arr, k); return v.length ? mean(v) : null; };

    // ------------------------------------------------------------ CARDIOVASCULAR
    {
      const hr = latest.hr, z = zOf(base, 'hr', hr), hr3 = avg(recent3, 'hr'), z3 = zOf(base, 'hr', hr3);
      if (isNum(hr) && (hr >= 110 || (z !== null && z >= 3))) {
        add('cardio', 'act', 'Resting heart rate markedly elevated',
          `${hr} bpm today${z !== null ? ` (${z.toFixed(1)} SD above your baseline of ${base.metrics.hr.mean.toFixed(0)})` : ''}.`,
          ['Re-measure after 5 minutes of quiet seated/restrained rest', 'Check for fever, dehydration, caffeine or stimulant medication', 'Log any palpitations, chest discomfort or breathlessness'], true);
      } else if (isNum(hr3) && ((z3 !== null && z3 >= 2) || hr3 >= 100)) {
        add('cardio', 'watch', 'Resting heart rate trending high',
          `3-day average ${hr3.toFixed(0)} bpm${z3 !== null ? ` (${z3.toFixed(1)} SD above baseline)` : ''}.`,
          ['Prioritise sleep and hydration for the next 48 h', 'Measure at the same time each morning before activity', 'Escalate if it keeps rising or symptoms appear']);
      }
      const sbp = latest.sbp, dbp = latest.dbp;
      if ((isNum(sbp) && sbp >= 160) || (isNum(dbp) && dbp >= 100)) {
        add('cardio', 'act', 'Blood pressure high', `${sbp ?? '—'}/${dbp ?? '—'} mmHg.`,
          ['Repeat the measurement twice, 2 minutes apart', 'Rest, reduce sodium and stimulants', 'Report readings to the flight surgeon'], true);
      } else if ((isNum(sbp) && sbp >= 140) || (isNum(dbp) && dbp >= 90)) {
        add('cardio', 'watch', 'Blood pressure above normal range', `${sbp ?? '—'}/${dbp ?? '—'} mmHg.`,
          ['Re-check tomorrow under the same conditions', 'Review sodium intake and stress load']);
      } else if (isNum(sbp) && sbp <= 85) {
        add('cardio', 'watch', 'Blood pressure low', `Systolic ${sbp} mmHg — a risk for orthostatic intolerance.`,
          ['Increase fluid and salt intake per protocol', 'Move slowly when changing posture', 'Report fainting or near-fainting immediately']);
      }
    }

    // ------------------------------------------------------------ BONE & MUSCLE
    if (inFlight) {
      const res7 = avg(recent, 'resistance'), aer7 = avg(recent, 'aerobic');
      const rt = settings.resistanceTarget, at = settings.aerobicTarget;
      if (isNum(res7)) {
        const pct = res7 / rt;
        if (pct < 0.5) add('bone', 'act', 'Resistance exercise far below target',
          `7-day average ${res7.toFixed(0)} min/day vs ${rt} min target (${Math.round(pct * 100)}%). Loaded exercise is the main defence against bone loss.`,
          ['Schedule resistance sessions as non-negotiable timeline blocks', 'Focus on hip/spine loading (squat, deadlift, heel raise)', 'Discuss schedule conflicts with ground planners'], true);
        else if (pct < 0.8) add('bone', 'watch', 'Resistance exercise below target',
          `7-day average ${res7.toFixed(0)} min/day vs ${rt} min target (${Math.round(pct * 100)}%).`,
          ['Make up missed sessions this week', 'Increase load progressively rather than duration']);
      }
      if (isNum(aer7) && aer7 / at < 0.6) add('bone', 'watch', 'Aerobic exercise below target',
        `7-day average ${aer7.toFixed(0)} min/day vs ${at} min target. Aerobic work protects cardiovascular fitness for landing.`,
        ['Add interval sessions on the cycle ergometer or treadmill']);

      const bw = base.metrics.weight, w7 = avg(recent, 'weight');
      if (bw && isNum(w7)) {
        const loss = (bw.mean - w7) / bw.mean * 100;
        if (loss >= 8) add('bone', 'act', 'Significant body-mass loss',
          `Down ${loss.toFixed(1)}% from baseline (${bw.mean.toFixed(1)} → ${w7.toFixed(1)} kg). Suggests energy deficit and muscle loss.`,
          ['Increase caloric and protein intake (≥1.2 g/kg/day protein)', 'Review food rejection / menu fatigue', 'Request a nutrition consult'], true);
        else if (loss >= 5) add('bone', 'watch', 'Body mass declining',
          `Down ${loss.toFixed(1)}% from baseline (${bw.mean.toFixed(1)} → ${w7.toFixed(1)} kg).`,
          ['Add a snack after exercise sessions', 'Track food intake for 3 days to find the gap']);
      }
      const fl3 = avg(recent3, 'fluid');
      if (isNum(fl3) && fl3 < settings.fluidTarget) add('bone', 'watch', 'Low fluid intake',
        `3-day average ${fl3.toFixed(1)} L/day. Bone demineralisation raises urinary calcium — low fluid increases kidney-stone risk.`,
        [`Drink at least ${settings.fluidTarget} L/day`, 'Set hydration reminders around exercise']);
    }

    // ------------------------------------------------------------ IMMUNE
    {
      const t = latest.temp, z = zOf(base, 'temp', t);
      if (isNum(t) && t >= 38.0) add('immune', 'act', 'Fever', `${t.toFixed(1)} °C.`,
        ['Rest and hydrate; follow the onboard medical checklist for fever', 'Consider separating from crew to limit spread', 'Report to the flight surgeon with symptom timeline'], true);
      else if (isNum(t) && (t >= 37.5 || (z !== null && z >= 2.5))) add('immune', 'watch', 'Temperature elevated', `${t.toFixed(1)} °C${z !== null ? ` (${z.toFixed(1)} SD above baseline)` : ''}.`,
        ['Re-check in 4–6 hours', 'Watch for sore throat, rash or fatigue']);
      const immuneSyms = SYMPTOMS.filter(s => s.domain === 'immune' && syms.has(s.id));
      if (immuneSyms.length >= 2 && !(isNum(t) && t >= 38)) add('immune', 'act', 'Multiple infection-type symptoms',
        immuneSyms.map(s => s.label).join(', ') + '.',
        ['Photograph any lesions for downlink', 'Hand hygiene and surface cleaning in shared areas', 'Report to the flight surgeon'], true);
      if (syms.has('cold_sore')) add('immune', 'watch', 'Possible latent-virus reactivation',
        'Cold sores or shingles-like rash are a known spaceflight immune effect (herpesvirus reactivation), often stress-linked.',
        ['Photograph the lesion daily', 'Use antiviral per onboard formulary if prescribed', 'Avoid touching eyes']);
    }

    // ------------------------------------------------------------ BEHAVIORAL & COGNITION
    {
      const sl7 = avg(recent, 'sleep');
      if (isNum(sl7) && sl7 < 5.5) add('behavior', 'act', 'Chronic sleep restriction',
        `7-day average ${sl7.toFixed(1)} h. Sustained short sleep impairs judgement, mood and immunity.`,
        ['Protect an 8.5 h sleep window; request timeline relief', 'Limit screen light 1 h before sleep; use eye mask/earplugs', 'Discuss sleep medication with the flight surgeon'], true);
      else if (isNum(sl7) && sl7 < 6.5) add('behavior', 'watch', 'Sleep below recommended',
        `7-day average ${sl7.toFixed(1)} h.`,
        ['Keep a consistent sleep/wake time', 'Avoid caffeine within 8 h of sleep', 'Check crew-quarters temperature, noise and light']);

      const m7 = avg(recent, 'mood'), mz = zOf(base, 'mood', m7);
      if (isNum(m7) && (m7 <= 2.0 || symCount('low_mood') >= 4)) add('behavior', 'act', 'Sustained low mood',
        `7-day mood average ${m7.toFixed(1)}/5. Persistent low mood on a long mission warrants support — this is common and treatable.`,
        ['Schedule a private psychological support conference', 'Plan a call with family or friends', 'Tell a trusted crewmate how you are doing'], true);
      else if (isNum(m7) && mz !== null && mz <= -2) add('behavior', 'watch', 'Mood below your baseline',
        `7-day average ${m7.toFixed(1)}/5 vs baseline ${base.metrics.mood.mean.toFixed(1)}.`,
        ['Build in leisure time: Earth-viewing, music, hobbies', 'Maintain exercise — it is a strong mood buffer', 'Consider a private psych conference']);

      // Gradual decline (e.g. "third-quarter phenomenon") — slope over last 14 days
      const moodPts = last14.filter(e => isNum(e.mood));
      if (moodPts.length >= 10) {
        const s = slope(moodPts.map(e => parseDate(e.date) / 86400000), moodPts.map(e => e.mood)) * 7;
        if (s <= -0.35 && !result.findings.some(f => f.title === 'Sustained low mood'))
          add('behavior', 'watch', 'Mood gradually declining',
            `Mood has dropped ~${Math.abs(s).toFixed(2)} points/week over the last 2 weeks — early signs are easiest to address.`,
            ['Reflect on what changed (workload, sleep, crew dynamics)', 'Plan something to look forward to this week']);
      }

      const st7 = avg(recent, 'stress');
      if (isNum(st7) && st7 >= 4.5) add('behavior', 'act', 'Very high stress', `7-day average ${st7.toFixed(1)}/5.`,
        ['Ask ground to re-prioritise the task list', 'Use breathing / relaxation protocol twice daily', 'Talk to psychological support'], true);
      else if (isNum(st7) && st7 >= 3.8) add('behavior', 'watch', 'Elevated stress', `7-day average ${st7.toFixed(1)}/5.`,
        ['Identify the top stressor and share it at the daily planning conference', 'Take short breaks between tasks']);

      if (symCount('conflict') >= 2) add('behavior', 'watch', 'Recurring crew tension',
        `Reported on ${symCount('conflict')} of the last ${recent.length} days.`,
        ['Address it early and directly, using agreed crew-resource-management practices', 'Request a confidential conference if needed']);

      const pz = zOf(base, 'pvt', latest.pvt), lp = latest.lapses;
      if ((pz !== null && pz >= 3) || (isNum(lp) && lp >= 10)) add('behavior', 'act', 'Alertness markedly reduced',
        `Reaction time ${fmt('pvt', latest.pvt)} ms${pz !== null ? ` (${pz.toFixed(1)} SD slower than baseline)` : ''}, ${lp ?? '—'} lapses.`,
        ['Avoid safety-critical tasks (EVA, robotics, docking) until re-tested', 'Take a nap (≤30 min) or rest, then re-test', 'Inform the crew and ground of reduced readiness'], true);
      else if ((pz !== null && pz >= 2) || (isNum(lp) && lp >= 5)) add('behavior', 'watch', 'Alertness below baseline',
        `Reaction time ${fmt('pvt', latest.pvt)} ms${pz !== null ? ` (${pz.toFixed(1)} SD slower)` : ''}, ${lp ?? '—'} lapses.`,
        ['Re-test before any critical task', 'Check sleep debt and fatigue']);
    }

    // ------------------------------------------------------------ RADIATION
    {
      const flightEntries = entries.filter(e => { const d = missionDay(e.date, settings); return d === null || d >= 1; });
      const doses = values(flightEntries, 'dose');
      if (doses.length) {
        const missionDose = doses.reduce((s, v) => s + v, 0);
        const career = settings.priorCareerDose + missionDose;
        const daysFlown = Math.max(1, result.missionDay || doses.length);
        const rate = missionDose / daysFlown;
        const projected = settings.priorCareerDose + rate * settings.missionLength;
        const pct = career / settings.careerLimit * 100;
        result.radiation = { missionDose, career, rate, projected, pct, limit: settings.careerLimit };

        const typical = median(doses);
        const today = latest.dose;
        if (isNum(today) && typical > 0 && today >= Math.max(3 * typical, typical + 1)) {
          add('radiation', 'act', 'Radiation dose spike — possible solar particle event',
            `${today.toFixed(2)} mSv today vs typical ${typical.toFixed(2)} mSv/day.`,
            ['Move to the designated storm shelter / most shielded module now', 'Confirm space-weather alert with ground', 'Keep personal dosimeter on; log time in shelter'], true);
        } else if (isNum(today) && typical > 0 && today >= 1.8 * typical) {
          add('radiation', 'watch', 'Radiation dose above typical',
            `${today.toFixed(2)} mSv today vs typical ${typical.toFixed(2)} mSv/day.`,
            ['Check space-weather status', 'Minimise time in lightly-shielded areas']);
        }
        if (pct >= 95) add('radiation', 'act', 'Approaching career dose limit',
          `${career.toFixed(0)} of ${settings.careerLimit} mSv (${pct.toFixed(0)}%).`,
          ['Review remaining mission timeline with ground', 'Maximise time in shielded areas'], true);
        else if (pct >= 80) add('radiation', 'watch', 'High share of career dose used',
          `${career.toFixed(0)} of ${settings.careerLimit} mSv (${pct.toFixed(0)}%).`,
          ['Prefer sleeping in the most shielded quarters']);
        else if (projected > settings.careerLimit) add('radiation', 'watch', 'Projected to exceed career limit',
          `At ${rate.toFixed(2)} mSv/day you'd reach ~${projected.toFixed(0)} mSv by mission end (limit ${settings.careerLimit}).`,
          ['Discuss shielding and timeline options with ground']);
        if (syms.has('nausea') && isNum(today) && typical > 0 && today >= 3 * typical)
          add('radiation', 'act', 'Nausea following a dose spike', 'Could indicate acute radiation effects.',
            ['Report immediately with dosimeter readings'], true);
      }
    }

    // ------------------------------------------------------------ ENVIRONMENT & VISION
    {
      const s = latest.spo2;
      if (isNum(s) && s < 92) add('env', 'act', 'Low blood oxygen', `SpO₂ ${s}%.`,
        ['Re-measure with a warm finger, at rest', 'Check cabin O₂/CO₂ and ventilation', 'Report to the flight surgeon'], true);
      else if (isNum(s) && s < 95) add('env', 'watch', 'Blood oxygen slightly low', `SpO₂ ${s}%.`,
        ['Re-measure later today', 'Check cabin atmosphere readings']);
      const h = symCount('headache');
      if (h >= 3) add('env', 'watch', 'Recurring headaches',
        `Reported on ${h} of the last ${recent.length} days. Elevated cabin CO₂ is a common cause on spacecraft.`,
        ['Check local CO₂ readings; ensure airflow in crew quarters', 'Hydrate; note timing relative to sleep and work location']);
      if (syms.has('vision')) add('env', 'watch', 'Vision change reported',
        'Spaceflight-associated neuro-ocular syndrome (SANS) can change near vision on long missions.',
        ['Do the onboard visual-acuity / Amsler grid check', 'Use adjustable-focus glasses if issued', 'Report so ground can schedule an eye exam (OCT/fundoscopy)'], true);
    }

    // ------------------------------------------------------------ symptom catch-all
    for (const id of syms) {
      const s = SYMPTOM_BY_ID[id];
      if (!s) continue;
      const covered = { cold_sore: 1, vision: 1, headache: 1, conflict: 1, low_mood: 1 };
      if (covered[id] && s.level !== 'act') continue;
      if (s.domain === 'immune' && result.findings.some(f => f.title === 'Multiple infection-type symptoms')) continue;
      add(s.domain, s.level, `Symptom: ${s.label}`, 'Reported in today\'s check-in.',
        s.level === 'act'
          ? ['Stop strenuous activity and follow the onboard medical checklist', 'Notify a crewmate and the flight surgeon now']
          : ['Note onset, duration and triggers', 'Escalate if it persists more than 48 h or worsens'],
        s.level === 'act');
    }

    // ------------------------------------------------------------ roll-up
    result.findings.sort((a, b) => LEVELS[b.level] - LEVELS[a.level]);
    for (const f of result.findings) {
      const d = result.domains[f.domain];
      d.findings.push(f);
      if (LEVELS[f.level] > LEVELS[d.level]) d.level = f.level;
      if (LEVELS[f.level] > LEVELS[result.overall]) result.overall = f.level;
    }

    // ------------------------------------------------------------ drift scan (7-day mean vs baseline)
    for (const k of Object.keys(METRICS)) {
      if (k === 'dose') continue;
      const v = avg(recent, k);
      const z = zOf(base, k, v);
      if (z === null) continue;
      result.drift.push({ key: k, recent: v, baseline: base.metrics[k].mean, z });
    }
    result.drift.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
    return result;
  }

  // ---------------------------------------------------------------- downlink report
  function buildReport(entries, settingsIn) {
    const settings = Object.assign({}, DEFAULT_SETTINGS, settingsIn || {});
    const r = evaluate(entries, settings);
    if (!r.latest) return 'No check-ins recorded.';
    const L = [];
    L.push('ASTROVITAL HEALTH SUMMARY — CREW SELF-ASSESSMENT');
    L.push(`Crew: ${settings.crewName}   Date: ${r.latest.date}   Mission day: ${r.missionDay ?? 'n/a'}`);
    L.push(`OVERALL STATUS: ${LEVEL_LABEL[r.overall].toUpperCase()}`);
    L.push('');
    L.push('DOMAINS');
    for (const [k, d] of Object.entries(r.domains)) L.push(`  ${DOMAINS[k].name.padEnd(24)} ${LEVEL_LABEL[d.level]}`);
    L.push('');
    L.push('FINDINGS');
    if (!r.findings.length) L.push('  None — all indicators within personal baseline.');
    r.findings.forEach((f, i) => {
      L.push(`  ${i + 1}. [${LEVEL_LABEL[f.level]}]${f.escalate ? ' [SURGEON REVIEW]' : ''} ${DOMAINS[f.domain].name}: ${f.title}`);
      L.push(`     ${f.detail}`);
    });
    L.push('');
    L.push('LATEST READINGS (today | 7-day avg | baseline)');
    for (const k of ['hr', 'sbp', 'dbp', 'spo2', 'temp', 'weight', 'sleep', 'resistance', 'aerobic', 'fluid', 'mood', 'stress', 'fatigue', 'pvt', 'lapses', 'dose']) {
      const v7 = values(r.recent, k);
      const b = r.baseline.metrics[k];
      L.push(`  ${METRICS[k].short.padEnd(8)} ${fmt(k, r.latest[k]).padStart(7)} | ${(v7.length ? fmt(k, mean(v7)) : '—').padStart(7)} | ${(b ? fmt(k, b.mean) : '—').padStart(7)} ${METRICS[k].unit}`);
    }
    if (r.radiation) {
      L.push('');
      L.push(`RADIATION  mission ${r.radiation.missionDose.toFixed(1)} mSv · career ${r.radiation.career.toFixed(1)}/${r.radiation.limit} mSv (${r.radiation.pct.toFixed(0)}%) · projected ${r.radiation.projected.toFixed(0)} mSv`);
    }
    if (r.latest.notes) { L.push(''); L.push('CREW NOTES'); L.push('  ' + r.latest.notes); }
    L.push('');
    L.push(`Baseline: ${r.baseline.n} ${r.baseline.source} entries.`);
    return L.join('\n');
  }

  // ---------------------------------------------------------------- demo data
  // Seeded RNG so the demo is reproducible.
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function generateDemo(endDate = todayStr(), flightDays = 124) {
    const R = rng(42);
    const gauss = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const start = addDays(endDate, -(flightDays - 1));        // launch = day 1
    const settings = Object.assign({}, DEFAULT_SETTINGS, { crewName: 'Demo Astronaut', missionStart: start, missionLength: 180, priorCareerDose: 95 });
    const entries = [];
    for (let day = -13; day <= flightDays; day++) {
      const date = addDays(start, day - 1);
      const f = Math.max(0, day);                  // days in flight
      const late = day > flightDays - 21 ? (day - (flightDays - 21)) / 21 : 0;   // 0→1 over last 3 weeks
      const e = { date, symptoms: [] };
      e.hr = Math.round(62 + (day >= 1 && day <= 5 ? 6 : 0) + late * 4 + gauss() * 2.5);
      e.sbp = Math.round(118 - (day >= 1 ? 4 : 0) + gauss() * 4);
      e.dbp = Math.round(76 - (day >= 1 ? 2 : 0) + gauss() * 3);
      e.spo2 = Math.round(clamp(98 + gauss() * 0.7, 94, 100));
      e.temp = round(36.7 + gauss() * 0.12, 1);
      e.weight = round(78.0 - f * 0.028 - late * 0.6 + gauss() * 0.3, 1);
      e.sleep = round(clamp(7.4 - (day >= 1 ? 0.5 : 0) - late * 1.3 + gauss() * 0.5, 3, 10), 2);
      e.aerobic = Math.round(clamp((day >= 1 ? 62 : 45) - late * 20 + gauss() * 10, 0, 120) / 5) * 5;
      e.resistance = Math.round(clamp((day >= 1 ? 60 : 40) - late * 22 + gauss() * 8, 0, 120) / 5) * 5;
      e.fluid = round(clamp(2.5 + gauss() * 0.3, 1.2, 4), 1);
      e.mood = Math.round(clamp(4.1 - late * 2.0 + gauss() * 0.5, 1, 5));
      e.stress = Math.round(clamp(2.2 + late * 1.1 + gauss() * 0.5, 1, 5));
      e.fatigue = Math.round(clamp(2.2 + late * 1.2 + gauss() * 0.5, 1, 5));
      e.pvt = Math.round(255 + late * 45 + gauss() * 12);
      e.lapses = Math.max(0, Math.round(1 + late * 3 + gauss() * 1));
      e.dose = day >= 1 ? round(0.55 + gauss() * 0.04, 2) : 0;
      // Episode: launch-week head fullness + back pain (fluid shift / spinal elongation)
      if (day >= 1 && day <= 6) { e.symptoms.push('congestion'); if (day <= 4) e.symptoms.push('back_pain'); }
      // Episode: viral reactivation + low fever around day 45
      if (day >= 44 && day <= 47) { e.temp = round(37.9 + (day === 45 ? 0.4 : 0) + gauss() * 0.1, 1); e.hr += 9; e.symptoms.push('cold_sore', 'sore_throat'); e.fatigue = 4; }
      // Episode: solar particle event, day 72–73
      if (day === 72) e.dose = 18.4;
      if (day === 73) e.dose = 4.1;
      // Late mission: headaches (CO₂) and occasional crew tension
      if (day > flightDays - 7 && (day % 2 === 0 || day === flightDays)) e.symptoms.push('headache');
      if (day > flightDays - 10 && day % 4 === 0) e.symptoms.push('conflict');
      if (day === flightDays - 1 || day === flightDays) e.symptoms.push('insomnia');
      if (day === flightDays) e.notes = 'Busy week with payload ops; skipped two ARED sessions. Feeling flat.';
      entries.push(e);
    }
    return { settings, entries };
  }

  return {
    DOMAINS, METRICS, SYMPTOMS, LEVELS, LEVEL_LABEL, DEFAULT_SETTINGS,
    evaluate, computeBaseline, buildReport, generateDemo,
    util: { mean, sd, median, slope, todayStr, addDays, diffDays, missionDay, sortEntries, fmt, isNum, round },
  };
});
