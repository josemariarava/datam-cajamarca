import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button, Input, Field, Text, Title1, Spinner } from '@fluentui/react-components'
import { motion, AnimatePresence } from 'framer-motion'
import { authApi } from '../services/api'

const steps = ['DNI', 'Datos', 'Cuenta']

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [dni, setDni] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dniData, setDniData] = useState<{ nombres: string; apellido_paterno: string; apellido_materno?: string } | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')

  const [manualNombres, setManualNombres] = useState('')
  const [manualApPat, setManualApPat] = useState('')
  const [manualApMat, setManualApMat] = useState('')
  const [modoManual, setModoManual] = useState(false)

  const consultarDNI = async () => {
    if (dni.length !== 8) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/consultar-dni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDniData(data)
      setStep(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'DNI no encontrado')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (!modoManual) {
        await authApi.register({ email, password, dni, telefono })
      } else {
        await authApi.registerManual({
          email, password, dni, telefono,
          nombres: manualNombres,
          apellido_paterno: manualApPat,
          apellido_materno: manualApMat,
        })
      }
      navigate('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-indigo-500 to-purple-600 p-4 relative overflow-hidden">
      <div className="absolute top-10 right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-blue-300/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md backdrop-blur-xl bg-white/90 rounded-2xl shadow-2xl p-8 relative z-10">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl shadow-lg mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-8 h-8">
              <rect x="10" y="20" width="80" height="65" rx="8" fill="white"/>
              <rect x="18" y="28" width="64" height="12" rx="4" fill="#2563eb" opacity="0.2"/>
              <rect x="18" y="45" width="48" height="12" rx="4" fill="#2563eb" opacity="0.2"/>
              <circle cx="78" cy="51" r="8" fill="#22c55e"/>
              <path d="M74 51l3 3 5-5" stroke="white" stroke-width="2" fill="none"/>
              <rect x="18" y="62" width="32" height="12" rx="4" fill="#2563eb" opacity="0.2"/>
            </svg>
          </div>
          <Title1>Crear cuenta</Title1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                i <= step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-sm ${i <= step ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>{s}</span>
              {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < step ? 'bg-blue-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 0: DNI */}
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-4">
            <Text>Ingresa tu DNI para consultar tus datos automáticamente:</Text>
            <Field label="DNI" required>
              <Input
                placeholder="8 dígitos"
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                maxLength={8}
                size="large"
                className="!text-center !text-2xl"
                onKeyDown={(e) => e.key === 'Enter' && consultarDNI()}
              />
            </Field>
            <Button appearance="primary" size="large" onClick={consultarDNI} disabled={dni.length !== 8 || loading}>
              {loading ? <Spinner size="tiny" /> : 'Consultar DNI'}
            </Button>
            <div className="text-center">
              <Button appearance="subtle" onClick={() => { setModoManual(true); setStep(1) }}>
                No tengo mi DNI, registro manual
              </Button>
            </div>
            <div className="text-center text-sm text-gray-500 border-t pt-4">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-800 no-underline font-semibold">
                Inicia sesión
              </Link>
            </div>
          </motion.div>
        )}

        {/* Step 1 & 2: Form */}
        {(step === 1 || step === 2) && (
          <motion.form key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2) } : handleSubmit}
            className="flex flex-col gap-4"
          >
            {/* Step 1: Datos personales */}
            {step === 1 && (
              <>
                {!modoManual && dniData && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                    <Text weight="semibold">{dniData.nombres} {dniData.apellido_paterno} {dniData.apellido_materno || ''}</Text>
                  </div>
                )}

                {modoManual && (
                  <>
                    <Field label="Nombres" required>
                      <Input value={manualNombres} onChange={(e) => setManualNombres(e.target.value)} required />
                    </Field>
                    <Field label="Apellido Paterno" required>
                      <Input value={manualApPat} onChange={(e) => setManualApPat(e.target.value)} required />
                    </Field>
                    <Field label="Apellido Materno">
                      <Input value={manualApMat} onChange={(e) => setManualApMat(e.target.value)} />
                    </Field>
                  </>
                )}

                <Field label="Teléfono">
                  <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                </Field>
                <Field label="Dirección">
                  <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                </Field>

                <div className="flex gap-2">
                  <Button appearance="subtle" onClick={() => setStep(0)}>Volver</Button>
                  <Button appearance="primary" type="submit" className="flex-1">Continuar</Button>
                </div>
              </>
            )}

            {/* Step 2: Cuenta */}
            {step === 2 && (
              <>
                <Field label="Correo electrónico" required>
                  <Input type="email" placeholder="tu@correo.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} required />
                </Field>
                <Field label="Contraseña" required>
                  <Input type="password" placeholder="Mínimo 6 caracteres" value={password}
                    onChange={(e) => setPassword(e.target.value)} required />
                </Field>

                <div className="flex gap-2">
                  <Button appearance="subtle" onClick={() => setStep(1)}>Volver</Button>
                  <Button appearance="primary" type="submit" disabled={loading} className="flex-1">
                    {loading ? <Spinner size="tiny" /> : 'Crear cuenta'}
                  </Button>
                </div>
              </>
            )}
          </motion.form>
        )}
      </div>
    </div>
  )
}
