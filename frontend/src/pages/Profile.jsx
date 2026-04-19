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

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: '#999', marginBottom: 12,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

export default function Profile() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const [prefs, setPrefs] = useState({
    styles: '', favorite_colors: '', disliked_colors: '',
    heat_sensitivity: 'normal', allow_layering: true,
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => {
    api.get('/api/v1/profile/preferences').then(r => setPrefs(r.data))
  }, [])

  const toggle = (field, val) => {
    const arr  = (prefs[field] || '').split(',').filter(Boolean)
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
    <div className="page" style={{ maxWidth: 600, margin: '0 auto' }}>

      {/* Avatar + user block */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        marginBottom: 32,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#1a1a1a', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 700, flexShrink: 0,
        }}>
          {initials}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{user.name}</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{user.email}</div>
        </div>
        <span className="tag" style={{ marginLeft: 'auto' }}>{user.role}</span>
      </div>

      <div className="card" style={{ padding: 28 }}>

        {/* Styles */}
        <Section title="Preferred Styles">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {STYLES_LIST.map(s => (
              <button
                key={s}
                onClick={() => toggle('styles', s)}
                style={{
                  padding: '8px 0', borderRadius: 20, fontSize: 13,
                  fontWeight: 500, cursor: 'pointer', transition: 'all .15s',
                  border: has('styles', s) ? '1.5px solid #1a1a1a' : '1.5px solid #e5e5e5',
                  background: has('styles', s) ? '#1a1a1a' : '#fafafa',
                  color:      has('styles', s) ? '#fff'    : '#555',
                  textTransform: 'capitalize', textAlign: 'center',
                }}
              >{s}</button>
            ))}
          </div>
        </Section>

        <div style={{ height: 1, background: '#f0f0f0', margin: '4px 0 28px' }} />

        {/* Favourite colours */}
        <Section title="Favourite Colours">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 10 }}>
            {COLORS.map(c => (
              <div key={c} title={c} onClick={() => toggle('favorite_colors', c)}
                style={{ position: 'relative', cursor: 'pointer', aspectRatio: '1' }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  background: COLOR_HEX[c] || '#ccc',
                  border: `3px solid ${has('favorite_colors', c) ? '#1a1a1a' : '#e5e5e5'}`,
                  boxSizing: 'border-box',
                  transition: 'border-color .1s',
                }} />
                {has('favorite_colors', c) && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    color: ['white','beige','yellow','sky blue'].includes(c) ? '#333' : '#fff',
                  }}>✓</div>
                )}
              </div>
            ))}
          </div>
        </Section>

        <div style={{ height: 1, background: '#f0f0f0', margin: '4px 0 28px' }} />

        {/* Disliked colours */}
        <Section title="Disliked Colours">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 10 }}>
            {COLORS.map(c => (
              <div key={c} title={c} onClick={() => toggle('disliked_colors', c)}
                style={{ position: 'relative', cursor: 'pointer', aspectRatio: '1' }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  background: COLOR_HEX[c] || '#ccc',
                  border: `3px solid ${has('disliked_colors', c) ? '#dc2626' : '#e5e5e5'}`,
                  boxSizing: 'border-box',
                  opacity: has('disliked_colors', c) ? 1 : 0.45,
                  transition: 'border-color .1s, opacity .1s',
                }} />
                {has('disliked_colors', c) && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    color: ['white','beige','yellow','sky blue'].includes(c) ? '#333' : '#fff',
                  }}>✕</div>
                )}
              </div>
            ))}
          </div>
        </Section>

        <div style={{ height: 1, background: '#f0f0f0', margin: '4px 0 28px' }} />

        {/* Thermal sensitivity */}
        <Section title="Thermal Sensitivity">
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { v: 'cold',   label: 'Cold',   emoji: '🥶', desc: 'I feel cold easily' },
              { v: 'normal', label: 'Normal',  emoji: '😊', desc: 'Average sensitivity' },
              { v: 'hot',    label: 'Warm',    emoji: '🥵', desc: 'I run hot' },
            ].map(({ v, label, emoji, desc }) => {
              const active = prefs.heat_sensitivity === v
              return (
                <div
                  key={v}
                  onClick={() => setPrefs(p => ({ ...p, heat_sensitivity: v }))}
                  style={{
                    flex: 1, padding: '12px 8px', borderRadius: 10, cursor: 'pointer',
                    textAlign: 'center', transition: 'all .15s',
                    border: `2px solid ${active ? '#1a1a1a' : '#e5e5e5'}`,
                    background: active ? '#1a1a1a' : '#fafafa',
                    color: active ? '#fff' : '#555',
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 11, opacity: .7, marginTop: 2 }}>{desc}</div>
                </div>
              )
            })}
          </div>
        </Section>

        <div style={{ height: 1, background: '#f0f0f0', margin: '4px 0 28px' }} />

        {/* Layering */}
        <Section title="Outfit Layering">
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { v: true,  label: 'Allow layering',  emoji: '🧥', desc: 'Mid + outer layers' },
              { v: false, label: 'Single layer',     emoji: '👕', desc: 'One piece per slot' },
            ].map(({ v, label, emoji, desc }) => {
              const active = prefs.allow_layering === v
              return (
                <div
                  key={String(v)}
                  onClick={() => setPrefs(p => ({ ...p, allow_layering: v }))}
                  style={{
                    flex: 1, padding: '12px 8px', borderRadius: 10, cursor: 'pointer',
                    textAlign: 'center', transition: 'all .15s',
                    border: `2px solid ${active ? '#1a1a1a' : '#e5e5e5'}`,
                    background: active ? '#1a1a1a' : '#fafafa',
                    color: active ? '#fff' : '#555',
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 11, opacity: .7, marginTop: 2 }}>{desc}</div>
                </div>
              )
            })}
          </div>
        </Section>

        {saved && (
          <div className="alert alert-success" style={{ marginBottom: 16 }}>
            Preferences saved!
          </div>
        )}

        <button
          className="btn btn-primary w-full"
          style={{ height: 44, fontSize: 15 }}
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </div>
    </div>
  )
}
