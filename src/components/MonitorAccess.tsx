import { useState, type FormEvent } from 'react'
import { Activity, LogIn, UserRoundPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function MonitorAccess({ configured, loading }: { configured: boolean; loading: boolean }) {
  const [mode, setMode] = useState<'sign-in' | 'register'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    setSubmitting(true)
    setMessage('')
    setError('')
    const result = mode === 'sign-in'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password })
    setSubmitting(false)
    if (result.error) {
      setError(result.error.message)
    } else if (mode === 'register' && !result.data.session) {
      setMessage('Check your email to confirm your account, then sign in.')
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <a className="brand auth-brand" href="/control">
          <span className="brand-mark"><Activity size={19} /></span>
          <span><strong>pulse<span>/</span>sim</strong><small>SIMULATION SUITE</small></span>
        </a>
        <div className="auth-title"><span className="eyebrow">MONITOR ACCESS <span className="heading-rule" /></span><h1>{configured ? 'Sign in to monitor' : 'Monitor setup required'}</h1>
          <p>{configured ? 'Use your registered account to open this simulation display.' : 'Connect a Supabase project to enable monitor accounts.'}</p>
        </div>
        {!configured ? (
          <div className="auth-setup-message">Supabase sign-in is not configured for this deployment. The tutor QR route remains available without an account.</div>
        ) : loading ? (
          <div className="auth-loading"><span className="auth-spinner" />Checking account…</div>
        ) : (
          <>
            <div className="auth-tabs" role="tablist" aria-label="Monitor account">
              <button type="button" role="tab" aria-selected={mode === 'sign-in'} className={mode === 'sign-in' ? 'selected' : ''} onClick={() => { setMode('sign-in'); setError(''); setMessage('') }}><LogIn size={15} />Sign in</button>
              <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'selected' : ''} onClick={() => { setMode('register'); setError(''); setMessage('') }}><UserRoundPlus size={15} />Register</button>
            </div>
            <form className="auth-form" onSubmit={submit}>
              <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>
              <label>Password<input type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
              {error && <p className="auth-error" role="alert">{error}</p>}
              {message && <p className="auth-message" role="status">{message}</p>}
              <button className="auth-submit" type="submit" disabled={submitting}>{submitting ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create monitor account'}</button>
            </form>
          </>
        )}
        <p className="auth-training-note">Simulation and training use only. Not for clinical use.</p>
      </section>
    </main>
  )
}
