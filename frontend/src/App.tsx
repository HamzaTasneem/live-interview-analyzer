import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.js'
import Login from './auth/Login.js'
import Register from './auth/Register.js'
import SessionSetup from './session/SessionSetup.js'
import LiveSession from './session/LiveSession.js'
import DrillsPage from './session/DrillsPage.js'
import ReportPage from './report/ReportPage.js'
import SessionHistory from './report/SessionHistory.js'
import ProgressPage from './report/ProgressPage.js'
import InvitesPage from './assessor/InvitesPage.js'
import SpectatePage from './assessor/SpectatePage.js'
import AdminPage from './admin/AdminPage.js'

function Nav() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <nav className="nav">
      <div>
        <Link to="/" className="brand">
          Interview Analyzer
        </Link>
        {user && <Link to="/drills">Drills</Link>}
        {user && <Link to="/progress">Progress</Link>}
        {user && <Link to="/history">History</Link>}
        {user && (user.role === 'assessor' || user.role === 'admin') && (
          <Link to="/invites">Invites</Link>
        )}
        {user?.role === 'admin' && <Link to="/admin">Admin</Link>}
      </div>
      <div>
        {user ? (
          <>
            <span className="muted" style={{ marginRight: 12 }}>
              {user.name} <span className="badge">{user.role}</span>
            </span>
            <button
              className="secondary"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              Log out
            </button>
          </>
        ) : (
          <Link to="/login">Log in</Link>
        )}
      </div>
    </nav>
  )
}

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="container muted">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <SessionSetup />
            </RequireAuth>
          }
        />
        <Route
          path="/session/:id"
          element={
            <RequireAuth>
              <LiveSession />
            </RequireAuth>
          }
        />
        <Route
          path="/session/:id/report"
          element={
            <RequireAuth>
              <ReportPage />
            </RequireAuth>
          }
        />
        <Route
          path="/session/:id/spectate"
          element={
            <RequireAuth>
              <SpectatePage />
            </RequireAuth>
          }
        />
        <Route
          path="/drills"
          element={
            <RequireAuth>
              <DrillsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/progress"
          element={
            <RequireAuth>
              <ProgressPage />
            </RequireAuth>
          }
        />
        <Route
          path="/history"
          element={
            <RequireAuth>
              <SessionHistory />
            </RequireAuth>
          }
        />
        <Route
          path="/invites"
          element={
            <RequireAuth>
              <InvitesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminPage />
            </RequireAuth>
          }
        />
      </Routes>
    </>
  )
}
