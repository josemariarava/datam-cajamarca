import { useEffect, useState, useRef } from 'react'
import { Button, Card, CardHeader, Text, Title1, Title2, Input, Textarea, Spinner, Badge, Tab, TabList, Field, Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent, Radio, RadioGroup, makeStyles, tokens } from '@fluentui/react-components'
import { candidatesApi, adminApi, configApi } from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useCandidates, useAdminStats, useEncuestadores, useMapData, useVotes } from '../hooks/useQueries'
import { useQueryClient } from '@tanstack/react-query'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

function MarkerClusterGroup({ markers }: { markers: MapVote[] }) {
  const map = useMap()
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)

  useEffect(() => {
    if (clusterRef.current) map.removeLayer(clusterRef.current)

    const mcg = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 50 })
    clusterRef.current = mcg

    markers.forEach(v => {
      if (!v.location_lat || !v.location_lng) return
      const color = v.candidate?.color_hex || '#3B82F6'
      const icon = L.divIcon({
        html: `<div style="width:20px;height:20px;background:${color};border:3px solid #fff;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.3)"></div>`,
        iconSize: [20, 20],
        className: '',
      })
      const marker = L.marker([v.location_lat, v.location_lng], { icon })
      marker.bindPopup(`
        <b>${v.candidate?.nombre || ''}</b><br/>
        ${v.candidate?.partido || ''}<br/>
        <small>${v.registered_by_profile?.nombres || ''} ${v.registered_by_profile?.apellido_paterno || ''}</small><br/>
        <small>${new Date(v.created_at).toLocaleString('es-PE')}</small>
      `)
      mcg.addLayer(marker)
    })

    map.addLayer(mcg)
    return () => { map.removeLayer(mcg) }
  }, [markers, map])

  return null
}

const useStyles = makeStyles({
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
})

// --- Interfaces ---
interface Candidate {
  id: string
  numero_lista: number | null
  nombre: string
  partido: string
  lema: string
  color_hex: string
  foto_url: string
  logo_partido_url: string
  edad: number | null
  profesion: string
  cargo_actual: string
  ubicacion: string
  biografia: string
  propuestas: string[]
  logros_destacados: string[]
  activo: boolean
  orden_prioridad: number
}
interface Encuestador {
  id: string; dni: string; nombres: string; apellido_paterno: string
  apellido_materno: string; role: string; is_active: boolean
  total_votos_registrados: number; created_at: string
}
interface Stats {
  total_encuestadores: number; total_votantes: number
  total_votos: number; total_candidatos: number; participacion_pct: string
}
interface VoteRow {
  id: string
  verification_code: string
  created_at: string
  location_lat: number | null
  location_lng: number | null
  location_address: string | null
  voter: {
    dni: string; nombres: string; apellido_paterno: string; apellido_materno: string
    direccion: string | null; telefono: string | null
  }
  candidate: {
    id: string; nombre: string; partido: string; color_hex: string; foto_url: string
  }
  registered_by_profile: {
    nombres: string; apellido_paterno: string
  }
}
interface MapVote {
  id: string; location_lat: number; location_lng: number
  location_address: string; created_at: string
  candidate: { id: string; nombre: string; color_hex: string; partido: string }
  registered_by_profile: { nombres: string; apellido_paterno: string }
}

