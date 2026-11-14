// Mission routine + gamification: tasks complete automatically from check-ins; streaks, XP and badges reward consistency.
import { Link } from 'react-router-dom'
import { Check, Flame, Trophy } from '../components/icons'
import { useRoutine } from '../hooks/useRoutine'
import { useStore } from '../store'

export default function Routine() {
  const r = useRoutine()
  const { catalog } = useStore()
  if (!r || !catalog) return <p className="muted">Loading routine…</p>
  const earned = r.badges.filter(b => b.earned).length

  return (
    <>
      <section className="welcome-row">
        <div style={{ flex: 1, minWidth: 300 }}>
          <h1 className="page-title">Routine</h1>
          <p className="muted" style={{ maxWidth: 620, marginTop: -8 }}>
            Your daily mission health routine. Tasks tick off automatically when you log the measurement in your check-in,
            so there's nothing extra to do. Consistency builds streaks, XP and badges.
          </p>
        </div>
        <div className="big-stats">
          <div className="big-stat"><span className="ico"><Flame size={15} /></span><span className="num">{r.streak}</span><span className="cap">Day streak</span></div>
          <div className="big-stat"><span className="ico"><Check size={15} /></span><span className="num">{r.score}%</span><span className="cap">Today</span></div>
          <div className="big-stat"><span className="ico"><Trophy size={15} /></span><span className="num">{earned}</span><span className="cap">Badges</span></div>
        </div>
      </section>

      <div className="grid routine-grid">
        <section className="card">
          <div className="card-head">
            <h2>Today · {r.done}/{r.total} done</h2>
            <Link to="/checkin" className="btn primary">Open check-in</Link>
          </div>
          <ol className="routine-list">
            {r.tasks.map(t => (
              <li key={t.id} className={t.done ? 'done' : ''}>
                <span className="rc-box">{t.done && <Check size={13} />}</span>
                <div className="rl-body">
                  <div className="rl-head"><b>{t.title}</b><span className="mini-stat">{t.when}</span></div>
                  <p className="muted small">{t.how}</p>
                  {!t.done && t.metrics[0] && catalog.guides[t.metrics[0]] && (
                    <p className="small rl-guide"><b>How:</b> {catalog.guides[t.metrics[0]].how}</p>
                  )}
                </div>
                {!t.done && <Link className="btn" to={t.link || '/checkin'}>{t.link ? 'Start' : 'Log'}</Link>}
              </li>
            ))}
          </ol>
        </section>

        <div className="stack">
          <section className="card dark">
            <div className="task-head"><h3>Level {r.level}</h3><span className="count">{r.xp} XP</span></div>
            <div className="xp-bar" role="img" aria-label={`${Math.round(r.level_progress * 100)}% to level ${r.level + 1}`}>
              <span style={{ width: `${r.level_progress * 100}%` }} />
            </div>
            <p className="muted small" style={{ marginBottom: 0 }}>10 XP for each completed routine task. Best streak: {r.best_streak} days.</p>
          </section>

          <section className="card">
            <div className="card-head"><h2>Badges</h2><span className="mini-stat">{earned}/{r.badges.length}</span></div>
            <div className="badges">
              {r.badges.map(b => (
                <div key={b.id} className={`badge-tile${b.earned ? ' earned' : ''}`} title={b.desc}>
                  <span className="badge-ico"><Trophy size={18} /></span>
                  <b>{b.title}</b>
                  <span className="muted small">{b.desc}</span>
                  {!b.earned && <span className="badge-prog"><span style={{ width: `${(b.progress / b.goal) * 100}%` }} /></span>}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      <p className="muted small" style={{ marginTop: 14 }}>
        Rewards are for logging consistently, never for "good" numbers, so there's no reason to hide symptoms. Honest data keeps you safe.
      </p>
    </>
  )
}
