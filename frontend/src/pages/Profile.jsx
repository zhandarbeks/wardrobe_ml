import { useEffect, useState } from 'react'
import api from '../api'

const STYLES_LIST = ['casual', 'smart casual', 'business', 'sport', 'streetwear', 'formal']
const COLORS = [
  'black', 'white', 'gray', 'navy', 'royal blue', 'sky blue',
  'teal', 'green', 'olive', 'yellow', 'orange', 'red',
  'burgundy', 'pink', 'purple', 'beige', 'brown', 'camel',
]
const COLOR_HEX = {
  black: '#1a1a1a', white: '#f5f5f5', gray: '#888', navy: '#0a1e50',
  'royal blue': '#4169e1', 'sky blue': '#87ceeb', teal: '#008080',
  green: '#228b22', olive: '#6b8e23', yellow: '#ffd700', orange: '#ff8c00',
  red: '#c81e1e', burgundy: '#800020', pink: '#ff69b3', purple: '#800080',
  beige: '#f5f5dc', brown: '#8b4513', camel: '#c19a6b',
}

export default function Profile() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const [prefs, setPrefs] = useState({
    styles: '',
    favorite_colors: '',
    disliked_colors: '',
    heat_sensitivity: 'normal',
    allow_layering: true,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get('/api/v1/profile/preferences').then(r => setPrefs(r.data))
  }, [])

  const toggle = (field, val) => {
    const arr = (prefs[field] || '').split(',').filter(Boolean)
    const next = arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
    setPrefs(p => ({ ...p, [field]: next.join(',') }))
  }
  const has = (field, val) => (prefs[field] || '').split(',').includes(val)

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/api/v1/profile/preferences', prefs)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <h1>Profile & Preferences</h1>

      <div className="card" style={{ maxWidth: 620 }}>
        {/* User info */}
        <div style={{
          background: '#f5f5f5', borderRadius: 8,
          padding: '12px 16px', marginBottom: 24,
        }}>
          <div style={{ fontWeight: 600 }}>{user.name}</div>
          <div className="text-sm text-gray">{user.email}</div>
          <span className="tag" style={{ marginTop: 4 }}>{user.role}</span>
        </div>

        {/* Styles */}
        <h3 className="mb-8">Preferred Styles</h3>
        <div className="flex flex-wrap gap-8 mb-16">
          {STYLES_LIST.map(s => (
            <button
              key={s}
              onClick={() => toggle('styles', s)}
              className={`btn btn-sm ${has('styles', s) ? 'btn-primary' : 'btn-secondary'}`}
              style={{ textTransform: 'capitalize' }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Favourite colours */}
        <h3 className="mb-8">Favourite Colours</h3>
        <div className="flex flex-wrap gap-8 mb-16">
          {COLORS.map(c => (
            <div
              key={c}
              title={c}
              onClick={() => toggle('favorite_colors', c)}
              style={{
                cursor: 'pointer',
                width: 32, height: 32, borderRadius: '50%',
                background: COLOR_HEX[c] || '#ccc',
                border: `3px solid ${has('favorite_colors', c) ? '#1a1a1a' : '#ddd'}`,
                transform: has('favorite_colors', c) ? 'scale(1.15)' : 'scale(1)',
                transition: 'transform .1s',
              }}
            />
          ))}
        </div>

        {/* Disliked colours */}
        <h3 className="mb-8">Disliked Colours</h3>
        <div className="flex flex-wrap gap-8 mb-16">
          {COLORS.map(c => (
            <div
              key={c}
              title={c}
              onClick={() => toggle('disliked_colors', c)}
              style={{
                cursor: 'pointer',
                width: 32, height: 32, borderRadius: '50%',
                background: COLOR_HEX[c] || '#ccc',
                border: `3px solid ${has('disliked_colors', c) ? '#dc2626' : '#ddd'}`,
                opacity: has('disliked_colors', c) ? 1 : 0.55,
                transition: 'opacity .1s',
              }}
            />
          ))}
        </div>

        {/* Thermal sensitivity */}
        <h3 className="mb-8">Thermal Sensitivity</h3>
        <div className="flex gap-8 mb-16">
          {[['cold', '🥶 Cold'], ['normal', '😊 Normal'], ['hot', '🥵 Warm']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setPrefs(p => ({ ...p, heat_sensitivity: v }))}
              className={`btn btn-sm ${prefs.heat_sensitivity === v ? 'btn-primary' : 'btn-secondary'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Layering */}
        <h3 className="mb-8">Layered Outfits</h3>
        <div className="flex gap-8 mb-16">
          {[[true, '✅ Allow layering'], [false, '👕 Single layer']].map(([v, l]) => (
            <button
              key={String(v)}
              onClick={() => setPrefs(p => ({ ...p, allow_layering: v }))}
              className={`btn btn-sm ${prefs.allow_layering === v ? 'btn-primary' : 'btn-secondary'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {saved && <div className="alert alert-success">Preferences saved!</div>}

        <button
          className="btn btn-primary w-full"
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </div>
    </div>
  )
}
