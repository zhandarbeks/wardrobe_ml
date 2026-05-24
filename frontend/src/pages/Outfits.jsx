import { useEffect, useState } from 'react'
import api from '../api'

const CAT_ORDER = { outer: 0, top: 1, mid: 2, bottom: 3, footwear: 4, accessory: 5 }
const OCCASIONS = ['any', 'casual', 'formal', 'sport', 'outdoor']

function Thumb({ item, size = 56, fill = false }) {
  const [src, setSrc] = useState(item.image_no_bg_url || item.image_url || null)
  const fallback = item.image_no_bg_url ? item.image_url : null
  const box = fill
    ? { width: '100%', height: '100%' }
    : { width: size, height: size, flexShrink: 0 }
  return (
    <div style={{ ...box, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
      {src
        ? <img src={src} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={() => { if (fallback && src !== fallback) setSrc(fallback); else setSrc(null) }} />
        : <span style={{ fontSize: size * 0.4, opacity: .3 }}>👕</span>}
    </div>
  )
}

// ── Outfit builder / editor modal ─────────────────────────────────────
function OutfitModal({ outfit, onClose, onSaved }) {
  const [wardrobeItems, setWardrobeItems] = useState([])
  const [selected, setSelected] = useState(outfit ? new Set(outfit.items.map(i => i.id)) : new Set())
  const [name, setName] = useState(outfit?.name || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  useEffect(() => { api.get('/api/v1/wardrobe').then(r => setWardrobeItems(r.data)) }, [])
  const toggle = id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const filtered = wardrobeItems.filter(i => catFilter === 'all' || i.category === catFilter)
  const save = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    if (selected.size === 0) { setError('Select at least one item'); return }
    setSaving(true); setError('')
    try {
      const item_ids = [...selected].join(',')
      if (outfit) await api.patch(`/api/v1/outfits/${outfit.id}`, { name: name.trim(), item_ids })
      else await api.post('/api/v1/outfits', { name: name.trim(), item_ids, is_auto_generated: false })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save')
    } finally { setSaving(false) }
  }
  const CATS = ['all', 'top', 'mid', 'outer', 'bottom', 'footwear', 'accessory']
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--paper)', border: '2px solid var(--ink)' }}>
        <div style={{ padding: 20, borderBottom: '2px solid var(--ink)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className="bru-mono">{outfit ? 'EDIT OUTFIT' : 'NEW OUTFIT'}</div>
            <div className="bru-serif" style={{ fontSize: 26, marginTop: 4 }}>{outfit?.name || 'Build a look'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--mute)' }}>✕</button>
        </div>
        <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
          {error && <div className="bru-on-accent" style={{ marginBottom: 14, padding: 8, background: 'var(--accent)' }}><div className="bru-mono" style={{ fontSize: 10 }}>⚠ {error}</div></div>}
          <div style={{ marginBottom: 14 }}>
            <label className="bru-label">Name</label>
            <input className="bru-input" value={name} onChange={e => setName(e.target.value)} placeholder="Friday night out" />
          </div>
          <div className="bru-mono" style={{ marginBottom: 8 }}>FILTER</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {CATS.map(c => (
              <span key={c} onClick={() => setCatFilter(c)} className={'bru-tag' + (catFilter === c ? ' on' : '')} style={{ cursor: 'pointer' }}>
                {c.toUpperCase()}
              </span>
            ))}
          </div>
          <div className="bru-mono" style={{ marginBottom: 8 }}>SELECTED · {selected.size}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
            {filtered.sort((a, b) => (CAT_ORDER[a.category] ?? 9) - (CAT_ORDER[b.category] ?? 9)).map(item => {
              const on = selected.has(item.id)
              return (
                <div key={item.id} onClick={() => toggle(item.id)}
                  style={{ border: '1.5px solid var(--ink)', cursor: 'pointer', background: on ? 'var(--accent)' : 'transparent', display: 'flex', flexDirection: 'column' }}
                  className={on ? 'bru-on-accent' : ''}>
                  <div style={{ aspectRatio: '1', display: 'grid', placeItems: 'center', padding: 8 }}>
                    <Thumb item={item} size={80} />
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                    <div className="bru-mono" style={{ fontSize: 8, marginTop: 2 }}>{item.subcategory || item.category}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 0, borderTop: '2px solid var(--ink)' }}>
          <button type="button" className="bru-btn" style={{ flex: 1, border: 'none', borderRight: '1.5px solid var(--ink)' }} onClick={onClose}>Cancel</button>
          <button className="bru-btn bru-btn-accent" style={{ flex: 1.5, border: 'none' }} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : outfit ? 'Save changes ⟶' : 'Create outfit ⟶'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Outfit card ───────────────────────────────────────────────────────
function OutfitCard({ outfit, onEdit, onDelete, onWorn }) {
  const [wornToday, setWornToday] = useState(
    outfit.used_at ? new Date(outfit.used_at).toDateString() === new Date().toDateString() : false
  )
  const [marking, setMarking] = useState(false)
  const sorted = [...outfit.items].sort((a, b) => (CAT_ORDER[a.category] ?? 9) - (CAT_ORDER[b.category] ?? 9))
  const handleWorn = async () => {
    setMarking(true)
    try {
      await api.post(`/api/v1/outfits/${outfit.id}/worn`)
      setWornToday(true)
      onWorn && onWorn()
    } finally { setMarking(false) }
  }
  return (
    <div style={{ border: '1.5px solid var(--ink)', display: 'flex', flexDirection: 'column', background: 'var(--paper)' }}>
      <div className="bru-on-accent" style={{ background: 'var(--accent)', padding: '8px 12px', borderBottom: '1.5px solid var(--ink)', display: 'flex', justifyContent: 'space-between' }}>
        <span className="bru-mono">{(outfit.occasion || 'any').toUpperCase()}{outfit.weather_temp != null && ` · ${Math.round(outfit.weather_temp)}°`}</span>
        <span className="bru-mono">{outfit.score != null ? `${Math.round(outfit.score * 100)}/100` : '—'}</span>
      </div>
      <div style={{ padding: 14 }}>
        <div className="bru-serif" style={{ fontSize: 22 }}>{outfit.name || 'Outfit'}</div>
        <div className="bru-mono" style={{ fontSize: 9, marginTop: 4, color: 'var(--mute)' }}>
          {new Date(outfit.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}
          {outfit.used_at && <> · WORN {new Date(outfit.used_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()}</>}
        </div>
        <div className="bru-rail" style={{
          display: 'flex', marginTop: 12, border: '1.5px solid var(--ink)',
          overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'thin',
        }}>
          {sorted.map((it, i) => (
            <div key={it.id} style={{
              flex: '0 0 calc(25% - 0.5px)',
              boxSizing: 'border-box', aspectRatio: '1',
              display: 'grid', placeItems: 'center', padding: 8,
              borderLeft: i > 0 ? '1px solid var(--line-soft)' : 'none',
            }}>
              <Thumb item={it} fill />
            </div>
          ))}
          {/* fill empty slots so a 2- or 3-item outfit still spans the whole rail */}
          {sorted.length < 4 && Array.from({ length: 4 - sorted.length }).map((_, i) => (
            <div key={`empty-${i}`} style={{
              flex: '0 0 calc(25% - 0.5px)',
              boxSizing: 'border-box', aspectRatio: '1',
              borderLeft: '1px solid var(--line-soft)',
            }} />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', borderTop: '1.5px solid var(--ink)', marginTop: 'auto' }}>
        <button className="bru-btn" style={{ flex: 1, height: 30, fontSize: 9, padding: 0, border: 'none', borderRight: '1.5px solid var(--ink)' }} onClick={() => onEdit(outfit)}>EDIT</button>
        <button className="bru-btn" style={{ flex: 1, height: 30, fontSize: 9, padding: 0, border: 'none', borderRight: '1.5px solid var(--ink)' }} onClick={() => onDelete(outfit.id)}>DELETE</button>
        <button className="bru-btn bru-btn-accent" style={{ flex: 1.4, height: 30, fontSize: 9, padding: 0, border: 'none' }} onClick={handleWorn} disabled={marking || wornToday}>
          {wornToday ? '✓ WORN' : marking ? '…' : 'WEAR ✓'}
        </button>
      </div>
    </div>
  )
}

export default function Outfits() {
  const [outfits, setOutfits] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [occasion, setOccasion] = useState('any')

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const { data } = await api.get('/api/v1/outfits')
      setOutfits(data)
    } finally { if (!silent) setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const deleteOutfit = async id => {
    if (!confirm('Delete this outfit?')) return
    const prev = outfits
    setOutfits(prev.filter(o => o.id !== id))
    try {
      await api.delete(`/api/v1/outfits/${id}`)
    } catch (err) {
      setOutfits(prev)
      alert(err.response?.data?.detail || `Could not delete outfit (status ${err.response?.status || '?'}).`)
    }
  }

  const visible = occasion === 'any' ? outfits : outfits.filter(o => (o.occasion || 'any') === occasion)

  return (
    <div className="bru-page">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '2px solid var(--ink)', paddingBottom: 14 }}>
        <div>
          <div className="bru-mono">CATALOGUED LOOKS</div>
          <div className="bru-serif" style={{ fontSize: 56, lineHeight: 0.95 }}>{visible.length} <em style={{ color: 'var(--accent)' }}>outfits</em> on record.</div>
        </div>
        <button className="bru-btn bru-btn-accent" onClick={() => setModal('create')}>+ Create outfit</button>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
        <span className="bru-mono" style={{ color: 'var(--mute)', marginRight: 4 }}>OCCASION</span>
        {OCCASIONS.map(o => (
          <span key={o} onClick={() => setOccasion(o)} className={'bru-tag' + (occasion === o ? ' on' : '')} style={{ cursor: 'pointer' }}>
            {o.toUpperCase()}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="bru-mono" style={{ textAlign: 'center', padding: 60, color: 'var(--mute)' }}>LOADING…</div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, border: '1.5px dashed var(--line-soft)', marginTop: 20 }}>
          <div className="bru-serif" style={{ fontSize: 22 }}>
            {outfits.length === 0 ? 'No saved outfits yet' : 'No matches for this filter'}
          </div>
          <div className="bru-mono" style={{ fontSize: 10, color: 'var(--mute)', marginTop: 8 }}>
            {outfits.length === 0 ? 'GENERATE FROM TODAY OR CREATE MANUALLY' : ''}
          </div>
          {outfits.length === 0 && (
            <button className="bru-btn bru-btn-accent" style={{ marginTop: 16 }} onClick={() => setModal('create')}>Create your first outfit</button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginTop: 18 }}>
          {visible.map(o => (
            <OutfitCard key={o.id} outfit={o} onEdit={setModal} onDelete={deleteOutfit} onWorn={() => load({ silent: true })} />
          ))}
        </div>
      )}

      {modal && (
        <OutfitModal outfit={modal === 'create' ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load({ silent: true }) }} />
      )}
    </div>
  )
}
