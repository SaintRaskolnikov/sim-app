import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'

const directory = dirname(fileURLToPath(import.meta.url))
const storagePath = resolve(directory, '../data/sessions.json')
const libraryPath = resolve(directory, '../data/ecg-patterns.json')
const initialState = {
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
const rhythms = new Set(['sinus', 'bradycardia', 'tachycardia', 'afib', 'vtach', 'vfib', 'asystole'])
const numericRanges = {
  heartRate: [0, 300],
  systolic: [0, 300],
  diastolic: [0, 300],
  spo2: [0, 100],
  respiratoryRate: [0, 80],
  etco2: [0, 100],
  temperature: [25, 45],
}
const sessions = new Map()
let ecgLibrary = []

try {
  const saved = JSON.parse(await readFile(storagePath, 'utf8'))
  for (const [id, state] of Object.entries(saved)) sessions.set(id, { ...initialState, ...state })
} catch {
  await mkdir(dirname(storagePath), { recursive: true })
}

try {
  ecgLibrary = JSON.parse(await readFile(libraryPath, 'utf8'))
} catch {
  await mkdir(dirname(libraryPath), { recursive: true })
}

const persist = async () => {
  await mkdir(dirname(storagePath), { recursive: true })
  await writeFile(storagePath, JSON.stringify(Object.fromEntries(sessions), null, 2))
}

const persistLibrary = async () => {
  await mkdir(dirname(libraryPath), { recursive: true })
  await writeFile(libraryPath, JSON.stringify(ecgLibrary, null, 2))
}

const server = createServer()
const io = new Server(server, { path: '/socket.io' })

io.on('connection', (socket) => {
  socket.on('get-library', () => socket.emit('library-state', ecgLibrary))
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

  socket.on('join-session', async (requestedId) => {
    const sessionId = String(requestedId || 'sim-01').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'sim-01'
    if (socket.data.sessionId) socket.leave(socket.data.sessionId)
    socket.data.sessionId = sessionId
    socket.join(sessionId)
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, { ...initialState })
      await persist()
    }
    socket.emit('session-state', sessions.get(sessionId))
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
