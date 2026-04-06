import { useEffect, useState } from 'react'
import api from '../api'

export default function Outfits() {
  const [outfits, setOutfits] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const { data } = await api.get('/api/v1/outfits')
      setOutfits(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const deleteOutfit = async id => {
    if (!confirm('Delete this outfit?')) return
    await api.delete(`/api/v1/outfits/${id}`)
    load()
  }

  return (
    <div className="page">
      <h1>Saved Outfits ({outfits.length})</h1>

      {loading ? (
        <p className="text-gray">Loading…</p>
      ) : outfits.length === 0 ? (
        <div className="card text-center" style={{ padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🗂</div>
          <p className="text-gray">No saved outfits yet.</p>
          <p className="text-sm text-gray mt-8">
            Generate one from the Dashboard and press "Save outfit".
          </p>
        </div>
      ) : (
        <div className="grid grid-3">
          {outfits.map(o => (
            <div key={o.id} className="outfit-card">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3>{o.name}</h3>
                  <div className="text-sm text-gray">
                    {new Date(o.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                  {o.score != null && (
                    <span className="tag">⭐ {o.score.toFixed(2)}</span>
                  )}
                  {o.weather_temp != null && (
                    <span className="tag">🌡 {o.weather_temp}°C</span>
                  )}
                </div>
              </div>

              {/* Item thumbnails */}
              <div className="flex flex-wrap gap-8" style={{ marginBottom: 12 }}>
                {o.items.map(item => (
                  <div key={item.id} style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 8,
                      background: '#f8f8f8', overflow: 'hidden',
                      border: '1px solid #eee',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {item.image_no_bg_url || item.image_url ? (
                        <img
                          src={item.image_no_bg_url || item.image_url}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { e.target.style.display = 'none' }}
                          alt={item.name}
                        />
                      ) : (
                        <span style={{ fontSize: 22, opacity: .4 }}>👕</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{item.category}</div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center">
                <span className="tag">
                  {o.is_auto_generated ? '🤖 Auto-generated' : '✋ Manual'}
                </span>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => deleteOutfit(o.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
