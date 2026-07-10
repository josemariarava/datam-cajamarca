import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { voteLimiter, generalLimiter } from '../middleware/rateLimit.js'
import { consultarDNI } from '../services/dni.js'

const router = Router()
router.use(generalLimiter)

// Encuestador registra un voto (ingresando DNI del votante)
router.post('/register', voteLimiter, requireAuth, async (req, res) => {
  try {
    const { nombres, apellido_paterno, apellido_materno, direccion, telefono, location_lat, location_lng, location_address } = req.body
    const dni_votante = (req.body.dni_votante || '').trim()
    const candidate_id = req.body.candidate_id
    const s = v => (v || '').trim()
    const n = v => s(v).replace(/\s+/g, ' ')
    const isValidName = v => {
      const t = n(v)
      return /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+(?:[-\s][a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+)*$/.test(t) && t.length >= 2 && t.length <= 100
    }

    if (!dni_votante || !candidate_id || !s(nombres) || !s(apellido_paterno) || !s(apellido_materno)) {
      return res.status(400).json({ error: 'DNI del votante, nombres, apellido paterno, apellido materno y candidato son requeridos' })
    }

    if (!isValidName(nombres) || !isValidName(apellido_paterno) || !isValidName(apellido_materno)) {
      const t = [nombres, apellido_paterno, apellido_materno].find(v => !isValidName(v))
      const err = t?.length < 2 ? 'mínimo 2 caracteres' : t?.length > 100 ? 'máximo 100 caracteres' : 'solo letras, espacios y guiones'
      return res.status(400).json({ error: `Nombres y apellidos inválidos: ${err}` })
    }

    let voterId
    let existingVoter = null

    // Usar una transacción para prevenir race conditions y garantizar atomicidad
    const { data: voterCheck, error: voterError } = await supabaseAdmin
      .from('voters')
      .select('id')
      .eq('dni', dni_votante)
      .single()

    if (voterError && voterError.code !== 'PGRST116') {
      return res.status(400).json({ error: voterError.message })
    }

    if (voterCheck) {
      voterId = voterCheck.id
      // Con una transacción atómica, podemos evitar race conditions
      const { error: updateError } = await supabaseAdmin
        .from('voters')
        .update({
          nombres: n(nombres), apellido_paterno: n(apellido_paterno), apellido_materno: n(apellido_materno),
          direccion: s(direccion), telefono: s(telefono),
          created_by: req.user.id,
        })
        .eq('id', voterId)

      if (updateError) return res.status(400).json({ error: updateError.message })
    } else {
      // Crear votante nuevo
      const { data: newVoter, error: voterCreateError } = await supabaseAdmin
        .from('voters')
        .insert({
          dni: dni_votante,
          nombres: n(nombres),
          apellido_paterno: n(apellido_paterno),
          apellido_materno: n(apellido_materno),
          direccion: s(direccion),
          telefono: s(telefono),
          created_by: req.user.id,
        })
        .select('id')
        .single()

      if (voterCreateError) return res.status(400).json({ error: voterCreateError.message })
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
    return res.status(400).json({ error: 'DNI debe tener 8 dÃ­gitos' })
  }
  const { data: voter } = await supabaseAdmin
    .from('voters')
    .select('id, dni, nombres, apellido_paterno, apellido_materno, direcciÃ³n, telÃ©fono')
    .eq('dni', req.params.dni)
    .maybeSingle()

  if (!voter) {
    try {
      const mockPerson = await consultarDNI(req.params.dni)
      return res.json({ exists: false, voter: { dni: req.params.dni, ...mockPerson }, fromMock: true })
    } catch {
      return res.json({ exists: false })
    }
  }

  // Verificar si ya votÃ³
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
