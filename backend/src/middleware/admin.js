import { supabaseAdmin } from '../config/supabase.js'

export async function requireAdmin(req, res, next) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', req.user.id)
    .single()

  if (error || data.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: se requiere rol de administrador' })
  }

  next()
}
