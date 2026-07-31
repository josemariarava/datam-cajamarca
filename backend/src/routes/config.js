import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { generalLimiter } from '../middleware/rateLimit.js'
import { sanitizeError } from '../utils/errors.js'

const router = Router()
router.use(generalLimiter)

router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('system_config')
    .select('system_name, tagline, logo_url, primary_color, secondary_color')
    .eq('id', 1)
    .single()

  if (error) return res.status(400).json({ error: sanitizeError(error) })

  res.json(data)
})

export default router
