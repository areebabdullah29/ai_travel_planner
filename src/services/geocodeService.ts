const CACHE_KEY = 'tb-geocache-v1'
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

export interface GeoPoint {
  lat: number
  lng: number
}

function loadCache(): Record<string, GeoPoint | null> {
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveCache(cache: Record<string, GeoPoint | null>) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // storage full — ignore
  }
}

// Haversine distance in km between two points
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const chord =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng * sinLng
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord))
}

// Format distance for display
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

// Estimate travel time (driving for >2 km, walking otherwise)
export function estimateTravelTime(km: number): string {
  if (km < 2) {
    const mins = Math.round((km / 5) * 60) // walking 5 km/h
    return mins <= 1 ? '1 min walk' : `${mins} min walk`
  }
  const mins = Math.round((km / 40) * 60) // driving 40 km/h city
  if (mins < 60) return `${mins} min drive`
  return `${Math.floor(mins / 60)}h ${mins % 60}m drive`
}

let lastReq = 0

async function nominatim(query: string): Promise<GeoPoint | null> {
  // Respect Nominatim's 1 req/sec policy
  const gap = 1100 - (Date.now() - lastReq)
  if (gap > 0) await new Promise(r => setTimeout(r, gap))
  lastReq = Date.now()

  try {
    const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=en`
    const res = await fetch(url)
    const data = await res.json() as Array<{ lat: string; lon: string }>
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    return null
  } catch {
    return null
  }
}

export async function geocode(query: string): Promise<GeoPoint | null> {
  const cache = loadCache()
  if (query in cache) return cache[query]
  const result = await nominatim(query)
  cache[query] = result
  saveCache(cache)
  return result
}

// Geocode a list sequentially (respects rate limit)
export async function geocodeBatch(
  queries: string[],
  onProgress?: (done: number, total: number) => void
): Promise<(GeoPoint | null)[]> {
  const results: (GeoPoint | null)[] = []
  for (let i = 0; i < queries.length; i++) {
    results.push(await geocode(queries[i]))
    onProgress?.(i + 1, queries.length)
  }
  return results
}
