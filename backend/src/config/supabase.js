import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
export const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
