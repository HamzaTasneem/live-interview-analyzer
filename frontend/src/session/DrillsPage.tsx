import { useEffect, useRef, useState } from 'react'
import { FaceAnalyzer } from '../analysis/faceAnalyzer.js'
import { AudioAnalyzer } from '../analysis/audioAnalyzer.js'
import { SpeechRecognizer } from '../analysis/speech.js'

// F6: 60-second focused exercises with one giant live meter. Client-only —
// nothing is persisted; drills are pure practice reps.

const DRILL_SECONDS = 60

type DrillKey = 'eye-contact' | 'fillers' | 'pace'

interface DrillDef {
  key: DrillKey
  title: string
  emoji: string
  instructions: string
  needsSpeech: boolean
  metricLabel: string
}

const DRILLS: DrillDef[] = [
  {
    key: 'eye-contact',
    title: 'Eye contact hold',
    emoji: '👁️',
    instructions:
      'Talk about your weekend while looking straight at the camera lens for the full 60 seconds. The meter shows the share of time you held eye contact.',
    needsSpeech: false,
    metricLabel: 'eye contact',
  },
  {
    key: 'fillers',
    title: 'Filler killer',
    emoji: '🤐',
    instructions:
      'Describe your current job (or studies) for 60 seconds with ZERO filler words — no um, uh, like, you know. Pause silently instead. Score starts at 100 and drops with each filler.',
    needsSpeech: true,
    metricLabel: 'filler-free score',
  },
  {
    key: 'pace',
    title: 'Pace control',
    emoji: '🎯',
    instructions:
      'Explain a topic you know well while keeping your pace in the 120–150 words-per-minute sweet spot. The meter shows how close you are.',
    needsSpeech: true,
    metricLabel: 'pace accuracy',
  },
]

type Phase = 'pick' | 'permissions' | 'running' | 'done'

