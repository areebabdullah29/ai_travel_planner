import destinationsData from '@/data/destinations.json'

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
    if (pkrBudget >= dest.baseCostPKR) score += 30
    else if (pkrBudget >= dest.baseCostPKR * 0.7) score += 15
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
    if (currency === 'PKR' && dest.country === 'Pakistan') score += 10
    score += dest.user_rating * 3
    return { dest, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.dest)
}
