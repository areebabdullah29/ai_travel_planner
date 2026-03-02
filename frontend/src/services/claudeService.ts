import type { TripPlan, TripPreferences } from '@/types'
import destinationsData from '@/data/destinations.json'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ── Destination types ──────────────────────────────────────────────────────
interface DestActivity {
  name: string
  time: string
  duration: string
  costPKR: number
  category: string
  description: string
  slot: string
}

interface DestHotel {
  name: string
  stars: number
  pricePerNightPKR: number
  description: string
}

interface DestRestaurant {
  name: string
  cuisine: string
  priceRange: string
  rating: number
  specialty: string
  location: string
}

interface Destination {
  id: string
  name: string
  country: string
  aliases: string[]
  type: string
  region: string
  baseCostPKR: number
  weather: string
  best_season: string
  language: string
  timezone: string
  tipping: string
  transportation: string
  safety_rating: number
  user_rating: number
  highlights: string[]
  dayTitles: string[]
  activities: DestActivity[]
  hotels: DestHotel[]
  restaurants: DestRestaurant[]
}

const destinations = destinationsData as Destination[]

// ── Find a destination by name (fuzzy alias match) ─────────────────────────
export function findDestination(name: string): Destination | null {
  if (!name) return null
  const lower = name.toLowerCase()
  return (
    destinations.find(d =>
      d.name.toLowerCase() === lower ||
      d.aliases.some(a => lower.includes(a) || a.includes(lower.split(',')[0].trim()))
    ) ?? null
  )
}

// ── Content-based recommendation (simple scoring) ─────────────────────────
export function recommendDestinations(
  interests: string[],
  budget: number,
  currency: string,
  maxResults = 4
): Destination[] {
  const pkrBudget = currency === 'PKR' ? budget
    : currency === 'USD' ? budget * 280
    : currency === 'GBP' ? budget * 355
    : currency === 'EUR' ? budget * 305
    : currency === 'AED' ? budget * 76
    : currency === 'SAR' ? budget * 75
    : currency === 'INR' ? budget * 3.4
    : currency === 'CAD' ? budget * 207
    : currency === 'AUD' ? budget * 180
    : budget * 100

  const interestKeywords: Record<string, string[]> = {
    adventure:   ['Adventure', 'trekking', 'hiking', 'mountains', 'extreme'],
    relaxation:  ['Relaxation', 'beach', 'spa', 'resort', 'leisure'],
    culture:     ['Cultural', 'Historical', 'museums', 'heritage', 'temples'],
    food:        ['food', 'cuisine', 'dining', 'restaurants', 'street food'],
    family:      ['Family', 'kids', 'parks', 'cable car', 'safe'],
    luxury:      ['Luxury', 'premium', 'five star', 'fine dining'],
    nature:      ['nature', 'wildlife', 'forests', 'lakes', 'parks'],
    photography: ['photography', 'sightseeing', 'views', 'scenic'],
  }

  const scored = destinations.map(dest => {
    let score = 0
    // Budget fit (prefers destinations where budget covers the base cost)
    if (pkrBudget >= dest.baseCostPKR) score += 30
    else if (pkrBudget >= dest.baseCostPKR * 0.7) score += 15
    // Interest match
    interests.forEach(interest => {
      const keywords = interestKeywords[interest.toLowerCase()] ?? [interest]
      keywords.forEach(kw => {
        if (dest.type.toLowerCase().includes(kw.toLowerCase())) score += 20
        if (dest.activities.some(a =>
          a.category.toLowerCase().includes(kw.toLowerCase()) ||
          a.name.toLowerCase().includes(kw.toLowerCase())
        )) score += 10
      })
    })
    // Boost Pakistani destinations for PKR users
    if (currency === 'PKR' && dest.country === 'Pakistan') score += 10
    // User rating bonus
    score += dest.user_rating * 3
    return { dest, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.dest)
}

// ── Send a message to the backend which calls Claude API ───────────────────
export async function sendChatMessage(
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  })
  if (!response.ok) throw new Error('Failed to get response from AI')
  const data = await response.json()
  return data.response as string
}