export default function DrillsPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [drill, setDrill] = useState<DrillDef | null>(null)
  const [phase, setPhase] = useState<Phase>('pick')
  const [secondsLeft, setSecondsLeft] = useState(DRILL_SECONDS)
  const [metric, setMetric] = useState(0) // 0-100 live value
  const [finalScore, setFinalScore] = useState(0)
  const [detail, setDetail] = useState('')
  const [error, setError] = useState('')

  const rt = useRef<{
    stream?: MediaStream
    face?: FaceAnalyzer
    audio?: AudioAnalyzer
    speech?: SpeechRecognizer
    rafId?: number
    tickId?: number
    eyeFrames: boolean[]
    fillers: number
    words: number
    paceSamples: number[]
  }>({ eyeFrames: [], fillers: 0, words: 0, paceSamples: [] })

  const cleanup = () => {
    const r = rt.current
    if (r.rafId) cancelAnimationFrame(r.rafId)
    if (r.tickId) clearInterval(r.tickId)
    r.speech?.stop()
    r.audio?.stop()
    r.face?.close()
    r.stream?.getTracks().forEach((t) => t.stop())
    rt.current = { eyeFrames: [], fillers: 0, words: 0, paceSamples: [] }
  }

  useEffect(() => cleanup, [])

  const start = async (d: DrillDef) => {
    setDrill(d)
    setPhase('permissions')
    setError('')
    const r = rt.current
    try {
      r.stream = await navigator.mediaDevices.getUserMedia({
        video: d.key === 'eye-contact' ? { width: 640, height: 480, facingMode: 'user' } : false,
        audio: true,
      })
      if (d.key === 'eye-contact') {
        if (videoRef.current) {
          videoRef.current.srcObject = r.stream
          await videoRef.current.play()
        }
        r.face = new FaceAnalyzer()
        await r.face.init()
      }
      r.audio = new AudioAnalyzer()
      r.audio.start(r.stream)
      if (d.needsSpeech) {
        if (!SpeechRecognizer.supported()) {
          setError('This drill needs live transcription, which your browser does not support. Try Chrome or Edge.')
          cleanup()
          setPhase('pick')
          return
        }
        r.speech = new SpeechRecognizer()
        r.speech.onDelta = (delta) => {
          r.fillers += delta.fillers
          r.words += delta.words
          r.audio?.tracker.addWords(delta.words, performance.now())
        }
        r.speech.start()
      }

      setSecondsLeft(DRILL_SECONDS)
      setMetric(d.key === 'fillers' ? 100 : 0)
      setPhase('running')

      if (d.key === 'eye-contact') {
        const loop = () => {
          const video = videoRef.current
          if (video && r.face?.ready) {
            const signals = r.face.analyze(video, performance.now())
            if (signals) r.eyeFrames.push(signals.eyeContact)
          }
          r.rafId = requestAnimationFrame(loop)
        }
        r.rafId = requestAnimationFrame(loop)
      }

      let elapsed = 0
      r.tickId = window.setInterval(() => {
        elapsed++
        setSecondsLeft(DRILL_SECONDS - elapsed)

        if (d.key === 'eye-contact') {
          const pct = r.eyeFrames.length
            ? (r.eyeFrames.filter(Boolean).length / r.eyeFrames.length) * 100
            : 0
          setMetric(Math.round(pct))
        } else if (d.key === 'fillers') {
          setMetric(Math.max(0, 100 - r.fillers * 10))
        } else {
          const wpm = r.audio!.tracker.wpm(performance.now())
          r.paceSamples.push(wpm)
          const closeness = wpm === 0 ? 0 : Math.max(0, 1 - Math.abs(wpm - 135) / 75)
          setMetric(Math.round(closeness * 100))
        }

        if (elapsed >= DRILL_SECONDS) {
          finish(d)
        }
      }, 1000)
    } catch (err: any) {
      setError(
        err?.name === 'NotAllowedError'
          ? 'Permission denied — allow camera/microphone and try again.'
          : `Could not start: ${err.message}`,
      )
      cleanup()
      setPhase('pick')
    }
  }

  const finish = (d: DrillDef) => {
    const r = rt.current
    let score = 0
    let text = ''
    if (d.key === 'eye-contact') {
      score = r.eyeFrames.length
        ? Math.round((r.eyeFrames.filter(Boolean).length / r.eyeFrames.length) * 100)
        : 0
      text =
        score >= 80
          ? 'Excellent — that steadiness reads as confidence in a real interview.'
          : score >= 50
            ? 'Good base. Try anchoring your gaze on the lens and only breaking away deliberately.'
            : 'Keep practicing — put a sticker next to your camera as a reminder to come back to it.'
    } else if (d.key === 'fillers') {
      score = Math.max(0, 100 - r.fillers * 10)
      text =
        r.fillers === 0
          ? 'Perfect — zero fillers. Silence beats um every time.'
          : `${r.fillers} filler${r.fillers === 1 ? '' : 's'} in 60 seconds. Each time you feel one coming, close your mouth and breathe instead.`
    } else {
      const valid = r.paceSamples.filter((v) => v > 0)
      const avg = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0
      score = avg === 0 ? 0 : Math.round(Math.max(0, 1 - Math.abs(avg - 135) / 75) * 100)
      text = avg
        ? `You averaged ${Math.round(avg)} words/min. ${avg > 160 ? 'Slow down — let key points breathe.' : avg < 110 ? 'Pick up the energy slightly.' : 'Right in the sweet spot.'}`
        : 'Not enough speech captured to measure pace — try speaking continuously.'
    }
    setFinalScore(score)
    setDetail(text)
    cleanup()
    setPhase('done')
  }

  const stopEarly = () => {
    if (drill) finish(drill)
  }

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      {phase === 'pick' && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Drills</h2>
          <p className="muted">
            60-second focused reps on a single skill. No report, no history — just practice.
          </p>
          {error && <div className="error">{error}</div>}
          {DRILLS.map((d) => (
            <div key={d.key} className="drill-row">
              <div className="drill-emoji">{d.emoji}</div>
              <div style={{ flex: 1 }}>
                <strong>{d.title}</strong>
                <div className="muted" style={{ fontSize: 13 }}>
                  {d.instructions}
                </div>
              </div>
              <button onClick={() => start(d)}>Start</button>
            </div>
          ))}
        </div>
      )}

      {phase === 'permissions' && (
        <div className="card muted">Setting up camera/microphone and models…</div>
      )}

      {phase === 'running' && drill && (
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ marginTop: 0 }}>
            {drill.emoji} {drill.title}
          </h3>
          {drill.key === 'eye-contact' && (
            <video
              ref={videoRef}
              className="preview"
              muted
              playsInline
              style={{ maxWidth: 320, margin: '0 auto', display: 'block' }}
            />
          )}
          <div className="drill-metric" style={{ color: metric >= 66 ? 'var(--good)' : metric >= 33 ? 'var(--warn)' : 'var(--bad)' }}>
            {metric}
          </div>
          <div className="muted">{drill.metricLabel}</div>
          <div className="drill-timer">{secondsLeft}s</div>
          <button className="danger" onClick={stopEarly}>
            Stop
          </button>
        </div>
      )}

      {phase === 'done' && drill && (
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ marginTop: 0 }}>
            {drill.emoji} {drill.title} — done
          </h3>
          <div className="drill-metric" style={{ color: finalScore >= 66 ? 'var(--good)' : finalScore >= 33 ? 'var(--warn)' : 'var(--bad)' }}>
            {finalScore}
          </div>
          <p style={{ lineHeight: 1.6 }}>{detail}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => start(drill)}>Again</button>
            <button className="secondary" onClick={() => setPhase('pick')}>
              Other drills
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
