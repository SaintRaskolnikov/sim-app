import { useEffect, useState } from 'react'
import { clearMonitorAuthToken, neonAuth } from '../lib/neonAuth'

export function useMonitorAuth(enabled: boolean) {
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => enabled && Boolean(neonAuth))
  const client = neonAuth

  const refreshSession = async () => {
    if (!client) {
      setLoading(false)
      setEmail(null)
      return
    }
    try {
      const authClient = await client
      const { data, error } = await authClient.getSession()
      setEmail(error ? null : data?.user?.email ?? null)
    } catch {
      setEmail(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!enabled || !client) return
    let active = true
    const checkSession = async () => {
      try {
        const authClient = await client
        const { data, error } = await authClient.getSession()
        if (!active) return
        setEmail(error ? null : data?.user?.email ?? null)
        setLoading(false)
      } catch {
        if (active) setLoading(false)
      }
    }
    void checkSession()
    return () => {
      active = false
    }
  }, [client, enabled])

  const signOut = async () => {
    clearMonitorAuthToken()
    if (client) {
      const authClient = await client
      await authClient.signOut()
      setEmail(null)
    }
  }

  return { configured: Boolean(client), loading, email, authenticated: Boolean(email), refreshSession, signOut }
}
