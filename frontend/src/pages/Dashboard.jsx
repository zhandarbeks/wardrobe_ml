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

// Collage grid: top-layer items side by side, bottom full-width, footwear+accessory small row
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
  const [city,            setCity]            = useState('')
  const [showCityInput,   setShowCityInput]   = useState(false)
  const [geoLoading,      setGeoLoading]      = useState(false)
  const [citySuggestions, setCitySuggestions] = useState([])
  const searchTimer = useRef(null)
  const navigate    = useNavigate()

  const load = async () => {
    setLoading(true)
    setSaved(false)
    try {
      const [wRes, oRes, sRes] = await Promise.all([
        api.get('/api/v1/weather/current'),
        api.get('/api/v1/outfits/recommend'),
        api.get('/api/v1/wardrobe/stats').catch(() => ({ data: null })),
      ])
      setStats(sRes.data)
      setWeather(wRes.data)
      setOutfits(oRes.data.outfits || [])
      setOutfitIdx(0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

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
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT COLUMN ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Weather */}
          <div className="weather">
            {weather ? (
              <>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="temp">{Math.round(weather.temp ?? 15)}°C</div>
                    <div className="desc">{weather.description}</div>
                    <div style={{ marginTop: 8, opacity: .7, fontSize: 13 }}>
                      Feels like {Math.round(weather.feels_like ?? 15)}°C
                      &nbsp;·&nbsp;
                      {Math.round(weather.wind_speed ?? 0)} m/s
                    </div>
                    <div style={{ marginTop: 4, opacity: .7, fontSize: 13 }}>{weather.city || '—'}</div>
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
                        onKeyDown={e => e.key === 'Enter' && setUserCity()}
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
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            {s.name}{s.state ? `, ${s.state}` : ''}, {s.country}
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
            <button className="btn btn-secondary" onClick={load}>🔄 Refresh</button>
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
                <div style={statBox}>
                  <div style={statLabel}>SCORE</div>
                  <div style={statVal}>⭐ {current.score.toFixed(2)}</div>
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
                  {regenerating ? '⏳ Generating…' : '🔄 Regenerate'}
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={saveOutfit}
                  disabled={saving || saved}
                >
                  {saved ? '✅ Saved!' : saving ? '…' : '💾 Save outfit'}
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
