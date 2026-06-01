import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/api/v1/auth/login', form)
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      window.location.href = '/'
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: 'var(--paper)' }}>
      <div style={{ width: '100%', maxWidth: 480, padding: 32, border: '2px solid var(--ink)', background: 'var(--paper)' }}>
        <div className="bru-serif" style={{ fontSize: 28, fontStyle: 'italic' }}>T*T</div>
        <div className="bru-mono" style={{ marginTop: 18 }}>WELCOME BACK</div>
        <div className="bru-serif" style={{ fontSize: 56, lineHeight: 0.95, marginTop: 4 }}>Sign in.</div>

        {error && (
          <div className="bru-on-accent" style={{ marginTop: 18, padding: 10, background: 'var(--accent)', borderLeft: '4px solid var(--ink)' }}>
            <div className="bru-mono" style={{ fontSize: 10 }}>⚠ {error}</div>
          </div>
        )}

        <form onSubmit={submit} style={{ marginTop: 22 }}>
          <div style={{ marginBottom: 14 }}>
            <label className="bru-label">E-mail</label>
            <input
              className="bru-input"
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label className="bru-label">Password</label>
            <input
              className="bru-input"
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>
          <div style={{ textAlign: 'right', marginBottom: 18 }}>
            <Link
              to="/forgot-password"
              style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', color: 'var(--mute)', textDecoration: 'underline' }}>
              FORGOT PASSWORD?
            </Link>
          </div>
          <button className="bru-btn bru-btn-accent" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in ⟶'}
          </button>
        </form>

        <div style={{ marginTop: 18, borderTop: '1px solid var(--ink)', paddingTop: 14, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--mute)' }}>
          NEW HERE?{' '}
          <Link to="/register" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>CREATE ACCOUNT →</Link>
        </div>
      </div>
    </div>
  )
}
