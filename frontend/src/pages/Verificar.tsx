import { useState, useEffect } from 'react'
import { Button, Input, Text, Title1, Title2, Spinner } from '@fluentui/react-components'
import {
  ArrowRightFilled,
  Search16Regular,
  Warning16Regular,
  CheckmarkCircle16Filled,
  Copy16Regular,
  Share16Regular,
} from '@fluentui/react-icons'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { verifyApi } from '../services/api'

function BackgroundDecor() {
  return (
    <>
      <div className="fixed top-20 left-10 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-40 right-10 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl pointer-events-none" />
    </>
  )
}

function VerificationSeal() {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
      className="relative w-24 h-24 mx-auto"
    >
      <div className="absolute inset-0 rounded-full border-[3px] border-green-600" />
      <div className="absolute inset-2 rounded-full border-2 border-green-600/30 border-dashed" />
      <div className="absolute inset-3 rounded-full bg-green-50 flex items-center justify-center">
        <CheckmarkCircle16Filled className="text-green-600 !text-3xl" />
      </div>
    </motion.div>
  )
}

function SkeletonCertificate() {
  return (
    <div className="w-full max-w-lg mx-auto relative z-10 animate-pulse">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-[3px]">
        <div className="border-2 border-blue-600/10 rounded-xl p-6 md:p-8">
          <div className="h-3 bg-gray-200 rounded w-36 mx-auto mb-2" />
          <div className="h-5 bg-gray-200 rounded w-24 mx-auto mb-8" />
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-gray-200" />
          </div>
          <div className="h-5 bg-gray-200 rounded w-40 mx-auto mb-2" />
          <div className="h-3 bg-gray-200 rounded w-56 mx-auto mb-6" />
          <div className="space-y-4">
            <div className="h-3 bg-gray-200 rounded w-16" />
            <div className="h-4 bg-gray-200 rounded w-48" />
            <div className="h-3 bg-gray-200 rounded w-32" />
            <div className="bg-gray-100 rounded-xl p-4 flex items-center gap-4 mt-4">
              <div className="w-14 h-14 rounded-full bg-gray-200 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-36" />
                <div className="h-3 bg-gray-200 rounded w-24" />
              </div>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
              <div className="h-3 bg-gray-200 rounded w-24" />
              <div className="h-3 bg-gray-200 rounded w-32" />
            </div>
            <div className="pt-4 border-t border-gray-100">
              <div className="h-3 bg-gray-200 rounded w-16 mb-2" />
              <div className="h-5 bg-gray-200 rounded w-40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Verificar() {
  const [searchParams] = useSearchParams()
  const [method, setMethod] = useState<'dni' | 'code'>('dni')
  const [dni, setDni] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [candidateImgFailed, setCandidateImgFailed] = useState(false)

  useEffect(() => { setCandidateImgFailed(false) }, [result])

  useEffect(() => {
    const codeParam = searchParams.get('code')
    if (codeParam) {
      setLoading(true)
      verifyApi.byCode(codeParam)
        .then(data => setResult(data))
        .catch(() => setError('Error al verificar'))
        .finally(() => setLoading(false))
    }
  }, [searchParams])

  const handleVerify = async () => {
    if (method === 'dni' && dni.length !== 8) return
    if (method === 'code' && !code.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = method === 'dni' ? await verifyApi.byDNI(dni) : await verifyApi.byCode(code)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se encontró voto')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCode = () => {
    if (result?.verification_code) {
      navigator.clipboard.writeText(result.verification_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/verificar?code=${result.verification_code}`
    try {
      await navigator.share({ title: 'Verificar mi voto', url })
    } catch {
      navigator.clipboard.writeText(url)
    }
  }

  const handleReset = () => {
    setResult(null)
    setError('')
    setDni('')
    setCode('')
  }

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4">
      <BackgroundDecor />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 relative z-10"
      >
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg flex items-center justify-center">
          <Search16Regular className="text-white !text-2xl" />
        </div>
        <Title1 block>Verificar mi voto</Title1>
        <Text className="text-gray-500" block>
          {result
            ? 'Resultado de la verificación'
            : 'Ingresa tu DNI, código de verificación o escanea el QR'}
        </Text>
      </motion.div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <SkeletonCertificate />
          </motion.div>
        ) : result ? (
          <motion.div
            key="certificate"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            className="w-full max-w-lg mx-auto relative z-10"
          >
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-[3px]">
              <div className="border-2 border-blue-600/10 rounded-xl p-6 md:p-8 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                  <span className="text-7xl font-black text-blue-600/5 tracking-[0.3em] rotate-[-25deg]">
                    VERIFICADO
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-600/20 to-transparent" />
                  <Text size={100} className="text-blue-600/60 font-semibold tracking-[0.3em] uppercase">
                    Comprobante
                  </Text>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-600/20 to-transparent" />
                </div>

                <div className="text-center mb-6">
                  <VerificationSeal />
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mt-8"
                  >
                    <Title2 className="text-gray-800" block>Voto Verificado</Title2>
                    <Text size={200} className="text-gray-400" block>
                      El siguiente voto ha sido registrado correctamente
                    </Text>
                  </motion.div>
                </div>

                <div className="border-t border-dashed border-gray-200 my-6" />

                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: { transition: { staggerChildren: 0.08, delayChildren: 0.5 } },
                  }}
                  className="space-y-5"
                >
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      visible: { opacity: 1, y: 0 },
                    }}
                  >
                    <Text size={200} className="text-gray-400 uppercase tracking-wider mb-2" block>
                      Votante
                    </Text>
                    <Text className="font-semibold text-gray-800" block>
                      {result.voter?.nombres} {result.voter?.apellido_paterno}{' '}
                      {result.voter?.apellido_materno}
                    </Text>
                    <Text size={200} className="text-gray-500" block>
                      DNI: {result.voter?.dni}
                    </Text>
                  </motion.div>

                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    className="bg-gray-50/80 rounded-xl p-4 flex items-center gap-4"
                  >
                    {result.candidate?.foto_url && !candidateImgFailed ? (
                      <img
                        src={result.candidate.foto_url}
                        alt=""
                        onError={() => setCandidateImgFailed(true)}
                        className="w-14 h-14 rounded-full object-cover shadow-sm ring-2 ring-white"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                        {result.candidate?.nombre?.charAt(0) || '?'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <Text className="font-semibold text-gray-800 truncate" block>
                        {result.candidate?.nombre}
                      </Text>
                      <Text size={200} className="text-gray-500" block>
                        {result.candidate?.partido}
                      </Text>
                      {result.candidate?.lema && (
                        <Text size={100} className="text-gray-400 italic truncate" block>
                          &ldquo;{result.candidate.lema}&rdquo;
                        </Text>
                      )}
                    </div>
                  </motion.div>

                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    className="flex items-center justify-between text-sm"
                  >
                    <Text size={200} className="text-gray-400 uppercase tracking-wider">
                      Fecha de emisión
                    </Text>
                    <Text size={200} className="text-gray-600 font-medium">
                      {new Date(result.created_at).toLocaleString('es-PE', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </motion.div>
                </motion.div>

                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-600/20 to-transparent" />
                  <Text size={100} className="text-blue-600/60 font-semibold tracking-[0.3em] uppercase">
                    Verificación
                  </Text>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-600/20 to-transparent" />
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div>
                    <Text size={100} className="text-gray-400 uppercase tracking-wider" block>
                      Código
                    </Text>
                    <Text className="text-xl font-mono tracking-[0.3em] font-bold text-gray-800" block>
                      {result.verification_code}
                    </Text>
                  </div>
                  <Button
                    appearance="subtle"
                    icon={copied ? <CheckmarkCircle16Filled className="text-green-600" /> : <Copy16Regular />}
                    onClick={handleCopyCode}
                    className="!rounded-lg"
                  >
                    {copied ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex gap-3 mt-6"
            >
              <Button
                appearance="primary"
                icon={<Share16Regular />}
                onClick={handleShare}
                className="!rounded-xl flex-1"
              >
                Compartir
              </Button>
              <Button
                appearance="outline"
                onClick={handleReset}
                className="!rounded-xl flex-1"
              >
                Verificar otro
              </Button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="search"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md mx-auto bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6 relative z-10"
          >
            <div className="flex flex-col gap-4">
              <div className="flex bg-gray-100/80 rounded-xl p-1 relative">
                <div
                  className="absolute top-1 bottom-1 w-1/2 bg-white rounded-lg shadow-sm transition-transform duration-200 ease-out"
                  style={{ transform: method === 'code' ? 'translateX(100%)' : 'translateX(0)' }}
                />
                <button
                  onClick={() => { setMethod('dni'); setError(''); setDni(''); setCode('') }}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium relative z-10 transition-colors ${
                    method === 'dni' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Por DNI
                </button>
                <button
                  onClick={() => { setMethod('code'); setError(''); setDni(''); setCode('') }}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium relative z-10 transition-colors ${
                    method === 'code' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Por Código
                </button>
              </div>

              {method === 'dni' ? (
                <Input
                  placeholder="DNI (8 dígitos)"
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  maxLength={8}
                  size="large"
                  className="!text-center !tracking-[0.2em] !font-mono"
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  autoFocus
                  contentBefore={<Search16Regular />}
                />
              ) : (
                <Input
                  placeholder="Código de verificación"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                  maxLength={8}
                  size="large"
                  className="!text-center !tracking-[0.2em] !font-mono"
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  autoFocus
                  contentBefore={<Search16Regular />}
                />
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 flex items-center gap-2"
                >
                  <Warning16Regular className="text-red-500 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <Button
                appearance="primary"
                size="large"
                onClick={handleVerify}
                disabled={(method === 'dni' ? dni.length !== 8 : !code.trim()) || loading}
                icon={loading ? undefined : <ArrowRightFilled />}
                className="!rounded-xl !shadow-lg !shadow-blue-500/20"
              >
                {loading ? <Spinner size="tiny" /> : 'Verificar'}
              </Button>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <Text size={200} className="text-gray-400">
                {method === 'dni'
                  ? 'Ingresa tu DNI para consultar tu voto'
                  : 'Ingresa el código de tu comprobante o escanea el QR'}
              </Text>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
