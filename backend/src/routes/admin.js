import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
import { consultarDNI } from '../services/dni.js'
import { generalLimiter, adminExportLimiter } from '../middleware/rateLimit.js'
import { sanitizeError, isValidHttpsUrl } from '../utils/errors.js'

const router = Router()

router.use(generalLimiter, requireAuth, requireAdmin)

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
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page) || 20))
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const { count: total } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, dni, nombres, apellido_paterno, apellido_materno, telefono, role, is_active, created_at')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return res.status(400).json({ error: sanitizeError(error) })

  const { data: votesData } = await supabaseAdmin
    .from('votes')
    .select('registered_by')

  const voteCounts = {}
  for (const v of votesData || []) {
    voteCounts[v.registered_by] = (voteCounts[v.registered_by] || 0) + 1
  }

  const result = data.map(p => ({
    ...p,
    total_votos_registrados: voteCounts[p.id] || 0,
  }))

  res.json({ data: result, total, page, per_page: perPage })
})

router.post('/encuestadores', async (req, res) => {
  try {
    const { email, password, dni, telefono, direccion } = req.body
    let { nombres, apellido_paterno, apellido_materno } = req.body
    const s = v => (v || '').trim()
    const n = v => s(v).replace(/\s+/g, ' ')
    const isValidName = v => {
      const t = n(v)
      return /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+(?:[-\s][a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+)*$/.test(t) && t.length >= 2 && t.length <= 100
    }

    if (!email || !password || !dni) {
      return res.status(400).json({ error: 'Email, password y DNI requeridos' })
    }

    let datosDNI
    try {
      datosDNI = await consultarDNI(dni)
    } catch {
      if (!s(nombres) || !s(apellido_paterno) || !s(apellido_materno) || !isValidName(nombres) || !isValidName(apellido_paterno) || !isValidName(apellido_materno)) {
        const t = [nombres, apellido_paterno, apellido_materno].find(v => !isValidName(v))
        const err = t?.length < 2 ? 'mínimo 2 caracteres' : t?.length > 100 ? 'máximo 100 caracteres' : 'solo letras, espacios y guiones'
        return res.status(400).json({
          error: `DNI no encontrado. Proporciona nombres/apellidos válidos: ${err}`
        })
      }
      datosDNI = { nombres: n(nombres), apellido_paterno: n(apellido_paterno), apellido_materno: n(apellido_materno) }
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) return res.status(400).json({ error: sanitizeError(authError) })

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      dni,
      nombres: n(datosDNI.nombres),
      apellido_paterno: n(datosDNI.apellido_paterno),
      apellido_materno: n(datosDNI.apellido_materno),
      telefono,
      role: 'encuestador',
    })

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return res.status(400).json({ error: sanitizeError(profileError) })
    }

    res.status(201).json({ message: 'Encuestador creado exitosamente' })
  } catch (err) {
    res.status(400).json({ error: sanitizeError(err) })
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

  if (error) return res.status(400).json({ error: sanitizeError(error) })

  await supabaseAdmin.from('audit_log').insert({
    user_id: req.user.id, action: 'toggle_encuestador_active',
    details: { target_id: req.params.id, new_status: !profile.is_active },
  })

  res.json({ is_active: !profile.is_active })
})

// Datos para mapa GPS
router.get('/map-data', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const perPage = Math.min(500, Math.max(1, parseInt(req.query.per_page) || 200))
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const { count: total } = await supabaseAdmin
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .not('location_lat', 'is', null)

  const { data, error } = await supabaseAdmin
    .from('votes')
    .select(`
      id, location_lat, location_lng, location_address, created_at,
      candidate:candidates(id, nombre, color_hex, partido),
      registered_by_profile:profiles!votes_registered_by_fkey(nombres, apellido_paterno)
    `)
    .not('location_lat', 'is', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return res.status(400).json({ error: sanitizeError(error) })
  res.json({ data, total, page, per_page: perPage })
})

