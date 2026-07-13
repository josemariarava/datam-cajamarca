import { useState, useEffect } from 'react'
import { Button, Input, Text, Title1, Title2, Spinner } from '@fluentui/react-components'
import { ArrowRightFilled, Search16Regular, Warning16Regular, CheckmarkCircle16Filled } from '@fluentui/react-icons'
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

export default function Verificar() {
  const [searchParams] = useSearchParams()
  const [dni, setDni] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      setDni('')
      setLoading(true)
      verifyApi.byCode(code)
        .then(data => setResult(data))
        .catch(() => setError('Error al verificar'))
        .finally(() => setLoading(false))
    }
  }, [searchParams])

  const handleVerify = async () => {
    if (dni.length !== 8) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await verifyApi.byDNI(dni)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se encontró voto para este DNI')
    } finally {
      setLoading(false)
    }
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
        <Title1>Verificar mi voto</Title1>
        <Text className="text-gray-500">Ingresa tu DNI o escanea el código QR de tu comprobante</Text>
      </motion.div>

      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6 relative z-10">
        <div className="flex flex-col gap-4">
          <Input
            placeholder="DNI (8 dígitos)"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
            maxLength={8}
            size="large"
            className="!text-center !tracking-[0.2em] !font-mono"
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            autoFocus
          />
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 flex items-center gap-2">
              <Warning16Regular className="text-red-500" />
              <span>{error}</span>
            </div>
          )}
          <Button
            appearance="primary"
            size="large"
            onClick={handleVerify}
            disabled={dni.length !== 8 || loading}
            icon={loading ? undefined : <ArrowRightFilled />}
            className="!rounded-xl"
          >
            {loading ? <Spinner size="tiny" /> : 'Verificar'}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md mt-6 relative z-10"
          >
            {/* Animated stamp */}
            <motion.div
              initial={{ scale: 0, rotate: -45, opacity: 0 }}
              animate={{ scale: 1, rotate: -15, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
              className="absolute -top-4 -right-4 z-20 pointer-events-none"
            >
              <div className="bg-green-600 text-white text-sm font-bold py-2 px-4 rounded-lg shadow-lg rotate-[-15deg] border-2 border-green-300">
                ✅ VOTO VERIFICADO
              </div>
            </motion.div>

            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6">
              <div className="text-center">
                <CheckmarkCircle16Filled className="text-green-600 !text-4xl" />
                <Title2 className="mt-2">Voto confirmado</Title2>

                <div className="bg-green-50/80 rounded-xl p-4 my-4 text-left space-y-2">
                  <Text><strong>Votante:</strong> {result.voter?.nombres} {result.voter?.apellido_paterno} {result.voter?.apellido_materno}</Text>
                  <Text><strong>DNI:</strong> {result.voter?.dni}</Text>

                  <div className="border-t border-green-200/50 pt-3 mt-3 flex items-center gap-3">
                    {result.candidate?.foto_url && (
                      <img src={result.candidate.foto_url} alt="" className="w-12 h-12 rounded-full object-cover shadow-sm" />
                    )}
                    <div>
                      <Text weight="semibold" style={{ color: result.candidate?.color_hex || '#000' }}>
                        {result.candidate?.nombre}
                      </Text>
                      <Text block size={200}>{result.candidate?.partido}</Text>
                      {result.candidate?.lema && (
                        <Text size={200} className="italic">"{result.candidate.lema}"</Text>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-green-200/50 pt-3 mt-3 space-y-1">
                    <Text size={200}>
                      <strong>Fecha:</strong> {new Date(result.created_at).toLocaleString('es-PE')}
                    </Text>
                    <Text size={200}>
                      <strong>Código:</strong>{' '}
                      <span className="tracking-widest font-semibold">{result.verification_code}</span>
                    </Text>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
