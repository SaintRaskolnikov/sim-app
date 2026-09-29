export type RhythmId = 'sinus' | 'bradycardia' | 'tachycardia' | 'afib' | 'vtach' | 'vfib' | 'asystole'

export interface SimulationState {
  heartRate: number
  rhythm: RhythmId
  systolic: number
  diastolic: number
  spo2: number
  respiratoryRate: number
  etco2: number
  temperature: number
  selectedEcg: string
  showTwelveLead: boolean
}

export type StatePatch = Partial<SimulationState>

export const INITIAL_STATE: SimulationState = {
  heartRate: 85,
  rhythm: 'sinus',
  systolic: 110,
  diastolic: 70,
  spo2: 96,
  respiratoryRate: 14,
  etco2: 35,
  temperature: 36.8,
  selectedEcg: 'normal-sinus',
  showTwelveLead: false,
}

export const meanArterialPressure = (systolic: number, diastolic: number) =>
  Math.round(diastolic + (systolic - diastolic) / 3)
