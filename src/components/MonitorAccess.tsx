import { useState, type FormEvent } from 'react'
import { Activity, LogIn, UserRoundPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function MonitorAccess({ configured, loading, initialMode = 'sign-in' }: { configured: boolean; loading: boolean; initialMode?: 'sign-in' | 'register' }) {
  const [mode, setMode] = useState<'sign-in' | 'register'>(initialMode)
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
      : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/login` } })
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
        <div className="auth-title"><span className="eyebrow">MONITOR ACCESS <span className="heading-rule" /></span><h1>{mode === 'register' ? 'Create an account' : 'Sign in to monitor'}</h1>
          <p>{mode === 'register' ? 'Register an account to open a simulation monitor.' : 'Use your account to open a simulation monitor.'}</p>
        </div>
        {loading ? (
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
              {!configured && <p className="auth-setup-message">Account access is not configured yet. Connect Supabase to enable sign-in and registration.</p>}
              <button className="auth-submit" type="submit" disabled={!configured || submitting}>{submitting ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}</button>
            </form>
          </>
        )}
        <p className="auth-training-note">Simulation and training use only. Not for clinical use.</p>
      </section>
    </main>
  )
}
