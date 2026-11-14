import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { fmt, missionDay } from '../lib/format'
import { useStore } from '../store'
import { METRIC_KEYS, type MetricKey } from '../types'

const RANGES = [[30, 'Last 30'], [60, 'Last 60'], [120, 'Last 120'], [0, 'All']] as const

/** Least-squares slope (units per day) of y over x. */
function slope(xs: number[], ys: number[]) {
  const n = xs.length
  if (n < 3) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2 }
  return den ? num / den : 0
}

export default function Trends() {
  const { catalog, entries, settings, status } = useStore()
  const params = useParams()
  const nav = useNavigate()
  const metric = (METRIC_KEYS as readonly string[]).includes(params.metric || '') ? (params.metric as MetricKey) : 'hr'
  const [range, setRange] = useState<number>(60)

  const points = useMemo(() => {
    let rows = entries.filter(e => typeof e[metric] === 'number')
    if (range) rows = rows.slice(-range)
    return rows.map((e, i) => ({ x: missionDay(e.date, settings) ?? i, y: e[metric] as number, date: e.date }))
  }, [entries, metric, range, settings])

  if (!catalog || !status) return null
  const m = catalog.metrics[metric]
  const b = status.baseline.metrics[metric]
  const band = b ? { lo: b.mean - 2 * b.sd, hi: b.mean + 2 * b.sd } : null
  const last7 = points.slice(-7).map(p => p.y)
  const tail = points.slice(-14)
  const wk = slope(tail.map(p => p.x), tail.map(p => p.y))
  const outside = (y: number) => !!band && (y > band.hi || y < band.lo)

  return (
    <>
      <h1 className="page-title">Trends</h1>
      <section className="panel">
        <div className="panel-head">
          <h2>{m.label}</h2>
          <div className="btn-row">
            <select value={metric} onChange={e => nav(`/trends/${e.target.value}`)} aria-label="Metric">
              {METRIC_KEYS.map(k => <option key={k} value={k}>{catalog.metrics[k].label}</option>)}
            </select>
            <select value={range} onChange={e => setRange(Number(e.target.value))} aria-label="Range">
              {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {points.length < 2 ? <p className="muted">Not enough data yet. Record at least two check-ins.</p> : (
          <div className="chart" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tickFormatter={v => `D${v}`}
                  stroke="var(--muted)" tick={{ fontSize: 11, fontFamily: 'var(--mono)' }} />
                <YAxis domain={['auto', 'auto']} width={48} stroke="var(--muted)" tick={{ fontSize: 11, fontFamily: 'var(--mono)' }}
                  tickFormatter={v => Number(v).toFixed(m.dec)} />
                {band && <ReferenceArea y1={band.lo} y2={band.hi} fill="var(--yellow)" fillOpacity={0.35} ifOverflow="extendDomain" />}
                {b && <ReferenceLine y={b.mean} stroke="var(--ink)" strokeDasharray="2 5" strokeWidth={1.5} />}
                {points[0].x < 1 && points[points.length - 1].x >= 1 &&
                  <ReferenceLine x={1} stroke="var(--muted)" strokeDasharray="2 3" label={{ value: 'launch', fill: 'var(--muted)', fontSize: 11, position: 'insideTopLeft' }} />}
                <Tooltip
                  cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }}
                  contentStyle={{ background: 'var(--ink)', border: 0, borderRadius: 14, color: 'var(--on-ink)', padding: '6px 12px' }}
                  labelStyle={{ color: 'var(--on-ink-muted)', fontSize: 12 }} itemStyle={{ color: 'var(--on-ink)' }}
                  labelFormatter={(_, p) => (p?.[0] ? `${p[0].payload.date} · day ${p[0].payload.x}` : '')}
                  formatter={v => [`${Number(v).toFixed(m.dec)} ${m.unit}`, m.short]}
                />
                <Line dataKey="y" stroke="var(--ink)" strokeWidth={2} type="monotone" isAnimationActive={false}
                  dot={(p: { cx?: number; cy?: number; payload: { y: number; date: string } }) => {
                    const out = outside(p.payload.y)
                    return <circle key={p.payload.date} cx={p.cx} cy={p.cy} r={out ? 4.5 : points.length > 90 ? 1.5 : 2.5}
                      fill={out ? 'var(--watch)' : 'var(--ink)'} stroke={out ? '#fff' : 'none'} strokeWidth={2} />
                  }}
                  activeDot={{ r: 6, fill: 'var(--yellow)', stroke: 'var(--ink)', strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="legend">
          <span><i style={{ background: 'var(--yellow)', opacity: 0.6 }} />your baseline ±2σ</span><span><i style={{ borderTop: '2px dotted var(--ink)', height: 0 }} />baseline mean</span>
          <span><i style={{ background: 'var(--watch)', borderRadius: '50%', width: 9, height: 9 }} />outside your normal range</span>
        </div>
        <div className="kv">
          <div><span>Baseline</span><b>{b ? `${b.mean.toFixed(m.dec)} ± ${b.sd.toFixed(m.dec || 1)}` : '—'}</b></div>
          <div><span>Last 7 avg</span><b>{last7.length ? fmt(last7.reduce((a, c) => a + c, 0) / last7.length, m.dec) : '—'} {m.unit}</b></div>
          <div><span>Trend (14 d)</span><b>{wk === null ? '—' : `${wk >= 0 ? '+' : ''}${(wk * 7).toFixed(m.dec + 1)} /wk`}</b></div>
          <div><span>Readings</span><b>{points.length}</b></div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Drift scan</h2><span className="muted small">7-day average vs. your baseline, largest change first. Click a row to chart it.</span></div>
        {!status.drift.length ? <p className="muted">Need at least 3 baseline readings per metric.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Indicator</th><th className="num">Baseline</th><th className="num">7-day avg</th><th className="num">Change</th><th>Deviation</th></tr></thead>
              <tbody>
                {status.drift.map(d => {
                  const mm = catalog.metrics[d.key], az = Math.min(4, Math.abs(d.z))
                  const col = az >= 2 ? 'var(--watch)' : az >= 1 ? 'var(--ink)' : 'var(--faint)'
                  return (
                    <tr key={d.key} className="clickable" onClick={() => nav(`/trends/${d.key}`)}>
                      <td>{mm.label}</td>
                      <td className="num">{d.baseline.toFixed(mm.dec)}</td>
                      <td className="num">{d.recent.toFixed(mm.dec)}</td>
                      <td className="num">{d.recent - d.baseline >= 0 ? '+' : ''}{(d.recent - d.baseline).toFixed(mm.dec)} {mm.unit}</td>
                      <td><span className="zbar" style={{ width: az * 25, background: col }} /> <span className="small muted">{d.z >= 0 ? '+' : ''}{d.z.toFixed(1)}σ</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
