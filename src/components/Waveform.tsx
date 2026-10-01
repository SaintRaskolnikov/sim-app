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

const fract = (value: number) => value - Math.floor(value)

const beatPhase = (time: number, rate: number) => rate > 0 ? fract(time * rate / 60) : 0

function pulseEnvelope(phase: number, decayRate: number) {
  const peakPhase = 0.18
  if (phase < peakPhase) return Math.sin((phase / peakPhase) * Math.PI / 2)
  return Math.exp(-decayRate * Math.pow(phase - peakPhase, 1.2))
}

function narrowComplex(phase: number, width: number, showP = true, showT = true) {
  let value = 0
  if (showP) value += gaussian(phase, 0.17, 0.035) * 0.13
  value -= gaussian(phase, 0.335, width * 0.65) * 0.15
  value += gaussian(phase, 0.365, width) * 0.92
  value -= gaussian(phase, 0.397, width * 0.75) * 0.28
  if (showT) value += gaussian(phase, 0.65, 0.075) * 0.25
  return value
}

function broadComplex(phase: number, center = 0.36) {
  return -gaussian(phase, center - 0.065, 0.04) * 0.3 + gaussian(phase, center, 0.065) * 0.82 - gaussian(phase, center + 0.085, 0.05) * 0.42 + gaussian(phase, center + 0.28, 0.095) * 0.16
}

function ecgSample(time: number, state: SimulationState, pattern?: ECGPattern, leadIndex = 0) {
  const rhythm = pattern?.rhythm ?? state.rhythm
  const morphology = pattern?.morphology ?? pattern?.id
  const rate = state.heartRate
  if (rhythm === 'asystole') return Math.sin(time * 2.1) * 0.012
  if (rhythm === 'vfib' || rhythm === 'fine-vfib') {
    const envelope = 0.82 + 0.18 * Math.sin(time * 1.3)
    const amplitude = rhythm === 'fine-vfib' ? 0.11 : 0.34
    return envelope * amplitude * (0.56 * Math.sin(time * 17 + Math.sin(time * 4.7) * 2.4) + 0.28 * Math.sin(time * 29.3 + 1.8) + 0.16 * Math.sin(time * 41.7 + Math.sin(time * 7.1)))
  }
  if (rate <= 0) return Math.sin(time * 2.1) * 0.012

  const phase = beatPhase(time, rate)
  const width = Math.min(0.082, Math.max(0.026, rate * 0.00058))
  let value = 0
  if (rhythm === 'afib') {
    const irregularBeat = time * rate / 60 + 0.13 * Math.sin(time * rate / 60 * 2.7)
    value = narrowComplex(fract(irregularBeat), width, false) + Math.sin(time * 43.1) * 0.025 + Math.sin(time * 61.7 + 1.2) * 0.018
  } else if (rhythm === 'flutter') {
    const atrialPhase = beatPhase(time, 300)
    const sawtooth = (1 - 2 * atrialPhase) * 0.15
    value = sawtooth + narrowComplex(phase, width, false)
  } else if (rhythm === 'svt') {
    value = narrowComplex(phase, width, false) + gaussian(phase, 0.43, 0.022) * 0.08
  } else if (rhythm === 'vtach') {
    value = broadComplex(phase, 0.35)
  } else if (rhythm === 'torsades') {
    const twist = Math.sin(time * Math.PI * 1.15)
    const envelope = 0.18 + 0.82 * Math.abs(twist)
    value = broadComplex(phase, 0.36) * envelope * (twist < 0 ? -1 : 1)
  } else if (rhythm === 'junctional-escape') {
    value = narrowComplex(phase, width, false) - gaussian(phase, 0.45, 0.025) * 0.11
  } else if (rhythm === 'ventricular-escape') {
    value = broadComplex(phase, 0.36) * 0.9
  } else if (rhythm === 'aivr') {
    const beatIndex = Math.floor(time * rate / 60)
    value = beatIndex % 7 === 0 ? narrowComplex(phase, width) : broadComplex(phase, 0.36) * 0.9
  } else if (rhythm === 'mobitz1' || rhythm === 'mobitz2') {
    const ratio = rhythm === 'mobitz1' ? 3 : 2
    const atrialRate = rate * ratio / (ratio - 1)
    const atrialBeat = time * atrialRate / 60
    const atrialIndex = Math.floor(atrialBeat)
    const atrialPhase = fract(atrialBeat)
    const conducted = rhythm === 'mobitz1' ? atrialIndex % ratio !== ratio - 1 : atrialIndex % ratio === 0
    value = gaussian(atrialPhase, 0.13, 0.035) * 0.14
    if (conducted) {
      const progressiveDelay = rhythm === 'mobitz1' ? (atrialIndex % ratio) * 0.045 : 0
      const qrsCenter = 0.39 + progressiveDelay
      value += -gaussian(atrialPhase, qrsCenter - 0.025, width * 0.65) * 0.15 + gaussian(atrialPhase, qrsCenter, width) * 0.92 - gaussian(atrialPhase, qrsCenter + 0.025, width * 0.75) * 0.28 + gaussian(atrialPhase, qrsCenter + 0.27, 0.075) * 0.25
    }
  } else if (rhythm === 'complete-block') {
    const atrialPhase = beatPhase(time, Math.max(75, rate * 2.2))
    value = gaussian(atrialPhase, 0.17, 0.035) * 0.13 + broadComplex(phase, 0.36) * 0.85
  } else if (rhythm === 'sinus-pause') {
    const beatIndex = Math.floor(time * rate / 60)
    value = beatIndex % 8 === 7 ? 0 : narrowComplex(phase, width)
  } else {
    value = narrowComplex(phase, width)
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
    if (state.bloodPressureMode !== 'arterial' || !state.bloodPressureAvailable || state.systolic === 0 || !state.pulsePresent) return 0
    const phase = beatPhase(time, state.heartRate)
    const pulse = pulseEnvelope(phase, 3.8)
    const normalizedPulse = (pulse - 0.43) * 1.5
    const relativePulse = (state.systolic - state.diastolic) / 60
    return -0.55 + normalizedPulse * Math.min(relativePulse, 1.35)
  }
  if (kind === 'pleth') {
    if (state.spo2 === 0 || state.heartRate === 0 || !state.pulsePresent) return Math.sin(time * 1.7) * 0.002
    const phase = beatPhase(time, state.heartRate)
    const upstroke = pulseEnvelope(phase, 5)
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
      context.lineCap = 'round'
      context.beginPath()
      const now = performance.now() / 1000
      const maxAmplitude = canvasHeight * 0.36
      const sampleStep = kind === 'ecg' ? 0.5 : kind === 'pressure' || kind === 'pleth' ? 1 : 2
      for (let x = 0; x <= width; x += sampleStep) {
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