// Votos con paginación y búsqueda
router.get('/votes', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page) || 20))
  const search = (req.query.search || '').trim()
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let query = supabaseAdmin
    .from('votes')
    .select(`
      id, verification_code, created_at, location_lat, location_lng, location_address,
      voter:voters!inner(dni, nombres, apellido_paterno, apellido_materno, direccion, telefono),
      candidate:candidates(id, nombre, partido, color_hex, foto_url),
      registered_by_profile:profiles!votes_registered_by_fkey(nombres, apellido_paterno)
    `, { count: 'exact' })

  if (search) {
    const isDni = /^\d{1,8}$/.test(search)
    if (isDni) {
      query = query.eq('voters.dni', search)
    } else {
      query = query.or(`voters.nombres.ilike.%${search}%,voters.apellido_paterno.ilike.%${search}%`)
    }
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return res.status(400).json({ error: sanitizeError(error) })
  res.json({ data, total: count, page, per_page: perPage })
})

// --- Exportar datos ---
const csvSafe = (s) => {
  if (!s) return ''
  const str = String(s)
  if (['=', '+', '-', '@', '\t', '\r'].includes(str[0])) return `'${str}`
  if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`
  return str
}

function buildVoterName(v) {
  return [v?.nombres, v?.apellido_paterno, v?.apellido_materno].filter(Boolean).join(' ').trim()
}
function buildProfileName(p) {
  return [p?.nombres, p?.apellido_paterno].filter(Boolean).join(' ').trim()
}
function buildLocationStr(v) {
  const parts = []
  if (v?.location_address) parts.push(v.location_address)
  if (v?.location_lat != null && v?.location_lng != null) {
    parts.push(`https://www.google.com/maps?q=${v.location_lat},${v.location_lng}`)
  }
  return parts.join(' | ')
}
function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

