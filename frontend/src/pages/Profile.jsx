import { useEffect, useRef, useState } from 'react'
import api from '../api'

const STYLES_LIST = ['casual', 'smart casual', 'business', 'sport', 'streetwear', 'formal']
const COLORS = [
  ['black', '#1a1a1a'], ['white', '#f0f0f0'], ['gray', '#888'],
  ['navy', '#0a1e50'], ['royal blue', '#4169e1'], ['sky blue', '#87ceeb'],
  ['teal', '#008080'], ['green', '#228b22'], ['olive', '#6b8e23'],
  ['yellow', '#ffd700'], ['orange', '#ff8c00'], ['red', '#c81e1e'],
  ['burgundy', '#800020'], ['pink', '#ff69b3'], ['purple', '#800080'],
  ['beige', '#e8dcc8'], ['brown', '#8b4513'], ['camel', '#c19a6b'],
]
const LIGHT_COLORS = ['white', 'beige', 'yellow', 'sky blue']

function Msg({ msg }) {
  if (!msg) return null
  return (
    <div className={msg.type === 'success' ? '' : 'bru-on-accent'} style={{
      marginTop: 10, padding: 8,
      background: msg.type === 'success' ? 'var(--line-soft)' : 'var(--accent)',
      borderLeft: '4px solid var(--ink)',
    }}>
      <div className="bru-mono" style={{ fontSize: 10 }}>
        {msg.type === 'success' ? '✓ ' : '⚠ '}{msg.text}
      </div>
    </div>
  )
}

