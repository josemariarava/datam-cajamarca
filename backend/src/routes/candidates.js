import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
import { generalLimiter } from '../middleware/rateLimit.js'
import { z } from 'zod'
import { sanitizeError, isValidHttpsUrl } from '../utils/errors.js'

const router = Router()
router.use(generalLimiter)

const CANDIDATE_FIELDS = `
  id, numero_lista, nombre, partido, lema, color_hex,
  foto_url, logo_partido_url, edad, profesion, cargo_actual,
  ubicacion, biografia, propuestas, logros_destacados,
  activo, orden_prioridad, created_at
`

const URL_SCHEMA = z.string().url().refine(v => v.startsWith('https://'), { message: 'Solo URLs HTTPS' }).or(z.literal('')).optional()
const HEX_COLOR = z.string().regex(/^#[0-9a-fA-F]{6}$/, { message: 'Color hex inválido (ej: #FF0000)' }).optional()

const candidateSchema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres'),
  partido: z.string().max(255).optional(),
  lema: z.string().max(255).optional(),
  color_hex: HEX_COLOR,
  foto_url: URL_SCHEMA,
  logo_partido_url: URL_SCHEMA,
  numero_lista: z.number().int().positive().optional().nullable(),
  edad: z.number().int().min(18, 'Edad mínima 18').max(120, 'Edad máxima 120').optional().nullable(),
  profesion: z.string().max(255).optional(),
  cargo_actual: z.string().max(255).optional(),
  ubicacion: z.string().max(255).optional(),
  biografia: z.string().optional(),
  propuestas: z.array(z.string()).optional(),
  logros_destacados: z.array(z.string()).optional(),
  activo: z.boolean().optional(),
  orden_prioridad: z.number().int().optional(),
})

router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('candidates')
    .select(CANDIDATE_FIELDS)
    .order('orden_prioridad')
    .order('numero_lista')

  if (error) return res.status(400).json({ error: sanitizeError(error) })
  res.json(data)
})

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const parsed = candidateSchema.safeParse(req.body)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return res.status(400).json({ error: `${firstError.path.join('.')}: ${firstError.message}` })
  }

  const { foto_url, logo_partido_url, ...rest } = parsed.data
  if (foto_url && !isValidHttpsUrl(foto_url)) return res.status(400).json({ error: 'foto_url: solo URLs HTTPS' })
  if (logo_partido_url && !isValidHttpsUrl(logo_partido_url)) return res.status(400).json({ error: 'logo_partido_url: solo URLs HTTPS' })

  const insertData = { ...rest, created_by: req.user.id }
  if (foto_url) insertData.foto_url = foto_url
  if (logo_partido_url) insertData.logo_partido_url = logo_partido_url

  const { data, error } = await supabaseAdmin
    .from('candidates')
    .insert(insertData)
    .select(CANDIDATE_FIELDS)
    .single()

  if (error) return res.status(400).json({ error: sanitizeError(error) })
  res.status(201).json(data)
})

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const parsed = candidateSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return res.status(400).json({ error: `${firstError.path.join('.')}: ${firstError.message}` })
  }

  const { foto_url, logo_partido_url, ...rest } = parsed.data
  if (foto_url && !isValidHttpsUrl(foto_url)) return res.status(400).json({ error: 'foto_url: solo URLs HTTPS' })
  if (logo_partido_url && !isValidHttpsUrl(logo_partido_url)) return res.status(400).json({ error: 'logo_partido_url: solo URLs HTTPS' })

  const updateData = { ...rest }
  if (foto_url !== undefined) updateData.foto_url = foto_url || null
  if (logo_partido_url !== undefined) updateData.logo_partido_url = logo_partido_url || null

  const { data, error } = await supabaseAdmin
    .from('candidates')
    .update(updateData)
    .eq('id', req.params.id)
    .select(CANDIDATE_FIELDS)
    .single()

  if (error) return res.status(400).json({ error: sanitizeError(error) })
  res.json(data)
})

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('candidates')
    .delete()
    .eq('id', req.params.id)

  if (error) return res.status(400).json({ error: sanitizeError(error) })
  res.json({ message: 'Candidato eliminado' })
})

export default router
