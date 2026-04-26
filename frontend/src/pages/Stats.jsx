import { useEffect, useState } from 'react'
import api from '../api'

const COLOR_HEX = {
  black: '#1a1a1a', white: '#f5f5f5', gray: '#888', navy: '#0a1e50',
  'royal blue': '#4169e1', 'sky blue': '#87ceeb', teal: '#008080',
  green: '#228b22', olive: '#6b8e23', yellow: '#ffd700', orange: '#ff8c00',
  red: '#c81e1e', burgundy: '#800020', pink: '#ff69b3', purple: '#800080',
  beige: '#f5f5dc', brown: '#8b4513', camel: '#c19a6b',
}

const CAT_ORDER = ['outer', 'top', 'mid', 'bottom', 'footwear', 'accessory']
const SEASONS   = ['winter', 'demi', 'summer', 'all']

function Thumb({ item, size = 56 }) {
  const [src, setSrc] = useState(item.image_no_bg_url || item.image_url || null)
  const fallback = item.image_no_bg_url ? item.image_url : null
  return (
    <div style={{
      width: size, height: size, borderRadius: 8, flexShrink: 0,
      background: '#f5f5f5', border: '1px solid #eee', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {src ? (
        <img
          src={src} alt={item.name}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onError={() => { if (fallback && src !== fallback) setSrc(fallback); else setSrc(null) }}
        />
      ) : (
        <span style={{ fontSize: size * 0.4, opacity: .3 }}>👕</span>
      )}
    </div>
  )
}

// horizontal bar chart (label · bar · count)
function BarChart({ data, max, getColor, capitalize = true }) {
  if (data.length === 0) {
    return <p className="text-gray text-sm">No data yet</p>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map(([label, value]) => {
        const pct = max > 0 ? (value / max) * 100 : 0
        const bg  = getColor ? getColor(label) : '#1a1a1a'
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 90, fontSize: 12, color: '#555',
              textTransform: capitalize ? 'capitalize' : 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {label}
            </div>
            <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 4, height: 16, overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%', background: bg,
                transition: 'width .25s',
              }} />
            </div>
            <div style={{ width: 28, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>{value}</div>
          </div>
        )
      })}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
        textTransform: 'uppercase', color: '#999', marginBottom: 14,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

export default function Stats() {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/v1/wardrobe/stats')
      .then(r => setStats(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page"><p className="text-gray">Loading…</p></div>
  if (!stats || stats.total === 0) {
    return (
      <div className="page">
        <h1>Wardrobe Stats</h1>
        <div className="card text-center" style={{ padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <p className="text-gray">No items yet — add some clothes first to see stats.</p>
        </div>
      </div>
    )
  }

  // by category — fixed order with zeros for missing keys
  const catEntries = CAT_ORDER
    .filter(c => stats.by_category[c] != null)
    .map(c => [c, stats.by_category[c]])
  const catMax = Math.max(...catEntries.map(([, v]) => v), 1)

  // by color — sorted desc
  const colorEntries = Object.entries(stats.by_color).sort((a, b) => b[1] - a[1])
  const colorMax = Math.max(...colorEntries.map(([, v]) => v), 1)

  // by season — fixed order
  const seasonEntries = SEASONS
    .filter(s => stats.by_season[s] != null)
    .map(s => [s, stats.by_season[s]])
  const seasonMax = Math.max(...seasonEntries.map(([, v]) => v), 1)

  const wornPct = stats.total > 0
    ? Math.round((stats.items_ever_worn / stats.total) * 100)
    : 0

  return (
    <div className="page" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1>Wardrobe Stats</h1>

      {/* KPIs */}
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        {[
          ['Total items',        stats.total],
          ['Ever worn',          `${stats.items_ever_worn} (${wornPct}%)`],
          ['Never worn',         stats.never_worn],
          ['Outfit wears',       stats.total_outfit_wears],
        ].map(([label, val]) => (
          <div key={label} className="card text-center">
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{val}</div>
            <div className="text-sm text-gray">{label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <Section title="By Category">
          <BarChart data={catEntries} max={catMax} />
        </Section>

        <Section title="By Season">
          <BarChart
            data={seasonEntries}
            max={seasonMax}
            getColor={s => ({
              winter: '#3b82f6', demi: '#a3a3a3', summer: '#f59e0b', all: '#10b981',
            }[s] || '#1a1a1a')}
          />
        </Section>
      </div>

      <div style={{ marginBottom: 20 }}>
        <Section title="By Colour">
          <BarChart
            data={colorEntries}
            max={colorMax}
            getColor={c => COLOR_HEX[c] || '#888'}
          />
        </Section>
      </div>

      {/* Most worn / Longest unworn */}
      <div className="grid grid-2">
        <Section title="Most Worn">
          {stats.most_worn.length === 0 ? (
            <p className="text-gray text-sm">Nothing has been worn yet — mark outfits as worn from Outfits tab.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stats.most_worn.map((it, i) => (
                <div key={it.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: 8, borderRadius: 8,
                  background: i === 0 ? '#fefce8' : 'transparent',
                  border: i === 0 ? '1px solid #fde68a' : '1px solid transparent',
                }}>
                  <div style={{
                    width: 22, textAlign: 'center', fontSize: 13, fontWeight: 700,
                    color: i === 0 ? '#ca8a04' : '#999',
                  }}>
                    {i === 0 ? '🥇' : `#${i + 1}`}
                  </div>
                  <Thumb item={it} size={50} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#888', textTransform: 'capitalize', marginTop: 2 }}>
                      {it.category} · {it.color}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{it.wear_count}</div>
                    <div style={{ fontSize: 10, color: '#aaa' }}>wears</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Longest Unworn">
          {stats.longest_unworn.length === 0 ? (
            <p className="text-gray text-sm">No items.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stats.longest_unworn.map(it => (
                <div key={it.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: 8, borderRadius: 8,
                  background: it.never_worn ? '#fef2f2' : 'transparent',
                  border: it.never_worn ? '1px solid #fecaca' : '1px solid transparent',
                }}>
                  <Thumb item={it} size={50} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#888', textTransform: 'capitalize', marginTop: 2 }}>
                      {it.category} · {it.color}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {it.never_worn ? (
                      <span className="tag" style={{ background: '#fee2e2', color: '#dc2626' }}>
                        Never worn
                      </span>
                    ) : (
                      <>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{it.days_since}d</div>
                        <div style={{ fontSize: 10, color: '#aaa' }}>ago</div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