export default function Profile() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'))
  const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const [account, setAccount] = useState({ name: user.name || '', email: user.email || '' })
  const [accountSaving, setAccountSaving] = useState(false)
  const [accountMsg,    setAccountMsg]    = useState(null)

  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg,    setPwdMsg]    = useState(null)

  const [location, setLocation] = useState({ city: '', latitude: '', longitude: '' })
  const [locSaving, setLocSaving] = useState(false)
  const [locMsg,    setLocMsg]    = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [citySuggestions, setCitySuggestions] = useState([])
  const searchTimer = useRef(null)

  const [prefs, setPrefs] = useState({
    styles: '', favorite_colors: '', disliked_colors: '',
    heat_sensitivity: 'normal', allow_layering: true,
  })
  const [savedPrefs, setSavedPrefs] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePwd,  setDeletePwd]  = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteMsg,  setDeleteMsg]  = useState(null)

  const fileInputRef = useRef(null)
  const [avatarBusy, setAvatarBusy] = useState(false)

  useEffect(() => {
    api.get('/api/v1/profile/preferences').then(r => { setPrefs(r.data); setSavedPrefs(r.data) }).catch(() => {})
    api.get('/api/v1/auth/me').then(r => {
      const u = r.data
      setLocation({ city: u.city ?? '', latitude: u.latitude != null ? String(u.latitude) : '', longitude: u.longitude != null ? String(u.longitude) : '' })
      const cached = JSON.parse(localStorage.getItem('user') || '{}')
      const merged = { ...cached, name: u.name, email: u.email, role: u.role, city: u.city, avatar_url: u.avatar_url, created_at: u.created_at }
      localStorage.setItem('user', JSON.stringify(merged))
      setUser(merged)
      setAccount({ name: u.name || '', email: u.email || '' })
    }).catch(() => {})
  }, [])

  const saveAccount = async () => {
    setAccountSaving(true); setAccountMsg(null)
    try {
      const res = await api.patch('/api/v1/auth/me', { name: account.name.trim(), email: account.email.trim() })
      const updated = { ...user, name: res.data.name, email: res.data.email }
      localStorage.setItem('user', JSON.stringify(updated))
      setUser(updated)
      setAccountMsg({ type: 'success', text: 'Account updated' })
      setTimeout(() => setAccountMsg(null), 2500)
    } catch (e) {
      setAccountMsg({ type: 'error', text: e.response?.data?.detail || 'Failed to update' })
    } finally { setAccountSaving(false) }
  }

  const handleCityInput = val => {
    setLocation(l => ({ ...l, city: val, latitude: '', longitude: '' }))
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!val.trim() || val.length < 2) { setCitySuggestions([]); return }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/api/v1/weather/search?q=${encodeURIComponent(val)}`)
        setCitySuggestions(res.data || [])
      } catch { setCitySuggestions([]) }
    }, 400)
  }
  const pickSuggestion = s => {
    setLocation({
      city: s.state ? `${s.name}, ${s.state}, ${s.country}` : `${s.name}, ${s.country}`,
      latitude: String(s.lat), longitude: String(s.lon),
    })
    setCitySuggestions([])
  }
  const useMyLocation = () => {
    if (!('geolocation' in navigator)) { setLocMsg({ type: 'error', text: 'Geolocation not supported' }); return }
    setGeoLoading(true); setLocMsg(null)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude
        let cityName = ''
        try {
          const res = await api.get(`/api/v1/weather/reverse?lat=${lat}&lon=${lon}`)
          if (res.data) cityName = res.data.state ? `${res.data.name}, ${res.data.state}, ${res.data.country}` : `${res.data.name}, ${res.data.country}`
        } catch {}
        setLocation(l => ({ city: cityName || l.city, latitude: lat.toFixed(5), longitude: lon.toFixed(5) }))
        setCitySuggestions([])
        setGeoLoading(false)
      },
      err => { setLocMsg({ type: 'error', text: err.message }); setGeoLoading(false) },
      { timeout: 10000 },
    )
  }
  const saveLocation = async () => {
    setLocSaving(true); setLocMsg(null)
    const payload = { city: location.city.trim() }
    if (location.latitude !== '') payload.latitude = parseFloat(location.latitude)
    if (location.longitude !== '') payload.longitude = parseFloat(location.longitude)
    try {
      const res = await api.patch('/api/v1/auth/me', payload)
      const updated = { ...user, city: res.data.city }
      localStorage.setItem('user', JSON.stringify(updated))
      setUser(updated)
      setLocMsg({ type: 'success', text: 'Location updated' })
      setTimeout(() => setLocMsg(null), 2500)
    } catch (e) {
      setLocMsg({ type: 'error', text: e.response?.data?.detail || 'Failed to update' })
    } finally { setLocSaving(false) }
  }

  const uploadAvatar = async e => {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('File too large (max 5MB)'); return }
    setAvatarBusy(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await api.post('/api/v1/auth/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const updated = { ...user, avatar_url: res.data.avatar_url }
      localStorage.setItem('user', JSON.stringify(updated))
      setUser(updated)
    } catch (err) { alert(err.response?.data?.detail || 'Upload failed') }
    finally { setAvatarBusy(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }
  const removeAvatar = async () => {
    if (!confirm('Remove your profile photo?')) return
    setAvatarBusy(true)
    try {
      await api.delete('/api/v1/auth/avatar')
      const updated = { ...user, avatar_url: null }
      localStorage.setItem('user', JSON.stringify(updated))
      setUser(updated)
    } finally { setAvatarBusy(false) }
  }

  const changePassword = async () => {
    setPwdSaving(true); setPwdMsg(null)
    try {
      await api.patch('/api/v1/auth/password', pwd)
      setPwd({ current_password: '', new_password: '', confirm_password: '' })
      setPwdMsg({ type: 'success', text: 'Password changed' })
      setTimeout(() => setPwdMsg(null), 2500)
    } catch (e) {
      setPwdMsg({ type: 'error', text: e.response?.data?.detail || 'Failed to change' })
    } finally { setPwdSaving(false) }
  }

  const deleteAccount = async () => {
    if (!deletePwd) { setDeleteMsg({ type: 'error', text: 'Password required' }); return }
    if (!confirm('Permanently delete your account and ALL data? Cannot be undone.')) return
    setDeleteBusy(true); setDeleteMsg(null)
    try {
      await api.delete('/api/v1/auth/me', { data: { password: deletePwd } })
      localStorage.removeItem('token'); localStorage.removeItem('user')
      window.location.href = '/login'
    } catch (e) {
      setDeleteMsg({ type: 'error', text: e.response?.data?.detail || 'Failed to delete' })
      setDeleteBusy(false)
    }
  }

  const toggle = (field, val) => {
    const arr = (prefs[field] || '').split(',').filter(Boolean)
    const next = arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
    setPrefs(p => ({ ...p, [field]: next.join(',') }))
  }
  const has = (field, val) => (prefs[field] || '').split(',').includes(val)
  const savePrefs = async () => {
    setSaving(true)
    try {
      await api.put('/api/v1/profile/preferences', prefs)
      setSavedPrefs(prefs); setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally { setSaving(false) }
  }
  const emailVerified = user.email_verified_at != null

  return (
    <div className="bru-page">
      <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 14 }}>
        <div className="bru-mono">PROFILE</div>
        <div className="bru-serif" style={{ fontSize: 64, lineHeight: 0.95 }}>The <em style={{ color: 'var(--accent)' }}>subject</em>.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18, marginTop: 18 }}>
        {/* LEFT — identity */}
        <div className="bru-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 20 }}>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} style={{ display: 'none' }} />
          <div onClick={() => !avatarBusy && fileInputRef.current?.click()}
            style={{ width: 120, height: 120, background: 'var(--ink)', color: 'var(--accent)', display: 'grid', placeItems: 'center', fontFamily: 'Instrument Serif, serif', fontSize: 50, fontStyle: 'italic', cursor: 'pointer', position: 'relative', overflow: 'hidden', border: '1.5px solid var(--ink)' }}>
            {user.avatar_url
              ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--accent)', color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace', fontSize: 8, letterSpacing: '0.15em', padding: '3px 0' }}>
              {avatarBusy ? 'WORKING…' : user.avatar_url ? 'REPLACE' : '+ UPLOAD'}
            </div>
          </div>
          {user.avatar_url && (
            <button className="bru-btn" style={{ marginTop: 8, height: 24, fontSize: 9, padding: '0 10px' }} onClick={removeAvatar}>Remove avatar</button>
          )}
          <div className="bru-serif" style={{ fontSize: 24, marginTop: 14 }}>{user.name || 'Anonymous'}</div>
          <div className="bru-mono" style={{ fontSize: 10, color: 'var(--mute)', marginTop: 4 }}>{user.email}</div>

          {/* Email verification */}
          <div style={{ width: '100%', marginTop: 16 }}>
            {emailVerified ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 10px', border: '1.5px solid var(--ink)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
                <span className="bru-mono" style={{ fontSize: 9 }}>E-MAIL VERIFIED</span>
              </div>
            ) : (
              <div className="bru-on-accent" style={{ padding: 10, background: 'var(--accent)', borderLeft: '4px solid var(--ink)' }}>
                <div className="bru-mono" style={{ fontSize: 10 }}>⚠ E-MAIL NOT VERIFIED</div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — sections stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Account */}
          <div className="bru-card">
            <div className="bru-mono">ACCOUNT</div>
            <div className="bru-serif" style={{ fontSize: 22, marginTop: 4 }}>Your details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              <div>
                <label className="bru-label">Name</label>
                <input className="bru-input" value={account.name} onChange={e => setAccount({ ...account, name: e.target.value })} />
              </div>
              <div>
                <label className="bru-label">E-mail</label>
                <input className="bru-input" value={account.email} onChange={e => setAccount({ ...account, email: e.target.value })} />
              </div>
            </div>
            <button className="bru-btn bru-btn-accent" style={{ marginTop: 12 }} onClick={saveAccount} disabled={accountSaving}>
              {accountSaving ? 'Saving…' : 'Save account'}
            </button>
            <Msg msg={accountMsg} />
          </div>

          {/* Location */}
          <div className="bru-card">
            <div className="bru-mono">CITY</div>
            <div className="bru-serif" style={{ fontSize: 22, marginTop: 4 }}>Where you wear it</div>
            <div style={{ position: 'relative', marginTop: 12 }}>
              <input className="bru-input" placeholder="Type a city…" value={location.city}
                onChange={e => handleCityInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && citySuggestions[0]) pickSuggestion(citySuggestions[0]) }} />
              {citySuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--paper)', border: '1.5px solid var(--ink)', borderTop: 'none', maxHeight: 200, overflow: 'auto', zIndex: 10 }}>
                  {citySuggestions.map((s, i) => (
                    <div key={i} onClick={() => pickSuggestion(s)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--line-soft)', fontSize: 13 }}>
                      <strong>{s.name}</strong>
                      {s.state && <span style={{ color: 'var(--mute)' }}> · {s.state}</span>}
                      <span style={{ color: 'var(--mute)' }}> · {s.country}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bru-mono" style={{ fontSize: 9, marginTop: 6, color: 'var(--mute)', textTransform: 'none', letterSpacing: '0.04em' }}>
              Weather is fetched from OpenWeather based on this city. Press Enter to pick the first suggestion.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="bru-btn" onClick={useMyLocation} disabled={geoLoading}>
                {geoLoading ? '…' : '📍 Detect'}
              </button>
              <button className="bru-btn bru-btn-accent" onClick={saveLocation} disabled={locSaving}>
                {locSaving ? 'Saving…' : 'Save city'}
              </button>
            </div>
            <Msg msg={locMsg} />
          </div>

          {/* Style preferences */}
          <div className="bru-card">
            <div className="bru-mono">STYLE PROFILE</div>
            <div className="bru-serif" style={{ fontSize: 22, marginTop: 4 }}>How you like to dress</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {STYLES_LIST.map(s => (
                <span key={s} onClick={() => toggle('styles', s)} className={'bru-tag' + (has('styles', s) ? ' on' : '')} style={{ cursor: 'pointer' }}>{s}</span>
              ))}
            </div>
          </div>

          {/* Favourite colours */}
          <div className="bru-card">
            <div className="bru-mono">FAVOURITE COLOURS</div>
            <div className="bru-mono" style={{ fontSize: 9, marginTop: 4, color: 'var(--mute)', textTransform: 'none', letterSpacing: '0.04em' }}>
              Outfits with these colours get a bonus.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 6, marginTop: 12 }}>
              {COLORS.map(([name, hex]) => {
                const on = has('favorite_colors', name)
                return (
                  <div key={name} onClick={() => toggle('favorite_colors', name)} title={name}
                    style={{ aspectRatio: '1', background: hex, cursor: 'pointer', border: '1.5px solid var(--ink)',
                      boxShadow: on ? 'inset 0 0 0 3px var(--accent)' : 'none',
                      display: 'grid', placeItems: 'center', color: LIGHT_COLORS.includes(name) ? '#000' : '#fff',
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700 }}>
                    {on ? '✓' : ''}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Disliked colours */}
          <div className="bru-card">
            <div className="bru-mono">DISLIKED COLOURS</div>
            <div className="bru-mono" style={{ fontSize: 9, marginTop: 4, color: 'var(--mute)', textTransform: 'none', letterSpacing: '0.04em' }}>
              Outfits with these colours rank lower.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 6, marginTop: 12 }}>
              {COLORS.map(([name, hex]) => {
                const on = has('disliked_colors', name)
                return (
                  <div key={name} onClick={() => toggle('disliked_colors', name)} title={name}
                    style={{ aspectRatio: '1', background: hex, cursor: 'pointer', border: '1.5px solid var(--ink)',
                      opacity: on ? 1 : 0.35,
                      boxShadow: on ? 'inset 0 0 0 3px var(--ink)' : 'none',
                      display: 'grid', placeItems: 'center', color: LIGHT_COLORS.includes(name) ? '#000' : '#fff',
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700 }}>
                    {on ? '✕' : ''}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recommendation tuning */}
          <div className="bru-card">
            <div className="bru-mono">RECOMMENDATION TUNING</div>
            <div className="bru-serif" style={{ fontSize: 22, marginTop: 4 }}>How outfits get picked</div>

            <div style={{ marginTop: 12 }}>
              <div className="bru-mono" style={{ fontSize: 9, marginBottom: 6 }}>THERMAL SENSITIVITY</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border: '1.5px solid var(--ink)' }}>
                {[
                  { v: 'cold',   l: 'Cold-blooded',  d: 'Dress one notch warmer' },
                  { v: 'normal', l: 'Average',       d: 'Use raw temperature' },
                  { v: 'hot',    l: 'Heat-tolerant', d: 'Dress one notch cooler' },
                ].map((opt, i) => (
                  <button key={opt.v} onClick={() => setPrefs(p => ({ ...p, heat_sensitivity: opt.v }))}
                    className={prefs.heat_sensitivity === opt.v ? 'bru-on-accent' : ''}
                    style={{ padding: '10px 6px', cursor: 'pointer', border: 'none',
                      borderLeft: i > 0 ? '1.5px solid var(--ink)' : 'none',
                      background: prefs.heat_sensitivity === opt.v ? 'var(--accent)' : 'transparent',
                      color: 'var(--ink)', fontFamily: 'inherit', textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{opt.l}</div>
                    <div className="bru-mono" style={{ fontSize: 8, marginTop: 2, color: prefs.heat_sensitivity === opt.v ? 'var(--ink)' : 'var(--mute)', textTransform: 'none', letterSpacing: '0.04em' }}>{opt.d}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1.5px solid var(--ink)', padding: 12, marginTop: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Allow layering</div>
                <div className="bru-mono" style={{ fontSize: 9, marginTop: 2, color: 'var(--mute)' }}>ADD MID-LAYER &lt;18°C · OUTER &lt;10°C</div>
              </div>
              <button onClick={() => setPrefs(p => ({ ...p, allow_layering: !p.allow_layering }))}
                style={{ width: 52, height: 28, padding: 0, border: '1.5px solid var(--ink)',
                  background: prefs.allow_layering ? 'var(--accent)' : 'transparent', cursor: 'pointer', position: 'relative' }}>
                <span style={{ position: 'absolute', top: 2, left: prefs.allow_layering ? 26 : 2,
                  width: 22, height: 22, background: 'var(--ink)', transition: 'left 0.18s ease' }} />
              </button>
            </div>

            <button className="bru-btn bru-btn-accent" style={{ marginTop: 12 }} onClick={savePrefs} disabled={saving}>
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save preferences'}
            </button>
          </div>

          {/* Password */}
          <div className="bru-card">
            <div className="bru-mono">PASSWORD</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 12 }}>
              <div>
                <label className="bru-label">Current</label>
                <input className="bru-input" type="password" value={pwd.current_password} onChange={e => setPwd({ ...pwd, current_password: e.target.value })} />
              </div>
              <div>
                <label className="bru-label">New</label>
                <input className="bru-input" type="password" value={pwd.new_password} onChange={e => setPwd({ ...pwd, new_password: e.target.value })} />
              </div>
              <div>
                <label className="bru-label">Confirm</label>
                <input className="bru-input" type="password" value={pwd.confirm_password} onChange={e => setPwd({ ...pwd, confirm_password: e.target.value })} />
              </div>
            </div>
            <button className="bru-btn bru-btn-accent" style={{ marginTop: 12 }} onClick={changePassword} disabled={pwdSaving || !pwd.current_password || !pwd.new_password}>
              {pwdSaving ? 'Changing…' : 'Change password'}
            </button>
            <Msg msg={pwdMsg} />
          </div>

          {/* Delete account */}
          <div className="bru-card" style={{ borderLeft: '6px solid var(--accent)' }}>
            <div className="bru-serif" style={{ fontSize: 22 }}>Delete account</div>
            <div className="bru-mono" style={{ fontSize: 9, marginTop: 6, color: 'var(--mute)', textTransform: 'none', letterSpacing: '0.04em', lineHeight: 1.5 }}>
              Permanently deletes your account, all wardrobe items, outfits, and preferences. Cannot be undone.
            </div>
            {!deleteOpen ? (
              <button className="bru-btn" style={{ marginTop: 12, background: 'var(--ink)', color: 'var(--paper)' }} onClick={() => setDeleteOpen(true)}>
                Delete account…
              </button>
            ) : (
              <div style={{ marginTop: 12 }}>
                <label className="bru-label">Type your password to confirm</label>
                <input className="bru-input" type="password" value={deletePwd} onChange={e => setDeletePwd(e.target.value)} />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="bru-btn" onClick={() => { setDeleteOpen(false); setDeletePwd(''); setDeleteMsg(null) }}>Cancel</button>
                  <button className="bru-btn" style={{ background: 'var(--ink)', color: 'var(--paper)' }} onClick={deleteAccount} disabled={deleteBusy}>
                    {deleteBusy ? 'Deleting…' : 'Confirm delete'}
                  </button>
                </div>
                <Msg msg={deleteMsg} />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
