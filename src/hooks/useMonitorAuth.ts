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
    const { data, error } = await client.getSession()
    setEmail(error ? null : data?.user?.email ?? null)
    setLoading(false)
  }

  useEffect(() => {
    if (!enabled || !client) return
    let active = true
    const checkSession = async () => {
      try {
        const { data, error } = await client.getSession()
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
      await client.signOut()
      setEmail(null)
    }
  }

  return { configured: Boolean(client), loading, email, authenticated: Boolean(email), refreshSession, signOut }
}