async function generateExcelWorkbook(data) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'DATAM Cajamarca'
  wb.created = new Date()

  // --- Estilos reutilizables ---
  const headerStyle = {
    font: { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a365d' } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { argb: 'FFcbd5e1' } },
      bottom: { style: 'thin', color: { argb: 'FFcbd5e1' } },
      left: { style: 'thin', color: { argb: 'FFcbd5e1' } },
      right: { style: 'thin', color: { argb: 'FFcbd5e1' } },
    },
  }
  const cellStyle = {
    font: { name: 'Calibri', size: 10 },
    alignment: { vertical: 'middle', wrapText: false },
    border: {
      top: { style: 'thin', color: { argb: 'FFe2e8f0' } },
      bottom: { style: 'thin', color: { argb: 'FFe2e8f0' } },
      left: { style: 'thin', color: { argb: 'FFe2e8f0' } },
      right: { style: 'thin', color: { argb: 'FFe2e8f0' } },
    },
  }
  const zebraFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf8fafc' } }

  // ========== HOJA 1: Votos ==========
  const ws1 = wb.addWorksheet('Votos', {
    pageSetup: { orientation: 'landscape', fitToPage: true, margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 } },
  })
  ws1.views = [{ state: 'frozen', ySplit: 1 }]

  const cols1 = [
    { header: '#', key: 'num', width: 6 },
    { header: 'DNI', key: 'dni', width: 12 },
    { header: 'Votante', key: 'votante', width: 30 },
    { header: 'Dirección', key: 'direccion', width: 28 },
    { header: 'Teléfono', key: 'telefono', width: 14 },
    { header: 'Candidato', key: 'candidato', width: 24 },
    { header: 'Partido', key: 'partido', width: 22 },
    { header: 'Encuestador', key: 'encuestador', width: 24 },
    { header: 'Código Verificación', key: 'codigo', width: 18 },
    { header: 'Fecha Registro', key: 'fecha', width: 22 },
    { header: 'Ubicación', key: 'ubicacion', width: 40 },
  ]
  ws1.columns = cols1

  const headerRow1 = ws1.getRow(1)
  headerRow1.height = 32
  cols1.forEach((_, i) => {
    const cell = headerRow1.getCell(i + 1)
    Object.assign(cell, headerStyle)
  })

  data.forEach((v, i) => {
    const row = ws1.getRow(i + 2)
    row.height = 20
    const vals = {
      num: i + 1,
      dni: v.voter?.dni ?? '',
      votante: buildVoterName(v.voter),
      direccion: v.voter?.direccion ?? '',
      telefono: v.voter?.telefono ?? '',
      candidato: v.candidate?.nombre ?? '',
      partido: v.candidate?.partido ?? '',
      encuestador: buildProfileName(v.registered_by_profile),
      codigo: v.verification_code ?? '',
      fecha: formatDate(v.created_at),
      ubicacion: buildLocationStr(v),
    }
    cols1.forEach((col, j) => {
      const cell = row.getCell(j + 1)
      cell.value = vals[col.key]
      Object.assign(cell, cellStyle)
      if (col.key === 'num') cell.alignment = { vertical: 'middle', horizontal: 'center' }
      if (col.key === 'dni') cell.font = { name: 'Consolas', size: 10 }
      if (col.key === 'codigo') cell.font = { name: 'Consolas', size: 10, bold: true }
      if (i % 2 === 1) cell.fill = zebraFill
    })
  })

  ws1.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: data.length + 1, column: cols1.length },
  }

  // ========== HOJA 2: Resumen por Candidato ==========
  const ws2 = wb.addWorksheet('Resumen por Candidato', {
    pageSetup: { orientation: 'portrait', fitToPage: true },
  })
  ws2.views = [{ state: 'frozen', ySplit: 1 }]

  const candidateCounts = {}
  data.forEach(v => {
    const name = v.candidate?.nombre || 'Sin candidato'
    const party = v.candidate?.partido || ''
    if (!candidateCounts[name]) candidateCounts[name] = { nombre: name, partido: party, votos: 0 }
    candidateCounts[name].votos++
  })
  const candidateSummary = Object.values(candidateCounts).sort((a, b) => b.votos - a.votos)
  const totalVotos = data.length

  const cols2 = [
    { header: 'Candidato', key: 'nombre', width: 30 },
    { header: 'Partido', key: 'partido', width: 28 },
    { header: 'Votos', key: 'votos', width: 12 },
    { header: '% del Total', key: 'pct', width: 14 },
  ]
  ws2.columns = cols2

  const headerRow2 = ws2.getRow(1)
  headerRow2.height = 28
  cols2.forEach((_, i) => {
    const cell = headerRow2.getCell(i + 1)
    Object.assign(cell, headerStyle)
  })

  candidateSummary.forEach((c, i) => {
    const row = ws2.getRow(i + 2)
    row.height = 20
    const vals = [c.nombre, c.partido, c.votos, totalVotos > 0 ? `${((c.votos / totalVotos) * 100).toFixed(1)}%` : '0%']
    vals.forEach((val, j) => {
      const cell = row.getCell(j + 1)
      cell.value = val
      Object.assign(cell, cellStyle)
      if (j >= 2) cell.alignment = { vertical: 'middle', horizontal: 'center' }
      if (i % 2 === 1) cell.fill = zebraFill
    })
  })

  ws2.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: candidateSummary.length + 1, column: cols2.length },
  }

  // Total row
  const totalRow = ws2.getRow(candidateSummary.length + 2)
  totalRow.getCell(1).value = 'TOTAL'
  totalRow.getCell(1).font = { bold: true, size: 10 }
  totalRow.getCell(3).value = totalVotos
  totalRow.getCell(3).font = { bold: true, size: 10 }
  totalRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' }
  totalRow.getCell(4).value = '100%'
  totalRow.getCell(4).font = { bold: true, size: 10 }
  totalRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' }

  // ========== HOJA 3: Resumen por Encuestador ==========
  const ws3 = wb.addWorksheet('Resumen por Encuestador', {
    pageSetup: { orientation: 'portrait', fitToPage: true },
  })
  ws3.views = [{ state: 'frozen', ySplit: 1 }]

  const encuestadorCounts = {}
  data.forEach(v => {
    const name = buildProfileName(v.registered_by_profile) || 'Sin encuestador'
    if (!encuestadorCounts[name]) encuestadorCounts[name] = { nombre: name, votos: 0 }
    encuestadorCounts[name].votos++
  })
  const encuestadorSummary = Object.values(encuestadorCounts).sort((a, b) => b.votos - a.votos)

  const cols3 = [
    { header: 'Encuestador', key: 'nombre', width: 32 },
    { header: 'Votos Registrados', key: 'votos', width: 20 },
    { header: '% del Total', key: 'pct', width: 14 },
  ]
  ws3.columns = cols3

  const headerRow3 = ws3.getRow(1)
  headerRow3.height = 28
  cols3.forEach((_, i) => {
    const cell = headerRow3.getCell(i + 1)
    Object.assign(cell, headerStyle)
  })

  encuestadorSummary.forEach((e, i) => {
    const row = ws3.getRow(i + 2)
    row.height = 20
    const vals = [e.nombre, e.votos, totalVotos > 0 ? `${((e.votos / totalVotos) * 100).toFixed(1)}%` : '0%']
    vals.forEach((val, j) => {
      const cell = row.getCell(j + 1)
      cell.value = val
      Object.assign(cell, cellStyle)
      if (j >= 1) cell.alignment = { vertical: 'middle', horizontal: 'center' }
      if (i % 2 === 1) cell.fill = zebraFill
    })
  })

  ws3.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: encuestadorSummary.length + 1, column: cols3.length },
  }

  // Total row
  const totalRow3 = ws3.getRow(encuestadorSummary.length + 2)
  totalRow3.getCell(1).value = 'TOTAL'
  totalRow3.getCell(1).font = { bold: true, size: 10 }
  totalRow3.getCell(2).value = totalVotos
  totalRow3.getCell(2).font = { bold: true, size: 10 }
  totalRow3.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' }
  totalRow3.getCell(3).value = '100%'
  totalRow3.getCell(3).font = { bold: true, size: 10 }
  totalRow3.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' }

  return wb
}

