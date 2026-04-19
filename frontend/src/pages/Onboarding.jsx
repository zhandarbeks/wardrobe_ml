import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const STYLES_LIST = ['casual', 'smart casual', 'business', 'sport', 'streetwear', 'formal']

const COLORS = [
  { id: 'black',      hex: '#1a1a1a' },
  { id: 'white',      hex: '#f0f0f0' },
  { id: 'gray',       hex: '#888'    },
  { id: 'navy',       hex: '#0a1e50' },
  { id: 'royal blue', hex: '#4169e1' },
  { id: 'sky blue',   hex: '#87ceeb' },
  { id: 'teal',       hex: '#008080' },
  { id: 'green',      hex: '#228b22' },
  { id: 'olive',      hex: '#6b8e23' },
  { id: 'yellow',     hex: '#ffd700' },
  { id: 'orange',     hex: '#ff8c00' },
  { id: 'red',        hex: '#c81e1e' },
  { id: 'burgundy',   hex: '#800020' },
  { id: 'pink',       hex: '#ff69b3' },
  { id: 'purple',     hex: '#800080' },
  { id: 'beige',      hex: '#e8dcc8' },
  { id: 'brown',      hex: '#8b4513' },
  { id: 'camel',      hex: '#c19a6b' },
]
const LIGHT = ['white', 'beige', 'yellow', 'sky blue']

const STEPS = [
  { label: 'Your Style',           hint: 'Pick the styles that best match your wardrobe.' },
  { label: 'Favourite Colours',    hint: 'These colours get a bonus in outfit scoring.' },
  { label: 'Colours You Dislike',  hint: 'Outfits with these colours will rank lower.' },
  { label: 'Thermal Sensitivity',  hint: 'Adjusts temperature thresholds for outfit picks.' },
  { label: 'Outfit Layering',      hint: 'Should the algorithm include layers like sweaters?' },
]

