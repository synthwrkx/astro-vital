// Pure formatting / date helpers shared across pages.
import type { Settings } from '../types'

export const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Mission day for a date: launch day = 1, preflight days are ≤ 0. */
export const missionDay = (date: string, s: Settings | null) =>
  s?.mission_start ? Math.round((Date.parse(date) - Date.parse(s.mission_start)) / 86400000) + 1 : null

export const fmt = (v: number | null | undefined, dec = 0) => (typeof v === 'number' && isFinite(v) ? v.toFixed(dec) : '—')
