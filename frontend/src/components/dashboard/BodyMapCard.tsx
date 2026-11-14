// Interactive body map: each region is colored by the status of the findings that affect it.
// Click a region to see what it does, how spaceflight affects it, its findings, readings and how to measure.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fmt } from '../../lib/format'
import { useStore } from '../../store'
import type { Finding, Level, MetricKey } from '../../types'

interface Region {
  id: string; name: string
  does: string        // what it does
  space: string       // how spaceflight affects it
  hazard: string      // RIDGE hazard
  metrics: MetricKey[]
  match: (f: Finding) => boolean
}

const REGIONS: Region[] = [
  { id: 'brain', name: 'Brain & mind', hazard: 'Isolation & confinement',
    does: 'Thinking, mood, sleep regulation and reaction speed.',
    space: 'Isolation, sleep loss and workload erode mood and alertness. Cabin CO₂ can cause headaches.',
    metrics: ['mood', 'stress', 'fatigue', 'sleep', 'pvt'], match: f => f.domain === 'behavior' || /headache/i.test(f.title) },
  { id: 'eyes', name: 'Eyes', hazard: 'Gravity fields',
    does: 'Vision, including fine near vision for procedures.',
    space: 'Fluid shifts toward the head can change the eye (SANS: optic disc swelling, globe flattening).',
    metrics: [], match: f => /vision|congestion|fullness/i.test(f.title) },
  { id: 'immune', name: 'Immune system', hazard: 'Hostile & closed environments',
    does: 'Defends against infection; lymph nodes in the neck swell when it is fighting.',
    space: 'Immunity is dysregulated and latent viruses can reactivate; microbes spread easily in closed habitats.',
    metrics: ['temp'], match: f => f.domain === 'immune' },
  { id: 'lungs', name: 'Lungs', hazard: 'Hostile & closed environments',
    does: 'Bring oxygen into the blood.',
    space: 'Cabin air quality (O₂, CO₂) directly affects oxygen saturation.',
    metrics: ['spo2'], match: f => /oxygen/i.test(f.title) },
  { id: 'heart', name: 'Heart & circulation', hazard: 'Gravity fields',
    does: 'Pumps blood; pressure keeps the brain supplied when you stand.',
    space: 'Fluid shifts and deconditioning change heart rate and blood pressure, leading to dizziness after landing.',
    metrics: ['hr', 'sbp', 'dbp'], match: f => f.domain === 'cardio' },
  { id: 'gut', name: 'Digestion & metabolism', hazard: 'Distance from Earth',
    does: 'Turns food into energy; insulin keeps blood sugar steady.',
    space: 'Astronauts often under-eat, and weightlessness resembles a sedentary lifestyle for insulin sensitivity.',
    metrics: ['calories', 'protein', 'glucose', 'weight'], match: f => f.domain === 'nutrition' },
  { id: 'kidneys', name: 'Kidneys', hazard: 'Gravity fields',
    does: 'Filter blood and balance fluids.',
    space: 'Bone loss releases calcium into urine, which raises kidney-stone risk; fluid intake is the countermeasure.',
    metrics: ['fluid'], match: f => /fluid|flank/i.test(f.title) },
  { id: 'msk', name: 'Bones & muscles', hazard: 'Gravity fields',
    does: 'Support, movement and strength.',
    space: 'Weight-bearing bones lose 1–1.5% of mineral density per month and muscles shrink without loaded exercise.',
    metrics: ['resistance', 'aerobic'], match: f => f.domain === 'bone' && !/fluid|flank/i.test(f.title) },
  { id: 'radiation', name: 'Whole body: radiation', hazard: 'Space radiation',
    does: 'Radiation passes through the whole body.',
    space: 'Raises cancer risk and can affect the nervous system. Solar particle events need shelter within minutes.',
    metrics: ['dose'], match: f => f.domain === 'radiation' },
]

const RANK: Record<Level, number> = { ok: 0, watch: 1, act: 2 }
const LEVEL_TEXT = { ok: 'Nominal', watch: 'Monitor', act: 'Act now' } as const

