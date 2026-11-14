import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmt } from '../../lib/format'
import { useStore } from '../../store'
import type { MetricKey } from '../../types'
import { ChevronDown } from '../icons'

const GROUPS: { title: string; keys: MetricKey[] }[] = [
  { title: 'Vitals', keys: ['hr', 'sbp', 'spo2', 'temp'] },
  { title: 'Countermeasures', keys: ['resistance', 'aerobic', 'fluid'] },
  { title: 'Nutrition & metabolism', keys: ['glucose', 'calories', 'protein', 'weight'] },
  { title: 'Wellbeing', keys: ['mood', 'stress', 'fatigue'] },
  { title: 'Alertness', keys: ['pvt', 'lapses'] },
]

/** Accordion of latest readings vs. personal baseline. */
export function ReadingsCard() {
  const { status, catalog } = useStore()
  const nav = useNavigate()
  const [open, setOpen] = useState(0)
  if (!status?.latest || !catalog) return null
  const latest = status.latest

  return (
    <section className="card">
      <div className="card-head" style={{ marginBottom: 0 }}><h2>Latest readings</h2></div>
      {GROUPS.map((g, gi) => {
        const flagged = g.keys.some(k => {
          const b = status.baseline.metrics[k], v = latest[k]
          return b && typeof v === 'number' && Math.abs((v - b.mean) / b.sd) >= 2
        })
        return (
          <div key={g.title} className={`acc-item${open === gi ? ' open' : ''}`}>
            <button className="acc-btn" aria-expanded={open === gi} onClick={() => setOpen(open === gi ? -1 : gi)}>
              <span>{g.title}{flagged && <span className="acc-flag" title="A reading is ≥2σ from baseline">●</span>}</span>
              <ChevronDown />
            </button>
            {open === gi && (
              <div className="acc-body">
                {g.keys.map(k => {
                  const m = catalog.metrics[k], v = latest[k], b = status.baseline.metrics[k]
                  const z = b && typeof v === 'number' ? (v - b.mean) / b.sd : null
                  return (
                    <button key={k} className="acc-row" onClick={() => nav(`/trends/${k}`)}>
                      <span className="lbl">{m.label}<small>{b ? `baseline ${b.mean.toFixed(m.dec)}` : 'no baseline'}</small></span>
                      <span className="val">{k === 'sbp' && typeof v === 'number' ? `${v}/${fmt(latest.dbp)}` : fmt(v, m.dec)}<small>{m.unit}</small></span>
                      <span className={`val small ${z !== null && Math.abs(z) >= 2 ? 'flag' : 'muted'}`}>{z === null ? '' : `${z >= 0 ? '+' : ''}${z.toFixed(1)}σ`}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
