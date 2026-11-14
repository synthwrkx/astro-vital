// Camera input: attach photos (e.g. a rash or cold sore) to a check-in date. Images are downscaled
// on-device before upload and stay in the onboard database; the downlink report lists them.
import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { useStore } from '../store'
import type { Photo } from '../types'
import { Camera } from './icons'

const MAX_SIDE = 1280

async function downscale(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.82)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function PhotoCapture({ date }: { date: string }) {
  const { catalog, toast } = useStore()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [tag, setTag] = useState('rash')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { api.photos(date).then(setPhotos, () => setPhotos([])) }, [date])

  async function onFile(f: File | undefined) {
    if (!f) return
    setBusy(true)
    try {
      const data_url = await downscale(f)
      const p = await api.addPhoto({ date, tag, note: note || undefined, data_url })
      setPhotos(ps => [...ps, p]); setNote('')
      toast('Photo attached to this check-in.')
    } catch (e) {
      toast(`Photo failed: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number) {
    await api.deletePhoto(id)
    setPhotos(ps => ps.filter(p => p.id !== id))
  }

  const tags = [...(catalog?.symptoms.filter(s => ['rash', 'cold_sore', 'wound', 'vision'].includes(s.id)) ?? []), { id: 'other', label: 'Other' }]
  return (
    <div className="photo-capture">
      <div className="pc-controls">
        <select value={tag} onChange={e => setTag(e.target.value)} aria-label="What the photo shows">
          {tags.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <input type="text" className="pc-note" placeholder="Note (optional), e.g. left forearm, day 2" value={note} maxLength={500}
          onChange={e => setNote(e.target.value)} />
        <button type="button" className="btn primary" onClick={() => input.current?.click()} disabled={busy}>
          <Camera size={16} /> {busy ? 'Saving…' : 'Take / add photo'}
        </button>
        <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {photos.length > 0 && (
        <div className="pc-thumbs">
          {photos.map(p => (
            <figure key={p.id}>
              <a href={api.photoUrl(p.id)} target="_blank" rel="noreferrer"><img src={api.photoUrl(p.id)} alt={`${p.tag} photo`} /></a>
              <figcaption>{catalog?.symptoms.find(s => s.id === p.tag)?.label ?? p.tag}{p.note ? ` · ${p.note}` : ''}</figcaption>
              <button type="button" className="icon-btn" onClick={() => remove(p.id)} aria-label="Delete photo">✕</button>
            </figure>
          ))}
        </div>
      )}
      <p className="muted small" style={{ margin: '8px 0 0' }}>Photograph the same spot daily in similar light so changes are easy to compare. Photos stay onboard; the downlink report lists them for the flight surgeon.</p>
    </div>
  )
}
