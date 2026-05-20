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
const LIGHT = new Set(['white', 'beige', 'yellow', 'sky blue', 'pink'])

const STEPS = [
  { kicker: '01', label: 'Your Style',          hint: 'Pick the styles that match your wardrobe.' },
  { kicker: '02', label: 'Favourite Colours',   hint: 'These colours get a bonus in outfit scoring.' },
  { kicker: '03', label: 'Disliked Colours',    hint: 'Outfits with these colours will rank lower.' },
  { kicker: '04', label: 'Thermal Sensitivity', hint: 'Adjusts temperature thresholds for outfit picks.' },
  { kicker: '05', label: 'Outfit Layering',     hint: 'Should the algorithm include layers like sweaters?' },
]

function ColorGrid({ field, symbol, isSelected, onToggle }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 0 }}>
      {COLORS.map(({ id, hex }) => {
        const on = isSelected(field, id)
        const lightBg = LIGHT.has(id)
        return (
          <button
            key={id}
            type="button"
            onClick={() => onToggle(field, id)}
            title={id}
            style={{
              aspectRatio: '1', background: hex,
              border: '1.5px solid var(--ink)', marginLeft: -1.5, marginTop: -1.5,
              cursor: 'pointer', position: 'relative',
              boxShadow: on ? 'inset 0 0 0 3px var(--accent)' : 'none',
              color: lightBg ? '#0A0A0A' : '#fff',
              display: 'grid', placeItems: 'center',
              fontSize: 16, fontWeight: 700,
              opacity: field === 'disliked_colors' && !on ? 0.55 : 1,
            }}
          >
            {on ? symbol : ''}
          </button>
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
  const current = STEPS[step]

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 16px', background: 'var(--paper)',
    }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        {/* Brand */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
          <div className="bru-mono" style={{ fontSize: 14, letterSpacing: '0.25em' }}>T*T</div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="bru-mono"
            style={{
              fontSize: 10, color: 'var(--mute)', background: 'none',
              border: 'none', cursor: 'pointer', letterSpacing: '0.15em',
            }}
          >
            SKIP SETUP ⟶
          </button>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 14 }}>
          <div className="bru-mono" style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 10, marginBottom: 6, color: 'var(--mute)',
          }}>
            <span>STEP {String(step + 1).padStart(2, '0')} OF {String(TOTAL).padStart(2, '0')}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div style={{ height: 4, background: 'var(--line-soft)', border: '1px solid var(--ink)' }}>
            <div style={{
              height: '100%', background: 'var(--accent)',
              width: `${progress}%`, transition: 'width .35s ease',
            }} />
          </div>
        </div>

        {/* Card */}
        <div className="bru-card" style={{ padding: '28px 30px 24px' }}>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 14, marginBottom: 20 }}>
            <div className="bru-mono">CALIBRATION · {current.kicker}</div>
            <div className="bru-serif" style={{ fontSize: 44, lineHeight: 0.95, marginTop: 4 }}>
              {current.label.split(' ').map((w, i, arr) => (
                <span key={i}>
                  {i === arr.length - 1 ? <em style={{ color: 'var(--accent)' }}>{w}</em> : w}
                  {i < arr.length - 1 && ' '}
                </span>
              ))}
              .
            </div>
            <div className="bru-mono" style={{ fontSize: 10, color: 'var(--mute)', marginTop: 8 }}>
              {current.hint.toUpperCase()}
            </div>
          </div>

          {/* Step 1: Styles */}
          {step === 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {STYLES_LIST.map(s => {
                const on = prefs.styles.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle('styles', s)}
                    className={'bru-tag' + (on ? ' on' : '')}
                    style={{ cursor: 'pointer', fontSize: 11, padding: '8px 14px' }}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          )}

          {/* Step 2: Favourite */}
          {step === 1 && (
            <ColorGrid field="favorite_colors" symbol="✓" isSelected={isSelected} onToggle={toggle} />
          )}

          {/* Step 3: Disliked */}
          {step === 2 && (
            <ColorGrid field="disliked_colors" symbol="✕" isSelected={isSelected} onToggle={toggle} />
          )}

          {/* Step 4: Heat sensitivity */}
          {step === 3 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, border: '1.5px solid var(--ink)' }}>
              {[
                { v: 'cold',   label: 'Cold',   desc: 'Warmer thresholds' },
                { v: 'normal', label: 'Normal', desc: 'No adjustment' },
                { v: 'hot',    label: 'Warm',   desc: 'Cooler thresholds' },
              ].map(({ v, label, desc }, i) => {
                const on = prefs.heat_sensitivity === v
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPrefs(p => ({ ...p, heat_sensitivity: v }))}
                    className={on ? 'bru-on-accent' : ''}
                    style={{
                      padding: '18px 12px',
                      borderLeft: i > 0 ? '1.5px solid var(--ink)' : 'none',
                      background: on ? 'var(--accent)' : 'var(--paper)',
                      color: on ? '#0A0A0A' : 'var(--ink)',
                      cursor: 'pointer', textAlign: 'center',
                    }}
                  >
                    <div className="bru-serif" style={{ fontSize: 22, lineHeight: 1 }}>{label}</div>
                    <div className="bru-mono" style={{ fontSize: 9, marginTop: 6, opacity: on ? 0.75 : 0.55 }}>
                      {desc.toUpperCase()}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Step 5: Layering */}
          {step === 4 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, border: '1.5px solid var(--ink)' }}>
              {[
                { v: true,  label: 'Allow layering', desc: 'Include sweaters, hoodies and mid-layers in outfits' },
                { v: false, label: 'Single layer',   desc: 'Base layer and bottoms only, no extra layers' },
              ].map(({ v, label, desc }, i) => {
                const on = prefs.allow_layering === v
                return (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setPrefs(p => ({ ...p, allow_layering: v }))}
                    className={on ? 'bru-on-accent' : ''}
                    style={{
                      padding: '22px 16px',
                      borderLeft: i > 0 ? '1.5px solid var(--ink)' : 'none',
                      background: on ? 'var(--accent)' : 'var(--paper)',
                      color: on ? '#0A0A0A' : 'var(--ink)',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div className="bru-serif" style={{ fontSize: 22, lineHeight: 1 }}>{label}</div>
                    <div className="bru-mono" style={{ fontSize: 9, marginTop: 8, opacity: on ? 0.75 : 0.55, lineHeight: 1.4 }}>
                      {desc.toUpperCase()}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Footer nav */}
          <div style={{ marginTop: 26, paddingTop: 18, borderTop: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="button"
              className="bru-btn"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              style={{
                visibility: step === 0 ? 'hidden' : 'visible',
                height: 36, padding: '0 18px', fontSize: 11,
              }}
            >
              ⟵ Back
            </button>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{
                  height: 6, background: i <= step ? 'var(--ink)' : 'var(--line-soft)',
                  width: i === step ? 24 : 6,
                  transition: 'width .25s',
                }} />
              ))}
            </div>

            {step < TOTAL - 1 ? (
              <button
                type="button"
                className="bru-btn bru-btn-accent bru-on-accent"
                onClick={() => setStep(s => s + 1)}
                style={{ height: 36, padding: '0 22px', fontSize: 11 }}
              >
                Next ⟶
              </button>
            ) : (
              <button
                type="button"
                className="bru-btn bru-btn-accent bru-on-accent"
                onClick={finish}
                disabled={loading}
                style={{ height: 36, padding: '0 22px', fontSize: 11 }}
              >
                {loading ? 'Saving…' : 'Finish ⟶'}
              </button>
            )}
          </div>
        </div>

        <div className="bru-mono" style={{ textAlign: 'center', fontSize: 10, color: 'var(--mute)', marginTop: 16, letterSpacing: '0.15em' }}>
          YOU CAN CHANGE THESE LATER IN PROFILE
        </div>
      </div>
    </div>
  )
}
