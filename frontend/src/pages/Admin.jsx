import { useEffect, useState } from 'react'
import api from '../api'

const TABS = [
  { id: 'stats',   label: 'OVERVIEW' },
  { id: 'users',   label: 'USERS' },
  { id: 'ml-logs', label: 'ML LOGS' },
]

const EMPTY_FILTERS = {
  q: '', role: 'all', status: 'all',
  minItems: '', maxItems: '',
  fromDate: '', toDate: '',
}

export default function Admin() {
  const [tab, setTab] = useState('stats')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState({ key: 'created_at', dir: 'asc' })

  useEffect(() => {
    Promise.all([
      api.get('/api/v1/admin/stats'),
      api.get('/api/v1/admin/users'),
      api.get('/api/v1/admin/ml/logs'),
    ]).then(([s, u, l]) => {
      setStats(s.data)
      setUsers(u.data)
      setLogs(l.data)
    }).finally(() => setLoading(false))
  }, [])

  const toggleBlock = async u => {
    await api.patch(`/api/v1/admin/users/${u.id}`, { is_active: !u.is_active })
    setUsers(us => us.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x))
  }

  const toggleRole = async u => {
    const role = u.role === 'admin' ? 'user' : 'admin'
    await api.patch(`/api/v1/admin/users/${u.id}`, { role })
    setUsers(us => us.map(x => x.id === u.id ? { ...x, role } : x))
  }

  const deleteUser = async id => {
    if (!confirm('Permanently delete this user and ALL their data?')) return
    if (!confirm('This cannot be undone. Are you sure?')) return
    await api.delete(`/api/v1/admin/users/${id}`)
    setUsers(us => us.filter(u => u.id !== id))
  }

  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }))

  const toggleSort = key => setSort(s =>
    s.key === key
      ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' }
  )

  const sortValue = (u, key) => {
    if (key === 'created_at')  return new Date(u.created_at).getTime()
    if (key === 'item_count')  return u.item_count ?? 0
    if (key === 'is_active')   return u.is_active ? 1 : 0
    return (u[key] ?? '').toString().toLowerCase()
  }

  const filteredUsers = users.filter(u => {
    const q = filters.q.trim().toLowerCase()
    if (q && !(
      (u.name  || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    )) return false
    if (filters.role   !== 'all' && u.role !== filters.role) return false
    if (filters.status === 'active'  && !u.is_active) return false
    if (filters.status === 'blocked' &&  u.is_active) return false
    if (filters.minItems !== '' && u.item_count < +filters.minItems) return false
    if (filters.maxItems !== '' && u.item_count > +filters.maxItems) return false
    if (filters.fromDate && new Date(u.created_at) < new Date(filters.fromDate)) return false
    if (filters.toDate) {
      const to = new Date(filters.toDate); to.setHours(23, 59, 59, 999)
      if (new Date(u.created_at) > to) return false
    }
    return true
  }).sort((a, b) => {
    const av = sortValue(a, sort.key)
    const bv = sortValue(b, sort.key)
    if (av < bv) return sort.dir === 'asc' ? -1 :  1
    if (av > bv) return sort.dir === 'asc' ?  1 : -1
    return 0
  })

  const th = {
    textAlign: 'left', padding: '8px 10px',
    fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
    letterSpacing: '0.15em', textTransform: 'uppercase',
    borderBottom: '2px solid var(--ink)', color: 'var(--mute)',
    background: 'var(--paper)',
  }
  const td = { padding: '8px 10px', fontSize: 12, verticalAlign: 'middle', borderBottom: '1px solid var(--line-soft)' }

  return (
    <div className="bru-page">
      <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 14, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="bru-mono">ADMIN</div>
          <div className="bru-serif" style={{ fontSize: 64, lineHeight: 0.95 }}>The <em style={{ color: 'var(--accent)' }}>console</em>.</div>
        </div>
        <div className="bru-mono" style={{ fontSize: 10, color: 'var(--mute)' }}>
          {loading ? 'LOADING…' : `${users.length} USERS · ${logs.length} ML EVENTS`}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, marginTop: 18, border: '1.5px solid var(--ink)' }}>
        {TABS.map((t, i) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={active ? 'bru-on-accent' : ''}
              style={{
                flex: 1, padding: '12px 14px',
                borderLeft: i > 0 ? '1.5px solid var(--ink)' : 'none',
                background: active ? 'var(--accent)' : 'var(--paper)',
                color: active ? '#0A0A0A' : 'var(--ink)',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                letterSpacing: '0.2em', cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="bru-mono" style={{ marginTop: 24, color: 'var(--mute)' }}>LOADING…</div>
      )}

      {/* ── Stats ── */}
      {!loading && tab === 'stats' && stats && (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 0, border: '1.5px solid var(--ink)', marginTop: 18,
          }}>
            {[
              ['TOTAL USERS',      stats.total_users],
              ['NEW · 7 DAYS',     stats.new_users_7d],
              ['TOTAL ITEMS',      stats.total_items],
              ['OUTFITS · 30D',    stats.total_outfits_30d],
              ['ML AVG CONFIDENCE',`${(stats.avg_ml_confidence * 100).toFixed(0)}%`],
              ['ML LOG ENTRIES',   stats.total_ml_logs],
            ].map(([label, val], i) => (
              <div key={label} style={{
                padding: 18,
                borderLeft: (i % 3 !== 0) ? '1.5px solid var(--ink)' : 'none',
                borderTop:  (i >= 3) ? '1.5px solid var(--ink)' : 'none',
              }}>
                <div className="bru-mono" style={{ fontSize: 9, color: 'var(--mute)' }}>{label}</div>
                <div className="bru-serif" style={{ fontSize: 42, lineHeight: 1, marginTop: 4 }}>{val}</div>
              </div>
            ))}
          </div>

          <div className="bru-card" style={{ marginTop: 18 }}>
            <div className="bru-mono" style={{ marginBottom: 12 }}>SYSTEM STATUS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span className="bru-tag on">BACKEND · ONLINE</span>
              <span className="bru-tag on">DATABASE · CONNECTED</span>
              <span className="bru-tag">ML · CHECK :8001/HEALTH</span>
            </div>
          </div>
        </>
      )}

      {/* ── Users ── */}
      {!loading && tab === 'users' && (
        <div className="bru-card" style={{ marginTop: 18, overflowX: 'auto' }}>
          {/* Filters */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
            paddingBottom: 12, marginBottom: 12, borderBottom: '1.5px solid var(--ink)',
          }}>
            <input
              className="bru-input"
              placeholder="Search name or email…"
              value={filters.q}
              onChange={e => setF('q', e.target.value)}
              style={{ flex: '1 1 220px', minWidth: 160 }}
            />
            <select className="bru-input" value={filters.role} onChange={e => setF('role', e.target.value)} style={{ width: 130 }}>
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
            <select className="bru-input" value={filters.status} onChange={e => setF('status', e.target.value)} style={{ width: 140 }}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </select>
            <input
              className="bru-input" type="number" min="0" placeholder="Items ≥"
              value={filters.minItems}
              onChange={e => setF('minItems', e.target.value)}
              style={{ width: 90 }}
            />
            <input
              className="bru-input" type="number" min="0" placeholder="Items ≤"
              value={filters.maxItems}
              onChange={e => setF('maxItems', e.target.value)}
              style={{ width: 90 }}
            />
            <label className="bru-mono" style={{ fontSize: 9, color: 'var(--mute)' }}>FROM</label>
            <input
              className="bru-input" type="date"
              value={filters.fromDate}
              onChange={e => setF('fromDate', e.target.value)}
              style={{ width: 140 }}
            />
            <label className="bru-mono" style={{ fontSize: 9, color: 'var(--mute)' }}>TO</label>
            <input
              className="bru-input" type="date"
              value={filters.toDate}
              onChange={e => setF('toDate', e.target.value)}
              style={{ width: 140 }}
            />
            <button
              type="button"
              className="bru-btn"
              onClick={() => setFilters(EMPTY_FILTERS)}
              disabled={JSON.stringify(filters) === JSON.stringify(EMPTY_FILTERS)}
              style={{ height: 32, padding: '0 14px', fontSize: 11 }}
            >
              Reset
            </button>
          </div>

          <div className="bru-mono" style={{ fontSize: 10, color: 'var(--mute)', marginBottom: 8 }}>
            SHOWING {filteredUsers.length} OF {users.length} USER{users.length !== 1 ? 'S' : ''}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  { label: 'ID',         key: 'id' },
                  { label: 'Name',       key: 'name' },
                  { label: 'Email',      key: 'email' },
                  { label: 'Role',       key: 'role' },
                  { label: 'Items',      key: 'item_count' },
                  { label: 'Registered', key: 'created_at' },
                  { label: 'Status',     key: 'is_active' },
                  { label: 'Actions',    key: null },
                ].map(({ label, key }) => {
                  const active = key && sort.key === key
                  return (
                    <th
                      key={label}
                      onClick={() => key && toggleSort(key)}
                      style={{
                        ...th,
                        cursor: key ? 'pointer' : 'default',
                        color: active ? 'var(--ink)' : 'var(--mute)',
                        userSelect: 'none',
                      }}
                    >
                      {label}
                      {active && <span style={{ marginLeft: 4 }}>{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id}>
                  <td style={{ ...td, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                    {String(u.id).padStart(3, '0')}
                  </td>
                  <td style={td}>{u.name}</td>
                  <td style={{ ...td, color: 'var(--mute)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                    {u.email}
                  </td>
                  <td style={td}>
                    <span
                      className={u.role === 'admin' ? 'bru-tag on' : 'bru-tag'}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td style={{ ...td, fontFamily: 'JetBrains Mono, monospace' }}>{u.item_count}</td>
                  <td style={{ ...td, color: 'var(--mute)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td style={td}>
                    {u.is_active ? (
                      <span className="bru-mono" style={{ fontSize: 10, color: 'var(--ink)' }}>● ACTIVE</span>
                    ) : (
                      <span className="bru-mono" style={{ fontSize: 10, color: 'var(--accent)' }}>○ BLOCKED</span>
                    )}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="bru-btn"
                        onClick={() => toggleBlock(u)}
                        style={{ height: 26, padding: '0 8px', fontSize: 9 }}
                      >
                        {u.is_active ? 'Block' : 'Unblock'}
                      </button>
                      <button
                        type="button"
                        className="bru-btn"
                        onClick={() => toggleRole(u)}
                        style={{ height: 26, padding: '0 8px', fontSize: 9 }}
                      >
                        {u.role === 'admin' ? '↓ User' : '↑ Admin'}
                      </button>
                      <button
                        type="button"
                        className="bru-btn bru-btn-accent bru-on-accent"
                        onClick={() => deleteUser(u.id)}
                        style={{ height: 26, padding: '0 10px', fontSize: 9 }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ ...td, textAlign: 'center', color: 'var(--mute)', padding: 28 }}>
                    <div className="bru-mono" style={{ fontSize: 10 }}>NO USERS MATCH THE CURRENT FILTERS</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ML Logs ── */}
      {!loading && tab === 'ml-logs' && (
        <div className="bru-card" style={{ marginTop: 18, overflowX: 'auto' }}>
          <div className="bru-mono" style={{ fontSize: 10, color: 'var(--mute)', marginBottom: 8 }}>
            LAST {logs.length} ML REQUEST{logs.length !== 1 ? 'S' : ''}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['ID', 'User', 'Predicted Category', 'Confidence', 'Corrected', 'Date'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td style={{ ...td, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                    {String(l.id).padStart(4, '0')}
                  </td>
                  <td style={{ ...td, fontFamily: 'JetBrains Mono, monospace' }}>{l.user_id}</td>
                  <td style={td}>
                    <span className="bru-tag">{l.category || '—'}</span>
                  </td>
                  <td style={td}>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
                      color: l.confidence == null ? 'var(--mute)'
                        : l.confidence < 0.5 ? 'var(--accent)'
                        : l.confidence < 0.7 ? 'var(--ink)'
                        : 'var(--ink)',
                    }}>
                      {l.confidence != null ? `${(l.confidence * 100).toFixed(0)}%` : '—'}
                    </span>
                  </td>
                  <td style={td}>
                    {l.corrected
                      ? <span className="bru-tag on">CORRECTED</span>
                      : <span className="bru-mono" style={{ fontSize: 10, color: 'var(--mute)' }}>—</span>}
                  </td>
                  <td style={{ ...td, color: 'var(--mute)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--mute)', padding: 28 }}>
                    <div className="bru-mono" style={{ fontSize: 10 }}>NO ML LOGS YET</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
