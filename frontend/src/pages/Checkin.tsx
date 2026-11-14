import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { Info, Sparkle } from '../components/icons'
import { PhotoCapture } from '../components/PhotoCapture'
import { AiOffNote, Spinner } from '../components/ui'
import { missionDay, todayStr } from '../lib/format'
import { useStore } from '../store'
import type { Entry, MetricGuide, MetricKey } from '../types'

type Form = Record<MetricKey, string>
const emptyForm = (): Form => Object.fromEntries(
  ['hr', 'sbp', 'dbp', 'spo2', 'temp', 'weight', 'sleep', 'aerobic', 'resistance', 'fluid', 'mood', 'stress', 'fatigue', 'pvt', 'lapses', 'dose', 'glucose', 'calories', 'protein'].map(k => [k, '']),
) as Form

const SCALES: { key: MetricKey; label: string; lo: string; hi: string }[] = [
  { key: 'mood', label: 'Mood', lo: 'very low', hi: 'great' },
  { key: 'stress', label: 'Stress', lo: 'calm', hi: 'very high' },
  { key: 'fatigue', label: 'Fatigue', lo: 'fresh', hi: 'exhausted' },
]

export default function Checkin() {
  const { catalog, entries, settings, refresh, toast } = useStore()
  const params = useParams()
  const nav = useNavigate()
  const [date, setDate] = useState(params.date || todayStr())
  const existing = useMemo(() => entries.find(e => e.date === date), [entries, date])
  const [form, setForm] = useState<Form>(emptyForm)
  const [symptoms, setSymptoms] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [guide, setGuide] = useState<MetricKey | null>(null)

  // Load the entry for the selected date into the form.
  useEffect(() => {
    const f = emptyForm()
    if (existing) for (const k of Object.keys(f) as MetricKey[]) f[k] = existing[k] != null ? String(existing[k]) : ''
    setForm(f)
    setSymptoms(new Set(existing?.symptoms || []))
    setNotes(existing?.notes || '')
    setAiFilled(new Set())
  }, [existing, date])

  if (!catalog || !settings) return null
  const md = missionDay(date, settings)
  const groups = catalog.symptoms.reduce<Record<string, typeof catalog.symptoms>>((acc, s) => ((acc[s.domain] ||= []).push(s), acc), {})

  const set = (k: MetricKey, v: string) => { setForm(f => ({ ...f, [k]: v })); setAiFilled(s => { const n = new Set(s); n.delete(k); return n }) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    const entry: Entry = { date, symptoms: [...symptoms] }
    for (const [k, v] of Object.entries(form) as [MetricKey, string][]) if (v !== '') entry[k] = Number(v)
    if (notes.trim()) entry.notes = notes.trim()
    try {
      const ev = await api.saveEntry(entry)
      await refresh()
      toast(`Saved. Overall status: ${ev.overall_label}${ev.findings.length ? ` · ${ev.findings.length} item(s) in your action plan` : ''}.`)
      nav('/')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm(`Delete the check-in for ${date}?`)) return
    await api.deleteEntry(date)
    await refresh()
    toast('Entry deleted.')
    nav('/data')
  }

  function applyDraft(draft: Awaited<ReturnType<typeof api.ai.parseCheckin>>) {
    const filled = new Set<string>()
    setForm(f => {
      const n = { ...f }
      for (const k of Object.keys(n) as MetricKey[]) {
        const v = draft[k]
        if (typeof v === 'number') { n[k] = String(v); filled.add(k) }
      }
      return n
    })
    if (draft.symptoms.length) {
      setSymptoms(s => new Set([...s, ...draft.symptoms]))
      draft.symptoms.forEach(s => filled.add(`sym:${s}`))
    }
    if (draft.notes) setNotes(n => (n ? `${n}\n${draft.notes}` : draft.notes!))
    setAiFilled(filled)
    return filled.size
  }

  const num = (k: MetricKey) => {
    const m = catalog.metrics[k]
    return (
      <div className={`field${aiFilled.has(k) ? ' ai-filled' : ''}`} key={k}>
        <label htmlFor={`f-${k}`}>{m.label}{m.unit && m.unit !== '/5' ? ` (${m.unit})` : ''}
          {catalog.guides[k] && <GuideButton k={k} open={guide === k} onToggle={() => setGuide(guide === k ? null : k)} />}
        </label>
        <input id={`f-${k}`} type="number" inputMode="decimal" min={m.min} max={m.max} step={m.step}
          value={form[k]} onChange={e => set(k, e.target.value)} />
        {guide === k && catalog.guides[k] && <GuideTip g={catalog.guides[k]} />}
      </div>
    )
  }

  return (
    <>
    <h1 className="page-title">Check-in</h1>
    <form className="panel" onSubmit={save} autoComplete="off">
      <div className="panel-head">
        <div>
          <h2>{existing ? 'Edit' : 'New'} daily check-in</h2>
          <div className="muted small">
            {md !== null ? (md >= 1 ? `Mission day ${md}` : `Preflight (L${md - 1}): builds your personal baseline`) : 'Your first check-in sets launch day; change it in Settings'} · about 2 minutes
          </div>
        </div>
        <div className="field">
          <label htmlFor="f-date">Date</label>
          <input id="f-date" type="date" value={date} max={todayStr()} required onChange={e => setDate(e.target.value || todayStr())} />
        </div>
      </div>

      <AiDescribe onDraft={applyDraft} />

      <div className="form-section"><h2>Vitals</h2>
        <div className="form-grid">{(['hr', 'sbp', 'dbp', 'spo2', 'temp', 'weight'] as MetricKey[]).map(num)}</div>
      </div>

      <div className="form-section"><h2>Nutrition &amp; metabolism</h2>
        <div className="form-grid">{(['glucose', 'calories', 'protein'] as MetricKey[]).map(num)}</div>
        <p className="muted small">Fasting glucose before breakfast; energy and protein from meal labels. Targets: {settings.calorie_target} kcal and about 1.2 g protein per kg body mass per day.</p>
      </div>

      <div className="form-section"><h2>Countermeasures &amp; recovery</h2>
        <div className="form-grid">{(['sleep', 'resistance', 'aerobic', 'fluid'] as MetricKey[]).map(num)}</div>
        <p className="muted small">Targets: resistance {settings.resistance_target} min · aerobic {settings.aerobic_target} min · fluid {settings.fluid_target} L per day.</p>
      </div>

      <div className="form-section"><h2>How are you doing?</h2>
        <div className="form-grid">
          {SCALES.map(s => (
            <div className={`field${aiFilled.has(s.key) ? ' ai-filled' : ''}`} key={s.key}>
              <label>{s.label} <span className="hint">{s.lo} → {s.hi}</span></label>
              <div className="scale" role="radiogroup" aria-label={s.label}>
                {[1, 2, 3, 4, 5].map(v => (
                  <label key={v}>
                    <input type="radio" name={s.key} value={v} checked={form[s.key] === String(v)} onChange={() => set(s.key, String(v))} />
                    <span>{v}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="form-section"><h2>Alertness &amp; radiation</h2>
        <div className="form-grid">
          {(['pvt', 'lapses', 'dose'] as MetricKey[]).map(num)}
          <div className="field"><label>&nbsp;</label><Link className="btn" to="/alertness">Run alertness test →</Link></div>
        </div>
        <p className="muted small">Dose: from your personal dosimeter or the module's radiation monitor.</p>
      </div>

      <div className="form-section"><h2>Symptoms today</h2>
        {Object.entries(groups).map(([d, list]) => (
          <div className="sym-group" key={d}>
            <h3>{catalog.domains[d].name}</h3>
            <div className="checks">
              {list.map(s => (
                <label key={s.id} className={`check${s.level === 'act' ? ' red' : ''}${aiFilled.has(`sym:${s.id}`) ? ' ai-filled' : ''}`}>
                  <input type="checkbox" checked={symptoms.has(s.id)}
                    onChange={e => setSymptoms(prev => { const n = new Set(prev); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n })} />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="form-section"><h2>Photos</h2>
        <p className="muted small" style={{ marginTop: -6 }}>Use the camera to record a visible symptom, such as a rash, cold sore or slow-healing cut.</p>
        <PhotoCapture date={date} />
      </div>

      <div className="form-section"><h2>Notes</h2>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything else: context for yourself or the flight surgeon" maxLength={4000} />
      </div>

      {error && <p className="error-text">{error}</p>}
      <div className="btn-row" style={{ marginTop: 16 }}>
        <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save check-in'}</button>
        {existing && <button type="button" className="btn danger" onClick={remove}>Delete this entry</button>}
      </div>
    </form>
    </>
  )
}

// ---------------- AI: describe your day in words (typed or dictated)
type SpeechRec = { start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; continuous: boolean; interimResults: boolean; lang: string }

function AiDescribe({ onDraft }: { onDraft: (d: Awaited<ReturnType<typeof api.ai.parseCheckin>>) => number }) {
  const { ai } = useStore()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string; unclear?: string[] } | null>(null)
  const [listening, setListening] = useState(false)
  const rec = useRef<SpeechRec | null>(null)
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition

  function toggleMic() {
    if (!SR) return
    if (listening) { rec.current?.stop(); return }
    const r = new SR()
    r.continuous = true; r.interimResults = false; r.lang = 'en-US'
    const before = text
    r.onresult = e => setText((before ? before + ' ' : '') + Array.from(e.results).map(x => x[0].transcript).join(' '))
    r.onend = () => setListening(false)
    rec.current = r
    r.start(); setListening(true)
  }

  async function run() {
    setBusy(true); setMsg(null)
    try {
      const d = await api.ai.parseCheckin(text)
      const n = onDraft(d)
      setMsg({ ok: true, text: n ? `Filled ${n} field${n > 1 ? 's' : ''} (highlighted). Review them, then save.` : 'Nothing could be mapped to the form. Try adding numbers or symptoms.', unclear: d.unclear })
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ai-describe">
      <h2><Sparkle /> Describe your day</h2>
      {!ai.enabled ? <AiOffNote /> : (
        <>
          <p className="muted small">Type or dictate in your own words. The onboard model fills in the form below for you to review. Nothing is saved until you press Save.</p>
          <div className="describe-row">
            <textarea value={text} onChange={e => setText(e.target.value)} maxLength={4000}
              placeholder='e.g. "Slept about 5 and a half hours, woke up with a headache again. HR 68, BP 121 over 78. 40 minutes on ARED, skipped the bike. Mood meh, pretty wiped out."' />
            <div className="describe-actions">
              {SR && <button type="button" className={`btn${listening ? ' listening' : ''}`} onClick={toggleMic} aria-pressed={listening}>{listening ? '■ Stop' : '🎙 Dictate'}</button>}
              <button type="button" className="btn ai" onClick={run} disabled={busy || text.trim().length < 2}>Fill form</button>
            </div>
          </div>
          {busy && <Spinner label="Reading your check-in…" />}
          {msg && <p className={msg.ok ? 'small' : 'error-text'}>{msg.text}</p>}
          {msg?.unclear && msg.unclear.length > 0 && <p className="muted small">Not mapped: {msg.unclear.join('; ')}</p>}
        </>
      )}
    </div>
  )
}

// ---------------- measurement guides
function GuideButton({ k, open, onToggle }: { k: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`guide-btn${open ? ' on' : ''}`} onClick={onToggle} aria-expanded={open} aria-controls={`g-${k}`}
      aria-label="How to measure">
      <Info size={13} />
    </button>
  )
}

function GuideTip({ g }: { g: MetricGuide }) {
  return (
    <div className="guide-tip" role="note">
      <div><b>When</b> {g.when}</div>
      <div><b>Device</b> {g.device}</div>
      <div><b>How</b> {g.how}</div>
      <div className="esc"><b>Escalate if</b> {g.escalate}</div>
    </div>
  )
}
