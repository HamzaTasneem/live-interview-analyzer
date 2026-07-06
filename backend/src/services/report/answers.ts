// Per-question answer segmentation and heuristic quality analysis (F1/F2).
// Pure functions — the LLM adds richer coaching on top when available.

import type { MetricSignals } from './scores.js'

export interface WindowWithMeta extends MetricSignals {
  questionOrder?: number
  transcriptDelta?: string
  mood?: { state: string; emoji: string; nervousness: number }
}

export interface AnswerSegment {
  order: number
  transcript: string
  words: number
  fillers: number
  durationSec: number
  avgNervousness: number
  dominantMood: { state: string; emoji: string } | null
}

export function segmentByQuestion(windows: WindowWithMeta[]): AnswerSegment[] {
  const byOrder = new Map<number, WindowWithMeta[]>()
  for (const w of windows) {
    const order = w.questionOrder ?? 0
    if (!byOrder.has(order)) byOrder.set(order, [])
    byOrder.get(order)!.push(w)
  }

  const segments: AnswerSegment[] = []
  for (const [order, ws] of [...byOrder.entries()].sort((a, b) => a[0] - b[0])) {
    if (order === 0) continue // windows before the first question
    const transcript = ws
      .map((w) => w.transcriptDelta?.trim())
      .filter(Boolean)
      .join(' ')
    const nervousValues = ws.map((w) => w.mood?.nervousness).filter((n): n is number => n !== undefined)

    const moodCounts = new Map<string, { count: number; emoji: string }>()
    for (const w of ws) {
      if (!w.mood) continue
      const cur = moodCounts.get(w.mood.state) ?? { count: 0, emoji: w.mood.emoji }
      cur.count++
      moodCounts.set(w.mood.state, cur)
    }
    const dominant = [...moodCounts.entries()].sort((a, b) => b[1].count - a[1].count)[0]

    segments.push({
      order,
      transcript,
      words: ws.reduce((a, w) => a + (w.speech?.words ?? 0), 0),
      fillers: ws.reduce((a, w) => a + (w.speech?.fillers ?? 0), 0),
      durationSec: ws.length,
      avgNervousness: nervousValues.length
        ? Math.round((nervousValues.reduce((a, b) => a + b, 0) / nervousValues.length) * 100) / 100
        : 0,
      dominantMood: dominant ? { state: dominant[0], emoji: dominant[1].emoji } : null,
    })
  }
  return segments
}

// Heuristic structure analysis — works with no LLM. STAR-ish cue phrases.
const SITUATION_CUES = /\b(when i|at my|in my previous|there was a time|situation|last year|recently)\b/i
const ACTION_CUES = /\b(so i|i decided|i took|i organized|i created|i led|i implemented|my approach)\b/i
const RESULT_CUES = /\b(as a result|in the end|the result|which led to|we achieved|it improved|outcome)\b/i

export interface AnswerHeuristics {
  hasSituation: boolean
  hasAction: boolean
  hasResult: boolean
  structureScore: number // 0-100
  lengthAssessment: 'too short' | 'good length' | 'long'
  fillerDensity: number // per 100 words
}

export function analyzeAnswerHeuristics(seg: AnswerSegment): AnswerHeuristics {
  const t = seg.transcript
  const hasSituation = SITUATION_CUES.test(t)
  const hasAction = ACTION_CUES.test(t)
  const hasResult = RESULT_CUES.test(t)
  const structureScore = Math.round(
    ((hasSituation ? 1 : 0) + (hasAction ? 1 : 0) + (hasResult ? 1 : 0)) * (100 / 3),
  )
  const lengthAssessment =
    seg.words < 40 ? 'too short' : seg.words > 350 ? 'long' : 'good length'
  const fillerDensity = seg.words > 0 ? Math.round((seg.fillers / seg.words) * 1000) / 10 : 0
  return { hasSituation, hasAction, hasResult, structureScore, lengthAssessment, fillerDensity }
}

export function heuristicAnswerCoaching(seg: AnswerSegment, h: AnswerHeuristics): string {
  const parts: string[] = []
  if (!seg.transcript) {
    return 'No transcript was captured for this answer, so content coaching is unavailable — the delivery signals above still apply.'
  }
  if (h.lengthAssessment === 'too short') {
    parts.push('This answer was quite short — aim for 1–2 minutes with a concrete example.')
  } else if (h.lengthAssessment === 'long') {
    parts.push('This answer ran long — practice landing the point, then stopping.')
  } else {
    parts.push('Good answer length.')
  }
  const missing: string[] = []
  if (!h.hasSituation) missing.push('the situation/context')
  if (!h.hasAction) missing.push('the specific actions you took')
  if (!h.hasResult) missing.push('the result or impact')
  if (missing.length) {
    parts.push(`Consider adding ${missing.join(', ')} (STAR structure: Situation, Task, Action, Result).`)
  } else {
    parts.push('Nice STAR-style structure — situation, action, and result all came through.')
  }
  if (h.fillerDensity > 5) {
    parts.push(`Filler words were frequent here (${h.fillerDensity} per 100 words) — pause silently instead.`)
  }
  return parts.join(' ')
}

// Percentile rank of v among values (share strictly below), 0-100
export function percentileRank(values: number[], v: number): number {
  if (!values.length) return 50
  const below = values.filter((x) => x < v).length
  return Math.round((below / values.length) * 100)
}
