import 'dotenv/config'

export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-do-not-use-in-prod',
  storageDriver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3',
  localStoragePath: process.env.LOCAL_STORAGE_PATH ?? './data/recordings',
  llmProvider: process.env.LLM_PROVIDER ?? 'none',
  retentionDays: Number(process.env.RECORDING_RETENTION_DAYS ?? 30),
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? '',
    bucket: process.env.S3_BUCKET ?? 'recordings',
    accessKey: process.env.S3_ACCESS_KEY ?? '',
    secretKey: process.env.S3_SECRET_KEY ?? '',
  },
}