// ── Generate a full trip plan (backend) ───────────────────────────────────
export async function generateTripPlan(preferences: TripPreferences): Promise<TripPlan> {
  const response = await fetch(`${API_URL}/api/generate-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences),
  })
  if (!response.ok) throw new Error('Failed to generate trip plan')
  return response.json() as Promise<TripPlan>
}

// ── System prompt ──────────────────────────────────────────────────────────
export const TRAVEL_SYSTEM_PROMPT = `You are TravelBuddy, an enthusiastic and knowledgeable AI travel planning assistant. Your goal is to help users plan their perfect trip through a friendly conversation.

You should:
1. Greet the user warmly and ask about their dream destination or travel preferences
2. Gather information naturally through conversation:
   - Destination or region of interest
   - Budget (total or daily budget — use the user's selected currency, default PKR)
   - Trip duration (number of days)
   - Travel interests (adventure, relaxation, culture, food, photography, etc.)
   - Preferred weather/season
   - Group type (solo, couple, family, friends)
   - Departure city/country

3. Once you have enough information (at least budget, duration, and interests), offer to generate a detailed trip plan
4. Be enthusiastic, use travel-related emojis occasionally, and give helpful tips
5. When the user is ready for a full plan, output a JSON object wrapped in \`\`\`json code blocks with this exact structure:

{
  "readyToGenerate": true,
  "preferences": {
    "budget": <number>,
    "currency": "<string>",
    "duration": <number>,
    "interests": ["<interest1>", "<interest2>"],
    "weather": "<string>",
    "travelStyle": "<string>",
    "departureCity": "<string>",
    "groupType": "<string>"
  },
  "suggestedDestination": "<destination name>"
}

Keep responses conversational and not too long. Ask one or two questions at a time.`

// ── Parse preferences from AI response ────────────────────────────────────
export function parsePreferencesFromResponse(content: string): {
  readyToGenerate: boolean
  preferences?: TripPreferences
  suggestedDestination?: string
} {
  const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/)
  if (!jsonMatch) return { readyToGenerate: false }
  try {
    const parsed = JSON.parse(jsonMatch[1]) as {
      readyToGenerate?: boolean
      preferences?: TripPreferences
      suggestedDestination?: string
    }
    return {
      readyToGenerate: parsed.readyToGenerate ?? false,
      preferences: parsed.preferences,
      suggestedDestination: parsed.suggestedDestination,
    }
  } catch {
    return { readyToGenerate: false }
  }
}

// ── Currency conversion helper ─────────────────────────────────────────────
function pkrToDisplay(pkrAmount: number, currency: string): number {
  const rates: Record<string, number> = {
    PKR: 1, USD: 1 / 280, EUR: 1 / 305, GBP: 1 / 355,
    AED: 1 / 76, SAR: 1 / 75, CAD: 1 / 207, AUD: 1 / 180,
    INR: 3.4, TRY: 1 / 9,
  }
  return Math.round(pkrAmount * (rates[currency] ?? 1))
}

// ── Mock plan generator — uses destinations.json ───────────────────────────
export function generateMockPlan(preferences: TripPreferences, destinationName?: string): TripPlan {
  const currency = preferences.currency || 'PKR'
  const days = preferences.duration || 7
  const dest = findDestination(destinationName ?? '') ?? destinations[0]

  // Scale base cost: destination's 5-day base → user's duration
  const basePKR = dest.baseCostPKR
  const totalPKR = Math.round(basePKR * (days / 5))
  const totalCost = preferences.budget ?? pkrToDisplay(totalPKR, currency)

  // Pick a hotel (prefer mid-range)
  const hotel = dest.hotels[1] ?? dest.hotels[0]
  const hotelNightsPKR = hotel.pricePerNightPKR * days
  const hotelCost = pkrToDisplay(hotelNightsPKR, currency)

  // Distribute activities across days (cycle through the list)
  const actPool = dest.activities
  const itinerary = Array.from({ length: days }, (_, i) => {
    const morningAct = actPool[(i * 2) % actPool.length]
    const eveningAct = actPool[(i * 2 + 1) % actPool.length]
    const dayBudgetPKR = totalPKR / days
    const morningCostDisplay = pkrToDisplay(morningAct.costPKR, currency)
    const eveningCostDisplay = pkrToDisplay(eveningAct.costPKR, currency)

    return {
      day: i + 1,
      title: dest.dayTitles[i % dest.dayTitles.length],
      activities: [
        {
          name: morningAct.name,
          time: morningAct.time,
          duration: morningAct.duration,
          cost: morningCostDisplay,
          description: morningAct.description,
          category: morningAct.category,
        },
        {
          name: eveningAct.name,
          time: eveningAct.time,
          duration: eveningAct.duration,
          cost: eveningCostDisplay,
          description: eveningAct.description,
          category: eveningAct.category,
        },
      ],
      meals: {
        breakfast: i === 0 ? 'Complimentary hotel breakfast' : 'Local café breakfast',
        lunch: 'Recommended local restaurant (see Restaurants tab)',
        dinner: dest.restaurants[i % dest.restaurants.length]?.name ?? 'Local restaurant',
      },
      accommodation: `${hotel.name} (${hotel.stars}★)`,
      estimatedCost: pkrToDisplay(dayBudgetPKR, currency),
    }
  })

  // Cost breakdown
  const flightCost   = pkrToDisplay(Math.round(totalPKR * 0.30), currency)
  const foodCost     = pkrToDisplay(Math.round(totalPKR * 0.18), currency)
  const activCost    = pkrToDisplay(Math.round(totalPKR * 0.15), currency)
  const transportCost = pkrToDisplay(Math.round(totalPKR * 0.07), currency)
  const miscCost     = pkrToDisplay(Math.round(totalPKR * 0.05), currency)

  // Map restaurants to display format
  const restaurants = dest.restaurants.map(r => ({
    name: r.name,
    cuisine: r.cuisine,
    priceRange: r.priceRange === 'Budget' ? '$' : r.priceRange === 'Mid-range' ? '$$' : '$$$',
    rating: r.rating,
    specialty: r.specialty,
    location: r.location,
  }))

  return {
    id: crypto.randomUUID(),
    destination: dest.name,
    country: dest.country,
    duration: days,
    totalCost,
    currency,
    highlights: dest.highlights,
    bestTime: dest.best_season,
    itinerary,
    restaurants,
    practicalInfo: {
      language: dest.language,
      timezone: dest.timezone,
      currency,
      tipping: dest.tipping,
      transportation: dest.transportation,
    },
    costBreakdown: {
      flights: flightCost,
      accommodation: hotelCost,
      food: foodCost,
      activities: activCost,
      transport: transportCost,
      miscellaneous: miscCost,
    },
    createdAt: new Date().toISOString(),
    preferences,
  }
}
