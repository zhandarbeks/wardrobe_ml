import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const CATEGORIES = ['top', 'mid', 'outer', 'bottom', 'footwear', 'accessory']
const CATEGORY_LABEL = {
  top:       'Top (t-shirt, shirt, blouse)',
  mid:       'Mid layer (sweater, hoodie)',
  outer:     'Outer (jacket, coat)',
  bottom:    'Bottom (trousers, skirt, shorts)',
  footwear:  'Footwear',
  accessory: 'Accessory',
}

// Subcategory options — superset of (a) Model A predicted classes and
// (b) common wardrobe items users add manually. Keeping the union here lets
// the UI show every label that backend's temp_defaults / style_defaults
// recognise.
const SUBCATEGORY_OPTIONS = {
  top:       ['t-shirt', 'shirt', 'top', 'polo', 'tank top', 'blouse', 'tunic'],
  mid:       ['sweater', 'sweatshirt', 'pullover', 'hoodie'],
  outer:     ['jacket', 'blazer', 'coat', 'rain jacket'],
  bottom:    ['jeans', 'trousers', 'shorts', 'skirt', 'leggings', 'track pants', 'joggers'],
  footwear:  ['casual shoes', 'sports shoes', 'formal shoes',
              'heels', 'flats', 'sandals', 'flip flops', 'boots', 'loafers'],
  accessory: ['watch', 'sunglasses', 'belt', 'backpack',
              'handbag', 'bag', 'wallet', 'hat', 'cap', 'scarf', 'tie'],
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

const STYLES = ['casual', 'smart casual', 'business', 'sport', 'streetwear', 'formal']

// ── Temperature defaults — mirror of backend/temp_defaults.py for instant UI feedback.
//     Backend remains the source of truth; we just avoid an API round-trip on every keystroke.
const TEMP_BASE_RANGES = {
  'top|t-shirt':       [15,  35],
  'top|tank top':      [20,  40],
  'top|polo':          [12,  32],
  'top|shirt':         [ 8,  28],
  'top|blouse':        [10,  28],
  'top|tunic':         [ 8,  26],
  'top|top':           [12,  30],
  'mid|sweater':       [-5,  18],
  'mid|sweatshirt':    [ 0,  20],
  'mid|pullover':      [-2,  18],
  'mid|hoodie':        [-3,  19],
  'outer|jacket':      [-10, 15],
  'outer|blazer':      [ 5,  22],
  'outer|coat':        [-15, 12],
  'outer|rain jacket': [ 5,  20],
  'bottom|shorts':     [18,  40],
  'bottom|skirt':      [12,  30],
  'bottom|jeans':      [-10, 25],
  'bottom|trousers':   [-5,  28],
  'bottom|leggings':   [-5,  22],
  'bottom|track pants':[ 0,  25],
  'bottom|joggers':    [-5,  22],
  'footwear|sandals':     [18,  40],
  'footwear|flip flops':  [20,  40],
  'footwear|flats':       [10,  30],
  'footwear|heels':       [ 8,  30],
  'footwear|casual shoes':[-5,  28],
  'footwear|sports shoes':[-5,  30],
  'footwear|formal shoes':[ 0,  28],
  'footwear|boots':       [-15, 15],
  'footwear|loafers':     [ 5,  28],
  'accessory|watch':      [-30, 40],
  'accessory|sunglasses': [-30, 40],
  'accessory|belt':       [-30, 40],
  'accessory|backpack':   [-30, 40],
  'accessory|handbag':    [-30, 40],
  'accessory|bag':        [-30, 40],
  'accessory|wallet':     [-30, 40],
  'accessory|tie':        [-30, 40],
  'accessory|hat':        [-30, 25],
  'accessory|cap':        [-30, 30],
  'accessory|scarf':      [-30, 12],
}
const TEMP_CATEGORY_FALLBACK = {
  top: [12, 30], mid: [-5, 20], outer: [-10, 18],
  bottom: [-5, 28], footwear: [0, 30], accessory: [-30, 40],
}
const TEMP_MATERIAL_MODIFIERS = {
  wool:    { min: -5,  max:  0 },
  fleece:  { min: -5,  max:  0 },
  down:    { min: -10, max:  0 },
  knit:    { min: -3,  max:  0 },
  leather: { min: -3,  max:  0 },
  linen:   { min:  0,  max:  3 },
  silk:    { min:  0,  max:  2 },
}
const TEMP_BOUND_MIN = -30, TEMP_BOUND_MAX = 45

function deriveTempRange(category, subcategory, material) {
  const r = explainTempRange(category, subcategory, material)
  return r.final
}

// ── Explanation builder for the "Why these numbers?" popover ─────────────
// Returns the same final range as deriveTempRange, but also exposes the
// reasoning steps so the UI can render a transparent breakdown.
function explainTempRange(category, subcategory, material) {
  const cat = (category    || '').toLowerCase().trim()
  const sub = (subcategory || '').toLowerCase().trim()
  const mat = (material    || '').toLowerCase().trim()

  let base = TEMP_BASE_RANGES[`${cat}|${sub}`]
  let baseLabel = sub ? `${cat} · ${sub}` : cat || 'unknown'
  let baseHow   = 'exact_match'           // 'exact_match' | 'cross_category' | 'category_fallback' | 'global_fallback'
  let baseFromKey = `${cat}|${sub}`

  if (!base && sub) {
    for (const key of Object.keys(TEMP_BASE_RANGES)) {
      if (key.endsWith(`|${sub}`)) {
        base = TEMP_BASE_RANGES[key]
        baseHow = 'cross_category'
        baseFromKey = key                  // e.g. "mid|hoodie" when user picked "top|hoodie"
        baseLabel = key.replace('|', ' · ')
        break
      }
    }
  }
  if (!base) {
    base = TEMP_CATEGORY_FALLBACK[cat]
    if (base) {
      baseHow = 'category_fallback'
      baseLabel = `${cat} (category default)`
    }
  }
  if (!base) {
    base = [-5, 28]
    baseHow = 'global_fallback'
    baseLabel = 'global default'
    baseFromKey = '*'
  }

  const baseMin = base[0], baseMax = base[1]
  const mod = TEMP_MATERIAL_MODIFIERS[mat] || null
  let tmin = baseMin + (mod ? mod.min : 0)
  let tmax = baseMax + (mod ? mod.max : 0)
  let clamped = false
  if (tmin < TEMP_BOUND_MIN || tmax > TEMP_BOUND_MAX) clamped = true
  tmin = Math.max(TEMP_BOUND_MIN, Math.min(tmin, TEMP_BOUND_MAX))
  tmax = Math.max(TEMP_BOUND_MIN, Math.min(tmax, TEMP_BOUND_MAX))
  if (tmin > tmax) [tmin, tmax] = [tmax, tmin]

  return {
    base: { min: baseMin, max: baseMax, label: baseLabel, how: baseHow, key: baseFromKey },
    material: mod ? { name: mat, minDelta: mod.min, maxDelta: mod.max } : null,
    final: [Math.round(tmin), Math.round(tmax)],
    clamped,
  }
}

// ── Style suggestion mirror — backend/style_defaults.py ──────────────────
const STYLE_BY_SUBCAT = {
  'top|t-shirt':    ['casual', 'streetwear'],
  'top|tank top':   ['casual', 'sport'],
  'top|polo':       ['smart casual', 'casual'],
  'top|shirt':      ['smart casual', 'business'],
  'top|blouse':     ['smart casual', 'business'],
  'top|tunic':      ['casual', 'smart casual'],
  'top|top':        ['casual'],
  'mid|sweater':    ['smart casual', 'casual'],
  'mid|sweatshirt': ['casual', 'streetwear'],
  'mid|pullover':   ['casual', 'smart casual'],
  'mid|hoodie':     ['streetwear', 'casual', 'sport'],
  'outer|jacket':       ['casual', 'smart casual'],
  'outer|blazer':       ['business', 'smart casual', 'formal'],
  'outer|coat':         ['smart casual', 'business'],
  'outer|rain jacket':  ['casual', 'sport'],
  'bottom|jeans':       ['casual', 'streetwear'],
  'bottom|trousers':    ['smart casual', 'business'],
  'bottom|shorts':      ['casual', 'sport'],
  'bottom|skirt':       ['casual', 'smart casual'],
  'bottom|leggings':    ['sport', 'casual'],
  'bottom|track pants': ['sport', 'streetwear'],
  'bottom|joggers':     ['sport', 'streetwear', 'casual'],
  'footwear|sandals':      ['casual'],
  'footwear|flip flops':   ['casual'],
  'footwear|flats':        ['casual', 'smart casual'],
  'footwear|heels':        ['smart casual', 'business', 'formal'],
  'footwear|casual shoes': ['casual', 'streetwear'],
  'footwear|sports shoes': ['sport', 'streetwear'],
  'footwear|formal shoes': ['business', 'formal'],
  'footwear|boots':        ['casual', 'smart casual'],
  'footwear|loafers':      ['smart casual', 'business'],
  'accessory|watch':       [],
  'accessory|sunglasses':  ['casual'],
  'accessory|belt':        ['smart casual'],
  'accessory|backpack':    ['casual', 'streetwear', 'sport'],
  'accessory|handbag':     ['smart casual'],
  'accessory|bag':         ['smart casual', 'casual'],
  'accessory|wallet':      [],
  'accessory|hat':         ['casual', 'streetwear'],
  'accessory|cap':         ['casual', 'sport', 'streetwear'],
  'accessory|scarf':       ['smart casual'],
  'accessory|tie':         ['business', 'formal'],
}
const STYLE_CATEGORY_FALLBACK = {
  top: ['casual'], mid: ['casual'], outer: ['casual', 'smart casual'],
  bottom: ['casual'], footwear: ['casual'], accessory: [],
}
const MATERIAL_STYLE_HINTS = {
  wool:      ['smart casual', 'business'],
  silk:      ['formal', 'business'],
  linen:     ['smart casual', 'casual'],
  leather:   ['smart casual', 'streetwear'],
  denim:     ['casual', 'streetwear'],
  fleece:    ['sport', 'casual'],
  down:      ['casual', 'sport'],
  knit:      ['casual', 'smart casual'],
  synthetic: ['sport'],
}
const NEVER_FORMAL_SUBCATS = new Set([
  't-shirt', 'tank top', 'shorts', 'leggings',
  'track pants', 'joggers', 'sandals', 'flip flops',
  'sports shoes', 'hoodie', 'sweatshirt',
])

function deriveStyles(category, subcategory, material, maxStyles = 3) {
  const cat = (category    || '').toLowerCase().trim()
  const sub = (subcategory || '').toLowerCase().trim()
  const mat = (material    || '').toLowerCase().trim()
  let base = STYLE_BY_SUBCAT[`${cat}|${sub}`]
                || STYLE_CATEGORY_FALLBACK[cat]
                || []
  const styles = [...base]
  for (const h of MATERIAL_STYLE_HINTS[mat] || []) {
    if (styles.includes(h)) continue
    if ((h === 'formal' || h === 'business') && NEVER_FORMAL_SUBCATS.has(sub)) continue
    styles.push(h)
  }
  const seen = new Set(); const out = []
  for (const s of styles) {
    if (seen.has(s)) continue
    seen.add(s); out.push(s)
    if (out.length >= maxStyles) break
  }
  return out
}

export default function AddItem() {
  const [preview, setPreview]     = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [mlResult, setMlResult]   = useState(null)
  const [form, setForm] = useState({
    name: '', category: 'top', subcategory: '',
    color: 'black', brand: '', material: '', styles: '',
    temp_min: -5, temp_max: 25,
    image_url: null, image_no_bg_url: null,
    ml_confidence: null, embedding: null,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [tempUserEdited, setTempUserEdited] = useState(false)   // true once user types in temp_min/max
  const [showTempExplain, setShowTempExplain] = useState(false) // toggles the "Why these numbers?" popover
  const [styleUserEdited, setStyleUserEdited] = useState(false) // true once user toggles a style chip
  const [autoStyles,     setAutoStyles]      = useState([])
  const navigate = useNavigate()

  // ── Auto-derive temp range from category / subcategory / material ──────────
  // Runs whenever any of those three change, but ONLY while the user hasn't
  // manually edited the temperature inputs. Once they touch min or max, we
  // back off and respect their values — they can re-enable auto via the reset
  // link below the inputs.
  const [autoSuggested, setAutoSuggested] = useState(deriveTempRange('top', '', ''))
  useEffect(() => {
    const [tmin, tmax] = deriveTempRange(form.category, form.subcategory, form.material)
    setAutoSuggested([tmin, tmax])
    if (!tempUserEdited) {
      setForm(f => ({ ...f, temp_min: tmin, temp_max: tmax }))
    }
  }, [form.category, form.subcategory, form.material, tempUserEdited])

  // ── Auto-derive style tags ────────────────────────────────────────────
  // Same pattern as temp range: until the user toggles any style chip we
  // mirror the derived list into form.styles. Once they edit, we back off.
  useEffect(() => {
    const suggested = deriveStyles(form.category, form.subcategory, form.material)
    setAutoStyles(suggested)
    if (!styleUserEdited) {
      setForm(f => ({ ...f, styles: suggested.join(',') }))
    }
  }, [form.category, form.subcategory, form.material, styleUserEdited])

  const onFileChange = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setError('')
    setMlResult(null)
    setAnalyzing(true)

    const fd = new FormData()
    fd.append('file', file)
    try {
      const { data } = await api.post('/api/v1/wardrobe/analyze', fd)
      setMlResult(data)
      setForm(prev => ({
        ...prev,
        category:        data.category        || prev.category,
        subcategory:     data.subcategory      || '',
        color:           data.color            || prev.color,
        image_url:       data.image_url,
        image_no_bg_url: data.image_no_bg_url,
        ml_confidence:   data.confidence       ?? null,
        embedding:       data.embedding        ?? null,
      }))
    } catch {
      setError('ML analysis failed — you can still fill in the details manually.')
    } finally {
      setAnalyzing(false)
    }
  }

  const toggleStyle = name => {
    setStyleUserEdited(true)
    const current = form.styles ? form.styles.split(',').map(s => s.trim()).filter(Boolean) : []
    const updated = current.includes(name)
      ? current.filter(s => s !== name)
      : [...current, name]
    setForm(f => ({ ...f, styles: updated.join(',') }))
  }

  const activeStyles = form.styles ? form.styles.split(',').map(s => s.trim()).filter(Boolean) : []

  const save = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      await api.post('/api/v1/wardrobe/items', {
        name:            form.name.trim(),
        category:        form.category,
        subcategory:     form.subcategory || null,
        color:           form.color,
        material:        form.material   || null,
        brand:           form.brand      || null,
        styles:          form.styles     || null,
        temp_min:        Number(form.temp_min),
        temp_max:        Number(form.temp_max),
        image_url:       form.image_url,
        image_no_bg_url: form.image_no_bg_url,
        ml_confidence:   form.ml_confidence,
        embedding:       form.embedding,
      })
      navigate('/wardrobe')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const lowConf = mlResult && mlResult.confidence < 0.7

  return (
    <div className="page">
      <h1>Add Clothing Item</h1>

      <div className="grid grid-2" style={{ gap: 24, alignItems: 'start' }}>

        {/* Left — image upload + preview */}
        <div>
          <div
            className="card"
            style={{
              textAlign: 'center', padding: 24, marginBottom: 12,
              minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {preview ? (
              <img
                src={mlResult?.image_no_bg_url || preview}
                alt="preview"
                style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 8 }}
              />
            ) : (
              <div style={{
                width: '100%', height: 220, border: '2px dashed #ddd', borderRadius: 10,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', color: '#aaa',
              }}>
                <div style={{ marginTop: 10, fontSize: 14 }}>Upload a photo of your garment</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>JPEG / PNG / WebP · max 10 MB</div>
              </div>
            )}
          </div>

          <label
            className="btn btn-secondary"
            style={{ display: 'block', textAlign: 'center', width: '100%', cursor: 'pointer' }}
          >
            Choose Photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileChange}
              style={{ display: 'none' }}
            />
          </label>

          {analyzing && (
            <div className="alert alert-info mt-8">
              Analysing with AI — background removal + EfficientNetB0 classification
            </div>
          )}

          {mlResult && !analyzing && (
            <div className={`alert mt-8 ${lowConf ? 'alert-error' : 'alert-success'}`}>
              {lowConf ? '⚠️' : '✅'} ML complete — confidence: {(mlResult.confidence * 100).toFixed(0)}%
              {lowConf && ' — low confidence, please verify the fields below'}
            </div>
          )}
        </div>

        {/* Right — confirmation form */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>
            {mlResult ? 'Confirm / Adjust Attributes' : 'Item Attributes'}
          </h3>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={save}>

            {/* Name — required */}
            <div className="form-group">
              <label>Name *</label>
              <input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Blue Columbia jacket"
                required
              />
            </div>

            {/* Category + Subcategory */}
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>
                  Category *{' '}
                  {lowConf && <span style={{ color: '#dc2626', fontSize: 11 }}>⚠ verify</span>}
                </label>
                <select
                  value={form.category}
                  onChange={e => { set('category', e.target.value); set('subcategory', '') }}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Subcategory</label>
                <select
                  value={form.subcategory}
                  onChange={e => set('subcategory', e.target.value)}
                >
                  <option value="">— select —</option>
                  {(SUBCATEGORY_OPTIONS[form.category] || []).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Colour — required */}
            <div className="form-group mt-16">
              <label>
                Colour *{' '}
                {lowConf && <span style={{ color: '#dc2626', fontSize: 11 }}>⚠ verify</span>}
              </label>
              <select value={form.color} onChange={e => set('color', e.target.value)}>
                {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Material — select from seeded values */}
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
              <input
                value={form.brand}
                onChange={e => set('brand', e.target.value)}
                placeholder="optional"
              />
            </div>

            {/* Styles — auto-suggested from category/subcategory/material */}
            <div className="form-group">
              <label>Style</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {STYLES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStyle(s)}
                    style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                      border: '1px solid #ccc',
                      background: activeStyles.includes(s) ? '#2563eb' : '#f3f4f6',
                      color: activeStyles.includes(s) ? '#fff' : '#374151',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                {styleUserEdited ? (
                  <>
                    Manual selection. Suggestion:{' '}
                    <strong>{autoStyles.length ? autoStyles.join(', ') : 'none'}</strong>.{' '}
                    <a
                      href="#"
                      onClick={e => {
                        e.preventDefault()
                        setForm(f => ({ ...f, styles: autoStyles.join(',') }))
                        setStyleUserEdited(false)
                      }}
                      style={{ color: '#2563eb', textDecoration: 'underline' }}
                    >
                      reset to auto
                    </a>
                  </>
                ) : (
                  <>
                    Auto-suggested from{' '}
                    <strong>{form.subcategory || form.category}</strong>
                    {form.material ? <> · <strong>{form.material}</strong></> : null}.
                    Click chips to customise.
                  </>
                )}
              </div>
            </div>

            {/* Temperature range — auto-derived from category/subcategory/material */}
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Temperature range</span>
                <button
                  type="button"
                  onClick={() => setShowTempExplain(v => !v)}
                  title="Why these numbers?"
                  aria-label="Why these numbers?"
                  style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: '1px solid #9ca3af', background: showTempExplain ? '#2563eb' : '#fff',
                    color: showTempExplain ? '#fff' : '#6b7280',
                    cursor: 'pointer', fontSize: 11, lineHeight: '16px',
                    padding: 0, fontWeight: 700,
                  }}
                >ⓘ</button>
              </div>

              {showTempExplain && (() => {
                const ex = explainTempRange(form.category, form.subcategory, form.material)
                const baseMsg = {
                  exact_match:       `${ex.base.label} → preset`,
                  cross_category:    `no preset for "${form.category} · ${form.subcategory}". Reused match from ${ex.base.label}`,
                  category_fallback: `no preset for "${form.subcategory || '∅'}". Falling back to ${form.category} category default`,
                  global_fallback:   `no recognised category. Using global default`,
                }[ex.base.how]
                return (
                  <div style={{
                    border: '1px solid #d1d5db', background: '#f9fafb', borderRadius: 8,
                    padding: 12, marginBottom: 10, fontSize: 12, color: '#374151',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <strong style={{ fontSize: 13 }}>How we picked this range</strong>
                      <button type="button" onClick={() => setShowTempExplain(false)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer',
                                       color: '#6b7280', fontSize: 14, lineHeight: 1, padding: 0 }}>
                        ×
                      </button>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div>
                        <strong>1. Base range:</strong>{' '}
                        <code>{ex.base.min}°C / {ex.base.max}°C</code>
                      </div>
                      <div style={{ marginLeft: 16, color: '#6b7280' }}>{baseMsg}</div>

                      <div style={{ marginTop: 6 }}>
                        <strong>2. Material modifier:</strong>{' '}
                        {ex.material ? (
                          <>
                            <code>{ex.material.name}</code>
                            {' shifts min by '}
                            <code>{ex.material.minDelta >= 0 ? '+' : ''}{ex.material.minDelta}°C</code>
                            {', max by '}
                            <code>{ex.material.maxDelta >= 0 ? '+' : ''}{ex.material.maxDelta}°C</code>
                          </>
                        ) : (
                          <span style={{ color: '#6b7280' }}>none (no material selected, or material has no temperature impact)</span>
                        )}
                      </div>

                      <div style={{
                        marginTop: 8, paddingTop: 6, borderTop: '1px dashed #d1d5db',
                      }}>
                        <strong>3. Final range:</strong>{' '}
                        <code style={{ background: '#dbeafe', padding: '1px 6px', borderRadius: 4 }}>
                          {ex.final[0]}°C to {ex.final[1]}°C
                        </code>
                        {ex.clamped && (
                          <div style={{ marginLeft: 16, color: '#92400e' }}>
                            (clamped to allowed bounds [{TEMP_BOUND_MIN}°, {TEMP_BOUND_MAX}°])
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Temp min (°C)</label>
                  <input
                    type="number"
                    value={form.temp_min}
                    onChange={e => { set('temp_min', e.target.value); setTempUserEdited(true) }}
                    min={-40} max={40}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Temp max (°C)</label>
                  <input
                    type="number"
                    value={form.temp_max}
                    onChange={e => { set('temp_max', e.target.value); setTempUserEdited(true) }}
                    min={-40} max={50}
                  />
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {tempUserEdited ? (
                <>
                  Manual range. Suggestion for{' '}
                  <strong>{form.subcategory || form.category}</strong>
                  {form.material ? ` · ${form.material}` : ''}:{' '}
                  <strong>{autoSuggested[0]}°C / {autoSuggested[1]}°C</strong>
                  {' · '}
                  <a
                    href="#"
                    onClick={e => {
                      e.preventDefault()
                      setForm(f => ({ ...f, temp_min: autoSuggested[0], temp_max: autoSuggested[1] }))
                      setTempUserEdited(false)
                    }}
                    style={{ color: '#2563eb', textDecoration: 'underline' }}
                  >
                    reset to auto
                  </a>
                </>
              ) : (
                <>
                  Auto-derived from <strong>{form.subcategory || form.category}</strong>
                  {form.material ? <> · <strong>{form.material}</strong></> : null}
                  . Edit either input to set a custom range.
                </>
              )}
            </div>

            <button
              className="btn btn-primary w-full"
              style={{ marginTop: 20 }}
              disabled={saving || analyzing}
            >
              {saving ? 'Saving…' : 'Add to Wardrobe'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
