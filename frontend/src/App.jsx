import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Nav from './components/Nav'
import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Wardrobe from './pages/Wardrobe'
import AddItem from './pages/AddItem'
import Outfits from './pages/Outfits'
import History from './pages/History'
import Profile from './pages/Profile'
import Admin from './pages/Admin'

function PrivateRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  if (!localStorage.getItem('token')) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return children
}

export default function App() {
  const loggedIn = !!localStorage.getItem('token')
  return (
    <BrowserRouter>
      {loggedIn && <Nav />}
      <Routes>
        <Route path="/login"      element={<Login />} />
        <Route path="/register"   element={<Register />} />
        <Route path="/onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>} />
        <Route path="/"           element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/wardrobe"   element={<PrivateRoute><Wardrobe /></PrivateRoute>} />
        <Route path="/add"        element={<PrivateRoute><AddItem /></PrivateRoute>} />
        <Route path="/outfits"    element={<PrivateRoute><Outfits /></PrivateRoute>} />
        <Route path="/history"    element={<PrivateRoute><History /></PrivateRoute>} />
        <Route path="/profile"    element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/admin"      element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
