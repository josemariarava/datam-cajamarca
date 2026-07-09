import { useState, useCallback, useEffect } from 'react'
import { Button, Input, Field, Card, CardHeader, Text, Title1, Title2, Spinner, Badge } from '@fluentui/react-components'
import { ArrowLeftFilled } from '@fluentui/react-icons'
import { motion, AnimatePresence } from 'framer-motion'
import { candidatesApi, votesApi, authApi, getToken } from '../services/api'
import { addPendingVote } from '../services/offline'
import CelebrationScreen from '../components/CelebrationScreen'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

const stepLabels = ['DNI', 'Datos', 'Candidato', 'Confirmar']

interface Candidate {
  id: string; numero_lista: number; nombre: string; partido: string;
  lema: string; color_hex: string; foto_url: string; logo_partido_url: string;
  edad: number; profesion: string; propuestas: string[]; activo: boolean;
}

interface VoteResult {
  message: string; vote_id: string; verification_code: string;
  created_at: string; voter: { dni: string; nombres: string; apellido_paterno: string; apellido_materno: string };
}

export default function RegisterVote() {
  const { profile } = useAuth()
  const [step, setStep] = useState<'dni' | 'voter-data' | 'candidate' | 'confirm' | 'celebration'>('dni')
  const [dni, setDni] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [voterData, setVoterData] = useState<{ exists: boolean; voter?: any; has_voted?: boolean; vote?: any } | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null)
  const [voteResult, setVoteResult] = useState<VoteResult | null>(null)
  const { showToast } = useToast()
  const [capturedAddress, setCapturedAddress] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  const [newNombres, setNewNombres] = useState('')
  const [newApPat, setNewApPat] = useState('')
  const [newApMat, setNewApMat] = useState('')
  const [newDireccion, setNewDireccion] = useState('')
  const [newTelefono, setNewTelefono] = useState('')

  const stepOrder: Record<string, number> = { dni: 0, 'voter-data': 1, candidate: 2, confirm: 3 }
  const stepIndex = stepOrder[step] ?? -1
  const showProgress = step !== 'celebration'

  useEffect(() => {
    candidatesApi.getAll()
      .then(setCandidates)
      .catch(() => showToast('Error al cargar candidatos', 'error'))
  }, [])

  const checkDNI = useCallback(async () => {
    if (dni.length !== 8) return
    setLoading(true)
    setError('')
    try {
      const res = await votesApi.checkVoter(dni)
      setVoterData(res)
      if (res.exists && !res.has_voted) {
        setNewNombres(res.voter!.nombres)
        setNewApPat(res.voter!.apellido_paterno)
        setNewApMat(res.voter!.apellido_materno)
        setNewDireccion(res.voter!.direccion)
        setNewTelefono(res.voter!.telefono)
        setStep('candidate')
      } else if (res.exists && res.has_voted) {
        setStep('voter-data')
      } else {
        try {
          const dniData = await authApi.consultarDNI(dni)
          setNewNombres(dniData.nombres)
          setNewApPat(dniData.apellido_paterno)
          setNewApMat(dniData.apellido_materno || '')
        } catch {}
        setStep('voter-data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar DNI')
    } finally {
      setLoading(false)
    }
  }, [dni])

  const captureLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&accept-language=es`)
            .then(r => r.json())
            .then(d => setCapturedAddress(d.display_name || ''))
            .catch((e) => console.warn('Geocoding falló:', e))
        },
        (err) => showToast(`No se pudo capturar ubicación: ${err.message}`, 'info'),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      )
    }
  }

  useEffect(() => { captureLocation() }, [])

  const handleVote = async () => {
    if (!selectedCandidate) return
    setLoading(true)
    setError('')
    const voteData = {
      dni_votante: dni, nombres: newNombres, apellido_paterno: newApPat,
      apellido_materno: newApMat, candidate_id: selectedCandidate,
      direccion: newDireccion, telefono: newTelefono,
      location_lat: coords?.lat, location_lng: coords?.lng, location_address: capturedAddress,
    }
    try {
      if (!navigator.onLine) {
        const token = await getToken()
        await addPendingVote(voteData, token || '')
        setVoteResult({
          message: 'Voto guardado offline',
          vote_id: '',
          verification_code: 'OFFLINE-' + Date.now().toString(36).toUpperCase(),
          created_at: new Date().toISOString(),
          voter: { dni, nombres: newNombres, apellido_paterno: newApPat, apellido_materno: newApMat },
        })
        setStep('celebration')
        return
      }
      const result = await votesApi.register(voteData)
      setVoteResult(result)
      setStep('celebration')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar voto')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setStep('dni'); setDni(''); setVoterData(null); setSelectedCandidate(null)
    setVoteResult(null); setError(''); setNewNombres(''); setNewApPat('')
    setNewApMat(''); setNewDireccion(''); setNewTelefono('')
  }

  const candidateSel = candidates.find(c => c.id === selectedCandidate)

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      {/* Header */}
      {profile && (
        <div className="text-center mb-4">
          <Text size={200} className="text-gray-500">👤 {profile.nombres} {profile.apellido_paterno}</Text>
          <div className="mt-1">
            {coords ? (
              <Badge appearance="tint" color="success" size="small">📍 Ubicación capturada</Badge>
            ) : (
              <Badge appearance="ghost" size="small">📍 Sin ubicación</Badge>
            )}
          </div>
        </div>
      )}

      {/* Step Progress Bar */}
      {showProgress && (
        <div className="flex items-center justify-center gap-1 mb-6">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all ${
                i < stepIndex ? 'bg-blue-100 text-blue-700' :
                i === stepIndex ? 'bg-blue-600 text-white shadow-sm' :
                'bg-gray-100 text-gray-400'
              }`}>
                {i < stepIndex ? '✓' : i + 1}
                <span className={i === stepIndex ? 'inline' : 'hidden sm:inline'}>{label}</span>
              </div>
              {i < stepLabels.length - 1 && (
                <div className={`w-6 h-0.5 ${i < stepIndex ? 'bg-blue-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4 flex items-center gap-2">
            <span>⚠️</span><span>{error}</span>
          </motion.div>
        )}

        {/* STEP 1: DNI */}
        {step === 'dni' && (
          <motion.div key="dni" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Card className="text-center p-8">
              <div className="text-4xl mb-4">🗳️</div>
              <Title1>Registrar Voto</Title1>
              <Text block className="mb-6 text-gray-500">Ingresa el DNI de la persona que desea votar:</Text>
              <div className="max-w-xs mx-auto">
                <Field label="DNI del votante" required>
                  <Input
                    placeholder="8 dígitos"
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    maxLength={8}
                    size="large"
                    className="!text-center !text-2xl"
                    onKeyDown={(e) => e.key === 'Enter' && checkDNI()}
                    autoFocus
                  />
                </Field>
              </div>
              <Button appearance="primary" size="large" className="mt-6" onClick={checkDNI} disabled={dni.length !== 8 || loading}>
                {loading ? <Spinner size="tiny" /> : 'Consultar'}
              </Button>
            </Card>
          </motion.div>
        )}

        {/* STEP 2: Voter data */}
        {step === 'voter-data' && (
          <motion.div key="voter-data" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Card>
              <CardHeader header={<Title2>{voterData?.has_voted ? 'Ya votó' : 'Datos del votante'}</Title2>} />

              {voterData?.has_voted ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">⚠️</div>
                  <Text size={500} className="text-red-500">Esta persona ya emitió su voto.</Text>
                  {voterData.vote && (
                    <Text block className="mt-2">Código: <strong>{voterData.vote.verification_code}</strong></Text>
                  )}
                  <Button appearance="primary" className="mt-6" onClick={reset}>Registrar otro voto</Button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <Field label="Nombres" required>
                    <Input value={newNombres} onChange={e => setNewNombres(e.target.value)} required />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Apellido Paterno" required>
                      <Input value={newApPat} onChange={e => setNewApPat(e.target.value)} required />
                    </Field>
                    <Field label="Apellido Materno">
                      <Input value={newApMat} onChange={e => setNewApMat(e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Dirección">
                    <Input value={newDireccion} onChange={e => setNewDireccion(e.target.value)} />
                  </Field>
                  <Field label="Teléfono">
                    <Input value={newTelefono} onChange={e => setNewTelefono(e.target.value)} />
                  </Field>

                  <div className="flex gap-2">
                    <Button onClick={() => setStep('dni')} icon={<ArrowLeftFilled />}>Volver</Button>
                    <Button appearance="primary" onClick={() => setStep('candidate')} disabled={!newNombres || !newApPat} className="flex-1">
                      Continuar
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* STEP 3: Seleccionar candidato */}
        {step === 'candidate' && (
          <motion.div key="candidate" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="flex items-center gap-2 mb-4">
              <Button appearance="subtle" icon={<ArrowLeftFilled />} onClick={() => setStep(voterData?.exists ? 'dni' : 'voter-data')} />
              <Title2>Seleccionar candidato</Title2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {candidates.filter(c => c.activo !== false).map((c) => (
                <motion.div key={c.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Card
                    className={`cursor-pointer transition-all overflow-hidden ${
                      selectedCandidate === c.id ? 'ring-2 shadow-lg' : ''
                    }`}
                    style={{ borderLeftColor: c.color_hex, borderLeftWidth: selectedCandidate === c.id ? 5 : 3 }}
                    onClick={() => setSelectedCandidate(c.id)}
                  >
                    <div className="flex items-start gap-3">
                      {c.foto_url && (
                        <img src={c.foto_url} alt={c.nombre} className="w-16 h-16 rounded-full object-cover ring-2 ring-offset-1"
                          style={{ borderColor: c.color_hex }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {c.numero_lista && (
                            <span className="text-xs font-bold bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                              #{c.numero_lista}
                            </span>
                          )}
                          <Text weight="semibold" className="truncate">{c.nombre}</Text>
                        </div>
                        {c.partido && <Text size={200} className="text-gray-500">{c.partido}</Text>}
                        {c.lema && <Text size={200} className="italic text-gray-400">"{c.lema}"</Text>}
                        {c.propuestas?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {c.propuestas.slice(0, 3).map((p, i) => (
                              <Badge key={i} size="small" appearance="tint">{p}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            {selectedCandidate && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-center">
                <Text block className="mb-2 text-gray-500">
                  Votante: <strong>{newNombres} {newApPat}</strong> · DNI: {dni}
                </Text>
                <Button appearance="primary" size="large" onClick={() => setStep('confirm')}>
                  Continuar con {candidateSel?.nombre}
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* STEP 4: Confirmar */}
        {step === 'confirm' && (
          <motion.div key="confirm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Card>
              <CardHeader header={<Title2>Confirmar voto</Title2>} />
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <Text size={200} className="text-blue-600 font-semibold uppercase tracking-wide">Votante</Text>
                  <Text weight="semibold" size={400}>{newNombres} {newApPat} {newApMat}</Text>
                  <Text size={200} className="text-gray-500">DNI: {dni}</Text>
                </div>

                {candidateSel && (
                  <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                    <Text size={200} className="text-green-600 font-semibold uppercase tracking-wide">Candidato seleccionado</Text>
                    <div className="flex items-center gap-3 mt-2">
                      {candidateSel.foto_url && (
                        <img src={candidateSel.foto_url} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-green-300" />
                      )}
                      <div>
                        <Text weight="semibold" size={400} style={{ color: candidateSel.color_hex }}>{candidateSel.nombre}</Text>
                        <Text size={200}>{candidateSel.partido}</Text>
                      </div>
                    </div>
                  </div>
                )}

                {coords && (
                  <Text size={200} className="text-gray-400 flex items-center gap-1">
                    <span>📍</span> Ubicación capturada
                  </Text>
                )}

                <div className="flex gap-2 pt-2">
                  <Button appearance="subtle" onClick={() => setStep('candidate')} icon={<ArrowLeftFilled />}>Volver</Button>
                  <Button appearance="primary" onClick={handleVote} disabled={loading} className="flex-1 !bg-green-600 hover:!bg-green-700">
                    {loading ? <Spinner size="tiny" /> : '✅ Confirmar y registrar voto'}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* STEP 5: Celebración */}
        {step === 'celebration' && voteResult && (
          <CelebrationScreen
            voterName={`${voteResult.voter.nombres} ${voteResult.voter.apellido_paterno}`}
            verificationCode={voteResult.verification_code}
            candidateName={candidateSel?.nombre || ''}
            candidateColor={candidateSel?.color_hex || '#3B82F6'}
            onNewVote={reset}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
