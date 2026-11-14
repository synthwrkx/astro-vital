import { useEffect, useState } from 'react'
import { api } from '../../api'
import { download } from '../../lib/download'
import { todayStr } from '../../lib/format'
import { useStore } from '../../store'
import { Markdown, Modal, Spinner } from '../ui'

export type ReportKind = 'plain' | 'ai'

export function ReportModal({ kind, onClose }: { kind: ReportKind; onClose: () => void }) {
  const { toast } = useStore()
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    ;(kind === 'plain' ? api.report() : api.ai.surgeonReport().then(r => r.markdown))
      .then(t => live && setText(t), e => live && setError((e as Error).message))
    return () => { live = false }
  }, [kind])

  return (
    <Modal title={kind === 'plain' ? 'Downlink health report' : 'Flight-surgeon report'} onClose={onClose}>
      <p className="muted small">
        {kind === 'plain'
          ? 'Compact deterministic summary for low-bandwidth, delayed comms.'
          : 'Clinical summary generated onboard from your data, rule-engine findings, anomaly scores and forecasts. Review before sending.'}
      </p>
      {error ? <p className="error-text">{error}</p>
        : text === null ? <Spinner label="Generating report…" />
        : kind === 'plain' ? <textarea className="report" readOnly value={text} />
        : <Markdown>{text}</Markdown>}
      {text && (
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={() => navigator.clipboard.writeText(text).then(() => toast('Report copied.'))}>Copy</button>
          <button className="btn" onClick={() => download(`astrovital-report-${todayStr()}.${kind === 'ai' ? 'md' : 'txt'}`, text)}>Download</button>
        </div>
      )}
    </Modal>
  )
}
