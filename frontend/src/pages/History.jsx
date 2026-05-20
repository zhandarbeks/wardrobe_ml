import { useEffect, useMemo, useState } from 'react'
import api from '../api'

const CAT_ORDER = { outer: 0, top: 1, mid: 2, bottom: 3, footwear: 4, accessory: 5 }
const WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
                'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']

const dateKey = d => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

function Thumb({ item, size = 48, fill = false }) {
  const [src, setSrc] = useState(item.image_no_bg_url || item.image_url || null)
  const fallback = item.image_no_bg_url ? item.image_url : null
  const box = fill
    ? { width: '100%', height: '100%' }
    : { width: size, height: size, flexShrink: 0 }
  return (
    <div style={{ ...box, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
      {src
        ? <img src={src} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={() => { if (fallback && src !== fallback) setSrc(fallback); else setSrc(null) }} />
        : <span style={{ fontSize: size * 0.4, opacity: .3 }}>👕</span>}
    </div>
  )
}

const heatColor = n =>
  n === 0 ? 'transparent' :
  n === 1 ? 'var(--accent)' :
  n === 2 ? 'oklch(0.55 0.18 100)' : 'var(--ink)'
// fg colour for day text. Cells with accent bg always need dark text (cream-on-lime is unreadable in night mode).
const heatFg = (n, oof) => {
  if (oof) return 'var(--mute)'
  if (n === 1) return '#0A0A0A'          // on accent → always dark
  if (n >= 3) return 'var(--accent)'     // on ink → accent reads on both modes
  return 'var(--ink)'                    // count 0 or 2 → default ink
}

export default function History() {
  const [outfits, setOutfits] = useState([])
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [selectedKey, setSelectedKey] = useState(dateKey(new Date()))

  useEffect(() => {
    api.get('/api/v1/outfits').then(r => setOutfits(r.data)).finally(() => setLoading(false))
  }, [])

  const byDate = useMemo(() => {
    const m = {}
    for (const o of outfits) {
      if (!o.used_at) continue
      const k = dateKey(o.used_at)
      if (!m[k]) m[k] = []
      m[k].push(o)
    }
    return m
  }, [outfits])

  const stats = useMemo(() => {
    const total = Object.keys(byDate).length
    const now = new Date()
    const thirty = new Date(now); thirty.setDate(now.getDate() - 29)
    let last30 = 0
    for (const k of Object.keys(byDate)) {
      if (new Date(k) >= thirty) last30 += 1
    }
    return { total, last30, allTime: outfits.filter(o => o.used_at).length }
  }, [byDate, outfits])

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const offset = (first.getDay() + 6) % 7
    const start = new Date(first); start.setDate(first.getDate() - offset)
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  }, [cursor])

  const selectedOutfits = byDate[selectedKey] || []
  const todayKey = dateKey(new Date())

  return (
    <div className="bru-page">
      <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 14, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="bru-mono">WEAR HISTORY</div>
          <div className="bru-serif" style={{ fontSize: 64, lineHeight: 0.95 }}>The <em style={{ color: 'var(--accent)' }}>archive</em>.</div>
        </div>
        <div style={{ display: 'flex', gap: 14, textAlign: 'right' }}>
          {[
            ['DAYS WORN', stats.total],
            ['LAST 30 DAYS', stats.last30],
            ['ALL-TIME WEARS', stats.allTime],
          ].map(([l, v]) => (
            <div key={l}>
              <div className="bru-mono" style={{ fontSize: 9 }}>{l}</div>
              <div className="bru-serif" style={{ fontSize: 36, lineHeight: 1 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18, marginTop: 18 }}>
        {/* Calendar */}
        <div className="bru-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <button className="bru-btn" style={{ height: 32, padding: '0 14px', fontSize: 11 }} onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}>‹</button>
            <div className="bru-serif" style={{ flex: 1, textAlign: 'center', fontSize: 26 }}>
              {MONTHS[cursor.getMonth()]} <span style={{ color: 'var(--accent)' }}>{cursor.getFullYear()}</span>
            </div>
            <button className="bru-btn" style={{ height: 32, padding: '0 14px', fontSize: 11 }} onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); setSelectedKey(dateKey(new Date())) }}>TODAY</button>
            <button className="bru-btn" style={{ height: 32, padding: '0 14px', fontSize: 11 }} onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
            {WEEK.map(w => (
              <div key={w} className="bru-mono" style={{ fontSize: 9, textAlign: 'center', color: 'var(--mute)', padding: '4px 0' }}>{w}</div>
            ))}
          </div>

          {loading ? (
            <div className="bru-mono" style={{ textAlign: 'center', padding: 60, color: 'var(--mute)' }}>LOADING…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {grid.map((d, i) => {
                const key = dateKey(d)
                const outOfMonth = d.getMonth() !== cursor.getMonth()
                const wornList = byDate[key] || []
                const count = wornList.length
                const isToday = key === todayKey
                const isSelected = key === selectedKey
                return (
                  <div key={i} onClick={() => setSelectedKey(key)} title={count ? `${count} outfit${count > 1 ? 's' : ''} worn` : 'No wears'}
                    style={{
                      cursor: 'pointer', aspectRatio: '1', padding: 2,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      background: count > 0 ? heatColor(count) : 'transparent',
                      border: isSelected ? '2.5px solid var(--ink)' : isToday ? '2px dashed var(--accent)' : '1.5px solid var(--line-soft)',
                      opacity: outOfMonth && count === 0 ? 0.35 : 1,
                    }}>
                    <div className="bru-serif" style={{ fontSize: 16, lineHeight: 1, color: heatFg(count, outOfMonth), fontWeight: isToday ? 700 : 400 }}>
                      {d.getDate()}
                    </div>
                    {count > 0 && (
                      <div className="bru-mono" style={{
                        fontSize: 8, marginTop: 2,
                        color: count === 1 ? '#0A0A0A' : count >= 3 ? 'var(--accent)' : 'var(--ink)',
                      }}>{count}×</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--mute)' }}>
            <span>LESS</span>
            {[0, 1, 2, 3].map(n => (
              <div key={n} style={{ width: 14, height: 14, background: n === 0 ? 'transparent' : heatColor(n), border: '1px solid var(--ink)' }} />
            ))}
            <span>MORE</span>
            <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>⌐ TODAY  ▪ SELECTED</span>
          </div>
        </div>

        {/* Selected day panel */}
        <div className="bru-card">
          <div className="bru-mono">SELECTED</div>
          <div className="bru-serif" style={{ fontSize: 20, lineHeight: 1.1, marginTop: 4 }}>
            {new Date(selectedKey).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          {selectedKey === todayKey && <div className="bru-mono" style={{ fontSize: 9, color: 'var(--accent)', marginTop: 4 }}>· TODAY</div>}

          <div className="bru-mono" style={{ marginTop: 14, marginBottom: 8, borderTop: '1px solid var(--ink)', paddingTop: 8 }}>
            {selectedOutfits.length} OUTFIT{selectedOutfits.length === 1 ? '' : 'S'} WORN
          </div>

          {selectedOutfits.length === 0 ? (
            <div className="bru-mono" style={{ fontSize: 10, color: 'var(--mute)', textAlign: 'center', padding: '20px 0' }}>
              NO WEARS LOGGED<br/>FOR THIS DAY
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selectedOutfits.map(o => {
                const sorted = [...o.items].sort((a, b) => (CAT_ORDER[a.category] ?? 9) - (CAT_ORDER[b.category] ?? 9))
                return (
                  <div key={o.id} style={{ border: '1.5px solid var(--ink)', padding: 10 }}>
                    <div className="bru-serif" style={{ fontSize: 14 }}>{o.name}</div>
                    <div className="bru-mono" style={{ fontSize: 9, color: 'var(--mute)', marginTop: 2 }}>
                      {(o.occasion || 'any').toUpperCase()}
                      {o.weather_temp != null && ` · ${Math.round(o.weather_temp)}°`}
                      {o.score != null && ` · ${Math.round(o.score * 100)}/100`}
                    </div>
                    <div style={{ display: 'flex', marginTop: 8, border: '1.5px solid var(--ink)', overflow: 'hidden' }}>
                      {sorted.slice(0, 5).map((item, i) => (
                        <div key={item.id} style={{
                          flex: '1 1 0', minWidth: 0, aspectRatio: '1',
                          display: 'grid', placeItems: 'center', padding: 4,
                          borderLeft: i > 0 ? '1px solid var(--line-soft)' : 'none',
                        }}>
                          <Thumb item={item} fill />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
