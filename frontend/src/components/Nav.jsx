import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../api'

// Today's date as `WED 18·V·26` — honest dynamic stamp
const DAY_LBL  = ['SUN','MON','TUE','WED','THU','FRI','SAT']
const ROMAN_MO = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']
function todayStamp() {
  const d = new Date()
  return `${DAY_LBL[d.getDay()]} ${d.getDate()}·${ROMAN_MO[d.getMonth()]}·${String(d.getFullYear()).slice(-2)}`
}

export default function Nav() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const navigate = useNavigate()
  const [w, setW] = useState(null)
  const [stats, setStats] = useState(null)
  const [mode, setMode] = useState(() => localStorage.getItem('tt_mode') || 'day')

  useEffect(() => {
    api.get('/api/v1/weather/current').then(r => setW(r.data)).catch(() => {})
    api.get('/api/v1/wardrobe/stats').then(r => setStats(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-mode', mode)
    localStorage.setItem('tt_mode', mode)
  }, [mode])

  const toggleMode = () => setMode(m => m === 'night' ? 'day' : 'night')

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
  }

  const cls = ({ isActive }) => isActive ? 'is-active' : ''

  return (
    <>
      <header className="bru-mast">
        <NavLink to="/" end className="bru-logo" style={{ color: 'var(--ink)', textDecoration: 'none', cursor: 'pointer' }}>T*T</NavLink>
        <div className="bru-meta">{todayStamp()}</div>
        <nav className="bru-nav">
          <NavLink to="/"         end className={cls}>today</NavLink>
          <NavLink to="/wardrobe"     className={cls}>wardrobe</NavLink>
          <NavLink to="/outfits"      className={cls}>outfits</NavLink>
          <NavLink to="/add"          className={cls}>add</NavLink>
          <NavLink to="/history"      className={cls}>history</NavLink>
          <NavLink to="/profile"      className={cls}>profile</NavLink>
          {user.role === 'admin' && (
            <NavLink to="/admin"      className={cls}>admin</NavLink>
          )}
          <button
            type="button"
            onClick={toggleMode}
            title={mode === 'night' ? 'Switch to day' : 'Switch to night'}
            style={{
              marginLeft: 14, background: 'transparent', border: '1.5px solid var(--ink)',
              width: 30, height: 30, cursor: 'pointer', display: 'grid', placeItems: 'center',
              color: 'var(--ink)', fontSize: 13, padding: 0, fontFamily: 'inherit',
            }}
          >
            {mode === 'night' ? '☀' : '☾'}
          </button>
          <a onClick={logout} style={{ marginLeft: 8, color: 'var(--mute)', cursor: 'pointer' }}>logout</a>
        </nav>
      </header>
      <div className="bru-sub">
        <span>
          {w
            ? `${(w.city || '—').toUpperCase()} · ${Math.round(w.temp ?? 0)}° · WIND ${(w.wind_speed ?? 0).toFixed(0)} m/s · RAIN ${Math.round((w.pop ?? 0) * 100)}%`
            : 'WEATHER —'}
        </span>
        <span>
          {stats
            ? `${stats.total} PIECES · ${stats.total_outfit_wears ?? 0} WEARS`
            : ''}
        </span>
      </div>
    </>
  )
}
