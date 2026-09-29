import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { DEFAULT_SCENARIO_PRESETS, type ScenarioPreset } from '../data/scenarioPresets'
import { supabase } from '../lib/supabase'

function mergeDefaults(saved: ScenarioPreset[]) {
  const ids = new Set(saved.map((preset) => preset.id))
  return [...saved, ...DEFAULT_SCENARIO_PRESETS.filter((preset) => !ids.has(preset.id))]
}

export function useScenarioPresets(enabled = true) {
  const [presets, setPresets] = useState(DEFAULT_SCENARIO_PRESETS)
  const presetsRef = useRef(presets)
  const socketRef = useRef<Socket | null>(null)
  const setCurrent = (next: ScenarioPreset[]) => {
    presetsRef.current = next
    setPresets(next)
  }

  useEffect(() => {
    if (!enabled) return
    const client = supabase
    if (client && import.meta.env.PROD) {
      let active = true
      const load = async () => {
        const response = await fetch('/api/scenario-presets')
        if (!active || !response.ok) return
        const saved = await response.json() as ScenarioPreset[]
        const merged = mergeDefaults(saved)
        if (saved.length === 0) {
          await fetch('/api/scenario-presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ presets: merged }) })
        } else if (merged.length > saved.length) {
          await fetch('/api/scenario-presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ presets: merged }) })
        }
        if (active) setCurrent(merged)
      }
      const channel = client.channel('scenario-presets-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'scenario_presets' }, () => void load())
        .subscribe()
      void load().catch(() => undefined)
      return () => {
        active = false
        void client.removeChannel(channel)
      }
    }

    const socket = io({ path: '/socket.io', transports: ['polling'] })
    socketRef.current = socket
    socket.on('connect', () => socket.emit('get-scenario-presets'))
    socket.on('scenario-presets-state', (saved: ScenarioPreset[]) => {
      if (!Array.isArray(saved) || saved.length === 0) {
        setCurrent(DEFAULT_SCENARIO_PRESETS)
        socket.emit('save-scenario-presets', DEFAULT_SCENARIO_PRESETS)
        return
      }
      const merged = mergeDefaults(saved)
      setCurrent(merged)
      if (merged.length > saved.length) socket.emit('save-scenario-presets', merged)
    })
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [enabled])

  const savePreset = (preset: ScenarioPreset) => {
    const index = presetsRef.current.findIndex((item) => item.id === preset.id)
    const next = [...presetsRef.current]
    if (index === -1) next.push(preset)
    else next[index] = preset
    setCurrent(next)
    if (supabase && import.meta.env.PROD) {
      void fetch('/api/scenario-presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ presets: next }) })
    } else {
      socketRef.current?.emit('save-scenario-presets', next)
    }
  }

  const deletePreset = (id: string) => {
    const next = presetsRef.current.filter((preset) => preset.id !== id)
    setCurrent(next)
    if (supabase && import.meta.env.PROD) {
      void fetch('/api/scenario-presets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    } else {
      socketRef.current?.emit('save-scenario-presets', next)
    }
  }

  return { presets, savePreset, deletePreset }
}
