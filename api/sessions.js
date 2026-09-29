import { adminClient } from '../server/supabaseAdmin.js'

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
const ranges = {
  heartRate: [0, 300],
  systolic: [0, 300],
  diastolic: [0, 300],
  spo2: [0, 100],
  respiratoryRate: [0, 80],
  etco2: [0, 100],
  temperature: [25, 45],
}

function cleanState(input, current) {
  const next = { ...initialState, ...current }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return next
  for (const [key, [minimum, maximum]] of Object.entries(ranges)) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key])) {
      next[key] = Math.min(maximum, Math.max(minimum, input[key]))
    }
  }
  if (typeof input.rhythm === 'string' && rhythms.has(input.rhythm)) next.rhythm = input.rhythm
  if (typeof input.pulsePresent === 'boolean') next.pulsePresent = input.pulsePresent
  if (typeof input.selectedEcg === 'string' && input.selectedEcg.length <= 64) next.selectedEcg = input.selectedEcg
  if (typeof input.showTwelveLead === 'boolean') next.showTwelveLead = input.showTwelveLead
  return next
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  try {
    const client = adminClient()
    if (request.method === 'GET') {
      const id = String(request.query.id || '').trim().slice(0, 80)
      if (!id) return response.status(400).json({ error: 'Session id is required' })
      const { data, error } = await client.from('simulation_sessions').select('state').eq('id', id).maybeSingle()
      if (error) return response.status(500).json({ error: error.message })
      return response.status(200).json({ state: data?.state ?? null })
    }

    if (request.method === 'POST') {
      const id = String(request.body?.id || '').trim().slice(0, 80)
      if (!id) return response.status(400).json({ error: 'Session id is required' })
      const { data: existing } = await client.from('simulation_sessions').select('state').eq('id', id).maybeSingle()
      const state = cleanState(request.body?.state, existing?.state)
      const { error } = await client.from('simulation_sessions').upsert({ id, state, updated_at: new Date().toISOString() })
      if (error) return response.status(500).json({ error: error.message })
      return response.status(200).json({ state })
    }

    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return response.status(503).json({ error: error instanceof Error ? error.message : 'Session service unavailable' })
  }
}
