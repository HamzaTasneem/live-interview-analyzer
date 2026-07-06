import { useEffect, useState } from 'react'
import { api } from '../api.js'

interface Invite {
  id: string
  code: string
  email: string | null
  expiresAt: string
  usedAt: string | null
}

export default function InvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  const load = () =>
    api<{ invites: Invite[] }>('/api/invites')
      .then((d) => setInvites(d.invites))
      .catch((e) => setError(e.message))

  useEffect(() => {
    load()
  }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api('/api/invites', { method: 'POST', body: { email: email || undefined } })
      setEmail('')
      load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${location.origin}/register?invite=${code}`)
    setCopied(code)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Candidate invites</h2>
        <p className="muted">
          Invited candidates' sessions are linked to you, and you can view their reports after
          each session ends.
        </p>
        <form onSubmit={create} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label>Candidate email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ marginBottom: 0 }}
            />
          </div>
          <button type="submit">Create invite</button>
        </form>
        {error && <div className="error">{error}</div>}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Email</th>
              <th>Expires</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invites.map((inv) => (
              <tr key={inv.id}>
                <td>
                  <code>{inv.code}</code>
                </td>
                <td>{inv.email ?? '—'}</td>
                <td>{new Date(inv.expiresAt).toLocaleDateString()}</td>
                <td>
                  <span className={`badge ${!inv.usedAt ? 'active' : ''}`}>
                    {inv.usedAt ? 'used' : 'open'}
                  </span>
                </td>
                <td>
                  {!inv.usedAt && (
                    <button className="secondary" onClick={() => copyLink(inv.code)}>
                      {copied === inv.code ? 'Copied!' : 'Copy link'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
