import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function Dashboard() {
  const [weather, setWeather] = useState(null)
  const [outfits, setOutfits] = useState([])
  const [loading, setLoading] = useState(true)
  const [outfitIdx, setOutfitIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [city, setCity] = useState('')
  const [showCityInput, setShowCityInput] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [citySuggestions, setCitySuggestions] = useState([])
  const searchTimer = useRef(null)
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const load = async () => {
    setLoading(true)
    setSaved(false)
    try {
      const [wRes, oRes] = await Promise.all([
        api.get('/api/v1/weather/current'),
        api.get('/api/v1/outfits/recommend'),
      ])
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
      async (pos) => {
        try {
          await api.post('/api/v1/weather/location', {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          })
          setShowCityInput(false)
          load()
        } catch (e) {
          console.error(e)
        } finally {
          setGeoLoading(false)
        }
      },
      () => setGeoLoading(false),
      { timeout: 10000 }
    )
  }

  const handleCityInput = (val) => {
    setCity(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!val.trim() || val.length < 2) {
      setCitySuggestions([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/api/v1/weather/search?q=${encodeURIComponent(val)}`)
        setCitySuggestions(res.data || [])
      } catch {
        setCitySuggestions([])
      }
    }, 400)
  }

  const pickSuggestion = async (s) => {
    setCitySuggestions([])
    setCity('')
    setShowCityInput(false)
    await api.post('/api/v1/weather/location', { lat: s.lat, lon: s.lon })
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

      <div className="grid grid-2" style={{ marginBottom: 24, alignItems: 'start' }}>
        {/* Weather card */}
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
                  <img
                    src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                    width={64}
                    alt=""
                  />
                )}
              </div>

              <div className="flex gap-8" style={{ marginTop: 14 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setShowCityInput(v => !v); setCitySuggestions([]) }}
                >
                  Change city
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={detectLocation}
                  disabled={geoLoading}
                >
                  {geoLoading ? '…' : 'Detect'}
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
                      border: '1px solid rgba(255,255,255,.15)', zIndex: 20,
                      overflow: 'hidden',
                    }}>
                      {citySuggestions.map((s, i) => (
                        <div
                          key={i}
                          onClick={() => pickSuggestion(s)}
                          style={{
                            padding: '9px 12px', cursor: 'pointer', fontSize: 13,
                            color: '#fff', borderBottom: i < citySuggestions.length - 1
                              ? '1px solid rgba(255,255,255,.08)' : 'none',
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

        {/* Quick actions */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Quick Actions</h2>
          <button className="btn btn-primary" onClick={() => navigate('/add')}>
            Add Clothes
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/wardrobe')}>
            View Wardrobe
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/outfits')}>
            Saved Outfits
          </button>
          <button className="btn btn-secondary" onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      {/* Outfit recommendation */}
      <h2>Today's Outfit Recommendation</h2>

      {loading ? (
        <div className="card text-center text-gray" style={{ padding: 40 }}>
          Generating outfit for the current weather…
        </div>
      ) : !current ? (
        <div className="card text-center" style={{ padding: 40 }}>
          <p className="text-gray">No outfit suggestions yet — your wardrobe might be empty.</p>
          <button className="btn btn-primary mt-16" onClick={() => navigate('/add')}>
            Add clothes to get started →
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="flex justify-between items-center mb-16" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div className="flex gap-8">
              <span className="tag">⭐ Score: {current.score.toFixed(2)}</span>
              <span className="tag">🌡 T target: {current.t_target}°C</span>
              <span className="tag">{outfits.length} option{outfits.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
              {outfits.length > 1 && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setOutfitIdx(i => (i + 1) % outfits.length); setSaved(false) }}
                >
                  Next option ({outfitIdx + 1}/{outfits.length})
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={load}>🔄 Regenerate</button>
              <button
                className="btn btn-primary btn-sm"
                onClick={saveOutfit}
                disabled={saving || saved}
              >
                {saved ? '✅ Saved!' : saving ? '…' : '💾 Save outfit'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-12">
            {current.items.map(item => (
              <div key={item.id} style={{ textAlign: 'center', width: 90 }}>
                <div style={{
                  width: 90, height: 90, borderRadius: 12,
                  background: '#f8f8f8', overflow: 'hidden',
                  border: '1px solid #eee', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.image_no_bg_url || item.image_url ? (
                    <img
                      src={item.image_no_bg_url || item.image_url}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none' }}
                      alt={item.name}
                    />
                  ) : (
                    <span style={{ fontSize: 32 }}>👕</span>
                  )}
                </div>
                <div style={{
                  fontSize: 11, color: '#555', marginTop: 6,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', maxWidth: 90,
                }}>
                  {item.name}
                </div>
                <span className="tag" style={{ fontSize: 10, marginTop: 2 }}>{item.category}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
