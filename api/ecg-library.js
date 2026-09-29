import { adminClient } from '../server/supabaseAdmin.js'

const allowedRhythms = new Set(['sinus', 'bradycardia', 'tachycardia', 'afib', 'vtach', 'vfib', 'asystole'])

function fromRow(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    rhythm: row.rhythm,
    description: row.description,
    ...(row.suggested_rate !== null ? { suggestedRate: row.suggested_rate } : {}),
    ...(row.territory ? { territory: row.territory } : {}),
    ...(row.morphology ? { morphology: row.morphology } : {}),
    ...(row.image_url ? { imageUrl: row.image_url } : {}),
  }
}

function toRow(pattern, index) {
  if (!pattern || typeof pattern.id !== 'string' || pattern.id.length > 64 ||
    typeof pattern.title !== 'string' || !pattern.title.trim() || pattern.title.length > 100 ||
    !['Rhythm', '12-lead'].includes(pattern.category) || !allowedRhythms.has(pattern.rhythm) ||
    typeof pattern.description !== 'string' || pattern.description.length > 300 ||
    (pattern.suggestedRate !== undefined && (!Number.isFinite(pattern.suggestedRate) || pattern.suggestedRate < 0 || pattern.suggestedRate > 300)) ||
    (pattern.imageUrl !== undefined && (typeof pattern.imageUrl !== 'string' || pattern.imageUrl.length > 2000))) return null

  return {
    id: pattern.id,
    title: pattern.title.trim(),
    category: pattern.category,
    rhythm: pattern.rhythm,
    description: pattern.description,
    suggested_rate: pattern.suggestedRate ?? null,
    territory: typeof pattern.territory === 'string' ? pattern.territory.slice(0, 50) : null,
    morphology: typeof pattern.morphology === 'string' ? pattern.morphology.slice(0, 64) : null,
    image_url: pattern.imageUrl || null,
    sort_order: index,
    updated_at: new Date().toISOString(),
  }
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  try {
    const client = adminClient()
    if (request.method === 'GET') {
      const { data, error } = await client.from('ecg_patterns').select('*').order('sort_order')
      if (error) return response.status(500).json({ error: error.message })
      return response.status(200).json((data ?? []).map(fromRow))
    }

    if (request.method === 'POST') {
      const patterns = request.body?.patterns
      if (!Array.isArray(patterns) || patterns.length > 200) return response.status(400).json({ error: 'A pattern list is required' })
      const rows = patterns.map(toRow)
      if (rows.some((row) => row === null)) return response.status(400).json({ error: 'One or more ECG patterns are invalid' })
      const { error } = await client.from('ecg_patterns').upsert(rows, { onConflict: 'id' })
      if (error) return response.status(500).json({ error: error.message })
      return response.status(200).json({ saved: rows.length })
    }

    if (request.method === 'DELETE') {
      const id = String(request.body?.id || '').trim().slice(0, 64)
      if (!id) return response.status(400).json({ error: 'Pattern id is required' })
      const { error } = await client.from('ecg_patterns').delete().eq('id', id)
      if (error) return response.status(500).json({ error: error.message })
      return response.status(200).json({ deleted: id })
    }

    response.setHeader('Allow', 'GET, POST, DELETE')
    return response.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return response.status(503).json({ error: error instanceof Error ? error.message : 'ECG library unavailable' })
  }
}
