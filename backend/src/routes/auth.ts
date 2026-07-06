import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../db.js'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  inviteCode: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export default async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message })
    const { email, password, name, inviteCode } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return reply.code(409).send({ error: 'Email already registered' })

    // First user ever becomes admin; invite code registers a candidate
    // linked to the inviting assessor; otherwise the account is a candidate.
    const userCount = await prisma.user.count()
    let role = userCount === 0 ? 'admin' : 'candidate'
    let invite = null

    if (inviteCode) {
      invite = await prisma.invite.findUnique({ where: { code: inviteCode } })
      if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
        return reply.code(400).send({ error: 'Invalid or expired invite code' })
      }
      role = 'candidate'
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({ data: { email, passwordHash, name, role } })

    if (invite) {
      await prisma.invite.update({ where: { id: invite.id }, data: { usedAt: new Date() } })
    }

    const token = app.jwt.sign({ id: user.id, role: user.role as any, email: user.email })
    return reply.code(201).send({ token, user: { id: user.id, email, name, role } })
  })

  app.post('/api/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid credentials' })
    const { email, password } = parsed.data

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const token = app.jwt.sign({ id: user.id, role: user.role as any, email: user.email })
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } }
  })

  app.get('/api/auth/me', { preHandler: app.authenticate }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, role: true },
    })
    return { user }
  })
}
