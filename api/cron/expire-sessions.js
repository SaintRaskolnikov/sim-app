import { purgeExpiredSimulationSessions } from '../../server/neonDb.js'

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  const userAgent = request.headers['user-agent'] || ''
  const schedule = request.headers['x-vercel-cron-schedule']
  const secret = process.env.CRON_SECRET
  const authorized = secret
    ? request.headers.authorization === `Bearer ${secret}`
    : userAgent.startsWith('vercel-cron/1.0') && typeof schedule === 'string'

  if (!authorized) return response.status(401).json({ error: 'Unauthorized' })
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const deleted = await purgeExpiredSimulationSessions()
    return response.status(200).json({ deleted })
  } catch (error) {
    return response.status(503).json({ error: error instanceof Error ? error.message : 'Session cleanup unavailable' })
  }
}