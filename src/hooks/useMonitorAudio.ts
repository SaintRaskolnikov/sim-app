import { useEffect, useRef, useState } from 'react'
import type { ActiveAlarm, SimulationState } from '../types'

function playTone(context: AudioContext, frequency: number, duration: number, type: OscillatorType, volume: number) {
  const start = context.currentTime
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(start)
  oscillator.stop(start + duration)
}

export function useMonitorAudio(state: SimulationState, activeAlarms: ActiveAlarm[]) {
  const [enabled, setEnabled] = useState(false)
  const contextRef = useRef<AudioContext | null>(null)
  const stateRef = useRef(state)
  const alarmsRef = useRef(activeAlarms)
  const nextBeatAt = useRef(0)
  const nextAlarmAt = useRef(0)

  useEffect(() => {
    stateRef.current = state
    alarmsRef.current = activeAlarms
  }, [activeAlarms, state])

  useEffect(() => {
    const context = contextRef.current
    if (!enabled || !context) return
    nextBeatAt.current = performance.now()
    nextAlarmAt.current = 0
    const timer = window.setInterval(() => {
      const now = performance.now()
      const current = stateRef.current
      if (current.pulsePresent && current.heartRate > 0 && current.spo2 > 0 && now >= nextBeatAt.current) {
        const frequency = Math.max(300, Math.min(1000, 350 + current.spo2 * 6))
        playTone(context, frequency, 0.075, 'sine', 0.13)
        nextBeatAt.current = now + 60000 / current.heartRate
      }
      if (alarmsRef.current.length && now >= nextAlarmAt.current) {
        playTone(context, 880, 0.12, 'square', 0.055)
        window.setTimeout(() => playTone(context, 660, 0.12, 'square', 0.055), 180)
        nextAlarmAt.current = now + 1400
      }
    }, 30)
    return () => window.clearInterval(timer)
  }, [enabled])

  const toggle = async () => {
    try {
      if (enabled) {
        setEnabled(false)
        await contextRef.current?.suspend()
        return
      }
      const context = contextRef.current ?? new AudioContext()
      contextRef.current = context
      await context.resume()
      setEnabled(true)
    } catch {
      setEnabled(false)
    }
  }

  return { enabled, toggle }
}