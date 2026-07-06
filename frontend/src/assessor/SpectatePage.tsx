import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, spectateWsUrl } from '../api.js'
import { MOOD_META, type Mood, type MoodResult } from '../analysis/mood.js'
import Meters, { type LiveMeterValues } from '../session/Meters.js'
import MoodBadge from '../session/MoodBadge.js'
import LiveChart from '../session/LiveChart.js'

// F9: assessor/admin live view — metric summaries only. The candidate's
// video and audio never leave their browser.
export default function SpectatePage() {
  const { id } = useParams<{ id: string }>()
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline' | 'denied'>('connecting')
  const [roleField, setRoleField] = useState('')
  const [meters, setMeters] = useState<LiveMeterValues>({
    eyeContact: 0,
    tension: 0,
    fidget: 0,
    wpm: 0,
    volume: 0,
    energy: 0,
    posture: null,
  })
  const [mood, setMood] = useState<MoodResult>({ mood: 'calm', ...MOOD_META.calm })
  const [nervousness, setNervousness] = useState<number[]>([])
  const [questionOrder, setQuestionOrder] = useState<number | null>(null)
  const eyeWindow = useRef<boolean[]>([])

  useEffect(() => {
    api<{ session: { roleField: string; status: string } }>(`/api/sessions/${id}`)
      .then((d) => setRoleField(d.session.roleField))
      .catch(() => {})

    const ws = new WebSocket(spectateWsUrl(id!))
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'spectate-joined') {
          setStatus('live')
          return
        }
        if (msg.type === 'session-offline') {
          setStatus('offline')
          return
        }
        if (msg.type !== 'metrics' || !msg.signals) return
        const s = msg.signals

        eyeWindow.current.push(!!s.gaze?.eyeContact)
        if (eyeWindow.current.length > 90) eyeWindow.current.shift()
        const eyePct =
          (eyeWindow.current.filter(Boolean).length / eyeWindow.current.length) * 100

        setMeters({
          eyeContact: eyePct,
          tension: s.expression?.tension ?? 0,
          fidget: s.movement?.fidget ?? 0,
          wpm: s.voice?.wpm ?? 0,
          volume: s.voice?.volume ?? 0,
          energy: s.voice?.energy ?? 0,
          posture: s.movement?.posture ?? null,
        })
        if (s.mood) {
          const state = s.mood.state as Mood
          setMood({ mood: state, ...(MOOD_META[state] ?? MOOD_META.flat) })
          setNervousness((h) => [...h.slice(-179), s.mood.nervousness ?? 0])
        }
        if (s.questionOrder) setQuestionOrder(s.questionOrder)
      } catch {
        /* ignore malformed frames */
      }
    }
    ws.onclose = (e) => {
      if (e.code === 4403 || e.code === 4401) setStatus('denied')
      else setStatus((s) => (s === 'live' ? 'offline' : s))
    }
    return () => ws.close()
  }, [id])

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>
          Live session view {roleField && <span className="badge">{roleField}</span>}{' '}
          <span className={`badge ${status === 'live' ? 'active' : ''}`}>{status}</span>
        </h2>
        <p className="muted">
          Behavioral signals only — you are not seeing or hearing the candidate. The full report
          is available after the session ends.
          {questionOrder && <> Currently on question {questionOrder}.</>}
        </p>
        {status === 'denied' && (
          <div className="error">You do not have access to this session's live view.</div>
        )}
        {status === 'offline' && (
          <p>
            The candidate is not streaming right now.{' '}
            <Link to={`/session/${id}/report`}>Check for the report</Link> or{' '}
            <Link to="/history">go back to history</Link>.
          </p>
        )}
      </div>

      {status === 'live' && (
        <div className="session-grid">
          <div>
            <MoodBadge mood={mood} />
            <LiveChart title="Nervousness" values={nervousness} />
          </div>
          <div>
            <Meters values={meters} />
          </div>
        </div>
      )}
    </div>
  )
}
