import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  authApi,
  storeTokens,
  clearStoredAuth,
  type ApiUser,
} from '@/services/apiService'

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  preferences?: ApiUser['preferences']
  createdAt: string
}

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, interests?: string[]) => Promise<void>
  logout: () => void
  updatePreferences: (prefs: ApiUser['preferences']) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const USER_KEY = 'travel-buddy-user'

function apiUserToUser(u: ApiUser): User {
  return { id: u.id, name: u.name, email: u.email, preferences: u.preferences, createdAt: u.createdAt }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('travel-buddy-token')
      const cached = localStorage.getItem(USER_KEY)

      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        const profile = await authApi.getProfile()
        const u = apiUserToUser(profile)
        setUser(u)
        localStorage.setItem(USER_KEY, JSON.stringify(u))
      } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
          clearStoredAuth()
        } else if (cached) {
          setUser(JSON.parse(cached) as User)
        }
      } finally {
        setIsLoading(false)
      }
    }
    void init()
  }, [])

  const persistUser = (u: User) => {
    setUser(u)
    localStorage.setItem(USER_KEY, JSON.stringify(u))
  }

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { user: apiUser, token, refreshToken } = await authApi.login(email, password)
      storeTokens(token, refreshToken)
      persistUser(apiUserToUser(apiUser))
    } catch (err) {
      if (err instanceof TypeError) throw new Error('Cannot reach the server. Please check your connection.')
      throw err
    }
  }, [])

  const register = useCallback(async (name: string, email: string, password: string, interests?: string[]) => {
    const preferences = interests?.length ? { travelStyles: interests } : undefined
    try {
      const { user: apiUser, token, refreshToken } = await authApi.register(name, email, password, preferences)
      storeTokens(token, refreshToken)
      persistUser(apiUserToUser(apiUser))
    } catch (err) {
      if (err instanceof TypeError) throw new Error('Cannot reach the server. Please check your connection.')
      throw err
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    clearStoredAuth()
  }, [])

  const updatePreferences = useCallback(async (prefs: ApiUser['preferences']) => {
    try {
      const updated = await authApi.updatePreferences(prefs)
      const u = apiUserToUser(updated)
      persistUser(u)
    } catch {
      // non-critical
    }
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
      updatePreferences,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
