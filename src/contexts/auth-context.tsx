'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WmsUser, UserPermission } from '@/types'

interface AuthContextType {
  user: WmsUser | null
  permissions: UserPermission[]
  loading: boolean
  isSuperUser: boolean
  hasPermission: (module: string, action: 'view' | 'create' | 'edit' | 'delete') => boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  permissions: [],
  loading: true,
  isSuperUser: false,
  hasPermission: () => false,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<WmsUser | null>(null)
  const [permissions, setPermissions] = useState<UserPermission[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: wmsUser } = await supabase
          .from('wms_users')
          .select('*, roles(*)')
          .eq('auth_user_id', authUser.id)
          .single()

        if (wmsUser) {
          setUser(wmsUser)
          const { data: perms } = await supabase
            .from('user_permissions')
            .select('*')
            .eq('user_id', wmsUser.id)
          setPermissions(perms || [])
        }
      }
      setLoading(false)
    }
    fetchUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) { setUser(null); setPermissions([]) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const isSuperUser = user?.roles?.is_super_user ?? false

  const hasPermission = (module: string, action: 'view' | 'create' | 'edit' | 'delete') => {
    if (isSuperUser) return true
    const perm = permissions.find(p => p.module === module)
    if (!perm) return false
    return perm[`can_${action}` as keyof UserPermission] as boolean
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, permissions, loading, isSuperUser, hasPermission, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
