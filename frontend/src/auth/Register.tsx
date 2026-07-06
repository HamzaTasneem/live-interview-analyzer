import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from './AuthContext.js'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [inviteCode, setInviteCode] = useState(params.get('invite') ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await register(email, password, name, inviteCode)
      navigate('/')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card">
        <h2>Create account</h2>
        <form onSubmit={submit}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label>Password (min 8 characters)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <label>Invite code (optional)</label>
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="From your assessor, if you have one"
          />
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Register'}
          </button>
        </form>
        <p className="muted">
          Have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  )
}
