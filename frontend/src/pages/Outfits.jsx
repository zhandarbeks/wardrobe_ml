import { useEffect, useState } from 'react'
import api from '../api'

const CAT_ORDER = { outer: 0, top: 1, mid: 2, bottom: 3, footwear: 4, accessory: 5 }

// ── small image with fallback ─────────────────────────────────────────────────
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

// ── outfit builder / editor modal ────────────────────────────────────────────
function OutfitModal({ outfit, onClose, onSaved }) {
  const [wardrobeItems, setWardrobeItems] = useState([])
  const [selected, setSelected]           = useState(
    outfit ? new Set(outfit.items.map(i => i.id)) : new Set()
  )
  const [name, setName]       = useState(outfit?.name || '')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [catFilter, setCatFilter] = useState('all')

  useEffect(() => {
    api.get('/api/v1/wardrobe').then(r => setWardrobeItems(r.data))
  }, [])

  const toggle = id => setSelected(s => {
    const n = new Set(s)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const filtered = wardrobeItems.filter(i => catFilter === 'all' || i.category === catFilter)

  // warn if duplicate layer
  const layerCount = {}
  for (const id of selected) {
    const item = wardrobeItems.find(i => i.id === id)
    if (item) layerCount[item.category] = (layerCount[item.category] || 0) + 1
  }
  const dupeWarning = Object.entries(layerCount).find(([, c]) => c > 1)

  const save = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    if (selected.size === 0) { setError('Select at least one item'); return }
    setSaving(true)
    setError('')
    try {
      const item_ids = [...selected].join(',')
      if (outfit) {
        await api.patch(`/api/v1/outfits/${outfit.id}`, { name: name.trim(), item_ids })
      } else {
        await api.post('/api/v1/outfits', {
          name: name.trim(), item_ids,
          is_auto_generated: false,
        })
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const CATS = ['all', 'top', 'mid', 'outer', 'bottom', 'footwear', 'accessory']

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>

        {/* header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0, flex: 1 }}>{outfit ? 'Edit Outfit' : 'Create Outfit'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

          {/* name */}
          <div className="form-group">
            <label>Outfit name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Casual Friday" />
          </div>

          {/* selected preview */}
          {selected.size > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#999', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                Selected ({selected.size})
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[...selected].map(id => {
                  const item = wardrobeItems.find(i => i.id === id)
                  if (!item) return null
                  return (
                    <div key={id} style={{ position: 'relative' }}>
                      <Thumb item={item} size={52} />
                      <button
                        onClick={() => toggle(id)}
                        style={{
                          position: 'absolute', top: -6, right: -6,
                          width: 18, height: 18, borderRadius: '50%',
                          background: '#dc2626', color: '#fff',
                          border: 'none', cursor: 'pointer',
                          fontSize: 10, lineHeight: '18px', padding: 0,
                        }}
                      >✕</button>
                    </div>
                  )
                })}
              </div>
              {dupeWarning && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#d97706' }}>
                  ⚠ Multiple items in layer "{dupeWarning[0]}" — only one will be saved per layer
                </div>
              )}
            </div>
          )}

          {/* category filter */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {CATS.map(c => (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                style={{
                  padding: '4px 12px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
                  border: '1px solid #ddd',
                  background: catFilter === c ? '#1a1a1a' : '#f5f5f5',
                  color: catFilter === c ? '#fff' : '#555',
                  textTransform: 'capitalize',
                }}
              >{c}</button>
            ))}
          </div>

          {/* wardrobe grid */}
          {wardrobeItems.length === 0 ? (
            <p className="text-gray text-sm">Loading wardrobe…</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {filtered.sort((a, b) => (CAT_ORDER[a.category] ?? 9) - (CAT_ORDER[b.category] ?? 9)).map(item => {
                const active = selected.has(item.id)
                return (
                  <div
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    style={{
                      borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                      border: `2px solid ${active ? '#1a1a1a' : '#eee'}`,
                      background: active ? '#f0f0f0' : '#fafafa',
                      transition: 'border-color .1s',
                    }}
                  >
                    <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
                      <Thumb item={item} size={70} />
                    </div>
                    <div style={{ padding: '6px 8px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                      <div style={{ fontSize: 10, color: '#999', textTransform: 'capitalize', marginTop: 2 }}>{item.category}</div>
                    </div>
                    {active && (
                      <div style={{ background: '#1a1a1a', textAlign: 'center', padding: '3px 0', fontSize: 11, color: '#fff' }}>✓ Added</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : outfit ? 'Save Changes' : 'Create Outfit'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── outfit card ───────────────────────────────────────────────────────────────
function OutfitCard({ outfit, onEdit, onDelete }) {
  const sorted = [...outfit.items].sort((a, b) => (CAT_ORDER[a.category] ?? 9) - (CAT_ORDER[b.category] ?? 9))

  return (
    <div className="outfit-card">
      {/* item collage row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {sorted.map(item => (
          <div key={item.id} style={{ textAlign: 'center' }}>
            <Thumb item={item} size={60} />
            <div style={{ fontSize: 9, color: '#aaa', marginTop: 3, textTransform: 'capitalize' }}>{item.category}</div>
          </div>
        ))}
      </div>

      {/* name + date */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{outfit.name}</div>
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
          {new Date(outfit.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>

      {/* tags */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <span className="tag">{outfit.is_auto_generated ? '🤖 Auto' : '✋ Manual'}</span>
        {outfit.score != null && <span className="tag">⭐ {outfit.score.toFixed(2)}</span>}
        {outfit.weather_temp != null && <span className="tag">🌡 {outfit.weather_temp}°C</span>}
        <span className="tag">{outfit.items.length} items</span>
      </div>

      {/* actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => onEdit(outfit)}>
          Edit
        </button>
        <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => onDelete(outfit.id)}>
          Delete
        </button>
      </div>
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────
export default function Outfits() {
  const [outfits, setOutfits]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal,   setModal]     = useState(null)   // null | 'create' | outfit object

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
      <div className="flex items-center justify-between mb-16">
        <h1 style={{ margin: 0 }}>My Outfits ({outfits.length})</h1>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          + Create Outfit
        </button>
      </div>

      {loading ? (
        <p className="text-gray">Loading…</p>
      ) : outfits.length === 0 ? (
        <div className="card text-center" style={{ padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🗂</div>
          <p className="text-gray">No saved outfits yet.</p>
          <p className="text-sm text-gray mt-8">Generate one from the Dashboard or create manually.</p>
          <button className="btn btn-primary mt-16" onClick={() => setModal('create')}>
            Create your first outfit
          </button>
        </div>
      ) : (
        <div className="grid grid-3">
          {outfits.map(o => (
            <OutfitCard
              key={o.id}
              outfit={o}
              onEdit={setModal}
              onDelete={deleteOutfit}
            />
          ))}
        </div>
      )}

      {modal && (
        <OutfitModal
          outfit={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
