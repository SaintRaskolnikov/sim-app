import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'

const directory = dirname(fileURLToPath(import.meta.url))
const storagePath = resolve(directory, '../data/sessions.json')
const libraryPath = resolve(directory, '../data/ecg-patterns.json')
const presetsPath = resolve(directory, '../data/scenario-presets.json')
const initialState = {
  heartRate: 85,
  rhythm: 'sinus',
  pulsePresent: true,
  systolic: 110,
  diastolic: 70,
  bloodPressureMode: 'cuff',
  bloodPressureAvailable: true,
  alarmLimits: {
    heartRate: { low: 50, high: 120 },
    systolic: { low: 90, high: 180 },
    diastolic: { low: 60, high: 120 },
    spo2: { low: 90, high: 100 },
    respiratoryRate: { low: 8, high: 30 },
    etco2: { low: 20, high: 50 },
    temperature: { low: 35, high: 39 },
  },
  spo2: 96,
  respiratoryRate: 14,
  etco2: 35,
  temperature: 36.8,
  selectedEcg: 'normal-sinus',
  showTwelveLead: false,
}
const rhythms = new Set(['sinus', 'bradycardia', 'tachycardia', 'afib', 'svt', 'flutter', 'vtach', 'torsades', 'vfib', 'fine-vfib', 'asystole', 'junctional-escape', 'ventricular-escape', 'aivr', 'mobitz1', 'mobitz2', 'complete-block', 'sinus-pause'])
const numericRanges = {
  heartRate: [0, 300],
  systolic: [0, 300],
  diastolic: [0, 300],
  spo2: [0, 100],
  respiratoryRate: [0, 80],
  etco2: [0, 100],
  temperature: [25, 45],
}
const alarmRanges = {
  heartRate: [0, 300],
  systolic: [0, 300],
  diastolic: [0, 300],
  spo2: [0, 100],
  respiratoryRate: [0, 80],
  etco2: [0, 100],
  temperature: [25, 45],
}

function cleanAlarmLimits(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const cleaned = {}
  for (const [key, [minimum, maximum]] of Object.entries(alarmRanges)) {
    const range = input[key]
    if (!range || typeof range.low !== 'number' || typeof range.high !== 'number' ||
      !Number.isFinite(range.low) || !Number.isFinite(range.high) ||
      range.low < minimum || range.high > maximum || range.low >= range.high) return null
    cleaned[key] = { low: range.low, high: range.high }
  }
  return cleaned
}
const sessions = new Map()
let ecgLibrary = []
let scenarioPresets = []

try {
  const saved = JSON.parse(await readFile(storagePath, 'utf8'))
  for (const [id, state] of Object.entries(saved)) sessions.set(id, { ...initialState, ...state, alarmLimits: { ...initialState.alarmLimits, ...state.alarmLimits } })
} catch {
  await mkdir(dirname(storagePath), { recursive: true })
}

try {
  ecgLibrary = JSON.parse(await readFile(libraryPath, 'utf8'))
} catch {
  await mkdir(dirname(libraryPath), { recursive: true })
}

try {
  scenarioPresets = JSON.parse(await readFile(presetsPath, 'utf8'))
} catch {
  await mkdir(dirname(presetsPath), { recursive: true })
}

const persist = async () => {
  await mkdir(dirname(storagePath), { recursive: true })
  await writeFile(storagePath, JSON.stringify(Object.fromEntries(sessions), null, 2))
}

const persistLibrary = async () => {
  await mkdir(dirname(libraryPath), { recursive: true })
  await writeFile(libraryPath, JSON.stringify(ecgLibrary, null, 2))
}

const persistScenarioPresets = async () => {
  await mkdir(dirname(presetsPath), { recursive: true })
  await writeFile(presetsPath, JSON.stringify(scenarioPresets, null, 2))
}

const server = createServer()
const io = new Server(server, { path: '/socket.io' })
const tutorRoom = (sessionId) => `${sessionId}:tutors`

async function publishTutorPresence(sessionId) {
  const tutors = await io.in(tutorRoom(sessionId)).fetchSockets()
  io.to(sessionId).emit('tutor-presence', { connected: tutors.length > 0 })
}

