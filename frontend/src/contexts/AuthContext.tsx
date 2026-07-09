import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../services/supabase'
import type { User } from '@supabase/supabase-js'

interface Profile {
  id: string
  dni: string
  nombres: string
  apellido_paterno: string
  role: string
  is_active: boolean
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  profileLoaded: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoaded, setProfileLoaded] = useState(true)

  const fetchProfile = async (userId: string) => {
    try {
      const res = await fetch('/api/auth/profile', {
        headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
      }
    } catch {} finally {
      setProfileLoaded(true)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user ?? null
      setUser(sessionUser)
      if (sessionUser) {
        setProfileLoaded(false)
        fetchProfile(sessionUser.id)
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null
      setUser(sessionUser)
      if (sessionUser) fetchProfile(sessionUser.id)
      else {
        setProfile(null)
        setProfileLoaded(true)
      }
    })

    return () => listener?.subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileLoaded, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
