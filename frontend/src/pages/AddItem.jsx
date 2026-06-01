import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import CropModal from '../components/CropModal'

const CATEGORIES = ['top', 'mid', 'outer', 'bottom', 'footwear', 'accessory']
const CATEGORY_LABEL = {
  top:       'Top (t-shirt, shirt, blouse)',
  mid:       'Mid layer (sweater, hoodie)',
  outer:     'Outer (jacket, coat)',
  bottom:    'Bottom (trousers, skirt, shorts)',
  footwear:  'Footwear',
  accessory: 'Accessory',
}

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
  ['black',       '#1a1a1a'],
  ['white',       '#f0f0f0'],
  ['gray',        '#888888'],
  ['navy',        '#0a1e50'],
  ['royal blue',  '#4169e1'],
  ['sky blue',    '#87ceeb'],
  ['teal',        '#008080'],
  ['green',       '#228b22'],
  ['olive',       '#6b8e23'],
  ['yellow',      '#ffd700'],
  ['orange',      '#ff8c00'],
  ['red',         '#c81e1e'],
  ['burgundy',    '#800020'],
  ['pink',        '#ff69b3'],
  ['purple',      '#800080'],
  ['beige',       '#e8dcc8'],
  ['brown',       '#8b4513'],
  ['camel',       '#c19a6b'],
]
const LIGHT_COLORS = new Set(['white', 'beige', 'sky blue', 'yellow', 'pink'])

const MATERIALS = [
  'cotton', 'wool', 'polyester', 'denim', 'leather',
  'silk', 'linen', 'synthetic', 'fleece', 'down', 'knit',
]

const STYLES = ['casual', 'smart casual', 'business', 'sport', 'streetwear', 'formal']

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

