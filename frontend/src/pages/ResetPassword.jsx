import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()

  const [pwd, setPwd]       = useState('')
  const [confirm, setConf]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [done, setDone]     = useState(false)

  const submit = async e => {
    e.preventDefault()
    setError('')
    if (pwd.length < 6) { setError('Password must be at least 6 characters'); return }
    if (pwd !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      await api.post('/api/v1/auth/reset-password', { token, new_password: pwd })
      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err.response?.data?.detail || 'Reset failed — request a new link')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: 'var(--paper)' }}>
        <div style={{ width: '100%', maxWidth: 480, padding: 32, border: '2px solid var(--ink)', background: 'var(--paper)' }}>
          <div className="bru-serif" style={{ fontSize: 28, fontStyle: 'italic' }}>T*T</div>
          <div className="bru-mono" style={{ marginTop: 18 }}>RESET PASSWORD</div>
          <div className="bru-serif" style={{ fontSize: 36, lineHeight: 0.95, marginTop: 4 }}>Missing token.</div>
          <div style={{ marginTop: 14, fontSize: 13 }}>The link looks broken. Request a new reset email.</div>
          <Link to="/forgot-password" className="bru-btn bru-btn-accent" style={{ display: 'inline-block', marginTop: 18 }}>
            Request new link ⟶
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: 'var(--paper)' }}>
      <div style={{ width: '100%', maxWidth: 480, padding: 32, border: '2px solid var(--ink)', background: 'var(--paper)' }}>
        <div className="bru-serif" style={{ fontSize: 28, fontStyle: 'italic' }}>T*T</div>
        <div className="bru-mono" style={{ marginTop: 18 }}>RESET PASSWORD</div>
        <div className="bru-serif" style={{ fontSize: 48, lineHeight: 0.95, marginTop: 4 }}>New password.</div>

        {done ? (
          <div className="bru-on-accent" style={{ marginTop: 18, padding: 14, background: 'var(--accent)', borderLeft: '4px solid var(--ink)' }}>
            <div className="bru-mono" style={{ fontSize: 10, color: '#0A0A0A' }}>PASSWORD UPDATED</div>
            <div style={{ fontSize: 13, marginTop: 6, color: '#0A0A0A' }}>Redirecting to sign in…</div>
          </div>
        ) : (
          <>
            {error && (
              <div className="bru-on-accent" style={{ marginTop: 18, padding: 10, background: 'var(--accent)', borderLeft: '4px solid var(--ink)' }}>
                <div className="bru-mono" style={{ fontSize: 10 }}>⚠ {error}</div>
              </div>
            )}
            <form onSubmit={submit} style={{ marginTop: 22 }}>
              <div style={{ marginBottom: 14 }}>
                <label className="bru-label">New password</label>
                <input
                  className="bru-input"
                  type="password"
                  value={pwd}
                  onChange={e => setPwd(e.target.value)}
                  placeholder="at least 6 characters"
                  required
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label className="bru-label">Confirm password</label>
                <input
                  className="bru-input"
                  type="password"
                  value={confirm}
                  onChange={e => setConf(e.target.value)}
                  required
                />
              </div>
              <button className="bru-btn bru-btn-accent" style={{ width: '100%' }} disabled={loading || !pwd || !confirm}>
                {loading ? 'Updating…' : 'Update password ⟶'}
              </button>
            </form>
          </>
        )}

        <div style={{ marginTop: 18, borderTop: '1px solid var(--ink)', paddingTop: 14, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--mute)' }}>
          <Link to="/login" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>BACK TO SIGN IN →</Link>
        </div>
      </div>
    </div>
  )
}
