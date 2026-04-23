import { useEffect, useMemo, useState } from 'react'
import api from '../api'

const CAT_ORDER = { outer: 0, top: 1, mid: 2, bottom: 3, footwear: 4, accessory: 5 }
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December']

// local YYYY-MM-DD (not UTC) — matches what the user actually wore
const dateKey = d => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

function Thumb({ item, size = 56 }) {
  const [src, setSrc] = useState(item.image_no_bg_url || item.image_url || null)
  const fallback = item.image_no_bg_url ? item.image_url : null
  return (
    <div style={{
      width: size, height: size, borderRadius: 8, flexShrink: 0,
      background: '#f5f5f5', border: '1px solid #eee', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {src ? (
        <img
          src={src} alt={item.name}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onError={() => { if (fallback && src !== fallback) setSrc(fallback); else setSrc(null) }}
        />
      ) : (
        <span style={{ fontSize: size * 0.4, opacity: .3 }}>👕</span>
      )}
    </div>
  )
}

export default function History() {
  const [outfits, setOutfits] = useState([])
  const [loading, setLoading] = useState(true)
  const [cursor,  setCursor]  = useState(() => {
    const d = new Date(); d.setDate(1); return d
  })
  const [selectedKey, setSelectedKey] = useState(dateKey(new Date()))

  useEffect(() => {
    api.get('/api/v1/outfits')
      .then(r => setOutfits(r.data))
      .finally(() => setLoading(false))
  }, [])

  // group worn outfits by YYYY-MM-DD
  const byDate = useMemo(() => {
    const m = {}
    for (const o of outfits) {
      if (!o.used_at) continue
      const k = dateKey(o.used_at)
      if (!m[k]) m[k] = []
      m[k].push(o)
    }
    return m
  }, [outfits])

  // summary stats
  const stats = useMemo(() => {
    const total = Object.keys(byDate).length
    const now = new Date()
    const thirty = new Date(now); thirty.setDate(now.getDate() - 29)
    let last30 = 0
    for (const k of Object.keys(byDate)) {
      if (new Date(k) >= thirty) last30 += 1
    }
    return { total, last30 }
  }, [byDate])

  // calendar grid for `cursor` month — 6 weeks × 7 days
  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    // Monday-based offset: JS getDay() 0=Sun..6=Sat → convert to 0=Mon..6=Sun
    const offset = (first.getDay() + 6) % 7
    const start = new Date(first); start.setDate(first.getDate() - offset)
    const cells = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i)
      cells.push(d)
    }
    return cells
  }, [cursor])

  const selectedOutfits = byDate[selectedKey] || []
  const todayKey = dateKey(new Date())

  const prevMonth = () => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))
  const nextMonth = () => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))
  const thisMonth = () => setCursor(() => {
    const d = new Date(); d.setDate(1); return d
  })

  return (
    <div className="page" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <h1>Wear History</h1>

      {/* summary */}
      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card text-center">
          <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.total}</div>
          <div className="text-sm text-gray">Days worn (total)</div>
        </div>
        <div className="card text-center">
          <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.last30}</div>
          <div className="text-sm text-gray">Last 30 days</div>
        </div>
        <div className="card text-center">
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {outfits.filter(o => o.used_at).length}
          </div>
          <div className="text-sm text-gray">Outfit wears logged</div>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>

        {/* month nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button className="btn btn-sm btn-secondary" onClick={prevMonth}>‹</button>
          <div style={{ fontSize: 18, fontWeight: 700, flex: 1, textAlign: 'center' }}>
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </div>
          <button className="btn btn-sm btn-secondary" onClick={thisMonth}>Today</button>
          <button className="btn btn-sm btn-secondary" onClick={nextMonth}>›</button>
        </div>

        {/* weekday header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
          {WEEK.map(w => (
            <div key={w} style={{ fontSize: 11, fontWeight: 600, color: '#999', textAlign: 'center', letterSpacing: '.06em' }}>
              {w.toUpperCase()}
            </div>
          ))}
        </div>

        {/* grid */}
        {loading ? (
          <p className="text-gray">Loading…</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {grid.map((d, i) => {
              const key        = dateKey(d)
              const outOfMonth = d.getMonth() !== cursor.getMonth()
              const wornList   = byDate[key] || []
              const count      = wornList.length
              const isToday    = key === todayKey
              const isSelected = key === selectedKey

              // heatmap intensity
              const bg = count === 0 ? (outOfMonth ? '#fafafa' : '#fff')
                       : count === 1 ? '#bbf7d0'
                       : count === 2 ? '#86efac'
                       :                '#4ade80'
              const fg = count >= 2 ? '#14532d' : outOfMonth ? '#ccc' : '#333'

              return (
                <div
                  key={i}
                  onClick={() => setSelectedKey(key)}
                  style={{
                    aspectRatio: '1', borderRadius: 8, cursor: 'pointer',
                    border: `2px solid ${isSelected ? '#1a1a1a' : isToday ? '#3b82f6' : '#eee'}`,
                    background: bg, color: fg,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: 4, transition: 'border-color .1s',
                    opacity: outOfMonth ? .5 : 1,
                  }}
                  title={count ? `${count} outfit${count > 1 ? 's' : ''} worn` : 'No outfits'}
                >
                  <div style={{ fontSize: 14, fontWeight: isToday ? 700 : 500 }}>{d.getDate()}</div>
                  {count > 0 && (
                    <div style={{ fontSize: 10, opacity: .7, marginTop: 2 }}>
                      {count > 1 ? `${count}×` : '●'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: '#888', flexWrap: 'wrap' }}>
          <span>Less</span>
          {['#fff', '#bbf7d0', '#86efac', '#4ade80'].map(c => (
            <div key={c} style={{ width: 14, height: 14, borderRadius: 3, background: c, border: '1px solid #e5e5e5' }} />
          ))}
          <span>More</span>
          <span style={{ marginLeft: 'auto', color: '#3b82f6' }}>■ Today</span>
        </div>
      </div>

      {/* selected day panel */}
      <div className="card" style={{ padding: 20, marginTop: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
          {new Date(selectedKey).toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })}
        </div>

        {selectedOutfits.length === 0 ? (
          <p className="text-gray text-sm">No outfits were worn on this day.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {selectedOutfits.map(o => {
              const sorted = [...o.items].sort(
                (a, b) => (CAT_ORDER[a.category] ?? 9) - (CAT_ORDER[b.category] ?? 9)
              )
              return (
                <div key={o.id} style={{
                  borderTop: '1px solid #f0f0f0', paddingTop: 14,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{o.name}</div>
                    <span className="tag">{o.is_auto_generated ? '🤖 Auto' : '✋ Manual'}</span>
                    {o.weather_temp != null && <span className="tag">{o.weather_temp}°C</span>}
                    <span className="tag">{o.items.length} items</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {sorted.map(item => (
                      <div key={item.id} style={{ textAlign: 'center', width: 70 }}>
                        <Thumb item={item} size={60} />
                        <div style={{ fontSize: 10, marginTop: 3, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: 9, color: '#aaa', textTransform: 'capitalize' }}>
                          {item.category}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
