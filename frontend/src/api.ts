// Thin typed client for the AstroVital API. All paths are relative (/api/...) so the
// Vite dev proxy and the production build served by FastAPI both work.
import type { AiStatus, Briefing, Catalog, ChatMessage, CheckinDraft, Entry, Evaluation, Photo, Routine, Settings, Timeline } from './types'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
  } catch {
    throw new ApiError(0, 'Cannot reach the AstroVital server. Is the backend running?')
  }
  if (!res.ok) {
    let msg = res.statusText
    try {
      const body = await res.json()
      msg = typeof body.detail === 'string' ? body.detail
        : Array.isArray(body.detail) ? body.detail.map((d: { msg: string }) => d.msg.replace(/^Value error, /, '')).join('; ')
        : msg
    } catch { /* non-JSON error */ }
    throw new ApiError(res.status, msg)
  }
  if (res.status === 204) return undefined as T
  const type = res.headers.get('content-type') || ''
  return (type.includes('application/json') ? res.json() : res.text()) as Promise<T>
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) })

export const api = {
  catalog: () => req<Catalog>('/api/catalog'),
  settings: () => req<Settings>('/api/settings'),
  saveSettings: (s: Settings) => req<Settings>('/api/settings', json('PUT', s)),
  entries: () => req<Entry[]>('/api/entries'),
  saveEntry: (e: Entry) => req<Evaluation>(`/api/entries/${e.date}`, json('PUT', e)),
  patchEntry: (date: string, fields: Partial<Entry>) => req<Entry>(`/api/entries/${date}`, json('PATCH', fields)),
  deleteEntry: (date: string) => req<void>(`/api/entries/${date}`, json('DELETE')),
  status: () => req<Evaluation>('/api/status'),
  report: () => req<string>('/api/report'),
  timeline: () => req<Timeline>('/api/timeline'),
  routine: () => req<Routine>('/api/routine'),
  photos: (day?: string) => req<Photo[]>(`/api/photos${day ? `?day=${day}` : ''}`),
  addPhoto: (body: { date: string; tag: string; note?: string; data_url: string }) => req<Photo>('/api/photos', json('POST', body)),
  deletePhoto: (id: number) => req<void>(`/api/photos/${id}`, json('DELETE')),
  photoUrl: (id: number) => `/api/photos/${id}`,
  exportData: () => req<{ settings: Settings; entries: Entry[] }>('/api/export'),
  importData: (data: unknown) => req<{ imported: number }>('/api/import', json('POST', data)),
  loadDemo: () => req<{ imported: number }>('/api/demo', json('POST')),
  clearAll: () => req<void>('/api/data', json('DELETE')),
  ai: {
    status: () => req<AiStatus>('/api/ai/status'),
    briefing: () => req<Briefing>('/api/ai/briefing', json('POST')),
    chat: (messages: ChatMessage[]) =>
      req<{ reply: string; sources: string[] }>('/api/ai/chat', json('POST', { messages: messages.map(({ role, content }) => ({ role, content })) })),
    parseCheckin: (text: string) => req<CheckinDraft>('/api/ai/parse-checkin', json('POST', { text })),
    surgeonReport: () => req<{ markdown: string }>('/api/ai/surgeon-report', json('POST')),
  },
}
