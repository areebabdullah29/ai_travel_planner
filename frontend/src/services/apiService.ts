/**
 * Centralized API client for Travel Buddy backend.
 * - Injects JWT Authorization header on every request
 * - Auto-refreshes expired access tokens using the stored refresh token
 * - Gracefully handles offline/server-down scenarios (callers must catch errors)
 */

import type { TripPlan } from '@/types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const TOKEN_KEY         = 'travel-buddy-token'
const REFRESH_TOKEN_KEY = 'travel-buddy-refresh-token'
const USER_KEY          = 'travel-buddy-user'

// ── Token helpers ────────────────────────────────────────────────────────────

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function storeTokens(token: string, refreshToken?: string) {
  localStorage.setItem(TOKEN_KEY, token)
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function tryRefreshAccessToken(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken()
  if (!refreshToken) return false
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshToken}`,
      },
    })
    if (res.ok) {
      const data = await res.json() as { data: { token: string } }
      localStorage.setItem(TOKEN_KEY, data.data.token)
      return true
    }
  } catch { /* network error */ }
  clearStoredAuth()
  return false
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  // If token expired, try once to refresh and retry
  if (res.status === 401) {
    const refreshed = await tryRefreshAccessToken()
    if (refreshed) {
      const newToken = getStoredToken()
      if (newToken) headers['Authorization'] = `Bearer ${newToken}`
      return fetch(`${API_URL}${path}`, { ...options, headers })
    }
  }

  return res
}

// ── Response type ─────────────────────────────────────────────────────────────

export interface ApiUser {
  id: string
  name: string
  email: string
  preferences?: {
    budgetRange?: { min: number; max: number }
    travelStyles?: string[]
    preferredRegions?: string[]
    tripDuration?: number
  }
  role?: string
  createdAt: string
}

interface AuthResponseData {
  user: ApiUser
  token: string
  refreshToken: string
}

export interface BackendTrip {
  id: string
  userId: string
  destinationId: string | null
  startDate: string
  endDate: string
  budget: number
  itinerary: unknown[]
  status: 'planned' | 'ongoing' | 'completed'
  planData: TripPlan | Record<string, unknown>
  createdAt: string
}

// ── Auth API ──────────────────────────────────────────────────────────────────

export const authApi = {
  async login(email: string, password: string): Promise<{ user: ApiUser; token: string; refreshToken: string }> {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json() as { error?: string }
      throw new Error(err.error ?? 'Login failed')
    }
    const data = await res.json() as { data: AuthResponseData }
    return data.data
  },

  async register(
    name: string,
    email: string,
    password: string,
    preferences?: ApiUser['preferences']
  ): Promise<{ user: ApiUser; token: string; refreshToken: string }> {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, preferences }),
    })
    if (!res.ok) {
      const err = await res.json() as { error?: string }
      throw new Error(err.error ?? 'Registration failed')
    }
    const data = await res.json() as { data: AuthResponseData }
    return data.data
  },

  async getProfile(): Promise<ApiUser> {
    const res = await apiFetch('/api/auth/profile')
    if (!res.ok) throw new Error('Unauthorized')
    const data = await res.json() as { data: ApiUser }
    return data.data
  },

  async updatePreferences(preferences: ApiUser['preferences']): Promise<ApiUser> {
    const res = await apiFetch('/api/auth/preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    })
    if (!res.ok) throw new Error('Failed to update preferences')
    const data = await res.json() as { data: ApiUser }
    return data.data
  },
}

// ── Trips API ─────────────────────────────────────────────────────────────────

export const tripsApi = {
  async getAll(status?: string): Promise<BackendTrip[]> {
    const query = status ? `?status=${status}` : ''
    const res = await apiFetch(`/api/trips${query}`)
    if (!res.ok) throw new Error('Failed to fetch trips')
    const data = await res.json() as { data: BackendTrip[] }
    return data.data
  },

  async create(payload: {
    budget: number
    startDate?: string
    endDate?: string
    status?: string
    planData: TripPlan
  }): Promise<BackendTrip> {
    const res = await apiFetch('/api/trips', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed to save trip')
    const data = await res.json() as { data: BackendTrip }
    return data.data
  },

  async updateStatus(backendId: string, status: 'planned' | 'ongoing' | 'completed'): Promise<BackendTrip> {
    const res = await apiFetch(`/api/trips/${backendId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    if (!res.ok) throw new Error('Failed to update trip status')
    const data = await res.json() as { data: BackendTrip }
    return data.data
  },

  async delete(backendId: string): Promise<void> {
    const res = await apiFetch(`/api/trips/${backendId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete trip')
  },
}

// ── Health check ──────────────────────────────────────────────────────────────

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/health`)
    return res.ok
  } catch {
    return false
  }
}
