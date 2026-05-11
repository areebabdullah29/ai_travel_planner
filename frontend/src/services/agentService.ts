import type { TripPlan, TripPreferences, DayPlan, Activity, Restaurant } from '@/types'

const AGENT_BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5000'}/api/agent`

// ── Generic response envelope ─────────────────────────────────────────────
interface AgentEnvelope<T> { success: boolean; data: T }

// ── Destination detail from /api/agent/destinations/{name} ───────────────
interface DestDetail {
  status: string
  destination: string
  country: string
  description: string
  interests: string[]
  highlights: string[]
  best_months: string[]
  months_to_avoid: string[]
  restaurants: Array<{ name: string; cuisine: string; price_tier: string }>
  cost_summary?: {
    budget_per_day_pkr: number
    mid_range_per_day_pkr: number
    luxury_per_day_pkr: number
    flight_from_karachi_pkr: number
  }
  min_trip_budget_pkr: number
}

// ── Cost estimate from /api/agent/estimate-costs ──────────────────────────
interface CostEstimate {
  status: string
  destination: string
  duration_days: number
  travelers: number
  accommodation_tier: string
  currency: string
  breakdown: {
    flights_round_trip: number
    accommodation: number
    meals: number
    activities: number
    local_transport: number
  }
  per_person_total: number
  grand_total: number
  daily_average_per_person: number
}

// ── Agent weather types (exported for Itinerary.tsx) ─────────────────────
export interface WeatherForecastDay {
  date: string
  temp_min: number
  temp_max: number
  conditions: string
  rain_probability: string
  advisory: string
}

export interface AgentWeatherData {
  status: string
  source: string
  city: string
  forecast: WeatherForecastDay[]
}

// ── Structured intake payload streamed from the backend agent ────────────
export interface AgentRequirements {
  origin: string
  destination: string
  duration_days: number
  travelers: number
  interests: string[]
  budget: number
  currency: string
  travel_month?: string
}

// ── PKR conversion rates (for tier selection) ─────────────────────────────
const TO_PKR: Record<string, number> = {
  PKR: 1, USD: 280, EUR: 305, GBP: 355,
  AED: 76, SAR: 75, CAD: 207, AUD: 180, INR: 1 / 3.4, TRY: 9,
}

// ── Session management ────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<string> {
  const res = await fetch(`${AGENT_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  })
  if (!res.ok) throw new Error('Failed to create agent session')
  const json = await res.json() as AgentEnvelope<{ session_id: string; user_id: string }>
  return json.data.session_id
}

export async function deleteSession(sessionId: string, userId = 'anonymous'): Promise<void> {
  await fetch(`${AGENT_BASE}/sessions/${sessionId}?user_id=${userId}`, { method: 'DELETE' })
}

// ── Streaming SSE chat ────────────────────────────────────────────────────
// EventSource cannot POST — we use fetch + ReadableStream for SSE over POST

export async function streamChat(params: {
  message: string
  sessionId?: string
  userId?: string
  signal?: AbortSignal
  onChunk: (text: string) => void
  onSessionId: (id: string) => void
  onRequirementsReady?: (prefs: AgentRequirements) => void
}): Promise<void> {
  const { message, sessionId, userId = 'anonymous', signal, onChunk, onSessionId, onRequirementsReady } = params

  const res = await fetch(`${AGENT_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId ?? null, user_id: userId }),
    signal,
  })

  if (!res.ok) throw new Error(`Agent stream error: ${res.status}`)
  if (!res.body) throw new Error('No response body from agent stream')

  const reader = res.body.getReader()
  // stream: true prevents TextDecoder from flushing incomplete multi-byte sequences
  const decoder = new TextDecoder('utf-8', { fatal: false })
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // SSE events are delimited by double newlines
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''  // keep the incomplete tail for the next read

    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6)

      if (payload === '[DONE]') return

      try {
        const parsed = JSON.parse(payload) as {
          session_id?: string
          chunk?: string
          final?: boolean
          requirements_ready?: boolean
          prefs?: AgentRequirements
        }
        if (parsed.session_id) {
          onSessionId(parsed.session_id)
        } else if (parsed.requirements_ready && parsed.prefs) {
          onRequirementsReady?.(parsed.prefs)
        } else if (parsed.chunk !== undefined) {
          onChunk(parsed.chunk)
        }
      } catch {
        // Ignore malformed JSON events
      }
    }
  }
}

// ── Non-streaming fallback chat ───────────────────────────────────────────

