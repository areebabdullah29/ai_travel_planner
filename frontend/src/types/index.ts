export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface TripPreferences {
  budget: number
  currency: string
  duration: number
  interests: string[]
  weather: string
  travelStyle: string
  departureCity: string
  groupType: string
}

export interface Activity {
  name: string
  time: string
  duration: string
  cost: number
  description: string
  category: string
}

export interface DayPlan {
  day: number
  date?: string
  title: string
  activities: Activity[]
  meals: { breakfast?: string; lunch?: string; dinner?: string }
  accommodation?: string
  estimatedCost: number
}

export interface Restaurant {
  name: string
  cuisine: string
  priceRange: string
  rating: number
  specialty: string
  location: string
}

export interface TripPlan {
  id: string
  destination: string
  country: string
  duration: number
  totalCost: number
  currency: string
  highlights: string[]
  bestTime: string
  itinerary: DayPlan[]
  restaurants: Restaurant[]
  practicalInfo: {
    language: string
    timezone: string
    currency: string
    tipping: string
    transportation: string
  }
  costBreakdown: {
    flights: number
    accommodation: number
    food: number
    activities: number
    transport: number
    miscellaneous: number
  }
  coverImage?: string
  createdAt: string
  preferences: TripPreferences
}

export interface ConversationEntry {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface SavedTrip extends TripPlan {
  savedAt: string
  status: 'planned' | 'ongoing' | 'completed'
  _backendId?: string  // MongoDB _id from backend, used for sync operations
  conversation?: ConversationEntry[]
}
