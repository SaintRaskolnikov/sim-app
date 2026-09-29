import { adminClient } from '../server/supabaseAdmin.js'

const rhythms = new Set(['sinus', 'bradycardia', 'tachycardia', 'afib', 'svt', 'flutter', 'vtach', 'torsades', 'vfib', 'fine-vfib', 'asystole', 'junctional-escape', 'ventricular-escape', 'aivr', 'mobitz1', 'mobitz2', 'complete-block', 'sinus-pause'])
const numericLimits = {
  heartRate: [0, 300],
  systolic: [0, 300],
  diastolic: [0, 300],
  spo2: [0, 100],
  respiratoryRate: [0, 80],
  etco2: [0, 100],
  temperature: [25, 45],
}

function fromRow(row) {
  return { id: row.id, name: row.name, tone: row.tone, icon: row.icon, patch: row.state_patch ?? {} }
}

function toRow(preset, sortOrder) {
  if (!preset || typeof preset.id !== 'string' || preset.id.length > 64 ||
    typeof preset.name !== 'string' || !preset.name.trim() || preset.name.length > 80 ||
    !['coral', 'amber', 'teal'].includes(preset.tone) || !['siren', 'heart', 'activity'].includes(preset.icon) ||
    !preset.patch || typeof preset.patch !== 'object' || Array.isArray(preset.patch)) return null

  const patch = {}
  for (const [key, [minimum, maximum]] of Object.entries(numericLimits)) {
    const value = preset.patch[key]
    if (value !== undefined) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) return null
      patch[key] = value
    }
  }
  if (preset.patch.rhythm !== undefined) {
    if (!rhythms.has(preset.patch.rhythm)) return null
    patch.rhythm = preset.patch.rhythm
  }
  if (preset.patch.pulsePresent !== undefined) {
    if (typeof preset.patch.pulsePresent !== 'boolean') return null
    patch.pulsePresent = preset.patch.pulsePresent
  }
  if (preset.patch.selectedEcg !== undefined && typeof preset.patch.selectedEcg === 'string' && preset.patch.selectedEcg.length <= 64) patch.selectedEcg = preset.patch.selectedEcg
  if (preset.patch.showTwelveLead !== undefined && typeof preset.patch.showTwelveLead === 'boolean') patch.showTwelveLead = preset.patch.showTwelveLead

  return { id: preset.id, name: preset.name.trim(), tone: preset.tone, icon: preset.icon, state_patch: patch, sort_order: sortOrder, updated_at: new Date().toISOString() }
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  try {
    const client = adminClient()
    if (request.method === 'GET') {
      const { data, error } = await client.from('scenario_presets').select('*').order('sort_order')
      if (error) return response.status(500).json({ error: error.message })
      return response.status(200).json((data ?? []).map(fromRow))
    }
    if (request.method === 'POST') {
      const presets = request.body?.presets
      if (!Array.isArray(presets) || presets.length > 100) return response.status(400).json({ error: 'A preset list is required' })
      const rows = presets.map(toRow)
      if (rows.some((row) => row === null)) return response.status(400).json({ error: 'One or more presets are invalid' })
      const { error } = await client.from('scenario_presets').upsert(rows, { onConflict: 'id' })
      if (error) return response.status(500).json({ error: error.message })
      return response.status(200).json({ saved: rows.length })
    }
    if (request.method === 'DELETE') {
      const id = String(request.body?.id || '').trim().slice(0, 64)
      if (!id) return response.status(400).json({ error: 'Preset id is required' })
      const { error } = await client.from('scenario_presets').delete().eq('id', id)
      if (error) return response.status(500).json({ error: error.message })
      return response.status(200).json({ deleted: id })
    }
    response.setHeader('Allow', 'GET, POST, DELETE')
    return response.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return response.status(503).json({ error: error instanceof Error ? error.message : 'Scenario preset service unavailable' })
  }
}
