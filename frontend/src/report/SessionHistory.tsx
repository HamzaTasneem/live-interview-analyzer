import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth/AuthContext.js'

interface SessionRow {
  id: string
  roleField: string
  status: string
  createdAt: string
  candidate: { name: string; email: string }
  report: { id: string } | null
}

export default function SessionHistory() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ sessions: SessionRow[] }>('/api/sessions')
      .then((d) => setSessions(d.sessions))
      .catch((e) => setError(e.message))
  }, [])

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Session history</h2>
        {error && <div className="error">{error}</div>}
        {sessions.length === 0 ? (
          <p className="muted">
            No sessions yet. <Link to="/">Start your first practice interview.</Link>
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                {user?.role !== 'candidate' && <th>Candidate</th>}
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  {user?.role !== 'candidate' && <td>{s.candidate.name}</td>}
                  <td>{s.roleField}</td>
                  <td>
                    <span className={`badge ${s.status === 'reported' ? 'active' : ''}`}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    {s.report ? (
                      <Link to={`/session/${s.id}/report`}>View report</Link>
                    ) : s.status === 'active' && user?.role !== 'candidate' ? (
                      <Link to={`/session/${s.id}/spectate`}>🔴 Watch live</Link>
                    ) : s.status === 'created' || s.status === 'active' ? (
                      <Link to={`/session/${s.id}`}>Resume</Link>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