export async function sendChatMessage(
  message: string,
  sessionId?: string,
  userId = 'anonymous',
): Promise<{ reply: string; sessionId: string }> {
  const res = await fetch(`${AGENT_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId ?? null, user_id: userId }),
  })
  if (!res.ok) throw new Error(`Agent chat error: ${res.status}`)
  const json = await res.json() as AgentEnvelope<{ reply: string; session_id: string; agent: string | null }>
  return { reply: json.data.reply, sessionId: json.data.session_id }
}

// ── Data endpoints ────────────────────────────────────────────────────────

export async function fetchDestinationDetails(name: string): Promise<DestDetail | null> {
  try {
    const res = await fetch(`${AGENT_BASE}/destinations/${encodeURIComponent(name)}`)
    if (!res.ok) return null
    const json = await res.json() as AgentEnvelope<DestDetail>
    return json.data
  } catch {
    return null
  }
}

export async function fetchAgentWeather(city: string, days = 5): Promise<AgentWeatherData | null> {
  try {
    const res = await fetch(`${AGENT_BASE}/weather/${encodeURIComponent(city)}?days=${days}`)
    if (!res.ok) return null
    const json = await res.json() as AgentEnvelope<AgentWeatherData>
    return json.data
  } catch {
    return null
  }
}

export async function estimateCosts(params: {
  destination: string
  durationDays: number
  travelers?: number
  accommodationTier?: 'budget' | 'mid_range' | 'luxury'
  currency?: string
  origin?: string
}): Promise<CostEstimate | null> {
  try {
    const { destination, durationDays, travelers = 1, accommodationTier = 'mid_range', currency = 'PKR', origin = '' } = params
    const url =
      `${AGENT_BASE}/estimate-costs` +
      `?destination=${encodeURIComponent(destination)}` +
      `&duration_days=${durationDays}` +
      `&travelers=${travelers}` +
      `&accommodation_tier=${accommodationTier}` +
      `&currency=${currency}` +
      (origin ? `&origin=${encodeURIComponent(origin)}` : '')
    const res = await fetch(url, { method: 'POST' })
    if (!res.ok) return null
    const json = await res.json() as AgentEnvelope<CostEstimate>
    return json.data
  } catch {
    return null
  }
}

// ── Practical info lookup tables ──────────────────────────────────────────

const COUNTRY_LANGUAGE: Record<string, string> = {
  Pakistan: 'Urdu & English', Japan: 'Japanese (English in tourist areas)',
  Thailand: 'Thai (English in tourist zones)', France: 'French (English widely understood)',
  UAE: 'Arabic (English very common)', UK: 'English', Turkey: 'Turkish (English in tourist areas)',
  Indonesia: 'Bahasa Indonesia (English on Bali)', Malaysia: 'Malay & English',
  Singapore: 'English, Mandarin, Malay, Tamil', Spain: 'Spanish (English in tourist areas)',
  Italy: 'Italian (English in cities)', Morocco: 'Arabic & French',
  Vietnam: 'Vietnamese (English in cities)', Egypt: 'Arabic (English in tourist areas)',
  Greece: 'Greek (English in tourist areas)', Nepal: 'Nepali (English widely spoken)',
  Kenya: 'Swahili & English', USA: 'English', Australia: 'English', India: 'Hindi & English',
}

const COUNTRY_TIMEZONE: Record<string, string> = {
  Pakistan: 'PKT (UTC+5)', Japan: 'JST (UTC+9)', Thailand: 'ICT (UTC+7)',
  France: 'CET (UTC+1)', UAE: 'GST (UTC+4)', UK: 'GMT/BST (UTC+0/+1)',
  Turkey: 'TRT (UTC+3)', Indonesia: 'WIB (UTC+7)', Malaysia: 'MYT (UTC+8)',
  Singapore: 'SGT (UTC+8)', Spain: 'CET (UTC+1)', Italy: 'CET (UTC+1)',
  Morocco: 'WET (UTC+0)', Vietnam: 'ICT (UTC+7)', Egypt: 'EET (UTC+2)',
  Greece: 'EET (UTC+2)', Nepal: 'NPT (UTC+5:45)', Kenya: 'EAT (UTC+3)',
  USA: 'EST/PST (UTC-5 to UTC-8)', Australia: 'AEST (UTC+10)', India: 'IST (UTC+5:30)',
}

const COUNTRY_TIPPING: Record<string, string> = {
  Pakistan: 'Not mandatory; 10% appreciated at restaurants',
  Japan: 'Not customary — considered rude in some contexts',
  Thailand: '10–15% at restaurants; round up taxis',
  France: 'Round up or 5–10% at restaurants',
  UAE: '10–15% at restaurants; often included in bill',
  UK: '10–15% at restaurants; not expected elsewhere',
  Turkey: '10–15% at restaurants; small tip for guides',
  Indonesia: '10% at restaurants; small tips for guides and drivers',
  Malaysia: '10% service charge often added; rounding up is fine',
  Singapore: '10% service charge usually included',
  Spain: '5–10% at restaurants; rounding up is common',
  Italy: '5–10% at restaurants; rounding up is fine',
  Morocco: '10–15% at restaurants; guides expect a tip',
  Vietnam: 'Tipping not mandatory but appreciated; 10% is generous',
  Egypt: 'Tipping (baksheesh) is customary — 10–15% at restaurants',
  Greece: '5–10% at restaurants; rounding up is common',
  Nepal: '10% at restaurants; guides and porters expect tips',
  Kenya: '10–15% at restaurants; guides and drivers expect tips',
  USA: '15–20% at restaurants — nearly mandatory',
  Australia: 'Not mandatory; 10% for good service is appreciated',
  India: '10% at restaurants; small tips for hotel staff',
}

// ── Accommodation tier selection ──────────────────────────────────────────

function selectTier(budget: number, currency: string, days: number): 'budget' | 'mid_range' | 'luxury' {
  const budgetPKR = Math.round(budget * (TO_PKR[currency] ?? 1))
  const perDayPKR = budgetPKR / days
  if (perDayPKR < 8000) return 'budget'
  if (perDayPKR > 25000) return 'luxury'
  return 'mid_range'
}

// ── Build itinerary from destination data ─────────────────────────────────

function buildItinerary(
  highlights: string[],
  destData: DestDetail | null,
  durationDays: number,
  budget: number,
  currency: string,
): DayPlan[] {
  const hl = highlights.length > 0 ? highlights : [`Explore the city`, `Cultural tour`, `Local markets`, `Sightseeing`, `Free day`]
  const restaurants = destData?.restaurants ?? []
  const activityBudgetPerHalf = Math.round((budget * 0.12) / durationDays / 2)
  const dayBudget = Math.round(budget / durationDays)

  const dayTitleTemplates = [
    'Arrival & First Impressions', 'Iconic Landmarks & City Highlights',
    'Cultural Immersion Day', 'Food, Markets & Local Experiences',
    'Adventure & Exploration', 'Hidden Gems & Day Trips', 'Leisure & Shopping Day',
    'Final Highlights & Departure Prep',
  ]

  return Array.from({ length: durationDays }, (_, i): DayPlan => {
    const morning: Activity = {
      name: hl[(i * 2) % hl.length],
      time: '09:00',
      duration: '3 hours',
      cost: activityBudgetPerHalf,
      description: `Explore ${hl[(i * 2) % hl.length]} — a must-see highlight of the destination.`,
      category: 'Sightseeing',
    }
    const evening: Activity = {
      name: hl[(i * 2 + 1) % hl.length],
      time: '15:00',
      duration: '2.5 hours',
      cost: activityBudgetPerHalf,
      description: `Discover ${hl[(i * 2 + 1) % hl.length]} and soak in the local atmosphere.`,
      category: 'Culture',
    }

    const dinner = restaurants[i % restaurants.length]?.name ?? 'Local restaurant'
    const tier = selectTier(budget, currency, durationDays)
    const hotelLabel = tier === 'luxury' ? 'Luxury hotel (5★)' : tier === 'mid_range' ? 'Comfortable hotel (4★)' : 'Budget guesthouse (3★)'

    return {
      day: i + 1,
      title: dayTitleTemplates[i % dayTitleTemplates.length],
      activities: [morning, evening],
      meals: {
        breakfast: i === 0 ? 'Welcome breakfast at hotel' : 'Local café breakfast',
        lunch: 'Recommended local restaurant (see Restaurants tab)',
        dinner,
      },
      accommodation: hotelLabel,
      estimatedCost: dayBudget,
    }
  })
}

// ── Build restaurant list from destination data ───────────────────────────

function buildRestaurants(destData: DestDetail | null, destination: string): Restaurant[] {
  if (destData?.restaurants && destData.restaurants.length > 0) {
    return destData.restaurants.map(r => ({
      name: r.name,
      cuisine: r.cuisine,
      priceRange: r.price_tier === 'budget' ? '$' : r.price_tier === 'luxury' ? '$$$' : '$$',
      rating: 4.3,
      specialty: `Signature ${r.cuisine} dishes`,
      location: `${destination} city center`,
    }))
  }
  return [
    { name: `${destination} Kitchen`, cuisine: 'Local', priceRange: '$$', rating: 4.4, specialty: 'Traditional local cuisine', location: `${destination} old town` },
    { name: `Street Food Market`, cuisine: 'Street Food', priceRange: '$', rating: 4.6, specialty: 'Local street snacks and specialties', location: `${destination} market area` },
  ]
}

// ── Cost breakdown (real data or percentage fallback) ─────────────────────

function buildCostBreakdown(
  costData: CostEstimate | null,
  budget: number,
): { flights: number; accommodation: number; food: number; activities: number; transport: number; miscellaneous: number } {
  if (costData) {
    const { flights_round_trip, accommodation, meals, activities, local_transport } = costData.breakdown
    const fixed = flights_round_trip + accommodation + meals + activities + local_transport
    return {
      flights: flights_round_trip,
      accommodation,
      food: meals,
      activities,
      transport: local_transport,
      miscellaneous: Math.max(0, budget - fixed),
    }
  }
  // Percentage fallback when estimate-costs fails
  return {
    flights: Math.round(budget * 0.30),
    accommodation: Math.round(budget * 0.30),
    food: Math.round(budget * 0.18),
    activities: Math.round(budget * 0.12),
    transport: Math.round(budget * 0.06),
    miscellaneous: Math.round(budget * 0.04),
  }
}

// ── Agent-powered plan generation (single endpoint, Gemini + Google Search) ──

export async function generatePlan(params: {
  destination: string
  durationDays: number
  budget: number
  currency: string
  interests: string[]
  travelStyle: string
  groupType: string
  origin?: string
  travelers?: number
  travelMonth?: string
}): Promise<TripPlan> {
  const {
    destination, durationDays, budget, currency, interests,
    travelStyle, groupType, origin = '', travelers = 1, travelMonth = '',
  } = params

  const query = new URLSearchParams({
    destination,
    duration_days: String(durationDays),
    travelers: String(travelers),
    currency,
    origin,
    budget: String(budget),
    interests: interests.join(', '),
    travel_style: travelStyle,
    group_type: groupType,
    travel_month: travelMonth,
  })

  const res = await fetch(`${AGENT_BASE}/generate-plan?${query.toString()}`, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(err.detail ?? `Plan generation failed: ${res.status}`)
  }

  const json = await res.json() as AgentEnvelope<TripPlan>
  return json.data
}

// ── Fallback plan builder (template-based, used if generate-plan fails) ──────

export async function buildTripPlanFromAgent(params: {
  destination: string
  durationDays: number
  budget: number
  currency: string
  interests: string[]
  travelStyle: string
  groupType: string
  origin?: string
  travelers?: number
}): Promise<TripPlan> {
  const { destination, durationDays, budget, currency, interests, travelStyle, groupType, origin = '', travelers = 1 } = params

  const tier = selectTier(budget, currency, durationDays)

  const [costData, destData] = await Promise.all([
    estimateCosts({ destination, durationDays, currency, accommodationTier: tier, origin, travelers }),
    fetchDestinationDetails(destination),
  ])

  const country = destData?.country ?? destination.split(',')[1]?.trim() ?? destination
  const highlights = destData?.highlights?.length ? destData.highlights : [`Explore ${destination}`, `Cultural tour`, `Local cuisine`, `Scenic viewpoints`, `Free exploration`]
  const bestTime = destData?.best_months?.length ? destData.best_months.slice(0, 3).join(', ') : 'Year-round'

  const costBreakdown = buildCostBreakdown(costData, budget)
  const itinerary = buildItinerary(highlights, destData, durationDays, budget, currency)
  const restaurants = buildRestaurants(destData, destData?.destination ?? destination)

  const practicalInfo = {
    language: COUNTRY_LANGUAGE[country] ?? 'Local language (English in tourist areas)',
    timezone: COUNTRY_TIMEZONE[country] ?? 'Local time — check before travel',
    currency,
    tipping: COUNTRY_TIPPING[country] ?? 'Check local customs — typically 5–15% at restaurants',
    transportation: 'Local taxis, ride-sharing apps, and public transport',
  }

  // Use real grand_total from estimate if available; fall back to budget
  const realTotal = costData?.grand_total ?? budget
  const totalCost = realTotal > 0 ? realTotal : budget

  const preferences: TripPreferences = {
    budget, currency, duration: durationDays, interests,
    weather: 'mild', travelStyle,
    departureCity: origin || 'Your city',
    groupType, travelers,
  }

  return {
    id: crypto.randomUUID(),
    destination: destData?.destination ?? destination,
    country,
    duration: durationDays,
    totalCost,
    currency,
    highlights,
    bestTime,
    itinerary,
    restaurants,
    practicalInfo,
    costBreakdown,
    createdAt: new Date().toISOString(),
    preferences,
  }
}
