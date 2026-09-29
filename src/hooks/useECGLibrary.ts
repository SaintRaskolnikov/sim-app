import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { allPatterns, type ECGMorphology, type ECGPattern } from '../data/ecgLibrary'
import { supabase } from '../lib/supabase'

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
  morphology: (pattern.morphology ?? inferredMorphology[pattern.id] ?? pattern.rhythm) as ECGMorphology,
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

  useEffect(() => {
    if (!enabled) return
    const client = supabase
    if (client && import.meta.env.PROD) {
      let active = true
      const load = async () => {
        const response = await fetch('/api/ecg-library')
        if (!active || !response.ok) return
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
        setCurrent(loaded.map(normalize))
      }
      const channel = client.channel('ecg-library-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ecg_patterns' }, () => void load())
        .subscribe()
      void load().catch(() => undefined)
      return () => {
        active = false
        void client.removeChannel(channel)
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
        setCurrent(next.map(normalize))
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
    if (supabase && import.meta.env.PROD) {
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
    if (supabase && import.meta.env.PROD) {
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
