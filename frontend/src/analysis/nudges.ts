// Live nudge engine (R6): supportive cues from rolling 5s signal windows,
// rate-limited to one nudge per 20s. Wording is always encouraging.

export interface NudgeSignalSample {
  ts: number
  eyeContact?: boolean
  fidget?: number
  wpm?: number
  speaking?: boolean
  volume?: number
  posture?: number
}

export interface Nudge {
  id: string
  message: string
}

const NUDGE_RULES: Array<{
  id: string
  message: string
  trigger: (window: NudgeSignalSample[]) => boolean
}> = [
  {
    id: 'eye-contact',
    message: 'Try looking at the camera — it reads as eye contact.',
    trigger: (w) => {
      const gazeSamples = w.filter((s) => s.eyeContact !== undefined)
      return gazeSamples.length >= 4 && gazeSamples.every((s) => !s.eyeContact)
    },
  },
  {
    id: 'fidgeting',
    message: 'Take a breath and settle your posture — you have got this.',
    trigger: (w) => {
      const f = w.filter((s) => s.fidget !== undefined)
      return f.length >= 4 && f.every((s) => (s.fidget ?? 0) > 0.6)
    },
  },
  {
    id: 'pace-fast',
    message: 'Great energy — slow down just a little so every word lands.',
    trigger: (w) => {
      const speaking = w.filter((s) => s.speaking && (s.wpm ?? 0) > 0)
      return speaking.length >= 4 && speaking.every((s) => (s.wpm ?? 0) > 180)
    },
  },
  {
    id: 'posture',
    message: 'Sit up tall and open your shoulders — strong posture reads as confidence.',
    trigger: (w) => {
      const p = w.filter((s) => s.posture !== undefined)
      return p.length >= 4 && p.every((s) => (s.posture ?? 1) < 0.4)
    },
  },
  {
    id: 'volume-low',
    message: 'Speak up a touch — let them hear your confidence.',
    trigger: (w) => {
      const speaking = w.filter((s) => s.speaking)
      return speaking.length >= 4 && speaking.every((s) => (s.volume ?? 1) < 0.02)
    },
  },
]

export class NudgeEngine {
  private samples: NudgeSignalSample[] = []
  private lastNudgeAt = -Infinity
  constructor(
    private windowMs = 5000,
    private cooldownMs = 20000,
  ) {}

  addSample(sample: NudgeSignalSample): Nudge | null {
    this.samples.push(sample)
    const cutoff = sample.ts - this.windowMs
    this.samples = this.samples.filter((s) => s.ts >= cutoff)

    if (sample.ts - this.lastNudgeAt < this.cooldownMs) return null

    for (const rule of NUDGE_RULES) {
      if (rule.trigger(this.samples)) {
        this.lastNudgeAt = sample.ts
        return { id: rule.id, message: rule.message }
      }
    }
    return null
  }
}
