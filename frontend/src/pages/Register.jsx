import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [agreed, setAgreed] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async e => {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/api/v1/auth/register', form)
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      navigate('/onboarding')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: 'var(--paper)' }}>
      <div style={{ width: '100%', maxWidth: 480, padding: 32, border: '2px solid var(--ink)', background: 'var(--paper)' }}>
        <div className="bru-serif" style={{ fontSize: 28, fontStyle: 'italic' }}>T*T</div>
        <div className="bru-mono" style={{ marginTop: 18 }}>JOIN T*T</div>
        <div className="bru-serif" style={{ fontSize: 48, lineHeight: 0.95, marginTop: 4 }}>
          Create an <em style={{ color: 'var(--accent)' }}>account</em>.
        </div>

        {error && (
          <div className="bru-on-accent" style={{ marginTop: 18, padding: 10, background: 'var(--accent)', borderLeft: '4px solid var(--ink)' }}>
            <div className="bru-mono" style={{ fontSize: 10 }}>⚠ {error}</div>
          </div>
        )}

        <form onSubmit={submit} style={{ marginTop: 22 }}>
          <div style={{ marginBottom: 14 }}>
            <label className="bru-label">Name</label>
            <input
              className="bru-input"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Alex"
              required
              autoFocus
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="bru-label">E-mail</label>
            <input
              className="bru-input"
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              required
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="bru-label">Password</label>
            <input
              className="bru-input"
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="min 8 characters"
              required
            />
            <div className="bru-mono" style={{ fontSize: 9, marginTop: 4, color: 'var(--mute)', textTransform: 'none', letterSpacing: '0.04em' }}>
              Minimum 8 characters.
            </div>
          </div>
          <label style={{ marginBottom: 18, fontSize: 11, display: 'flex', gap: 6, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 2 }} />
            <span>I agree to the terms. A verification e-mail will be sent.</span>
          </label>
          <button className="bru-btn bru-btn-accent" style={{ width: '100%' }} disabled={loading || !agreed}>
            {loading ? 'Creating…' : 'Create account ⟶'}
          </button>
        </form>

        <div style={{ marginTop: 18, borderTop: '1px solid var(--ink)', paddingTop: 14, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--mute)' }}>
          HAVE AN ACCOUNT?{' '}
          <Link to="/login" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>SIGN IN →</Link>
        </div>
      </div>
    </div>
  )
}
