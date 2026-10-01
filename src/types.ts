export type RhythmId = 'sinus' | 'bradycardia' | 'tachycardia' | 'afib' | 'svt' | 'flutter' | 'vtach' | 'torsades' | 'vfib' | 'fine-vfib' | 'asystole' | 'junctional-escape' | 'ventricular-escape' | 'aivr' | 'mobitz1' | 'mobitz2' | 'complete-block' | 'sinus-pause'
export type BloodPressureMode = 'cuff' | 'arterial'

export interface AlarmRange {
  low: number
  high: number
}

export interface AlarmLimits {
  heartRate: AlarmRange
  systolic: AlarmRange
  diastolic: AlarmRange
  spo2: AlarmRange
  respiratoryRate: AlarmRange
  etco2: AlarmRange
  temperature: AlarmRange
}

export type AlarmKey = keyof AlarmLimits

export interface ActiveAlarm {
  key: AlarmKey
  label: string
  level: 'LOW' | 'HIGH'
}

export const DEFAULT_ALARM_LIMITS: AlarmLimits = {
  heartRate: { low: 50, high: 120 },
  systolic: { low: 90, high: 180 },
  diastolic: { low: 60, high: 120 },
  spo2: { low: 90, high: 100 },
  respiratoryRate: { low: 8, high: 30 },
  etco2: { low: 20, high: 50 },
  temperature: { low: 35, high: 39 },
}

export interface SimulationState {
  heartRate: number
  rhythm: RhythmId
  pulsePresent: boolean
  systolic: number
  diastolic: number
  bloodPressureMode: BloodPressureMode
  bloodPressureAvailable: boolean
  alarmLimits: AlarmLimits
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
  bloodPressureMode: 'cuff',
  bloodPressureAvailable: true,
  alarmLimits: { ...DEFAULT_ALARM_LIMITS },
  spo2: 96,
  respiratoryRate: 14,
  etco2: 35,
  temperature: 36.8,
  selectedEcg: 'normal-sinus',
  showTwelveLead: false,
}

export const meanArterialPressure = (systolic: number, diastolic: number) =>
  Math.round(diastolic + (systolic - diastolic) / 3)

export function getActiveAlarms(state: SimulationState): ActiveAlarm[] {
  const alarms: ActiveAlarm[] = []
  const check = (key: AlarmKey, label: string, value: number, limits: AlarmRange) => {
    if (value < limits.low) alarms.push({ key, label, level: 'LOW' })
    else if (value > limits.high) alarms.push({ key, label, level: 'HIGH' })
  }

  check('heartRate', 'HR', state.heartRate, state.alarmLimits.heartRate)
  if (state.bloodPressureAvailable) {
    check('systolic', 'SYS', state.systolic, state.alarmLimits.systolic)
    check('diastolic', 'DIA', state.diastolic, state.alarmLimits.diastolic)
  }
  check('spo2', 'SpO₂', state.spo2, state.alarmLimits.spo2)
  check('respiratoryRate', 'RR', state.respiratoryRate, state.alarmLimits.respiratoryRate)
  check('etco2', 'EtCO₂', state.etco2, state.alarmLimits.etco2)
  check('temperature', 'TEMP', state.temperature, state.alarmLimits.temperature)
  return alarms
}
