// Loads today's routine; refreshes whenever check-in data changes.
import { useEffect, useState } from 'react'
import { api } from '../api'
import { useStore } from '../store'
import type { Routine } from '../types'

export function useRoutine() {
  const { entries, settings } = useStore()
  const [routine, setRoutine] = useState<Routine | null>(null)
  useEffect(() => {
    let live = true
    api.routine().then(r => live && setRoutine(r), () => live && setRoutine(null))
    return () => { live = false }
  }, [entries, settings])
  return routine
}