io.on('connection', (socket) => {
  socket.on('get-library', () => socket.emit('library-state', ecgLibrary))
  socket.on('get-scenario-presets', () => socket.emit('scenario-presets-state', scenarioPresets))
  socket.on('save-scenario-presets', async (requestedPresets) => {
    if (!Array.isArray(requestedPresets) || requestedPresets.length > 100) return
    const safePresets = requestedPresets.filter((preset) =>
      preset && typeof preset.id === 'string' && preset.id.length <= 64 &&
      typeof preset.name === 'string' && preset.name.trim().length > 0 && preset.name.length <= 80 &&
      ['coral', 'amber', 'teal'].includes(preset.tone) && ['siren', 'heart', 'activity'].includes(preset.icon) &&
      preset.patch && typeof preset.patch === 'object'
    )
    scenarioPresets = safePresets
    await persistScenarioPresets()
    io.emit('scenario-presets-state', scenarioPresets)
  })
  socket.on('save-library', async (requestedPatterns) => {
    if (!Array.isArray(requestedPatterns) || requestedPatterns.length > 200) return
    const safePatterns = requestedPatterns.filter((pattern) =>
      pattern && typeof pattern.id === 'string' && pattern.id.length <= 64 &&
      typeof pattern.title === 'string' && pattern.title.length <= 100 &&
      ['Rhythm', '12-lead'].includes(pattern.category) && rhythms.has(pattern.rhythm) &&
      typeof pattern.description === 'string' && pattern.description.length <= 300 &&
      (pattern.suggestedRate === undefined || (typeof pattern.suggestedRate === 'number' && pattern.suggestedRate >= 0 && pattern.suggestedRate <= 300)) &&
      (!pattern.imageUrl || typeof pattern.imageUrl === 'string')
    )
    ecgLibrary = safePatterns
    await persistLibrary()
    io.emit('library-state', ecgLibrary)
  })

  socket.on('join-session', async (request) => {
    const details = request && typeof request === 'object' ? request : { id: request }
    const sessionId = String(details.id || 'sim-01').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'sim-01'
    const role = details.role === 'monitor' ? 'monitor' : 'tutor'
    if (socket.data.sessionId) {
      const previousSessionId = socket.data.sessionId
      socket.leave(previousSessionId)
      socket.leave(tutorRoom(previousSessionId))
      if (socket.data.role === 'tutor') await publishTutorPresence(previousSessionId)
    }
    socket.data.sessionId = sessionId
    socket.data.role = role
    socket.join(sessionId)
    if (role === 'tutor') socket.join(tutorRoom(sessionId))
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, { ...initialState })
      await persist()
    }
    socket.emit('session-state', sessions.get(sessionId))
    await publishTutorPresence(sessionId)
  })

  socket.on('disconnecting', () => {
    if (!socket.data.sessionId || socket.data.role !== 'tutor') return
    const tutors = io.sockets.adapter.rooms.get(tutorRoom(socket.data.sessionId))
    io.to(socket.data.sessionId).emit('tutor-presence', { connected: (tutors?.size ?? 0) > 1 })
  })

  socket.on('update-state', async (patch) => {
    const sessionId = socket.data.sessionId
    if (!sessionId || !patch || typeof patch !== 'object') return
    const current = sessions.get(sessionId) ?? { ...initialState }
    const accepted = {}
    for (const [key, range] of Object.entries(numericRanges)) {
      if (typeof patch[key] === 'number' && Number.isFinite(patch[key])) {
        accepted[key] = Math.min(range[1], Math.max(range[0], patch[key]))
      }
    }
    if (typeof patch.rhythm === 'string' && rhythms.has(patch.rhythm)) accepted.rhythm = patch.rhythm
    if (typeof patch.pulsePresent === 'boolean') accepted.pulsePresent = patch.pulsePresent
    if (patch.bloodPressureMode === 'cuff' || patch.bloodPressureMode === 'arterial') accepted.bloodPressureMode = patch.bloodPressureMode
    if (typeof patch.bloodPressureAvailable === 'boolean') accepted.bloodPressureAvailable = patch.bloodPressureAvailable
    if (patch.alarmLimits !== undefined) {
      const limits = cleanAlarmLimits(patch.alarmLimits)
      if (limits) accepted.alarmLimits = limits
    }
    if (typeof patch.selectedEcg === 'string' && patch.selectedEcg.length <= 64) accepted.selectedEcg = patch.selectedEcg
    if (typeof patch.showTwelveLead === 'boolean') accepted.showTwelveLead = patch.showTwelveLead
    if (Object.keys(accepted).length === 0) return
    const nextState = { ...current, ...accepted }
    sessions.set(sessionId, nextState)
    await persist()
    io.to(sessionId).emit('state-updated', nextState)
  })
})

const port = Number(process.env.SOCKET_PORT || 3001)
server.listen(port, '0.0.0.0', () => console.log(`Simulation session server listening on ${port}`))
