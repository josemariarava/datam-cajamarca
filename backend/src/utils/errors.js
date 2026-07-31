import logger from '../config/logger.js'

const ERROR_MAP = {
  '23505': 'Este registro ya existe',
  '23503': 'Registro relacionado no encontrado',
  '42P01': 'Error de configuración de base de datos',
  'PGRST116': 'No se encontraron resultados',
  'PGRST204': 'No se pudieron actualizar los datos',
  '42703': 'Error de estructura de datos',
}

export function sanitizeError(error) {
  if (!error) return 'Error desconocido'

  const message = error.message || String(error)
  const code = error.code || ''

  if (ERROR_MAP[code]) {
    logger.warn('Error de base de datos controlado:', { code, message })
    return ERROR_MAP[code]
  }

  if (message.includes('token')) {
    logger.warn('Error de autenticación:', message)
    return 'Error de autenticación'
  }

  if (message.includes('timeout') || message.includes('timed out')) {
    logger.warn('Timeout:', message)
    return 'El servidor tardó demasiado. Intenta de nuevo.'
  }

  if (message.includes('fetch failed') || message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
    logger.error('Error de conexión externa:', message)
    return 'Error de conexión con servicio externo'
  }

  logger.warn('Error no clasificado:', { code, message })
  return 'Error interno del servidor'
}

export function isValidHttpsUrl(str) {
  if (!str || typeof str !== 'string') return true
  try {
    const url = new URL(str)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}
