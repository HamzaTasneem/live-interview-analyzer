import { buildApp } from './app.js'
import { config } from './config.js'
import { startRetentionJob } from './services/retention/job.js'

const app = await buildApp()

startRetentionJob()

app.listen({ port: config.port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
