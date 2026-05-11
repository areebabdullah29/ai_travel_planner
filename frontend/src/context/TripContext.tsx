import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { SavedTrip, TripPlan, TripPreferences, ConversationEntry } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { tripsApi } from '@/services/apiService'

export interface SearchHistoryEntry {
  id: string
  query: string
  destination?: string
  budget?: number
  currency?: string
  duration?: number
  interests?: string[]
  resultPlanId?: string
  searchedAt: string
}

interface TripContextValue {
  savedTrips: SavedTrip[]
  searchHistory: SearchHistoryEntry[]
  currentPreferences: TripPreferences | null
  currentPlan: TripPlan | null
  isSyncing: boolean
  saveTrip: (plan: TripPlan, conversation?: ConversationEntry[]) => void
  deleteTrip: (id: string) => void
  updateTripStatus: (frontendId: string, status: SavedTrip['status']) => void
  addSearchHistory: (entry: Omit<SearchHistoryEntry, 'id' | 'searchedAt'>) => void
  clearSearchHistory: () => void
  setCurrentPreferences: (prefs: TripPreferences) => void
  setCurrentPlan: (plan: TripPlan | null) => void
}

const TripContext = createContext<TripContextValue | null>(null)

function getCurrentUserId(authUserId?: string): string {
  if (authUserId) return authUserId
  try {
    const stored = localStorage.getItem('travel-buddy-user')
    if (!stored) return 'guest'
    const user = JSON.parse(stored) as { id?: string }
    return user.id ?? 'guest'
  } catch {
    return 'guest'
  }
}

const tripsKey   = (uid: string) => `travel-buddy-trips-${uid}`
const historyKey = (uid: string) => `travel-buddy-history-${uid}`
const planKey    = (uid: string) => `travel-buddy-current-plan-${uid}`

// Reconstruct a SavedTrip from a backend trip record
function backendTripToSaved(bt: {
  id: string
  status: SavedTrip['status']
  createdAt: string
  planData: unknown
}): SavedTrip | null {
  if (!bt.planData || typeof bt.planData !== 'object') return null
  const plan = bt.planData as TripPlan
  if (!plan.id) return null
  return {
    ...plan,
    savedAt: bt.createdAt,
    status: bt.status,
    _backendId: bt.id,
  }
}

