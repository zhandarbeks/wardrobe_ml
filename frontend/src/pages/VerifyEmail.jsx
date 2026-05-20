import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState('pending')   // pending | success | expired
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setStatus('expired')
      setMessage('Missing token in URL.')
      return
    }
    let cancelled = false
    api.post('/api/v1/auth/verify-email', { token })
      .then(() => { if (!cancelled) setStatus('success') })
      .catch(err => {
        if (cancelled) return
        const detail = err?.response?.data?.detail || 'Verification failed.'
        setStatus('expired')
        setMessage(detail)
      })
    return () => { cancelled = true }
  }, [params])

  const title = status === 'success' ? 'Verified.'
              : status === 'expired' ? 'Link expired.'
              :                        'Verifying…'

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: 'var(--paper)' }}>
      <div style={{ width: '100%', maxWidth: 480, padding: 32, border: '2px solid var(--ink)', background: 'var(--paper)' }}>
        <div className="bru-serif" style={{ fontSize: 28, fontStyle: 'italic' }}>T*T</div>
        <div className="bru-mono" style={{ marginTop: 18 }}>EMAIL VERIFICATION</div>
        <div className="bru-serif" style={{ fontSize: 48, lineHeight: 0.95, marginTop: 4 }}>{title}</div>

        <div style={{ marginTop: 22 }}>
          {status === 'pending' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="var(--line-soft)" strokeWidth="3"/>
                <circle cx="24" cy="24" r="20" fill="none" stroke="var(--accent)" strokeWidth="3"
                  strokeDasharray="40 125" strokeLinecap="round" transform="rotate(-90 24 24)"/>
              </svg>
              <div className="bru-mono" style={{ marginTop: 14, color: 'var(--mute)' }}>CHECKING YOUR TOKEN…</div>
            </div>
          )}

          {status === 'success' && (
            <>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: 14, border: '1.5px solid var(--ink)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <path d="M5 13l4 4L19 7"/>
                </svg>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Your e-mail is verified.</div>
                  <div className="bru-mono" style={{ fontSize: 10, color: 'var(--mute)', marginTop: 6, textTransform: 'none', letterSpacing: '0.04em', lineHeight: 1.5 }}>
                    You can now use the full app and receive recommendation e-mails.
                  </div>
                </div>
              </div>
              <Link to="/" style={{ display: 'block', marginTop: 18, textDecoration: 'none' }}>
                <button className="bru-btn bru-btn-accent" style={{ width: '100%' }}>Continue to T*T ⟶</button>
              </Link>
            </>
          )}

          {status === 'expired' && (
            <>
              <div className="bru-on-accent" style={{ padding: 14, border: '1.5px solid var(--ink)', background: 'var(--accent)' }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>⚠ {message || 'This link has expired'}</div>
                <div className="bru-mono" style={{ fontSize: 10, marginTop: 6, textTransform: 'none', letterSpacing: '0.04em', lineHeight: 1.5 }}>
                  Verification links are valid for 24 hours. Request a new one from your profile.
                </div>
              </div>
              <Link to="/" style={{ display: 'block', marginTop: 18, textDecoration: 'none' }}>
                <button className="bru-btn" style={{ width: '100%' }}>Back to dashboard</button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
