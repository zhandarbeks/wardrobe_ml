import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [devLink, setDevLink] = useState('')

  const submit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/api/v1/auth/forgot-password', { email: email.trim() })
      setSent(true)
      if (data?.dev_reset_link) setDevLink(data.dev_reset_link)
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong, try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: 'var(--paper)' }}>
      <div style={{ width: '100%', maxWidth: 480, padding: 32, border: '2px solid var(--ink)', background: 'var(--paper)' }}>
        <div className="bru-serif" style={{ fontSize: 28, fontStyle: 'italic' }}>T*T</div>
        <div className="bru-mono" style={{ marginTop: 18 }}>FORGOT PASSWORD</div>
        <div className="bru-serif" style={{ fontSize: 48, lineHeight: 0.95, marginTop: 4 }}>Reset link.</div>

        {sent ? (
          <>
            <div className="bru-on-accent" style={{ marginTop: 18, padding: 14, background: 'var(--accent)', borderLeft: '4px solid var(--ink)' }}>
              <div className="bru-mono" style={{ fontSize: 10, color: '#0A0A0A' }}>CHECK YOUR INBOX</div>
              <div style={{ fontSize: 13, marginTop: 6, color: '#0A0A0A' }}>
                If an account with that e-mail exists, a reset link has been sent. It expires in 1 hour.
              </div>
            </div>
            {devLink && (
              <div style={{ marginTop: 14, padding: 10, border: '1.5px dashed var(--ink)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, wordBreak: 'break-all' }}>
                DEV LINK: <a href={devLink} style={{ color: 'var(--ink)' }}>{devLink}</a>
              </div>
            )}
          </>
        ) : (
          <>
            {error && (
              <div className="bru-on-accent" style={{ marginTop: 18, padding: 10, background: 'var(--accent)', borderLeft: '4px solid var(--ink)' }}>
                <div className="bru-mono" style={{ fontSize: 10 }}>⚠ {error}</div>
              </div>
            )}
            <form onSubmit={submit} style={{ marginTop: 22 }}>
              <div style={{ marginBottom: 18 }}>
                <label className="bru-label">E-mail</label>
                <input
                  className="bru-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </div>
              <button className="bru-btn bru-btn-accent" style={{ width: '100%' }} disabled={loading || !email.trim()}>
                {loading ? 'Sending…' : 'Send reset link ⟶'}
              </button>
            </form>
          </>
        )}

        <div style={{ marginTop: 18, borderTop: '1px solid var(--ink)', paddingTop: 14, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--mute)' }}>
          REMEMBERED?{' '}
          <Link to="/login" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>BACK TO SIGN IN →</Link>
        </div>
      </div>
    </div>
  )
}
