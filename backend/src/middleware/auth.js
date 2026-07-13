import { supabase } from '../config/supabase.js'
import { supabaseAdmin } from '../config/supabase.js'

export async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Token requerido' })

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return res.status(401).json({ error: 'Token inválido' })

    // Verificar que el perfil esté activo
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_active')
      .eq('id', data.user.id)
      .single()

    if (profile && !profile.is_active) {
      return res.status(403).json({ error: 'Cuenta desactivada. Contacta al administrador.' })
    }

    req.user = data.user
    next()
  } catch (err) {
    res.status(500).json({ error: 'Error de autenticación' })
  }
}
