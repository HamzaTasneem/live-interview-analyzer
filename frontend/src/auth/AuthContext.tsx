import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, getToken, setToken } from '../api.js'

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'assessor' | 'candidate'
}

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string, inviteCode?: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState>(null as any)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    api<{ user: User }>('/api/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const d = await api<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    setToken(d.token)
    setUser(d.user)
  }

  const register = async (email: string, password: string, name: string, inviteCode?: string) => {
    const d = await api<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: { email, password, name, inviteCode: inviteCode || undefined },
    })
    setToken(d.token)
    setUser(d.user)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
