import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { Atom, Brain, Dumbbell, Eye, Heart, Sparkle } from '../components/icons'
import { AiOffNote, Markdown, Spinner } from '../components/ui'
import { useStore } from '../store'
import type { ChatMessage } from '../types'

const SUGGESTIONS = [
  { q: 'Why is my status what it is today?', Icon: Heart },
  { q: 'How has my sleep affected my alertness over the last two weeks?', Icon: Brain },
  { q: 'Am I keeping up with exercise to protect my bones?', Icon: Dumbbell },
  { q: 'Have my headaches followed a pattern?', Icon: Eye },
  { q: 'What happened around the radiation spike?', Icon: Atom },
  { q: 'What should I focus on this week?', Icon: Sparkle },
]

export default function Copilot() {
  const { ai, entries } = useStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, busy])

  async function send(text: string) {
    const q = text.trim()
    if (!q || busy) return
    const next: ChatMessage[] = [...messages, { role: 'user', content: q }]
    setMessages(next); setInput(''); setBusy(true); setError(null)
    try {
      const r = await api.ai.chat(next.slice(-20))
      setMessages([...next, { role: 'assistant', content: r.reply, sources: r.sources }])
    } catch (e) {
      setError((e as Error).message)
      setMessages(messages) // roll back the unanswered question
      setInput(q)
    } finally {
      setBusy(false)
    }
  }

  const ready = ai.enabled && entries.length > 0
  const asked = new Set(messages.filter(m => m.role === 'user').map(m => m.content))

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">AI Copilot</h1>
        {messages.length > 0 && <button className="btn" onClick={() => setMessages([])}>New conversation</button>}
      </div>
      <div className="copilot">
        <section className="card">
          <div className="card-head">
            <div>
              <h2><Sparkle /> Health copilot</h2>
              <div className="muted small">Answers from your own records using the onboard model, fully offline. Not a doctor; never overrides the rule engine.</div>
            </div>
          </div>
          {!ai.enabled ? <AiOffNote /> : !entries.length ? <p className="muted">Record a check-in or load the demo mission first.</p> : (
            <>
              <div className="chat-log" aria-live="polite">
                {messages.length === 0 && <p className="muted">Ask anything about your health, or pick a question on the right.</p>}
                {messages.map((m, i) => (
                  <div key={i} className={`bubble ${m.role}`}>
                    {m.role === 'assistant' ? <Markdown>{m.content}</Markdown> : m.content}
                    {m.sources && m.sources.length > 0 && <div className="sources">Looked up: {m.sources.join(' · ')}</div>}
                  </div>
                ))}
                {busy && <Spinner label="Checking your records…" />}
                <div ref={end} />
              </div>
              {error && <p className="error-text">{error}</p>}
              <form className="chat-input" onSubmit={e => { e.preventDefault(); send(input) }}>
                <textarea value={input} onChange={e => setInput(e.target.value)} rows={1} maxLength={2000}
                  placeholder="Ask about your health…" aria-label="Message"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }} />
                <button className="btn primary" type="submit" disabled={busy || !input.trim()}>Send</button>
              </form>
            </>
          )}
        </section>

        <aside className="card dark">
          <div className="task-head">
            <h3>Try asking</h3>
            <span className="count">{[...asked].filter(q => SUGGESTIONS.some(s => s.q === q)).length}/{SUGGESTIONS.length}</span>
          </div>
          <div className="suggestions">
            {SUGGESTIONS.map(({ q, Icon }) => (
              <button key={q} className="chip" onClick={() => send(q)} disabled={!ready || busy} style={asked.has(q) ? { opacity: 0.55 } : undefined}>
                <span className="task-ico" style={{ width: 34, height: 34 }}><Icon size={16} /></span>{q}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </>
  )
}
