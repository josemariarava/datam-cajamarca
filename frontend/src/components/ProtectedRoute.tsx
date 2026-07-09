import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Spinner } from '@fluentui/react-components'
import type { ReactNode } from 'react'

export function ProtectedRoute({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, profile, profileLoaded, loading } = useAuth()

  if (loading) return <div className="flex justify-center items-center min-h-screen"><Spinner /></div>
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !profileLoaded) return <div className="flex justify-center items-center min-h-screen"><Spinner /></div>
  if (adminOnly && profile?.role !== 'admin') return <Navigate to="/" replace />

  return <>{children}</>
}
