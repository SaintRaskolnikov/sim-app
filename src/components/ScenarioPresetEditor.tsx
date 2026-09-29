import { useState, type FormEvent } from 'react'
import { Trash2, X } from 'lucide-react'
import { rhythms, type ECGPattern } from '../data/ecgLibrary'
import type { ScenarioPreset } from '../data/scenarioPresets'
import type { SimulationState } from '../types'

const numericFields: { key: 'heartRate' | 'systolic' | 'diastolic' | 'spo2' | 'respiratoryRate' | 'etco2' | 'temperature'; label: string; min: number; max: number; step: number }[] = [
  { key: 'heartRate', label: 'ECG rate', min: 0, max: 300, step: 1 },
  { key: 'systolic', label: 'Systolic BP', min: 0, max: 300, step: 1 },
  { key: 'diastolic', label: 'Diastolic BP', min: 0, max: 300, step: 1 },
  { key: 'spo2', label: 'SpO₂', min: 0, max: 100, step: 1 },
  { key: 'respiratoryRate', label: 'Respiratory rate', min: 0, max: 80, step: 1 },
  { key: 'etco2', label: 'EtCO₂', min: 0, max: 100, step: 1 },
  { key: 'temperature', label: 'Temperature', min: 25, max: 45, step: 0.1 },
]

export function ScenarioPresetEditor({ preset, patterns, canDelete, onSave, onDelete, onClose }: {
  preset: ScenarioPreset
  patterns: ECGPattern[]
  canDelete: boolean
  onSave: (preset: ScenarioPreset) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<ScenarioPreset>(preset)
  const selectedPatternId = draft.patch.selectedEcg ?? 'normal-sinus'
  const updatePatch = (patch: Partial<SimulationState>) => setDraft((current) => ({ ...current, patch: { ...current.patch, ...patch } }))
  const selectPattern = (id: string) => {
    const pattern = patterns.find((item) => item.id === id) ?? patterns[0]
    if (!pattern) return
    updatePatch({ selectedEcg: id, rhythm: pattern.rhythm, heartRate: pattern.suggestedRate ?? draft.patch.heartRate })
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.name.trim()) return
    onSave({ ...draft, name: draft.name.trim() })
  }

  return (
    <div className="editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="pattern-editor preset-editor" role="dialog" aria-modal="true" aria-labelledby="preset-editor-title">
        <div className="editor-heading"><div><span className="eyebrow">SCENARIO PRESETS</span><h2 id="preset-editor-title">Edit preset</h2></div><button className="editor-close" aria-label="Close editor" onClick={onClose}><X size={18} /></button></div>
        <form onSubmit={submit}>
          <label>Preset name<input required maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Refractory VF" /></label>
          <div className="editor-fields"><label>Accent<select value={draft.tone} onChange={(event) => setDraft({ ...draft, tone: event.target.value as ScenarioPreset['tone'] })}><option value="coral">Coral</option><option value="amber">Amber</option><option value="teal">Teal</option></select></label><label>ECG rhythm<select value={draft.patch.rhythm ?? 'sinus'} onChange={(event) => { const rhythm = rhythms.find((item) => item.rhythm === event.target.value); if (rhythm) updatePatch({ rhythm: rhythm.rhythm }) }}>{rhythms.map((rhythm) => <option key={rhythm.id} value={rhythm.rhythm}>{rhythm.title}</option>)}</select></label></div>
          <label>12-lead pattern<select value={patterns.some((pattern) => pattern.id === selectedPatternId) ? selectedPatternId : 'normal-sinus'} onChange={(event) => selectPattern(event.target.value)}>{patterns.filter((pattern) => pattern.category === '12-lead').map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.title}</option>)}</select></label>
          <div className="preset-number-grid">{numericFields.map(({ key, label, min, max, step }) => <label key={key}>{label}<input type="number" min={min} max={max} step={step} value={draft.patch[key] ?? 0} onChange={(event) => updatePatch({ [key]: Number(event.target.value) })} /></label>)}</div>
          <div className="preset-editor-switches">
            <div className="display-control"><div className="display-copy"><span className="display-icon"><span className={`pulse-indicator ${draft.patch.pulsePresent === false ? 'absent' : 'present'}`} /></span><div><strong>Palpable pulse</strong><small>Independent from ECG rhythm</small></div></div><button type="button" className={`toggle ${draft.patch.pulsePresent !== false ? 'on' : ''}`} role="switch" aria-checked={draft.patch.pulsePresent !== false} aria-label="Preset has a palpable pulse" onClick={() => updatePatch({ pulsePresent: draft.patch.pulsePresent === false })}><span /></button></div>
            <div className="display-control"><div className="display-copy"><span className="display-icon"><span className="preset-ecg-mark">12</span></span><div><strong>Show 12-lead</strong><small>Monitor display on apply</small></div></div><button type="button" className={`toggle ${draft.patch.showTwelveLead ? 'on' : ''}`} role="switch" aria-checked={Boolean(draft.patch.showTwelveLead)} aria-label="Show 12-lead when preset is applied" onClick={() => updatePatch({ showTwelveLead: !draft.patch.showTwelveLead })}><span /></button></div>
          </div>
          <div className="editor-actions">{canDelete && <button type="button" className="delete-pattern" onClick={() => onDelete(draft.id)}><Trash2 size={15} />Delete preset</button>}<button type="button" className="editor-cancel" onClick={onClose}>Cancel</button><button type="submit" className="editor-save">Save preset</button></div>
        </form>
      </section>
    </div>
  )
}
