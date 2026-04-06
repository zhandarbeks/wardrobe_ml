import { useEffect, useState } from 'react'
import api from '../api'

const TABS = ['stats', 'users', 'ml-logs']

export default function Admin() {
  const [tab, setTab] = useState('stats')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

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
          <div style={{ marginBottom: 12, fontSize: 13, color: '#666' }}>
            {users.length} registered user{users.length !== 1 ? 's' : ''}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['ID', 'Name', 'Email', 'Role', 'Items', 'Registered', 'Status', 'Actions'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
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
