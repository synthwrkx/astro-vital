import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { download } from '../lib/download'
import { fmt, missionDay, todayStr } from '../lib/format'
import { useStore } from '../store'
import { METRIC_KEYS, type Entry, type Settings } from '../types'

function toCsv(entries: Entry[], settings: Settings | null) {
  const keys = ['date', 'mission_day', ...METRIC_KEYS, 'symptoms', 'notes']
  const q = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [keys.join(','), ...entries.map(e => keys.map(k =>
    k === 'mission_day' ? q(missionDay(e.date, settings)) : k === 'symptoms' ? q(e.symptoms.join(';')) : q((e as Record<string, unknown>)[k]),
  ).join(','))].join('\n')
}

export default function Data() {
  const { entries, settings, refresh, toast } = useStore()
  const nav = useNavigate()
  const file = useRef<HTMLInputElement>(null)
  const rows = [...entries].reverse()

  async function run(fn: () => Promise<unknown>, msg: string) {
    try { await fn(); await refresh(); toast(msg) } catch (e) { toast(`Failed: ${(e as Error).message}`) }
  }

  return (
    <>
    <h1 className="page-title">Data</h1>
    <section className="panel">
      <div className="panel-head">
        <h2>Check-in log</h2>
        <div className="btn-row">
          <button className="btn" onClick={async () => download(`astrovital-${todayStr()}.json`, JSON.stringify(await api.exportData(), null, 2), 'application/json')}>Export JSON</button>
          <button className="btn" onClick={() => download(`astrovital-${todayStr()}.csv`, toCsv(entries, settings), 'text/csv')}>Export CSV</button>
          <button className="btn" onClick={() => file.current?.click()}>Import JSON</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={async e => {
            const f = e.target.files?.[0]; e.target.value = ''
            if (!f) return
            if (entries.length && !confirm('Importing replaces all current data. Continue?')) return
            await run(async () => api.importData(JSON.parse(await f.text())), 'Data imported.')
          }} />
          <button className="btn yellow" onClick={() => (!entries.length || confirm('Replace your current data with the demo mission?')) &&
            run(api.loadDemo, 'Demo mission loaded: 14 preflight + 124 flight days.')}>Load demo</button>
          <button className="btn danger" onClick={() => confirm('Delete ALL check-ins and settings? Export first if you need them.') &&
            run(api.clearAll, 'All data cleared.')}>Clear all</button>
        </div>
      </div>
      <p className="muted small">{entries.length} entries stored in the mission database. Click a row to edit it.</p>
      {rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Date</th><th className="num">Day</th><th className="num">HR</th><th className="num">BP</th><th className="num">SpO₂</th>
              <th className="num">Temp</th><th className="num">Mass</th><th className="num">Sleep</th><th className="num">Resist.</th>
              <th className="num">Mood</th><th className="num">RT</th><th className="num">Dose</th><th>Symptoms</th>
            </tr></thead>
            <tbody>
              {rows.map(e => (
                <tr key={e.date} className="clickable" onClick={() => nav(`/checkin/${e.date}`)}>
                  <td>{e.date}</td><td className="num">{missionDay(e.date, settings)}</td>
                  <td className="num">{fmt(e.hr)}</td><td className="num">{e.sbp != null ? `${e.sbp}/${fmt(e.dbp)}` : '—'}</td>
                  <td className="num">{fmt(e.spo2)}</td><td className="num">{fmt(e.temp, 1)}</td><td className="num">{fmt(e.weight, 1)}</td>
                  <td className="num">{fmt(e.sleep, 1)}</td><td className="num">{fmt(e.resistance)}</td><td className="num">{fmt(e.mood)}</td>
                  <td className="num">{fmt(e.pvt)}</td><td className="num">{fmt(e.dose, 2)}</td>
                  <td className="small muted">{e.symptoms.length || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
    </>
  )
}
