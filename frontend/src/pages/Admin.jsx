import { useEffect, useState } from 'react'
import api from '../api'

const TABS = ['stats', 'users', 'ml-logs']

const INPUT_STYLE = {
  padding: '7px 10px', border: '1px solid #ddd', borderRadius: 6,
  fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#fff',
}

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
      : { key, dir: key === 'created_at' || key === 'item_count' ? 'asc' : 'asc' }
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

  const thStyle = {
    textAlign: 'left', padding: '8px 12px',
    fontWeight: 600, fontSize: 13,
    borderBottom: '2px solid #eee',
  }
  const tdStyle = { padding: '8px 12px', fontSize: 13, verticalAlign: 'middle' }

  return (
    <div className="page">
      <h1>Admin Panel</h1>

      {/* Tab bar */}
      <div className="flex gap-8 mb-16">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
            style={{ textTransform: 'capitalize' }}
          >
            {t.replace('-', ' ')}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray">Loading…</p>}

      {/* ─── Stats ─────────────────────────────────────────────────────────── */}
      {!loading && tab === 'stats' && stats && (
        <>
          <div className="grid grid-3" style={{ marginBottom: 24 }}>
            {[
              ['Total Users',      stats.total_users],
              ['New (7 days)',      stats.new_users_7d],
              ['Total Items',       stats.total_items],
              ['Outfits (30 days)', stats.total_outfits_30d],
              ['ML Avg Confidence', `${(stats.avg_ml_confidence * 100).toFixed(0)}%`],
              ['ML Log Entries',    stats.total_ml_logs],
            ].map(([label, val]) => (
              <div key={label} className="card text-center">
                <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 4 }}>{val}</div>
                <div className="text-sm text-gray">{label}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 8 }}>System Status</h3>
            <div className="flex gap-12 flex-wrap">
              <span
                className="tag"
                style={{ background: '#dcfce7', color: '#16a34a', fontSize: 13 }}
              >
                Backend - online
              </span>
              <span
                className="tag"
                style={{ background: '#dcfce7', color: '#16a34a', fontSize: 13 }}
              >
                Database - connected
              </span>
              <span
                className="tag"
                style={{ background: '#dbeafe', color: '#2563eb', fontSize: 13 }}
              >
                ML Service — check http://localhost:8001/health
              </span>
            </div>
          </div>
        </>
      )}

      {/* ─── Users ─────────────────────────────────────────────────────────── */}
      {!loading && tab === 'users' && (
        <div className="card" style={{ overflowX: 'auto' }}>

          {/* Filters */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
            marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0',
          }}>
            <input
              placeholder="Search name or email…"
              value={filters.q}
              onChange={e => setF('q', e.target.value)}
              style={{ ...INPUT_STYLE, flex: '1 1 220px', minWidth: 160 }}
            />
            <select value={filters.role} onChange={e => setF('role', e.target.value)} style={INPUT_STYLE}>
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
            <select value={filters.status} onChange={e => setF('status', e.target.value)} style={INPUT_STYLE}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </select>
            <input
              type="number" min="0" placeholder="Items ≥"
              value={filters.minItems}
              onChange={e => setF('minItems', e.target.value)}
              style={{ ...INPUT_STYLE, width: 90 }}
            />
            <input
              type="number" min="0" placeholder="Items ≤"
              value={filters.maxItems}
              onChange={e => setF('maxItems', e.target.value)}
              style={{ ...INPUT_STYLE, width: 90 }}
            />
            <label style={{ fontSize: 12, color: '#666' }}>From</label>
            <input
              type="date"
              value={filters.fromDate}
              onChange={e => setF('fromDate', e.target.value)}
              style={INPUT_STYLE}
            />
            <label style={{ fontSize: 12, color: '#666' }}>To</label>
            <input
              type="date"
              value={filters.toDate}
              onChange={e => setF('toDate', e.target.value)}
              style={INPUT_STYLE}
            />
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setFilters(EMPTY_FILTERS)}
              disabled={JSON.stringify(filters) === JSON.stringify(EMPTY_FILTERS)}
            >
              Reset
            </button>
          </div>

          <div style={{ marginBottom: 12, fontSize: 13, color: '#666' }}>
            Showing {filteredUsers.length} of {users.length} user{users.length !== 1 ? 's' : ''}
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
                        ...thStyle,
                        cursor: key ? 'pointer' : 'default',
                        userSelect: 'none',
                        color: active ? '#1a1a1a' : '#555',
                      }}
                    >
                      {label}
                      {active && (
                        <span style={{ marginLeft: 4, fontSize: 11 }}>
                          {sort.dir === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, i) => (
                <tr key={u.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={tdStyle}>{u.id}</td>
                  <td style={tdStyle}>{u.name}</td>
                  <td style={{ ...tdStyle, color: '#555' }}>{u.email}</td>
                  <td style={tdStyle}>
                    <span
                      className="tag"
                      style={{
                        background: u.role === 'admin' ? '#1a1a1a' : '#f0f0f0',
                        color: u.role === 'admin' ? '#fff' : '#555',
                      }}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td style={tdStyle}>{u.item_count}</td>
                  <td style={{ ...tdStyle, color: '#888' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td style={tdStyle}>
                    <span
                      className="tag"
                      style={{
                        background: u.is_active ? '#dcfce7' : '#fee2e2',
                        color: u.is_active ? '#16a34a' : '#dc2626',
                      }}
                    >
                      {u.is_active ? 'Active' : 'Blocked'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    <div className="flex gap-8">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => toggleBlock(u)}
                        title={u.is_active ? 'Block user' : 'Unblock user'}
                      >
                        {u.is_active ? 'Block' : 'Unblock'}
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => toggleRole(u)}
                        title="Toggle admin role"
                      >
                        {u.role === 'admin' ? '↓ User' : '↑ Admin'}
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => deleteUser(u.id)}
                        title="Delete user permanently"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: '#aaa', padding: 32 }}>
                    No users match the current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── ML Logs ───────────────────────────────────────────────────────── */}
      {!loading && tab === 'ml-logs' && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <div style={{ marginBottom: 12, fontSize: 13, color: '#666' }}>
            Last {logs.length} ML requests
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['ID', 'User', 'Predicted Category', 'Confidence', 'Corrected', 'Date'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={l.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={tdStyle}>{l.id}</td>
                  <td style={tdStyle}>{l.user_id}</td>
                  <td style={tdStyle}>
                    <span className="tag">{l.category || '—'}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      fontWeight: 600,
                      color: l.confidence == null ? '#aaa'
                        : l.confidence < 0.5 ? '#dc2626'
                        : l.confidence < 0.7 ? '#d97706'
                        : '#16a34a',
                    }}>
                      {l.confidence != null ? `${(l.confidence * 100).toFixed(0)}%` : '—'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {l.corrected ? (
                      <span className="tag" style={{ background: '#fef3c7', color: '#92400e' }}>
                        ✏️ Yes
                      </span>
                    ) : (
                      <span className="text-gray">No</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, color: '#888' }}>
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#aaa', padding: 32 }}>
                    No ML logs yet
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
