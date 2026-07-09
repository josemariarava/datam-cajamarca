import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { consultarDNI } from '../services/dni.js'
import { requireAuth } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password, dni, telefono, direccion, nombres, apellido_paterno, apellido_materno } = req.body

    if (!email || !password || !dni) {
      return res.status(400).json({ error: 'Email, password y DNI son requeridos' })
    }

    let datosDNI
    if (nombres && apellido_paterno) {
      datosDNI = { nombres, apellido_paterno, apellido_materno: apellido_materno || '' }
    } else {
      datosDNI = await consultarDNI(dni)
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
      telefono: telefono || '',
      direccion: direccion || '',
      role: 'encuestador',
    })

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return res.status(400).json({ error: profileError.message })
    }

    res.status(201).json({ message: 'Encuestador registrado exitosamente' })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.post('/consultar-dni', authLimiter, async (req, res) => {
  try {
    const { dni } = req.body
    if (!dni || dni.length !== 8) return res.status(400).json({ error: 'DNI inválido' })
    const data = await consultarDNI(dni)
    res.json(data)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.get('/profile', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', req.user.id)
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

export default router
