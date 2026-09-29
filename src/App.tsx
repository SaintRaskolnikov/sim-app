import { useEffect, useState } from 'react'
import { Activity, ArrowLeft, ArrowUp, BookOpen, HeartPulse, Monitor, Pencil, Plus, Radio, Siren, Trash2, Wifi, WifiOff, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import './App.css'
import { findPattern, rhythms, type ECGMorphology, type ECGPattern } from './data/ecgLibrary'
import { useECGLibrary } from './hooks/useECGLibrary'
import { useSimulationSession } from './hooks/useSimulationSession'
import { TwelveLeadCanvas, Waveform } from './components/Waveform'
import { meanArterialPressure, type SimulationState, type StatePatch } from './types'

const rhythmName = (id: string) => rhythms.find((rhythm) => rhythm.id === id)?.title ?? 'Sinus rhythm'

const presets: { name: string; icon: typeof Siren; tone: string; patch: StatePatch }[] = [
  {
    name: 'Cardiac arrest', icon: Siren, tone: 'coral',
    patch: { heartRate: 0, rhythm: 'vfib', selectedEcg: 'vfib', showTwelveLead: false, systolic: 0, diastolic: 0, spo2: 48, respiratoryRate: 0, etco2: 8 },
  },
  {
    name: 'Hypovolemic shock', icon: Activity, tone: 'amber',
    patch: { heartRate: 128, rhythm: 'sinus', selectedEcg: 'sinus', showTwelveLead: false, systolic: 78, diastolic: 48, spo2: 93, respiratoryRate: 28, etco2: 22 },
  },
  {
    name: 'Septic shock', icon: HeartPulse, tone: 'teal',
    patch: { heartRate: 124, rhythm: 'sinus', selectedEcg: 'sinus', showTwelveLead: false, systolic: 84, diastolic: 52, spo2: 94, respiratoryRate: 30, etco2: 25, temperature: 39.2 },
  },
]

function ConnectionBadge({ status }: { status: 'connecting' | 'connected' | 'offline' }) {
  const Icon = status === 'connected' ? Wifi : WifiOff
  return <span className={`connection-badge ${status}`}><Icon size={14} />{status === 'connected' ? 'Live' : status === 'offline' ? 'Offline' : 'Connecting'}</span>
}

function RouteNav({ sessionId, current }: { sessionId: string; current: string }) {
  const query = `?session=${encodeURIComponent(sessionId)}`
  return (
    <nav className="route-nav" aria-label="Simulation views">
      <a className={current === '/control' ? 'active' : ''} href={`/control${query}`}><Activity size={16} />Control</a>
      <a className={current === '/monitor' ? 'active' : ''} href={`/monitor${query}`}><Monitor size={16} />Monitor</a>
      <a className={current === '/ekg-library' ? 'active' : ''} href={`/ekg-library${query}`}><BookOpen size={16} />ECG library</a>
    </nav>
  )
}

function SessionHeader({ sessionId, status, route }: { sessionId: string; status: 'connecting' | 'connected' | 'offline'; route: string }) {
  return (
    <header className="app-header">
      <a className="brand" href={`/control?session=${encodeURIComponent(sessionId)}`} aria-label="Pulse Sim home">
        <span className="brand-mark"><Activity size={19} /></span>
        <span><strong>pulse<span>/</span>sim</strong><small>SIMULATION SUITE</small></span>
      </a>
      <RouteNav sessionId={sessionId} current={route} />
      <div className="header-session"><span>SESSION</span><strong>{sessionId}</strong><ConnectionBadge status={status} /></div>
    </header>
  )
}

function MonitorView({ state, status, sessionId, patterns, update }: {
  state: SimulationState
  status: 'connecting' | 'connected' | 'offline'
  sessionId: string
  patterns: ECGPattern[]
  update: (patch: StatePatch) => void
}) {
  const [clock, setClock] = useState(() => new Date())
  const [controllerOrigin, setControllerOrigin] = useState(() => window.location.origin)
  const selectedPattern = findPattern(state.selectedEcg, patterns)
  const controllerUrl = new URL(`/control?session=${encodeURIComponent(sessionId)}`, controllerOrigin).toString()
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!import.meta.env.DEV || !['localhost', '127.0.0.1'].includes(window.location.hostname)) return
    void fetch('/__pair-origin').then((response) => response.json() as Promise<{ origin?: string }>).then(({ origin }) => {
      if (origin) setControllerOrigin(origin)
    }).catch(() => undefined)
  }, [])

  return (
    <main className="monitor-shell">
      <header className="monitor-topbar">
        <div className="monitor-title"><span className="monitor-emblem"><Activity size={20} /></span><div><small>SIMULATION MONITOR</small><strong>RESUS BAY 01</strong></div></div>
        <div className="monitor-session"><span className="live-dot" />SESSION {sessionId}<span className="monitor-divider" />{clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
        <div className="monitor-actions"><ConnectionBadge status={status} /><div className="monitor-pairing"><QRCodeSVG value={controllerUrl} size={54} level="M" bgColor="#ffffff" fgColor="#153b2b" /><div><strong>SCAN TO PAIR</strong><span>Open tutor controls</span><small>{sessionId}</small></div></div><button className="monitor-mode-button" onClick={() => update({ showTwelveLead: !state.showTwelveLead })}>{state.showTwelveLead ? <Activity size={16} /> : <Radio size={16} />}{state.showTwelveLead ? 'Bedside' : '12-lead'}</button></div>
      </header>

      <div className="monitor-warning">SIMULATION ONLY <span>·</span> NOT FOR CLINICAL USE</div>

      <section className="monitor-readouts" aria-label="Patient vital signs">
        <div className="monitor-metric hr-metric"><div className="metric-label"><span className="metric-dot" />ECG <span className="metric-unit">bpm</span></div><div className="metric-value">{state.heartRate}<small>{rhythmName(state.rhythm)}</small></div></div>
        <div className="monitor-metric bp-metric"><div className="metric-label"><span className="metric-dot" />NIBP <span className="metric-unit">mmHg</span></div><div className="metric-value bp-value">{state.systolic}<span>/</span>{state.diastolic}<small>MAP {meanArterialPressure(state.systolic, state.diastolic)}</small></div></div>
        <div className="monitor-metric spo2-metric"><div className="metric-label"><span className="metric-dot" />SpO₂ <span className="metric-unit">%</span></div><div className="metric-value">{state.spo2}<small>PLETH</small></div></div>
        <div className="monitor-metric co2-metric"><div className="metric-label"><span className="metric-dot" />EtCO₂ <span className="metric-unit">mmHg</span></div><div className="metric-value">{state.etco2}<small>RR {state.respiratoryRate} /min</small></div></div>
      </section>

      {state.showTwelveLead ? (
        <section className="monitor-12lead-panel">
          <div className="monitor-section-heading"><div><span>DIAGNOSTIC ECG</span><h1>{selectedPattern.title}</h1></div><button className="monitor-mode-button" onClick={() => update({ showTwelveLead: false })}><ArrowLeft size={15} />Bedside view</button></div>
          {selectedPattern.imageUrl ? <img className="twelve-lead-image" src={selectedPattern.imageUrl} alt={`${selectedPattern.title} ECG pattern`} /> : <TwelveLeadCanvas state={state} pattern={selectedPattern} />}
          <div className="ecg-paper-caption"><span>25 mm/s</span><span>10 mm/mV</span><span>{selectedPattern.territory ?? '12-lead acquisition'}</span></div>
        </section>
      ) : (
        <section className="wave-stack" aria-label="Live physiological waveforms">
          <div className="monitor-wave-row ecg-wave-row"><div className="wave-label"><strong>II</strong><span>ECG</span></div><Waveform kind="ecg" color="#65e58a" state={state} /><div className="wave-reading"><strong>{state.heartRate}</strong><span>bpm</span></div></div>
          <div className="monitor-wave-row pressure-wave-row"><div className="wave-label"><strong>ART</strong><span>mmHg</span></div><Waveform kind="pressure" color="#f3d353" state={state} /><div className="wave-reading"><strong>{state.systolic}/{state.diastolic}</strong><span>MAP {meanArterialPressure(state.systolic, state.diastolic)}</span></div></div>
          <div className="monitor-wave-row pleth-wave-row"><div className="wave-label"><strong>PLETH</strong><span>SpO₂</span></div><Waveform kind="pleth" color="#65c7f2" state={state} /><div className="wave-reading"><strong>{state.spo2}<small>%</small></strong><span>pulse</span></div></div>
          <div className="monitor-wave-row capno-wave-row"><div className="wave-label"><strong>CO₂</strong><span>mmHg</span></div><Waveform kind="capno" color="#d88bf2" state={state} /><div className="wave-reading"><strong>{state.etco2}</strong><span>RR {state.respiratoryRate}</span></div></div>
        </section>
      )}

      <footer className="monitor-footer"><div><span className="footer-label">TEMP</span><strong>{state.temperature.toFixed(1)} °C</strong></div><div><span className="footer-label">RHYTHM</span><strong>{rhythmName(state.rhythm)}</strong></div><div><span className="footer-label">ECG PATTERN</span><strong>{selectedPattern.title}</strong></div><span className="monitor-disclaimer">For simulation and training only</span></footer>
    </main>
  )
}

