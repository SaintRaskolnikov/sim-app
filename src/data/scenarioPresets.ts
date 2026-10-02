import { INITIAL_STATE, type StatePatch } from '../types'

export type PresetTone = 'coral' | 'amber' | 'teal'
export type PresetIconId = 'siren' | 'heart' | 'activity'

export interface ScenarioPreset {
  id: string
  name: string
  tone: PresetTone
  icon: PresetIconId
  patch: StatePatch
}

export const DEFAULT_SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'normal-baseline', name: 'Normal · baseline', tone: 'teal', icon: 'activity',
    patch: { ...INITIAL_STATE, alarmLimits: { ...INITIAL_STATE.alarmLimits } },
  },
  {
    id: 'cardiac-arrest-vf', name: 'Cardiac arrest · VF', tone: 'coral', icon: 'siren',
    patch: { heartRate: 0, rhythm: 'vfib', pulsePresent: false, bloodPressureAvailable: false, selectedEcg: 'vfib', showTwelveLead: false, systolic: 0, diastolic: 0, spo2: 48, respiratoryRate: 0, etco2: 8 },
  },
  {
    id: 'pulseless-vt', name: 'Pulseless VT', tone: 'coral', icon: 'heart',
    patch: { heartRate: 180, rhythm: 'vtach', pulsePresent: false, bloodPressureAvailable: false, selectedEcg: 'vtach', showTwelveLead: false, systolic: 0, diastolic: 0, spo2: 55, respiratoryRate: 0, etco2: 8 },
  },
  {
    id: 'pea-organized', name: 'PEA · organized', tone: 'amber', icon: 'activity',
    patch: { heartRate: 72, rhythm: 'sinus', pulsePresent: false, bloodPressureAvailable: false, selectedEcg: 'sinus', showTwelveLead: false, systolic: 0, diastolic: 0, spo2: 65, respiratoryRate: 12, etco2: 12 },
  },
  {
    id: 'mobitz-ii-bradycardia', name: 'Bradycardia · Mobitz II', tone: 'amber', icon: 'activity',
    patch: { heartRate: 40, rhythm: 'mobitz2', pulsePresent: true, selectedEcg: 'mobitz2', showTwelveLead: false, systolic: 78, diastolic: 44, spo2: 93, respiratoryRate: 22, etco2: 28 },
  },
  {
    id: 'supraventricular-tachycardia', name: 'SVT', tone: 'coral', icon: 'heart',
    patch: { heartRate: 185, rhythm: 'svt', pulsePresent: true, selectedEcg: 'svt', showTwelveLead: false, systolic: 96, diastolic: 62, spo2: 96, respiratoryRate: 24, etco2: 30 },
  },
  {
    id: 'hypovolemic-shock', name: 'Hypovolemic shock', tone: 'amber', icon: 'activity',
    patch: { heartRate: 128, rhythm: 'sinus', pulsePresent: true, selectedEcg: 'sinus', showTwelveLead: false, systolic: 78, diastolic: 48, spo2: 93, respiratoryRate: 28, etco2: 22 },
  },
  {
    id: 'septic-shock', name: 'Septic shock', tone: 'teal', icon: 'heart',
    patch: { heartRate: 124, rhythm: 'sinus', pulsePresent: true, selectedEcg: 'sinus', showTwelveLead: false, systolic: 84, diastolic: 52, spo2: 94, respiratoryRate: 30, etco2: 25, temperature: 39.2 },
  },
]
