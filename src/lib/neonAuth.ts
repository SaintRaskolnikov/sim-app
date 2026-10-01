import { createAuthClient } from '@neondatabase/neon-js/auth'
import { BetterAuthVanillaAdapter } from '@neondatabase/neon-js/auth/vanilla/adapters'

const authUrl = import.meta.env.VITE_NEON_AUTH_URL

export const neonAuth = authUrl
	? createAuthClient(authUrl, { adapter: BetterAuthVanillaAdapter({ fetchOptions: { credentials: 'include' } }) })
	: null

export async function getMonitorAuthHeaders() {
	if (!neonAuth) throw new Error('Neon Managed Auth is not configured')
	const { data, error } = await neonAuth.token()
	if (error || !data?.token) throw new Error('Please sign in to access the monitor')
	return { Authorization: `Bearer ${data.token}` }
}
