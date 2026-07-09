import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { Button, Text, Spinner } from '@fluentui/react-components'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { authApi } from './services/api'

const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const RegisterVote = lazy(() => import('./pages/RegisterVote'))
const Results = lazy(() => import('./pages/Results'))
const TVResults = lazy(() => import('./pages/TVResults'))
const Verificar = lazy(() => import('./pages/Verificar'))
const EncuestadorDashboard = lazy(() => import('./pages/EncuestadorDashboard'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))

function NavBar() {
  const { user, signOut, profile } = useAuth()
  const location = useLocation()

  const noNavRoutes = ['/login', '/register', '/verificar', '/tv']
  if (!user || noNavRoutes.includes(location.pathname)) return null

  const isAdmin = profile?.role === 'admin'

  return (
    <nav className="flex items-center justify-between px-4 md:px-6 py-2 bg-white shadow-sm border-b">
      <div className="flex items-center gap-4 md:gap-6">
        <Link to="/" className="no-underline"><Text weight="semibold" size={500}>🗳️ VotApp</Text></Link>
        <Link to="/" className="text-sm text-gray-600 hover:text-blue-600 no-underline">Registrar</Link>
        <Link to="/dashboard" className="text-sm text-gray-600 hover:text-blue-600 no-underline">Mi Dashboard</Link>
        <Link to="/resultados" className="text-sm text-gray-600 hover:text-blue-600 no-underline">Resultados</Link>
        {isAdmin && (
          <Link to="/admin" className="text-sm text-blue-600 hover:text-blue-800 no-underline font-semibold">Admin</Link>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Text size={100} className="hidden md:block">{profile?.nombres || user.email}</Text>
        <Button size="small" appearance="subtle" onClick={signOut}>Salir</Button>
      </div>
    </nav>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Spinner size="large" />
          <Text block className="mt-4 text-gray-400">Cargando...</Text>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner size="large" />
      </div>
    }>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
        <Route path="/" element={<ProtectedRoute><RegisterVote /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><EncuestadorDashboard /></ProtectedRoute>} />
        <Route path="/resultados" element={<Results />} />
        <Route path="/tv" element={<TVResults />} />
        <Route path="/verificar" element={<Verificar />} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="min-h-screen bg-gray-50">
          <NavBar />
          <main>
            <AppRoutes />
          </main>
        </div>
      </ToastProvider>
    </AuthProvider>
  )
}
