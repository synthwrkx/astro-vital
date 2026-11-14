// Shapes returned by the FastAPI backend (see backend/app/main.py).

export type Level = 'ok' | 'watch' | 'act'

export const METRIC_KEYS = [
  'hr', 'sbp', 'dbp', 'spo2', 'temp', 'weight', 'sleep', 'aerobic', 'resistance',
  'fluid', 'mood', 'stress', 'fatigue', 'pvt', 'lapses', 'dose', 'glucose', 'calories', 'protein',
] as const
export type MetricKey = (typeof METRIC_KEYS)[number]

export interface MetricDef {
  label: string; short: string; unit: string
  min: number; max: number; step: number; min_sd: number; dec: number
}
export interface Symptom { id: string; label: string; domain: string; level: Level }
export interface Domain { name: string; blurb: string }

export interface MissionProfile {
  name: string; kind: 'space' | 'earth_analog'; dose_msv_day: number; dose_note: string; dose_source: string
  delay: string; delay_s: number; gravity_g: number; support: string
}

export interface Catalog {
  metrics: Record<MetricKey, MetricDef>
  symptoms: Symptom[]
  domains: Record<string, Domain>
  levels: Record<Level, string>
  profiles: Record<string, MissionProfile>
  guides: Record<MetricKey, MetricGuide>
  hazards: Hazard[]
  sources: Record<string, Source>
}

export interface MetricGuide { device: string; when: string; how: string; why: string; escalate: string }
export interface Source { title: string; org: string; url: string }
export interface Hazard {
  id: string; letter: string; name: string; summary: string; facts: string[]; monitors: string
  domains: string[]; risks: string[]; sources: string[]
}

export interface RoutineTask { id: string; title: string; when: string; how: string; metrics: MetricKey[]; link?: string; done: boolean; space_only?: boolean }
export interface Badge { id: string; title: string; desc: string; earned: boolean; progress: number; goal: number }
export interface Routine {
  today: string; mission_day: number | null; tasks: RoutineTask[]; done: number; total: number; score: number
  streak: number; best_streak: number; xp: number; level: number; level_progress: number; badges: Badge[]
}
export interface Photo { id: number; date: string; tag: string; note: string | null; mime: string; bytes: number; created: string }

export type Entry = { date: string; symptoms: string[]; notes?: string } & Partial<Record<MetricKey, number>>

export interface Settings {
  crew_name: string
  mission_start: string | null
  mission_length: number
  prior_career_dose: number
  career_limit: number
  aerobic_target: number
  resistance_target: number
  fluid_target: number
  mission_profile: string
  calorie_target: number
}

export interface Finding {
  domain: string; level: Level; title: string; detail: string; actions: string[]; escalate: boolean; evidence: string
}

export interface BaselineStat { mean: number; sd: number; median: number; n: number }

export interface Evaluation {
  overall: Level
  overall_label: string
  findings: Finding[]
  domains: Record<string, { level: Level; findings: Finding[] }>
  latest: Entry | null
  mission_day: number | null
  baseline: { metrics: Partial<Record<MetricKey, BaselineStat>>; n: number; source: string }
  radiation: null | {
    mission_dose: number; career: number; rate: number; projected: number; pct: number; limit: number; prior: number; expected_rate: number
  }
  drift: { key: MetricKey; recent: number; baseline: number; z: number }[]
}

export interface Briefing {
  headline: string
  summary: string
  priorities: { title: string; why: string; action: string; urgency: 'now' | 'today' | 'this_week' | 'keep_monitoring' }[]
  going_well: string[]
  contact_flight_surgeon: boolean
  contact_reason: string
  forecasts: string[]
  anomaly_note: string
}

export interface AiStatus { enabled: boolean; model: string; version: string; offline: boolean; reason: string }

export type CheckinDraft = Partial<Record<MetricKey, number | null>> & {
  symptoms: string[]; notes?: string | null; unclear: string[]
}

export interface Episode {
  key: string; domain: string; title: string; level: Level; peak_level: Level; escalate: boolean
  start: string; start_md: number | null; end: string | null; end_md: number | null; days: number; detail: string
}

export interface Timeline {
  ribbon: { date: string; mission_day: number | null; level: Level; findings: number }[]
  episodes: Episode[]
  summary: { days: number; days_by_level: Record<Level, number>; episodes: number; act_episodes: number; resolved: number; open: number }
  phases: { name: string; from: number | null; to: number | null }[]
}

export interface ChatMessage { role: 'user' | 'assistant'; content: string; sources?: string[] }
