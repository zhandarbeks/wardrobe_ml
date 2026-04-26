import { NavLink, useNavigate } from 'react-router-dom'

export default function Nav() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
  }

  const cls = ({ isActive }) => isActive ? 'active' : ''

  return (
    <nav>
      <div className="inner">
        <span className="logo">WarDrobe ML</span>
        <NavLink to="/"         className={cls}>Dashboard</NavLink>
        <NavLink to="/wardrobe" className={cls}>Wardrobe</NavLink>
        <NavLink to="/add"      className={cls}>+ Add Item</NavLink>
        <NavLink to="/outfits"  className={cls}>Outfits</NavLink>
        <NavLink to="/history"  className={cls}>History</NavLink>
        <NavLink to="/stats"    className={cls}>Stats</NavLink>
        <NavLink to="/profile"  className={cls}>Profile</NavLink>
        {user.role === 'admin' && (
          <NavLink to="/admin" className={cls}>Admin</NavLink>
        )}
        <span className="spacer" />
        <span className="user">{user.name}</span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={logout}
          style={{ marginLeft: 8 }}
        >
          Logout
        </button>
      </div>
    </nav>
  )
}
