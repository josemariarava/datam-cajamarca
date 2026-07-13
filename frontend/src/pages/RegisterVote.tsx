import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Button, Input, Field, Text, Title1, Title2, Spinner, Badge } from '@fluentui/react-components'
import { ArrowLeftFilled, ArrowRightFilled, CheckmarkFilled, Person16Regular, Vote16Regular, NumberSymbol16Regular, Warning16Regular, Location16Regular, Call16Regular, DocumentText16Regular, CheckmarkCircle16Filled } from '@fluentui/react-icons'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { votesApi, authApi, getToken } from '../services/api'
import { addPendingVote } from '../services/offline'
import CelebrationScreen from '../components/CelebrationScreen'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useCandidates } from '../hooks/useQueries'
import { useGeolocation } from '../hooks/useGeolocation'

const stepIcons: React.ReactNode[] = [
  <NumberSymbol16Regular />,
  <Person16Regular />,
  <Vote16Regular />,
  <CheckmarkCircle16Filled />,
]
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

function BackgroundDecor() {
  return (
    <>
      <div className="fixed top-20 left-10 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-40 right-10 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-blue-100/20 via-purple-100/10 to-transparent rounded-full blur-3xl pointer-events-none" />
    </>
  )
}

function StepIndicator({ current, total, stepIndex }: { current: number; total: number; stepIndex: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <motion.div
            animate={{
              scale: i === stepIndex ? 1.1 : 1,
              backgroundColor: i <= stepIndex ? '#2563eb' : i < stepIndex ? '#2563eb' : '#e5e7eb',
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold ${
              i <= stepIndex ? 'text-white shadow-md' : 'text-gray-400'
            }`}
          >
            {i < stepIndex ? (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <CheckmarkFilled />
              </motion.span>
            ) : (
              <span>{stepIcons[i]}</span>
            )}
          </motion.div>
          <span className={`hidden sm:block text-xs font-medium ${i === stepIndex ? 'text-blue-700' : 'text-gray-400'}`}>
            {stepLabels[i]}
          </span>
          {i < total - 1 && (
            <motion.div
              animate={{ backgroundColor: i < stepIndex ? '#2563eb' : '#e5e7eb' }}
              className="w-8 h-0.5 rounded"
            />
          )}
        </div>
      ))}
    </div>
  )
}

export default function RegisterVote() {
  const { profile } = useAuth()
  const [step, setStep] = useState<'dni' | 'voter-data' | 'candidate' | 'confirm' | 'celebration'>('dni')
  const [dni, setDni] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [voterData, setVoterData] = useState<{ exists: boolean; voter?: any; has_voted?: boolean; vote?: any; fromMock?: boolean } | null>(null)
  const { data: candidates = [] } = useCandidates()
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null)
  const [voteResult, setVoteResult] = useState<VoteResult | null>(null)
  const { showToast } = useToast()
  const { coords, address: capturedAddress, startCapture } = useGeolocation()
  const [direction, setDirection] = useState(1)
  
  const voterCache = useRef(new Map()).current
  const cacheTimestamp = useRef(new Map()).current
  const filled = (v: string) => v?.trim().length > 0
  const normalizeName = (v: string) => v.trim().replace(/\s+/g, ' ')
  const getNameError = (v: string): string | undefined => {
    const n = normalizeName(v)
    if (!n) return undefined
    if (n.length < 2) return 'Mínimo 2 caracteres'
    if (n.length > 100) return 'Máximo 100 caracteres'
    if (!/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+(?:[-\s][a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+)*$/.test(n))
      return 'Solo letras, espacios y guiones'
    return undefined
  }
  const isValidName = (v: string) => !getNameError(v)

  const [newNombres, setNewNombres] = useState('')
  const [newApPat, setNewApPat] = useState('')
  const [newApMat, setNewApMat] = useState('')
  const [newDireccion, setNewDireccion] = useState('')
  const [newTelefono, setNewTelefono] = useState('')

  const stepOrder: Record<string, number> = { dni: 0, 'voter-data': 1, candidate: 2, confirm: 3 }
  const stepIndex = stepOrder[step] ?? -1
  const showProgress = step !== 'celebration'

  const stepVariants: Variants = {
    enter: (d: number) => ({ x: d * 200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d * -200, opacity: 0 }),
  }

  const getStepTransition = () => {
    return { 
      type: 'spring', 
      stiffness: 200, 
      damping: 25,
      mass: 1,
      restDelta: 0.001
    }
  }

  const getStepDirection = (currentStep: string, targetStep: string): number => {
    const currentOrder = stepOrder[currentStep] ?? 0
    const targetOrder = stepOrder[targetStep] ?? 0
    return targetOrder > currentOrder ? 1 : -1
  }

  const goForward = (nextStep: any) => { 
    const direction = getStepDirection(step, nextStep)
    setDirection(direction)
    setStep(nextStep)
  }
  const goBack = (prevStep: any) => { 
    const direction = getStepDirection(step, prevStep)
    setDirection(direction)
    setStep(prevStep)
  }

  const CACHE_TTL = 300000 // 5 minutes

  const isCacheValid = (cacheKey: string): boolean => {
    const cached = voterCache.current?.get(cacheKey)
    if (!cached) return false
    
    const now = Date.now()
    return (now - cached.timestamp) < CACHE_TTL
  }

  const checkDNI = useCallback(async () => {
    if (dni.length !== 8) return
    setLoading(true)
    setError('')
    
    const cacheKey = `voter_${dni}`
    
    if (isCacheValid(cacheKey)) {
      const cached = voterCache.current?.get(cacheKey)!
      setVoterData(cached)
      
      if (cached.voter) {
        setNewNombres(cached.voter.nombres ?? '')
        setNewApPat(cached.voter.apellido_paterno ?? '')
        setNewApMat(cached.voter.apellido_materno ?? '')
        setNewDireccion(cached.voter.direccion ?? '')
        setNewTelefono(cached.voter.telefono ?? '')
      }
      
      if (cached.exists && !cached.has_voted) {
        goForward('candidate')
      } else {
        goForward('voter-data')
      }
      setLoading(false)
      return
    }
    
    try {
      const res = await votesApi.checkVoter(dni)
      
      const enrichedData = {
        ...res,
        timestamp: Date.now()
      }
      
      setVoterData(enrichedData)
      voterCache.current?.set(cacheKey, enrichedData)
      
      if (res.voter) {
        setNewNombres(res.voter.nombres ?? '')
        setNewApPat(res.voter.apellido_paterno ?? '')
        setNewApMat(res.voter.apellido_materno ?? '')
        setNewDireccion(res.voter.direccion ?? '')
        setNewTelefono(res.voter.telefono ?? '')
      }
      
      if (res.exists && !res.has_voted) {
        goForward('candidate')
      } else {
        goForward('voter-data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar DNI')
    } finally {
      setLoading(false)
    }
  }, [dni, voterCache])

  useEffect(() => {
    if (step === 'confirm' && !coords) startCapture()
  }, [step, coords])

  const handleVote = async () => {
    if (!selectedCandidate) return
    setLoading(true)
    setError('')
    const n = (v: string) => normalizeName(v)
    const voteData = {
      dni_votante: dni.trim(), nombres: n(newNombres), apellido_paterno: n(newApPat),
      apellido_materno: n(newApMat), candidate_id: selectedCandidate,
      direccion: newDireccion.trim(), telefono: newTelefono.trim(),
      location_lat: coords?.lat, location_lng: coords?.lng, location_address: capturedAddress,
    }
    
    if (!navigator.onLine) {
      const token = await getToken()
      await addPendingVote(voteData, token || '')
      setVoteResult({
        message: 'Voto guardado offline',
        vote_id: '',
        verification_code: 'OFFLINE-' + Date.now().toString(36).toUpperCase(),
        created_at: new Date().toISOString(),
        voter: { dni: dni.trim(), nombres: n(newNombres), apellido_paterno: n(newApPat), apellido_materno: n(newApMat) },
      })
      goForward('celebration')
      return
    }
    
    try {
      const result = await votesApi.register(voteData)
      setVoteResult(result)
      goForward('celebration')
      
      const cacheKey = `voter_${dni}`
      if (voterCache.has(cacheKey)) {
        voterCache.delete(cacheKey)
        cacheTimestamp.delete(cacheKey)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar voto')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setDirection(1); setStep('dni'); setDni(''); setVoterData(null); setSelectedCandidate(null)
    setVoteResult(null); setError(''); setNewNombres(''); setNewApPat('')
    setNewApMat(''); setNewDireccion(''); setNewTelefono('')
  }

  const candidateSel = candidates.find(c => c.id === selectedCandidate)

  return (
    <div className="min-h-screen relative">
      <BackgroundDecor />

      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 relative z-10">
        {/* Encuestador info bar */}
        {profile && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-4 bg-white/70 backdrop-blur-md rounded-xl px-4 py-2.5 shadow-sm border border-white/50"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                {(profile.nombres || '?')[0].toUpperCase()}
              </div>
              <div>
                <Text size={200} weight="semibold">{profile.nombres} {profile.apellido_paterno}</Text>
                <Text size={100} className="text-gray-400 block leading-none">Encuestador</Text>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {coords ? (
                <Badge appearance="tint" color="success" size="small" className="!text-xs !gap-1"><Location16Regular /> GPS activo</Badge>
              ) : (
                <Badge appearance="ghost" size="small" className="!text-xs !gap-1"><Location16Regular /> Sin GPS</Badge>
              )}
            </div>
          </motion.div>
        )}

        {/* Step Progress */}
        {showProgress && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <StepIndicator current={stepIndex} total={stepLabels.length} stepIndex={stepIndex} />
          </motion.div>
        )}

        {/* Error alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -20, height: 0 }}
              className="bg-red-50/90 backdrop-blur-sm border border-red-200/80 text-red-700 text-sm rounded-xl p-3 mb-4 flex items-center gap-2 shadow-sm"
            >
              <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Warning16Regular className="text-red-500 !text-xs" />
              </div>
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence custom={direction} mode="popLayout">
          {/* STEP 1: DNI */}
          {step === 'dni' && (
            <motion.div
              key="dni"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={direction}
              layout
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="min-h-[250px] flex items-center justify-center"
            >
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-8 md:p-10 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                  className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-12 h-12">
                    <rect x="10" y="20" width="80" height="65" rx="8" fill="white"/>
                    <rect x="18" y="28" width="64" height="12" rx="4" fill="#2563eb" opacity="0.2"/>
                    <rect x="18" y="45" width="48" height="12" rx="4" fill="#2563eb" opacity="0.2"/>
                    <circle cx="78" cy="51" r="8" fill="#22c55e"/>
                    <path d="M74 51l3 3 5-5" stroke="white" strokeWidth={2} fill="none"/>
                    <rect x="18" y="62" width="32" height="12" rx="4" fill="#2563eb" opacity="0.2"/>
                  </svg>
                </motion.div>

                <Title1 className="!text-2xl md:!text-3xl">Registrar Voto</Title1>
                <Text block className="mb-8 text-gray-500 max-w-sm mx-auto">
                  Ingresa el DNI de la persona que desea emitir su voto
                </Text>

                <div className="max-w-xs mx-auto">
                  <Field label="Número de DNI" required>
                    <Input
                      placeholder="0 0 0 0 0 0 0 0"
                      value={dni}
                      onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      maxLength={8}
                      size="large"
                      className="!text-center !text-2xl !tracking-[0.3em] !font-mono"
                      onKeyDown={(e) => e.key === 'Enter' && checkDNI()}
                      autoFocus
                    />
                  </Field>
                </div>

                <motion.div
                  initial={false}
                  animate={dni.length === 8 ? { y: 0, opacity: 1 } : { y: 10, opacity: 0.6 }}
                  className="mt-6"
                >
                  <Button
                    appearance="primary"
                    size="large"
                    onClick={checkDNI}
                    disabled={dni.length !== 8 || loading}
                    icon={loading ? undefined : <ArrowRightFilled />}
                    className={`!rounded-xl !px-8 !h-12 !text-base transition-all ${
                      dni.length === 8 ? '!shadow-lg !shadow-blue-500/30' : ''
                    }`}
                  >
                    {loading ? <Spinner size="tiny" /> : 'Consultar DNI'}
                  </Button>
                </motion.div>

                {/* Location status */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-400"
                >
                  {coords ? (
                    <>
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span>Ubicación capturada automáticamente</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 bg-amber-400 rounded-full" />
                      <span>Capturando ubicación...</span>
                    </>
                  )}
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Voter data */}
          {step === 'voter-data' && (
            <motion.div
              key="voter-data"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={direction}
              layout
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            >
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-4 md:p-6">
                {voterData?.has_voted ? (
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="text-center py-8"
                  >
                    <div className="w-20 h-20 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                      <Warning16Regular className="text-red-500 !text-3xl" />
                    </div>
                    <Title2 className="!text-red-600">Ya votó</Title2>
                    <Text block className="mt-2 text-gray-500 max-w-xs mx-auto">
                      Esta persona ya emitió su voto en este proceso electoral.
                    </Text>
                    {voterData.vote && (
                      <div className="mt-4 inline-block bg-gray-50 rounded-xl px-4 py-2 border">
                        <Text size={200} className="text-gray-400">Código de verificación</Text>
                        <Text weight="semibold" size={400} className="tracking-widest block">
                          {voterData.vote.verification_code}
                        </Text>
                      </div>
                    )}
                    <Button appearance="primary" size="large" className="mt-6" onClick={reset}>
                      Registrar otro voto
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ staggerChildren: 0.05 }}
                    className="space-y-3"
                  >
                    {/* Header with step badge + DNI */}
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Person16Regular className="text-blue-600 !text-sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Text size={400} weight="semibold">Datos del votante</Text>
                        </div>
                        <Text size={100} className="text-gray-400 block leading-tight">
                          DNI <span className="font-mono font-semibold text-gray-600">{dni}</span>
                          {voterData?.exists ? (
                            <span className="text-green-600 ml-1">· Del padrón</span>
                          ) : voterData?.fromMock ? (
                            <span className="text-blue-600 ml-1">· Precargado</span>
                          ) : (
                            <span className="text-amber-600 ml-1">· Manual</span>
                          )}
                        </Text>
                      </div>
                    </div>

                    <Field label="Nombres" required validationState={getNameError(newNombres) ? 'error' : undefined} validationMessage={getNameError(newNombres)}>
                      <Input
                        value={newNombres}
                        onChange={e => setNewNombres(e.target.value)}
                        contentBefore={<Person16Regular className="text-gray-400" />}
                        placeholder="Ej: Juan Carlos"
                        autoFocus
                      />
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Apellido Paterno" required validationState={getNameError(newApPat) ? 'error' : undefined} validationMessage={getNameError(newApPat)}>
                        <Input
                          value={newApPat}
                          onChange={e => setNewApPat(e.target.value)}
                          contentBefore={<DocumentText16Regular className="text-gray-400" />}
                          placeholder="Ej: Pérez"
                        />
                      </Field>
                      <Field label="Apellido Materno" required validationState={getNameError(newApMat) ? 'error' : undefined} validationMessage={getNameError(newApMat)}>
                        <Input
                          value={newApMat}
                          onChange={e => setNewApMat(e.target.value)}
                          contentBefore={<DocumentText16Regular className="text-gray-400" />}
                          placeholder="Ej: López"
                        />
                      </Field>
                    </div>

                    <Field label="Dirección">
                      <Input
                        value={newDireccion}
                        onChange={e => setNewDireccion(e.target.value)}
                        contentBefore={<Location16Regular className="text-gray-400" />}
                        placeholder="Ej: Av. Principal 123, Miraflores"
                      />
                    </Field>

                    <Field label="Teléfono">
                      <Input
                        value={newTelefono}
                        onChange={e => setNewTelefono(e.target.value.replace(/\D/g, '').slice(0, 9))}
                        contentBefore={<Call16Regular className="text-gray-400" />}
                        placeholder="Ej: 987 654 321"
                      />
                    </Field>

                    {/* Data source badge */}
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mb-4"
                    >
                      <div className={`rounded-md px-2.5 py-1.5 flex items-center gap-1.5 text-[11px] ${
                        voterData?.exists
                          ? 'bg-green-50 text-green-700 border border-green-200/60'
                          : voterData?.fromMock
                          ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                          : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                      }`}>
                        {voterData?.exists ? (
                          <>
                            <CheckmarkCircle16Filled className="text-green-600 !text-xs" />
                            <span>Datos del padrón</span>
                          </>
                        ) : voterData?.fromMock ? (
                          <>
                            <CheckmarkCircle16Filled className="text-blue-600 !text-xs" />
                            <span>Datos precargados</span>
                          </>
                        ) : (
                          <>
                            <Warning16Regular className="text-amber-600 !text-xs" />
                            <span>Completar manualmente</span>
                          </>
                        )}
                      </div>
                    </motion.div>

                    {/* Progress + Actions */}
                    {(() => {
                      const count = [newNombres, newApPat, newApMat, newDireccion, newTelefono].filter(v => filled(v)).length
                      return (
                        <div className="pt-3 border-t border-gray-100">
                          <div className="flex items-center justify-between mb-3">
                            <Text size={100} className="text-gray-400">{count} de 5 campos completados</Text>
                            {filled(newNombres) && filled(newApPat) && filled(newApMat) && isValidName(newNombres) && isValidName(newApPat) && isValidName(newApMat) ? (
                              <Text size={100} className="text-green-600">Listo ✓</Text>
                            ) : (
                              <Text size={100} className="text-amber-600">Campos requeridos incompletos</Text>
                            )}
                          </div>

                          <div className="flex gap-3">
                            <Button
                              size="medium"
                              onClick={() => goBack('dni')}
                              icon={<ArrowLeftFilled />}
                              className="flex-shrink-0"
                            >
                              Volver
                            </Button>
                            <Button
                              size="medium"
                              appearance="primary"
                              onClick={() => goForward('candidate')}
                              disabled={!filled(newNombres) || !filled(newApPat) || !filled(newApMat) || !isValidName(newNombres) || !isValidName(newApPat) || !isValidName(newApMat)}
                              icon={<ArrowRightFilled />}
                              className="flex-1"
                            >
                              Continuar
                            </Button>
                          </div>
                        </div>
                      )
                    })()}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 3: Seleccionar candidato */}
          {step === 'candidate' && (
            <motion.div
              key="candidate"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={direction}
              layout
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            >
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-4 md:p-6">
                <div className="flex items-center gap-3 mb-5">
                  <Button appearance="subtle" icon={<ArrowLeftFilled />} onClick={() => goBack(voterData?.exists ? 'dni' : 'voter-data')} />
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Vote16Regular className="text-amber-600 !text-sm" />
                  </div>
                  <div className="text-base font-semibold">Elegir candidato</div>
                </div>

                {candidates.filter(c => c.activo !== false).length === 0 ? (
                  <div className="text-center py-10">
                    <Text className="text-gray-400">No hay candidatos disponibles</Text>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {candidates.filter(c => c.activo !== false).map((c, idx) => {
                      const sel = selectedCandidate === c.id
                      return (
                        <motion.div
                          key={c.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          whileHover={!sel ? { scale: 1.02 } : undefined}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div
                            className={`relative cursor-pointer rounded-xl border-2 transition-all overflow-hidden ${
                              sel ? 'shadow-md' : 'shadow-sm hover:shadow border-gray-100'
                            }`}
                            style={{ borderColor: sel ? c.color_hex : undefined, backgroundColor: sel ? `${c.color_hex}0d` : undefined }}
                            onClick={() => setSelectedCandidate(c.id)}
                          >
                            <div className="h-1" style={{ backgroundColor: c.color_hex }} />

                              <div className="p-3">
                              <div className="flex items-start gap-2.5">
                                <div className="relative flex-shrink-0">
                                  {c.foto_url ? (
                                    <img
                                      src={c.foto_url}
                                      alt={c.nombre}
                                      loading="lazy"
                                      className="w-12 h-12 rounded-full object-cover shadow-sm"
                                      style={{ border: `2px solid ${c.color_hex}30` }}
                                    />
                                  ) : (
                                    <div
                                      className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm"
                                      style={{ backgroundColor: `${c.color_hex}1a`, color: c.color_hex }}
                                    >
                                      {(c.nombre.trim()[0] || '?').toUpperCase()}
                                    </div>
                                  )}
                                  {c.numero_lista && (
                                    <span
                                      className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 text-[9px] font-bold text-white rounded-full flex items-center justify-center leading-none shadow-xs"
                                      style={{ backgroundColor: c.color_hex }}
                                    >
                                      {c.numero_lista}
                                    </span>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</div>
                                  {c.partido && (
                                    <div className="text-xs text-gray-500" style={{ marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.partido}</div>
                                  )}
                                  {c.lema && (
                                    <div className="text-[10px] italic text-gray-400" style={{ marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{c.lema}"</div>
                                  )}
                                </div>

                                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                                  {c.logo_partido_url && (
                                    <img
                                      src={c.logo_partido_url}
                                      alt={c.partido || ''}
                                      loading="lazy"
                                      className="w-10 h-10 rounded-lg object-contain shadow-xs"
                                    />
                                  )}
                                  {sel && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="w-6 h-6 rounded-full flex items-center justify-center shadow-sm"
                                      style={{ backgroundColor: c.color_hex }}
                                    >
                                      <CheckmarkFilled className="text-white !text-xs" />
                                    </motion.div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Selected glow */}
                            {sel && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="absolute inset-0 pointer-events-none rounded-xl"
                                style={{ boxShadow: `inset 0 0 16px ${c.color_hex}18` }}
                              />
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}

                {/* Bottom bar */}
                <div className="mt-5 pt-4 border-t border-gray-100">
                  {selectedCandidate && candidateSel ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: candidateSel.color_hex }} />
                        <div className="text-sm text-gray-500 truncate">
                          Seleccionado: <strong style={{ color: candidateSel.color_hex }}>{candidateSel.nombre}</strong>
                        </div>
                      </div>
                      <Button
                        appearance="primary"
                        size="medium"
                        onClick={() => goForward('confirm')}
                        icon={<ArrowRightFilled />}
                        className="w-full sm:w-auto sm:flex-none"
                      >
                        Confirmar
                      </Button>
                    </motion.div>
                  ) : (
                    <div className="text-sm text-gray-400 text-center">
                      Toca un candidato para seleccionarlo
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Confirmar */}
          {step === 'confirm' && (
            <motion.div
              key="confirm"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={direction}
              layout
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            >
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6 md:p-8">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-3 mb-5"
                >
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckmarkCircle16Filled className="text-green-600 !text-base md:!text-xl" />
                  </div>
                  <div>
                    <div className="text-lg md:text-xl font-semibold">Confirmar voto</div>
                    <div className="text-sm text-gray-400">Revisa los datos antes de continuar</div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05, duration: 0.3 }}
                  className="space-y-4"
                >
                  {/* Voter section */}
                  <div>
                    <div className="flex items-center gap-1.5 text-gray-400 font-semibold text-[10px] uppercase tracking-wider mb-2">
                      <Person16Regular className="!text-xs" /> Votante
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
                        style={{
                          backgroundColor: `${(candidateSel?.color_hex || '#3B82F6')}1a`,
                          color: candidateSel?.color_hex || '#3B82F6',
                        }}
                      >
                        {((newNombres.trim()[0] || '?') + (newApPat.trim()[0] || '')).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-base md:text-lg font-semibold truncate">{newNombres} {newApPat} {newApMat}</div>
                        <div className="text-sm text-slate-500">DNI: {dni}</div>
                        {(newDireccion || newTelefono) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-400">
                            {newDireccion && (
                              <span className="flex items-center gap-1 min-w-0">
                                <Location16Regular className="!text-xs flex-shrink-0" />
                                <span className="truncate">{newDireccion}</span>
                              </span>
                            )}
                            {newTelefono && (
                              <span className="flex items-center gap-1">
                                <Call16Regular className="!text-xs flex-shrink-0" />
                                {newTelefono}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Candidate section (light hero) */}
                  {candidateSel && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-gray-400 font-semibold text-[10px] uppercase tracking-wider">
                          <Vote16Regular className="!text-xs" /> Candidato seleccionado
                        </div>
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${candidateSel.color_hex}1a`, color: candidateSel.color_hex }}
                        >
                          <CheckmarkFilled className="!text-[10px]" /> Tu voto
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {candidateSel.foto_url && (
                          <img
                            src={candidateSel.foto_url}
                            alt=""
                            loading="lazy"
                            className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover shadow-sm flex-shrink-0"
                            style={{ border: `2px solid ${candidateSel.color_hex}40` }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-base md:text-lg font-semibold truncate" style={{ color: candidateSel.color_hex }}>
                            {candidateSel.nombre}
                          </div>
                          <div className="text-sm text-slate-500 truncate">
                            {candidateSel.partido}
                            {candidateSel.numero_lista ? ` • Lista #${candidateSel.numero_lista}` : ''}
                          </div>
                          {(candidateSel.edad || candidateSel.profesion) && (
                            <div className="text-[11px] text-slate-400 truncate">
                              {[candidateSel.edad && `${candidateSel.edad} años`, candidateSel.profesion].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* GPS status (subtle) */}
                  <div className={`rounded-xl p-3 ${coords ? 'bg-slate-50 text-slate-500' : 'bg-amber-50 text-amber-600'}`}>
                    <div className="flex items-center gap-2 text-xs">
                      {coords ? (
                        <>
                          <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                          <span className="truncate">Ubicación verificada — {capturedAddress || 'coordenadas capturadas'}</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 bg-amber-400 rounded-full flex-shrink-0" />
                          <span className="truncate">Sin ubicación — el voto se registrará sin referencia GPS</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Disclaimer */}
                  <p className="text-[11px] text-gray-400 text-center px-2">
                    Al registrar, confirmas que los datos son correctos y el voto es válido.
                  </p>

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <Button
                      appearance="subtle"
                      onClick={() => goBack('candidate')}
                      icon={<ArrowLeftFilled />}
                      className="flex-shrink-0"
                    >
                      Volver
                    </Button>
                    <Button
                      appearance="primary"
                      onClick={handleVote}
                      disabled={loading}
                      className="flex-1 !rounded-xl !h-12 !text-base"
                      style={{ backgroundColor: candidateSel?.color_hex || undefined }}
                    >
                      {loading ? (
                        <Spinner size="tiny" />
                      ) : (
                        <><CheckmarkCircle16Filled className="!text-lg" /> Registrar voto</>
                      )}
                    </Button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

        <AnimatePresence mode="wait">
          {step === 'celebration' && voteResult && (
            <motion.div
              key="celebration"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <CelebrationScreen
                voterName={`${voteResult.voter.nombres} ${voteResult.voter.apellido_paterno}`}
                verificationCode={voteResult.verification_code}
                candidateName={candidateSel?.nombre || ''}
                candidateColor={candidateSel?.color_hex || '#3B82F6'}
                onNewVote={reset}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