function NumberControl({ label, value, unit, step, min, max, digits = 0, onChange }: {
  label: string
  value: number
  unit: string
  step: number
  min: number
  max: number
  digits?: number
  onChange: (value: number) => void
}) {
  const adjust = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta))
    onChange(Number(next.toFixed(digits)))
  }
  return (
    <div className="number-control">
      <div className="number-control-label">{label}</div>
      <div className="stepper">
        <button aria-label={`Decrease ${label}`} onClick={() => adjust(-step)}>−</button>
        <div className="stepper-value"><strong>{digits ? value.toFixed(digits) : value}</strong><span>{unit}</span></div>
        <button aria-label={`Increase ${label}`} onClick={() => adjust(step)}>+</button>
      </div>
    </div>
  )
}

function ControlView({ state, status, sessionId, patterns, update, joinSession }: {
  state: SimulationState
  status: 'connecting' | 'connected' | 'offline'
  sessionId: string
  patterns: ECGPattern[]
  update: (patch: StatePatch) => void
  joinSession: (id: string) => void
}) {
  const [sessionDraft, setSessionDraft] = useState(sessionId)

  return (
    <div className="workspace-shell">
      <SessionHeader sessionId={sessionId} status={status} route="/control" />
      <main className="control-page">
        <div className="control-heading"><div><span className="eyebrow">TUTOR CONSOLE <span className="heading-rule" /></span><h1>Patient state</h1><p>Changes appear on the simulation monitor immediately.</p></div><a className="monitor-shortcut" href={`/monitor?session=${encodeURIComponent(sessionId)}`}><Monitor size={17} />Open monitor</a></div>

        <form className="session-join" onSubmit={(event) => { event.preventDefault(); joinSession(sessionDraft) }}>
          <div className="session-join-copy"><span className="join-indicator" /><div><small>ACTIVE SIMULATION</small><strong>{sessionId}</strong></div></div>
          <label className="session-input-wrap"><span className="sr-only">Session code</span><input value={sessionDraft} onChange={(event) => setSessionDraft(event.target.value)} maxLength={24} aria-label="Session code" /></label>
          <button type="submit">Join</button>
        </form>

        <section className="control-section vital-section"><div className="section-heading"><div><span className="section-index">01</span><h2>Vitals</h2></div><span>Tap to adjust</span></div>
          <div className="number-grid">
            <NumberControl label="Heart rate" value={state.heartRate} unit="bpm" step={5} min={0} max={300} onChange={(heartRate) => update({ heartRate })} />
            <NumberControl label="Systolic BP" value={state.systolic} unit="mmHg" step={5} min={0} max={300} onChange={(systolic) => update({ systolic })} />
            <NumberControl label="Diastolic BP" value={state.diastolic} unit="mmHg" step={5} min={0} max={300} onChange={(diastolic) => update({ diastolic })} />
            <NumberControl label="SpO₂" value={state.spo2} unit="%" step={1} min={0} max={100} onChange={(spo2) => update({ spo2 })} />
            <NumberControl label="Respiratory rate" value={state.respiratoryRate} unit="/min" step={1} min={0} max={80} onChange={(respiratoryRate) => update({ respiratoryRate })} />
            <NumberControl label="EtCO₂" value={state.etco2} unit="mmHg" step={1} min={0} max={100} onChange={(etco2) => update({ etco2 })} />
            <NumberControl label="Temperature" value={state.temperature} unit="°C" step={0.1} min={25} max={45} digits={1} onChange={(temperature) => update({ temperature })} />
          </div>
          <div className="map-readout"><span>Mean arterial pressure</span><strong>{meanArterialPressure(state.systolic, state.diastolic)} <small>mmHg</small></strong><span className="auto-tag">AUTO</span></div>
        </section>

        <section className="control-section rhythm-section"><div className="section-heading"><div><span className="section-index">02</span><h2>Rhythm</h2></div><span>{rhythmName(state.rhythm)}</span></div>
          <div className="rhythm-grid">{rhythms.map((rhythm) => <button key={rhythm.id} className={state.rhythm === rhythm.id ? 'selected' : ''} onClick={() => update({ rhythm: rhythm.id as SimulationState['rhythm'], heartRate: rhythm.suggestedRate ?? state.heartRate, selectedEcg: rhythm.id, showTwelveLead: false })}><span className="rhythm-led" />{rhythm.title}</button>)}</div>
        </section>

        <section className="control-section preset-section"><div className="section-heading"><div><span className="section-index">03</span><h2>Scenario presets</h2></div><span>Simulation states</span></div>
          <div className="preset-grid">{presets.map(({ name, icon: Icon, tone, patch }) => <button key={name} className={`preset-button ${tone}`} onClick={() => update(patch)}><span className="preset-icon"><Icon size={19} /></span><span>{name}</span><span className="preset-apply">Apply</span></button>)}</div>
        </section>

        <section className="control-section display-section"><div className="section-heading"><div><span className="section-index">04</span><h2>Display</h2></div><span>Monitor output</span></div>
          <div className="display-control"><div className="display-copy"><span className="display-icon"><Radio size={18} /></span><div><strong>12-lead ECG</strong><small>{findPattern(state.selectedEcg, patterns).title}</small></div></div><button className={`toggle ${state.showTwelveLead ? 'on' : ''}`} role="switch" aria-checked={state.showTwelveLead} aria-label="Show 12-lead ECG" onClick={() => update({ showTwelveLead: !state.showTwelveLead })}><span /></button></div>
          <a className="library-link" href={`/ekg-library?session=${encodeURIComponent(sessionId)}`}>Choose a preloaded ECG <ArrowUp size={14} /></a>
        </section>
        <p className="training-note"><span>!</span> Simulation and training use only. Not for real patient monitoring or clinical decision-making.</p>
      </main>
    </div>
  )
}