function explainTempRange(category, subcategory, material) {
  const cat = (category    || '').toLowerCase().trim()
  const sub = (subcategory || '').toLowerCase().trim()
  const mat = (material    || '').toLowerCase().trim()

  let base = TEMP_BASE_RANGES[`${cat}|${sub}`]
  let baseLabel = sub ? `${cat} · ${sub}` : cat || 'unknown'
  let baseHow   = 'exact_match'
  let baseFromKey = `${cat}|${sub}`

  if (!base && sub) {
    for (const key of Object.keys(TEMP_BASE_RANGES)) {
      if (key.endsWith(`|${sub}`)) {
        base = TEMP_BASE_RANGES[key]
        baseHow = 'cross_category'
        baseFromKey = key
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
  const [tempUserEdited, setTempUserEdited] = useState(false)
  const [showTempExplain, setShowTempExplain] = useState(false)
  const [styleUserEdited, setStyleUserEdited] = useState(false)
  const [autoStyles,     setAutoStyles]      = useState([])
  const [pendingFile,    setPendingFile]     = useState(null)
  const [dragOver,       setDragOver]        = useState(false)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()

  const acceptFile = (file) => {
    if (!file) return
    if (!/^image\/(jpe?g|png|webp)$/i.test(file.type)) {
      setError('Unsupported file type. Use JPEG, PNG or WebP.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Max 10 MB.')
      return
    }
    setError('')
    setPendingFile(file)
  }

  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }
  const onDragEnter = (e) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = (e) => { e.preventDefault(); setDragOver(false) }
  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    acceptFile(file)
  }

  const [autoSuggested, setAutoSuggested] = useState(deriveTempRange('top', '', ''))
  useEffect(() => {
    const [tmin, tmax] = deriveTempRange(form.category, form.subcategory, form.material)
    setAutoSuggested([tmin, tmax])
    if (!tempUserEdited) {
      setForm(f => ({ ...f, temp_min: tmin, temp_max: tmax }))
    }
  }, [form.category, form.subcategory, form.material, tempUserEdited])

  useEffect(() => {
    const suggested = deriveStyles(form.category, form.subcategory, form.material)
    setAutoStyles(suggested)
    if (!styleUserEdited) {
      setForm(f => ({ ...f, styles: suggested.join(',') }))
    }
  }, [form.category, form.subcategory, form.material, styleUserEdited])

  const onFileChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    acceptFile(file)
  }

  const onCropConfirm = async (blob) => {
    setPendingFile(null)
    if (!blob) return
    setPreview(URL.createObjectURL(blob))
    setError('')
    setMlResult(null)
    setAnalyzing(true)

    const fd = new FormData()
    fd.append('file', blob, 'cropped.jpg')
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
  const step = analyzing ? 3 : (mlResult || preview) ? 4 : 1
  const displayImg = mlResult?.image_no_bg_url || preview

  return (
    <div className="bru-page">
      <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 14, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div className="bru-mono">ACQUISITION</div>
          <div className="bru-serif" style={{ fontSize: 64, lineHeight: 0.95 }}>Add a <em style={{ color: 'var(--accent)' }}>piece</em>.</div>
        </div>
        <div className="bru-mono" style={{ display: 'flex', gap: 0, border: '1.5px solid var(--ink)' }}>
          {[
            [1, 'UPLOAD'],
            [2, 'CROP'],
            [3, 'ANALYSE'],
            [4, 'CONFIRM'],
          ].map(([n, label], i) => {
            const active = step === n
            const past = step > n
            return (
              <div key={n} className={active ? 'bru-on-accent' : ''} style={{
                padding: '8px 12px', fontSize: 9,
                borderLeft: i > 0 ? '1.5px solid var(--ink)' : 'none',
                background: active ? 'var(--accent)' : past ? 'var(--ink)' : 'var(--paper)',
                color: active ? '#0A0A0A' : past ? 'var(--paper)' : 'var(--mute)',
              }}>
                {String(n).padStart(2, '0')} · {label}
              </div>
            )
          })}
        </div>
      </div>

      <div className="bru-stack-mobile" style={{ gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18, alignItems: 'start' }}>
        {/* Left — image preview / drop zone */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onFileChange}
            style={{ display: 'none' }}
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={onDragOver}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            role="button"
            tabIndex={0}
            style={{
              cursor: 'pointer',
              background: dragOver ? 'var(--accent)' : 'var(--ink)',
              position: 'relative', minHeight: 380,
              border: `${dragOver ? 3 : 1.5}px ${dragOver ? 'dashed' : 'solid'} var(--ink)`,
              transition: 'background 0.12s',
            }}
          >
            <div style={{ minHeight: 380, display: 'grid', placeItems: 'center' }}>
            {displayImg ? (
              <img src={displayImg} alt="preview" style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain' }} />
            ) : dragOver ? (
              <div className="bru-on-accent" style={{ textAlign: 'center', padding: 30 }}>
                <div className="bru-serif" style={{ fontSize: 42, lineHeight: 1, color: '#0A0A0A' }}>Drop it.</div>
                <div className="bru-mono" style={{ fontSize: 10, marginTop: 10, color: '#0A0A0A' }}>RELEASE TO UPLOAD</div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--paper)', padding: 30 }}>
                <div className="bru-serif" style={{ fontSize: 36, lineHeight: 1 }}>Drag a photo here</div>
                <div className="bru-mono" style={{ fontSize: 10, marginTop: 10, opacity: 0.6 }}>OR CLICK TO BROWSE</div>
                <div className="bru-mono" style={{ fontSize: 9, marginTop: 6, opacity: 0.45 }}>JPEG · PNG · WEBP · MAX 10MB</div>
              </div>
            )}
            </div>
            {/* corner brackets */}
            {[{t:10,l:10},{t:10,r:10},{b:10,r:10},{b:10,l:10}].map((c, i) => (
              <svg key={i} width="20" height="20" viewBox="0 0 22 22" style={{ position: 'absolute', top: c.t, left: c.l, right: c.r, bottom: c.b, transform: `rotate(${i*90}deg)` }}>
                <path d="M2 8 V2 H8" stroke="var(--accent)" strokeWidth="1.5" fill="none"/>
              </svg>
            ))}
            {mlResult && !analyzing && (
              <div className="bru-on-accent" style={{
                position: 'absolute', top: 10, left: 10,
                background: 'var(--accent)', color: '#0A0A0A',
                padding: '4px 8px', fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9, letterSpacing: '0.18em',
              }}>
                AI · {(mlResult.confidence * 100).toFixed(0)}% CONFIDENT
              </div>
            )}
            {analyzing && (
              <div className="bru-on-accent" style={{
                position: 'absolute', top: 10, left: 10,
                background: 'var(--accent)', color: '#0A0A0A',
                padding: '4px 8px', fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9, letterSpacing: '0.18em',
              }}>ANALYSING…</div>
            )}
          </div>

          <div className="bru-mono" style={{ marginTop: 10, display: 'flex', gap: 14, fontSize: 9, color: 'var(--mute)' }}>
            <span>↳ BG-REMOVED</span>
            <span>NEURAL CLASSIFIER</span>
            <span>{analyzing ? 'RUNNING' : mlResult ? 'OK' : 'IDLE'}</span>
          </div>

          <div style={{
            marginTop: 12, padding: 10, border: '1.5px solid var(--line-soft)',
            background: 'var(--paper)',
          }}>
            <div className="bru-mono" style={{ fontSize: 9, color: 'var(--mute)' }}>TIP</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Photograph the item <strong>laid flat or on a hanger</strong> — not while worn. Then crop tightly for best recognition.
            </div>
          </div>

          <button
            type="button"
            className="bru-btn bru-btn-accent bru-on-accent"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'block', textAlign: 'center', width: '100%',
              marginTop: 12, cursor: 'pointer', padding: '12px 0',
            }}
          >
            {preview ? 'CHOOSE DIFFERENT PHOTO' : 'BROWSE FILES ⟶'}
          </button>

          <CropModal
            file={pendingFile}
            onCancel={() => setPendingFile(null)}
            onConfirm={onCropConfirm}
          />

          {error && (
            <div className="bru-mono" style={{
              marginTop: 10, padding: '10px 12px', fontSize: 10,
              background: 'var(--accent)', color: '#0A0A0A',
              border: '1.5px solid var(--ink)',
            }}>
              {error.toUpperCase()}
            </div>
          )}
        </div>

        {/* Right — form */}
        <div className="bru-card">
          <div className="bru-mono" style={{ marginBottom: 14 }}>
            {mlResult ? 'CONFIRM / ADJUST' : 'ATTRIBUTES'}
            {lowConf && <span style={{ color: 'var(--accent)', marginLeft: 10 }}>· LOW CONFIDENCE · VERIFY</span>}
          </div>

          <form onSubmit={save}>
            {/* Name */}
            <div style={{ marginBottom: 14 }}>
              <label className="bru-mono" style={{ fontSize: 9, display: 'block', marginBottom: 4 }}>NAME *</label>
              <input
                className="bru-input"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Blue Columbia jacket"
                required
              />
            </div>

            {/* Category / Subcategory */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label className="bru-mono" style={{ fontSize: 9, display: 'block', marginBottom: 4 }}>
                  CATEGORY *
                </label>
                <select
                  className="bru-input"
                  value={form.category}
                  onChange={e => { set('category', e.target.value); set('subcategory', '') }}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="bru-mono" style={{ fontSize: 9, display: 'block', marginBottom: 4 }}>SUBCATEGORY</label>
                <select
                  className="bru-input"
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

            {/* Colour — swatch grid */}
            <div style={{ marginBottom: 14 }}>
              <label className="bru-mono" style={{ fontSize: 9, display: 'block', marginBottom: 4 }}>
                COLOUR *{lowConf && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>· VERIFY</span>}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 0 }}>
                {COLORS.map(([name, hex]) => {
                  const on = form.color === name
                  const lightBg = LIGHT_COLORS.has(name)
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => set('color', name)}
                      title={name}
                      style={{
                        aspectRatio: '1', background: hex,
                        border: '1.5px solid var(--ink)', marginLeft: -1.5, marginTop: -1.5,
                        cursor: 'pointer', position: 'relative',
                        boxShadow: on ? 'inset 0 0 0 3px var(--accent)' : 'none',
                        color: lightBg ? '#0A0A0A' : '#fff',
                        display: 'grid', placeItems: 'center',
                        fontSize: 14,
                      }}
                    >
                      {on ? '✓' : ''}
                    </button>
                  )
                })}
              </div>
              <div className="bru-mono" style={{ fontSize: 9, color: 'var(--mute)', marginTop: 6 }}>
                SELECTED · {form.color.toUpperCase()}
              </div>
            </div>

            {/* Material + Brand */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label className="bru-mono" style={{ fontSize: 9, display: 'block', marginBottom: 4 }}>MATERIAL</label>
                <select
                  className="bru-input"
                  value={form.material}
                  onChange={e => set('material', e.target.value)}
                >
                  <option value="">— not specified —</option>
                  {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="bru-mono" style={{ fontSize: 9, display: 'block', marginBottom: 4 }}>BRAND</label>
                <input
                  className="bru-input"
                  value={form.brand}
                  onChange={e => set('brand', e.target.value)}
                  placeholder="optional"
                />
              </div>
            </div>

            {/* Style chips */}
            <div style={{ marginBottom: 14 }}>
              <label className="bru-mono" style={{ fontSize: 9, display: 'block', marginBottom: 6 }}>STYLE</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {STYLES.map(s => {
                  const on = activeStyles.includes(s)
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStyle(s)}
                      className={'bru-tag' + (on ? ' on' : '')}
                      style={{ cursor: 'pointer' }}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
              <div className="bru-mono" style={{ fontSize: 9, color: 'var(--mute)', marginTop: 6 }}>
                {styleUserEdited ? (
                  <>
                    MANUAL · SUGGESTION: {autoStyles.length ? autoStyles.join(', ').toUpperCase() : 'NONE'}
                    {' · '}
                    <a
                      href="#"
                      onClick={e => {
                        e.preventDefault()
                        setForm(f => ({ ...f, styles: autoStyles.join(',') }))
                        setStyleUserEdited(false)
                      }}
                      style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                    >
                      RESET
                    </a>
                  </>
                ) : (
                  <>AUTO · FROM {(form.subcategory || form.category).toUpperCase()}{form.material ? ` · ${form.material.toUpperCase()}` : ''}</>
                )}
              </div>
            </div>

            {/* Temperature range */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <label className="bru-mono" style={{ fontSize: 9 }}>WEARS AT (°C)</label>
                <button
                  type="button"
                  onClick={() => setShowTempExplain(v => !v)}
                  title="Why these numbers?"
                  className={showTempExplain ? 'bru-on-accent' : ''}
                  style={{
                    width: 18, height: 18, border: '1.5px solid var(--ink)',
                    background: showTempExplain ? 'var(--accent)' : 'var(--paper)',
                    color: showTempExplain ? '#0A0A0A' : 'var(--ink)',
                    cursor: 'pointer', fontSize: 11, lineHeight: '14px',
                    padding: 0, fontFamily: 'JetBrains Mono, monospace',
                  }}
                >?</button>
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
                    border: '1.5px solid var(--ink)', background: 'var(--paper)',
                    padding: 12, marginBottom: 10, fontSize: 11,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <strong className="bru-mono" style={{ fontSize: 10 }}>HOW WE PICKED THIS RANGE</strong>
                      <button
                        type="button"
                        onClick={() => setShowTempExplain(false)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
                      >×</button>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div>
                        <strong>1. Base:</strong>{' '}
                        <code>{ex.base.min}° / {ex.base.max}°</code>
                      </div>
                      <div style={{ marginLeft: 12, color: 'var(--mute)', fontSize: 10 }}>{baseMsg}</div>

                      <div style={{ marginTop: 6 }}>
                        <strong>2. Material:</strong>{' '}
                        {ex.material ? (
                          <>
                            <code>{ex.material.name}</code>
                            {' shifts min '}
                            <code>{ex.material.minDelta >= 0 ? '+' : ''}{ex.material.minDelta}°</code>
                            {', max '}
                            <code>{ex.material.maxDelta >= 0 ? '+' : ''}{ex.material.maxDelta}°</code>
                          </>
                        ) : (
                          <span style={{ color: 'var(--mute)' }}>none</span>
                        )}
                      </div>

                      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px dashed var(--line-soft)' }}>
                        <strong>3. Final:</strong>{' '}
                        <code className="bru-on-accent" style={{ background: 'var(--accent)', padding: '1px 6px', color: '#0A0A0A' }}>
                          {ex.final[0]}° to {ex.final[1]}°
                        </code>
                        {ex.clamped && (
                          <div style={{ marginLeft: 12, color: 'var(--mute)', fontSize: 10 }}>
                            (clamped to bounds [{TEMP_BOUND_MIN}°, {TEMP_BOUND_MAX}°])
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div style={{ border: '1.5px solid var(--ink)', padding: '12px 14px' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                }}>
                  <span>{form.temp_min}°</span>
                  <span>{form.temp_max}°</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                  <input
                    className="bru-input"
                    type="number"
                    value={form.temp_min}
                    onChange={e => { set('temp_min', e.target.value); setTempUserEdited(true) }}
                    min={-40} max={40}
                  />
                  <input
                    className="bru-input"
                    type="number"
                    value={form.temp_max}
                    onChange={e => { set('temp_max', e.target.value); setTempUserEdited(true) }}
                    min={-40} max={50}
                  />
                </div>
              </div>
              <div className="bru-mono" style={{ fontSize: 9, color: 'var(--mute)', marginTop: 6 }}>
                {tempUserEdited ? (
                  <>
                    MANUAL · SUGGESTION {autoSuggested[0]}° / {autoSuggested[1]}°
                    {' · '}
                    <a
                      href="#"
                      onClick={e => {
                        e.preventDefault()
                        setForm(f => ({ ...f, temp_min: autoSuggested[0], temp_max: autoSuggested[1] }))
                        setTempUserEdited(false)
                      }}
                      style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                    >
                      RESET
                    </a>
                  </>
                ) : (
                  <>AUTO · FROM {(form.subcategory || form.category).toUpperCase()}{form.material ? ` · ${form.material.toUpperCase()}` : ''}</>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 0, marginTop: 18 }}>
              <button
                type="button"
                className="bru-btn"
                style={{ flex: 1, borderRight: 'none' }}
                onClick={() => navigate('/wardrobe')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bru-btn bru-btn-accent bru-on-accent"
                style={{ flex: 2 }}
                disabled={saving || analyzing}
              >
                {saving ? 'Saving…' : 'Add to Wardrobe ⟶'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
