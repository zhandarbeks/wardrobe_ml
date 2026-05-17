import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

// stat box styles
const statBox   = { flex: 1, padding: '10px 8px', borderRadius: 10, background: '#fafafa', border: '1px solid #eee', textAlign: 'center' }
const statLabel = { fontSize: 10, color: '#999', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 2 }
const statVal   = { fontWeight: 700, fontSize: 16 }

// category → display order / size weight
const CAT_ORDER = { outer: 0, top: 1, mid: 2, bottom: 3, footwear: 4, accessory: 5 }

const COLOR_HEX = {
  black: '#1a1a1a', white: '#f0f0f0', gray: '#888', navy: '#0a1e50',
  'royal blue': '#4169e1', 'sky blue': '#87ceeb', teal: '#008080',
  green: '#228b22', olive: '#6b8e23', yellow: '#ffd700', orange: '#ff8c00',
  red: '#c81e1e', burgundy: '#800020', pink: '#ff69b3', purple: '#800080',
  beige: '#e8dcc8', brown: '#8b4513', camel: '#c19a6b',
}

const SCORE_WEIGHTS_NO_ML   = { color_harmony: 0.50, style_match: 0.20, weather_fit: 0.30 }
const SCORE_WEIGHTS_WITH_ML = { color_harmony: 0.35, style_match: 0.15, weather_fit: 0.25, ml_compat: 0.25 }

