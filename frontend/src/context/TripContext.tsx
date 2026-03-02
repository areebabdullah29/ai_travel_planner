import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { SavedTrip, TripPlan, TripPreferences } from '@/types'

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
  saveTrip: (plan: TripPlan) => void
  deleteTrip: (id: string) => void
  addSearchHistory: (entry: Omit<SearchHistoryEntry, 'id' | 'searchedAt'>) => void
  clearSearchHistory: () => void
  setCurrentPreferences: (prefs: TripPreferences) => void
  setCurrentPlan: (plan: TripPlan | null) => void
}

const TripContext = createContext<TripContextValue | null>(null)

function getCurrentUserId(): string {
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

export function TripProvider({ children }: { children: ReactNode }) {
  const userId = getCurrentUserId()

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

  // currentPlan is persisted to localStorage so it survives page refreshes
  const [currentPlan, setCurrentPlanState] = useState<TripPlan | null>(() => {
    try {
      const stored = localStorage.getItem(planKey(userId))
      return stored ? (JSON.parse(stored) as TripPlan) : null
    } catch { return null }
  })

  const [currentPreferences, setCurrentPreferences] = useState<TripPreferences | null>(null)

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

  const setCurrentPlan = (plan: TripPlan | null) => setCurrentPlanState(plan)

  const saveTrip = (plan: TripPlan) => {
    const saved: SavedTrip = {
      ...plan,
      savedAt: new Date().toISOString(),
      status: 'planned',
    }
    setSavedTrips(prev => {
      const exists = prev.findIndex(t => t.id === plan.id)
      if (exists !== -1) {
        const updated = [...prev]
        updated[exists] = saved
        return updated
      }
      return [saved, ...prev]
    })
  }

  const deleteTrip = (id: string) => {
    setSavedTrips(prev => prev.filter(t => t.id !== id))
  }

  const addSearchHistory = useCallback((entry: Omit<SearchHistoryEntry, 'id' | 'searchedAt'>) => {
    const newEntry: SearchHistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      searchedAt: new Date().toISOString(),
    }
    setSearchHistory(prev => [newEntry, ...prev].slice(0, 50))
  }, [])

  const clearSearchHistory = () => setSearchHistory([])

  return (
    <TripContext.Provider value={{
      savedTrips, searchHistory, currentPreferences, currentPlan,
      saveTrip, deleteTrip, addSearchHistory, clearSearchHistory,
      setCurrentPreferences, setCurrentPlan,
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
