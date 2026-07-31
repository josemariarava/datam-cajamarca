import rateLimit from 'express-rate-limit'
import { logSecurityEvent } from '../utils/audit.js'

function withSecurityLogging(opts) {
  const name = opts.name || 'rate_limit'
  return rateLimit({
    ...opts,
    handler: (req, res, next) => {
      logSecurityEvent(`rate_limit_${name}`, req.user, {
        ip: req.ip,
        path: req.path,
        limit: opts.max,
        windowMs: opts.windowMs,
      }, 'warn')
      res.status(429).json(opts.message)
    },
  })
}

export const generalLimiter = withSecurityLogging({
  name: 'general',
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.' },
})

export const authLimiter = withSecurityLogging({
  name: 'auth',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiadas solicitudes de autenticación. Intenta de nuevo en 15 minutos.' },
})

export const voteLimiter = withSecurityLogging({
  name: 'vote',
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en 1 minuto.' },
})

export const verifyLimiter = withSecurityLogging({
  name: 'verify',
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Demasiadas consultas de verificación. Intenta de nuevo en 1 minuto.' },
})

export const adminExportLimiter = withSecurityLogging({
  name: 'admin_export',
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Límite de exportaciones alcanzado (3 por hora). Intenta de nuevo más tarde.' },
})
