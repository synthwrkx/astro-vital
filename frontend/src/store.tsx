// App-wide data: catalog, settings, entries and the server-side evaluation.
// Pages call refresh() after any mutation so everything stays consistent with the backend.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import type { AiStatus, Catalog, Entry, Evaluation, Settings } from './types'

interface Store {
  catalog: Catalog | null
  settings: Settings | null
  entries: Entry[]
  status: Evaluation | null
  ai: AiStatus
  error: string | null
  loading: boolean
  refresh: () => Promise<void>
  toast: (msg: string) => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [status, setStatus] = useState<Evaluation | null>(null)
  const [ai, setAi] = useState<AiStatus>({ enabled: false, model: '', version: '', offline: true, reason: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [s, e, st] = await Promise.all([api.settings(), api.entries(), api.status()])
      setSettings(s); setEntries(e); setStatus(st); setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const [c, a] = await Promise.all([api.catalog(), api.ai.status()])
        setCatalog(c); setAi(a)
        await refresh()
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [refresh])

  const toast = useCallback((msg: string) => {
    setToastMsg(msg)
    window.setTimeout(() => setToastMsg(m => (m === msg ? null : m)), 3800)
  }, [])

  return (
    <Ctx.Provider value={{ catalog, settings, entries, status, ai, error, loading, refresh, toast }}>
      {children}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </Ctx.Provider>
  )
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
