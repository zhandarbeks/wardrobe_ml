import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const FILTER_CATEGORIES = ['all', 'top', 'mid', 'outer', 'bottom', 'footwear', 'accessory']
const EDIT_CATEGORIES   = ['top', 'mid', 'outer', 'bottom', 'footwear', 'accessory']

const CATEGORY_LABEL = {
  top: 'Top', mid: 'Mid layer', outer: 'Outer',
  bottom: 'Bottom', footwear: 'Footwear', accessory: 'Accessory',
}

const SUBCATEGORY_OPTIONS = {
  top:       ['t-shirt', 'shirt', 'top', 'polo', 'tank top'],
  mid:       ['sweater', 'sweatshirt'],
  outer:     ['jacket', 'blazer'],
  bottom:    ['jeans', 'trousers', 'shorts', 'skirt', 'leggings', 'track pants', 'joggers'],
  footwear:  ['casual shoes', 'sports shoes', 'formal shoes', 'heels', 'flats', 'sandals'],
  accessory: ['watch', 'sunglasses', 'belt', 'backpack'],
}

const COLORS = [
  'black', 'white', 'gray', 'navy', 'royal blue', 'sky blue',
  'teal', 'green', 'olive', 'yellow', 'orange', 'red',
  'burgundy', 'pink', 'purple', 'beige', 'brown', 'camel',
]

const MATERIALS = [
  'cotton', 'wool', 'polyester', 'denim', 'leather',
  'silk', 'linen', 'synthetic', 'fleece', 'down', 'knit',
]

const STYLES_LIST = ['casual', 'sport', 'business', 'formal', 'streetwear', 'outdoor']

const COLOR_HEX = {
  black: '#1a1a1a', white: '#f0f0f0', gray: '#888', navy: '#0a1e50',
  'royal blue': '#4169e1', 'sky blue': '#87ceeb', teal: '#008080',
  green: '#228b22', olive: '#6b8e23', yellow: '#ffd700', orange: '#ff8c00',
  red: '#c81e1e', burgundy: '#800020', pink: '#ff69b3', purple: '#800080',
  beige: '#f5f5dc', brown: '#8b4513', camel: '#c19a6b',
}

// ── image thumb with fallback chain ──────────────────────────────────────────
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

// ── edit modal ────────────────────────────────────────────────────────────────
function EditModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:        item.name        || '',
    category:    item.category    || 'top',
    subcategory: item.subcategory || '',
    color:       item.color       || 'black',
    material:    item.material    || '',
    brand:       item.brand       || '',
    styles:      item.styles      || '',
    temp_min:    item.temp_min    ?? -5,
    temp_max:    item.temp_max    ?? 25,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleStyle = name => {
    const cur = form.styles ? form.styles.split(',').map(s => s.trim()).filter(Boolean) : []
    const upd = cur.includes(name) ? cur.filter(s => s !== name) : [...cur, name]
    set('styles', upd.join(','))
  }
  const activeStyles = form.styles ? form.styles.split(',').map(s => s.trim()).filter(Boolean) : []

  const save = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      await api.patch(`/api/v1/wardrobe/items/${item.id}`, {
        name:        form.name.trim(),
        category:    form.category,
        subcategory: form.subcategory || null,
        color:       form.color,
        material:    form.material || null,
        brand:       form.brand    || null,
        styles:      form.styles   || null,
        temp_min:    Number(form.temp_min),
        temp_max:    Number(form.temp_max),
      })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Edit Item</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#666' }}
          >✕</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={save}>
          {/* Name */}
          <div className="form-group">
            <label>Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>

          {/* Category + Subcategory */}
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Category *</label>
              <select
                value={form.category}
                onChange={e => { set('category', e.target.value); set('subcategory', '') }}
              >
                {EDIT_CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Subcategory</label>
              <select value={form.subcategory} onChange={e => set('subcategory', e.target.value)}>
                <option value="">— select —</option>
                {(SUBCATEGORY_OPTIONS[form.category] || []).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Color */}
          <div className="form-group mt-16">
            <label>Colour *</label>
            <select value={form.color} onChange={e => set('color', e.target.value)}>
              {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Material */}
          <div className="form-group">
            <label>Material</label>
            <select value={form.material} onChange={e => set('material', e.target.value)}>
              <option value="">— not specified —</option>
              {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Brand */}
          <div className="form-group">
            <label>Brand</label>
            <input value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="optional" />
          </div>

          {/* Styles */}
          <div className="form-group">
            <label>Style</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {STYLES_LIST.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStyle(s)}
                  style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                    border: '1px solid #ccc',
                    background: activeStyles.includes(s) ? '#2563eb' : '#f3f4f6',
                    color:      activeStyles.includes(s) ? '#fff'    : '#374151',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Temp range */}
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Temp min (°C)</label>
              <input type="number" value={form.temp_min} onChange={e => set('temp_min', e.target.value)} min={-40} max={40} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Temp max (°C)</label>
              <input type="number" value={form.temp_max} onChange={e => set('temp_max', e.target.value)} min={-40} max={50} />
            </div>
          </div>

          <div className="flex gap-8" style={{ marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function Wardrobe() {
  const [items,    setItems]    = useState([])
  const [filter,   setFilter]   = useState('all')
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const [editing,  setEditing]  = useState(null)   // item being edited
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
        {FILTER_CATEGORIES.map(c => (
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
            {items.length === 0 ? 'Your wardrobe is empty.' : 'No items match the filter.'}
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
                  {item.subcategory && <span className="tag">{item.subcategory}</span>}
                  <span className="tag">{item.temp_min}°~{item.temp_max}°</span>
                </div>
                {item.brand && (
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{item.brand}</div>
                )}
                {item.styles && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{item.styles}</div>
                )}
                <div className="flex gap-8" style={{ marginTop: 10 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => setEditing(item)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => deleteItem(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditModal
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}