export function BodyMapCard() {
  const { status, catalog } = useStore()
  const [sel, setSel] = useState('heart')

  const byRegion = useMemo(() => {
    const out: Record<string, { level: Level; findings: Finding[] }> = {}
    for (const r of REGIONS) {
      const fs = status?.findings.filter(r.match) ?? []
      out[r.id] = { level: fs.reduce<Level>((l, f) => (RANK[f.level] > RANK[l] ? f.level : l), 'ok'), findings: fs }
    }
    return out
  }, [status])

  if (!status?.latest || !catalog) return null
  const region = REGIONS.find(r => r.id === sel)!
  const info = byRegion[sel]
  const lvl = (id: string) => byRegion[id].level
  const part = (id: string) => ({
    className: `bm-part ${lvl(id)}${sel === id ? ' sel' : ''}`,
    onClick: () => setSel(id),
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(id) } },
    tabIndex: 0, role: 'button',
    'aria-label': `${REGIONS.find(r => r.id === id)!.name}: ${LEVEL_TEXT[lvl(id)]}`,
    'aria-pressed': sel === id,
  })

  return (
    <section className="card span-3 bodymap">
      <div className="card-head">
        <div><h2>Body map</h2><span className="muted small">Tap a part of the body to see its status, what it does and what to do</span></div>
        <div className="mini-stats">
          {(['ok', 'watch', 'act'] as const).map(l => <span key={l} className="mini-stat"><i className={`bm-key ${l}`} />{LEVEL_TEXT[l]}</span>)}
        </div>
      </div>
      <div className="bm-grid">
        <svg viewBox="0 0 240 470" className="bm-svg" aria-label="Body map">
          {/* radiation aura */}
          <ellipse cx="120" cy="235" rx="112" ry="226" {...part('radiation')} className={`bm-aura ${lvl('radiation')}${sel === 'radiation' ? ' sel' : ''}`} />
          {/* silhouette */}
          <g className="bm-body" aria-hidden="true">
            <circle cx="120" cy="52" r="34" />
            <rect x="108" y="82" width="24" height="22" rx="8" />
            <path d="M74 108 Q120 96 166 108 Q178 112 180 126 L178 252 Q176 282 160 290 L80 290 Q64 282 62 252 L60 126 Q62 112 74 108 Z" />
            <rect x="30" y="112" width="26" height="150" rx="13" transform="rotate(8 43 112)" />
            <rect x="184" y="112" width="26" height="150" rx="13" transform="rotate(-8 197 112)" />
            <rect x="80" y="282" width="34" height="170" rx="16" />
            <rect x="126" y="282" width="34" height="170" rx="16" />
          </g>
          {/* clickable regions */}
          <g {...part('msk')}>
            <rect x="30" y="112" width="26" height="150" rx="13" transform="rotate(8 43 112)" />
            <rect x="184" y="112" width="26" height="150" rx="13" transform="rotate(-8 197 112)" />
            <rect x="82" y="300" width="30" height="148" rx="14" />
            <rect x="128" y="300" width="30" height="148" rx="14" />
          </g>
          <circle cx="120" cy="46" r="26" {...part('brain')} />
          <g {...part('eyes')}><ellipse cx="108" cy="58" rx="7" ry="4.5" /><ellipse cx="132" cy="58" rx="7" ry="4.5" /></g>
          <rect x="106" y="86" width="28" height="16" rx="8" {...part('immune')} />
          <g {...part('lungs')}>
            <path d="M114 122 C96 120 84 136 84 162 C84 182 92 192 104 190 C112 189 114 180 114 170 Z" />
            <path d="M126 122 C144 120 156 136 156 162 C156 182 148 192 136 190 C128 189 126 180 126 170 Z" />
          </g>
          <path {...part('heart')} className={`bm-part ${lvl('heart')}${sel === 'heart' ? ' sel' : ''} bm-heart`}
            d="M126 158 c0 -8 12 -10 14 -2 c2 -8 14 -6 14 2 c0 10 -14 18 -14 18 s-14 -8 -14 -18 z" />
          <ellipse cx="120" cy="222" rx="30" ry="20" {...part('gut')} />
          <g {...part('kidneys')}><ellipse cx="94" cy="250" rx="9" ry="14" /><ellipse cx="146" cy="250" rx="9" ry="14" /></g>
        </svg>

        <div className="bm-detail" aria-live="polite">
          <div className="bm-detail-head">
            <h3>{region.name}</h3>
            <span className={`lvl-chip ${info.level}`}>{LEVEL_TEXT[info.level]}</span>
          </div>
          <p className="bm-does"><b>What it does</b>{region.does}</p>
          <p className="bm-does"><b>In space</b>{region.space} <span className="muted">Hazard: {region.hazard}.</span></p>
          {info.findings.length > 0 ? (
            <ul className="bm-findings">
              {info.findings.map(f => (
                <li key={f.title}><span className={`pop-dot ${f.level}`} /><div><b>{f.title}</b><span>{f.detail}</span><span className="bm-act">→ {f.actions[0]}</span></div></li>
              ))}
            </ul>
          ) : <p className="ok-text small">No findings here; everything is within your baseline.</p>}
          {region.metrics.length > 0 && (
            <div className="bm-metrics">
              {region.metrics.map(k => {
                const m = catalog.metrics[k], v = status.latest![k], b = status.baseline.metrics[k]
                return (
                  <Link key={k} to={`/trends/${k}`} className="mini-stat" title={catalog.guides[k]?.how}>
                    {m.short} <b>{fmt(v, m.dec)}</b>{m.unit && m.unit !== '/5' ? ` ${m.unit}` : ''}{b && k !== 'dose' ? <span className="muted"> · base {b.mean.toFixed(m.dec)}</span> : null}
                  </Link>
                )
              })}
            </div>
          )}
          {region.metrics[0] && catalog.guides[region.metrics[0]] && (
            <p className="muted small" style={{ marginBottom: 0 }}>
              <b>How to measure {catalog.metrics[region.metrics[0]].label.toLowerCase()}:</b> {catalog.guides[region.metrics[0]].how}{' '}
              <Link to="/learn">More in Learn →</Link>
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
