import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const SCORE_WEIGHTS_NO_ML   = { color_harmony: 0.50, style_match: 0.20, weather_fit: 0.30 }
const SCORE_WEIGHTS_WITH_ML = { color_harmony: 0.35, style_match: 0.15, weather_fit: 0.25, ml_compat: 0.25 }

function ItemImage({ item, size = 90 }) {
  const [src, setSrc] = useState(item.image_no_bg_url || item.image_url || null)
  const fallback = item.image_no_bg_url ? item.image_url : null
  if (!src) return (
    <div style={{ width: size, height: size, display: 'grid', placeItems: 'center' }}>
      <span style={{ fontSize: size * 0.45, opacity: .25 }}>👕</span>
    </div>
  )
  return (
    <img src={src} alt={item.name}
      style={{ width: size, height: size, objectFit: 'contain' }}
      onError={() => { if (fallback && src !== fallback) setSrc(fallback); else setSrc(null) }} />
  )
}

function ScoreBreakdown({ bd }) {
  const hasML = bd.ml_compat != null
  const W = hasML ? SCORE_WEIGHTS_WITH_ML : SCORE_WEIGHTS_NO_ML
  const parts = [
    { l: 'Colour harmony',   k: 'color_harmony', detail: `${bd.color_pairs ?? 0} pair${(bd.color_pairs ?? 0) === 1 ? '' : 's'}` },
    { l: 'Style match',      k: 'style_match',   detail: `${bd.style_matches ?? 0} item${(bd.style_matches ?? 0) === 1 ? '' : 's'}` },
    { l: 'Weather fit',      k: 'weather_fit',   detail: `${bd.t_target ?? '?'}°C target` },
    ...(hasML ? [{ l: 'ML compatibility', k: 'ml_compat', detail: `${bd.ml_pairs ?? 0} pair${(bd.ml_pairs ?? 0) === 1 ? '' : 's'}` }] : []),
  ]
  return (
    <div>
      {parts.map(p => {
        const v = bd[p.k] ?? 0
        const w = W[p.k]
        return (
          <div key={p.k} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, alignItems: 'baseline' }}>
              <span>{p.l} <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--mute)' }}>· {p.detail}</span></span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {Math.round(v * 100)} <span style={{ color: 'var(--mute)' }}>× {w.toFixed(2)}</span>
              </span>
            </div>
            <div style={{ height: 2, background: 'var(--line-soft)', marginTop: 3 }}>
              <div style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, height: '100%', background: 'var(--accent)' }} />
            </div>
          </div>
        )
      })}
      <div style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--mute)',
        marginTop: 10, borderTop: '1px solid var(--ink)', paddingTop: 6, whiteSpace: 'nowrap',
      }}>
        {hasML
          ? 'score = 0.35·c + 0.15·s + 0.25·w + 0.25·m'
          : 'score = 0.50·c + 0.20·s + 0.30·w   (ML offline)'}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [weather,         setWeather]         = useState(null)
  const [outfits,         setOutfits]         = useState([])
  const [loading,         setLoading]         = useState(true)
  const [regenerating,    setRegenerating]    = useState(false)
  const [outfitIdx,       setOutfitIdx]       = useState(0)
  const [saving,          setSaving]          = useState(false)
  const [saved,           setSaved]           = useState(false)
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
      const [wRes, oRes, mRes] = await Promise.all([
        api.get('/api/v1/weather/current'),
        api.get('/api/v1/outfits/recommend'),
        api.get('/api/v1/auth/me').catch(() => ({ data: null })),
      ])
      setWeather(wRes.data)
      setOutfits(oRes.data.outfits || [])
      setOutfitIdx(0)
      setMe(mRes.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
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
    } finally { setResendingVerify(false) }
  }

  const regenerate = async () => {
    setRegenerating(true); setSaved(false)
    try {
      const res = await api.get('/api/v1/outfits/recommend')
      setOutfits(res.data.outfits || [])
      setOutfitIdx(0)
      if (res.data.weather) setWeather(res.data.weather)
    } finally { setRegenerating(false) }
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
    setCitySuggestions([]); setCity(''); setShowCityInput(false)
    const cityName = s.state ? `${s.name}, ${s.state}, ${s.country}` : `${s.name}, ${s.country}`
    await api.post('/api/v1/weather/location', { lat: s.lat, lon: s.lon, city: cityName })
    load()
  }
  const detectLocation = () => {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords
        let cityName = null
        try {
          const r = await api.get(`/api/v1/weather/reverse?lat=${lat}&lon=${lon}`)
          if (r.data) cityName = r.data.state ? `${r.data.name}, ${r.data.state}, ${r.data.country}` : `${r.data.name}, ${r.data.country}`
        } catch {}
        await api.post('/api/v1/weather/location', { lat, lon, city: cityName })
        setGeoLoading(false); load()
      },
      () => setGeoLoading(false),
      { timeout: 10000 },
    )
  }

  const saveOutfit = async () => {
    const o = outfits[outfitIdx]; if (!o) return
    setSaving(true)
    try {
      await api.post('/api/v1/outfits', {
        item_ids: o.items.map(i => i.id).join(','),
        is_auto_generated: true,
        score: o.score,
        weather_temp: o.t_target,
      })
      setSaved(true)
    } finally { setSaving(false) }
  }

  const markWorn = async () => {
    const o = outfits[outfitIdx]; if (!o || !o.outfit_id) {
      await saveOutfit()
      return
    }
    await api.post(`/api/v1/outfits/${o.outfit_id}/worn`)
    setSaved(true)
  }

  const next = () => { setOutfitIdx((outfitIdx + 1) % outfits.length); setSaved(false) }
  const prev = () => { setOutfitIdx((outfitIdx - 1 + outfits.length) % outfits.length); setSaved(false) }
  const current = outfits[outfitIdx]

  return (
    <div className="bru-page">
      {/* E-mail verification soft banner */}
      {me && me.email_verified === false && (
        <div style={{
          background: 'var(--accent)', borderLeft: '4px solid #0A0A0A',
          padding: '10px 14px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          fontSize: 12,
        }}>
          <span className="bru-mono" style={{ fontSize: 10, color: '#0A0A0A' }}>⚠ E-MAIL NOT VERIFIED</span>
          <span style={{ flex: 1, minWidth: 200, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, textTransform: 'none', letterSpacing: '0.04em', color: '#0A0A0A' }}>
            Confirmation link was sent to <strong style={{ color: '#0A0A0A' }}>{me.email}</strong>.
            {verifyResendMsg && <span style={{ display: 'block', marginTop: 4, color: '#0A0A0A' }}>{verifyResendMsg}</span>}
          </span>
          <button onClick={resendVerification} disabled={resendingVerify}
            style={{ height: 28, padding: '0 12px', fontSize: 9, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.18em', textTransform: 'uppercase', background: '#0A0A0A', color: '#EDEAE3', border: 'none', cursor: 'pointer' }}>
            {resendingVerify ? 'Sending…' : 'Resend'}
          </button>
        </div>
      )}

      {/* Title */}
      <div className="bru-mono" style={{ marginBottom: 6 }}>TODAY'S RECOMMENDATION</div>
      <div className="bru-serif" style={{ fontSize: 72, lineHeight: 0.95 }}>
        Your <em style={{ color: 'var(--accent)' }}>look</em> for today.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr minmax(280px, 360px)', gap: 18, marginTop: 28 }}>

        {/* LEFT: weather + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="bru-card">
            <div className="bru-mono">{weather?.city ? weather.city.toUpperCase() : 'NO CITY SET'} · NOW</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 10 }}>
              <div className="bru-serif" style={{ fontSize: 56, lineHeight: 1 }}>
                {weather?.temp != null ? `${Math.round(weather.temp)}` : '—'}
                <em style={{ color: 'var(--mute)' }}>°</em>
              </div>
              <div style={{ paddingBottom: 8 }}>
                <div className="bru-serif" style={{ fontSize: 16 }}>{weather?.description || 'Set a city'}</div>
                {weather?.temp != null && (
                  <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>
                    Feels {Math.round(weather.feels_like ?? weather.temp)}° · {Math.round(weather.wind_speed ?? 0)} m/s
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
              <button className="bru-btn" style={{ height: 32, padding: '0 12px', fontSize: 10 }} onClick={() => { setShowCityInput(v => !v); setCitySuggestions([]) }}>
                Change city
              </button>
              <button className="bru-btn" style={{ height: 32, padding: '0 12px', fontSize: 10 }} onClick={detectLocation} disabled={geoLoading}>
                {geoLoading ? '…' : '📍 Detect'}
              </button>
            </div>
            {showCityInput && (
              <div style={{ marginTop: 12, position: 'relative' }}>
                <input className="bru-input" placeholder="Type a city…" value={city}
                  onChange={e => handleCityInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && citySuggestions[0]) pickSuggestion(citySuggestions[0]) }}
                  autoFocus />
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
            )}
          </div>

          {/* Alternatives list */}
          {outfits.length > 1 && (
            <div className="bru-card">
              <div className="bru-mono" style={{ marginBottom: 10 }}>OTHER LOOKS FOR TODAY</div>
              {outfits.filter((_, i) => i !== outfitIdx).slice(0, 3).map(o => (
                <div key={o.id || o.name} onClick={() => { setOutfitIdx(outfits.findIndex(x => x === o)); setSaved(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderBottom: '1px solid var(--line-soft)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex' }}>
                    {o.items.slice(0, 3).map((it, j) => (
                      <div key={it.id} style={{ width: 28, height: 28, border: '1px solid var(--ink)', marginLeft: j === 0 ? 0 : -8, overflow: 'hidden', background: 'var(--paper)' }}>
                        <ItemImage item={it} size={28} />
                      </div>
                    ))}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="bru-serif" style={{ fontSize: 14, lineHeight: 1.1 }}>{o.name || 'Outfit'}</div>
                    <div className="bru-mono" style={{ fontSize: 9, color: 'var(--mute)', marginTop: 2 }}>{o.items.length} PIECES</div>
                  </div>
                  <span className="bru-mono" style={{ fontSize: 10, color: 'var(--mute)' }}>{Math.round(o.score * 100)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CENTER: outfit display */}
        <div className="bru-card" style={{ display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div className="bru-mono" style={{ textAlign: 'center', padding: 60, color: 'var(--mute)' }}>LOADING…</div>
          ) : !current ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="bru-serif" style={{ fontSize: 22 }}>No outfits yet</div>
              <div className="bru-mono" style={{ fontSize: 10, color: 'var(--mute)', marginTop: 8 }}>ADD AT LEAST 3 PIECES TO YOUR WARDROBE</div>
              <button className="bru-btn bru-btn-accent" style={{ marginTop: 16 }} onClick={() => navigate('/add')}>+ Add item</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="bru-mono">{current.weather_temp ?? '—'}° · {current.items.length} PIECES</div>
                  <h2 className="bru-serif" style={{ fontSize: 32, margin: '4px 0 0' }}>{current.name || 'Today\'s look'}</h2>
                </div>
                <div className="bru-on-accent" style={{
                  width: 56, height: 56, borderRadius: '50%', background: 'var(--accent)',
                  display: 'grid', placeItems: 'center', fontFamily: 'Instrument Serif, serif',
                  fontSize: 22, fontWeight: 600, transform: 'rotate(-8deg)',
                }}>{Math.round(current.score * 100)}</div>
              </div>

              {/* Items grid */}
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginTop: 18, padding: '20px 0' }}>
                {current.items.map(it => (
                  <div key={it.id} style={{
                    aspectRatio: '1', display: 'grid', placeItems: 'center', position: 'relative',
                    border: '1px solid var(--line-soft)', padding: 8,
                  }}>
                    <ItemImage item={it} size={90} />
                    <div className="bru-mono" style={{ position: 'absolute', bottom: 4, left: 4, right: 4, fontSize: 8, color: 'var(--mute)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(it.subcategory || it.category).toUpperCase()}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Item names list */}
              <div style={{ borderTop: '1px solid var(--ink)', paddingTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {current.items.map(it => (
                  <span key={it.id} className="bru-tag" style={{ cursor: 'default' }}>{it.name}</span>
                ))}
              </div>

              {/* Cycling + actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18 }}>
                <button className="bru-btn" style={{ height: 36, padding: '0 14px' }} onClick={prev} disabled={outfits.length < 2}>‹</button>
                <span className="bru-mono" style={{ fontSize: 10, color: 'var(--mute)' }}>
                  {String(outfitIdx + 1).padStart(2, '0')} / {String(outfits.length).padStart(2, '0')}
                </span>
                <button className="bru-btn" style={{ height: 36, padding: '0 14px' }} onClick={next} disabled={outfits.length < 2}>›</button>
                <div style={{ flex: 1 }} />
                <button className="bru-btn" style={{ height: 36 }} onClick={regenerate} disabled={regenerating}>
                  {regenerating ? '…' : 'Try another'}
                </button>
                <button className="bru-btn bru-btn-accent" style={{ height: 36 }} onClick={saveOutfit} disabled={saving || saved}>
                  {saved ? '✓ Saved' : saving ? 'Saving…' : 'Wear today ⟶'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* RIGHT: score breakdown */}
        {current && (
          <div className="bru-card">
            <div className="bru-mono" style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6, marginBottom: 14 }}>SCORE BREAKDOWN</div>
            <ScoreBreakdown bd={current.score_breakdown || {}} />
          </div>
        )}
      </div>
    </div>
  )
}
