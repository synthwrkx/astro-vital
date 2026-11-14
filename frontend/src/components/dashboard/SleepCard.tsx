import { Link } from 'react-router-dom'
import { useStore } from '../../store'
import { ArrowUpRight } from '../icons'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MAX_H = 10
const STICK_PX = 140          // stick height for MAX_H hours
const BELOW_PX = 17           // dot (9px) + gap (8px) under each stick
const CHART_PX = 190
const TARGET_H = 6.5

const hm = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}m`

/** Last 7 nights as rounded sticks with dots; today highlighted in yellow. */
export function SleepCard() {
  const { entries } = useStore()
  const last = entries.slice(-7)
  const vals = last.map(e => e.sleep).filter((v): v is number => typeof v === 'number')
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  const cols = Array.from({ length: 7 }, (_, i) => last[i - (7 - last.length)])

  return (
    <section className="card">
      <div className="card-head">
        <h2>Sleep</h2>
        <Link to="/trends/sleep" className="circle-btn white" aria-label="Sleep trend"><ArrowUpRight /></Link>
      </div>
      <div className="metric-hero">
        <span className="num">{avg === null ? '—' : `${avg.toFixed(1)} h`}</span>
        <span className="cap muted">Average sleep<br />this week</span>
      </div>
      <div className="dotbars" style={{ ['--guide' as string]: `${CHART_PX - BELOW_PX - (TARGET_H / MAX_H) * STICK_PX}px` }}
        role="img" aria-label={`Sleep per night: ${last.map(e => `${e.date} ${e.sleep ?? 'no data'} h`).join(', ')}`}>
        {cols.map((e, i) => {
          const v = e?.sleep
          const isLast = i === 6 && typeof v === 'number'
          const cls = typeof v !== 'number' ? 'empty' : isLast ? 'hl' : v < TARGET_H ? 'low' : ''
          return (
            <div key={i} className={`dotbar ${cls}`} title={e ? `${e.date}: ${typeof v === 'number' ? hm(v) : 'no data'}` : ''}>
              {isLast && <span className="flag" style={{ bottom: BELOW_PX + (v / MAX_H) * STICK_PX + 8 }}>{hm(v)}</span>}
              <div className="stick" style={{ height: `${typeof v === 'number' ? Math.max(6, (v / MAX_H) * STICK_PX) : 60}px` }} />
              <div className="dot" />
            </div>
          )
        })}
      </div>
      <div className="dotbars-x">{cols.map((e, i) => <span key={i}>{e ? DOW[new Date(e.date + 'T12:00').getDay()] : '·'}</span>)}</div>
      <div className="legend"><span><i style={{ borderTop: '2px dotted var(--border-strong)', height: 0 }} />{TARGET_H} h minimum</span><span><i style={{ background: 'var(--watch)' }} />below minimum</span></div>
    </section>
  )
}
