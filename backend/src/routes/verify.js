import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'

const router = Router()

// Portal público de verificación - buscar por DNI
router.get('/:dni', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('votes')
    .select(`
      verification_code, created_at,
      voter:voters!inner(dni, nombres, apellido_paterno, apellido_materno),
      candidate:candidates(nombre, foto_url, partido, color_hex, logo_partido_url, lema)
    `)
    .eq('voter.dni', req.params.dni)
    .maybeSingle()

  if (error) return res.status(400).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'No se encontró un voto registrado con este DNI' })

  res.json(data)
})

export default router
