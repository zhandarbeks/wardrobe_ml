import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const FILTER_CATEGORIES = ['all', 'top', 'mid', 'outer', 'bottom', 'footwear', 'accessory']
const EDIT_CATEGORIES   = ['top', 'mid', 'outer', 'bottom', 'footwear', 'accessory']
const SEASONS = ['all', 'spring', 'summer', 'autumn', 'winter']

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
const MATERIALS = ['cotton', 'wool', 'polyester', 'denim', 'leather', 'silk', 'linen', 'synthetic', 'fleece', 'down', 'knit']
const STYLES_LIST = ['casual', 'smart casual', 'business', 'sport', 'streetwear', 'formal']

const COLOR_HEX = {
  black: '#1a1a1a', white: '#f0f0f0', gray: '#888', navy: '#0a1e50',
  'royal blue': '#4169e1', 'sky blue': '#87ceeb', teal: '#008080',
  green: '#228b22', olive: '#6b8e23', yellow: '#ffd700', orange: '#ff8c00',
  red: '#c81e1e', burgundy: '#800020', pink: '#ff69b3', purple: '#800080',
  beige: '#e8dcc8', brown: '#8b4513', camel: '#c19a6b',
}

// Derive season from temp range (production has WardrobeItem.season field
// but it's often empty; fall back to inferring from temp_max).
function seasonOf(item) {
  if (item.season) return item.season.toLowerCase()
  const max = item.temp_max ?? 25
  if (max <= 10) return 'winter'
  if (max <= 18) return 'autumn'
  if (max <= 25) return 'spring'
  return 'summer'
}

