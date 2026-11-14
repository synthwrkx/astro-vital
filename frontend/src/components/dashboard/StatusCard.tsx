import { Link } from 'react-router-dom'
import { todayStr } from '../../lib/format'
import { useStore } from '../../store'

/** The large tinted "portrait" card: overall status at a glance. */
export function StatusCard() {
  const { status, settings } = useStore()
  if (!status?.latest || !settings) return null
  const nAct = status.findings.filter(f => f.level === 'act').length
  const n = status.findings.length
  const headline = status.overall === 'ok' ? 'All indicators are within your personal baseline.'
    : status.overall === 'act' ? `${nAct} item${nAct > 1 ? 's need' : ' needs'} action today · ${n} total`
    : `${n} slow change${n > 1 ? 's' : ''} to keep an eye on`
  const stale = Math.round((Date.parse(todayStr()) - Date.parse(status.latest.date)) / 86400000)
  return (
    <section className={`card status-card ${status.overall}`} aria-label="Overall status">
      <div className="planet" /><div className="orbit" />
      <div>
        <div className="lead">Overall status</div>
        <div className="level">{status.overall_label}</div>
        <div className="headline">{headline}</div>
      </div>
      <div className="foot-row">
        <div className="who">
          {settings.crew_name}
          <small>Mission day {status.mission_day} · checked in {stale > 0 ? `${stale}d ago` : 'today'}</small>
        </div>
        <Link to="/checkin" className="btn ghost-light">Check in</Link>
      </div>
    </section>
  )
}
