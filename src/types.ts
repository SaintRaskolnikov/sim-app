export type RhythmId = 'sinus' | 'bradycardia' | 'tachycardia' | 'afib' | 'svt' | 'flutter' | 'vtach' | 'torsades' | 'vfib' | 'fine-vfib' | 'asystole' | 'junctional-escape' | 'ventricular-escape' | 'aivr' | 'mobitz1' | 'mobitz2' | 'complete-block' | 'sinus-pause'

export interface SimulationState {
  heartRate: number
  rhythm: RhythmId
  pulsePresent: boolean
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
  pulsePresent: true,
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
