import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { INITIAL_STATE, type SimulationState, type StatePatch } from '../types'
import { supabase } from '../lib/supabase'

type ConnectionStatus = 'connecting' | 'connected' | 'offline'

function getInitialSessionId() {
  const url = new URL(window.location.href)
  const fromUrl = url.searchParams.get('session')
  if (fromUrl) return fromUrl
  if (url.pathname === '/monitor') {
    const randomId = globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`
    const sessionId = `sim-${randomId.slice(0, 8)}`
    url.searchParams.set('session', sessionId)
    window.history.replaceState({}, '', url)
    return sessionId
  }
  return 'sim-01'
}

export function useSimulationSession() {
  const [sessionId, setSessionId] = useState(getInitialSessionId)
  const [state, setState] = useState<SimulationState>(INITIAL_STATE)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [tutorConnected, setTutorConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const stateRef = useRef(state)
  const role = window.location.pathname === '/monitor' ? 'monitor' : 'tutor'

  const applyState = (nextState: SimulationState) => {
    stateRef.current = nextState
    setState(nextState)
  }

  useEffect(() => {
    const client = supabase
    if (client && import.meta.env.PROD) {
      let active = true
      const presenceKey = `${role}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
      const channel = client.channel(`session:${sessionId}`, { config: { presence: { key: presenceKey } } })
        .on('broadcast', { event: 'state' }, ({ payload }) => {
          if (payload?.state) applyState(payload.state as SimulationState)
        })
        .on('presence', { event: 'sync' }, () => {
          const participants = Object.values(channel.presenceState()).flat() as Array<{ role?: string }>
          setTutorConnected(participants.some((participant) => participant.role === 'tutor'))
        })
      channelRef.current = channel
      channel.subscribe(async (channelStatus) => {
        if (!active) return
        if (channelStatus === 'SUBSCRIBED') {
          setStatus('connected')
          void channel.track({ role })
          const response = await fetch(`/api/sessions?id=${encodeURIComponent(sessionId)}`)
          if (!active) return
          if (!response.ok) {
            setStatus('offline')
          } else {
            const result = await response.json() as { state: SimulationState | null }
            if (result.state) {
              applyState(result.state)
            } else {
              const createResponse = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: sessionId, state: INITIAL_STATE }),
              })
              if (!createResponse.ok) setStatus('offline')
            }
          }
        } else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') {
          setStatus('offline')
          setTutorConnected(false)
        }
      })
      return () => {
        active = false
        channelRef.current = null
        void client.removeChannel(channel)
      }
    }

    const socket = io({ path: '/socket.io', transports: ['polling'] })
    socketRef.current = socket
    socket.on('connect', () => {
      setStatus('connected')
      socket.emit('join-session', { id: sessionId, role })
    })
    socket.on('disconnect', () => {
      setStatus('offline')
      setTutorConnected(false)
    })
    socket.on('connect_error', () => {
      setStatus('offline')
      setTutorConnected(false)
    })
    socket.on('tutor-presence', ({ connected }: { connected: boolean }) => setTutorConnected(connected))
    socket.on('session-state', (nextState: SimulationState) => applyState(nextState))
    socket.on('state-updated', (nextState: SimulationState) => applyState(nextState))

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [role, sessionId])

  const update = (patch: StatePatch) => {
    const nextState = { ...stateRef.current, ...patch }
    applyState(nextState)
    if (supabase && import.meta.env.PROD) {
      void fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sessionId, state: nextState }),
      }).then((response) => {
        if (!response.ok) setStatus('offline')
      }).catch(() => setStatus('offline'))
      void channelRef.current?.send({ type: 'broadcast', event: 'state', payload: { state: nextState } })
    } else {
      socketRef.current?.emit('update-state', patch)
    }
  }

  const joinSession = (nextId: string) => {
    const normalized = nextId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24)
    if (!normalized || normalized === sessionId) return
    const url = new URL(window.location.href)
    url.searchParams.set('session', normalized)
    window.history.replaceState({}, '', url)
    stateRef.current = INITIAL_STATE
    setState(INITIAL_STATE)
    setSessionId(normalized)
  }

  return { sessionId, state, status, tutorConnected, update, joinSession }
}
