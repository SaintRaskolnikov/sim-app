import { ensureDatabaseSchema, getNeonSql } from '../server/neonDb.js'

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

function fromRow(row) {
  return { id: row.id, name: row.name, tone: row.tone, icon: row.icon, patch: row.state_patch ?? {} }
}

function cleanPreset(preset, sortOrder) {
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
  if (preset.patch.bloodPressureMode !== undefined) {
    if (!['cuff', 'arterial'].includes(preset.patch.bloodPressureMode)) return null
    patch.bloodPressureMode = preset.patch.bloodPressureMode
  }
  if (preset.patch.bloodPressureAvailable !== undefined) {
    if (typeof preset.patch.bloodPressureAvailable !== 'boolean') return null
    patch.bloodPressureAvailable = preset.patch.bloodPressureAvailable
  }
  if (preset.patch.alarmLimits !== undefined) {
    const alarmLimits = cleanAlarmLimits(preset.patch.alarmLimits)
    if (!alarmLimits) return null
    patch.alarmLimits = alarmLimits
  }
  if (preset.patch.selectedEcg !== undefined && typeof preset.patch.selectedEcg === 'string' && preset.patch.selectedEcg.length <= 64) patch.selectedEcg = preset.patch.selectedEcg
  if (preset.patch.showTwelveLead !== undefined && typeof preset.patch.showTwelveLead === 'boolean') patch.showTwelveLead = preset.patch.showTwelveLead
  return { id: preset.id, name: preset.name.trim(), tone: preset.tone, icon: preset.icon, patch, sortOrder }
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  try {
    await ensureDatabaseSchema()
    const sql = getNeonSql()
    if (request.method === 'GET') {
      const rows = await sql`select * from public.scenario_presets order by sort_order`
      return response.status(200).json(rows.map(fromRow))
    }
    if (request.method === 'POST') {
      const presets = request.body?.presets
      if (!Array.isArray(presets) || presets.length > 100) return response.status(400).json({ error: 'A preset list is required' })
      const rows = presets.map(cleanPreset)
      if (rows.some((row) => row === null)) return response.status(400).json({ error: 'One or more presets are invalid' })
      for (const row of rows) {
        await sql`insert into public.scenario_presets (id, name, tone, icon, state_patch, sort_order, updated_at)
          values (${row.id}, ${row.name}, ${row.tone}, ${row.icon}, ${JSON.stringify(row.patch)}::jsonb, ${row.sortOrder}, now())
          on conflict (id) do update set name = excluded.name, tone = excluded.tone, icon = excluded.icon, state_patch = excluded.state_patch, sort_order = excluded.sort_order, updated_at = now()`
      }
      return response.status(200).json({ saved: rows.length })
    }
    if (request.method === 'DELETE') {
      const id = String(request.body?.id || '').trim().slice(0, 64)
      if (!id) return response.status(400).json({ error: 'Preset id is required' })
      if (!id.startsWith('custom-preset-')) return response.status(400).json({ error: 'Built-in presets cannot be deleted' })
      await sql`delete from public.scenario_presets where id = ${id}`
      return response.status(200).json({ deleted: id })
    }
    response.setHeader('Allow', 'GET, POST, DELETE')
    return response.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return response.status(503).json({ error: error instanceof Error ? error.message : 'Scenario preset service unavailable' })
  }
}
