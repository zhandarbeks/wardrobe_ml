import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const STYLES = ['Casual', 'Smart Casual', 'Business', 'Sport', 'Streetwear', 'Formal']
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

  const toggle = (key, val) => {
    setPrefs(p => ({
      ...p,
      [key]: p[key].includes(val) ? p[key].filter(x => x !== val) : [...p[key], val],
    }))
  }

  const finish = async () => {
    setLoading(true)
    try {
      await api.put('/api/v1/profile/preferences', {
        styles: prefs.styles.join(','),
        favorite_colors: prefs.favorite_colors.join(','),
        disliked_colors: prefs.disliked_colors.join(','),
        heat_sensitivity: prefs.heat_sensitivity,
        allow_layering: prefs.allow_layering,
      })
    } catch (_) {
      // Non-blocking — preferences can be set later in Profile
    }
    navigate('/')
  }

  const ColorPicker = ({ field, highlightColor }) => (
    <div className="flex flex-wrap gap-8" style={{ marginTop: 8 }}>
      {COLORS.map(c => (
        <div
          key={c}
          title={c}
          onClick={() => toggle(field, c)}
          style={{
            cursor: 'pointer',
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: COLOR_HEX[c] || '#ccc',
            border: `3px solid ${prefs[field].includes(c) ? highlightColor : '#ddd'}`,
            boxShadow: prefs[field].includes(c) ? `0 0 0 2px ${highlightColor}` : 'none',
            transition: 'transform .1s',
            transform: prefs[field].includes(c) ? 'scale(1.15)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  )

  const steps = [
    {
      title: 'Step 1 / 5 — Preferred Styles',
      hint: 'Choose 1–3 styles that match your daily wardrobe',
      content: (
        <div className="grid grid-3" style={{ gap: 10 }}>
          {STYLES.map(s => (
            <button
              key={s}
              onClick={() => toggle('styles', s.toLowerCase())}
              className={`btn ${prefs.styles.includes(s.toLowerCase()) ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '14px 10px' }}
            >
              {s}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'Step 2 / 5 — Favourite Colours',
      hint: 'These colours get a scoring bonus in outfit recommendations',
      content: <ColorPicker field="favorite_colors" highlightColor="#1a1a1a" />,
    },
    {
      title: 'Step 3 / 5 — Disliked Colours',
      hint: 'Outfits containing these colours will score lower',
      content: <ColorPicker field="disliked_colors" highlightColor="#dc2626" />,
    },
    {
      title: 'Step 4 / 5 — Thermal Sensitivity',
      hint: 'Adjusts the temperature thresholds used when picking your outfit',
      content: (
        <div className="grid grid-3" style={{ gap: 10 }}>
          {[
            ['cold',   '🥶', 'I get cold easily',  '+5°C to thresholds'],
            ['normal', '😊', 'Average',             'No adjustment'],
            ['hot',    '🥵', 'I run warm',          '−5°C to thresholds'],
          ].map(([v, icon, label, sub]) => (
            <button
              key={v}
              onClick={() => setPrefs(p => ({ ...p, heat_sensitivity: v }))}
              className={`btn ${prefs.heat_sensitivity === v ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '18px 10px', lineHeight: 1.4, height: 'auto' }}
            >
              <div style={{ fontSize: 24 }}>{icon}</div>
              <div style={{ fontWeight: 600, marginTop: 6 }}>{label}</div>
              <div style={{ fontSize: 11, opacity: .7, marginTop: 2 }}>{sub}</div>
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'Step 5 / 5 — Layered Outfits',
      hint: 'Should the algorithm include mid-layers (sweaters, hoodies) in recommendations?',
      content: (
        <div className="grid grid-2" style={{ gap: 10 }}>
          {[
            [true,  '✅', 'Allow layering',   'Sweaters & hoodies included'],
            [false, '👕', 'Single layer only', 'Base + bottoms only'],
          ].map(([v, icon, label, sub]) => (
            <button
              key={String(v)}
              onClick={() => setPrefs(p => ({ ...p, allow_layering: v }))}
              className={`btn ${prefs.allow_layering === v ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '20px 16px', lineHeight: 1.4, height: 'auto' }}
            >
              <div style={{ fontSize: 28 }}>{icon}</div>
              <div style={{ fontWeight: 600, marginTop: 8 }}>{label}</div>
              <div style={{ fontSize: 11, opacity: .7, marginTop: 2 }}>{sub}</div>
            </button>
          ))}
        </div>
      ),
    },
  ]

  const current = steps[step]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 540 }}>
        {/* Progress bar */}
        <div style={{ background: '#f0f0f0', borderRadius: 4, height: 4, marginBottom: 20 }}>
          <div
            style={{
              background: '#1a1a1a',
              borderRadius: 4,
              height: 4,
              width: `${((step + 1) / steps.length) * 100}%`,
              transition: 'width .3s',
            }}
          />
        </div>

        <h2 style={{ marginBottom: 4 }}>{current.title}</h2>
        <p className="text-sm text-gray mb-16">{current.hint}</p>

        <div style={{ marginBottom: 28 }}>{current.content}</div>

        <div className="flex gap-8 justify-between">
          <button
            className="btn btn-secondary"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
          >
            ← Back
          </button>

          {step < steps.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setStep(s => s + 1)}>
              Next →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={finish} disabled={loading}>
              {loading ? 'Saving…' : 'Finish 🎉'}
            </button>
          )}
        </div>

        <p
          className="text-sm text-gray text-center"
          style={{ marginTop: 16, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          Skip for now
        </p>
      </div>
    </div>
  )
}