export function TripProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const userId = getCurrentUserId(user?.id)

  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>(() => {
    try {
      const stored = localStorage.getItem(tripsKey(userId))
      return stored ? (JSON.parse(stored) as SavedTrip[]) : []
    } catch { return [] }
  })

  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>(() => {
    try {
      const stored = localStorage.getItem(historyKey(userId))
      return stored ? (JSON.parse(stored) as SearchHistoryEntry[]) : []
    } catch { return [] }
  })

  const [currentPlan, setCurrentPlanState] = useState<TripPlan | null>(() => {
    try {
      const stored = localStorage.getItem(planKey(userId))
      return stored ? (JSON.parse(stored) as TripPlan) : null
    } catch { return null }
  })

  const [currentPreferences, setCurrentPreferences] = useState<TripPreferences | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  // ── Persist to localStorage on state changes ─────────────────────────────
  useEffect(() => {
    localStorage.setItem(tripsKey(userId), JSON.stringify(savedTrips))
  }, [savedTrips, userId])

  useEffect(() => {
    localStorage.setItem(historyKey(userId), JSON.stringify(searchHistory))
  }, [searchHistory, userId])

  useEffect(() => {
    if (currentPlan) {
      localStorage.setItem(planKey(userId), JSON.stringify(currentPlan))
    } else {
      localStorage.removeItem(planKey(userId))
    }
  }, [currentPlan, userId])

  // ── Load trips from backend when user logs in ─────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return
    const loadFromBackend = async () => {
      setIsSyncing(true)
      try {
        const backendTrips = await tripsApi.getAll()
        const reconstructed = backendTrips
          .map(bt => backendTripToSaved({
            id: bt.id,
            status: bt.status,
            createdAt: bt.createdAt,
            planData: bt.planData,
          }))
          .filter((t): t is SavedTrip => t !== null)

        // Backend is source of truth — replace state entirely with DB trips
        setSavedTrips(reconstructed)
      } catch {
        // Backend offline — keep localStorage trips
      } finally {
        setIsSyncing(false)
      }
    }
    void loadFromBackend()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id])

  // ── setCurrentPlan ────────────────────────────────────────────────────────
  const setCurrentPlan = useCallback((plan: TripPlan | null) => setCurrentPlanState(plan), [])

  // ── saveTrip ──────────────────────────────────────────────────────────────
  const saveTrip = useCallback((plan: TripPlan, conversation?: ConversationEntry[]) => {
    const savedLocally: SavedTrip = {
      ...plan,
      savedAt: new Date().toISOString(),
      status: 'planned',
      ...(conversation?.length ? { conversation } : {}),
    }

    // Optimistic local update
    setSavedTrips(prev => {
      const idx = prev.findIndex(t => t.id === plan.id)
      if (idx !== -1) {
        const updated = [...prev]
        updated[idx] = { ...savedLocally, _backendId: prev[idx]._backendId }
        return updated
      }
      return [savedLocally, ...prev]
    })

    // Sync to backend if authenticated
    if (isAuthenticated) {
      // Embed conversation in planData so it round-trips through MongoDB
      const planDataWithConversation = conversation?.length
        ? { ...plan, conversation }
        : plan

      tripsApi.create({
        budget: plan.totalCost,
        planData: planDataWithConversation as TripPlan,
      }).then(bt => {
        setSavedTrips(prev =>
          prev.map(t => t.id === plan.id ? { ...t, _backendId: bt.id } : t)
        )
      }).catch(() => { /* sync failed silently, trip still saved locally */ })
    }
  }, [isAuthenticated])

  // ── deleteTrip ────────────────────────────────────────────────────────────
  const deleteTrip = useCallback((id: string) => {
    setSavedTrips(prev => {
      const trip = prev.find(t => t.id === id)
      if (trip?._backendId && isAuthenticated) {
        tripsApi.delete(trip._backendId).catch(() => { /* ignore */ })
      }
      return prev.filter(t => t.id !== id)
    })
  }, [isAuthenticated])

  // ── updateTripStatus ──────────────────────────────────────────────────────
  const updateTripStatus = useCallback((frontendId: string, status: SavedTrip['status']) => {
    setSavedTrips(prev => {
      const trip = prev.find(t => t.id === frontendId)
      if (trip?._backendId && isAuthenticated) {
        tripsApi.updateStatus(trip._backendId, status).catch(() => { /* ignore */ })
      }
      return prev.map(t => t.id === frontendId ? { ...t, status } : t)
    })
  }, [isAuthenticated])

  // ── addSearchHistory ──────────────────────────────────────────────────────
  const addSearchHistory = useCallback((entry: Omit<SearchHistoryEntry, 'id' | 'searchedAt'>) => {
    const newEntry: SearchHistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      searchedAt: new Date().toISOString(),
    }
    setSearchHistory(prev => [newEntry, ...prev].slice(0, 50))
  }, [])

  const clearSearchHistory = useCallback(() => setSearchHistory([]), [])

  return (
    <TripContext.Provider value={{
      savedTrips,
      searchHistory,
      currentPreferences,
      currentPlan,
      isSyncing,
      saveTrip,
      deleteTrip,
      updateTripStatus,
      addSearchHistory,
      clearSearchHistory,
      setCurrentPreferences,
      setCurrentPlan,
    }}>
      {children}
    </TripContext.Provider>
  )
}

export function useTripContext() {
  const ctx = useContext(TripContext)
  if (!ctx) throw new Error('useTripContext must be used within TripProvider')
  return ctx
}
