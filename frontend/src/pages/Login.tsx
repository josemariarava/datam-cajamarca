import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button, Input, Field, Text, Title1 } from '@fluentui/react-components'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-indigo-500 to-purple-600 p-4 relative overflow-hidden">
      {/* Background decorative circles */}
      <div className="absolute top-10 left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-300/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md backdrop-blur-xl bg-white/90 rounded-2xl shadow-2xl p-8 relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-10 h-10">
              <rect x="10" y="20" width="80" height="65" rx="8" fill="white"/>
              <rect x="18" y="28" width="64" height="12" rx="4" fill="#2563eb" opacity="0.2"/>
              <rect x="18" y="45" width="48" height="12" rx="4" fill="#2563eb" opacity="0.2"/>
              <circle cx="78" cy="51" r="8" fill="#22c55e"/>
              <path d="M74 51l3 3 5-5" stroke="white" stroke-width="2" fill="none"/>
              <rect x="18" y="62" width="32" height="12" rx="4" fill="#2563eb" opacity="0.2"/>
            </svg>
          </div>
          <Title1>VotApp</Title1>
          <Text className="text-gray-500 block mt-1">Sistema de Votación en Tiempo Real</Text>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Field label="Correo electrónico" required>
            <Input
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>

          <Field label="Contraseña" required>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <Button appearance="primary" type="submit" disabled={loading} size="large" className="!rounded-xl">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>

          <div className="text-center text-sm text-gray-500">
            <Link to="/" className="text-blue-600 hover:text-blue-800 no-underline"
              onClick={(e) => { e.preventDefault(); alert('Contacta al administrador para restablecer tu contraseña') }}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <div className="text-center text-sm text-gray-500 border-t pt-4">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-800 no-underline font-semibold">
              Regístrate
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
