import type { RhythmId } from '../types'

export type ECGMorphology = 'normal' | 'bradycardia' | 'tachycardia' | 'afib' | 'svt' | 'flutter' | 'vtach' | 'torsades' | 'vfib' | 'fine-vfib' | 'asystole' | 'junctional-escape' | 'ventricular-escape' | 'aivr' | 'mobitz1' | 'mobitz2' | 'complete-block' | 'sinus-pause' | 'stemi-anterior' | 'stemi-inferior' | 'stemi-lateral' | 'pericarditis' | 'lvh' | 'lbbb'

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
  { id: 'afib', title: 'Atrial fibrillation', category: 'Rhythm', rhythm: 'afib', suggestedRate: 110, description: 'Irregularly irregular narrow-complex response without organized P waves.' },
  { id: 'svt', title: 'SVT · regular narrow', category: 'Rhythm', rhythm: 'svt', suggestedRate: 185, description: 'Fast, regular narrow-complex rhythm; atrial activity is often hidden in or just after QRS.' },
  { id: 'flutter', title: 'Atrial flutter · 2:1', category: 'Rhythm', rhythm: 'flutter', suggestedRate: 150, description: 'Regular ventricular response with continuous flutter activity near 300 atrial beats/min.' },
  { id: 'junctional-escape', title: 'Junctional escape', category: 'Rhythm', rhythm: 'junctional-escape', suggestedRate: 48, description: 'Regular narrow escape rhythm, usually 40–60 bpm, with absent or retrograde P waves.' },
  { id: 'ventricular-escape', title: 'Ventricular escape', category: 'Rhythm', rhythm: 'ventricular-escape', suggestedRate: 28, description: 'Slow regular broad-complex escape rhythm, typically 20–40 bpm.' },
  { id: 'aivr', title: 'Accelerated idioventricular rhythm', category: 'Rhythm', rhythm: 'aivr', suggestedRate: 75, description: 'Regular broad-complex ventricular rhythm, commonly around 50–110 bpm, with AV dissociation.' },
  { id: 'mobitz1', title: 'AV block · Mobitz I', category: 'Rhythm', rhythm: 'mobitz1', suggestedRate: 54, description: 'Progressively lengthening PR intervals followed by a non-conducted P wave.' },
  { id: 'mobitz2', title: 'AV block · Mobitz II', category: 'Rhythm', rhythm: 'mobitz2', suggestedRate: 40, description: 'Intermittent dropped QRS with stable PR intervals on conducted beats.' },
  { id: 'complete-block', title: 'Complete heart block', category: 'Rhythm', rhythm: 'complete-block', suggestedRate: 34, description: 'Independent atrial activity with a slower junctional or ventricular escape rhythm.' },
  { id: 'sinus-pause', title: 'Sinus pause', category: 'Rhythm', rhythm: 'sinus-pause', suggestedRate: 52, description: 'Sinus beats interrupted by a pause with absent P-QRS-T activity.' },
  { id: 'vtach', title: 'Monomorphic ventricular tachycardia', category: 'Rhythm', rhythm: 'vtach', suggestedRate: 180, description: 'Fast, regular broad-complex rhythm with uniform QRS morphology.' },
  { id: 'torsades', title: 'Torsades de pointes', category: 'Rhythm', rhythm: 'torsades', suggestedRate: 220, description: 'Polymorphic wide-complex tachycardia with waxing and waning QRS axis and amplitude.' },
  { id: 'vfib', title: 'Ventricular fibrillation · coarse', category: 'Rhythm', rhythm: 'vfib', suggestedRate: 0, description: 'Chaotic coarse activity without identifiable P-QRS-T complexes.' },
  { id: 'fine-vfib', title: 'Ventricular fibrillation · fine', category: 'Rhythm', rhythm: 'fine-vfib', suggestedRate: 0, description: 'Low-amplitude chaotic activity without identifiable P-QRS-T complexes.' },
  { id: 'asystole', title: 'Asystole', category: 'Rhythm', rhythm: 'asystole', suggestedRate: 0, description: 'Near-flat electrical tracing without organized ventricular activity.' },
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

export const findPattern = (id: string, patterns: ECGPattern[] = allPatterns) => patterns.find((pattern) => pattern.id === id) ?? allPatterns.find((pattern) => pattern.id === id) ?? twelveLeadPatterns[0]
