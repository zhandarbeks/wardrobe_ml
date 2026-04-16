import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const CATEGORIES = ['all', 'top', 'mid', 'outer', 'bottom', 'footwear', 'accessory']
const COLOR_HEX = {
  black: '#1a1a1a', white: '#f0f0f0', gray: '#888', navy: '#0a1e50',
  'royal blue': '#4169e1', 'sky blue': '#87ceeb', teal: '#008080',
  green: '#228b22', olive: '#6b8e23', yellow: '#ffd700', orange: '#ff8c00',
  red: '#c81e1e', burgundy: '#800020', pink: '#ff69b3', purple: '#800080',
  beige: '#f5f5dc', brown: '#8b4513', camel: '#c19a6b',
}

// Handles image_no_bg_url → image_url → emoji fallback chain
function ItemThumb({ item }) {
  const [src, setSrc] = useState(item.image_no_bg_url || item.image_url || null)
  const fallback = item.image_no_bg_url ? item.image_url : null

  if (!src) return <span style={{ fontSize: 52, opacity: .3 }}>👕</span>

  return (
    <img
      className="thumb"
      src={src}
      alt={item.name}
      onError={() => {
        if (fallback && src !== fallback) setSrc(fallback)
        else setSrc(null)
      }}
    />
  )
}

export default function Wardrobe() {
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/v1/wardrobe')
      setItems(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = items.filter(i => {
    if (filter !== 'all' && i.category !== filter) return false
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const deleteItem = async id => {
    if (!confirm('Remove this item from your wardrobe?')) return
    await api.delete(`/api/v1/wardrobe/items/${id}`)
    load()
  }

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-16">
        <h1 style={{ margin: 0 }}>My Wardrobe ({filtered.length})</h1>
        <button className="btn btn-primary" onClick={() => navigate('/add')}>+ Add Item</button>
      </div>

      {/* Filters */}
      <div className="flex gap-8 mb-16" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, width: 180, fontSize: 14 }}
        />
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`btn btn-sm ${filter === c ? 'btn-primary' : 'btn-secondary'}`}
            style={{ textTransform: 'capitalize' }}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="card text-center" style={{ padding: 40 }}>
          <p className="text-gray">
            {items.length === 0 ? "Your wardrobe is empty." : "No items match the filter."}
          </p>
          {items.length === 0 && (
            <button className="btn btn-primary mt-16" onClick={() => navigate('/add')}>
              Add your first item
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-4">
          {filtered.map(item => (
            <div key={item.id} className="item-card">
              <div style={{
                width: '100%', height: 180, background: '#f8f8f8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                <ItemThumb item={item} />
              </div>
              <div className="info">
                <h4>{item.name}</h4>
                <div className="meta">
                  <span
                    className="dot"
                    style={{ background: COLOR_HEX[item.color?.toLowerCase()] || '#ccc' }}
                    title={item.color}
                  />
                  <span className="tag">{item.category}</span>
                  <span className="tag">{item.temp_min}°~{item.temp_max}°</span>
                </div>
                {item.brand && (
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{item.brand}</div>
                )}
                <button
                  className="btn btn-danger btn-sm"
                  style={{ marginTop: 10, width: '100%' }}
                  onClick={() => deleteItem(item.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
