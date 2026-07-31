import { supabase } from '../config/supabase.js'
import { supabaseAdmin } from '../config/supabase.js'
import { logSecurityEvent } from '../utils/audit.js'

export async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      logSecurityEvent('token_ausente', null, { ip: req.ip, path: req.path }, 'warn')
      return res.status(401).json({ error: 'Token requerido' })
    }

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) {
      logSecurityEvent('token_invalido', null, { ip: req.ip, path: req.path, error: error?.message }, 'warn')
      return res.status(401).json({ error: 'Token inválido' })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_active')
      .eq('id', data.user.id)
      .single()

    if (profile && !profile.is_active) {
      logSecurityEvent('cuenta_desactivada', { id: data.user.id }, { ip: req.ip, path: req.path }, 'warn')
      return res.status(403).json({ error: 'Cuenta desactivada. Contacta al administrador.' })
    }

    req.user = data.user
    next()
  } catch (err) {
    logSecurityEvent('error_auth', null, { ip: req.ip, error: err.message }, 'error')
    res.status(500).json({ error: 'Error de autenticación' })
  }
}
