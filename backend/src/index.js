import 'dotenv/config'
import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import * as Sentry from '@sentry/node'

import logger from './config/logger.js'
import authRoutes from './routes/auth.js'
import candidateRoutes from './routes/candidates.js'
import voteRoutes from './routes/votes.js'
import encuestadorRoutes from './routes/encuestador.js'
import adminRoutes from './routes/admin.js'
import verifyRoutes from './routes/verify.js'

const app = express()
const PORT = process.env.PORT || 3001

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 })
  app.use(Sentry.Handlers.requestHandler())
}

app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json({ limit: '1mb' }))
app.use(morgan('short', { stream: { write: (msg) => logger.info(msg.trim()) } }))

app.use('/api/auth', authRoutes)
app.use('/api/candidates', candidateRoutes)
app.use('/api/votes', voteRoutes)
app.use('/api/encuestador', encuestadorRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/verify', verifyRoutes)

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler())
}

app.use((err, req, res, next) => {
  logger.error('Error no manejado:', err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err)
})

app.listen(PORT, () => {
  logger.info(`Backend corriendo en puerto ${PORT}`)
})
