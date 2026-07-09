import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { voteLimiter, generalLimiter } from '../middleware/rateLimit.js'

const router = Router()
router.use(generalLimiter)

// Encuestador registra un voto (ingresando DNI del votante)
router.post('/register', voteLimiter, requireAuth, async (req, res) => {
  try {
    const { dni_votante, nombres, apellido_paterno, apellido_materno, candidate_id, direccion, telefono, location_lat, location_lng, location_address } = req.body

    if (!dni_votante || !candidate_id) {
      return res.status(400).json({ error: 'DNI del votante y candidato son requeridos' })
    }

    // Buscar o crear votante
    let voterId
    const { data: existingVoter } = await supabaseAdmin
      .from('voters')
      .select('id')
      .eq('dni', dni_votante)
      .single()

    if (existingVoter) {
      voterId = existingVoter.id
      await supabaseAdmin.from('voters').update({
        nombres, apellido_paterno, apellido_materno: apellido_materno || '',
        direccion: direccion || '', telefono: telefono || '',
      }).eq('id', voterId)
    } else {
      // Crear votante nuevo
      if (!nombres || !apellido_paterno) {
        return res.status(400).json({ error: 'Datos del votante incompletos' })
      }

      const { data: newVoter, error: voterError } = await supabaseAdmin
        .from('voters')
        .insert({
          dni: dni_votante,
          nombres,
          apellido_paterno,
          apellido_materno: apellido_materno || '',
          direccion: direccion || '',
          telefono: telefono || '',
          created_by: req.user.id,
        })
        .select('id')
        .single()

      if (voterError) return res.status(400).json({ error: voterError.message })
      voterId = newVoter.id
    }

    // Registrar voto (UNIQUE en voter_id previene duplicados atómicamente)
    const { data: vote, error: voteError } = await supabaseAdmin
      .from('votes')
      .insert({
        voter_id: voterId,
        candidate_id,
        registered_by: req.user.id,
        location_lat: location_lat || null,
        location_lng: location_lng || null,
        location_address: location_address || '',
      })
      .select('id, verification_code, created_at')
      .single()

    if (voteError) {
      if (voteError.code === '23505') {
        return res.status(400).json({ error: 'Esta persona ya emitió su voto' })
      }
      return res.status(400).json({ error: voteError.message })
    }

    // Devolver datos completos del votante + voto
    const { data: voterData } = await supabaseAdmin
      .from('voters')
      .select('dni, nombres, apellido_paterno, apellido_materno')
      .eq('id', voterId)
      .single()

    res.status(201).json({
      message: 'Voto registrado exitosamente',
      vote_id: vote.id,
      verification_code: vote.verification_code,
      created_at: vote.created_at,
      voter: voterData,
    })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Verificar voto por DNI (público, sin auth)
router.get('/verify/:dni', async (req, res) => {
  if (!req.params.dni || !/^\d{8}$/.test(req.params.dni)) {
    return res.status(400).json({ error: 'DNI debe tener 8 dígitos' })
  }
  const { data, error } = await supabaseAdmin
    .from('votes')
    .select(`
      verification_code, created_at,
      voter:voters!inner(dni, nombres, apellido_paterno, apellido_materno),
      candidate:candidates(id, nombre, foto_url, partido, color_hex, logo_partido_url)
    `)
    .eq('voter.dni', req.params.dni)
    .maybeSingle()

  if (error) return res.status(400).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'No se encontró voto para este DNI' })

  res.json(data)
})

// Verificar voto por código (público)
router.get('/verify-code/:code', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('votes')
    .select(`
      verification_code, created_at,
      voter:voters(dni, nombres, apellido_paterno, apellido_materno),
      candidate:candidates(id, nombre, foto_url, partido, color_hex, logo_partido_url)
    `)
    .eq('verification_code', req.params.code.toUpperCase())
    .maybeSingle()

  if (error) return res.status(400).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Código inválido' })

  res.json(data)
})

// Resultados en vivo
router.get('/results', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('vote_results')
    .select('*')

  if (error) return res.status(400).json({ error: error.message })

  const total = data.reduce((sum, r) => sum + Number(r.votos), 0)

  res.json({ results: data, total })
})

// Verificar si ya se registró un DNI como votante (para encuestador)
router.get('/check-voter/:dni', requireAuth, async (req, res) => {
  if (!req.params.dni || !/^\d{8}$/.test(req.params.dni)) {
    return res.status(400).json({ error: 'DNI debe tener 8 dígitos' })
  }
  const { data: voter } = await supabaseAdmin
    .from('voters')
    .select('id, dni, nombres, apellido_paterno, apellido_materno, direccion, telefono')
    .eq('dni', req.params.dni)
    .maybeSingle()

  if (!voter) return res.json({ exists: false })

  // Verificar si ya votó
  const { data: vote } = await supabaseAdmin
    .from('votes')
    .select('id, verification_code, created_at, candidate_id')
    .eq('voter_id', voter.id)
    .maybeSingle()

  res.json({
    exists: true,
    voter,
    has_voted: !!vote,
    vote: vote || null,
  })
})

// Deshacer último voto (solo si fue del encuestador actual y hace menos de 5 min)
router.delete('/undo-last', requireAuth, async (req, res) => {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const { data: lastVote } = await supabaseAdmin
    .from('votes')
    .select('id, created_at')
    .eq('registered_by', req.user.id)
    .gte('created_at', fiveMinAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastVote) {
    return res.status(400).json({ error: 'No hay votos recientes para deshacer' })
  }

  const { error } = await supabaseAdmin
    .from('votes')
    .delete()
    .eq('id', lastVote.id)

  if (error) return res.status(400).json({ error: error.message })

  await supabaseAdmin.from('audit_log').insert({
    user_id: req.user.id, action: 'undo_vote',
    details: { vote_id: lastVote.id, created_at: lastVote.created_at },
  })

  res.json({ message: 'Voto deshecho exitosamente' })
})

export default router
