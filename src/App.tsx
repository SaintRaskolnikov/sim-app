import { useEffect, useState } from 'react'
import { Activity, ArrowLeft, ArrowUp, BookOpen, HeartPulse, LogOut, Monitor, Pencil, Plus, Radio, Siren, Trash2, Volume2, VolumeX, Wifi, WifiOff, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import './App.css'
import { findPattern, rhythms, type ECGMorphology, type ECGPattern } from './data/ecgLibrary'
import { useECGLibrary } from './hooks/useECGLibrary'
import { useSimulationSession } from './hooks/useSimulationSession'
import { useMonitorAuth } from './hooks/useMonitorAuth'
import { useScenarioPresets } from './hooks/useScenarioPresets'
import { useMonitorAudio } from './hooks/useMonitorAudio'
import { MonitorAccess } from './components/MonitorAccess'
import { ScenarioPresetEditor } from './components/ScenarioPresetEditor'
import type { PresetIconId, ScenarioPreset } from './data/scenarioPresets'
import { TwelveLeadCanvas, Waveform } from './components/Waveform'
import { getActiveAlarms, meanArterialPressure, type AlarmKey, type SimulationState, type StatePatch } from './types'

const rhythmName = (id: string) => rhythms.find((rhythm) => rhythm.id === id)?.title ?? 'Sinus rhythm'

const presetIcons: Record<PresetIconId, typeof Siren> = { siren: Siren, heart: HeartPulse, activity: Activity }

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

function PairingQr({ controllerUrl, sessionId, tutorConnected }: {
  controllerUrl: string
  sessionId: string
  tutorConnected: boolean
}) {
  return <PairingQrState key={`${sessionId}:${tutorConnected}`} controllerUrl={controllerUrl} sessionId={sessionId} tutorConnected={tutorConnected} />
}

function PairingQrState({ controllerUrl, sessionId, tutorConnected }: {
  controllerUrl: string
  sessionId: string
  tutorConnected: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <div className={`monitor-pairing ${tutorConnected ? 'linked' : ''}`}>
        <button className="monitor-pairing-trigger" aria-label={tutorConnected ? 'Tutor connected' : 'Enlarge session pairing QR code'} disabled={tutorConnected} onClick={() => setExpanded(true)}>
          <QRCodeSVG value={controllerUrl} size={56} level="M" marginSize={4} bgColor="#ffffff" fgColor="#153b2b" />
        </button>
        <div><strong>{tutorConnected ? 'TUTOR LINKED' : 'SCAN TO PAIR'}</strong><span>{tutorConnected ? 'Controller connected' : 'Tap code to enlarge'}</span><small>{sessionId}</small></div>
      </div>
      {expanded && !tutorConnected && <div className="qr-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setExpanded(false) }}>
        <section className="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title">
          <button className="editor-close qr-modal-close" aria-label="Close pairing QR" onClick={() => setExpanded(false)}><X size={18} /></button>
          <span className="eyebrow">SESSION {sessionId}</span>
          <h2 id="qr-modal-title">Scan to pair tutor controls</h2>
          <div className="qr-modal-code"><QRCodeSVG value={controllerUrl} size={320} level="H" marginSize={4} bgColor="#ffffff" fgColor="#153b2b" /></div>
          <p>Open the camera on the tutor phone</p>
        </section>
      </div>}
    </>
  )
}

function MonitorView({ state, status, sessionId, patterns, tutorConnected, update, signOut }: {
  state: SimulationState
  status: 'connecting' | 'connected' | 'offline'
  sessionId: string
  patterns: ECGPattern[]
  tutorConnected: boolean
  update: (patch: StatePatch) => void
  signOut?: () => void
}) {
  const [clock, setClock] = useState(() => new Date())
  const [controllerOrigin, setControllerOrigin] = useState(() => window.location.origin)
  const selectedPattern = findPattern(state.selectedEcg, patterns)
  const activeAlarms = getActiveAlarms(state)
  const isAlarming = (key: AlarmKey) => activeAlarms.some((alarm) => alarm.key === key)
  const audio = useMonitorAudio(state, activeAlarms)
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
        <div className="monitor-actions"><ConnectionBadge status={status} /><PairingQr controllerUrl={controllerUrl} sessionId={sessionId} tutorConnected={tutorConnected} /><button className="monitor-mode-button audio-button" aria-label={audio.enabled ? 'Mute monitor audio' : 'Enable monitor audio'} title={audio.enabled ? 'Mute monitor audio' : 'Enable monitor audio'} aria-pressed={audio.enabled} onClick={() => void audio.toggle()}>{audio.enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}</button><button className="monitor-mode-button" onClick={() => update({ showTwelveLead: !state.showTwelveLead })}>{state.showTwelveLead ? <Activity size={16} /> : <Radio size={16} />}{state.showTwelveLead ? 'Bedside' : '12-lead'}</button>{signOut && <button className="monitor-mode-button monitor-sign-out" onClick={signOut}><LogOut size={14} />Sign out</button>}</div>
      </header>

      <div className="monitor-warning">SIMULATION ONLY <span>·</span> NOT FOR CLINICAL USE</div>
      <div className={`monitor-alarm-strip ${activeAlarms.length ? 'active' : 'clear'}`} role="status" aria-live="assertive">
        {activeAlarms.length ? activeAlarms.map((alarm) => <span key={`${alarm.key}-${alarm.level}`}><strong>{alarm.level}</strong> {alarm.label}</span>) : <span>ALARMS CLEAR</span>}
        {!state.bloodPressureAvailable && <span className="bp-unavailable-alarm">BP NOT MEASURED</span>}
      </div>

      <section className="monitor-readouts" aria-label="Patient vital signs">
        <div className={`monitor-metric hr-metric ${isAlarming('heartRate') ? 'alarming' : ''}`}><div className="metric-label"><span className="metric-dot" />ECG <span className="metric-unit">bpm</span></div><div className="metric-value">{state.heartRate}<small>{rhythmName(state.rhythm)}</small></div></div>
        <div className={`monitor-metric bp-metric ${isAlarming('systolic') || isAlarming('diastolic') ? 'alarming' : ''}`}><div className="metric-label"><span className="metric-dot" />{state.bloodPressureMode === 'cuff' ? 'NIBP' : 'ART'} <span className="metric-unit">mmHg</span></div><div className="metric-value bp-value">{state.bloodPressureAvailable ? <>{state.systolic}<span>/</span>{state.diastolic}</> : '?/?'}<small>{state.bloodPressureAvailable ? `MAP ${meanArterialPressure(state.systolic, state.diastolic)}` : 'NOT MEASURED'}</small></div></div>
        <div className={`monitor-metric spo2-metric ${isAlarming('spo2') ? 'alarming' : ''}`}><div className="metric-label"><span className="metric-dot" />SpO₂ <span className="metric-unit">%</span></div><div className="metric-value">{state.spo2}<small>PLETH</small></div></div>
        <div className={`monitor-metric co2-metric ${isAlarming('etco2') || isAlarming('respiratoryRate') ? 'alarming' : ''}`}><div className="metric-label"><span className="metric-dot" />EtCO₂ <span className="metric-unit">mmHg</span></div><div className="metric-value">{state.etco2}<small>RR {state.respiratoryRate} /min</small></div></div>
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
          <div className={`monitor-wave-row pressure-wave-row ${isAlarming('systolic') || isAlarming('diastolic') ? 'alarming' : ''}`}><div className="wave-label"><strong>{state.bloodPressureMode === 'cuff' ? 'NIBP' : 'ART'}</strong><span>mmHg</span></div><Waveform kind="pressure" color="#f3d353" state={state} /><div className="wave-reading"><strong>{state.bloodPressureAvailable ? `${state.systolic}/${state.diastolic}` : '?/?'}</strong><span>{state.bloodPressureAvailable ? `MAP ${meanArterialPressure(state.systolic, state.diastolic)}` : 'not measured'}</span></div></div>
          <div className={`monitor-wave-row pleth-wave-row ${isAlarming('spo2') ? 'alarming' : ''}`}><div className="wave-label"><strong>PLETH</strong><span>SpO₂</span></div><Waveform kind="pleth" color="#65c7f2" state={state} /><div className="wave-reading"><strong>{state.spo2}<small>%</small></strong><span>SpO₂</span></div></div>
          <div className={`monitor-wave-row capno-wave-row ${isAlarming('etco2') || isAlarming('respiratoryRate') ? 'alarming' : ''}`}><div className="wave-label"><strong>CO₂</strong><span>mmHg</span></div><Waveform kind="capno" color="#d88bf2" state={state} /><div className="wave-reading"><strong>{state.etco2}</strong><span>RR {state.respiratoryRate}</span></div></div>
        </section>
      )}

      <footer className="monitor-footer"><div className={isAlarming('temperature') ? 'alarming' : ''}><span className="footer-label">TEMP</span><strong>{state.temperature.toFixed(1)} °C</strong></div><div><span className="footer-label">RHYTHM</span><strong>{rhythmName(state.rhythm)}</strong></div><div><span className="footer-label">ECG PATTERN</span><strong>{selectedPattern.title}</strong></div><span className="monitor-disclaimer">For simulation and training only</span></footer>
    </main>
  )
}

