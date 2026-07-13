import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { Button, Text, Spinner } from '@fluentui/react-components'
import { Vote16Regular, Grid16Regular, Trophy16Regular, Search16Regular, Settings16Regular, AppFolder16Regular } from '@fluentui/react-icons'
import { motion } from 'framer-motion'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ProtectedRoute } from './components/ProtectedRoute'

const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const RegisterVote = lazy(() => import('./pages/RegisterVote'))
const Results = lazy(() => import('./pages/Results'))
const TVResults = lazy(() => import('./pages/TVResults'))
const Verificar = lazy(() => import('./pages/Verificar'))
const EncuestadorDashboard = lazy(() => import('./pages/EncuestadorDashboard'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))

interface NavItem { path: string; label: string; icon: React.ReactNode; adminOnly?: boolean }

const navItems: NavItem[] = [
  { path: '/', label: 'Registrar', icon: <Vote16Regular /> },
  { path: '/dashboard', label: 'Dashboard', icon: <Grid16Regular /> },
  { path: '/resultados', label: 'Resultados', icon: <Trophy16Regular /> },
  { path: '/verificar', label: 'Verificar', icon: <Search16Regular /> },
  { path: '/admin', label: 'Admin', icon: <Settings16Regular />, adminOnly: true },
]

function NavBar() {
  const { user, signOut, profile } = useAuth()
  const location = useLocation()
  const noNavRoutes = ['/login', '/register', '/tv']
  if (!user || noNavRoutes.includes(location.pathname)) return null

  const isAdmin = profile?.role === 'admin'
  const visibleItems = navItems.filter(i => !i.adminOnly || isAdmin)

  return (
    <>
      {/* Desktop top nav */}
      <nav className="hidden md:flex items-center justify-between px-6 py-3 bg-white/80 backdrop-blur-lg border-b border-gray-200/60 sticky top-0 z-50">
        <div className="flex items-center gap-1">
          <Link to="/" className="flex items-center gap-2 px-3 py-1.5 no-underline">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-5 h-5">
                <rect x="10" y="20" width="80" height="65" rx="8" fill="white"/>
                <rect x="18" y="28" width="64" height="12" rx="4" fill="#2563eb" opacity="0.2"/>
                <rect x="18" y="45" width="48" height="12" rx="4" fill="#2563eb" opacity="0.2"/>
                <circle cx="78" cy="51" r="8" fill="#22c55e"/>
                <path d="M74 51l3 3 5-5" stroke="white" strokeWidth={2} fill="none"/>
                <rect x="18" y="62" width="32" height="12" rx="4" fill="#2563eb" opacity="0.2"/>
              </svg>
            </div>
            <Text weight="semibold" size={400} className="text-gray-800">VotApp</Text>
          </Link>
          <div className="flex items-center ml-2">
            {visibleItems.map((item) => {
              const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm no-underline transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-blue-600 flex">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <InstallPrompt />
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-sm">
              {(profile?.nombres || user.email || '?')[0].toUpperCase()}
            </div>
            <span className="max-w-[150px] truncate">{profile?.nombres || user.email}</span>
          </div>
          <Button size="small" appearance="subtle" onClick={signOut} className="text-gray-500 hover:text-red-600">
            Salir
          </Button>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-200/60 z-50 safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-1">
          {visibleItems.map((item) => {
            const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-0.5 py-2 px-2 rounded-lg no-underline transition-all min-w-0 ${
                  isActive ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                <div className={`relative ${isActive ? 'scale-110' : ''} transition-transform`}>
                  <span className="text-blue-600 flex">{item.icon}</span>
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full"
                    />
                  )}
                </div>
                <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()

  const noNavRoutes = ['/login', '/register', '/tv']

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-8 h-8">
              <rect x="10" y="20" width="80" height="65" rx="8" fill="white"/>
              <rect x="18" y="28" width="64" height="12" rx="4" fill="#2563eb" opacity="0.2"/>
              <rect x="18" y="45" width="48" height="12" rx="4" fill="#2563eb" opacity="0.2"/>
              <circle cx="78" cy="51" r="8" fill="#22c55e"/>
              <path d="M74 51l3 3 5-5" stroke="white" strokeWidth={2} fill="none"/>
              <rect x="18" y="62" width="32" height="12" rx="4" fill="#2563eb" opacity="0.2"/>
            </svg>
          </div>
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

function SkipLink() {
  return (
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:bg-white focus:text-blue-600 focus:px-4 focus:py-2 focus:rounded focus:shadow-lg">
      Saltar al contenido principal
    </a>
  )
}

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
  }

  useEffect(() => {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      navigator.storage.persist()
    }
  }, [])

  if (!deferredPrompt) return null

  return (
    <Button size="small" appearance="subtle" onClick={handleInstall} className="text-xs text-blue-600">
      <AppFolder16Regular /><span className="ml-1">Instalar</span>
    </Button>
  )
}

export default function App() {
  const { pathname } = useLocation()
  const noNavRoutes = ['/login', '/register', '/tv']
  const hideNavSpacing = noNavRoutes.includes(pathname)

  useEffect(() => {
    import('./pages/RegisterVote')
    import('./pages/EncuestadorDashboard')
  }, [])

  return (
    <AuthProvider>
      <ToastProvider>
        <SkipLink />
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
          <NavBar />
          <main id="main-content" className={hideNavSpacing ? '' : 'pb-20 md:pb-0'}>
            <AppRoutes />
          </main>
        </div>
      </ToastProvider>
    </AuthProvider>
  )
}