export default function AdminDashboard() {
  const styles = useStyles()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<string>('resumen')
  const { data: stats } = useAdminStats()
  const { data: candidates = [], isLoading: candidatesLoading } = useCandidates()
  const { data: encuestadoresPage } = useEncuestadores(tab === 'encuestadores' ? 1 : undefined)
  const { data: mapPage } = useMapData(tab === 'mapa' ? 1 : undefined)
  const [mapData, setMapData] = useState<MapVote[]>([])

  // Candidate form
  const [editCandidate, setEditCandidate] = useState<Candidate | null>(null)
  const [showCandidateForm, setShowCandidateForm] = useState(false)
  const emptyCandidateForm = {
    numero_lista: '', nombre: '', partido: '', lema: '', color_hex: '#3B82F6',
    foto_url: '', logo_partido_url: '', edad: '', profesion: '', cargo_actual: '',
    ubicacion: '', biografia: '', propuestas: '', logros_destacados: '',
    activo: true, orden_prioridad: '',
  }
  const [cForm, setCForm] = useState(emptyCandidateForm)

  // Encuestador creation
  const [showNewEncuestador, setShowNewEncuestador] = useState(false)
  const [newEncForm, setNewEncForm] = useState({ email: '', password: '', dni: '', nombres: '', apellido_paterno: '' })

  const encuestadores = encuestadoresPage?.data ?? []

  useEffect(() => {
    if (tab === 'mapa') {
      import('leaflet/dist/leaflet.css')
    }
  }, [tab])

  useEffect(() => {
    if (mapPage) setMapData(mapPage.data)
  }, [mapPage])

  const handleCandidateSave = async () => {
    const body: any = { ...cForm }
    body.propuestas = cForm.propuestas ? cForm.propuestas.split(',').map((s: string) => s.trim()).filter(Boolean) : []
    body.logros_destacados = cForm.logros_destacados ? cForm.logros_destacados.split(',').map((s: string) => s.trim()).filter(Boolean) : []
    body.numero_lista = cForm.numero_lista ? parseInt(cForm.numero_lista) : null
    body.edad = cForm.edad ? parseInt(cForm.edad) : null
    body.orden_prioridad = cForm.orden_prioridad ? parseInt(cForm.orden_prioridad) : 0

    try {
      if (editCandidate) {
        await candidatesApi.update(editCandidate.id, body)
      } else {
        await candidatesApi.create(body)
      }
      resetForm()
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      showToast(editCandidate ? 'Candidato actualizado' : 'Candidato creado', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await candidatesApi.delete(id)
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      showToast('Candidato eliminado', 'success')
    } catch {
      showToast('Error al eliminar candidato', 'error')
    }
  }

  const resetForm = () => {
    setEditCandidate(null)
    setShowCandidateForm(false)
    setCForm(emptyCandidateForm)
  }

  const openEdit = (c: Candidate) => {
    setEditCandidate(c)
    setCForm({
      ...c,
      propuestas: (c.propuestas || []).join(', '),
      logros_destacados: (c.logros_destacados || []).join(', '),
      edad: c.edad?.toString() || '',
      numero_lista: c.numero_lista?.toString() || '',
      orden_prioridad: c.orden_prioridad?.toString() || '',
    })
    setShowCandidateForm(true)
  }

  const handleToggleEncuestador = async (id: string) => {
    try {
      await adminApi.toggleEncuestadorActive(id)
      queryClient.invalidateQueries({ queryKey: ['admin', 'encuestadores'] })
      showToast('Estado del encuestador actualizado', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  const handleCreateEncuestador = async () => {
    try {
      await adminApi.createEncuestador(newEncForm)
      setShowNewEncuestador(false)
      setNewEncForm({ email: '', password: '', dni: '', nombres: '', apellido_paterno: '' })
      queryClient.invalidateQueries({ queryKey: ['admin', 'encuestadores'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      showToast('Encuestador creado', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  if (candidatesLoading && !stats) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner /></div>

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 pb-24 md:pb-6">
      <Title1>Panel de Administración</Title1>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-1.5 md:gap-3 my-4 md:my-6">
          <Card size="small" className="!p-2 md:!p-3">
            <CardHeader header={<Text weight="bold" size={400}>{stats.total_encuestadores}</Text>} className="!p-0" />
            <Text size={100}>Encuestadores</Text>
          </Card>
          <Card size="small" className="!p-2 md:!p-3">
            <CardHeader header={<Text weight="bold" size={400}>{stats.total_votantes}</Text>} className="!p-0" />
            <Text size={100}>Votantes</Text>
          </Card>
          <Card size="small" className="!p-2 md:!p-3">
            <CardHeader header={<Text weight="bold" size={400}>{stats.total_votos}</Text>} className="!p-0" />
            <Text size={100}>Votos</Text>
          </Card>
          <Card size="small" className="!p-2 md:!p-3">
            <CardHeader header={<Text weight="bold" size={400}>{stats.total_candidatos}</Text>} className="!p-0" />
            <Text size={100}>Candidatos</Text>
          </Card>
          <Card size="small" className="!p-2 md:!p-3">
            <CardHeader header={<Text weight="bold" size={400}>{stats.participacion_pct}%</Text>} className="!p-0" />
            <Text size={100}>Participación</Text>
          </Card>
        </div>
      )}

      {/* Tabs - sticky en mobile */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-lg -mx-4 md:-mx-6 px-4 md:px-6 pb-1 md:static md:bg-transparent md:backdrop-blur-none md:mx-0 md:px-0 md:pb-0 border-b md:border-b-0 border-gray-100">
        <div className="overflow-x-auto no-scrollbar -mb-px">
          <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as string)}>
            <Tab value="resumen">Resumen</Tab>
            <Tab value="candidatos">Candidatos</Tab>
            <Tab value="encuestadores">Encuestadores</Tab>
            <Tab value="votos">Votos</Tab>
            <Tab value="mapa">Mapa GPS</Tab>
            <Tab value="configuracion">Configuración</Tab>
          </TabList>
        </div>
      </div>

      {/* TAB: Resumen */}
      {tab === 'resumen' && (
        <div className="mt-6 space-y-4">
          <Card>
            <CardHeader
              header={<Title2>📊 Exportar datos</Title2>}
              description={<Text>Descarga todos los votos registrados en formato Excel o CSV</Text>}
            />
            <ExportCard />
          </Card>
          <Card className="mt-4">
            <CardHeader header={<Title2>Resetear votación</Title2>} />
            <Text className="text-red-500 block mb-2">Esto eliminará todos los votos registrados.</Text>
            <Button appearance="subtle" style={{ color: 'red' }} onClick={async () => {
              try {
                await adminApi.resetVotes()
                queryClient.invalidateQueries()
                showToast('Votación reseteada', 'success')
              } catch {
                showToast('Error al resetear votación', 'error')
              }
            }}>🗑️ Resetear votación</Button>
          </Card>
        </div>
      )}

      {/* TAB: Candidatos */}
      {tab === 'candidatos' && (
        <div className="mt-6">
          <Button appearance="primary" onClick={() => setShowCandidateForm(true)}>+ Nuevo candidato</Button>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {candidates.map(c => (
              <Card key={c.id}>
                <div className="flex items-start gap-3">
                  {c.foto_url && <img src={c.foto_url} alt="" loading="lazy" className="w-16 h-16 rounded-full object-cover" />}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color_hex }} />
                      <Text weight="semibold">{c.nombre}</Text>
                      {!c.activo && <Badge appearance="ghost">Inactivo</Badge>}
                    </div>
                    <Text size={200}>{c.partido} — Lista #{c.numero_lista}</Text>
                    <Text size={200} className="italic">"{c.lema}"</Text>
                    <div className="flex gap-2 mt-2">
                      <Button size="small" onClick={() => openEdit(c)}>Editar</Button>
                      <Button size="small" style={{ color: 'red' }} onClick={() => handleDelete(c.id)}>Eliminar</Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Dialog open={showCandidateForm} onOpenChange={(_, d) => { if (!d.open) resetForm() }}>
            <DialogSurface className="!max-w-2xl">
              <DialogBody>
                <DialogTitle>{editCandidate ? 'Editar candidato' : 'Nuevo candidato'}</DialogTitle>
                <DialogContent className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto">

                  <Text weight="semibold" className="text-gray-500 uppercase text-xs tracking-wider">Información básica</Text>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Nombre" required>
                      <Input value={cForm.nombre} onChange={(e, d) => setCForm({ ...cForm, nombre: d.value })} />
                    </Field>
                    <Field label="N° de lista">
                      <Input type="number" value={cForm.numero_lista} onChange={(e, d) => setCForm({ ...cForm, numero_lista: d.value })} />
                    </Field>
                    <Field label="Partido político">
                      <Input value={cForm.partido} onChange={(e, d) => setCForm({ ...cForm, partido: d.value })} />
                    </Field>
                    <Field label="Lema">
                      <Input value={cForm.lema} onChange={(e, d) => setCForm({ ...cForm, lema: d.value })} />
                    </Field>
                  </div>

                  <Text weight="semibold" className="text-gray-500 uppercase text-xs tracking-wider">Datos personales</Text>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Edad">
                      <Input type="number" value={cForm.edad} onChange={(e, d) => setCForm({ ...cForm, edad: d.value })} />
                    </Field>
                    <Field label="Profesión / Ocupación">
                      <Input value={cForm.profesion} onChange={(e, d) => setCForm({ ...cForm, profesion: d.value })} />
                    </Field>
                    <Field label="Cargo actual">
                      <Input value={cForm.cargo_actual} onChange={(e, d) => setCForm({ ...cForm, cargo_actual: d.value })} />
                    </Field>
                    <Field label="Ubicación / Distrito">
                      <Input value={cForm.ubicacion} onChange={(e, d) => setCForm({ ...cForm, ubicacion: d.value })} />
                    </Field>
                  </div>

                  <Text weight="semibold" className="text-gray-500 uppercase text-xs tracking-wider">Contenido visual</Text>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="URL foto del candidato">
                      <Input value={cForm.foto_url} onChange={(e, d) => setCForm({ ...cForm, foto_url: d.value })} />
                    </Field>
                    <Field label="URL logo del partido">
                      <Input value={cForm.logo_partido_url} onChange={(e, d) => setCForm({ ...cForm, logo_partido_url: d.value })} />
                    </Field>
                  </div>

                  <Text weight="semibold" className="text-gray-500 uppercase text-xs tracking-wider">Descripción</Text>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Biografía" className="col-span-3">
                      <Textarea value={cForm.biografia} onChange={(e, d) => setCForm({ ...cForm, biografia: d.value })} />
                    </Field>
                    <Field label="Propuestas" hint="Separadas por coma">
                      <Textarea value={cForm.propuestas} onChange={(e, d) => setCForm({ ...cForm, propuestas: d.value })} />
                    </Field>
                    <Field label="Logros destacados" hint="Separados por coma">
                      <Textarea value={cForm.logros_destacados} onChange={(e, d) => setCForm({ ...cForm, logros_destacados: d.value })} />
                    </Field>
                  </div>

                  <Text weight="semibold" className="text-gray-500 uppercase text-xs tracking-wider">Configuración</Text>
                  <div className="grid grid-cols-3 gap-2">
                      <Field label="Color representativo">
                      <div className="flex gap-2 items-center">
                        <input type="color" value={cForm.color_hex} onChange={(e) => setCForm({ ...cForm, color_hex: e.target.value })}
                          className="!w-12 !p-1 h-9 rounded border border-gray-200 cursor-pointer" />
                        <Input value={cForm.color_hex} onChange={(e, d) => setCForm({ ...cForm, color_hex: d.value })} />
                      </div>
                    </Field>
                    <Field label="Orden de prioridad">
                      <Input type="number" value={cForm.orden_prioridad} onChange={(e, d) => setCForm({ ...cForm, orden_prioridad: d.value })} />
                    </Field>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={cForm.activo} onChange={(e) => setCForm({ ...cForm, activo: e.target.checked })} className="w-4 h-4" />
                        <Text>Candidato activo</Text>
                      </label>
                    </div>
                  </div>

                </DialogContent>
                <DialogActions>
                  <DialogTrigger><Button appearance="subtle">Cancelar</Button></DialogTrigger>
                  <Button appearance="primary" onClick={handleCandidateSave} disabled={!cForm.nombre}>Guardar</Button>
                </DialogActions>
              </DialogBody>
            </DialogSurface>
          </Dialog>
        </div>
      )}

      {/* TAB: Encuestadores */}
      {tab === 'encuestadores' && (
        <div className="mt-6">
          <Button appearance="primary" onClick={() => setShowNewEncuestador(true)}>+ Nuevo encuestador</Button>

          <div className="overflow-x-auto mt-4">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">DNI</th>
                  <th className="p-2 text-left">Nombres</th>
                  <th className="p-2 text-left">Rol</th>
                  <th className="p-2 text-left">Estado</th>
                  <th className="p-2 text-left">Votos</th>
                  <th className="p-2 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {encuestadores.map((e) => (
                  <tr key={e.id} className="border-b">
                    <td className="p-2">{e.dni}</td>
                    <td className="p-2">{e.nombres} {e.apellido_paterno}</td>
                    <td className="p-2"><Badge appearance="tint">{e.role}</Badge></td>
                    <td className="p-2">{e.is_active ? '✅ Activo' : '❌ Inactivo'}</td>
                    <td className="p-2">{e.total_votos_registrados}</td>
                    <td className="p-2">
                      <Button size="small" appearance="subtle" onClick={() => handleToggleEncuestador(e.id)}>
                        {e.is_active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Dialog open={showNewEncuestador} onOpenChange={(_, d) => { if (!d.open) setShowNewEncuestador(false) }}>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Nuevo encuestador</DialogTitle>
                <DialogContent className="flex flex-col gap-3">
                  <Field label="Email" required>
                    <Input type="email" value={newEncForm.email}
                      onChange={(e, d) => setNewEncForm({ ...newEncForm, email: d.value })} />
                  </Field>
                  <Field label="Contraseña" required>
                    <Input type="password" value={newEncForm.password}
                      onChange={(e, d) => setNewEncForm({ ...newEncForm, password: d.value })} />
                  </Field>
                  <Field label="DNI" required>
                    <Input value={newEncForm.dni}
                      onChange={(e, d) => setNewEncForm({ ...newEncForm, dni: d.value.replace(/\D/g, '').slice(0, 8) })} />
                  </Field>
                  <Text size={200} className="text-gray-400">Si el DNI no se encuentra automáticamente, completa los datos manuales:</Text>
                  <Field label="Nombres">
                    <Input value={newEncForm.nombres}
                      onChange={(e, d) => setNewEncForm({ ...newEncForm, nombres: d.value })} />
                  </Field>
                  <Field label="Apellido paterno">
                    <Input value={newEncForm.apellido_paterno}
                      onChange={(e, d) => setNewEncForm({ ...newEncForm, apellido_paterno: d.value })} />
                  </Field>
                </DialogContent>
                <DialogActions>
                  <DialogTrigger><Button appearance="subtle">Cancelar</Button></DialogTrigger>
                  <Button appearance="primary" onClick={handleCreateEncuestador}
                    disabled={!newEncForm.email || !newEncForm.password || newEncForm.dni.length !== 8}>
                    Crear
                  </Button>
                </DialogActions>
              </DialogBody>
            </DialogSurface>
          </Dialog>
        </div>
      )}

      {/* TAB: Votos */}
      {tab === 'votos' && <VotosTab />}

      {/* TAB: Mapa GPS */}
      {tab === 'mapa' && (
        <div className="mt-6">
          <Card>
            <CardHeader header={<Title2>Mapa de votos</Title2>} />
            <Text block className="mb-4">{mapData.length} votos con ubicación registrada</Text>
            <div className="h-[500px] w-full rounded-lg overflow-hidden">
              <MapContainer center={[-7.1577, -78.5173]} zoom={12} className="h-full w-full" scrollWheelZoom={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MarkerClusterGroup markers={mapData} />
              </MapContainer>
            </div>
          </Card>
        </div>
      )}

      {/* TAB: Configuración */}
      {tab === 'configuracion' && (
        <ConfigTab />
      )}
    </div>
  )
}

function ExportCard() {
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx')
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const blob = await adminApi.exportData(format)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ext = format === 'xlsx' ? 'xlsx' : 'csv'
      const dateStr = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `votos_${dateStr}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert(`Error al exportar ${format === 'xlsx' ? 'Excel' : 'CSV'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-2">
      <Field label="Formato de exportación">
        <RadioGroup value={format} onChange={(_, v) => setFormat(v as 'xlsx' | 'csv')}>
          <Radio value="xlsx" label="Excel (.xlsx) — Recomendado" />
          <Radio value="csv" label="CSV (.csv) — Para procesamiento de datos" />
        </RadioGroup>
      </Field>

      <div className="mt-4">
        <Button appearance="primary" size="large" onClick={handleExport} disabled={loading}>
          {loading ? <Spinner size="tiny" /> : <span>📥 Exportar {format === 'xlsx' ? 'Excel' : 'CSV'}</span>}
        </Button>
      </div>

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        <Text block weight="semibold" className="mb-1">ℹ️ El archivo incluirá:</Text>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700">
          <li><strong>Votos:</strong> detalle completo de cada voto registrado</li>
          <li><strong>Resumen por candidato:</strong> votos y porcentaje por candidato</li>
          <li><strong>Resumen por encuestador:</strong> votos registrados por cada encuestador</li>
        </ul>
      </div>

      <Text block className="mt-3 text-xs text-gray-400">
        Límite: 3 exportaciones por hora
      </Text>
    </div>
  )
}

function ConfigTab() {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    system_name: '', tagline: '', logo_url: '',
    primary_color: '#2563eb', secondary_color: '#7c3aed',
  })

  useEffect(() => {
    setLoading(true)
    adminApi.getConfig()
      .then((data) => setForm({
        system_name: data.system_name || '',
        tagline: data.tagline || '',
        logo_url: data.logo_url || '',
        primary_color: data.primary_color || '#2563eb',
        secondary_color: data.secondary_color || '#7c3aed',
      }))
      .catch(() => showToast('Error al cargar configuración', 'error'))
      .finally(() => setLoading(false))
  }, [showToast])

  const handleSave = async () => {
    setSaving(true)
    try {
      await adminApi.updateConfig({
        system_name: form.system_name.trim(),
        tagline: form.tagline.trim(),
        logo_url: form.logo_url || null,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
      })
      queryClient.invalidateQueries({ queryKey: ['config'] })
      showToast('Configuración guardada', 'success')
    } catch {
      showToast('Error al guardar configuración', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mt-6 flex items-center justify-center py-20">
        <Spinner size="large" label="Cargando configuración..." />
      </div>
    )
  }

  return (
    <div className="mt-6">
      <Card>
        <CardHeader header={<Title2>Configuración del Sistema</Title2>}
          description={<Text>Personaliza el nombre, eslogan, logo y colores de la aplicación</Text>}
        />
        <div className="space-y-5 p-2">
          <Field label="Nombre del sistema" required>
            <Input
              value={form.system_name}
              onChange={(e) => setForm({ ...form, system_name: e.target.value })}
              placeholder="Ej: Datam Cajamarca"
            />
          </Field>

          <Field label="Eslogan" required>
            <Input
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              placeholder="Ej: Tu voto importa"
            />
          </Field>

          <Field label="Logo URL">
            <Input
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder="URL del logo (opcional)"
            />
            {form.logo_url && (
              <div className="mt-2">
                <img src={form.logo_url} alt="" className="h-12 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              </div>
            )}
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Color primario">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border border-gray-200"
                />
                <Input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} />
              </div>
            </Field>
            <Field label="Color secundario">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.secondary_color}
                  onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border border-gray-200"
                />
                <Input value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} />
              </div>
            </Field>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <Button appearance="primary" size="large" onClick={handleSave} disabled={saving || !form.system_name.trim() || !form.tagline.trim()}>
              {saving ? <Spinner size="tiny" /> : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

function VotosTab() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedVote, setSelectedVote] = useState<VoteRow | null>(null)
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: votesPage, isLoading } = useVotes(page, debouncedSearch)
  const votes = votesPage?.data ?? []
  const total = votesPage?.total ?? 0
  const perPage = votesPage?.per_page ?? 20
  const totalPages = total > 0 ? Math.ceil(total / perPage) : 0

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    showToast('Código de verificación copiado', 'success')
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-4 mb-4">
        <Input
          placeholder="🔍 Buscar por DNI o nombre..."
          value={search}
          onChange={(e, d) => setSearch(d.value)}
          className="max-w-sm"
        />
        <Text block className="text-gray-500">{total} votos encontrados</Text>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="large" /></div>
      ) : votes.length === 0 ? (
        <Card className="p-8 text-center">
          <Text block>No se encontraron votos{debouncedSearch ? ' con ese criterio de búsqueda' : ''}.</Text>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase w-12">#</th>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">Votante</th>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">DNI</th>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">Candidato</th>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">Encuestador</th>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {votes.map((v, i) => (
                  <tr key={v.id}
                    className="border-b hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedVote(v)}>
                    <td className="p-3 text-gray-400 text-sm">{(page - 1) * perPage + i + 1}</td>
                    <td className="p-3 font-medium">{v.voter.nombres} {v.voter.apellido_paterno} {v.voter.apellido_materno}</td>
                    <td className="p-3 font-mono text-sm">{v.voter.dni}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: v.candidate.color_hex }} />
                        <span>{v.candidate.nombre}</span>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-gray-600">{v.registered_by_profile?.nombres} {v.registered_by_profile?.apellido_paterno}</td>
                    <td className="p-3 text-sm text-gray-500">{new Date(v.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button appearance="subtle" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                ← Anterior
              </Button>
              <Text block className="text-gray-500">Página {page} de {totalPages}</Text>
              <Button appearance="subtle" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Siguiente →
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={!!selectedVote} onOpenChange={(_, d) => { if (!d.open) setSelectedVote(null) }}>
        <DialogSurface className="!max-w-lg">
          <DialogBody>
            <DialogTitle>Detalle del Voto</DialogTitle>
            <DialogContent className="flex flex-col gap-3">
              {selectedVote && <VoteDetail vote={selectedVote} onCopyCode={copyCode} />}
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="primary">Cerrar</Button>
              </DialogTrigger>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  )
}

function VoteDetail({ vote, onCopyCode }: { vote: VoteRow; onCopyCode: (code: string) => void }) {
  return (
    <>
      <div className="bg-gray-50 rounded-lg p-4 space-y-1">
        <Text weight="semibold" className="text-gray-500 uppercase text-xs tracking-wider block mb-2">👤 VOTANTE</Text>
        <Text weight="semibold" size={500} block>{vote.voter.nombres} {vote.voter.apellido_paterno} {vote.voter.apellido_materno}</Text>
        <Text block>DNI: <span className="font-mono">{vote.voter.dni}</span></Text>
        {vote.voter.direccion && <Text block>📍 {vote.voter.direccion}</Text>}
        {vote.voter.telefono && <Text block>📞 {vote.voter.telefono}</Text>}
      </div>

      <div className="bg-gray-50 rounded-lg p-4 space-y-1">
        <Text weight="semibold" className="text-gray-500 uppercase text-xs tracking-wider block mb-2">🗳️ CANDIDATO</Text>
        <div className="flex items-center gap-3">
          {vote.candidate.foto_url && (
            <img
              src={vote.candidate.foto_url}
              alt=""
              className="w-12 h-12 rounded-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div>
            <Text weight="semibold" size={400} block>{vote.candidate.nombre}</Text>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: vote.candidate.color_hex }} />
              <Text>{vote.candidate.partido}</Text>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <Text weight="semibold" className="text-gray-500 uppercase text-xs tracking-wider block mb-2">📋 REGISTRADO POR</Text>
        <Text block>{vote.registered_by_profile?.nombres} {vote.registered_by_profile?.apellido_paterno} <span className="text-gray-400">(Encuestador)</span></Text>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 space-y-1">
        <Text weight="semibold" className="text-gray-500 uppercase text-xs tracking-wider block mb-2">🔑 CÓDIGO DE VERIFICACIÓN</Text>
        <div className="flex items-center gap-2">
          <Text weight="bold" size={500} block className="font-mono tracking-widest">{vote.verification_code}</Text>
          <Button size="small" appearance="subtle" onClick={() => onCopyCode(vote.verification_code)}>📋 Copiar</Button>
        </div>
        <Text block className="mt-2">📅 {new Date(vote.created_at).toLocaleString('es-PE')}</Text>
        {vote.location_lat != null && vote.location_lng != null && (
          <Text block>
            📌 {vote.location_lat.toFixed(4)}, {vote.location_lng.toFixed(4)}
            {' '}
            <a href={`https://www.google.com/maps?q=${vote.location_lat},${vote.location_lng}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">
              Ver en Google Maps →
            </a>
          </Text>
        )}
        {vote.location_address && <Text block>📍 {vote.location_address}</Text>}
      </div>
    </>
  )
}
