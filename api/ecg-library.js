import { ensureDatabaseSchema, getNeonSql } from '../server/neonDb.js'

const allowedRhythms = new Set(['sinus', 'bradycardia', 'tachycardia', 'afib', 'svt', 'flutter', 'vtach', 'torsades', 'vfib', 'fine-vfib', 'asystole', 'junctional-escape', 'ventricular-escape', 'aivr', 'mobitz1', 'mobitz2', 'complete-block', 'sinus-pause'])

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
    suggestedRate: pattern.suggestedRate ?? null,
    territory: typeof pattern.territory === 'string' ? pattern.territory.slice(0, 50) : null,
    morphology: typeof pattern.morphology === 'string' ? pattern.morphology.slice(0, 64) : null,
    imageUrl: pattern.imageUrl || null,
    sortOrder: index,
  }
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  try {
    await ensureDatabaseSchema()
    const sql = getNeonSql()
    if (request.method === 'GET') {
      const rows = await sql`select * from public.ecg_patterns order by sort_order`
      return response.status(200).json(rows.map(fromRow))
    }
    if (request.method === 'POST') {
      const patterns = request.body?.patterns
      if (!Array.isArray(patterns) || patterns.length > 200) return response.status(400).json({ error: 'A pattern list is required' })
      const rows = patterns.map(toRow)
      if (rows.some((row) => row === null)) return response.status(400).json({ error: 'One or more ECG patterns are invalid' })
      for (const row of rows) {
        await sql`insert into public.ecg_patterns (id, title, category, rhythm, suggested_rate, description, territory, morphology, image_url, sort_order, updated_at)
          values (${row.id}, ${row.title}, ${row.category}, ${row.rhythm}, ${row.suggestedRate}, ${row.description}, ${row.territory}, ${row.morphology}, ${row.imageUrl}, ${row.sortOrder}, now())
          on conflict (id) do update set title = excluded.title, category = excluded.category, rhythm = excluded.rhythm, suggested_rate = excluded.suggested_rate, description = excluded.description, territory = excluded.territory, morphology = excluded.morphology, image_url = excluded.image_url, sort_order = excluded.sort_order, updated_at = now()`
      }
      return response.status(200).json({ saved: rows.length })
    }
    if (request.method === 'DELETE') {
      const id = String(request.body?.id || '').trim().slice(0, 64)
      if (!id) return response.status(400).json({ error: 'Pattern id is required' })
      await sql`delete from public.ecg_patterns where id = ${id}`
      return response.status(200).json({ deleted: id })
    }
    response.setHeader('Allow', 'GET, POST, DELETE')
    return response.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return response.status(503).json({ error: error instanceof Error ? error.message : 'ECG library unavailable' })
  }
}