function ColorGrid({ field, accent, symbol, isSelected, onToggle }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap',
      justifyContent: 'center', gap: '12px 10px',
    }}>
      {COLORS.map(({ id, hex }) => {
        const on = isSelected(field, id)
        return (
          <div
            key={id}
            onClick={() => onToggle(field, id)}
            title={id}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer' }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: hex,
              border: `2.5px solid ${on ? accent : '#e0e0e0'}`,
              boxShadow: on ? `0 0 0 2px ${accent}33` : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color .12s, box-shadow .12s',
              opacity: field === 'disliked_colors' && !on ? 0.42 : 1,
            }}>
              {on && (
                <span style={{
                  fontSize: 13, fontWeight: 700, lineHeight: 1,
                  color: LIGHT.includes(id) ? '#333' : '#fff',
                }}>{symbol}</span>
              )}
            </div>
            <span style={{
              fontSize: 9, color: '#aaa', textAlign: 'center',
              textTransform: 'capitalize', lineHeight: 1.2, maxWidth: 40,
            }}>{id}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [prefs, setPrefs] = useState({
    styles: [],
    favorite_colors: [],
    disliked_colors: [],
    heat_sensitivity: 'normal',
    allow_layering: true,
  })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const toggle = (key, val) =>
    setPrefs(p => ({
      ...p,
      [key]: p[key].includes(val) ? p[key].filter(x => x !== val) : [...p[key], val],
    }))

  const isSelected = (field, val) => prefs[field].includes(val)

  const finish = async () => {
    setLoading(true)
    try {
      await api.put('/api/v1/profile/preferences', {
        styles:           prefs.styles.join(','),
        favorite_colors:  prefs.favorite_colors.join(','),
        disliked_colors:  prefs.disliked_colors.join(','),
        heat_sensitivity: prefs.heat_sensitivity,
        allow_layering:   prefs.allow_layering,
      })
    } catch (_) {}
    navigate('/')
  }

  const TOTAL = STEPS.length
  const progress = ((step + 1) / TOTAL) * 100

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', background: '#f5f5f5',
    }}>
      <div style={{ width: '100%', maxWidth: 520 }}>

        {/* Progress bar + step counter */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#999', letterSpacing: '0.04em' }}>
              Step {step + 1} / {TOTAL}
            </span>
            <span
              onClick={() => navigate('/')}
              style={{ fontSize: 12, color: '#bbb', cursor: 'pointer', userSelect: 'none' }}
            >
              Skip setup
            </span>
          </div>
          <div style={{ height: 3, background: '#e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: '#1a1a1a', borderRadius: 2,
              width: `${progress}%`, transition: 'width .35s ease',
            }} />
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: 14,
          boxShadow: '0 2px 16px rgba(0,0,0,0.09)',
          padding: '28px 28px 24px',
        }}>

          {/* Step title */}
          <div style={{ marginBottom: 22 }}>
            <h2 style={{ margin: '0 0 5px', fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>
              {STEPS[step].label}
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: '#999', lineHeight: 1.5 }}>
              {STEPS[step].hint}
            </p>
          </div>

          {/* ── Step 1: Styles ── */}
          {step === 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {STYLES_LIST.map(s => {
                const on = prefs.styles.includes(s)
                return (
                  <button
                    key={s}
                    onClick={() => toggle('styles', s)}
                    style={{
                      padding: '10px 0', borderRadius: 20, fontSize: 13,
                      fontWeight: 500, cursor: 'pointer', transition: 'all .15s',
                      border: `1.5px solid ${on ? '#1a1a1a' : '#e5e5e5'}`,
                      background: on ? '#1a1a1a' : '#fafafa',
                      color: on ? '#fff' : '#555',
                      textTransform: 'capitalize', textAlign: 'center',
                    }}
                  >{s}</button>
                )
              })}
            </div>
          )}

          {/* ── Step 2: Favourite colours ── */}
          {step === 1 && (
            <ColorGrid field="favorite_colors" accent="#1a1a1a" symbol="✓"
              isSelected={isSelected} onToggle={toggle} />
          )}

          {/* ── Step 3: Disliked colours ── */}
          {step === 2 && (
            <ColorGrid field="disliked_colors" accent="#dc2626" symbol="✕"
              isSelected={isSelected} onToggle={toggle} />
          )}

          {/* ── Step 4: Thermal sensitivity ── */}
          {step === 3 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { v: 'cold',   label: 'Cold',   desc: 'Warmer thresholds' },
                { v: 'normal', label: 'Normal',  desc: 'No adjustment' },
                { v: 'hot',    label: 'Warm',    desc: 'Cooler thresholds' },
              ].map(({ v, label, desc }) => {
                const on = prefs.heat_sensitivity === v
                return (
                  <div key={v} onClick={() => setPrefs(p => ({ ...p, heat_sensitivity: v }))}
                    style={{
                      padding: '14px 10px', borderRadius: 10, cursor: 'pointer',
                      textAlign: 'center', transition: 'all .15s',
                      border: `1.5px solid ${on ? '#1a1a1a' : '#e5e5e5'}`,
                      background: on ? '#1a1a1a' : '#fafafa',
                      color: on ? '#fff' : '#555',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 11, opacity: .65, marginTop: 4, lineHeight: 1.3 }}>{desc}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Step 5: Layering ── */}
          {step === 4 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { v: true,  label: 'Allow layering', desc: 'Include sweaters, hoodies and mid-layers in outfit suggestions' },
                { v: false, label: 'Single layer',    desc: 'Base layer and bottoms only, no extra layers' },
              ].map(({ v, label, desc }) => {
                const on = prefs.allow_layering === v
                return (
                  <div key={String(v)} onClick={() => setPrefs(p => ({ ...p, allow_layering: v }))}
                    style={{
                      padding: '16px 14px', borderRadius: 10, cursor: 'pointer',
                      textAlign: 'center', transition: 'all .15s',
                      border: `1.5px solid ${on ? '#1a1a1a' : '#e5e5e5'}`,
                      background: on ? '#1a1a1a' : '#fafafa',
                      color: on ? '#fff' : '#555',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 11, opacity: .65, lineHeight: 1.4 }}>{desc}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: '#f0f0f0', margin: '24px 0 20px' }} />

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="btn btn-secondary btn-sm"
              style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
            >
              Back
            </button>

            {/* Step dots */}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{
                  height: 6, borderRadius: 3, transition: 'all .25s',
                  width: i === step ? 18 : 6,
                  background: i < step ? '#1a1a1a' : i === step ? '#1a1a1a' : '#ddd',
                }} />
              ))}
            </div>

            {step < TOTAL - 1 ? (
              <button className="btn btn-primary btn-sm" onClick={() => setStep(s => s + 1)}>
                Next
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={finish} disabled={loading}>
                {loading ? 'Saving…' : 'Finish'}
              </button>
            )}
          </div>

        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#ccc', marginTop: 16 }}>
          You can always change these in your Profile
        </p>
      </div>
    </div>
  )
}
