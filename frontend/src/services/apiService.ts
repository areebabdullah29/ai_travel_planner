/**
 * Centralized API client for Travel Buddy backend.
 * - Injects JWT Authorization header on every request
 * - Auto-refreshes expired access tokens using the stored refresh token
 */

import type { TripPlan } from '@/types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const TOKEN_KEY = 'travel-buddy-token'
const REFRESH_TOKEN_KEY = 'travel-buddy-refresh-token'
const USER_KEY = 'travel-buddy-user'
const JSON_HEADERS = { 'Content-Type': 'application/json' }

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

function buildHeaders(options: RequestInit = {}): Record<string, string> {
  const customHeaders = (options.headers && typeof options.headers === 'object'
    ? (options.headers as Record<string, string>)
    : {})

  return {
    ...JSON_HEADERS,
    ...customHeaders,
    ...(getStoredToken() ? { Authorization: `Bearer ${getStoredToken()}` } : {}),
  }
}

async function tryRefreshAccessToken(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken()
  if (!refreshToken) return false

  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ refreshToken }),
    })

    if (!res.ok) return false
    const data = await res.json() as { token: string }
    storeTokens(data.token)
    return true
  } catch {
    return false
  }
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = buildHeaders(options)
  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401 && await tryRefreshAccessToken()) {
    return fetch(`${API_URL}${path}`, { ...options, headers: buildHeaders(options) })
  }

  return res
}

async function parseJson<T>(res: Response, fallback: string): Promise<T> {
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) {
    const detail = (data as any)?.detail
    let message: string
    if (typeof detail === 'string') {
      message = detail
    } else if (Array.isArray(detail) && detail.length > 0) {
      // FastAPI validation error — each item has a `msg` field
      message = detail.map((d: any) => d?.msg ?? String(d)).join(', ')
    } else {
      message = (data as any)?.error ?? fallback
    }
    throw new Error(message)
  }
  return data as T
}

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

export interface AuthResponseData {
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

async function requestJson<T>(path: string, options: RequestInit = {}, fallback = 'Request failed'): Promise<T> {
  const res = await apiFetch(path, options)
  return parseJson<T>(res, fallback)
}

export const authApi = {
  async login(email: string, password: string): Promise<AuthResponseData> {
    return requestJson<AuthResponseData>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, 'Login failed')
  },

  async register(
    name: string,
    email: string,
    password: string,
    preferences?: ApiUser['preferences']
  ): Promise<AuthResponseData> {
    return requestJson<AuthResponseData>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, preferences }),
    }, 'Registration failed')
  },

  async getProfile(): Promise<ApiUser> {
    return requestJson<ApiUser>('/api/auth/profile', {}, 'Unauthorized')
  },

  async updatePreferences(preferences: ApiUser['preferences']): Promise<ApiUser> {
    return requestJson<ApiUser>('/api/auth/preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    }, 'Failed to update preferences')
  },
}

export const tripsApi = {
  async getAll(status?: string): Promise<BackendTrip[]> {
    const query = status ? `?status=${status}` : ''
    const data = await requestJson<{ data: BackendTrip[] }>(`/api/trips${query}`, {}, 'Failed to fetch trips')
    return data.data
  },

  async create(payload: {
    budget: number
    startDate?: string
    endDate?: string
    status?: string
    planData: TripPlan
  }): Promise<BackendTrip> {
    const data = await requestJson<{ data: BackendTrip }>('/api/trips', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 'Failed to save trip')
    return data.data
  },

  async updateStatus(backendId: string, status: 'planned' | 'ongoing' | 'completed'): Promise<BackendTrip> {
    const data = await requestJson<{ data: BackendTrip }>(`/api/trips/${backendId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }, 'Failed to update trip status')
    return data.data
  },

  async delete(backendId: string): Promise<void> {
    const res = await apiFetch(`/api/trips/${backendId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete trip')
  },
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/health`)
    return res.ok
  } catch {
    return false
  }
}