function ItemImg({ item, size = 160 }) {
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

// ── Edit modal (brutalist) ─────────────────────────────────────────────
function EditModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: item.name || '', category: item.category || 'top', subcategory: item.subcategory || '',
    color: item.color || 'black', material: item.material || '', brand: item.brand || '',
    styles: item.styles || '', temp_min: item.temp_min ?? -5, temp_max: item.temp_max ?? 25,
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
    setSaving(true); setError('')
    try {
      await api.patch(`/api/v1/wardrobe/items/${item.id}`, {
        name: form.name.trim(), category: form.category,
        subcategory: form.subcategory || null, color: form.color,
        material: form.material || null, brand: form.brand || null,
        styles: form.styles || null,
        temp_min: Number(form.temp_min), temp_max: Number(form.temp_max),
      })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save')
    } finally { setSaving(false) }
  }
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', padding: 24, background: 'var(--paper)', border: '2px solid var(--ink)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className="bru-mono">EDIT ITEM</div>
            <div className="bru-serif" style={{ fontSize: 28, marginTop: 4 }}>{item.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--mute)' }}>✕</button>
        </div>
        {error && <div className="bru-on-accent" style={{ marginTop: 14, padding: 8, background: 'var(--accent)' }}><div className="bru-mono" style={{ fontSize: 10 }}>⚠ {error}</div></div>}
        <form onSubmit={save} style={{ marginTop: 18 }}>
          <div style={{ marginBottom: 12 }}>
            <label className="bru-label">Name *</label>
            <input className="bru-input" value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="bru-label">Category *</label>
              <select className="bru-select" value={form.category} onChange={e => { set('category', e.target.value); set('subcategory', '') }}>
                {EDIT_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="bru-label">Subcategory</label>
              <select className="bru-select" value={form.subcategory} onChange={e => set('subcategory', e.target.value)}>
                <option value="">— select —</option>
                {(SUBCATEGORY_OPTIONS[form.category] || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="bru-label">Colour *</label>
              <select className="bru-select" value={form.color} onChange={e => set('color', e.target.value)}>
                {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="bru-label">Material</label>
              <select className="bru-select" value={form.material} onChange={e => set('material', e.target.value)}>
                <option value="">— not specified —</option>
                {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="bru-label">Brand</label>
            <input className="bru-input" value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="optional" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="bru-label">Style</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {STYLES_LIST.map(s => (
                <span key={s} onClick={() => toggleStyle(s)} className={'bru-tag' + (activeStyles.includes(s) ? ' on' : '')} style={{ cursor: 'pointer' }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label className="bru-label">Temp min (°C)</label>
              <input className="bru-input" type="number" value={form.temp_min} onChange={e => set('temp_min', e.target.value)} min={-40} max={40} />
            </div>
            <div>
              <label className="bru-label">Temp max (°C)</label>
              <input className="bru-input" type="number" value={form.temp_max} onChange={e => set('temp_max', e.target.value)} min={-40} max={50} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="bru-btn" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button type="submit" className="bru-btn bru-btn-accent" style={{ flex: 1 }} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes ⟶'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function Wardrobe() {
  const [items,    setItems]    = useState([])
  const [filter,   setFilter]   = useState('all')
  const [season,   setSeason]   = useState('all')
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const [editing,  setEditing]  = useState(null)
  const navigate = useNavigate()

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const { data } = await api.get('/api/v1/wardrobe')
      setItems(data)
    } finally { if (!silent) setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = items.filter(i => {
    if (filter !== 'all' && i.category !== filter) return false
    if (season !== 'all' && seasonOf(i) !== season) return false
    if (search) {
      const q = search.toLowerCase()
      if (!i.name.toLowerCase().includes(q)
          && !(i.subcategory || '').toLowerCase().includes(q)
          && !(i.color || '').toLowerCase().includes(q)
          && !(i.brand || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const deleteItem = async id => {
    if (!confirm('Remove this item from your wardrobe?')) return
    const prev = items
    setItems(prev.filter(i => i.id !== id))
    try {
      await api.delete(`/api/v1/wardrobe/items/${id}`)
    } catch (err) {
      setItems(prev)
      alert(err.response?.data?.detail || `Could not delete item (status ${err.response?.status || '?'}).`)
    }
  }

  // Per-category counts for chips
  const byCat = items.reduce((m, i) => { m[i.category] = (m[i.category] || 0) + 1; return m }, {})

  return (
    <div className="bru-page">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '2px solid var(--ink)', paddingBottom: 14 }}>
        <div>
          <div className="bru-mono">INVENTORY</div>
          <div className="bru-serif" style={{ fontSize: 64, lineHeight: 0.95 }}>The <em style={{ color: 'var(--accent)' }}>wardrobe</em>.</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="bru-mono">TOTAL ON FILE</div>
          <div className="bru-serif" style={{ fontSize: 48, lineHeight: 1 }}>{items.length}</div>
          <button className="bru-btn bru-btn-accent" style={{ marginTop: 8 }} onClick={() => navigate('/add')}>+ Add piece</button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 14, paddingBottom: 10, borderBottom: '1px solid var(--ink)' }}>
        {FILTER_CATEGORIES.map(c => (
          <span key={c} onClick={() => setFilter(c)} className={'bru-tag' + (filter === c ? ' on' : '')} style={{ cursor: 'pointer' }}>
            {c.toUpperCase()} · {String(c === 'all' ? items.length : (byCat[c] || 0)).padStart(2, '0')}
          </span>
        ))}
        <div style={{ flex: 1 }} />
        <input className="bru-input" placeholder="SEARCH ↵" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220, height: 32, fontSize: 11 }} />
      </div>

      {/* Season filter */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10 }}>
        <span className="bru-mono" style={{ color: 'var(--mute)', marginRight: 4 }}>SEASON</span>
        {SEASONS.map(s => (
          <span key={s} onClick={() => setSeason(s)} className={'bru-tag' + (season === s ? ' on' : '')} style={{ cursor: 'pointer' }}>
            {s.toUpperCase()}
          </span>
        ))}
        <span className="bru-mono" style={{ marginLeft: 'auto', color: 'var(--mute)' }}>
          {filtered.length} OF {items.length}
        </span>
      </div>

      {loading ? (
        <div className="bru-mono" style={{ textAlign: 'center', padding: 60, color: 'var(--mute)' }}>LOADING…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, border: '1.5px dashed var(--line-soft)', marginTop: 20 }}>
          <div className="bru-serif" style={{ fontSize: 22 }}>
            {items.length === 0 ? 'Your wardrobe is empty' : 'No matches'}
          </div>
          {items.length === 0 && (
            <button className="bru-btn bru-btn-accent" style={{ marginTop: 16 }} onClick={() => navigate('/add')}>Add your first piece</button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginTop: 18 }}>
          {filtered.map(item => (
            <div key={item.id} style={{ border: '1.5px solid var(--ink)', display: 'flex', flexDirection: 'column', background: 'var(--paper)' }}>
              <div style={{ aspectRatio: '1', display: 'grid', placeItems: 'center', padding: 12 }}>
                <ItemImg item={item} size={160} />
              </div>
              <div style={{ padding: '10px 12px', borderTop: '1.5px solid var(--ink)' }}>
                <div className="bru-serif" style={{ fontSize: 16, lineHeight: 1.1 }}>{item.name}</div>
                <div className="bru-mono" style={{ marginTop: 4, fontSize: 9 }}>
                  {item.subcategory || item.category} · {item.color} · {item.temp_min}°—{item.temp_max}°
                </div>
                {item.brand && <div className="bru-mono" style={{ marginTop: 2, fontSize: 9, color: 'var(--mute)' }}>{item.brand.toUpperCase()}</div>}
              </div>
              <div style={{ display: 'flex', borderTop: '1.5px solid var(--ink)', marginTop: 'auto' }}>
                <button className="bru-btn" style={{ flex: 1, height: 30, fontSize: 9, padding: 0, border: 'none', borderRight: '1.5px solid var(--ink)' }} onClick={() => setEditing(item)}>EDIT</button>
                <button className="bru-btn" style={{ flex: 1, height: 30, fontSize: 9, padding: 0, border: 'none' }} onClick={() => deleteItem(item.id)}>DELETE</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditModal item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load({ silent: true }) }} />
      )}
    </div>
  )
}
