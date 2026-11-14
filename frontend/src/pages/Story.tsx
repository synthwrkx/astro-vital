// Mission story: the mission replayed day by day (no hindsight), told as chapters.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { DOMAIN_ICON } from '../components/icons'
import { useStore } from '../store'
import type { Episode, Timeline } from '../types'

const LEVEL_TEXT = { ok: 'Nominal', watch: 'Monitor', act: 'Act now' } as const

// Narrative framing for each phase (what the body is going through), shown above that chapter's events.
const PHASE_STORY: Record<string, string> = {
  'Preflight baseline': 'On Earth, before launch, daily check-ins teach AstroVital what is normal for this astronaut. Every later reading is compared with this baseline.',
  'Launch & adaptation': 'Fluids shift toward the head, the spine lengthens and sleep is disrupted. Short-lived symptoms are expected, and AstroVital tracks them until they settle.',
  'Early mission': 'The body has adapted. Countermeasures (exercise, fluids, sleep) now decide how much bone and muscle is kept.',
  'Mid mission': 'Routine sets in, and so can isolation. Deep-space hazards such as solar particle events can strike without warning.',
  'Late mission': 'Fatigue builds and mood can dip past the midpoint (the "third-quarter phenomenon"). Small, slow changes matter most here.',
}

/** An episode is a story beat if it reached Act now or lasted at least 2 days; the rest are "blips". */
const isBeat = (ep: Episode) => ep.peak_level === 'act' || ep.days >= 2

function sentence(ep: Episode) {
  const when = ep.end ? `Cleared on day ${ep.end_md} after ${ep.days} day${ep.days > 1 ? 's' : ''}.` : `Still active (${ep.days} day${ep.days > 1 ? 's' : ''} so far).`
  const detail = ep.detail === "Reported in today's check-in." ? 'Self-reported in the daily check-in.' : ep.detail
  return `${detail} ${when}`
}

export default function Story() {
  const { catalog, settings, entries } = useStore()
  const [t, setT] = useState<Timeline | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { api.timeline().then(setT, e => setError((e as Error).message)) }, [entries])

  const chapters = useMemo(() => {
    if (!t) return []
    return t.phases.map(p => {
      const inPhase = (md: number | null) => md !== null && (p.from === null || md >= p.from) && (p.to === null || md <= p.to)
      const eps = t.episodes.filter(ep => inPhase(ep.start_md))
      const days = t.ribbon.filter(r => inPhase(r.mission_day))
      return { ...p, beats: eps.filter(isBeat), blips: eps.filter(ep => !isBeat(ep)), days }
    }).filter(c => c.days.length > 0)
  }, [t])

  if (!catalog || !settings) return null
  if (error) return <p className="error-text">{error}</p>
  if (!entries.length) return <div className="card welcome"><h1>No story yet.</h1><p>Record check-ins or load the demo mission from the Dashboard.</p></div>
  if (!t) return <p className="muted">Replaying the mission…</p>

  const prof = catalog.profiles[settings.mission_profile]
  const s = t.summary
  return (
    <>
      <section className="welcome-row">
        <div style={{ flex: 1, minWidth: 300 }}>
          <h1 className="page-title">Mission story</h1>
          <p className="muted" style={{ maxWidth: 640, marginTop: -8 }}>
            {settings.crew_name}'s mission ({prof?.name}), replayed day by day. Each day is judged only on what was known
            that day, exactly as the onboard system saw it, with no hindsight.
          </p>
        </div>
        <div className="big-stats">
          <div className="big-stat"><span className="num">{s.days}</span><span className="cap">Days monitored</span></div>
          <div className="big-stat"><span className="num">{s.episodes}</span><span className="cap">Changes caught</span></div>
          <div className="big-stat"><span className="num">{s.resolved}</span><span className="cap">Resolved</span></div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <h2>Status, every day of the mission</h2>
          <div className="mini-stats">
            {(['ok', 'watch', 'act'] as const).map(l => <span key={l} className="mini-stat"><i className={`rib-key ${l}`} />{LEVEL_TEXT[l]} <b>{s.days_by_level[l]}</b> d</span>)}
          </div>
        </div>
        <div className="ribbon" role="img" aria-label={`${s.days_by_level.ok} nominal, ${s.days_by_level.watch} monitor and ${s.days_by_level.act} act-now days`}>
          {t.ribbon.map(r => <span key={r.date} className={`rib ${r.level}`} title={`${r.date} · day ${r.mission_day}: ${LEVEL_TEXT[r.level]} (${r.findings} findings)`} />)}
        </div>
        <div className="ribbon-phases">
          {chapters.map(c => <span key={c.name} style={{ flex: c.days.length }}>{c.name}</span>)}
        </div>
      </section>

      <div className="chapters">
        {chapters.map((c, ci) => (
          <section key={c.name} className={`card chapter${c.beats.some(b => b.peak_level === 'act') ? ' has-act' : ''}`}>
            <div className="chapter-num">{String(ci + 1).padStart(2, '0')}</div>
            <div className="chapter-body">
              <div className="card-head" style={{ marginBottom: 6 }}>
                <h2>{c.name}</h2>
                <span className="mini-stat">{c.from === null ? 'Preflight' : `Days ${c.from}–${c.to ?? c.days[c.days.length - 1].mission_day}`}</span>
              </div>
              <p className="muted">{PHASE_STORY[c.name]}</p>
              {c.beats.length === 0 && <p className="ok-text small">All quiet: everything stayed within baseline.</p>}
              <ol className="beats">
                {c.beats.map(ep => {
                  const Icon = DOMAIN_ICON[ep.domain]
                  return (
                    <li key={ep.key + ep.start} className={`beat ${ep.peak_level}`}>
                      <span className="beat-day">Day {ep.start_md}</span>
                      <span className="beat-ico"><Icon size={16} /></span>
                      <div>
                        <b>{ep.title}</b> <span className={`lvl-chip ${ep.peak_level}`}>{LEVEL_TEXT[ep.peak_level]}</span>
                        {ep.escalate && <span className="surgeon-chip" style={{ marginLeft: 6 }}>Surgeon notified</span>}
                        <p>{sentence(ep)}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
              {c.blips.length > 0 && <p className="muted small">+ {c.blips.length} one-day blip{c.blips.length > 1 ? 's' : ''} that cleared on their own ({[...new Set(c.blips.map(b => b.title))].slice(0, 3).join(', ')}{c.blips.length > 3 ? '…' : ''})</p>}
            </div>
          </section>
        ))}
      </div>

      <section className="card dark" style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>{prof?.kind === 'space' ? `Earth link: ${prof.delay}.` : 'Help is far away.'}</h2>
          <p className="muted" style={{ margin: 0 }}>{prof?.support} AstroVital caught every change above onboard, without waiting for the ground.</p>
        </div>
        <Link to="/" className="btn yellow">Back to today</Link>
      </section>
    </>
  )
}
