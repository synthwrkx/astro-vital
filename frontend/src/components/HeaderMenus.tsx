// Top-bar popovers: the bell shows active alerts, the avatar shows the crew profile.
// Settings (mission configuration) is its own page, so neither popover duplicates it.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { download } from '../lib/download'
import { todayStr } from '../lib/format'
import { useStore } from '../store'
import { useRoutine } from '../hooks/useRoutine'
import { Bell, DOMAIN_ICON, User } from './icons'

function Popover({ label, button, className, children }: { label: string; button: ReactNode; className?: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div className="popover-anchor" ref={ref}>
      <button className={`circle-btn${open ? ' dark' : ''} ${className || ''}`} aria-label={label} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {button}
      </button>
      {open && <div className="popover" role="dialog" aria-label={label}>{children(() => setOpen(false))}</div>}
    </div>
  )
}

export function AlertsMenu() {
  const { status, catalog } = useStore()
  const routine = useRoutine()
  const due = routine?.tasks.filter(t => !t.done) ?? []
  const findings = status?.findings ?? []
  const nAct = findings.filter(f => f.level === 'act').length
  return (
    <Popover label={`Alerts: ${findings.length} active findings, ${due.length} tasks due`} button={<><Bell />{(findings.length > 0 || due.length > 0) && <span className={`badge${nAct ? ' act' : ''}`} />}</>}>
      {close => (
        <>
          <div className="popover-head"><b>Alerts</b><span className="muted small">{findings.length} active · {nAct} act now</span></div>
          {findings.length === 0 ? <p className="muted small">Nothing needs attention. All indicators are within your baseline.</p> : (
            <div className="popover-list">
              {findings.slice(0, 8).map(f => {
                const Icon = DOMAIN_ICON[f.domain]
                return (
                  <div key={f.domain + f.title} className="pop-item">
                    <span className={`pop-dot ${f.level}`} />
                    <Icon size={16} />
                    <span className="pop-txt"><b>{f.title}</b><span>{catalog?.domains[f.domain].name}{f.escalate ? ' · notify surgeon' : ''}</span></span>
                  </div>
                )
              })}
            </div>
          )}
          {due.length > 0 && (
            <>
              <div className="popover-head" style={{ marginTop: 12 }}><b>Due today</b><span className="muted small">{due.length} routine task{due.length > 1 ? 's' : ''}</span></div>
              <div className="pop-due">{due.slice(0, 5).map(t => <span key={t.id} className="mini-stat">{t.title} · {t.when}</span>)}</div>
            </>
          )}
          <div className="btn-row" style={{ marginTop: 10 }}>
            <Link to="/" className="btn primary" style={{ flex: 1 }} onClick={close}>Action plan</Link>
            <Link to="/routine" className="btn" style={{ flex: 1 }} onClick={close}>Routine</Link>
          </div>
        </>
      )}
    </Popover>
  )
}

export function ProfileMenu() {
  const { settings, status, entries, toast } = useStore()
  if (!settings) return null
  const initials = settings.crew_name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const md = status?.mission_day
  const rad = status?.radiation
  return (
    <Popover label="Crew profile" button={settings.crew_name ? <span style={{ fontSize: '.8rem', fontWeight: 600 }}>{initials}</span> : <User />}>
      {close => (
        <>
          <div className="profile-top">
            <span className="avatar-lg">{initials}</span>
            <div><b>{settings.crew_name}</b><div className="muted small">Crew member</div></div>
          </div>
          <dl className="profile-kv">
            <dt>Mission day</dt><dd>{md != null ? `${Math.max(md, 0)} / ${settings.mission_length}` : '—'}</dd>
            <dt>Launch</dt><dd>{settings.mission_start ?? 'not set'}</dd>
            <dt>Career dose</dt><dd>{rad ? `${rad.career.toFixed(0)} / ${rad.limit} mSv` : '—'}</dd>
            <dt>Baseline</dt><dd>{status ? `${status.baseline.n} ${status.baseline.source} days` : '—'}</dd>
            <dt>Check-ins</dt><dd>{entries.length}</dd>
          </dl>
          <Link to="/data" className="btn" style={{ width: '100%', marginBottom: 6 }} onClick={close}>Check-in log &amp; data</Link>
          <button className="btn" style={{ width: '100%' }} onClick={async () => {
            download(`astrovital-${todayStr()}.json`, JSON.stringify(await api.exportData(), null, 2), 'application/json')
            toast('Health record exported.'); close()
          }}>Export my health record</button>
        </>
      )}
    </Popover>
  )
}
