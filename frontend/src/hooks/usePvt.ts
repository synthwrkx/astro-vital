// Psychomotor Vigilance Test state machine, isolated from the UI (single responsibility).
// idle → waiting (random 2–10 s) → stimulus (counter running) → waiting … → done
import { useCallback, useEffect, useRef, useState } from 'react'

export type PvtPhase = 'idle' | 'waiting' | 'stimulus' | 'done'
export interface PvtResult { n: number; median: number; lapses: number; fast: number; falseStarts: number }

const LAPSE_MS = 500
const TIMEOUT_MS = 30000

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function score(rts: number[], falseStarts: number): PvtResult | null {
  if (rts.length < 3) return null
  const sorted = [...rts].sort((a, b) => a - b)
  const fastN = Math.max(1, Math.round(rts.length * 0.1))
  return {
    n: rts.length,
    median: Math.round(median(rts)),
    lapses: rts.filter(r => r > LAPSE_MS).length,
    fast: Math.round(sorted.slice(0, fastN).reduce((a, b) => a + b, 0) / fastN),
    falseStarts,
  }
}

export function usePvt() {
  const [phase, setPhase] = useState<PvtPhase>('idle')
  const [elapsed, setElapsed] = useState(0)          // ms shown on the counter
  const [lastRt, setLastRt] = useState<number | null>(null)
  const [responses, setResponses] = useState(0)
  const [falseFlash, setFalseFlash] = useState(false)
  const [result, setResult] = useState<PvtResult | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)

  const r = useRef({ rts: [] as number[], falseStarts: 0, shownAt: 0, endAt: 0, timer: 0, raf: 0 })
  const respondRef = useRef<() => void>(() => {})

  const clear = () => { clearTimeout(r.current.timer); cancelAnimationFrame(r.current.raf) }

  const finish = useCallback(() => {
    clear()
    setPhase('done')
    setResult(score(r.current.rts, r.current.falseStarts))
  }, [])

  const schedule = useCallback(() => {
    const isi = 2000 + Math.random() * 8000
    const now = performance.now()
    setSecondsLeft(Math.max(0, Math.round((r.current.endAt - now) / 1000)))
    if (now + isi > r.current.endAt) { r.current.timer = window.setTimeout(finish, Math.max(0, r.current.endAt - now)); return }
    setPhase('waiting')
    r.current.timer = window.setTimeout(() => {
      r.current.shownAt = performance.now()
      setPhase('stimulus')
      const tick = () => { setElapsed(performance.now() - r.current.shownAt); r.current.raf = requestAnimationFrame(tick) }
      tick()
      r.current.timer = window.setTimeout(() => respondRef.current(), TIMEOUT_MS) // no response → counts as a lapse
    }, isi)
  }, [finish])

  const respond = useCallback(() => {
    const s = r.current
    if (!s.endAt) return
    if (!s.shownAt) {
      s.falseStarts++
      setFalseFlash(true); setTimeout(() => setFalseFlash(false), 250)
      return
    }
    const rt = performance.now() - s.shownAt
    s.shownAt = 0
    clear()
    s.rts.push(rt)
    setLastRt(rt); setResponses(s.rts.length)
    schedule()
  }, [schedule])
  respondRef.current = respond

  const start = useCallback((durationSec: number) => {
    clear()
    r.current = { rts: [], falseStarts: 0, shownAt: 0, endAt: performance.now() + durationSec * 1000, timer: 0, raf: 0 }
    setResult(null); setResponses(0); setLastRt(null)
    schedule()
  }, [schedule])

  const stop = useCallback(() => { clear(); r.current.endAt = 0; r.current.shownAt = 0; setPhase('idle') }, [])

  useEffect(() => () => clear(), [])

  return { phase, elapsed, lastRt, responses, falseFlash, result, secondsLeft, start, respond, stop, running: phase === 'waiting' || phase === 'stimulus' }
}
