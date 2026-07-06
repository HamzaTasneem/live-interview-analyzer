import { useEffect, useState } from 'react'
import { api, getToken } from '../api.js'

interface UserRow {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
}

interface RecordingRow {
  id: string
  size: number
  uploadedAt: string | null
  expiresAt: string
  session: { roleField: string; startedAt: string | null }
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [recordings, setRecordings] = useState<RecordingRow[]>([])
  const [error, setError] = useState('')

  const load = () => {
    api<{ users: UserRow[] }>('/api/admin/users')
      .then((d) => setUsers(d.users))
      .catch((e) => setError(e.message))
    api<{ recordings: RecordingRow[] }>('/api/recordings')
      .then((d) => setRecordings(d.recordings))
      .catch(() => {})
  }

  useEffect(() => {
    load()
  }, [])

  const setRole = async (id: string, role: string) => {
    try {
      await api(`/api/admin/users/${id}/role`, { method: 'PATCH', body: { role } })
      load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const download = async (id: string) => {
    const res = await fetch(`/api/recordings/${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `recording-${id}.webm`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Users</h2>
        {error && <div className="error">{error}</div>}
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={(e) => setRole(u.id, e.target.value)}
                    style={{ margin: 0, width: 'auto' }}
                  >
                    <option value="candidate">candidate</option>
                    <option value="assessor">assessor</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>QA recordings</h2>
        <p className="muted">
          Internal AI-quality review only. Recordings auto-delete after the retention window.
        </p>
        <table>
          <thead>
            <tr>
              <th>Session role</th>
              <th>Recorded</th>
              <th>Size</th>
              <th>Expires</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recordings.map((r) => (
              <tr key={r.id}>
                <td>{r.session.roleField}</td>
                <td>{r.uploadedAt ? new Date(r.uploadedAt).toLocaleString() : '—'}</td>
                <td>{(r.size / 1024 / 1024).toFixed(1)} MB</td>
                <td>{new Date(r.expiresAt).toLocaleDateString()}</td>
                <td>
                  <button className="secondary" onClick={() => download(r.id)}>
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
