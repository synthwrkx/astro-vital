import { useStore } from '../../store'
import type { Finding } from '../../types'
import { Check, DOMAIN_ICON } from '../icons'
import { Modal } from '../ui'

const LEVEL_TEXT = { ok: 'Nominal', watch: 'Monitor', act: 'Act now' } as const

/** One finding as a card: domain icon, level chip, title, data line, then a checklist of actions. */
export function FindingCard({ f, dark = false }: { f: Finding; dark?: boolean }) {
  const Icon = DOMAIN_ICON[f.domain]
  return (
    <article className={`fcard${dark ? ' dark' : ''}`}>
      <header className="fcard-head">
        <span className="fcard-ico"><Icon /></span>
        <div className="fcard-title">
          <h3>{f.title}</h3>
          <p>{f.detail}</p>
        </div>
        <div className="fcard-badges">
          <span className={`lvl-chip ${f.level}`}>{LEVEL_TEXT[f.level]}</span>
          {f.escalate && <span className="surgeon-chip">Notify surgeon</span>}
        </div>
      </header>
      {f.evidence && <p className="fcard-evidence"><span>Why this matters</span>{f.evidence}</p>}
      <ul className="fcard-actions">
        {f.actions.map((a, i) => (
          <li key={a}><span className="step">{i + 1}</span>{a}</li>
        ))}
      </ul>
    </article>
  )
}

/** Domain detail: header with icon + counts, most severe finding on a dark card, the rest light. */
export function DomainModal({ domain, onClose }: { domain: string; onClose: () => void }) {
  const { status, catalog } = useStore()
  if (!status || !catalog) return null
  const d = catalog.domains[domain]
  const findings = status.domains[domain].findings
  const nAct = findings.filter(f => f.level === 'act').length
  const Icon = DOMAIN_ICON[domain]

  return (
    <Modal title={d.name} onClose={onClose}>
      <div className="dmodal-head">
        <span className="circle-btn dark" style={{ width: 52, height: 52 }}><Icon size={22} /></span>
        <p className="muted">{d.blurb}</p>
        <div className="dmodal-count">
          <span className="num">{findings.length}</span>
          <span className="muted small">finding{findings.length === 1 ? '' : 's'}{nAct ? ` · ${nAct} act now` : ''}</span>
        </div>
      </div>
      {findings.length === 0 ? (
        <div className="fcard ok-card"><span className="task-state ok"><Check size={14} /></span> All indicators in this domain are within your personal baseline.</div>
      ) : (
        <div className="fcard-list">
          {findings.map((f, i) => <FindingCard key={f.title} f={f} dark={i === 0 && f.level === 'act'} />)}
        </div>
      )}
    </Modal>
  )
}
