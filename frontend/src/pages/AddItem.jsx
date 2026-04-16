import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const CATEGORIES = ['top', 'mid', 'outer', 'bottom', 'footwear', 'accessory']
const COLORS = [
  'black', 'white', 'gray', 'navy', 'royal blue', 'sky blue',
  'teal', 'green', 'olive', 'yellow', 'orange', 'red',
  'burgundy', 'pink', 'purple', 'beige', 'brown', 'camel',
]
const CATEGORY_LABEL = {
  top: 'Top (t-shirt, shirt, blouse)',
  mid: 'Mid layer (sweater, hoodie)',
  outer: 'Outer (jacket, coat)',
  bottom: 'Bottom (trousers, skirt, shorts)',
  footwear: 'Footwear',
  accessory: 'Accessory',
}

export default function AddItem() {
  const [preview, setPreview] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [mlResult, setMlResult] = useState(null)
  const [mlEmbedding, setMlEmbedding] = useState(null)
  const [form, setForm] = useState({
    name: '', category: 'top', subcategory: '',
    color: 'black', brand: '', material: '', styles: '',
    temp_min: -5, temp_max: 25,
    image_url: null, image_no_bg_url: null,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

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
      setMlEmbedding(data.embedding || null)
      setForm(prev => ({
        ...prev,
        category: data.category || prev.category,
        subcategory: data.subcategory || '',
        color: data.color || prev.color,
        image_url: data.image_url,
        image_no_bg_url: data.image_no_bg_url,
      }))
    } catch {
      setError('ML analysis failed — you can still fill in the details manually.')
    } finally {
      setAnalyzing(false)
    }
  }

  const save = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      await api.post('/api/v1/wardrobe/items', {
        ...form,
        temp_min: Number(form.temp_min),
        temp_max: Number(form.temp_max),
        ml_confidence: mlResult?.confidence ?? null,
        embedding: mlEmbedding,
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
            📁 Choose Photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileChange}
              style={{ display: 'none' }}
            />
          </label>

          {analyzing && (
            <div className="alert alert-info mt-8">
              🤖 Analysing with AI… (U-Net segmentation + EfficientNetB0 classification + K-Means colour)
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
            <div className="form-group">
              <label>Name *</label>
              <input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Blue Columbia jacket"
                required
              />
            </div>

            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>
                  Category *{' '}
                  {lowConf && <span style={{ color: '#dc2626', fontSize: 11 }}>⚠ verify</span>}
                </label>
                <select value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Subcategory</label>
                <input
                  value={form.subcategory}
                  onChange={e => set('subcategory', e.target.value)}
                  placeholder="e.g. t-shirt, jeans"
                />
              </div>
            </div>

            <div className="form-group mt-16">
              <label>
                Colour *{' '}
                {lowConf && <span style={{ color: '#dc2626', fontSize: 11 }}>⚠ verify</span>}
              </label>
              <select value={form.color} onChange={e => set('color', e.target.value)}>
                {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Brand</label>
                <input
                  value={form.brand}
                  onChange={e => set('brand', e.target.value)}
                  placeholder="optional"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Material</label>
                <input
                  value={form.material}
                  onChange={e => set('material', e.target.value)}
                  placeholder="cotton, wool…"
                />
              </div>
            </div>

            <div className="form-group mt-16">
              <label>Style (comma-separated)</label>
              <input
                value={form.styles}
                onChange={e => set('styles', e.target.value)}
                placeholder="casual, sport, business"
              />
            </div>

            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Temp min (°C)</label>
                <input
                  type="number"
                  value={form.temp_min}
                  onChange={e => set('temp_min', e.target.value)}
                  min={-40} max={40}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Temp max (°C)</label>
                <input
                  type="number"
                  value={form.temp_max}
                  onChange={e => set('temp_max', e.target.value)}
                  min={-40} max={50}
                />
              </div>
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
