import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, metricsWsUrl, getToken } from '../api.js'
import { FaceAnalyzer, type FrameSignals } from '../analysis/faceAnalyzer.js'
import { PoseAnalyzer } from '../analysis/poseAnalyzer.js'
import { AudioAnalyzer } from '../analysis/audioAnalyzer.js'
import { SpeechRecognizer } from '../analysis/speech.js'
import { MetricsAggregator, MetricsSender } from '../analysis/aggregator.js'
import { NudgeEngine, type Nudge } from '../analysis/nudges.js'
import { MoodTracker, type MoodResult, classifyMood } from '../analysis/mood.js'
import { EXPRESSION_META, type Expression } from '../analysis/expressions.js'
import { framingFeedback, FramingTracker } from '../analysis/framing.js'
import { Interviewer } from '../analysis/tts.js'
import { MeshOverlay } from './meshOverlay.js'
import MeshLoader from './MeshLoader.js'
import Meters, { type LiveMeterValues } from './Meters.js'
import MoodBadge from './MoodBadge.js'
import LiveChart from './LiveChart.js'

interface Question {
  id: string
  order: number
  text: string
}

type Phase = 'permissions' | 'loading-models' | 'ready' | 'running' | 'ending'

export default function LiveSession() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const meshCanvasRef = useRef<HTMLCanvasElement>(null)

  const [phase, setPhase] = useState<Phase>('permissions')
  const [error, setError] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionIdx, setQuestionIdx] = useState(0)
  const [followUp, setFollowUp] = useState<string | null>(null)
  const [followUpBusy, setFollowUpBusy] = useState(false)
  const [ttsOn, setTtsOn] = useState(true)
  const [nudge, setNudge] = useState<Nudge | null>(null)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [meters, setMeters] = useState<LiveMeterValues>({
    eyeContact: 0,
    tension: 0,
    fidget: 0,
    wpm: 0,
    volume: 0,
    energy: 0,
    posture: null,
  })
  const [mood, setMood] = useState<MoodResult>(() =>
    classifyMood({ smile: 0, tension: 0, nervousness: 0, eyeContact: true }),
  )
  const [nervousnessHistory, setNervousnessHistory] = useState<number[]>([])
  const [expression, setExpression] = useState<Expression>('neutral')
  const [framingMsg, setFramingMsg] = useState<string | null>(null)
  const [meshOn, setMeshOn] = useState(true)
  const meshOnRef = useRef(true)
  const framingTracker = useRef(new FramingTracker())

  // Long-lived analysis objects survive re-renders in refs
  const rt = useRef<{
    stream?: MediaStream
    face?: FaceAnalyzer
    pose?: PoseAnalyzer
    audio?: AudioAnalyzer
    speech?: SpeechRecognizer
    aggregator?: MetricsAggregator
    sender?: MetricsSender
    nudges?: NudgeEngine
    moodTracker?: MoodTracker
    interviewer?: Interviewer
    recorder?: MediaRecorder
    mesh?: MeshOverlay
    chunks: Blob[]
    rafId?: number
    flushId?: number
    fastId?: number
    eyeContactWindow: boolean[]
    posture: number | null
    questionOrder: number
    answerTexts: Record<number, string>
    latestFrame: FrameSignals | null
  }>({
    chunks: [],
    eyeContactWindow: [],
    posture: null,
    questionOrder: 1,
    answerTexts: {},
    latestFrame: null,
  })

  useEffect(() => {
    api<{ session: { questions: Question[]; status: string } }>(`/api/sessions/${id}`)
      .then((d) => {
        setQuestions(d.session.questions)
        if (d.session.status === 'reported') navigate(`/session/${id}/report`)
      })
      .catch((e) => setError(e.message))
  }, [id])

  const requestPermissions = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: true,
      })
      rt.current.stream = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setPhase('loading-models')
      const face = new FaceAnalyzer()
      const pose = new PoseAnalyzer()
      // Pose is an enhancement — a load failure must not block the session
      const poseInit = pose.init().catch(() => {})
      await face.init()
      await poseInit
      rt.current.face = face
      rt.current.pose = pose
      setPhase('ready')
    } catch (err: any) {
      // T2: denied permission → guidance, session cannot start
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera and microphone access was denied. Please allow both in your browser settings (click the padlock icon in the address bar), then try again.'
          : `Could not access camera/microphone: ${err.message}`,
      )
    }
  }

  const speakQuestion = (idx: number, fromFollowUp?: string) => {
    const r = rt.current
    if (!r.interviewer) return
    const text = fromFollowUp ?? questions[idx]?.text
    if (text) r.interviewer.speak(text)
  }

  const startSession = async () => {
    const r = rt.current
    if (!r.stream || !r.face) return
    await api(`/api/sessions/${id}/start`, { method: 'POST' })

    r.aggregator = new MetricsAggregator()
    r.nudges = new NudgeEngine()
    r.moodTracker = new MoodTracker()
    r.interviewer = new Interviewer()
    r.interviewer.enabled = ttsOn
    r.sender = new MetricsSender(metricsWsUrl(id!))
    r.sender.connect()
    r.questionOrder = 1

    r.audio = new AudioAnalyzer()
    r.audio.start(r.stream)

    setSpeechSupported(SpeechRecognizer.supported())
    if (SpeechRecognizer.supported()) {
      r.speech = new SpeechRecognizer()
      r.speech.onDelta = (delta) => {
        r.aggregator?.addSpeech(delta)
        r.audio?.tracker.addWords(delta.words, performance.now())
        // F1/F5: keep the answer text per question for coaching + follow-ups
        r.answerTexts[r.questionOrder] = `${r.answerTexts[r.questionOrder] ?? ''} ${delta.text}`.trim()
      }
      r.speech.start()
    }

    // R11: record for internal AI-quality review; upload after session
    try {
      r.recorder = new MediaRecorder(r.stream, { mimeType: 'video/webm' })
      r.recorder.ondataavailable = (e) => {
        if (e.data.size > 0) r.chunks.push(e.data)
      }
      r.recorder.start(5000)
    } catch {
      // recording failure never blocks the session (T15 spirit)
    }

    // Visual loop via rAF; analyze() itself gates on new video frames
    if (meshCanvasRef.current) r.mesh = new MeshOverlay(meshCanvasRef.current)
    const loop = () => {
      const video = videoRef.current
      if (video && r.face?.ready) {
        const signals = r.face.analyze(video, performance.now())
        if (signals) {
          r.latestFrame = signals
          r.aggregator?.addFrame(signals)
          r.eyeContactWindow.push(signals.eyeContact)
          if (r.eyeContactWindow.length > 90) r.eyeContactWindow.shift()
        }
        if (r.mesh) {
          if (meshOnRef.current) {
            r.mesh.draw(r.face.lastLandmarks, video.videoWidth || 640, video.videoHeight || 480)
          } else {
            r.mesh.clear()
          }
        }
      }
      if (video && r.pose?.ready) {
        r.posture = r.pose.analyze(video, performance.now())
      }
      r.rafId = requestAnimationFrame(loop)
    }
    r.rafId = requestAnimationFrame(loop)

    // Fast UI loop (4x/sec): instant expression + responsive meters, so
    // feedback lands while the moment is still happening
    r.fastId = window.setInterval(() => {
      const frame = r.latestFrame
      if (!frame || !r.audio) return
      setExpression(frame.instantExpression)
      // Framing guidance: persists >1s before showing, clears instantly
      setFramingMsg(
        framingTracker.current.update(
          framingFeedback(r.face?.lastLandmarks ?? null),
          performance.now(),
        ),
      )
      const eyePct = r.eyeContactWindow.length
        ? (r.eyeContactWindow.filter(Boolean).length / r.eyeContactWindow.length) * 100
        : 0
      setMeters({
        eyeContact: eyePct,
        tension: frame.tension,
        fidget: frame.fidget,
        wpm: Math.round(r.audio.tracker.wpm(performance.now())),
        volume: r.audio.tracker.avgVolume(),
        energy: r.audio.tracker.energy(),
        posture: r.posture,
      })
    }, 250)

    // 1s cadence: update meters, run nudges, stream summary (R3 meters >=1x/sec)
    r.flushId = window.setInterval(() => {
      if (!r.aggregator || !r.audio) return
      const now = performance.now()
      const summary = r.aggregator.flush(r.audio.tracker, now)

      // F1: tag the window with the active question
      summary.questionOrder = r.questionOrder
      // F3: attach the rolling posture score
      if (r.posture !== null) summary.movement.posture = Math.round(r.posture * 100) / 100

      // Mood + nervousness from the rolling window (attached to the
      // streamed summary so the report timeline can chart them)
      r.moodTracker?.add({
        eyeContact: summary.gaze.eyeContact,
        blink: summary.gaze.blink,
        tension: summary.expression.tension,
        fidget: summary.movement.fidget,
        smile: summary.expression.smile,
      })
      const currentMood = r.moodTracker?.mood()
      const nervousness = r.moodTracker?.nervousness() ?? 0
      if (currentMood) {
        summary.mood = {
          state: currentMood.mood,
          emoji: currentMood.emoji,
          nervousness: Math.round(nervousness * 100) / 100,
        }
        setMood(currentMood)
      }
      setNervousnessHistory((h) => [...h.slice(-179), nervousness])

      r.sender?.send(summary)

      const newNudge = r.nudges?.addSample({
        ts: now,
        eyeContact: summary.gaze.eyeContact,
        fidget: summary.movement.fidget,
        wpm: summary.voice.wpm,
        speaking: summary.voice.speaking,
        volume: summary.voice.volume,
        posture: r.posture ?? undefined,
      })
      if (newNudge) {
        setNudge(newNudge)
        setTimeout(() => setNudge(null), 5000)
      }
    }, 1000)

    setPhase('running')
    speakQuestion(0)
  }

  const nextQuestion = () => {
    const r = rt.current
    setFollowUp(null)
    setQuestionIdx((i) => {
      const next = Math.min(i + 1, questions.length - 1)
      r.questionOrder = questions[next]?.order ?? next + 1
      speakQuestion(next)
      return next
    })
  }

  const askFollowUp = async () => {
    const r = rt.current
    const question = followUp ?? questions[questionIdx]?.text
    if (!question) return
    setFollowUpBusy(true)
    try {
      const d = await api<{ followUp: string }>(`/api/sessions/${id}/followup`, {
        method: 'POST',
        body: { question, answerText: r.answerTexts[r.questionOrder] ?? '' },
      })
      setFollowUp(d.followUp)
      speakQuestion(questionIdx, d.followUp)
    } catch {
      // follow-ups are best-effort
    } finally {
      setFollowUpBusy(false)
    }
  }

  const toggleTts = () => {
    setTtsOn((on) => {
      const next = !on
      if (rt.current.interviewer) rt.current.interviewer.enabled = next
      if (!next) rt.current.interviewer?.stop()
      return next
    })
  }

  const cleanup = () => {
    const r = rt.current
    if (r.rafId) cancelAnimationFrame(r.rafId)
    if (r.flushId) clearInterval(r.flushId)
    if (r.fastId) clearInterval(r.fastId)
    r.interviewer?.stop()
    r.speech?.stop()
    r.audio?.stop()
    r.sender?.close()
    r.face?.close()
    r.pose?.close()
    r.stream?.getTracks().forEach((t) => t.stop())
  }

  useEffect(() => cleanup, [])

  const endSession = async () => {
    setPhase('ending')
    const r = rt.current

    // Stop recorder and collect final chunk before cleanup
    const recorded: Promise<Blob | null> = new Promise((resolve) => {
      if (!r.recorder || r.recorder.state === 'inactive') {
        resolve(r.chunks.length ? new Blob(r.chunks, { type: 'video/webm' }) : null)
        return
      }
      r.recorder.onstop = () =>
        resolve(r.chunks.length ? new Blob(r.chunks, { type: 'video/webm' }) : null)
      r.recorder.stop()
    })

    cleanup()

    try {
      await api(`/api/sessions/${id}/end`, { method: 'POST' })
    } catch (err: any) {
      setError(err.message)
      return
    }

    // R11: upload after session end; failure never blocks the report
    const blob = await recorded
    if (blob) {
      const form = new FormData()
      form.append('file', blob, 'recording.webm')
      fetch(`/api/sessions/${id}/recording`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      }).catch(() => {})
    }

    navigate(`/session/${id}/report`)
  }

  const question = questions[questionIdx]

  return (
    <div className="container">
      {error && (
        <div className="card">
          <div className="error">{error}</div>
          {phase === 'permissions' && <button onClick={requestPermissions}>Try again</button>}
        </div>
      )}

      <div className="session-grid">
        <div>
          <div className={`video-wrap ${phase === 'running' ? 'scanning' : ''}`}>
            <video ref={videoRef} className="preview" muted playsInline />
            <canvas ref={meshCanvasRef} className="mesh-canvas" />
            {phase === 'running' && (
              <>
                <span className="scan-corner tl" />
                <span className="scan-corner tr" />
                <span className="scan-corner bl" />
                <span className="scan-corner br" />
                <div className="expression-chip" key={expression}>
                  <span className="expression-emoji">{EXPRESSION_META[expression].emoji}</span>
                  {EXPRESSION_META[expression].label}
                </div>
                <button
                  className="mesh-toggle"
                  onClick={() => {
                    setMeshOn((on) => {
                      meshOnRef.current = !on
                      return !on
                    })
                  }}
                >
                  {meshOn ? '◈ Mesh on' : '◇ Mesh off'}
                </button>
                {framingMsg && <div className="framing-chip">⌖ {framingMsg}</div>}
              </>
            )}
          </div>

          {phase === 'permissions' && !error && (
            <div className="card">
              <p>
                The session needs your camera and microphone. Everything is analyzed locally in
                your browser.
              </p>
              <button onClick={requestPermissions}>Enable camera & microphone</button>
            </div>
          )}

          {phase === 'loading-models' && <MeshLoader />}

          {phase === 'ready' && (
            <div className="card">
              <p>
                You will get {questions.length} questions, one at a time. Answer out loud as if it
                were a real interview, then click “Next question”.
              </p>
              {!SpeechRecognizer.supported() && (
                <p className="muted">
                  Live transcription is not supported in this browser — your report will not
                  include a transcript, but all other signals work.
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={startSession}>Begin interview</button>
                {Interviewer.supported() && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={ttsOn}
                      onChange={toggleTts}
                      style={{ width: 'auto', margin: 0 }}
                    />
                    Interviewer voice
                  </label>
                )}
              </div>
            </div>
          )}

          {phase === 'running' && question && (
            <div className="card">
              <div className="muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  Question {questionIdx + 1} of {questions.length}
                </span>
                {Interviewer.supported() && (
                  <button
                    className="secondary"
                    style={{ padding: '4px 12px', fontSize: 12 }}
                    onClick={toggleTts}
                  >
                    {ttsOn ? '🔊 Voice on' : '🔇 Voice off'}
                  </button>
                )}
              </div>
              <div className="question-box">{question.text}</div>
              {followUp && (
                <div className="question-box" style={{ borderLeftColor: 'var(--warn)' }}>
                  <span className="muted" style={{ fontSize: 12 }}>
                    Follow-up:
                  </span>{' '}
                  {followUp}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={askFollowUp} disabled={followUpBusy} className="secondary">
                  {followUpBusy ? 'Thinking…' : 'Ask me a follow-up'}
                </button>
                {questionIdx < questions.length - 1 ? (
                  <button onClick={nextQuestion}>Next question</button>
                ) : (
                  <button onClick={endSession}>Finish interview</button>
                )}
                <button className="danger" onClick={endSession}>
                  End early
                </button>
              </div>
              {!speechSupported && (
                <p className="muted" style={{ marginBottom: 0 }}>
                  Live transcript unavailable in this browser.
                </p>
              )}
            </div>
          )}

          {phase === 'ending' && <div className="card muted">Generating your report…</div>}
        </div>

        <div>
          {(phase === 'running' || phase === 'ending') && (
            <>
              <MoodBadge mood={mood} />
              <LiveChart title="Nervousness" values={nervousnessHistory} />
              <Meters values={meters} />
            </>
          )}
        </div>
      </div>

      {nudge && <div className="nudge">{nudge.message}</div>}
    </div>
  )
}
