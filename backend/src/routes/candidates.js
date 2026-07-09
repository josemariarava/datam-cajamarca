import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'

const router = Router()

const CANDIDATE_FIELDS = `
  id, numero_lista, nombre, partido, lema, color_hex,
  foto_url, logo_partido_url, edad, profesion, cargo_actual,
  ubicacion, biografia, propuestas, logros_destacados,
  activo, orden_prioridad, created_at
`

router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('candidates')
    .select(CANDIDATE_FIELDS)
    .order('orden_prioridad')
    .order('numero_lista')

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const fields = [
    'numero_lista', 'nombre', 'partido', 'lema', 'color_hex',
    'foto_url', 'logo_partido_url', 'edad', 'profesion', 'cargo_actual',
    'ubicacion', 'biografia', 'propuestas', 'logros_destacados', 'orden_prioridad',
  ]

  const insertData = { created_by: req.user.id }
  for (const f of fields) {
    if (req.body[f] !== undefined) insertData[f] = req.body[f]
  }

  if (!insertData.nombre) return res.status(400).json({ error: 'Nombre es requerido' })

  const { data, error } = await supabaseAdmin
    .from('candidates')
    .insert(insertData)
    .select(CANDIDATE_FIELDS)
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.status(201).json(data)
})

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const fields = [
    'numero_lista', 'nombre', 'partido', 'lema', 'color_hex',
    'foto_url', 'logo_partido_url', 'edad', 'profesion', 'cargo_actual',
    'ubicacion', 'biografia', 'propuestas', 'logros_destacados',
    'activo', 'orden_prioridad',
  ]

  const updateData = {}
  for (const f of fields) {
    if (req.body[f] !== undefined) updateData[f] = req.body[f]
  }

  const { data, error } = await supabaseAdmin
    .from('candidates')
    .update(updateData)
    .eq('id', req.params.id)
    .select(CANDIDATE_FIELDS)
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('candidates')
    .delete()
    .eq('id', req.params.id)

  if (error) return res.status(400).json({ error: error.message })
  res.json({ message: 'Candidato eliminado' })
})

export default router