function NumberControl({ label, value, unit, step, min, max, digits = 0, tone = 'neutral', disabled = false, displayValue, onChange }: {
  label: string
  value: number
  unit: string
  step: number
  min: number
  max: number
  digits?: number
  tone?: 'ecg' | 'bp' | 'spo2' | 'co2' | 'neutral'
  disabled?: boolean
  displayValue?: string
  onChange: (value: number) => void
}) {
  const adjust = (delta: number) => {
    if (disabled) return
    const next = Math.min(max, Math.max(min, value + delta))
    onChange(Number(next.toFixed(digits)))
  }
  return (
    <div className={`number-control tone-${tone}`}>
      <div className="number-control-label">{label}</div>
      <div className="stepper">
        <button aria-label={`Decrease ${label}`} disabled={disabled} onClick={() => adjust(-step)}>−</button>
        <div className="stepper-value"><strong>{displayValue ?? (digits ? value.toFixed(digits) : value)}</strong><span>{unit}</span></div>
        <button aria-label={`Increase ${label}`} disabled={disabled} onClick={() => adjust(step)}>+</button>
      </div>
    </div>
  )
}

function ControlView({ state, status, sessionId, patterns, presets, update, joinSession, savePreset, deletePreset }: {
  state: SimulationState
  status: 'connecting' | 'connected' | 'offline'
  sessionId: string
  patterns: ECGPattern[]
  presets: ScenarioPreset[]
  update: (patch: StatePatch) => void
  joinSession: (id: string) => void
  savePreset: (preset: ScenarioPreset) => void
  deletePreset: (id: string) => void
}) {
  const [sessionDraft, setSessionDraft] = useState(sessionId)
  const [editingPreset, setEditingPreset] = useState<ScenarioPreset | null>(null)
  const [editingExisting, setEditingExisting] = useState(false)
  const startNewPreset = () => {
    setEditingExisting(false)
    setEditingPreset({
      id: `custom-preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: 'New scenario',
      tone: 'teal',
      icon: 'activity',
      patch: { ...state, showTwelveLead: false },
    })
  }
  const startPresetEdit = (preset: ScenarioPreset) => {
    setEditingExisting(true)
    setEditingPreset({ ...preset, patch: { ...preset.patch } })
  }
  const updateAlarmRange = (key: AlarmKey, bound: 'low' | 'high', rawValue: string, minimum: number, maximum: number) => {
    const value = Math.min(maximum, Math.max(minimum, Number(rawValue)))
    if (!Number.isFinite(value)) return
    const range = { ...state.alarmLimits[key], [bound]: value }
    if (range.low >= range.high) return
    update({ alarmLimits: { ...state.alarmLimits, [key]: range } })
  }

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
          <div className="blood-pressure-group">
            <div className="bp-group-heading">
              <div className="bp-group-title"><strong>Blood pressure</strong><small>{state.bloodPressureMode === 'cuff' ? 'Intermittent cuff reading' : 'Continuous arterial pressure'}</small></div>
              <div className="segmented-control" role="group" aria-label="Blood pressure source"><button type="button" aria-pressed={state.bloodPressureMode === 'cuff'} onClick={() => update({ bloodPressureMode: 'cuff' })}>Cuff · NIBP</button><button type="button" aria-pressed={state.bloodPressureMode === 'arterial'} onClick={() => update({ bloodPressureMode: 'arterial' })}>Arterial line · ART</button></div>
              <label className="bp-availability"><input type="checkbox" aria-label="Blood pressure measured" checked={state.bloodPressureAvailable} onChange={(event) => update({ bloodPressureAvailable: event.target.checked })} /> Measured</label>
            </div>
            <div className="bp-control-grid">
              <NumberControl label="Systolic BP" value={state.systolic} unit="mmHg" step={5} min={0} max={300} tone="bp" disabled={!state.bloodPressureAvailable} displayValue={state.bloodPressureAvailable ? undefined : '?'} onChange={(systolic) => update({ systolic })} />
              <NumberControl label="Diastolic BP" value={state.diastolic} unit="mmHg" step={5} min={0} max={300} tone="bp" disabled={!state.bloodPressureAvailable} displayValue={state.bloodPressureAvailable ? undefined : '?'} onChange={(diastolic) => update({ diastolic })} />
              <div className="map-readout"><span>Mean arterial pressure</span><strong>{state.bloodPressureAvailable ? meanArterialPressure(state.systolic, state.diastolic) : '?'} <small>mmHg</small></strong>{state.bloodPressureAvailable && <span className="auto-tag">AUTO</span>}</div>
            </div>
          </div>
          <div className="number-grid">
            <NumberControl label="Heart rate" value={state.heartRate} unit="bpm" step={5} min={0} max={300} tone="ecg" onChange={(heartRate) => update({ heartRate })} />
            <NumberControl label="SpO₂" value={state.spo2} unit="%" step={1} min={0} max={100} tone="spo2" onChange={(spo2) => update({ spo2 })} />
            <NumberControl label="Respiratory rate" value={state.respiratoryRate} unit="/min" step={1} min={0} max={80} tone="co2" onChange={(respiratoryRate) => update({ respiratoryRate })} />
            <NumberControl label="EtCO₂" value={state.etco2} unit="mmHg" step={1} min={0} max={100} tone="co2" onChange={(etco2) => update({ etco2 })} />
            <NumberControl label="Temperature" value={state.temperature} unit="°C" step={0.1} min={25} max={45} digits={1} onChange={(temperature) => update({ temperature })} />
          </div>
        </section>

        <section className="control-section rhythm-section"><div className="section-heading"><div><span className="section-index">02</span><h2>Rhythm</h2></div><span>{rhythmName(state.rhythm)}</span></div>
          <div className="pulse-control"><div className="pulse-control-copy"><span className={`pulse-indicator ${state.pulsePresent ? 'present' : 'absent'}`} /><div><strong>Palpable pulse</strong><small>{state.pulsePresent ? 'Pulse present' : 'No pulse'} · independent of ECG rhythm</small></div></div><button className={`toggle ${state.pulsePresent ? 'on' : ''}`} role="switch" aria-checked={state.pulsePresent} aria-label="Palpable pulse" onClick={() => update({ pulsePresent: !state.pulsePresent })}><span /></button></div>
          <div className="rhythm-grid">{rhythms.map((rhythm) => <button key={rhythm.id} className={state.rhythm === rhythm.rhythm ? 'selected' : ''} onClick={() => update({ rhythm: rhythm.rhythm, heartRate: rhythm.suggestedRate ?? state.heartRate, pulsePresent: ['vfib', 'fine-vfib', 'asystole'].includes(rhythm.id) ? false : state.pulsePresent, selectedEcg: rhythm.id, showTwelveLead: false })}><span className="rhythm-led" />{rhythm.title}</button>)}</div>
        </section>

        <section className="control-section preset-section"><div className="section-heading"><div><span className="section-index">03</span><h2>Scenario presets</h2></div><button className="preset-add-button" onClick={startNewPreset}><Plus size={15} />Add preset</button></div>
          <div className="preset-grid">{presets.map((preset) => { const Icon = presetIcons[preset.icon]; return <div key={preset.id} className="preset-tile"><button className={`preset-button ${preset.tone}`} onClick={() => update(preset.patch)}><span className="preset-icon"><Icon size={19} /></span><span>{preset.name}</span><span className="preset-apply">Apply</span></button><button className="pattern-edit preset-edit" aria-label={`Edit ${preset.name}`} onClick={() => startPresetEdit(preset)}><Pencil size={14} /></button></div> })}</div>
        </section>

        <section className="control-section display-section"><div className="section-heading"><div><span className="section-index">04</span><h2>Display</h2></div><span>Monitor output</span></div>
          <div className="display-control"><div className="display-copy"><span className="display-icon"><Radio size={18} /></span><div><strong>12-lead ECG</strong><small>{findPattern(state.selectedEcg, patterns).title}</small></div></div><button className={`toggle ${state.showTwelveLead ? 'on' : ''}`} role="switch" aria-checked={state.showTwelveLead} aria-label="Show 12-lead ECG" onClick={() => update({ showTwelveLead: !state.showTwelveLead })}><span /></button></div>
          <div className="ecg-quick-grid">{patterns.filter((pattern) => pattern.category === '12-lead').map((pattern) => <button key={pattern.id} className={state.selectedEcg === pattern.id ? 'selected' : ''} onClick={() => update({ selectedEcg: pattern.id, rhythm: pattern.rhythm, heartRate: pattern.suggestedRate ?? state.heartRate, pulsePresent: ['vfib', 'fine-vfib', 'asystole'].includes(pattern.rhythm) ? false : state.pulsePresent, showTwelveLead: true })}><span>{pattern.territory ?? '12-LEAD'}</span><strong>{pattern.title}</strong></button>)}</div>
          <a className="library-link" href={`/ekg-library?session=${encodeURIComponent(sessionId)}`}>Choose a preloaded ECG <ArrowUp size={14} /></a>
        </section>
        <section className="control-section alarm-section"><div className="section-heading"><div><span className="section-index">05</span><h2>Alarm limits</h2></div><span>Low and high thresholds</span></div>
          <div className="alarm-limit-grid">{([
            ['heartRate', 'ECG rate', 'bpm', 0, 300, 1],
            ['systolic', 'Systolic BP', 'mmHg', 0, 300, 1],
            ['diastolic', 'Diastolic BP', 'mmHg', 0, 300, 1],
            ['spo2', 'SpO₂', '%', 0, 100, 1],
            ['respiratoryRate', 'Respiratory rate', '/min', 0, 80, 1],
            ['etco2', 'EtCO₂', 'mmHg', 0, 100, 1],
            ['temperature', 'Temperature', '°C', 25, 45, 0.1],
          ] as const).map(([key, label, unit, min, max, step]) => <label className="alarm-limit-field" key={key}>{label}<span><input type="number" aria-label={`${label} low alarm`} min={min} max={max} step={step} value={state.alarmLimits[key].low} onChange={(event) => updateAlarmRange(key, 'low', event.target.value, min, max)} /><small>LOW</small></span><span><input type="number" aria-label={`${label} high alarm`} min={min} max={max} step={step} value={state.alarmLimits[key].high} onChange={(event) => updateAlarmRange(key, 'high', event.target.value, min, max)} /><small>HIGH</small></span><em>{unit}</em></label>)}</div>
        </section>
        <p className="training-note"><span>!</span> Simulation and training use only. Not for real patient monitoring or clinical decision-making.</p>
      </main>
      {editingPreset && <ScenarioPresetEditor key={editingPreset.id} preset={editingPreset} patterns={patterns} canDelete={editingExisting && editingPreset.id.startsWith('custom-preset-')} onSave={(preset) => { savePreset(preset); setEditingPreset(null) }} onDelete={(id) => { deletePreset(id); setEditingPreset(null) }} onClose={() => setEditingPreset(null)} />}
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
    update({ selectedEcg: id, rhythm: pattern.rhythm, heartRate: pattern.suggestedRate ?? state.heartRate, pulsePresent: ['vfib', 'fine-vfib', 'asystole'].includes(pattern.rhythm) ? false : state.pulsePresent, showTwelveLead: pattern.category === '12-lead' })
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
    { id: 'svt', label: 'Regular narrow SVT' },
    { id: 'flutter', label: 'Atrial flutter' },
    { id: 'vtach', label: 'Wide-complex tachycardia' },
    { id: 'torsades', label: 'Polymorphic VT / torsades' },
    { id: 'vfib', label: 'Ventricular fibrillation' },
    { id: 'fine-vfib', label: 'Fine ventricular fibrillation' },
    { id: 'asystole', label: 'Asystole' },
    { id: 'junctional-escape', label: 'Junctional escape' },
    { id: 'ventricular-escape', label: 'Ventricular escape' },
    { id: 'aivr', label: 'Accelerated idioventricular' },
    { id: 'mobitz1', label: 'Mobitz I block' },
    { id: 'mobitz2', label: 'Mobitz II block' },
    { id: 'complete-block', label: 'Complete heart block' },
    { id: 'sinus-pause', label: 'Sinus pause' },
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
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  const isMonitorRoute = path === '/monitor'
  const isAuthRoute = path === '/' || path === '/login' || path === '/register'
  const initialAuthMode = path === '/register' ? 'register' : 'sign-in'
  const authRequired = (isMonitorRoute || isAuthRoute) && import.meta.env.PROD
  const auth = useMonitorAuth(authRequired)
  const canConnect = !authRequired || auth.authenticated
  const session = useSimulationSession(canConnect)
  const library = useECGLibrary(canConnect)
  const scenarioPresets = useScenarioPresets(canConnect)
  useEffect(() => {
    if (isAuthRoute && auth.authenticated) window.location.replace('/monitor')
  }, [auth.authenticated, isAuthRoute])
  if (authRequired && !auth.authenticated) return <MonitorAccess configured={auth.configured} loading={auth.loading} initialMode={initialAuthMode} onAuthenticated={auth.refreshSession} />
  if (isMonitorRoute) return <MonitorView {...session} patterns={library.patterns} signOut={authRequired ? auth.signOut : undefined} />
  if (path === '/ekg-library') return <LibraryView {...session} patterns={library.patterns} savePattern={library.savePattern} deletePattern={library.deletePattern} />
  if (isAuthRoute) return <MonitorAccess configured={auth.configured} loading={auth.loading} initialMode={initialAuthMode} onAuthenticated={auth.refreshSession} />
  return <ControlView {...session} patterns={library.patterns} presets={scenarioPresets.presets} savePreset={scenarioPresets.savePreset} deletePreset={scenarioPresets.deletePreset} />
}

export default App