router.get('/export', adminExportLimiter, async (req, res) => {
  const format = req.query.format || 'xlsx'

  const { data, error } = await supabaseAdmin
    .from('votes')
    .select(`
      verification_code, created_at, location_lat, location_lng, location_address,
      voter:voters(dni, nombres, apellido_paterno, apellido_materno, direccion, telefono),
      candidate:candidates(nombre, partido),
      registered_by_profile:profiles!votes_registered_by_fkey(nombres, apellido_paterno)
    `)
    .order('created_at', { ascending: false })

  if (error) return res.status(400).json({ error: sanitizeError(error) })

  if (format === 'csv') {
    const csv = [
      'N°,DNI,Votante,Direccion,Telefono,Candidato,Partido,Encuestador,Codigo Verificacion,Fecha Registro,Ubicacion',
      ...data.map((v, i) => [
        i + 1,
        csvSafe(v.voter?.dni),
        csvSafe(buildVoterName(v.voter)),
        csvSafe(v.voter?.direccion),
        csvSafe(v.voter?.telefono),
        csvSafe(v.candidate?.nombre),
        csvSafe(v.candidate?.partido),
        csvSafe(buildProfileName(v.registered_by_profile)),
        csvSafe(v.verification_code),
        csvSafe(formatDate(v.created_at)),
        csvSafe(buildLocationStr(v)),
      ].join(',')),
    ].join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename=votos_${new Date().toISOString().slice(0, 10)}.csv`)
    return res.send(csv)
  }

  // XLSX por defecto
  const wb = await generateExcelWorkbook(data)
  const buffer = await wb.xlsx.writeBuffer()
  const dateStr = new Date().toISOString().slice(0, 10)

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename=votos_${dateStr}.xlsx`)
  res.send(Buffer.from(buffer))
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

// Configuración del sistema
router.get('/config', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('system_config')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) return res.status(400).json({ error: sanitizeError(error) })
  res.json(data)
})

router.put('/config', async (req, res) => {
  const { system_name, tagline, logo_url, primary_color, secondary_color } = req.body

  if (logo_url && !isValidHttpsUrl(logo_url)) {
    return res.status(400).json({ error: 'logo_url debe ser una URL HTTPS válida' })
  }

  const { data, error } = await supabaseAdmin
    .from('system_config')
    .update({
      system_name: system_name?.trim() || undefined,
      tagline: tagline?.trim() || undefined,
      logo_url: logo_url || undefined,
      primary_color: primary_color || undefined,
      secondary_color: secondary_color || undefined,
      updated_by: req.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select('*')
    .single()

  if (error) return res.status(400).json({ error: sanitizeError(error) })

  await supabaseAdmin.from('audit_log').insert({
    user_id: req.user.id, action: 'update_config',
    details: { system_name, tagline },
  })

  res.json(data)
})

export default router
