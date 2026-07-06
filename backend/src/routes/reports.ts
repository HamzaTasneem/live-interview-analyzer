import type { FastifyInstance } from 'fastify'
import { prisma } from '../db.js'
import { percentileRank } from '../services/report/answers.js'

const BENCHMARK_KEYS = ['overall', 'expression', 'eyeContact', 'stillness', 'voice', 'speech'] as const

// F8/F10: percentile of this session's scores vs all completed practice
// sessions. Framed as training context, never a ranking of people.
async function computeBenchmarks(scores: Record<string, number>, excludeSessionId: string) {
  const others = await prisma.report.findMany({
    where: { sessionId: { not: excludeSessionId } },
    select: { scores: true },
    take: 1000,
    orderBy: { createdAt: 'desc' },
  })
  if (others.length < 3) return null // not enough data to be meaningful

  const parsed = others
    .map((r) => {
      try {
        return JSON.parse(r.scores)
      } catch {
        return null
      }
    })
    .filter(Boolean)

  const benchmarks: Record<string, number> = {}
  for (const key of BENCHMARK_KEYS) {
    const values = parsed.map((p) => p[key]).filter((v) => typeof v === 'number')
    if (values.length >= 3 && typeof scores[key] === 'number') {
      benchmarks[key] = percentileRank(values, scores[key])
    }
  }
  return Object.keys(benchmarks).length ? { sampleSize: parsed.length, ...benchmarks } : null
}

export default async function reportRoutes(app: FastifyInstance) {
  app.get('/api/sessions/:id/report', { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        report: true,
        questions: { orderBy: { order: 'asc' } },
        metricWindows: { orderBy: { ts: 'asc' } },
      },
    })
    if (!session) return reply.code(404).send({ error: 'Session not found' })

    // R8: candidates see only their own; assessors only invited candidates'; admin all
    const isOwner = session.candidateId === req.user.id
    const isAssessor = req.user.role === 'assessor' && session.assessorId === req.user.id
    const isAdmin = req.user.role === 'admin'
    if (!isOwner && !isAssessor && !isAdmin) return reply.code(403).send({ error: 'Forbidden' })

    if (!session.report) return reply.code(404).send({ error: 'Report not ready' })

    // Timeline: per-second signal summaries aligned to question ask times
    const timeline = session.metricWindows.map((w) => {
      let signals: unknown = null
      try {
        signals = JSON.parse(w.signals)
      } catch {
        /* skip */
      }
      return { ts: w.ts, signals }
    })

    const scores = JSON.parse(session.report.scores)
    return {
      report: {
        id: session.report.id,
        scores,
        feedbackMd: session.report.feedbackMd,
        transcript: session.report.transcript,
        createdAt: session.report.createdAt,
      },
      benchmarks: await computeBenchmarks(scores, session.id),
      questions: session.questions,
      timeline,
      roleField: session.roleField,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    }
  })
}
