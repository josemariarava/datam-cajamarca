import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
import { consultarDNI } from '../services/dni.js'

const router = Router()

router.use(requireAuth, requireAdmin)

// Estadísticas globales
router.get('/stats', async (req, res) => {
  const [
    { count: totalEncuestadores },
    { count: totalVotantes },
    { count: totalVotos },
    { count: totalCandidatos },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('voters').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('votes').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('candidates').select('*', { count: 'exact', head: true }).eq('activo', true),
  ])

  res.json({
    total_encuestadores: totalEncuestadores,
    total_votantes: totalVotantes,
    total_votos: totalVotos,
    total_candidatos: totalCandidatos,
    participacion_pct: totalVotantes > 0 ? ((totalVotos / totalVotantes) * 100).toFixed(1) : 0,
  })
})

// Gestión de encuestadores
router.get('/encuestadores', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, dni, nombres, apellido_paterno, apellido_materno, telefono, role, is_active, created_at')
    .order('created_at', { ascending: false })

  if (error) return res.status(400).json({ error: error.message })

  // Agregar conteo de votos por encuestador
  const { data: votesData } = await supabaseAdmin
    .from('votes')
    .select('registered_by, count')

  const voteCounts = {}
  for (const v of votesData || []) {
    voteCounts[v.registered_by] = (voteCounts[v.registered_by] || 0) + 1
  }

  const result = data.map(p => ({
    ...p,
    total_votos_registrados: voteCounts[p.id] || 0,
  }))

  res.json(result)
})

router.post('/encuestadores', async (req, res) => {
  try {
    const { email, password, dni, nombres, apellido_paterno, apellido_materno, telefono, direccion } = req.body
    if (!email || !password || !dni) {
      return res.status(400).json({ error: 'Email, password y DNI requeridos' })
    }

    let datosDNI
    try {
      datosDNI = await consultarDNI(dni)
    } catch {
      if (!nombres || !apellido_paterno) {
        return res.status(400).json({
          error: 'DNI no encontrado. Debes proporcionar nombres y apellido paterno manualmente.'
        })
      }
      datosDNI = { nombres, apellido_paterno, apellido_materno: apellido_materno || '' }
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) return res.status(400).json({ error: authError.message })

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      dni,
      nombres: datosDNI.nombres,
      apellido_paterno: datosDNI.apellido_paterno,
      apellido_materno: datosDNI.apellido_materno || '',
      telefono,
      role: 'encuestador',
    })

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return res.status(400).json({ error: profileError.message })
    }

    res.status(201).json({ message: 'Encuestador creado exitosamente' })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.put('/encuestadores/:id/toggle-active', async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_active')
    .eq('id', req.params.id)
    .single()

  if (!profile) return res.status(404).json({ error: 'Encuestador no encontrado' })

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ is_active: !profile.is_active })
    .eq('id', req.params.id)

  if (error) return res.status(400).json({ error: error.message })

  await supabaseAdmin.from('audit_log').insert({
    user_id: req.user.id, action: 'toggle_encuestador_active',
    details: { target_id: req.params.id, new_status: !profile.is_active },
  })

  res.json({ is_active: !profile.is_active })
})

// Datos para mapa GPS
router.get('/map-data', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('votes')
    .select(`
      id, location_lat, location_lng, location_address, created_at,
      candidate:candidates(id, nombre, color_hex, partido),
      registered_by_profile:profiles!votes_registered_by_fkey(nombres, apellido_paterno)
    `)
    .not('location_lat', 'is', null)
    .order('created_at', { ascending: false })

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

// Exportar datos
const csvSafe = (s) => {
  if (!s) return ''
  const str = String(s)
  if (['=', '+', '-', '@', '\t', '\r'].includes(str[0])) return `'${str}`
  if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`
  return str
}

router.get('/export', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('votes')
    .select(`
      verification_code, created_at, location_lat, location_lng,
      voter:voters(dni, nombres, apellido_paterno, apellido_materno, direccion, telefono),
      candidate:candidates(nombre, partido),
      registered_by_profile:profiles!votes_registered_by_fkey(nombres, apellido_paterno)
    `)
    .order('created_at', { ascending: false })

  if (error) return res.status(400).json({ error: error.message })

  const csv = [
    'DNI Votante,Nombres,Apellidos,Direccion,Telefono,Candidato,Partido,Encuestador,Verificacion,Fecha,Lat,Lng',
    ...data.map(v => [
      csvSafe(v.voter?.dni),
      csvSafe(v.voter?.nombres),
      csvSafe(`${v.voter?.apellido_paterno || ''} ${v.voter?.apellido_materno || ''}`.trim()),
      csvSafe(v.voter?.direccion),
      csvSafe(v.voter?.telefono),
      csvSafe(v.candidate?.nombre),
      csvSafe(v.candidate?.partido),
      csvSafe(`${v.registered_by_profile?.nombres || ''} ${v.registered_by_profile?.apellido_paterno || ''}`.trim()),
      csvSafe(v.verification_code),
      csvSafe(new Date(v.created_at).toISOString()),
      csvSafe(v.location_lat),
      csvSafe(v.location_lng),
    ].join(',')),
  ].join('\n')

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=votos.csv')
  res.send(csv)
})

// Resetear votación
router.post('/reset', async (req, res) => {
  await supabaseAdmin.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  await supabaseAdmin.from('audit_log').insert({
    user_id: req.user.id, action: 'reset_votacion',
    details: {},
  })

  res.json({ message: 'Votación reseteada exitosamente' })
})

export default router
