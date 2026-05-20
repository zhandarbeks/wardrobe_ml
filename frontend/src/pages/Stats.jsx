import { useEffect, useState } from 'react'
import api from '../api'

const COLOR_HEX = {
  black: '#1a1a1a', white: '#f0f0f0', gray: '#888', navy: '#0a1e50',
  'royal blue': '#4169e1', 'sky blue': '#87ceeb', teal: '#008080',
  green: '#228b22', olive: '#6b8e23', yellow: '#ffd700', orange: '#ff8c00',
  red: '#c81e1e', burgundy: '#800020', pink: '#ff69b3', purple: '#800080',
  beige: '#e8dcc8', brown: '#8b4513', camel: '#c19a6b',
}
const CAT_ORDER = ['outer', 'top', 'mid', 'bottom', 'footwear', 'accessory']
const SEASONS   = ['winter', 'demi', 'summer', 'all']

function Thumb({ item, size = 48 }) {
  const [src, setSrc] = useState(item.image_no_bg_url || item.image_url || null)
  const fallback = item.image_no_bg_url ? item.image_url : null
  return (
    <div style={{ width: size, height: size, background: 'var(--paper)', border: '1px solid var(--line-soft)', overflow: 'hidden', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      {src
        ? <img src={src} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={() => { if (fallback && src !== fallback) setSrc(fallback); else setSrc(null) }} />
        : <span style={{ fontSize: size * 0.4, opacity: .3 }}>👕</span>}
    </div>
  )
}

function BarRow({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ marginBottom: 6 }}>
      <div className="bru-mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
        <span style={{ textTransform: 'uppercase' }}>{label}</span>
        <span>{String(value).padStart(2, '0')}</span>
      </div>
      <div style={{ height: 6, background: 'var(--line-soft)', border: '1px solid var(--ink)', marginTop: 2 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color || 'var(--accent)' }} />
      </div>
    </div>
  )
}

export default function Stats() {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/v1/wardrobe/stats').then(r => setStats(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="bru-page"><div className="bru-mono" style={{ color: 'var(--mute)' }}>LOADING…</div></div>
  if (!stats || stats.total === 0) {
    return (
      <div className="bru-page">
        <div className="bru-mono">STATS</div>
        <div className="bru-serif" style={{ fontSize: 56, lineHeight: 0.95 }}>The <em style={{ color: 'var(--accent)' }}>numbers</em>.</div>
        <div style={{ textAlign: 'center', padding: 60, border: '1.5px dashed var(--line-soft)', marginTop: 20 }}>
          <div className="bru-serif" style={{ fontSize: 22 }}>No items yet</div>
          <div className="bru-mono" style={{ fontSize: 10, color: 'var(--mute)', marginTop: 8 }}>ADD CLOTHES FIRST TO SEE STATS</div>
        </div>
      </div>
    )
  }

  const catEntries = CAT_ORDER.filter(c => stats.by_category[c] != null).map(c => [c, stats.by_category[c]])
  const catMax = Math.max(...catEntries.map(([, v]) => v), 1)
  const colorEntries = Object.entries(stats.by_color).sort((a, b) => b[1] - a[1])
  const colorMax = Math.max(...colorEntries.map(([, v]) => v), 1)
  const seasonEntries = SEASONS.filter(s => stats.by_season[s] != null).map(s => [s, stats.by_season[s]])
  const seasonMax = Math.max(...seasonEntries.map(([, v]) => v), 1)
  const wornPct = stats.total > 0 ? Math.round((stats.items_ever_worn / stats.total) * 100) : 0

  return (
    <div className="bru-page">
      <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 14, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="bru-mono">STATS</div>
          <div className="bru-serif" style={{ fontSize: 64, lineHeight: 0.95 }}>The <em style={{ color: 'var(--accent)' }}>numbers</em>.</div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, border: '1.5px solid var(--ink)', marginTop: 18 }}>
        {[
          ['TOTAL ITEMS', stats.total],
          ['EVER WORN', `${stats.items_ever_worn} (${wornPct}%)`],
          ['NEVER WORN', stats.never_worn],
          ['OUTFIT WEARS', stats.total_outfit_wears],
        ].map(([l, v], i) => (
          <div key={l} style={{ padding: 14, borderLeft: i > 0 ? '1.5px solid var(--ink)' : 'none' }}>
            <div className="bru-mono" style={{ fontSize: 9 }}>{l}</div>
            <div className="bru-serif" style={{ fontSize: 38, lineHeight: 1, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 }}>
        <div className="bru-card">
          <div className="bru-mono" style={{ marginBottom: 10 }}>BY CATEGORY</div>
          {catEntries.map(([l, v]) => <BarRow key={l} label={l} value={v} max={catMax} />)}
        </div>
        <div className="bru-card">
          <div className="bru-mono" style={{ marginBottom: 10 }}>BY SEASON</div>
          {seasonEntries.map(([l, v]) => <BarRow key={l} label={l} value={v} max={seasonMax} />)}
        </div>
      </div>

      <div className="bru-card" style={{ marginTop: 18 }}>
        <div className="bru-mono" style={{ marginBottom: 10 }}>BY COLOUR</div>
        {colorEntries.map(([l, v]) => <BarRow key={l} label={l} value={v} max={colorMax} color={COLOR_HEX[l] || 'var(--accent)'} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 }}>
        <div className="bru-card">
          <div className="bru-mono" style={{ marginBottom: 10 }}>MOST WORN</div>
          {stats.most_worn.length === 0
            ? <div className="bru-mono" style={{ fontSize: 10, color: 'var(--mute)' }}>NOTHING WORN YET</div>
            : stats.most_worn.map((it, i) => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid var(--line-soft)' }}>
                <span className="bru-mono" style={{ fontSize: 10, width: 18, color: 'var(--mute)' }}>{String(i + 1).padStart(2, '0')}</span>
                <Thumb item={it} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bru-serif" style={{ fontSize: 14, lineHeight: 1.1 }}>{it.name}</div>
                  <div className="bru-mono" style={{ fontSize: 8, color: 'var(--mute)', marginTop: 2 }}>{it.category} · {it.color}</div>
                </div>
                <div className="bru-serif" style={{ fontSize: 18, color: 'var(--accent)' }}>{it.wear_count}</div>
              </div>
            ))}
        </div>
        <div className="bru-card">
          <div className="bru-mono" style={{ marginBottom: 10 }}>LONGEST UNWORN</div>
          {stats.longest_unworn.length === 0
            ? <div className="bru-mono" style={{ fontSize: 10, color: 'var(--mute)' }}>NO ITEMS</div>
            : stats.longest_unworn.map(it => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid var(--line-soft)' }}>
                <Thumb item={it} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bru-serif" style={{ fontSize: 14, lineHeight: 1.1 }}>{it.name}</div>
                  <div className="bru-mono" style={{ fontSize: 8, color: 'var(--mute)', marginTop: 2 }}>{it.category} · {it.color}</div>
                </div>
                {it.never_worn
                  ? <span className="bru-tag" style={{ background: 'var(--accent)', borderColor: 'var(--accent)', color: '#0A0A0A' }}>NEVER</span>
                  : <div style={{ textAlign: 'right' }}>
                      <div className="bru-serif" style={{ fontSize: 18 }}>{it.days_since}d</div>
                      <div className="bru-mono" style={{ fontSize: 8, color: 'var(--mute)' }}>AGO</div>
                    </div>}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
