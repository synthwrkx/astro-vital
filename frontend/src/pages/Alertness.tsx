import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { usePvt } from '../hooks/usePvt'
import { todayStr } from '../lib/format'
import { useStore } from '../store'

const DURATIONS = [[60, '1 min (quick)'], [180, '3 min (standard)'], [300, '5 min']] as const

export default function Alertness() {
  const { refresh, toast } = useStore()
  const nav = useNavigate()
  const pvt = usePvt()
  const [duration, setDuration] = useState(180)

  useEffect(() => {
    if (!pvt.running) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) pvt.respond() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pvt.running, pvt.respond]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!pvt.result) return
    await api.patchEntry(todayStr(), { pvt: pvt.result.median, lapses: pvt.result.lapses })
    await refresh()
    toast("Alertness result saved to today's check-in.")
    nav(`/checkin/${todayStr()}`)
  }

  const res = pvt.result
  return (
    <>
    <h1 className="page-title">Alertness test</h1>
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Alertness test (PVT)</h2>
          <div className="muted small">
            A psychomotor vigilance test, the standard spaceflight measure of fatigue-related attention loss. When the yellow counter
            appears, tap the box or press <b>Space</b> as fast as you can. Responses over 500 ms count as lapses.
          </div>
        </div>
        <div className="btn-row">
          <select value={duration} onChange={e => setDuration(Number(e.target.value))} disabled={pvt.running} aria-label="Duration">
            {DURATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {pvt.running
            ? <button className="btn" onClick={pvt.stop}>Stop</button>
            : <button className="btn primary" onClick={() => pvt.start(duration)}>Start test</button>}
        </div>
      </div>

      <div className={`pvt-area${pvt.falseFlash ? ' false-start' : ''}`} role="button" tabIndex={0}
        onPointerDown={e => { if (pvt.running) { e.preventDefault(); pvt.respond() } }}>
        {pvt.phase === 'stimulus' ? <div className="counter">{Math.round(pvt.elapsed)}</div>
          : pvt.phase === 'waiting' ? <>
              {pvt.lastRt !== null && <div className="counter dim">{Math.round(pvt.lastRt)}</div>}
              <div>Wait for the counter…</div>
            </>
          : pvt.phase === 'done' && !res ? <div>Too few responses to score. Try a longer test.</div>
          : <div>Press Start, then focus here.</div>}
        {pvt.running && <div className="muted small">{pvt.responses} responses · ~{pvt.secondsLeft}s left</div>}
      </div>

      {res && (
        <>
          <div className="kv pvt-stats">
            <div><span>Median RT</span><b>{res.median} ms</b></div>
            <div><span>Lapses (&gt;500 ms)</span><b>{res.lapses}</b></div>
            <div><span>Fastest 10%</span><b>{res.fast} ms</b></div>
            <div><span>False starts</span><b>{res.falseStarts}</b></div>
            <div><span>Responses</span><b>{res.n}</b></div>
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}><button className="btn primary" onClick={save}>Save to today's check-in</button></div>
        </>
      )}
    </section>
    </>
  )
}
