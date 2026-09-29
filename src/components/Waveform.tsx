import { useEffect, useRef } from 'react'
import type { ECGPattern } from '../data/ecgLibrary'
import type { SimulationState } from '../types'

type WaveKind = 'ecg' | 'pressure' | 'pleth' | 'capno'

interface WaveformProps {
  kind: WaveKind
  color: string
  state: SimulationState
  height?: number
}

const gaussian = (phase: number, center: number, width: number) =>
  Math.exp(-Math.pow((phase - center) / width, 2))

const beatPhase = (time: number, rate: number, irregular = false) => {
  if (rate <= 0) return 0
  const beat = time * rate / 60
  const jitter = irregular ? Math.sin(Math.floor(beat) * 12.9898) * 0.12 : 0
  return ((beat + jitter) % 1 + 1) % 1
}

function ecgSample(time: number, state: SimulationState, pattern?: ECGPattern, leadIndex = 0) {
  const rhythm = pattern?.rhythm ?? state.rhythm
  const morphology = pattern?.morphology ?? pattern?.id
  const rate = state.heartRate
  if (rhythm === 'asystole') return Math.sin(time * 2.1) * 0.012
  if (rhythm === 'vfib') return (Math.sin(time * 17 + Math.sin(time * 5) * 3) * 0.19 + Math.sin(time * 31) * 0.08) * (0.65 + Math.sin(time * 2) * 0.2)
  if (rate <= 0) return Math.sin(time * 2.1) * 0.012

  const phase = beatPhase(time, rate, rhythm === 'afib')
  let value = 0
  if (rhythm === 'vtach') {
    value = gaussian(phase, 0.32, 0.105) * 0.9 - gaussian(phase, 0.43, 0.09) * 0.42 + gaussian(phase, 0.67, 0.12) * 0.12
  } else {
    if (rhythm !== 'afib') value += gaussian(phase, 0.17, 0.035) * 0.12
    value -= gaussian(phase, 0.335, 0.014) * 0.14
    value += gaussian(phase, 0.365, rhythm === 'bradycardia' ? 0.022 : 0.014) * 0.92
    value -= gaussian(phase, 0.397, 0.019) * 0.24
    value += gaussian(phase, 0.65, 0.075) * 0.25
  }

  const leadName = ['I', 'aVR', 'V1', 'V4', 'II', 'aVL', 'V2', 'V5', 'III', 'aVF', 'V3', 'V6'][leadIndex] ?? 'II'
  const stemiLeads: Record<string, string[]> = {
    'stemi-anterior': ['V1', 'V2', 'V3', 'V4'],
    'stemi-inferior': ['II', 'III', 'aVF'],
    'stemi-lateral': ['I', 'aVL', 'V5', 'V6'],
    pericarditis: ['I', 'II', 'III', 'aVL', 'aVF', 'V2', 'V3', 'V4', 'V5', 'V6'],
  }
  const stLeads = morphology ? stemiLeads[morphology] : undefined
  if (stLeads?.includes(leadName) && phase > 0.43 && phase < 0.61) value += morphology === 'pericarditis' ? 0.16 : 0.32
  if (morphology === 'lvh') value *= 1.45
  if (morphology === 'lbbb') value = gaussian(phase, 0.38, 0.085) * 0.7 - gaussian(phase, 0.49, 0.08) * 0.3 + gaussian(phase, 0.69, 0.1) * 0.17
  if (morphology === 'stemi-inferior' && ['aVR', 'aVL'].includes(leadName) && phase > 0.43 && phase < 0.61) value -= 0.12
  return value
}

function sample(kind: WaveKind, time: number, state: SimulationState) {
  if (kind === 'ecg') return ecgSample(time, state)
  if (kind === 'pressure') {
    if (state.systolic === 0) return Math.sin(time * 2) * 0.01
    const phase = beatPhase(time, state.heartRate)
    const pulse = phase < 0.18 ? phase / 0.18 : Math.exp(-(phase - 0.18) * 3.2)
    const normalizedPulse = (pulse - 0.43) * 1.5
    const relativePulse = (state.systolic - state.diastolic) / 60
    return -0.55 + normalizedPulse * Math.min(relativePulse, 1.35)
  }
  if (kind === 'pleth') {
    if (state.spo2 === 0 || state.heartRate === 0) return Math.sin(time * 1.7) * 0.015
    const phase = beatPhase(time, state.heartRate)
    const upstroke = phase < 0.18 ? Math.pow(phase / 0.18, 1.8) : Math.exp(-(phase - 0.18) * 4.2)
    const notch = Math.exp(-Math.pow((phase - 0.38) / 0.035, 2)) * 0.11
    const amplitude = 0.18 + state.spo2 / 100 * 0.5
    return (upstroke - notch - 0.42) * amplitude * 1.8
  }
  if (state.respiratoryRate === 0) return Math.sin(time * 2) * 0.01
  const phase = ((time * state.respiratoryRate / 60) % 1 + 1) % 1
  let capno = 0
  if (phase >= 0.1 && phase < 0.2) capno = ((phase - 0.1) / 0.1) * 0.72
  else if (phase >= 0.2 && phase < 0.7) capno = 0.72 - ((phase - 0.2) / 0.5) * 0.08
  else if (phase >= 0.7 && phase < 0.77) capno = 0.64 * (1 - (phase - 0.7) / 0.07)
  return (capno - 0.34) * Math.min(state.etco2 / 35, 1.6)
}

