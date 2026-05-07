import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState('verifying')   // verifying | success | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setStatus('error')
      setMessage('Missing token in URL.')
      return
    }
    let cancelled = false
    api.post('/api/v1/auth/verify-email', { token })
      .then(() => { if (!cancelled) setStatus('success') })
      .catch(err => {
        if (cancelled) return
        const detail = err?.response?.data?.detail || 'Verification failed.'
        setStatus('error')
        setMessage(detail)
      })
    return () => { cancelled = true }
  }, [params])

  return (
    <div style={wrap}>
      <div style={card}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Email verification</h1>
        {status === 'verifying' && (
          <p style={{ color: '#6b7280' }}>Verifying your token…</p>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: 36 }}>✅</div>
            <p style={{ color: '#16a34a', fontWeight: 600, margin: '6px 0' }}>
              Email verified successfully.
            </p>
            <p style={{ color: '#6b7280', fontSize: 14 }}>
              You can close this tab or return to the dashboard.
            </p>
            <Link to="/" style={btn}>Go to dashboard</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 36 }}>⚠</div>
            <p style={{ color: '#b91c1c', fontWeight: 600, margin: '6px 0' }}>
              Could not verify
            </p>
            <p style={{ color: '#6b7280', fontSize: 14 }}>{message}</p>
            <Link to="/" style={btn}>Back to dashboard</Link>
          </>
        )}
      </div>
    </div>
  )
}

const wrap = {
  minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20,
}
const card = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
  padding: 32, maxWidth: 420, width: '100%', textAlign: 'center',
  boxShadow: '0 6px 16px rgba(0,0,0,.06)',
}
const btn = {
  display: 'inline-block', marginTop: 14, padding: '8px 18px',
  background: '#2563eb', color: '#fff', borderRadius: 6,
  textDecoration: 'none', fontWeight: 600, fontSize: 14,
}
