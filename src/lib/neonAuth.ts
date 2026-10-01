import { createAuthClient } from '@neondatabase/neon-js/auth'
import { BetterAuthVanillaAdapter } from '@neondatabase/neon-js/auth/vanilla/adapters'

const authUrl = import.meta.env.VITE_NEON_AUTH_URL

export const neonAuth = authUrl
	? createAuthClient(authUrl, { adapter: BetterAuthVanillaAdapter({ fetchOptions: { credentials: 'include' } }) })
	: null

let cachedMonitorToken: string | null = null
let monitorTokenExpiresAt = 0
let pendingMonitorToken: Promise<string> | null = null
let tokenCacheGeneration = 0

export function clearMonitorAuthToken() {
	tokenCacheGeneration += 1
	cachedMonitorToken = null
	monitorTokenExpiresAt = 0
	pendingMonitorToken = null
}

export async function getMonitorAuthHeaders() {
	if (!neonAuth) throw new Error('Neon Managed Auth is not configured')
	if (cachedMonitorToken && Date.now() < monitorTokenExpiresAt) {
		return { Authorization: `Bearer ${cachedMonitorToken}` }
	}
	if (!pendingMonitorToken) {
		const generation = tokenCacheGeneration
		pendingMonitorToken = (async () => {
			const { data, error } = await neonAuth.token()
			if (error || !data?.token) throw new Error('Please sign in to access the monitor')
			if (generation === tokenCacheGeneration) {
				cachedMonitorToken = data.token
				monitorTokenExpiresAt = Date.now() + 10 * 60 * 1000
			}
			return data.token
		})()
	}
	try {
		return { Authorization: `Bearer ${await pendingMonitorToken}` }
	} finally {
		pendingMonitorToken = null
	}
}
