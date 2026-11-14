// Learn: NASA's five hazards of human spaceflight, how to take each measurement, and the sources used.
import { useState } from 'react'
import { DOMAIN_ICON } from '../components/icons'
import { useStore } from '../store'
import { METRIC_KEYS, type MetricKey } from '../types'

export default function Learn() {
  const { catalog } = useStore()
  const [open, setOpen] = useState<MetricKey | null>('glucose')
  if (!catalog) return null

  return (
    <>
      <h1 className="page-title">Learn</h1>
      <p className="muted" style={{ maxWidth: 720, marginTop: -8 }}>
        Nobody is expected to know everything about assessing their own health. This page explains the hazards you face, what each
        measurement tells you, how to take it in space, and when to call the flight surgeon. It's based on NASA Human Research Program
        and Canadian Space Agency resources (listed at the bottom).
      </p>

      <h2 className="section-title">The five hazards of human spaceflight</h2>
      <div className="hazards">
        {catalog.hazards.map(h => (
          <article key={h.id} className="card hazard">
            <div className="hz-letter">{h.letter}</div>
            <h3>{h.name}</h3>
            <p>{h.summary}</p>
            <ul className="hz-facts">{h.facts.map(f => <li key={f}>{f}</li>)}</ul>
            <div className="hz-monitor"><span>How AstroVital monitors it</span>{h.monitors}</div>
            <div className="hz-domains">
              {h.domains.map(d => { const Icon = DOMAIN_ICON[d]; return <span key={d} className="mini-stat"><Icon size={13} /> {catalog.domains[d].name}</span> })}
            </div>
            <details className="hz-risks">
              <summary>Related NASA risks ({h.risks.length})</summary>
              <ul>{h.risks.map(r => <li key={r}>{r}</li>)}</ul>
            </details>
          </article>
        ))}
      </div>

      <h2 className="section-title">How to measure each indicator</h2>
      <section className="card">
        {METRIC_KEYS.map(k => {
          const g = catalog.guides[k], m = catalog.metrics[k]
          if (!g) return null
          const isOpen = open === k
          return (
            <div key={k} className={`acc-item${isOpen ? ' open' : ''}`}>
              <button className="acc-btn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : k)}>
                <span>{m.label} <span className="muted small">({m.unit || 'count'})</span></span>
                <span className="muted small">{g.when}</span>
              </button>
              {isOpen && (
                <div className="guide-body">
                  <div><span>Device</span>{g.device}</div>
                  <div><span>How</span>{g.how}</div>
                  <div><span>Why it matters in space</span>{g.why}</div>
                  <div className="esc"><span>Contact the flight surgeon if</span>{g.escalate}</div>
                </div>
              )}
            </div>
          )
        })}
      </section>

      <h2 className="section-title">Sources</h2>
      <section className="card sources-card">
        <ul>
          {Object.values(catalog.sources).map(s => (
            <li key={s.url}><b>{s.org}</b>: <a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a></li>
          ))}
        </ul>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Links open the source websites and need an internet connection; everything else in AstroVital works offline.
          Content is summarised from these pages (retrieved November 2026).
        </p>
      </section>
    </>
  )
}
