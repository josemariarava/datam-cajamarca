import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

import authRoutes from './routes/auth.js'
import candidateRoutes from './routes/candidates.js'
import voteRoutes from './routes/votes.js'
import encuestadorRoutes from './routes/encuestador.js'
import adminRoutes from './routes/admin.js'
import verifyRoutes from './routes/verify.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json({ limit: '1mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/candidates', candidateRoutes)
app.use('/api/votes', voteRoutes)
app.use('/api/encuestador', encuestadorRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/verify', verifyRoutes)

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

app.use((err, req, res, next) => {
  console.error('Error no manejado:', err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err)
})

app.listen(PORT, () => {
  console.log(`Backend corriendo en puerto ${PORT}`)
})
