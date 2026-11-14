import { useEffect, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts'
import type { Level } from '../types'
import { useStore } from '../store'

const LABEL: Record<Level, string> = { ok: 'Nominal', watch: 'Monitor', act: 'Act now' }

export function Pill({ level }: { level: Level }) {
  return <span className={`pill ${level}`}>{LABEL[level]}</span>
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="modal" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="circle-btn" onClick={onClose} aria-label="Close">✕</button></div>
        {children}
      </div>
    </div>
  )
}

export function Sparkline({ values }: { values: (number | undefined)[] }) {
  const data = values.map((v, i) => ({ i, v })).filter(d => typeof d.v === 'number')
  if (data.length < 2) return <div style={{ height: 28 }} />
  return (
    <div style={{ height: 28 }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 3, bottom: 3, left: 0, right: 0 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line dataKey="v" stroke="var(--accent)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Markdown({ children }: { children: string }) {
  return <div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown></div>
}

export function Spinner({ label }: { label: string }) {
  return <div className="spinner-row"><span className="spinner" aria-hidden="true" />{label}</div>
}

/** Shown in place of an AI control when the onboard model bundle is not installed. */
export function AiOffNote() {
  const { ai } = useStore()
  return (
    <p className="muted small ai-off">
      Onboard AI is unavailable{ai.reason ? `: ${ai.reason}` : '.'} All rule-engine monitoring still works.
    </p>
  )
}
