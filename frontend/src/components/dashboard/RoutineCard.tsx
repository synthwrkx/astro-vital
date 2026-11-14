import { Link } from 'react-router-dom'
import { useRoutine } from '../../hooks/useRoutine'
import { Check, Flame } from '../icons'

const R = 30, C = 2 * Math.PI * R

/** Compact "today's routine" with score ring and streak; links to the full Routine page. */
export function RoutineCard() {
  const r = useRoutine()
  if (!r) return <section className="card"><h2>Today's routine</h2><p className="muted small">Loading…</p></section>
  const due = r.tasks.filter(t => !t.done)
  return (
    <section className="card dark routine-card">
      <div className="card-head" style={{ marginBottom: 10 }}>
        <h2>Today's routine</h2>
        <Link to="/routine" className="circle-btn white" aria-label="Open routine" style={{ color: 'var(--ink)' }}>↗</Link>
      </div>
      <div className="rc-top">
        <svg viewBox="0 0 72 72" width="72" height="72" role="img" aria-label={`${r.score}% of today's routine done`}>
          <circle cx="36" cy="36" r={R} fill="none" stroke="var(--ink-2)" strokeWidth="7" />
          <circle cx="36" cy="36" r={R} fill="none" stroke="var(--yellow)" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${(r.score / 100) * C} ${C}`} transform="rotate(-90 36 36)" className="rc-ring" />
          <text x="36" y="41" textAnchor="middle" fill="var(--on-ink)" fontSize="15">{r.done}/{r.total}</text>
        </svg>
        <div>
          <div className="rc-streak"><Flame size={18} /> {r.streak}-day streak</div>
          <div className="muted small">Level {r.level} · {r.xp} XP</div>
        </div>
      </div>
      <ul className="rc-list">
        {due.slice(0, 4).map(t => (
          <li key={t.id}><span className="rc-box" /><span>{t.title}</span><span className="muted small">{t.when}</span></li>
        ))}
        {due.length === 0 && <li><span className="rc-box done"><Check size={12} /></span><span>All done for today 🎉</span></li>}
      </ul>
      {due.length > 4 && <p className="muted small" style={{ margin: '6px 0 0' }}>+{due.length - 4} more</p>}
    </section>
  )
}
