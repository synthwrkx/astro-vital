import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../api'
import { useStore } from '../store'
import type { Settings } from '../types'

type NumKey = Exclude<keyof Settings, 'crew_name' | 'mission_start' | 'mission_profile'>

export default function SettingsPage() {
  const { settings, catalog, ai, refresh, toast } = useStore()
  const [form, setForm] = useState<Settings | null>(settings)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setForm(settings), [settings])
  if (!form) return null

  const num = (key: NumKey, label: string, props: Record<string, string | number> = {}, hint?: string) => (
    <div className="field">
      <label htmlFor={`s-${key}`}>{label}</label>
      <input id={`s-${key}`} type="number" value={form[key]} {...props}
        onChange={e => setForm({ ...form, [key]: e.target.value === '' ? 0 : Number(e.target.value) })} />
      {hint && <div className="hint">{hint}</div>}
    </div>
  )

  async function save(e: React.FormEvent) {
    e.preventDefault()
    try { await api.saveSettings(form!); await refresh(); setError(null); toast('Settings saved.') }
    catch (err) { setError((err as Error).message) }
  }

  return (
    <>
    <h1 className="page-title">Settings</h1>
    <form className="panel" onSubmit={save}>
      <div className="panel-head"><h2>Mission &amp; personal settings</h2></div>
      <div className="form-section"><h2>Mission</h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="s-name">Crew member name</label>
            <input id="s-name" type="text" value={form.crew_name} maxLength={80} required onChange={e => setForm({ ...form, crew_name: e.target.value })} /></div>
          <div className="field"><label htmlFor="s-start">Launch date (mission day 1)</label>
            <input id="s-start" type="date" value={form.mission_start || ''} onChange={e => setForm({ ...form, mission_start: e.target.value || null })} />
            <div className="hint">Check-ins before this date form your baseline</div></div>
          {num('mission_length', 'Planned mission length (days)', { min: 1, max: 1500 })}
        </div>
      </div>
      <div className="form-section"><h2>Mission profile</h2>
        <p className="muted small" style={{ marginTop: -6 }}>Sets the expected radiation, Earth-link delay and gravity, all from published measurements. Earth-analog profiles apply the same monitoring to isolated people on Earth.</p>
        <div className="profile-grid" role="radiogroup" aria-label="Mission profile">
          {catalog && Object.entries(catalog.profiles).map(([k, p]) => (
            <label key={k} className={`profile-opt${form.mission_profile === k ? ' on' : ''}`}>
              <input type="radio" name="mission_profile" value={k} checked={form.mission_profile === k} onChange={() => setForm({ ...form, mission_profile: k })} />
              <span className="po-kind">{p.kind === 'space' ? 'Space' : 'Earth analog'}</span>
              <b>{p.name}</b>
              <span className="po-facts">
                <span>☢ {p.dose_msv_day ? `${p.dose_msv_day} mSv/day` : 'background'}</span>
                <span>⇄ {p.delay}</span>
                <span>g {p.gravity_g}</span>
              </span>
              <span className="po-src">{p.dose_source !== '—' ? p.dose_source : p.support}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="form-section"><h2>Radiation</h2>
        <div className="form-grid">
          {num('prior_career_dose', 'Prior career dose (mSv)', { min: 0, step: 0.1 })}
          {num('career_limit', 'Career limit (mSv)', { min: 1 }, 'NASA-STD-3001: 600 mSv effective dose')}
        </div>
      </div>
      <div className="form-section"><h2>Daily countermeasure targets</h2>
        <div className="form-grid">
          {num('resistance_target', 'Resistance exercise (min)', { min: 0, max: 300 })}
          {num('aerobic_target', 'Aerobic exercise (min)', { min: 0, max: 300 })}
          {num('fluid_target', 'Fluid intake (L)', { min: 0, max: 8, step: 0.1 })}
          {num('calorie_target', 'Energy intake (kcal)', { min: 1000, max: 6000, step: 50 })}
        </div>
      </div>
      <div className="form-section"><h2>Data</h2>
        <p className="small">Check-in log, JSON/CSV export, import, demo mission and reset are on the <Link to="/data">Data page →</Link></p>
      </div>
      <div className="form-section"><h2>AI</h2>
        <p className="small">{ai.enabled
          ? <>Onboard AI model <code>{ai.model}</code> v{ai.version} is loaded. It runs entirely on this spacecraft, with no Earth link required.</>
          : <>Onboard AI is <b>unavailable</b>: {ai.reason}</>}</p>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="btn-row" style={{ marginTop: 16 }}><button className="btn primary" type="submit">Save settings</button></div>
    </form>
    </>
  )
}
