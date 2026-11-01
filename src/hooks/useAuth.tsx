import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ProfileRow } from '@/lib/database.types'
import { clearAllOffline } from '@/lib/offline'
import { PERSIST_KEY } from '@/lib/queryClient'

interface AuthState {
  session: Session | null
  profile: ProfileRow | null
  loading: boolean
  isAdmin: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

let pinged = false
const PROFILE_KEY = 'cached-profile'
const readCachedProfile = (userId: string): ProfileRow | null => {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null') as ProfileRow | null
    return p?.id === userId ? p : null
  } catch {
    return null
  }
}
const writeCachedProfile = (p: ProfileRow) => {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

// À la déconnexion, on efface les données locales (appareil partagé).
const clearLocalData = async () => {
  try {
    localStorage.removeItem(PROFILE_KEY)
    localStorage.removeItem(PERSIST_KEY)
  } catch {
    /* ignore */
  }
  await clearAllOffline().catch(() => {})
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    // Hors ligne : on garde le profil déjà chargé (ou celui mis en cache).
    if (error) {
      const cached = readCachedProfile(userId)
      if (cached) setProfile((p) => p ?? cached)
      return
    }
    setProfile(data)
    if (data) {
      writeCachedProfile(data)
      // Note la visite du jour (statistique « élèves actifs »), une fois par session.
      if (!pinged) {
        pinged = true
        supabase.rpc('ping').then(() => {})
      }
    }
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      await loadProfile(data.session?.user.id)
      if (mounted) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      // Ne pas appeler Supabase directement dans ce callback (risque de blocage).
      setTimeout(() => loadProfile(s?.user.id), 0)
      if (event === 'PASSWORD_RECOVERY') navigate('/nouveau-mot-de-passe')
      if (event === 'SIGNED_OUT') {
        queryClient.clear()
        clearLocalData()
      }
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile, navigate, queryClient])

  const value: AuthState = {
    session,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    refreshProfile: () => loadProfile(session?.user.id),
    signOut: async () => {
      await supabase.auth.signOut()
      navigate('/connexion')
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}