function LibraryView({ state, sessionId, status, patterns, update, savePattern, deletePattern }: {
  state: SimulationState
  sessionId: string
  status: 'connecting' | 'connected' | 'offline'
  patterns: ECGPattern[]
  update: (patch: StatePatch) => void
  savePattern: (pattern: ECGPattern) => void
  deletePattern: (id: string) => void
}) {
  const [category, setCategory] = useState<'all' | 'Rhythm' | '12-lead'>('all')
  const [draft, setDraft] = useState<ECGPattern | null>(null)
  const [editingExisting, setEditingExisting] = useState(false)
  const filtered = category === 'all' ? patterns : patterns.filter((pattern) => pattern.category === category)
  const startNew = () => {
    setEditingExisting(false)
    setDraft({ id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, title: '', category: '12-lead', rhythm: 'sinus', suggestedRate: 85, description: '', morphology: 'normal' })
  }
  const startEdit = (pattern: ECGPattern) => {
    setEditingExisting(true)
    setDraft({ ...pattern })
  }
  const saveDraft = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft?.title.trim() || !draft.description.trim()) return
    savePattern({ ...draft, title: draft.title.trim(), description: draft.description.trim() })
    setDraft(null)
  }
  const choosePattern = (id: string) => {
    const pattern = findPattern(id, patterns)
    update({ selectedEcg: id, rhythm: pattern.rhythm, heartRate: pattern.suggestedRate ?? state.heartRate, showTwelveLead: pattern.category === '12-lead' })
  }
  const counts = {
    all: patterns.length,
    Rhythm: patterns.filter((pattern) => pattern.category === 'Rhythm').length,
    '12-lead': patterns.filter((pattern) => pattern.category === '12-lead').length,
  }
  const morphologies: { id: ECGMorphology; label: string }[] = [
    { id: 'normal', label: 'Normal complexes' },
    { id: 'bradycardia', label: 'Sinus bradycardia' },
    { id: 'tachycardia', label: 'Sinus tachycardia' },
    { id: 'afib', label: 'Atrial fibrillation' },
    { id: 'vtach', label: 'Wide-complex tachycardia' },
    { id: 'vfib', label: 'Ventricular fibrillation' },
    { id: 'asystole', label: 'Asystole' },
    { id: 'stemi-anterior', label: 'Anterior ST elevation' },
    { id: 'stemi-inferior', label: 'Inferior ST elevation' },
    { id: 'stemi-lateral', label: 'Lateral ST elevation' },
    { id: 'pericarditis', label: 'Diffuse ST elevation' },
    { id: 'lvh', label: 'High voltage / LVH' },
    { id: 'lbbb', label: 'Wide QRS / LBBB' },
  ]

  return (
    <div className="workspace-shell">
      <SessionHeader sessionId={sessionId} status={status} route="/ekg-library" />
      <main className="library-page">
        <a className="back-link" href={`/control?session=${encodeURIComponent(sessionId)}`}><ArrowLeft size={15} />Tutor controls</a>
        <div className="library-title-row"><div className="library-heading"><span className="eyebrow">REFERENCE LIBRARY <span className="heading-rule" /></span><h1>ECG patterns</h1><p>Choose a rhythm or display a diagnostic 12-lead on the monitor.</p></div><button className="add-pattern-button" onClick={startNew}><Plus size={16} />Add ECG</button></div>
        <div className="library-tabs" role="tablist" aria-label="ECG categories">
          {(['all', 'Rhythm', '12-lead'] as const).map((item) => <button key={item} role="tab" aria-selected={category === item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item === 'all' ? 'All patterns' : item === 'Rhythm' ? 'Rhythms' : '12-lead ECGs'}<span>{counts[item]}</span></button>)}
        </div>
        <div className="pattern-list">{filtered.map((pattern, index) => <article className={`pattern-card ${state.selectedEcg === pattern.id ? 'current' : ''}`} key={pattern.id}>
          <div className="pattern-number">{String(index + 1).padStart(2, '0')}</div>
          <div className="pattern-copy"><div className="pattern-meta"><span>{pattern.category === 'Rhythm' ? 'RHYTHM' : '12-LEAD'}</span>{pattern.territory && <span>{pattern.territory}</span>}</div><h2>{pattern.title}</h2><p>{pattern.description}</p></div>
          <div className="pattern-actions"><button className="pattern-edit" aria-label={`Edit ${pattern.title}`} onClick={() => startEdit(pattern)}><Pencil size={14} /></button><button className="pattern-select" onClick={() => choosePattern(pattern.id)}>{state.selectedEcg === pattern.id ? 'On monitor' : pattern.category === 'Rhythm' ? 'Apply rhythm' : 'Display ECG'}<ArrowUp size={14} /></button></div>
        </article>)}</div>
        <p className="training-note"><span>!</span> Educational simulation patterns. Not a diagnostic reference.</p>
      </main>
      {draft && <div className="editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null) }}><section className="pattern-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <div className="editor-heading"><div><span className="eyebrow">ECG LIBRARY</span><h2 id="editor-title">{editingExisting ? 'Edit pattern' : 'Add pattern'}</h2></div><button className="editor-close" aria-label="Close editor" onClick={() => setDraft(null)}><X size={18} /></button></div>
        <form onSubmit={saveDraft}>
          <label>Clinical label<input required maxLength={100} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="e.g. Right bundle branch block" /></label>
          <div className="editor-fields"><label>Pattern type<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as ECGPattern['category'] })}><option value="12-lead">12-lead ECG</option><option value="Rhythm">Rhythm only</option></select></label><label>Rhythm<select value={draft.rhythm} onChange={(event) => setDraft({ ...draft, rhythm: event.target.value as SimulationState['rhythm'] })}>{rhythms.map((rhythm) => <option key={rhythm.id} value={rhythm.id}>{rhythm.title}</option>)}</select></label></div>
          <label>Starting heart rate<input type="number" min={0} max={300} step={1} value={draft.suggestedRate ?? 85} onChange={(event) => setDraft({ ...draft, suggestedRate: Number(event.target.value) })} /></label>
          <label>Line morphology<select value={(draft.morphology ?? 'normal') as ECGMorphology} onChange={(event) => setDraft({ ...draft, morphology: event.target.value as ECGMorphology })}>{morphologies.map((morphology) => <option key={morphology.id} value={morphology.id}>{morphology.label}</option>)}</select></label>
          <label>Description<textarea required maxLength={300} rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Brief educational description" /></label>
          <label>Lead territory <span className="optional-label">Optional</span><input maxLength={50} value={draft.territory ?? ''} onChange={(event) => setDraft({ ...draft, territory: event.target.value })} placeholder="e.g. V1–V4" /></label>
          <label>ECG image URL <span className="optional-label">Optional</span><input type="url" value={draft.imageUrl ?? ''} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value || undefined })} placeholder="https://…" /></label>
          <div className="editor-actions">{editingExisting && <button type="button" className="delete-pattern" onClick={() => { deletePattern(draft.id); setDraft(null) }}><Trash2 size={15} />Delete ECG</button>}<button type="button" className="editor-cancel" onClick={() => setDraft(null)}>Cancel</button><button type="submit" className="editor-save">Save pattern</button></div>
        </form>
      </section></div>}
    </div>
  )
}

function App() {
  const session = useSimulationSession()
  const library = useECGLibrary()
  const path = window.location.pathname.replace(/\/$/, '') || '/control'
  if (path === '/monitor') return <MonitorView {...session} patterns={library.patterns} />
  if (path === '/ekg-library') return <LibraryView {...session} patterns={library.patterns} savePattern={library.savePattern} deletePattern={library.deletePattern} />
  return <ControlView {...session} patterns={library.patterns} />
}

export default App
