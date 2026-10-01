import { createRemoteJWKSet, jwtVerify } from 'jose'

let remoteJwks

function getRemoteJwks() {
  if (remoteJwks) return remoteJwks
  const baseUrl = process.env.NEON_AUTH_BASE_URL
  if (!baseUrl) return null
  const url = process.env.NEON_AUTH_JWKS_URL || `${baseUrl.replace(/\/$/, '')}/.well-known/jwks.json`
  remoteJwks = createRemoteJWKSet(new URL(url))
  return remoteJwks
}

export async function verifyMonitorRequest(request) {
  const authorization = request.headers?.authorization
  const baseUrl = process.env.NEON_AUTH_BASE_URL
  if (!authorization?.toLowerCase().startsWith('bearer ') || !baseUrl) return null
  try {
    const jwks = getRemoteJwks()
    if (!jwks) return null
    const { payload } = await jwtVerify(authorization.slice(7), jwks, { issuer: new URL(baseUrl).origin })
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}