function ScoreBreakdownTooltip({ bd, score }) {
  const pct = (v) => `${Math.round((v ?? 0) * 100)}%`
  const f2  = (v) => Number(v ?? 0).toFixed(2)
  const hasML = bd.ml_compat != null
  const W = hasML ? SCORE_WEIGHTS_WITH_ML : SCORE_WEIGHTS_NO_ML

  const terms = [
    { key: 'color_harmony', label: 'color',   value: bd.color_harmony, color: '#2563eb',
      detail: `${bd.color_pairs ?? 0} pair${(bd.color_pairs ?? 0) === 1 ? '' : 's'}` },
    { key: 'style_match',   label: 'style',   value: bd.style_match,   color: '#0a8754',
      detail: `${bd.style_matches ?? 0} item${(bd.style_matches ?? 0) === 1 ? '' : 's'}` },
    { key: 'weather_fit',   label: 'weather', value: bd.weather_fit,   color: '#ea580c',
      detail: `${bd.t_target ?? '?'}°C target` },
    ...(hasML ? [{ key: 'ml_compat', label: 'ml', value: bd.ml_compat, color: '#7c3aed',
      detail: `${bd.ml_pairs ?? 0} pair${(bd.ml_pairs ?? 0) === 1 ? '' : 's'}` }] : []),
  ]
  const sumOfTerms = terms.reduce((s, t) => s + W[t.key] * (t.value ?? 0), 0)

  // ── Inner row helpers ───────────────────────────────────────────────────
  const Bar = ({ t }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 3 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: t.color, flexShrink: 0 }} />
        <span style={{ color: '#374151', fontWeight: 600 }}>{t.label}</span>
        <span style={{ color: '#9ca3af', fontSize: 10 }}>· {t.detail}</span>
        <span style={{ marginLeft: 'auto', color: t.color, fontWeight: 700 }}>{pct(t.value)}</span>
      </div>
      <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${Math.max(0, Math.min(1, t.value ?? 0)) * 100}%`,
          background: t.color, transition: 'width 0.2s',
        }} />
      </div>
    </div>
  )

  // Single formula row — fixed-width columns so weights/values/products line up.
  const FormulaRow = ({ t, isFirst }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 11, lineHeight: '20px', color: '#374151',
    }}>
      <span style={{ width: 14, color: '#9ca3af', textAlign: 'center' }}>
        {isFirst ? '=' : '+'}
      </span>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: t.color, marginRight: 6, flexShrink: 0 }} />
      <span style={{ width: 56, color: t.color, fontWeight: 600 }}>{t.label}</span>
      <span style={{ width: 36, textAlign: 'right', color: '#111827' }}>{W[t.key].toFixed(2)}</span>
      <span style={{ width: 14, textAlign: 'center', color: '#9ca3af' }}>×</span>
      <span style={{ width: 32, textAlign: 'right' }}>{f2(t.value)}</span>
      <span style={{ width: 14, textAlign: 'center', color: '#9ca3af' }}>=</span>
      <span style={{ flex: 1, textAlign: 'right', color: '#111827', fontWeight: 600 }}>
        {f2(W[t.key] * (t.value ?? 0))}
      </span>
    </div>
  )

  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 50,
      width: 320, padding: 12, borderRadius: 10,
      background: '#fff', border: '1px solid #e5e7eb',
      boxShadow: '0 6px 18px rgba(0,0,0,0.10)',
      color: '#374151', textAlign: 'left', cursor: 'default',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
        Why this score?
      </div>

      {/* Component bars */}
      {terms.map(t => <Bar key={t.key} t={t} />)}

      {/* Formula — identical to backend SCORE_WEIGHTS_*. Each row is colored
          to match its progress bar above, columns are fixed-width so numbers
          line up vertically. */}
      <div style={{
        marginTop: 4, paddingTop: 8, borderTop: '1px dashed #d1d5db',
      }}>
        <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Formula{hasML ? ' · with ML' : ''}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, lineHeight: '20px', color: '#9ca3af', marginBottom: 2 }}>
          <span style={{ width: 14 }} />
          <span style={{ width: 9, marginRight: 6 }} />
          <span style={{ width: 56, color: '#111827', fontWeight: 700 }}>final</span>
        </div>

        {terms.map((t, i) => (
          <FormulaRow key={t.key} t={t} isFirst={i === 0} />
        ))}

        {/* Sum line */}
        <div style={{
          display: 'flex', alignItems: 'center',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 11, lineHeight: '20px', marginTop: 4,
          paddingTop: 4, borderTop: '1px solid #e5e7eb',
        }}>
          <span style={{ width: 14 + 9 + 6 + 56 + 36 + 14 + 32 + 14 }} />
          <span style={{ flex: 1, textAlign: 'right', color: '#111827', fontWeight: 700 }}>
            {f2(sumOfTerms)}
          </span>
        </div>
      </div>

      {/* Final */}
      <div style={{
        marginTop: 10, paddingTop: 8, borderTop: '1px solid #e5e7eb',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12,
      }}>
        <span style={{ color: '#6b7280' }}>Final score</span>
        <strong style={{ fontSize: 14, color: '#111827' }}>⭐ {f2(score)}</strong>
      </div>

      {(bd.disliked_matches ?? 0) > 0 && (
        <div style={{ marginTop: 6, color: '#b91c1c', fontSize: 11 }}>
          ⚠ {bd.disliked_matches} item(s) in your disliked colors
        </div>
      )}
      {bd.raw_color_avg != null && (
        <div style={{ marginTop: 6, fontSize: 10, color: '#9ca3af' }}>
          raw: color_avg={bd.raw_color_avg}, style_score={bd.raw_style_score}
        </div>
      )}
    </div>
  )
}

function OutfitCollage({ items }) {
  const sorted = [...items].sort((a, b) => (CAT_ORDER[a.category] ?? 9) - (CAT_ORDER[b.category] ?? 9))

  const layers   = sorted.filter(i => ['outer','top','mid'].includes(i.category))
  const bottoms  = sorted.filter(i => i.category === 'bottom')
  const smalls   = sorted.filter(i => ['footwear','accessory'].includes(i.category))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* top row: jackets + tops side by side */}
      {layers.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(layers.length, 3)}, 1fr)`, gap: 8 }}>
          {layers.map(item => <CollageCell key={item.id} item={item} height={200} />)}
        </div>
      )}
      {/* bottom: full width */}
      {bottoms.map(item => <CollageCell key={item.id} item={item} height={160} />)}
      {/* footwear + accessories: smaller row */}
      {smalls.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(smalls.length, 3)}, 1fr)`, gap: 8 }}>
          {smalls.map(item => <CollageCell key={item.id} item={item} height={120} />)}
        </div>
      )}
    </div>
  )
}

function CollageCell({ item, height }) {
  return (
    <div style={{ position: 'relative', height, borderRadius: 14, overflow: 'hidden', background: '#f5f5f5' }}>
      <ItemImage item={item} />
      {/* name label at bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '20px 10px 8px',
        background: 'linear-gradient(transparent, rgba(0,0,0,.45))',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: '#fff',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{item.name}</span>
        <span style={{
          fontSize: 10, color: 'rgba(255,255,255,.75)',
          background: 'rgba(0,0,0,.25)', borderRadius: 4,
          padding: '1px 5px', flexShrink: 0, marginLeft: 6, textTransform: 'capitalize',
        }}>{item.category}</span>
      </div>
    </div>
  )
}

function ItemImage({ item }) {
  const [src, setSrc] = useState(item.image_no_bg_url || item.image_url || null)
  const fallback = item.image_no_bg_url ? item.image_url : null

  const imgStyle = { width: '100%', height: '100%', objectFit: 'contain' }

  if (!src) return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 48, opacity: .2 }}>👕</span>
    </div>
  )
  return (
    <img
      src={src}
      alt={item.name}
      style={imgStyle}
      onError={() => {
        if (fallback && src !== fallback) setSrc(fallback)
        else setSrc(null)
      }}
    />
  )
}

export default function Dashboard() {
  const [weather,         setWeather]         = useState(null)
  const [outfits,         setOutfits]         = useState([])
  const [stats,           setStats]           = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [regenerating,    setRegenerating]    = useState(false)
  const [outfitIdx,       setOutfitIdx]       = useState(0)
  const [saving,          setSaving]          = useState(false)
  const [saved,           setSaved]           = useState(false)
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false)
  const [city,            setCity]            = useState('')
  const [showCityInput,   setShowCityInput]   = useState(false)
  const [geoLoading,      setGeoLoading]      = useState(false)
  const [citySuggestions, setCitySuggestions] = useState([])
  const searchTimer = useRef(null)
  const navigate    = useNavigate()

  const [me, setMe] = useState(null)
  const [resendingVerify, setResendingVerify] = useState(false)
  const [verifyResendMsg, setVerifyResendMsg] = useState('')

  const load = async () => {
    setLoading(true)
    setSaved(false)
    try {
      const [wRes, oRes, sRes, mRes] = await Promise.all([
        api.get('/api/v1/weather/current'),
        api.get('/api/v1/outfits/recommend'),
        api.get('/api/v1/wardrobe/stats').catch(() => ({ data: null })),
        api.get('/api/v1/auth/me').catch(() => ({ data: null })),
      ])
      setStats(sRes.data)
      setWeather(wRes.data)
      setOutfits(oRes.data.outfits || [])
      setOutfitIdx(0)
      setMe(mRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const resendVerification = async () => {
    if (resendingVerify) return
    setResendingVerify(true)
    setVerifyResendMsg('')
    try {
      const r = await api.post('/api/v1/auth/resend-verification')
      setVerifyResendMsg(r.data?.dev_verification_link
        ? `Sent. Dev link: ${r.data.dev_verification_link}`
        : 'Verification email sent. Check your inbox.')
    } catch (err) {
      setVerifyResendMsg(err?.response?.data?.detail || 'Could not resend — try again later.')
    } finally {
      setResendingVerify(false)
    }
  }

  const regenerate = async () => {
    setRegenerating(true)
    setSaved(false)
    try {
      const res = await api.get('/api/v1/outfits/recommend')
      setOutfits(res.data.outfits || [])
      setOutfitIdx(0)
      if (res.data.weather) setWeather(res.data.weather)
    } catch (e) {
      console.error(e)
    } finally {
      setRegenerating(false)
    }
  }

  const setUserCity = async () => {
    if (!city.trim()) return
    await api.post('/api/v1/weather/city', { city: city.trim() })
    setShowCityInput(false)
    setCity('')
    setCitySuggestions([])
    load()
  }

  const detectLocation = () => {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        let cityName = null
        try {
          const r = await api.get(`/api/v1/weather/reverse?lat=${lat}&lon=${lon}`)
          if (r.data) {
            cityName = r.data.state
              ? `${r.data.name}, ${r.data.state}, ${r.data.country}`
              : `${r.data.name}, ${r.data.country}`
          }
        } catch { /* fallback: backend keeps existing city */ }
        try {
          await api.post('/api/v1/weather/location', { lat, lon, city: cityName })
          setShowCityInput(false)
          load()
        } finally {
          setGeoLoading(false)
        }
      },
      () => setGeoLoading(false),
      { timeout: 10000 },
    )
  }

  const handleCityInput = val => {
    setCity(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!val.trim() || val.length < 2) { setCitySuggestions([]); return }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/api/v1/weather/search?q=${encodeURIComponent(val)}`)
        setCitySuggestions(res.data || [])
      } catch { setCitySuggestions([]) }
    }, 400)
  }

  const pickSuggestion = async s => {
    setCitySuggestions([])
    setCity('')
    setShowCityInput(false)
    const cityName = s.state ? `${s.name}, ${s.state}, ${s.country}` : `${s.name}, ${s.country}`
    await api.post('/api/v1/weather/location', { lat: s.lat, lon: s.lon, city: cityName })
    load()
  }

  const saveOutfit = async () => {
    const o = outfits[outfitIdx]
    if (!o) return
    setSaving(true)
    try {
      await api.post('/api/v1/outfits', {
        item_ids: o.items.map(i => i.id).join(','),
        is_auto_generated: true,
        score: o.score,
        weather_temp: o.t_target,
      })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  const current = outfits[outfitIdx]

  return (
    <div className="page">
      {me && me.email_verified === false && (
        <div style={{
          background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8,
          padding: '10px 14px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          fontSize: 13, color: '#78350f',
        }}>
          <span style={{ fontSize: 18 }}>✉️</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <strong>Verify your email</strong> - we sent a confirmation link to{' '}
            <code style={{ background: '#fff8e1', padding: '1px 6px', borderRadius: 4 }}>{me.email}</code>.
            {verifyResendMsg && (
              <div style={{ marginTop: 4, fontSize: 12, color: '#92400e' }}>{verifyResendMsg}</div>
            )}
          </div>
          <button
            onClick={resendVerification}
            disabled={resendingVerify}
            style={{
              background: '#f59e0b', color: '#fff', border: 'none',
              padding: '6px 12px', borderRadius: 6, fontWeight: 600,
              fontSize: 12, cursor: resendingVerify ? 'wait' : 'pointer',
            }}
          >
            {resendingVerify ? 'Sending…' : 'Resend email'}
          </button>
        </div>
      )}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT COLUMN ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Weather */}
          <div className="weather">
            {weather ? (
              <>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="temp">
                      {weather.temp != null ? `${Math.round(weather.temp)}°C` : '—'}
                    </div>
                    <div className="desc">{weather.description || (weather.city ? '' : 'City not detected')}</div>
                    {weather.temp != null ? (
                      <div style={{ marginTop: 8, opacity: .7, fontSize: 13 }}>
                        Feels like {Math.round(weather.feels_like ?? weather.temp)}°C
                        &nbsp;·&nbsp;
                        {Math.round(weather.wind_speed ?? 0)} m/s
                      </div>
                    ) : (
                      <div style={{ marginTop: 8, opacity: .8, fontSize: 13, color: '#fbbf24' }}>
                        ⚠ Set a city to get current weather and accurate outfit recommendations
                      </div>
                    )}
                    <div style={{ marginTop: 4, opacity: .7, fontSize: 13 }}>{weather.city || 'No city set'}</div>
                  </div>
                  {weather.icon && (
                    <img src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`} width={64} alt="" />
                  )}
                </div>

                <div className="flex gap-8" style={{ marginTop: 14 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setShowCityInput(v => !v); setCitySuggestions([]) }}>
                    Change city
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={detectLocation} disabled={geoLoading}>
                    {geoLoading ? '…' : '📍 Detect'}
                  </button>
                </div>

                {showCityInput && (
                  <div style={{ marginTop: 10, position: 'relative' }}>
                    <div className="flex gap-8">
                      <input
                        value={city}
                        onChange={e => handleCityInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key !== 'Enter') return
                          e.preventDefault()
                          // If we have suggestions visible, Enter picks the first one
                          // (most-likely match). Falls back to literal-text submit if not.
                          if (citySuggestions.length > 0) {
                            pickSuggestion(citySuggestions[0])
                          } else {
                            setUserCity()
                          }
                        }}
                        placeholder="Search city…"
                        autoFocus
                        style={{
                          flex: 1, padding: '8px 10px', borderRadius: 6,
                          border: '1px solid rgba(255,255,255,.3)',
                          background: 'rgba(255,255,255,.1)',
                          color: '#fff', outline: 'none', fontSize: 14,
                        }}
                      />
                      <button className="btn btn-secondary btn-sm" onClick={setUserCity}>OK</button>
                    </div>
                    {citySuggestions.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        background: '#1e2a3a', borderRadius: 8, marginTop: 4,
                        border: '1px solid rgba(255,255,255,.15)', zIndex: 20, overflow: 'hidden',
                      }}>
                        {citySuggestions.map((s, i) => (
                          <div
                            key={i}
                            onClick={() => pickSuggestion(s)}
                            style={{
                              padding: '9px 12px', cursor: 'pointer', fontSize: 13, color: '#fff',
                              borderBottom: i < citySuggestions.length - 1 ? '1px solid rgba(255,255,255,.08)' : 'none',
                              // First suggestion is highlighted as the Enter-key default
                              background: i === 0 ? 'rgba(37,99,235,.25)' : 'transparent',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = i === 0 ? 'rgba(37,99,235,.25)' : 'transparent'}
                          >
                            {s.name}{s.state ? `, ${s.state}` : ''}, {s.country}
                            {i === 0 && (
                              <span style={{ float: 'right', opacity: .55, fontSize: 11 }}>↵ Enter</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ opacity: .6 }}>Loading weather…</div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Quick Actions</h2>
            <button className="btn btn-primary" onClick={() => navigate('/add')}>+ Add Clothes</button>
            <button className="btn btn-secondary" onClick={() => navigate('/wardrobe')}>My Wardrobe</button>
            <button className="btn btn-secondary" onClick={() => navigate('/outfits')}>Saved Outfits</button>
            <button className="btn btn-secondary" onClick={load}>Refresh</button>
          </div>
        </div>

        {/* ── RIGHT COLUMN — outfit ────────────────────────────── */}
        <div>
          <h2 style={{ marginBottom: 16 }}>Today's Outfit</h2>

          {loading ? (
            <div className="card text-center text-gray" style={{ padding: 60 }}>
              Generating outfit for the current weather…
            </div>
          ) : !current ? (
            <div className="card text-center" style={{ padding: 60 }}>
              <p className="text-gray">No outfit suggestions — add some clothes first.</p>
              <button className="btn btn-primary mt-16" onClick={() => navigate('/add')}>
                Add clothes to get started →
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 20 }}>
              <OutfitCollage items={current.items} />

              {/* Score + T target */}
              <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
                <div
                  style={{ ...statBox, position: 'relative', cursor: current.score_breakdown ? 'help' : 'default' }}
                  onMouseEnter={() => setShowScoreBreakdown(true)}
                  onMouseLeave={() => setShowScoreBreakdown(false)}
                >
                  <div style={statLabel}>SCORE</div>
                  <div style={statVal}>⭐ {current.score.toFixed(2)}</div>
                  {showScoreBreakdown && current.score_breakdown && (
                    <ScoreBreakdownTooltip bd={current.score_breakdown} score={current.score} />
                  )}
                </div>
                <div style={statBox}>
                  <div style={statLabel}>T TARGET</div>
                  <div style={statVal}>🌡 {current.t_target}°C</div>
                </div>
                {outfits.length > 1 && (
                  <div style={statBox}>
                    <div style={statLabel}>OPTION</div>
                    <div
                      style={{
                        ...statVal,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setOutfitIdx((i) => (i - 1 + outfits.length) % outfits.length)
                          setSaved(false)
                        }}
                        title="Previous option"
                        style={{
                          border: 'none', background: 'transparent', cursor: 'pointer',
                          fontSize: 16, padding: '0 4px', lineHeight: 1,
                        }}
                      >
                        ‹
                      </button>
                      <span>{outfitIdx + 1} / {outfits.length}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setOutfitIdx((i) => (i + 1) % outfits.length)
                          setSaved(false)
                        }}
                        title="Next option"
                        style={{
                          border: 'none', background: 'transparent', cursor: 'pointer',
                          fontSize: 16, padding: '0 4px', lineHeight: 1,
                        }}
                      >
                        ›
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={regenerate}
                  disabled={regenerating}
                >
                  {regenerating ? 'Generating…' : 'Regenerate'}
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={saveOutfit}
                  disabled={saving || saved}
                >
                  {saved ? 'Saved!' : saving ? '…' : 'Save outfit'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Wardrobe Stats ──────────────────────────────────────────── */}
      {stats && stats.total > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ marginBottom: 16 }}>Wardrobe Stats</h2>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              <div style={statBox}>
                <div style={statLabel}>TOTAL ITEMS</div>
                <div style={statVal}>{stats.total}</div>
              </div>
              <div style={statBox}>
                <div style={statLabel}>NEVER WORN</div>
                <div style={{ ...statVal, color: stats.never_worn > 0 ? '#d97706' : '#16a34a' }}>
                  {stats.never_worn}
                </div>
              </div>
              {Object.entries(stats.by_category || {}).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <div key={cat} style={statBox}>
                  <div style={statLabel}>{cat.toUpperCase()}</div>
                  <div style={statVal}>{count}</div>
                </div>
              ))}
            </div>

            {/* Color distribution bar */}
            {Object.keys(stats.by_color || {}).length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#999', marginBottom: 10, textTransform: 'uppercase' }}>
                  Color distribution
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(stats.by_color).sort((a, b) => b[1] - a[1]).map(([color, count]) => (
                    <div key={color} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: '#f5f5f5', borderRadius: 16,
                      padding: '4px 10px', fontSize: 12,
                    }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: COLOR_HEX[color] || '#ccc',
                        border: '1px solid rgba(0,0,0,.1)', flexShrink: 0,
                      }} />
                      <span style={{ textTransform: 'capitalize', color: '#555' }}>{color}</span>
                      <span style={{ fontWeight: 700, color: '#1a1a1a' }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
