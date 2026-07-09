import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { generalLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.use(generalLimiter, requireAuth)

// Dashboard del encuestador
router.get('/dashboard', async (req, res) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    { count: totalHoy },
    { count: totalGeneral },
    { data: ultimosVotos },
    { data: ranking },
  ] = await Promise.all([
    supabaseAdmin
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('registered_by', req.user.id)
      .gte('created_at', today.toISOString()),

    supabaseAdmin
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('registered_by', req.user.id),

    supabaseAdmin
      .from('votes')
      .select(`
        id, created_at, verification_code,
        voter:voters(dni, nombres, apellido_paterno),
        candidate:candidates(id, nombre, color_hex)
      `)
      .eq('registered_by', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20),

    supabaseAdmin
      .from('votes')
      .select('registered_by, count')
      .gte('created_at', today.toISOString())
      .order('count', { ascending: false })
      .limit(5),
  ])

  // Para el ranking manual (supabase no soporta count con group by fácil)
  // Calculamos los top encuestadores del día
  const { data: allToday } = await supabaseAdmin
    .from('votes')
    .select('registered_by, profiles!inner(nombres, apellido_paterno)')
    .gte('created_at', today.toISOString())

  const rankMap = {}
  for (const v of allToday || []) {
    const id = v.registered_by
    if (!rankMap[id]) {
      rankMap[id] = {
        id,
        nombres: v.profiles?.nombres || '',
        apellido_paterno: v.profiles?.apellido_paterno || '',
        votos: 0,
      }
    }
    rankMap[id].votos++
  }

  const rankingArray = Object.values(rankMap).sort((a, b) => b.votos - a.votos).slice(0, 5)
  const miPosicion = rankingArray.findIndex(r => r.id === req.user.id) + 1

  res.json({
    hoy: totalHoy || 0,
    total_general: totalGeneral || 0,
    mi_posicion: miPosicion || 0,
    ultimos_votos: ultimosVotos || [],
    ranking: rankingArray,
  })
})

export default router
