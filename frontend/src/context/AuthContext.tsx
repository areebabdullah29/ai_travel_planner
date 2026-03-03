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
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  updatePreferences: (prefs: ApiUser['preferences']) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const USER_KEY = 'travel-buddy-user'

function apiUserToUser(u: ApiUser): User {
  return { id: u.id, name: u.name, email: u.email, preferences: u.preferences, createdAt: u.createdAt }
}

// ── Mock fallback helpers (used when backend is offline) ─────────────────────
const mockAccountKey = (email: string) => `travel-buddy-account-${email}`

function mockLogin(email: string, password: string): User {
  const stored = localStorage.getItem(mockAccountKey(email))
  if (!stored) throw new Error('No account found with this email')
  const account = JSON.parse(stored) as { password: string; user: User }
  if (account.password !== password) throw new Error('Invalid email or password')
  return account.user
}

function mockRegister(name: string, email: string, password: string): User {
  if (localStorage.getItem(mockAccountKey(email))) throw new Error('An account with this email already exists')
  const newUser: User = { id: crypto.randomUUID(), name, email, createdAt: new Date().toISOString() }
  localStorage.setItem(mockAccountKey(email), JSON.stringify({ password, user: newUser }))
  return newUser
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount: validate stored token against backend, fall back to cached user if offline
  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('travel-buddy-token')
      const cached = localStorage.getItem(USER_KEY)

      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        // Verify token is still valid
        const profile = await authApi.getProfile()
        const u = apiUserToUser(profile)
        setUser(u)
        localStorage.setItem(USER_KEY, JSON.stringify(u))
      } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
          // Token expired and refresh failed — clear auth
          clearStoredAuth()
        } else if (cached) {
          // Network offline — trust cached user
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
      if (err instanceof TypeError) {
        // Backend offline — use mock fallback
        const u = mockLogin(email, password)
        localStorage.setItem('travel-buddy-token', `mock_${crypto.randomUUID()}`)
        persistUser(u)
        return
      }
      throw err
    }
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    try {
      const { user: apiUser, token, refreshToken } = await authApi.register(name, email, password)
      storeTokens(token, refreshToken)
      persistUser(apiUserToUser(apiUser))
    } catch (err) {
      if (err instanceof TypeError) {
        // Backend offline — use mock fallback
        const u = mockRegister(name, email, password)
        localStorage.setItem('travel-buddy-token', `mock_${crypto.randomUUID()}`)
        persistUser(u)
        return
      }
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
      // Silently fail — preferences update is non-critical
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
