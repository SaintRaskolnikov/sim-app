import { ensureDatabaseSchema, getNeonSql } from '../server/neonDb.js'
import { verifyMonitorRequest } from '../server/neonAuth.js'

const initialState = {
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

function cleanPatch(input) {
  const accepted = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return accepted
  for (const [key, [minimum, maximum]] of Object.entries(numericRanges)) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key])) accepted[key] = Math.min(maximum, Math.max(minimum, input[key]))
  }
  if (typeof input.rhythm === 'string' && rhythms.has(input.rhythm)) accepted.rhythm = input.rhythm
  if (typeof input.pulsePresent === 'boolean') accepted.pulsePresent = input.pulsePresent
  if (typeof input.selectedEcg === 'string' && input.selectedEcg.length <= 64) accepted.selectedEcg = input.selectedEcg
  if (typeof input.showTwelveLead === 'boolean') accepted.showTwelveLead = input.showTwelveLead
  return accepted
}

function getIdentity(request) {
  return {
    role: request.query.role === 'monitor' ? 'monitor' : 'tutor',
    clientId: typeof request.query.clientId === 'string' ? request.query.clientId.slice(0, 80) : '',
  }
}

async function requireMonitorAuth(request, role) {
  if (role !== 'monitor') return true
  return Boolean(await verifyMonitorRequest(request))
}

async function recordParticipant(sql, sessionId, clientId, role) {
  if (!clientId || !/^[a-zA-Z0-9_-]+$/.test(clientId)) return
  await sql`delete from public.session_participants where session_id = ${sessionId} and last_seen < now() - interval '20 seconds'`
  await sql`insert into public.session_participants (session_id, client_id, role, last_seen)
    values (${sessionId}, ${clientId}, ${role}, now())
    on conflict (session_id, client_id) do update set role = excluded.role, last_seen = now()`
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  try {
    await ensureDatabaseSchema()
    const sql = getNeonSql()
    if (request.method === 'GET') {
      const id = String(request.query.id || '').trim().slice(0, 80)
      if (!id) return response.status(400).json({ error: 'Session id is required' })
      const { role, clientId } = getIdentity(request)
      if (!await requireMonitorAuth(request, role)) return response.status(401).json({ error: 'Monitor sign-in required' })
      await sql`insert into public.simulation_sessions (id, state) values (${id}, ${JSON.stringify(initialState)}::jsonb) on conflict (id) do nothing`
      await recordParticipant(sql, id, clientId, role)
      const rows = await sql`select state from public.simulation_sessions where id = ${id}`
      const tutors = await sql`select count(*)::int as count from public.session_participants where session_id = ${id} and role = 'tutor' and last_seen > now() - interval '15 seconds'`
      return response.status(200).json({ state: rows[0]?.state ?? initialState, tutorConnected: (tutors[0]?.count ?? 0) > 0 })
    }
    if (request.method === 'POST') {
      const id = String(request.body?.id || '').trim().slice(0, 80)
      if (!id) return response.status(400).json({ error: 'Session id is required' })
      const role = request.body?.role === 'monitor' ? 'monitor' : 'tutor'
      if (!await requireMonitorAuth(request, role)) return response.status(401).json({ error: 'Monitor sign-in required' })
      const patch = cleanPatch(request.body?.patch)
      if (Object.keys(patch).length === 0) return response.status(400).json({ error: 'No valid state changes provided' })
      await sql`insert into public.simulation_sessions (id, state) values (${id}, ${JSON.stringify(initialState)}::jsonb) on conflict (id) do nothing`
      const rows = await sql`update public.simulation_sessions set state = state || ${JSON.stringify(patch)}::jsonb, updated_at = now() where id = ${id} returning state`
      const clientId = typeof request.body?.clientId === 'string' ? request.body.clientId.slice(0, 80) : ''
      await recordParticipant(sql, id, clientId, role)
      return response.status(200).json({ state: rows[0]?.state ?? initialState })
    }
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return response.status(503).json({ error: error instanceof Error ? error.message : 'Session service unavailable' })
  }
}
