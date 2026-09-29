import type { RhythmId } from '../types'

export type ECGMorphology = 'normal' | 'bradycardia' | 'tachycardia' | 'afib' | 'vtach' | 'vfib' | 'asystole' | 'stemi-anterior' | 'stemi-inferior' | 'stemi-lateral' | 'pericarditis' | 'lvh' | 'lbbb'

export interface ECGPattern {
  id: string
  title: string
  category: 'Rhythm' | '12-lead'
  rhythm: RhythmId
  description: string
  suggestedRate?: number
  territory?: string
  morphology?: ECGMorphology
  imageUrl?: string
}

export const rhythms: ECGPattern[] = [
  { id: 'sinus', title: 'Sinus rhythm', category: 'Rhythm', rhythm: 'sinus', suggestedRate: 85, description: 'Regular rhythm with normal P-QRS relationship.' },
  { id: 'bradycardia', title: 'Sinus bradycardia', category: 'Rhythm', rhythm: 'bradycardia', suggestedRate: 45, description: 'Regular sinus rhythm at a slower rate.' },
  { id: 'tachycardia', title: 'Sinus tachycardia', category: 'Rhythm', rhythm: 'tachycardia', suggestedRate: 130, description: 'Regular sinus rhythm at a faster rate.' },
  { id: 'afib', title: 'Atrial fibrillation', category: 'Rhythm', rhythm: 'afib', suggestedRate: 110, description: 'Irregularly irregular rhythm without discrete P waves.' },
  { id: 'vtach', title: 'Ventricular tachycardia', category: 'Rhythm', rhythm: 'vtach', suggestedRate: 180, description: 'Fast, regular, wide-complex ventricular rhythm.' },
  { id: 'vfib', title: 'Ventricular fibrillation', category: 'Rhythm', rhythm: 'vfib', suggestedRate: 0, description: 'Chaotic ventricular activity without organized complexes.' },
  { id: 'asystole', title: 'Asystole', category: 'Rhythm', rhythm: 'asystole', suggestedRate: 0, description: 'Near-flatline rhythm.' },
]

export const twelveLeadPatterns: ECGPattern[] = [
  { id: 'normal-sinus', title: 'Normal sinus rhythm', category: '12-lead', rhythm: 'sinus', suggestedRate: 75, description: 'Normal axis and intervals with no acute ST deviation.' },
  { id: 'stemi-anterior', title: 'STEMI · anterior', category: '12-lead', rhythm: 'sinus', suggestedRate: 85, territory: 'V1–V4', description: 'ST elevation in the anterior precordial leads.' },
  { id: 'stemi-inferior', title: 'STEMI · inferior', category: '12-lead', rhythm: 'sinus', suggestedRate: 85, territory: 'II, III, aVF', description: 'ST elevation in the inferior leads.' },
  { id: 'stemi-lateral', title: 'STEMI · lateral', category: '12-lead', rhythm: 'sinus', suggestedRate: 85, territory: 'I, aVL, V5–V6', description: 'ST elevation in the lateral leads.' },
  { id: 'pericarditis', title: 'Acute pericarditis', category: '12-lead', rhythm: 'sinus', suggestedRate: 80, description: 'Diffuse, concave ST elevation with PR depression.' },
  { id: 'lvh', title: 'Left ventricular hypertrophy', category: '12-lead', rhythm: 'sinus', suggestedRate: 75, description: 'Increased QRS voltage with lateral repolarization changes.' },
  { id: 'lbbb', title: 'Left bundle branch block', category: '12-lead', rhythm: 'sinus', suggestedRate: 75, description: 'Wide QRS with typical left bundle morphology.' },
  { id: 'afib-12', title: 'Atrial fibrillation', category: '12-lead', rhythm: 'afib', suggestedRate: 110, description: 'Irregularly irregular rhythm with absent P waves.' },
]

export const allPatterns = [...rhythms, ...twelveLeadPatterns]

export const findPattern = (id: string, patterns: ECGPattern[] = allPatterns) => patterns.find((pattern) => pattern.id === id) ?? twelveLeadPatterns[0]
