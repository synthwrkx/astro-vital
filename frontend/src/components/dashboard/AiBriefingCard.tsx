import { useState } from 'react'
import { api } from '../../api'
import { useStore } from '../../store'
import type { Briefing } from '../../types'
import { AiOffNote, Markdown, Spinner } from '../ui'
import { Sparkle } from '../icons'

const URGENCY: Record<Briefing['priorities'][number]['urgency'], string> = {
  now: 'Now', today: 'Today', this_week: 'This week', keep_monitoring: 'Keep monitoring',
}

/** Onboard-model daily briefing: summary, anomaly + forecast on the left, priorities on the right. */
export function AiBriefingCard() {
  const { ai } = useStore()
  const [state, setState] = useState<{ loading: boolean; data?: Briefing; error?: string }>({ loading: false })

  async function run() {
    setState({ loading: true })
    try { setState({ loading: false, data: await api.ai.briefing() }) }
    catch (e) { setState({ loading: false, error: (e as Error).message }) }
  }

  const b = state.data
  return (
    <section className="card ai-panel" style={{ marginTop: 18 }}>
      <div className="card-head">
        <div>
          <h2><Sparkle /> AI daily briefing</h2>
          <span className="muted small">Onboard model · explains today's status, spots combined anomalies and forecasts where trends are heading</span>
        </div>
        {ai.enabled && <button className="btn primary" onClick={run} disabled={state.loading}>{b ? 'Regenerate' : 'Generate briefing'}</button>}
      </div>
      {!ai.enabled && <AiOffNote />}
      {state.loading && <Spinner label="Analysing your recent data…" />}
      {state.error && <p className="error-text">{state.error}</p>}
      {b && (
        <div className="briefing">
          <div>
            <h3 className="briefing-headline">{b.headline}</h3>
            <Markdown>{b.summary}</Markdown>
            {b.anomaly_note && <p className="anomaly-note"><strong>Anomaly model · </strong>{b.anomaly_note}</p>}
            {b.forecasts.length > 0 && (
              <div className="forecasts"><strong>Forecast</strong><ul>{b.forecasts.map(f => <li key={f}>{f}</li>)}</ul></div>
            )}
            {b.contact_flight_surgeon && <p className="small"><span className="tag">Contact flight surgeon</span> {b.contact_reason}</p>}
          </div>
          <div>
            <ol className="priorities">
              {b.priorities.map(p => (
                <li key={p.title}>
                  <div className="prio-head"><strong style={{ fontWeight: 500 }}>{p.title}</strong><span className={`urg urg-${p.urgency}`}>{URGENCY[p.urgency]}</span></div>
                  <div className="muted small">{p.why}</div>
                  <div className="small">→ {p.action}</div>
                </li>
              ))}
            </ol>
            {b.going_well.length > 0 && <p className="small"><span className="ok-text">Going well:</span> {b.going_well.join(' · ')}</p>}
            <p className="muted small">Generated onboard by {ai.model}. The rule-engine status remains authoritative.</p>
          </div>
        </div>
      )}
    </section>
  )
}
