import { Link } from 'react-router-dom'
import { useStore } from '../../store'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_LANES = 5
const dow = (date: string) => DOW[new Date(date + 'T12:00').getDay()]

interface Block { start: number; end: number }

/** Consecutive days carrying the symptom, merged into spans (like multi-day calendar events). */
function spans(flags: boolean[]): Block[] {
  const out: Block[] = []
  let start = -1
  flags.forEach((on, i) => {
    if (on && start < 0) start = i
    if ((!on || i === flags.length - 1) && start >= 0) { out.push({ start, end: on ? i : i - 1 }); start = -1 }
  })
  return out
}

/** Calendar-style week: one lane per reported symptom, episodes drawn as blocks across days. */
export function WeekCard() {
  const { entries, catalog } = useStore()
  if (!catalog) return null
  const week = entries.slice(-7)
  const cols = Math.max(1, week.length)
  const grid = { gridTemplateColumns: `150px repeat(${cols}, 1fr)` }

  const counts = new Map<string, number>()
  week.forEach(e => e.symptoms.forEach(s => counts.set(s, (counts.get(s) || 0) + 1)))
  const lanes = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_LANES)
  const sym = new Map(catalog.symptoms.map(s => [s.id, s]))
  const month = week.length ? new Date(week[week.length - 1].date + 'T12:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : ''

  return (
    <section className="card span-2">
      <div className="week-head">
        <span className="mini-stat">Symptoms · last 7 days</span>
        <h2>{month}</h2>
        <Link to="/checkin" className="mini-stat" style={{ textDecoration: 'none' }}>+ Log today</Link>
      </div>
      <div className="week-cols" style={grid}>
        <div />
        {week.map((e, i) => {
          const d = new Date(e.date + 'T12:00')
          return <div key={e.date} className={`day${i === week.length - 1 ? ' today' : ''}`}>{DOW[d.getDay()]}<br />{d.getDate()}</div>
        })}
      </div>
      <div className="week-body" style={grid}>
        <div className="week-lines" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {week.map(e => <span key={e.date} />)}
        </div>
        {lanes.length === 0 && <div className="week-empty">No symptoms reported this week</div>}
        {lanes.map(([sid, total], row) => {
          const s = sym.get(sid)!
          return [
            <div key={sid} className="lane-label" style={{ gridRow: row + 1 }} title={s.label}>{s.label}</div>,
            ...spans(week.map(e => e.symptoms.includes(sid))).map(b => {
              const days = b.end - b.start + 1
              const tone = s.level === 'act' || total >= 3 ? 'dark' : days >= 2 ? 'yellow' : 'light'
              return (
                <div key={`${sid}-${b.start}`} className={`event ${tone}${days === 1 ? ' single' : ''}`} title={`${s.label} · ${catalog.domains[s.domain].name}: ${days} day${days > 1 ? 's' : ''}`}
                  style={{ gridColumn: `${b.start + 2} / ${b.end + 3}`, gridRow: row + 1 }}>
                  <b>{days > 1 ? `${days} days` : '1d'}</b>
                  {days > 1 && <span>{dow(week[b.start].date)} – {dow(week[b.end].date)}</span>}
                </div>
              )
            }),
          ]
        })}
      </div>
      {counts.size > MAX_LANES && <p className="muted small" style={{ marginBottom: 0 }}>+{counts.size - MAX_LANES} more symptom(s) this week</p>}
    </section>
  )
}
