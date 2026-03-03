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

// ── Generic destination builder (for cities not in destinations.json) ───────
function buildGenericDestination(name: string, preferences: TripPreferences): Destination {
  const parts = name.split(',')
  const city = parts[0].trim()
  const country = parts[1]?.trim() || city
  const style = (preferences.travelStyle || 'Mixed').toLowerCase()

  const adventureActs: DestActivity[] = [
    { name: `${city} Guided Hiking Trail`, time: '08:00', duration: '4 hours', costPKR: 3500, category: 'Adventure', description: `Guided trek through ${country}'s stunning natural landscapes with panoramic views`, slot: 'morning' },
    { name: `${city} Nature & Wildlife Tour`, time: '14:00', duration: '3 hours', costPKR: 4200, category: 'Adventure', description: `Explore ${city}'s scenic nature reserves and spot local wildlife with an expert guide`, slot: 'afternoon' },
    { name: `${city} Rock Climbing & Rappelling`, time: '09:00', duration: '3 hours', costPKR: 5000, category: 'Adventure', description: `Beginner-friendly rock climbing experience at ${city}'s famous cliffs and natural formations`, slot: 'morning' },
    { name: `${city} White-water Rafting`, time: '10:00', duration: '3 hours', costPKR: 6000, category: 'Adventure', description: `Thrilling rafting experience on ${country}'s scenic rivers — suitable for beginners`, slot: 'morning' },
    { name: `${city} Sunset Viewpoint Trek`, time: '16:00', duration: '2.5 hours', costPKR: 1500, category: 'Adventure', description: `Evening hike to the best viewpoint above ${city} for golden hour and sunset panoramas`, slot: 'evening' },
    { name: `${city} Local Village Walk`, time: '10:00', duration: '2 hours', costPKR: 1000, category: 'Culture', description: `Walk through traditional villages near ${city} and experience local rural life`, slot: 'morning' },
    { name: `${city} Night Market & Street Food`, time: '18:00', duration: '2.5 hours', costPKR: 2000, category: 'Food', description: `Explore ${city}'s vibrant night market — street food, local crafts, and live entertainment`, slot: 'evening' },
    { name: `${city} Zipline & Canopy Tour`, time: '13:00', duration: '2 hours', costPKR: 5600, category: 'Adventure', description: `Soar above ${city}'s canopy on a thrilling zipline experience with bird's-eye views`, slot: 'afternoon' },
  ]
  const culturalActs: DestActivity[] = [
    { name: `${city} Old Town Heritage Walk`, time: '09:00', duration: '3 hours', costPKR: 2000, category: 'Sightseeing', description: `Guided walk through ${city}'s historic quarter — ancient streets, colonial buildings, and hidden gems`, slot: 'morning' },
    { name: `${city} National Museum Visit`, time: '10:00', duration: '2.5 hours', costPKR: 1500, category: 'Culture', description: `Explore ${city}'s premier museum showcasing ${country}'s rich history, art, and cultural heritage`, slot: 'morning' },
    { name: `${city} Sacred Temples & Shrines`, time: '08:30', duration: '3 hours', costPKR: 1000, category: 'Culture', description: `Visit the most sacred temples and spiritual sites in and around ${city} with a local guide`, slot: 'morning' },
    { name: `${city} Traditional Cooking Class`, time: '11:00', duration: '3 hours', costPKR: 4000, category: 'Food', description: `Learn to cook authentic ${country} dishes from a local chef — ingredients, technique, and history`, slot: 'morning' },
    { name: `${city} Cultural Evening Show`, time: '19:00', duration: '2 hours', costPKR: 3500, category: 'Entertainment', description: `Traditional dance, music, and cultural performance showcasing ${country}'s artistic heritage`, slot: 'evening' },
    { name: `${city} Street Food Walk`, time: '18:00', duration: '2 hours', costPKR: 2000, category: 'Food', description: `Sample authentic local cuisine from ${city}'s famous food stalls and busy night market`, slot: 'evening' },
    { name: `${city} Palace & Royal Site Tour`, time: '09:00', duration: '2.5 hours', costPKR: 2500, category: 'Sightseeing', description: `Tour the magnificent royal palace or iconic historic landmark that defines ${city}'s skyline`, slot: 'morning' },
    { name: `${city} Bazaar & Local Shopping`, time: '15:00', duration: '2 hours', costPKR: 500, category: 'Shopping', description: `Browse ${city}'s colorful bazaar for unique souvenirs, handcrafts, and local specialties`, slot: 'afternoon' },
  ]
  const relaxActs: DestActivity[] = [
    { name: `${city} Beach & Waterfront Day`, time: '09:00', duration: '5 hours', costPKR: 2000, category: 'Relaxation', description: `Relax on ${city}'s beautiful beaches or scenic waterfront with crystal-clear water and golden sand`, slot: 'morning' },
    { name: `${city} Spa & Wellness Treatment`, time: '14:00', duration: '2.5 hours', costPKR: 5000, category: 'Relaxation', description: `Indulge in traditional ${country} spa treatments and therapeutic massages at a luxury wellness center`, slot: 'afternoon' },
    { name: `${city} Sunset Boat Cruise`, time: '17:00', duration: '2 hours', costPKR: 4000, category: 'Relaxation', description: `Romantic sunset cruise along ${city}'s stunning coastline with drinks and panoramic sea views`, slot: 'evening' },
    { name: `${city} Snorkeling & Marine Tour`, time: '10:00', duration: '3 hours', costPKR: 5000, category: 'Adventure', description: `Explore vibrant coral reefs and colorful marine life just off the coast of ${city}`, slot: 'morning' },
    { name: `${city} Yoga & Meditation Retreat`, time: '07:00', duration: '1.5 hours', costPKR: 2000, category: 'Wellness', description: `Start each day with sunrise yoga and guided meditation in ${city}'s most scenic outdoor setting`, slot: 'morning' },
    { name: `${city} Island Hopping Tour`, time: '09:00', duration: '6 hours', costPKR: 7000, category: 'Relaxation', description: `Full-day boat tour visiting the beautiful surrounding islands and hidden coves near ${city}`, slot: 'morning' },
    { name: `${city} Local Market Morning`, time: '08:00', duration: '2 hours', costPKR: 1500, category: 'Culture', description: `Morning visit to ${city}'s fresh local market — tropical fruits, spices, and artisanal products`, slot: 'morning' },
    { name: `${city} Seafood Dinner by the Water`, time: '19:00', duration: '2 hours', costPKR: 3500, category: 'Food', description: `Fresh seafood dinner at ${city}'s best waterfront restaurant with ocean views and local wine`, slot: 'evening' },
  ]

  const acts = style.includes('adventure') ? adventureActs : style.includes('relax') || style.includes('beach') ? relaxActs : culturalActs

  return {
    id: `generic-${city.toLowerCase().replace(/\s+/g, '-')}`,
    name: city,
    country,
    aliases: [city.toLowerCase(), country.toLowerCase()],
    type: style.includes('adventure') ? 'Adventure' : style.includes('relax') || style.includes('beach') ? 'Relaxation' : style.includes('luxury') ? 'Luxury' : 'Cultural',
    region: country,
    baseCostPKR: 120000,
    weather: 'Varies by season — check local forecast before travel',
    best_season: 'Year-round depending on preference',
    language: 'Local language (English widely spoken in tourist areas)',
    timezone: 'Local time — check before travel',
    tipping: 'Check local customs — typically 5-15% at restaurants',
    transportation: 'Taxis, ride-sharing apps, public transport, and walking',
    safety_rating: 4.0,
    user_rating: 4.3,
    highlights: [
      `Explore ${city}'s most iconic landmarks and hidden gems`,
      `Immerse yourself in authentic ${country} culture and traditions`,
      `Experience world-class cuisine and local street food`,
      `Create unforgettable memories in one of ${country}'s finest destinations`,
    ],
    dayTitles: [
      `Arrival & ${city} Orientation`,
      `Iconic Landmarks & City Highlights`,
      `Cultural Immersion Day`,
      `Food, Markets & Local Experiences`,
      `Adventure & Exploration`,
      `Relaxation & Free Exploration`,
      `Departure Day`,
    ],
    activities: acts,
    hotels: [
      { name: `${city} Grand Hotel`, stars: 5, pricePerNightPKR: 25000, description: `Premium hotel with excellent facilities and central location in ${city}` },
      { name: `${city} Central Hotel`, stars: 4, pricePerNightPKR: 12000, description: `Comfortable mid-range hotel in the heart of ${city} with great amenities` },
      { name: `${city} Budget Inn`, stars: 3, pricePerNightPKR: 5500, description: `Clean and affordable accommodation perfect for budget travelers` },
    ],
    restaurants: [
      { name: `${city} Traditional Kitchen`, cuisine: `Authentic ${country}`, priceRange: 'Mid-range', rating: 4.5, specialty: `Signature local dishes and traditional ${country} cuisine`, location: `${city} city center` },
      { name: `${city} Street Food Market`, cuisine: 'Street Food', priceRange: 'Budget', rating: 4.6, specialty: `Variety of local street snacks and ${country} specialties`, location: `${city} old town` },
      { name: `The ${city} Bistro`, cuisine: 'International & Local', priceRange: 'Mid-range', rating: 4.4, specialty: `Creative fusion of local flavors and international favorites`, location: `Tourist district, ${city}` },
      { name: `${city} Night Market`, cuisine: 'Various', priceRange: 'Budget', rating: 4.7, specialty: `Best variety of ${country} dishes all in one place`, location: `${city} night market` },
    ],
  }
}

