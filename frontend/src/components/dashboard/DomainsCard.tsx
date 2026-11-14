import { useStore } from '../../store'
import type { Level } from '../../types'
import { Check, DOMAIN_ICON } from '../icons'

/** Domain health split (segmented bar) + the dark "Action plan" task list. */
export function DomainsCard({ onOpenDomain }: { onOpenDomain: (domain: string) => void }) {
  const { status, catalog } = useStore()
  if (!status || !catalog) return null
  const doms = Object.entries(status.domains)
  const count = (l: Level) => doms.filter(([, d]) => d.level === l).length
  const n = doms.length
  const segs = ([['ok', 'Nominal'], ['watch', 'Monitor'], ['act', 'Act now']] as const)
    .map(([lvl, label]) => ({ lvl, label, c: count(lvl) })).filter(s => s.c > 0)
  const nominalDomains = doms.filter(([, d]) => d.level === 'ok').map(([k]) => k)

  return (
    <section className="card row-span-2" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-head">
        <h2>Health domains</h2>
        <span style={{ fontSize: '2.6rem', fontWeight: 300, lineHeight: 1 }}>{count('ok')}/{n}</span>
      </div>
      <div className="seg-labels">
        {segs.map(s => <div key={s.lvl} style={{ flex: s.c }}>{Math.round((s.c / n) * 100)}%</div>)}
      </div>
      <div className="seg-bar" role="img" aria-label={segs.map(s => `${s.c} ${s.label}`).join(', ')}>
        {segs.map(s => <div key={s.lvl} className={`s-${s.lvl}`} style={{ flex: s.c }}>{s.c > 1 || n < 4 ? s.label : ''}</div>)}
      </div>

      <div className="card dark task-card">
        <div className="task-head">
          <h3>Action plan</h3>
        </div>
        <div className="task-list">
          {status.findings.map((f, i) => {
            const Icon = DOMAIN_ICON[f.domain]
            return (
              <button key={f.domain + f.title} className={`task${i === 0 ? ' top' : ''}`} onClick={() => onOpenDomain(f.domain)}>
                <span className="task-ico"><Icon /></span>
                <span className="task-txt">
                  <b>{f.title}</b>
                  <span>{catalog.domains[f.domain].name} · {f.level === 'act' ? 'Act now' : 'Monitor'}{f.escalate ? ' · notify surgeon' : ''}</span>
                </span>
                <span className={`task-state ${f.level}`} aria-label={f.level === 'act' ? 'Act now' : 'Monitor'} />
              </button>
            )
          })}
          {nominalDomains.map(k => {
            const Icon = DOMAIN_ICON[k]
            return (
              <button key={k} className="task" onClick={() => onOpenDomain(k)} style={{ opacity: 0.6 }}>
                <span className="task-ico"><Icon /></span>
                <span className="task-txt"><b style={{ textDecoration: 'line-through' }}>{catalog.domains[k].name}</b><span>Within baseline</span></span>
                <span className="task-state ok"><Check size={14} /></span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
