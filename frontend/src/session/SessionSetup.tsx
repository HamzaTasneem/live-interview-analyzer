import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'

export default function SessionSetup() {
  const navigate = useNavigate()
  const [roleField, setRoleField] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const start = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const d = await api<{ session: { id: string } }>('/api/sessions', {
        method: 'POST',
        body: { roleField, consent: consent as true, inviteCode: inviteCode || undefined },
      })
      navigate(`/session/${d.session.id}`)
    } catch (err: any) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <div className="card">
        <h2>Practice interview</h2>
        <p className="muted">
          A live AI-conducted mock interview. Your camera and microphone are analyzed in your
          browser to coach you on how you come across.
        </p>
        <form onSubmit={start}>
          <label>What job role are you practicing for?</label>
          <input
            value={roleField}
            onChange={(e) => setRoleField(e.target.value)}
            placeholder="e.g. sales representative, teacher, electrician"
            required
            minLength={2}
          />
          <label>Assessor invite code (optional)</label>
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Leave empty for solo practice"
          />

          <div className="consent-box">
            <strong>Consent — please read</strong>
            <ul>
              <li>
                Your camera and microphone are analyzed <strong>live in your browser</strong>{' '}
                during the session (expressions, eye contact, movement, voice, speech).
              </li>
              <li>
                The session is <strong>recorded</strong>. Recordings are used{' '}
                <strong>only for internal AI-quality review</strong>, are restricted to
                administrators, and are automatically deleted after 30 days.
              </li>
              <li>
                This is <strong>training, not judging</strong>: you get coaching feedback on
                delivery. Nothing here is a hiring decision or an evaluation of your honesty.
              </li>
            </ul>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ width: 'auto', margin: 0 }}
              />
              I understand and consent to live analysis and session recording.
            </label>
          </div>

          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={!consent || busy}>
            {busy ? 'Preparing questions…' : 'Start session'}
          </button>
        </form>
      </div>
    </div>
  )
}
