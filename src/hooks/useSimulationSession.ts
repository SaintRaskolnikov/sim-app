import { useEffect, useId, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { getMonitorAuthHeaders } from '../lib/neonAuth'
import { INITIAL_STATE, type SimulationState, type StatePatch } from '../types'

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

export function useSimulationSession(enabled = true) {
  const [sessionId, setSessionId] = useState(getInitialSessionId)
  const [state, setState] = useState<SimulationState>(INITIAL_STATE)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [tutorConnected, setTutorConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const stateRef = useRef(state)
  const clientId = useId().replace(/:/g, '')
  const lastLocalUpdateAt = useRef(0)
  const updateRevision = useRef(0)
  const role = window.location.pathname === '/monitor' ? 'monitor' : 'tutor'

  const applyState = (nextState: SimulationState) => {
    stateRef.current = nextState
    setState(nextState)
  }

  useEffect(() => {
    if (!enabled) return
    if (import.meta.env.PROD) {
      let active = true
      let timer = 0
      const pollSession = async () => {
        try {
          const params = new URLSearchParams({ id: sessionId, role, clientId })
          const headers = role === 'monitor' ? await getMonitorAuthHeaders() : {}
          const response = await fetch(`/api/sessions?${params}`, { headers })
          if (!response.ok) throw new Error('Session request failed')
          const result = await response.json() as { state: SimulationState; tutorConnected: boolean }
          if (!active) return
          setStatus('connected')
          setTutorConnected(result.tutorConnected)
          if (role === 'monitor' || Date.now() - lastLocalUpdateAt.current > 900) applyState(result.state)
        } catch {
          if (active) {
            setStatus('offline')
            setTutorConnected(false)
          }
        }
        if (active) timer = window.setTimeout(pollSession, 700)
      }
      void pollSession()
      return () => {
        active = false
        window.clearTimeout(timer)
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
  }, [clientId, enabled, role, sessionId])

  const update = (patch: StatePatch) => {
    const nextState = { ...stateRef.current, ...patch }
    applyState(nextState)
    if (import.meta.env.PROD) {
      lastLocalUpdateAt.current = Date.now()
      const revision = ++updateRevision.current
      void (async () => {
        try {
          const headers = role === 'monitor' ? await getMonitorAuthHeaders() : {}
          const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ id: sessionId, patch, role, clientId }),
          })
          if (!response.ok) throw new Error('Session update failed')
          const result = await response.json() as { state: SimulationState }
          if (revision === updateRevision.current) applyState(result.state)
          setStatus('connected')
        } catch {
          setStatus('offline')
        }
      })()
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
