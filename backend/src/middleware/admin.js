import { supabaseAdmin } from '../config/supabase.js'
import { logSecurityEvent } from '../utils/audit.js'

export async function requireAdmin(req, res, next) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', req.user.id)
    .single()

  if (error || data.role !== 'admin') {
    logSecurityEvent('acceso_admin_denegado', req.user, { ip: req.ip, path: req.path, role: data?.role }, 'warn')
    return res.status(403).json({ error: 'Acceso denegado: se requiere rol de administrador' })
  }

  next()
}
