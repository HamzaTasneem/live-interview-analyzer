import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import multipart from '@fastify/multipart'
import authPlugin from './plugins/auth.js'
import authRoutes from './routes/auth.js'
import inviteRoutes from './routes/invites.js'
import sessionRoutes from './routes/sessions.js'
import metricsRoutes from './routes/metrics.js'
import reportRoutes from './routes/reports.js'
import recordingRoutes from './routes/recordings.js'
import adminRoutes from './routes/admin.js'
import progressRoutes from './routes/progress.js'

export async function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' })

  await app.register(cors, { origin: true })
  await app.register(websocket)
  await app.register(multipart, { limits: { fileSize: 500 * 1024 * 1024 } })
  await app.register(authPlugin)

  await app.register(authRoutes)
  await app.register(inviteRoutes)
  await app.register(sessionRoutes)
  await app.register(metricsRoutes)
  await app.register(reportRoutes)
  await app.register(recordingRoutes)
  await app.register(adminRoutes)
  await app.register(progressRoutes)

  app.get('/api/health', async () => ({ ok: true }))

  return app
}
