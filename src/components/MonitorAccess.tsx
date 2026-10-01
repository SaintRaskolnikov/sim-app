import { useState, type FormEvent } from 'react'
import { Activity, LogIn, UserRoundPlus } from 'lucide-react'
import { neonAuth } from '../lib/neonAuth'

export function MonitorAccess({ configured, loading, initialMode = 'sign-in', onAuthenticated }: { configured: boolean; loading: boolean; initialMode?: 'sign-in' | 'register'; onAuthenticated: () => Promise<void> }) {
  const [mode, setMode] = useState<'sign-in' | 'register'>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!neonAuth) return
    setSubmitting(true)
    setMessage('')
    setError('')
      try {
        const authClient = await neonAuth
        const result = mode === 'sign-in'
          ? await authClient.signIn.email({ email: email.trim(), password })
          : await authClient.signUp.email({ name: name.trim() || email.split('@')[0], email: email.trim(), password })
        setSubmitting(false)
        if (result.error) {
          setError(result.error.message ?? 'Account request failed.')
        } else {
          await onAuthenticated()
          if (mode === 'register') {
            setMessage('Account created. Check your email if verification is enabled.')
          }
        }
    } catch (submitError) {
      setSubmitting(false)
      setError(submitError instanceof Error ? submitError.message : 'Unable to process account request.')
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
              {mode === 'register' && <label>Your name<input type="text" autoComplete="name" maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} placeholder="Name shown to tutors" /></label>}
              {!configured && <p className="auth-setup-message">Neon Managed Auth is not configured for this deployment yet.</p>}
              <button className="auth-submit" type="submit" disabled={!configured || submitting}>{submitting ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}</button>
            </form>
          </>
        )}
        <p className="auth-training-note">Simulation and training use only. Not for clinical use.</p>
      </section>
    </main>
  )
}
