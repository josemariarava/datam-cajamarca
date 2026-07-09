import { useState, useEffect } from 'react'
import { Button, Input, Text, Title1, Title2, Card, Spinner, makeStyles } from '@fluentui/react-components'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { verifyApi } from '../services/api'

const useStyles = makeStyles({
  card: {
    maxWidth: '480px',
    width: '100%',
  },
})

export default function Verificar() {
  const styles = useStyles()
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
      fetch(`/api/votes/verify-code/${code}`)
        .then(r => r.json())
        .then(data => {
          if (data.error) setError(data.error)
          else setResult(data)
        })
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
        <span className="text-4xl">🔍</span>
        <Title1>Verificar mi voto</Title1>
        <Text className="text-gray-500">Ingresa tu DNI o escanea el código QR de tu comprobante</Text>
      </motion.div>

      <Card className={styles.card}>
        <div className="flex flex-col gap-4">
          <Input
            placeholder="DNI (8 dígitos)"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
            maxLength={8}
            size="large"
            className="!text-center"
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
          />
          {error && <Text className="text-red-500 text-center">{error}</Text>}
          <Button appearance="primary" size="large" onClick={handleVerify} disabled={dni.length !== 8 || loading}>
            {loading ? <Spinner size="tiny" /> : 'Verificar'}
          </Button>
        </div>
      </Card>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md mt-6 relative"
          >
            {/* Animated stamp */}
            <motion.div
              initial={{ scale: 0, rotate: -45, opacity: 0 }}
              animate={{ scale: 1, rotate: -15, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
              className="absolute -top-4 -right-4 z-10 pointer-events-none"
            >
              <div className="bg-green-600 text-white text-sm font-bold py-2 px-4 rounded-lg shadow-lg rotate-[-15deg] border-2 border-green-300">
                ✅ VOTO VERIFICADO
              </div>
            </motion.div>

            <Card>
              <div className="text-center">
                <span className="text-4xl">✅</span>
                <Title2 className="mt-2">Voto confirmado</Title2>

                <div className="bg-green-50 rounded-lg p-4 my-4 text-left space-y-2">
                  <Text><strong>Votante:</strong> {result.voter?.nombres} {result.voter?.apellido_paterno} {result.voter?.apellido_materno}</Text>
                  <Text><strong>DNI:</strong> {result.voter?.dni}</Text>

                  <div className="border-t pt-2 mt-2 flex items-center gap-3">
                    {result.candidate?.foto_url && (
                      <img src={result.candidate.foto_url} alt="" className="w-12 h-12 rounded-full object-cover" />
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

                  <div className="border-t pt-2 mt-2">
                    <Text size={200}>
                      <strong>Fecha:</strong> {new Date(result.created_at).toLocaleString('es-PE')}
                    </Text>
                  </div>
                  <div>
                    <Text size={200}>
                      <strong>Código:</strong> {result.verification_code}
                    </Text>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
