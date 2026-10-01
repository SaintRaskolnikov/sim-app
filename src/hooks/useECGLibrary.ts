import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { allPatterns, type ECGMorphology, type ECGPattern } from '../data/ecgLibrary'

const inferredMorphology: Record<string, string> = {
  'normal-sinus': 'normal',
  'stemi-anterior': 'stemi-anterior',
  'stemi-inferior': 'stemi-inferior',
  'stemi-lateral': 'stemi-lateral',
  pericarditis: 'pericarditis',
  lvh: 'lvh',
  lbbb: 'lbbb',
  'afib-12': 'afib',
}

const defaults: ECGPattern[] = allPatterns.map((pattern) => ({
  ...pattern,
  morphology: (pattern.morphology ?? inferredMorphology[pattern.id] ?? (pattern.rhythm === 'sinus' ? 'normal' : pattern.rhythm)) as ECGMorphology,
}))

function normalize(pattern: ECGPattern): ECGPattern {
  const builtin = allPatterns.find((item) => item.id === pattern.id)
  const fallbackMorphology = pattern.rhythm === 'sinus' ? 'normal' : pattern.rhythm
  return {
    ...pattern,
    suggestedRate: pattern.suggestedRate ?? builtin?.suggestedRate,
    morphology: pattern.morphology ?? (inferredMorphology[pattern.id] as ECGMorphology | undefined) ?? fallbackMorphology,
  }
}

export function useECGLibrary(enabled = true) {
  const [patterns, setPatterns] = useState<ECGPattern[]>(defaults)
  const patternsRef = useRef(patterns)
  const socketRef = useRef<Socket | null>(null)
  const setCurrent = (next: ECGPattern[]) => {
    patternsRef.current = next
    setPatterns(next)
  }
  const mergeBuiltins = (loaded: ECGPattern[]) => {
    const normalized = loaded.map(normalize)
    const knownIds = new Set(normalized.map((pattern) => pattern.id))
    return [...normalized, ...defaults.filter((pattern) => !knownIds.has(pattern.id))]
  }

  useEffect(() => {
    if (!enabled) return
    if (import.meta.env.PROD) {
      let active = true
      let timer = 0
      const load = async () => {
        try {
          const response = await fetch('/api/ecg-library')
          if (!active || !response.ok) throw new Error('ECG library request failed')
          const loaded = await response.json() as ECGPattern[]
          if (loaded.length === 0) {
            await fetch('/api/ecg-library', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ patterns: defaults }),
            })
            if (active) setCurrent(defaults)
            return
          }
          const merged = mergeBuiltins(loaded)
          const loadedIds = new Set(loaded.map((pattern) => pattern.id))
          const addedBuiltins = merged.filter((pattern) => !loadedIds.has(pattern.id))
          if (addedBuiltins.length > 0) {
            await fetch('/api/ecg-library', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ patterns: addedBuiltins }),
            })
          }
          if (active) setCurrent(merged)
        } catch {
          // Retain the last known catalog if the polling request fails.
        } finally {
          if (active) timer = window.setTimeout(load, 2500)
        }
      }
      void load().catch(() => undefined)
      return () => {
        active = false
        window.clearTimeout(timer)
      }
    }

    const socket = io({ path: '/socket.io', transports: ['polling'] })
    socketRef.current = socket
    socket.on('connect', () => socket.emit('get-library'))
    socket.on('library-state', (next: ECGPattern[]) => {
      if (!Array.isArray(next) || next.length === 0) {
        setCurrent(defaults)
        socket.emit('save-library', defaults)
      } else {
        const merged = mergeBuiltins(next)
        setCurrent(merged)
        if (merged.length > next.length) socket.emit('save-library', merged)
      }
    })
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [enabled])

  const savePattern = (pattern: ECGPattern) => {
    const existingIndex = patternsRef.current.findIndex((item) => item.id === pattern.id)
    const next = [...patternsRef.current]
    if (existingIndex === -1) next.push(pattern)
    else next[existingIndex] = pattern
    setCurrent(next)
    if (import.meta.env.PROD) {
      void fetch('/api/ecg-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patterns: next }),
      })
    } else {
      socketRef.current?.emit('save-library', next)
    }
  }

  const deletePattern = (id: string) => {
    const next = patternsRef.current.filter((pattern) => pattern.id !== id)
    setCurrent(next)
    if (import.meta.env.PROD) {
      void fetch('/api/ecg-library', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } else {
      socketRef.current?.emit('save-library', next)
    }
  }

  return { patterns, savePattern, deletePattern }
}
