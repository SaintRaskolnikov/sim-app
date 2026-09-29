import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useMonitorAuth(enabled: boolean) {
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => enabled && Boolean(supabase))
  const client = supabase

  useEffect(() => {
    if (!enabled || !client) return
    let active = true
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setEmail(session?.user.email ?? null)
      setLoading(false)
    })
    void client.auth.getSession().then(({ data }) => {
      if (!active) return
      setEmail(data.session?.user.email ?? null)
      setLoading(false)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [client, enabled])

  const signOut = async () => {
    if (client) await client.auth.signOut()
  }

  return { configured: Boolean(client), loading, email, authenticated: Boolean(email), signOut }
}
