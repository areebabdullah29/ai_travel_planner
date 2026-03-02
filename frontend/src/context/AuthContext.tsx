import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  createdAt: string
}

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('travel-buddy-user')
    const token = localStorage.getItem('travel-buddy-token')
    if (stored && token) {
      setUser(JSON.parse(stored) as User)
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    // Try real backend first, fall back to mock
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) {
        const data = await res.json() as { user: User; token: string }
        setUser(data.user)
        localStorage.setItem('travel-buddy-user', JSON.stringify(data.user))
        localStorage.setItem('travel-buddy-token', data.token)
        return
      }
      if (res.status === 401) throw new Error('Invalid email or password')
      throw new Error('Server error')
    } catch (err) {
      if (err instanceof Error && err.message !== 'Failed to fetch') throw err

      // --- Mock fallback (when backend is offline) ---
      const stored = localStorage.getItem(`travel-buddy-account-${email}`)
      if (!stored) throw new Error('No account found with this email')
      const account = JSON.parse(stored) as { password: string; user: User }
      if (account.password !== password) throw new Error('Invalid email or password')
      const mockToken = `mock_${crypto.randomUUID()}`
      setUser(account.user)
      localStorage.setItem('travel-buddy-user', JSON.stringify(account.user))
      localStorage.setItem('travel-buddy-token', mockToken)
    }
  }

  const register = async (name: string, email: string, password: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      if (res.ok) {
        const data = await res.json() as { user: User; token: string }
        setUser(data.user)
        localStorage.setItem('travel-buddy-user', JSON.stringify(data.user))
        localStorage.setItem('travel-buddy-token', data.token)
        return
      }
      const errData = await res.json() as { message?: string }
      throw new Error(errData.message ?? 'Registration failed')
    } catch (err) {
      if (err instanceof Error && err.message !== 'Failed to fetch') throw err

      // --- Mock fallback ---
      const existing = localStorage.getItem(`travel-buddy-account-${email}`)
      if (existing) throw new Error('An account with this email already exists')

      const newUser: User = {
        id: crypto.randomUUID(),
        name,
        email,
        createdAt: new Date().toISOString(),
      }
      const mockToken = `mock_${crypto.randomUUID()}`
      localStorage.setItem(`travel-buddy-account-${email}`, JSON.stringify({ password, user: newUser }))
      setUser(newUser)
      localStorage.setItem('travel-buddy-user', JSON.stringify(newUser))
      localStorage.setItem('travel-buddy-token', mockToken)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('travel-buddy-user')
    localStorage.removeItem('travel-buddy-token')
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