function setupCanvas(canvas: HTMLCanvasElement) {
  const bounds = canvas.getBoundingClientRect()
  const ratio = window.devicePixelRatio || 1
  const width = Math.max(1, Math.floor(bounds.width * ratio))
  const height = Math.max(1, Math.floor(bounds.height * ratio))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const context = canvas.getContext('2d')
  context?.setTransform(ratio, 0, 0, ratio, 0, 0)
  return { context, width: bounds.width, height: bounds.height }
}

export function Waveform({ kind, color, state, height = 110 }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let frame = 0
    const draw = () => {
      const { context, width, height: canvasHeight } = setupCanvas(canvas)
      if (!context) return
      context.clearRect(0, 0, width, canvasHeight)
      context.strokeStyle = 'rgba(255,255,255,.055)'
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(0, canvasHeight / 2)
      context.lineTo(width, canvasHeight / 2)
      context.stroke()
      context.strokeStyle = color
      context.lineWidth = 2
      context.lineJoin = 'round'
      context.beginPath()
      const now = performance.now() / 1000
      const maxAmplitude = canvasHeight * 0.36
      for (let x = 0; x <= width; x += 2) {
        const sampleTime = now - (width - x) / 52
        const value = sample(kind, sampleTime, state)
        const y = canvasHeight / 2 - value * maxAmplitude
        if (x === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      }
      context.stroke()
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [color, kind, state])

  return <canvas ref={canvasRef} className="wave-canvas" style={{ height }} aria-label={`${kind} waveform`} />
}

const leads = ['I', 'aVR', 'V1', 'V4', 'II', 'aVL', 'V2', 'V5', 'III', 'aVF', 'V3', 'V6']
const leadScale = [0.72, -0.48, -0.5, 0.95, 1, 0.42, 0.32, 0.88, 0.58, 0.74, 0.78, 0.78]

export function TwelveLeadCanvas({ state, pattern }: { state: SimulationState; pattern: ECGPattern }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const draw = () => {
      const { context, width, height } = setupCanvas(canvas)
      if (!context) return
      context.fillStyle = '#fff9f7'
      context.fillRect(0, 0, width, height)
      for (let x = 0; x <= width; x += 8) {
        context.strokeStyle = x % 40 === 0 ? 'rgba(197,88,83,.28)' : 'rgba(197,88,83,.11)'
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, height)
        context.stroke()
      }
      for (let y = 0; y <= height; y += 8) {
        context.strokeStyle = y % 40 === 0 ? 'rgba(197,88,83,.28)' : 'rgba(197,88,83,.11)'
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(0, y)
        context.lineTo(width, y)
        context.stroke()
      }
      const cellWidth = width / 4
      const rowHeight = height / 3
      for (let index = 0; index < leads.length; index += 1) {
        const column = index % 4
        const row = Math.floor(index / 4)
        const left = column * cellWidth
        const top = row * rowHeight
        context.fillStyle = '#855e5c'
        context.font = '600 12px ui-monospace, monospace'
        context.fillText(leads[index], left + 7, top + 16)
        context.strokeStyle = '#1d7565'
        context.lineWidth = 1.5
        context.beginPath()
        const centerY = top + rowHeight * 0.59
        const plotWidth = cellWidth - 6
        for (let x = 0; x <= plotWidth; x += 2) {
          const sampleTime = x / 40
          const value = ecgSample(sampleTime, state, pattern, index) * leadScale[index]
          const y = centerY - value * rowHeight * 0.62
          if (x === 0) context.moveTo(left + x + 3, y)
          else context.lineTo(left + x + 3, y)
        }
        context.stroke()
      }
    }
    draw()
  }, [pattern, state])

  return <canvas ref={canvasRef} className="twelve-lead-canvas" aria-label="12-lead ECG pattern" />
}
