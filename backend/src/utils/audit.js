import * as Sentry from '@sentry/node'
import logger from '../config/logger.js'

export function logSecurityEvent(action, user = null, details = {}, severity = 'info') {
  const level = severity === 'error' ? 'error' : severity === 'warn' ? 'warn' : 'info'
  logger[level]('Evento de seguridad:', { action, userId: user?.id, details })

  if (process.env.SENTRY_DSN) {
    Sentry.captureEvent({
      message: `[Security] ${action}`,
      level: severity === 'error' ? 'error' : severity === 'warn' ? 'warning' : 'info',
      user: user ? { id: user.id, ip: details.ip } : undefined,
      extra: { action, ...details },
      tags: { security_event: action },
    })
  }
}
