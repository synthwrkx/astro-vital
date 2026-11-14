import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { AiBriefingCard } from '../components/dashboard/AiBriefingCard'
import { BodyMapCard } from '../components/dashboard/BodyMapCard'
import { RoutineCard } from '../components/dashboard/RoutineCard'
import { DomainModal } from '../components/dashboard/DomainModal'
import { DomainsCard } from '../components/dashboard/DomainsCard'
import { RadiationCard } from '../components/dashboard/RadiationCard'
import { ReadingsCard } from '../components/dashboard/ReadingsCard'
import { ReportModal, type ReportKind } from '../components/dashboard/ReportModal'
import { SleepCard } from '../components/dashboard/SleepCard'
import { StatusCard } from '../components/dashboard/StatusCard'
import { WeekCard } from '../components/dashboard/WeekCard'
import { Doc, Heart, Sparkle, User } from '../components/icons'
import { useStore } from '../store'

export default function Dashboard() {
  const { status, catalog, settings, entries, ai, refresh, toast } = useStore()
  const [domain, setDomain] = useState<string | null>(null)
  const [report, setReport] = useState<ReportKind | null>(null)

  if (!status || !catalog || !settings) return null

  if (!status.latest) {
    return (
      <div className="card welcome">
        <h1>Your health, your baseline.</h1>
        <p>
          AstroVital learns what's normal <em>for you</em> from preflight check-ins, then flags drift in cardiovascular,
          bone &amp; muscle, immune, behavioral, radiation and environmental indicators, with clear actions you can take on board.
        </p>
        <div className="btn-row">
          <Link className="btn primary" to="/checkin">Start first check-in</Link>
          <button className="btn yellow" onClick={async () => { await api.loadDemo(); await refresh(); toast('Demo mission loaded: 14 preflight + 124 flight days.') }}>
            Load demo mission (124 days)
          </button>
        </div>
      </div>
    )
  }

  const firstName = settings.crew_name.split(/\s+/)[0]
  const md = Math.max(0, status.mission_day ?? 0)
  const len = settings.mission_length
  const flownPct = Math.min(100, Math.round((md / len) * 100))
  const preflightDays = entries.filter(e => settings.mission_start && e.date < settings.mission_start).length
  const daysLeft = Math.max(0, len - md)
  const profile = catalog.profiles[settings.mission_profile]

  return (
    <>
      <section className="welcome-row">
        <div style={{ flex: 1, minWidth: 300 }}>
          <h1 className="page-title">Welcome back, {firstName}</h1>
          {profile && (
            <div className="profile-chips">
              <span className="mini-stat dark">{profile.name}</span>
              <span className="mini-stat">Earth link <b>{profile.delay}</b></span>
              <span className="mini-stat">Gravity <b>{profile.gravity_g} g</b></span>
              <Link to="/story" className="mini-stat" style={{ textDecoration: 'none' }}>Mission story ↗</Link>
            </div>
          )}
          <div className="mission-bar" aria-label="Mission progress">
            <div className="mb-seg"><span className="lbl">Preflight</span><div className="bar ink">{preflightDays}d</div></div>
            <div className="mb-seg" style={{ flex: Math.max(flownPct, 12) }}><span className="lbl">Flown</span><div className="bar yellow">{flownPct}%</div></div>
            <div className="mb-seg" style={{ flex: Math.max(100 - flownPct, 12) }}><span className="lbl">Remaining</span><div className="bar hatch">{100 - flownPct}%</div></div>
            <div className="mb-seg opt"><span className="lbl">Career dose</span><div className="bar outline">{status.radiation ? `${status.radiation.pct.toFixed(0)}%` : '—'}</div></div>
          </div>
        </div>
        <div className="big-stats">
          <div className="big-stat"><span className="ico"><User size={15} /></span><span className="num">{md}</span><span className="cap">Mission day</span></div>
          <div className="big-stat"><span className="ico"><Heart size={15} /></span><span className="num">{status.findings.length}</span><span className="cap">Active findings</span></div>
          <div className="big-stat"><span className="ico"><Doc size={15} /></span><span className="num">{daysLeft}</span><span className="cap">Days to return</span></div>
        </div>
      </section>

      <div className="hero-actions">
        <Link className="btn primary" to="/checkin">Daily check-in</Link>
        <button className="btn" onClick={() => setReport('plain')}><Doc size={16} /> Downlink report</button>
        {ai.enabled && <button className="btn ai" onClick={() => setReport('ai')}><Sparkle size={16} /> Surgeon report</button>}
      </div>

      <div className="dash-grid">
        <StatusCard />
        <SleepCard />
        <RadiationCard />
        <DomainsCard onOpenDomain={setDomain} />
        <ReadingsCard />
        <WeekCard />
        <BodyMapCard />
        <RoutineCard />
      </div>

      <AiBriefingCard />

      {domain && <DomainModal domain={domain} onClose={() => setDomain(null)} />}
      {report && <ReportModal kind={report} onClose={() => setReport(null)} />}
    </>
  )
}