// ── Mock plan generator — uses destinations.json ───────────────────────────
export function generateMockPlan(preferences: TripPreferences, destinationName?: string): TripPlan {
  const currency = preferences.currency || 'PKR'
  const days = preferences.duration || 7
  const found = findDestination(destinationName ?? '')
  const dest = found ?? (destinationName?.trim() ? buildGenericDestination(destinationName, preferences) : destinations[0])

  // Currency → PKR conversion rates
  const toPKR: Record<string, number> = {
    PKR: 1, USD: 280, EUR: 305, GBP: 355,
    AED: 76, SAR: 75, CAD: 207, AUD: 180, INR: 1 / 3.4, TRY: 9,
  }

  // Use user's stated budget as the single source of truth for ALL cost calculations.
  // If no budget provided, fall back to destination's base cost scaled by duration.
  const destBasePKR = Math.round(dest.baseCostPKR * (days / 5))
  const userBudgetPKR = preferences.budget
    ? Math.round(preferences.budget * (toPKR[currency] ?? 1))
    : destBasePKR

  // totalCost shown in the UI = user's exact stated amount (no rounding surprise)
  const totalCost = preferences.budget ?? pkrToDisplay(destBasePKR, currency)

  // Pick hotel tier based on per-day budget
  const perDayPKR = userBudgetPKR / days
  const hotel = perDayPKR > 30000
    ? (dest.hotels[0] ?? dest.hotels[1])          // luxury
    : perDayPKR > 12000
      ? (dest.hotels[1] ?? dest.hotels[0])         // mid-range
      : (dest.hotels[2] ?? dest.hotels[1] ?? dest.hotels[0]) // budget

  // Budget allocation percentages (must sum to 1.0)
  const PCT = { flights: 0.30, accommodation: 0.30, food: 0.18, activities: 0.12, transport: 0.06, misc: 0.04 }

  const hotelCostPKR   = Math.round(userBudgetPKR * PCT.accommodation)
  const flightCostPKR  = Math.round(userBudgetPKR * PCT.flights)
  const foodCostPKR    = Math.round(userBudgetPKR * PCT.food)
  const activCostPKR   = Math.round(userBudgetPKR * PCT.activities)
  const transportPKR   = Math.round(userBudgetPKR * PCT.transport)
  const miscPKR        = Math.round(userBudgetPKR * PCT.misc)

  // Scale activity costs proportionally to the user's budget
  const budgetRatio = userBudgetPKR / (destBasePKR || 1)

  // Distribute activities across days (cycle through the list)
  const actPool = dest.activities
  const itinerary = Array.from({ length: days }, (_, i) => {
    const morningAct = actPool[(i * 2) % actPool.length]
    const eveningAct = actPool[(i * 2 + 1) % actPool.length]
    const morningCostDisplay = pkrToDisplay(Math.round(morningAct.costPKR * Math.min(budgetRatio, 3)), currency)
    const eveningCostDisplay = pkrToDisplay(Math.round(eveningAct.costPKR * Math.min(budgetRatio, 3)), currency)
    const dayBudgetDisplay   = pkrToDisplay(Math.round(userBudgetPKR / days), currency)

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
      estimatedCost: dayBudgetDisplay,
    }
  })

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
    restaurants: dest.restaurants.map(r => ({
      name: r.name,
      cuisine: r.cuisine,
      priceRange: r.priceRange === 'Budget' ? '$' : r.priceRange === 'Mid-range' ? '$$' : '$$$',
      rating: r.rating,
      specialty: r.specialty,
      location: r.location,
    })),
    practicalInfo: {
      language: dest.language,
      timezone: dest.timezone,
      currency,
      tipping: dest.tipping,
      transportation: dest.transportation,
    },
    costBreakdown: {
      flights:       pkrToDisplay(flightCostPKR, currency),
      accommodation: pkrToDisplay(hotelCostPKR, currency),
      food:          pkrToDisplay(foodCostPKR, currency),
      activities:    pkrToDisplay(activCostPKR, currency),
      transport:     pkrToDisplay(transportPKR, currency),
      miscellaneous: pkrToDisplay(miscPKR, currency),
    },
    createdAt: new Date().toISOString(),
    preferences,
  }
}
