import { Link } from 'react-router-dom'
import { useStore } from '../../store'
import { ArrowUpRight, Atom } from '../icons'

const R = 92, C = 2 * Math.PI * R

/** SVG arc along the ring from a% to b% (clockwise from 12 o'clock). */
function arc(a: number, b: number) {
  const pt = (p: number) => {
    const t = (p / 100) * 2 * Math.PI - Math.PI / 2
    return `${110 + Math.cos(t) * R} ${110 + Math.sin(t) * R}`
  }
  return `M ${pt(a)} A ${R} ${R} 0 ${b - a > 50 ? 1 : 0} 1 ${pt(b)}`
}

/** Ring gauge: career dose as a share of the limit, with tick marks for the remainder. */
export function RadiationCard() {
  const { status, catalog, settings } = useStore()
  const prof = catalog && settings ? catalog.profiles[settings.mission_profile] : null
  const rad = status?.radiation
  const pct = rad ? Math.min(100, rad.pct) : 0
  const ticks = Array.from({ length: 60 }, (_, i) => i)
  return (
    <section className="card">
      <div className="card-head">
        <h2>Radiation</h2>
        <Link to="/trends/dose" className="circle-btn white" aria-label="Dose trend"><ArrowUpRight /></Link>
      </div>
      <div className="ring-wrap" role="img" aria-label={rad ? `Career dose ${rad.career.toFixed(0)} of ${rad.limit} mSv` : 'No dosimetry'}>
        <svg viewBox="0 0 220 220">
          {ticks.map(i => {
            const a = (i / 60) * 2 * Math.PI - Math.PI / 2
            const on = i / 60 < pct / 100
            return !on && <line key={i} x1={110 + Math.cos(a) * 80} y1={110 + Math.sin(a) * 80} x2={110 + Math.cos(a) * 86} y2={110 + Math.sin(a) * 86}
              stroke="var(--faint)" strokeWidth="1.5" strokeLinecap="round" />
          })}
          <circle cx="110" cy="110" r={R} fill="none" stroke="var(--yellow)" strokeWidth="14" strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * C} ${C}`} transform="rotate(-90 110 110)" />
          {rad && rad.projected > rad.career && (
            <path d={arc(pct, Math.min(99.9, (rad.projected / rad.limit) * 100))} fill="none" stroke="var(--ink)"
              strokeWidth="3" strokeDasharray="1 7" strokeLinecap="round" />
          )}
        </svg>
        <div className="ring-center">
          <div className="num">{rad ? `${rad.pct.toFixed(0)}%` : '—'}</div>
          <div className="muted small">of career limit</div>
        </div>
      </div>
      {prof && prof.dose_msv_day > 0 && (
        <p className="muted small" style={{ margin: '10px 0 0', textAlign: 'center' }} title={prof.dose_note}>
          Expected for {prof.name}: <b>{prof.dose_msv_day} mSv/day</b> · {prof.dose_source.split(';')[0]}
        </p>
      )}
      <div className="ring-foot">
        <div className="mini-stats">
          {rad && <>
            <span className="mini-stat"><b>{rad.career.toFixed(0)}</b>/{rad.limit} mSv</span>
            <span className="mini-stat"><b>{rad.rate.toFixed(2)}</b> mSv/day</span>
            <span className="mini-stat">⋯ projected <b>{rad.projected.toFixed(0)}</b></span>
          </>}
        </div>
        <Link to="/trends/dose" className="circle-btn dark" aria-label="Radiation details"><Atom /></Link>
      </div>
    </section>
  )
}
