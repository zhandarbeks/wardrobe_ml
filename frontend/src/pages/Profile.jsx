import { useEffect, useRef, useState } from 'react'
import api from '../api'

const STYLES_LIST = ['casual', 'smart casual', 'business', 'sport', 'streetwear', 'formal']
const COLORS = [
  'black', 'white', 'gray', 'navy', 'royal blue', 'sky blue',
  'teal', 'green', 'olive', 'yellow', 'orange', 'red',
  'burgundy', 'pink', 'purple', 'beige', 'brown', 'camel',
]
const COLOR_HEX = {
  black: '#1a1a1a', white: '#f5f5f5', gray: '#888', navy: '#0a1e50',
  'royal blue': '#4169e1', 'sky blue': '#87ceeb', teal: '#008080',
  green: '#228b22', olive: '#6b8e23', yellow: '#ffd700', orange: '#ff8c00',
  red: '#c81e1e', burgundy: '#800020', pink: '#ff69b3', purple: '#800080',
  beige: '#f5f5dc', brown: '#8b4513', camel: '#c19a6b',
}

const INPUT_STYLE = {
  width: '100%', padding: '10px 12px', border: '1px solid #ddd',
  borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit',
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: '#999', marginBottom: 12,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

export default function Profile() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'))
  const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const [account, setAccount] = useState({ name: user.name || '', email: user.email || '' })
  const [accountSaving, setAccountSaving] = useState(false)
  const [accountMsg,    setAccountMsg]    = useState(null)  // {type, text}

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
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => {
    api.get('/api/v1/profile/preferences').then(r => setPrefs(r.data))
    // pull fresh user (city/lat/lon may not be in localStorage from older logins)
    api.get('/api/v1/auth/me').then(r => {
      const u = r.data
      setLocation({
        city:      u.city ?? '',
        latitude:  u.latitude  != null ? String(u.latitude)  : '',
        longitude: u.longitude != null ? String(u.longitude) : '',
      })
      const cached = JSON.parse(localStorage.getItem('user') || '{}')
      const merged = { ...cached, name: u.name, email: u.email, role: u.role, city: u.city }
      localStorage.setItem('user', JSON.stringify(merged))
      setUser(merged)
    }).catch(() => {})
  }, [])

  const saveAccount = async () => {
    setAccountSaving(true)
    setAccountMsg(null)
    try {
      const res = await api.patch('/api/v1/auth/me', {
        name:  account.name.trim(),
        email: account.email.trim(),
      })
      const updated = { ...user, name: res.data.name, email: res.data.email }
      localStorage.setItem('user', JSON.stringify(updated))
      setUser(updated)
      setAccountMsg({ type: 'success', text: 'Account updated!' })
      setTimeout(() => setAccountMsg(null), 2500)
    } catch (e) {
      setAccountMsg({ type: 'error', text: e.response?.data?.detail || 'Failed to update' })
    } finally {
      setAccountSaving(false)
    }
  }

  const handleCityInput = val => {
    // typing invalidates previously-detected coordinates so we don't save mismatched data
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
      city:      s.state ? `${s.name}, ${s.state}, ${s.country}` : `${s.name}, ${s.country}`,
      latitude:  String(s.lat),
      longitude: String(s.lon),
    })
    setCitySuggestions([])
  }

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocMsg({ type: 'error', text: 'Geolocation is not supported by this browser' })
      return
    }
    setGeoLoading(true)
    setLocMsg(null)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        let cityName = ''
        try {
          const res = await api.get(`/api/v1/weather/reverse?lat=${lat}&lon=${lon}`)
          if (res.data) {
            cityName = res.data.state
              ? `${res.data.name}, ${res.data.state}, ${res.data.country}`
              : `${res.data.name}, ${res.data.country}`
          }
        } catch { /* fallback: leave city as-is */ }
        setLocation(l => ({
          city:      cityName || l.city,
          latitude:  lat.toFixed(5),
          longitude: lon.toFixed(5),
        }))
        setCitySuggestions([])
        setGeoLoading(false)
      },
      err => {
        setLocMsg({ type: 'error', text: err.message || 'Failed to get location' })
        setGeoLoading(false)
      },
      { timeout: 10000, enableHighAccuracy: false },
    )
  }

  const saveLocation = async () => {
    setLocSaving(true)
    setLocMsg(null)
    const payload = { city: location.city.trim() }
    if (location.latitude  !== '') payload.latitude  = parseFloat(location.latitude)
    if (location.longitude !== '') payload.longitude = parseFloat(location.longitude)
    if (payload.latitude  !== undefined && Number.isNaN(payload.latitude))  { setLocMsg({ type: 'error', text: 'Latitude is invalid' }); setLocSaving(false); return }
    if (payload.longitude !== undefined && Number.isNaN(payload.longitude)) { setLocMsg({ type: 'error', text: 'Longitude is invalid' }); setLocSaving(false); return }
    try {
      const res = await api.patch('/api/v1/auth/me', payload)
      const updated = { ...user, city: res.data.city }
      localStorage.setItem('user', JSON.stringify(updated))
      setUser(updated)
      setLocation({
        city:      res.data.city ?? '',
        latitude:  res.data.latitude  != null ? String(res.data.latitude)  : '',
        longitude: res.data.longitude != null ? String(res.data.longitude) : '',
      })
      setLocMsg({ type: 'success', text: 'Location updated! Weather will refresh on next outfit.' })
      setTimeout(() => setLocMsg(null), 3000)
    } catch (e) {
      setLocMsg({ type: 'error', text: e.response?.data?.detail || 'Failed to update location' })
    } finally {
      setLocSaving(false)
    }
  }

  const changePassword = async () => {
    setPwdSaving(true)
    setPwdMsg(null)
    try {
      await api.patch('/api/v1/auth/password', pwd)
      setPwd({ current_password: '', new_password: '', confirm_password: '' })
      setPwdMsg({ type: 'success', text: 'Password changed!' })
      setTimeout(() => setPwdMsg(null), 2500)
    } catch (e) {
      setPwdMsg({ type: 'error', text: e.response?.data?.detail || 'Failed to change password' })
    } finally {
      setPwdSaving(false)
    }
  }

  const toggle = (field, val) => {
    const arr  = (prefs[field] || '').split(',').filter(Boolean)
    const next = arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
    setPrefs(p => ({ ...p, [field]: next.join(',') }))
  }
  const has = (field, val) => (prefs[field] || '').split(',').includes(val)

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/api/v1/profile/preferences', prefs)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page" style={{ maxWidth: 600, margin: '0 auto' }}>

      {/* Avatar + user block */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        marginBottom: 32,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#1a1a1a', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 700, flexShrink: 0,
        }}>
          {initials}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{user.name}</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{user.email}</div>
        </div>
        <span className="tag" style={{ marginLeft: 'auto' }}>{user.role}</span>
      </div>

      {/* Account Settings */}
      <div className="card" style={{ padding: 28, marginBottom: 20 }}>
        <Section title="Account Settings">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>Name</label>
              <input
                value={account.name}
                onChange={e => setAccount(a => ({ ...a, name: e.target.value }))}
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>Email</label>
              <input
                type="email"
                value={account.email}
                onChange={e => setAccount(a => ({ ...a, email: e.target.value }))}
                style={INPUT_STYLE}
              />
            </div>
            {accountMsg && (
              <div className={`alert alert-${accountMsg.type === 'success' ? 'success' : 'error'}`}>
                {accountMsg.text}
              </div>
            )}
            <button
              className="btn btn-primary"
              style={{ height: 40, fontSize: 14 }}
              onClick={saveAccount}
              disabled={accountSaving || (!account.name.trim() || !account.email.trim())}
            >
              {accountSaving ? 'Saving…' : 'Save Account'}
            </button>
          </div>
        </Section>
      </div>

      {/* Location */}
      <div className="card" style={{ padding: 28, marginBottom: 20 }}>
        <Section title="Location">
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12, lineHeight: 1.4 }}>
            Used to fetch local weather and adjust outfit recommendations.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }}>City</label>
              <input
                placeholder="Start typing — e.g. Almaty"
                value={location.city}
                onChange={e => handleCityInput(e.target.value)}
                onBlur={() => setTimeout(() => setCitySuggestions([]), 150)}
                style={INPUT_STYLE}
              />
              {citySuggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: '#fff', borderRadius: 8, marginTop: 4,
                  border: '1px solid #e5e5e5', zIndex: 20, overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,.08)',
                }}>
                  {citySuggestions.map((s, i) => (
                    <div
                      key={i}
                      onMouseDown={() => pickSuggestion(s)}
                      style={{
                        padding: '9px 12px', cursor: 'pointer', fontSize: 13, color: '#333',
                        borderBottom: i < citySuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      {s.name}{s.state ? `, ${s.state}` : ''}, {s.country}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {locMsg && (
              <div className={`alert alert-${locMsg.type === 'success' ? 'success' : 'error'}`}>
                {locMsg.text}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary"
                style={{ height: 40, fontSize: 14, flex: 1 }}
                onClick={useMyLocation}
                disabled={geoLoading}
              >
                {geoLoading ? 'Detecting…' : '📍 Use my location'}
              </button>
              <button
                className="btn btn-primary"
                style={{ height: 40, fontSize: 14, flex: 1 }}
                onClick={saveLocation}
                disabled={locSaving}
              >
                {locSaving ? 'Saving…' : 'Save Location'}
              </button>
            </div>
          </div>
        </Section>
      </div>

      {/* Change Password */}
      <div className="card" style={{ padding: 28, marginBottom: 20 }}>
        <Section title="Change Password">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              placeholder="Current password"
              value={pwd.current_password}
              onChange={e => setPwd(p => ({ ...p, current_password: e.target.value }))}
              style={INPUT_STYLE}
            />
            <input
              type="password"
              placeholder="New password (min. 6 chars)"
              value={pwd.new_password}
              onChange={e => setPwd(p => ({ ...p, new_password: e.target.value }))}
              style={INPUT_STYLE}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={pwd.confirm_password}
              onChange={e => setPwd(p => ({ ...p, confirm_password: e.target.value }))}
              style={INPUT_STYLE}
            />
            {pwdMsg && (
              <div className={`alert alert-${pwdMsg.type === 'success' ? 'success' : 'error'}`}>
                {pwdMsg.text}
              </div>
            )}
            <button
              className="btn btn-primary"
              style={{ height: 40, fontSize: 14 }}
              onClick={changePassword}
              disabled={
                pwdSaving ||
                !pwd.current_password ||
                !pwd.new_password ||
                !pwd.confirm_password
              }
            >
              {pwdSaving ? 'Changing…' : 'Change Password'}
            </button>
          </div>
        </Section>
      </div>

      <div className="card" style={{ padding: 28 }}>

        {/* Styles */}
        <Section title="Preferred Styles">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {STYLES_LIST.map(s => (
              <button
                key={s}
                onClick={() => toggle('styles', s)}
                style={{
                  padding: '8px 0', borderRadius: 20, fontSize: 13,
                  fontWeight: 500, cursor: 'pointer', transition: 'all .15s',
                  border: has('styles', s) ? '1.5px solid #1a1a1a' : '1.5px solid #e5e5e5',
                  background: has('styles', s) ? '#1a1a1a' : '#fafafa',
                  color:      has('styles', s) ? '#fff'    : '#555',
                  textTransform: 'capitalize', textAlign: 'center',
                }}
              >{s}</button>
            ))}
          </div>
        </Section>

        <div style={{ height: 1, background: '#f0f0f0', margin: '4px 0 28px' }} />

        {/* Favourite colours */}
        <Section title="Favourite Colours">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 10 }}>
            {COLORS.map(c => (
              <div key={c} title={c} onClick={() => toggle('favorite_colors', c)}
                style={{ position: 'relative', cursor: 'pointer', aspectRatio: '1' }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  background: COLOR_HEX[c] || '#ccc',
                  border: `3px solid ${has('favorite_colors', c) ? '#1a1a1a' : '#e5e5e5'}`,
                  boxSizing: 'border-box',
                  transition: 'border-color .1s',
                }} />
                {has('favorite_colors', c) && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    color: ['white','beige','yellow','sky blue'].includes(c) ? '#333' : '#fff',
                  }}>✓</div>
                )}
              </div>
            ))}
          </div>
        </Section>

        <div style={{ height: 1, background: '#f0f0f0', margin: '4px 0 28px' }} />

        {/* Disliked colours */}
        <Section title="Disliked Colours">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 10 }}>
            {COLORS.map(c => (
              <div key={c} title={c} onClick={() => toggle('disliked_colors', c)}
                style={{ position: 'relative', cursor: 'pointer', aspectRatio: '1' }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  background: COLOR_HEX[c] || '#ccc',
                  border: `3px solid ${has('disliked_colors', c) ? '#dc2626' : '#e5e5e5'}`,
                  boxSizing: 'border-box',
                  opacity: has('disliked_colors', c) ? 1 : 0.45,
                  transition: 'border-color .1s, opacity .1s',
                }} />
                {has('disliked_colors', c) && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    color: ['white','beige','yellow','sky blue'].includes(c) ? '#333' : '#fff',
                  }}>✕</div>
                )}
              </div>
            ))}
          </div>
        </Section>

        <div style={{ height: 1, background: '#f0f0f0', margin: '4px 0 28px' }} />

        {/* Thermal sensitivity */}
        <Section title="Thermal Sensitivity">
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { v: 'cold',   label: 'Cold',   emoji: '🥶', desc: 'I feel cold easily' },
              { v: 'normal', label: 'Normal',  emoji: '😊', desc: 'Average sensitivity' },
              { v: 'hot',    label: 'Warm',    emoji: '🥵', desc: 'I run hot' },
            ].map(({ v, label, emoji, desc }) => {
              const active = prefs.heat_sensitivity === v
              return (
                <div
                  key={v}
                  onClick={() => setPrefs(p => ({ ...p, heat_sensitivity: v }))}
                  style={{
                    flex: 1, padding: '12px 8px', borderRadius: 10, cursor: 'pointer',
                    textAlign: 'center', transition: 'all .15s',
                    border: `2px solid ${active ? '#1a1a1a' : '#e5e5e5'}`,
                    background: active ? '#1a1a1a' : '#fafafa',
                    color: active ? '#fff' : '#555',
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 11, opacity: .7, marginTop: 2 }}>{desc}</div>
                </div>
              )
            })}
          </div>
        </Section>

        <div style={{ height: 1, background: '#f0f0f0', margin: '4px 0 28px' }} />

        {/* Layering */}
        <Section title="Outfit Layering">
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { v: true,  label: 'Allow layering',  emoji: '🧥', desc: 'Mid + outer layers' },
              { v: false, label: 'Single layer',     emoji: '👕', desc: 'One piece per slot' },
            ].map(({ v, label, emoji, desc }) => {
              const active = prefs.allow_layering === v
              return (
                <div
                  key={String(v)}
                  onClick={() => setPrefs(p => ({ ...p, allow_layering: v }))}
                  style={{
                    flex: 1, padding: '12px 8px', borderRadius: 10, cursor: 'pointer',
                    textAlign: 'center', transition: 'all .15s',
                    border: `2px solid ${active ? '#1a1a1a' : '#e5e5e5'}`,
                    background: active ? '#1a1a1a' : '#fafafa',
                    color: active ? '#fff' : '#555',
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 11, opacity: .7, marginTop: 2 }}>{desc}</div>
                </div>
              )
            })}
          </div>
        </Section>

        {saved && (
          <div className="alert alert-success" style={{ marginBottom: 16 }}>
            Preferences saved!
          </div>
        )}

        <button
          className="btn btn-primary w-full"
          style={{ height: 44, fontSize: 15 }}
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </div>
    </div>
  )
}
