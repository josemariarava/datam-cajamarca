import { useEffect, useState, useRef } from 'react'
import { Button, Card, CardHeader, Text, Title1, Title2, Input, Textarea, Spinner, Badge, Tab, TabList, Field, Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent, makeStyles, tokens } from '@fluentui/react-components'
import { candidatesApi, adminApi } from '../services/api'
import { useToast } from '../contexts/ToastContext'
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
interface MapVote {
  id: string; location_lat: number; location_lng: number
  location_address: string; created_at: string
  candidate: { id: string; nombre: string; color_hex: string; partido: string }
  registered_by_profile: { nombres: string; apellido_paterno: string }
}

export default function AdminDashboard() {
  const styles = useStyles()
  const { showToast } = useToast()
  const [tab, setTab] = useState<string>('resumen')
  const [stats, setStats] = useState<Stats | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [encuestadores, setEncuestadores] = useState<Encuestador[]>([])
  const [mapData, setMapData] = useState<MapVote[]>([])
  const [loading, setLoading] = useState(true)

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

  const loadData = async () => {
    try {
      const [st, cands] = await Promise.all([
        adminApi.getStats(),
        candidatesApi.getAll(),
      ])
      setStats(st)
      setCandidates(cands)
    } catch {} finally {
      setLoading(false)
    }
  }

  const loadEncuestadores = async () => {
    try { setEncuestadores(await adminApi.getEncuestadores()) } catch {}
  }

  const loadMapData = async () => {
    await import('leaflet/dist/leaflet.css')
    try { setMapData(await adminApi.getMapData()) } catch {}
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (tab === 'encuestadores') loadEncuestadores() }, [tab])
  useEffect(() => { if (tab === 'mapa') loadMapData() }, [tab])

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
      loadData()
      showToast(editCandidate ? 'Candidato actualizado' : 'Candidato creado', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await candidatesApi.delete(id)
      loadData()
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
      loadEncuestadores()
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
      loadEncuestadores()
      loadData()
      showToast('Encuestador creado', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner /></div>

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Title1>Panel de Administración</Title1>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 my-6">
          <Card><CardHeader header={<Title2>{stats.total_encuestadores}</Title2>} /><Text size={200}>Encuestadores</Text></Card>
          <Card><CardHeader header={<Title2>{stats.total_votantes}</Title2>} /><Text size={200}>Votantes</Text></Card>
          <Card><CardHeader header={<Title2>{stats.total_votos}</Title2>} /><Text size={200}>Votos</Text></Card>
          <Card><CardHeader header={<Title2>{stats.total_candidatos}</Title2>} /><Text size={200}>Candidatos</Text></Card>
          <Card><CardHeader header={<Title2>{stats.participacion_pct}%</Title2>} /><Text size={200}>Participación</Text></Card>
        </div>
      )}

      {/* Tabs */}
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as string)}>
        <Tab value="resumen">Resumen</Tab>
        <Tab value="candidatos">Candidatos</Tab>
        <Tab value="encuestadores">Encuestadores</Tab>
        <Tab value="mapa">Mapa GPS</Tab>
      </TabList>

      {/* TAB: Resumen */}
      {tab === 'resumen' && (
        <div className="mt-6">
          <Card>
            <CardHeader header={<Title2>Exportar datos</Title2>} />
            <Button appearance="primary" onClick={async () => {
              try {
                const blob = await adminApi.exportCSV()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'votos.csv'
                a.click()
                URL.revokeObjectURL(url)
              } catch { alert('Error al descargar CSV') }
            }}>
              📥 Descargar CSV
            </Button>
          </Card>
          <Card className="mt-4">
            <CardHeader header={<Title2>Resetear votación</Title2>} />
            <Text className="text-red-500 block mb-2">Esto eliminará todos los votos registrados.</Text>
            <Button appearance="subtle" style={{ color: 'red' }} onClick={async () => {
              try {
                await adminApi.resetVotes()
                loadData()
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
                  {c.foto_url && <img src={c.foto_url} alt="" className="w-16 h-16 rounded-full object-cover" />}
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

      {/* TAB: Mapa GPS */}
      {tab === 'mapa' && (
        <div className="mt-6">
          <Card>
            <CardHeader header={<Title2>Mapa de votos</Title2>} />
            <Text block className="mb-4">{mapData.length} votos con ubicación registrada</Text>
            <div className="h-[500px] w-full rounded-lg overflow-hidden">
              <MapContainer center={[-12.0464, -77.0428]} zoom={12} className="h-full w-full" scrollWheelZoom={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MarkerClusterGroup markers={mapData} />
              </MapContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
