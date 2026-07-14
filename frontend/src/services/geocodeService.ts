const CACHE_KEY = 'tb-geocache-v2'

export interface GeoPoint {
  lat: number
  lng: number
}

function loadCache(): Record<string, GeoPoint | null> {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '{}') } catch { return {} }
}
function saveCache(c: Record<string, GeoPoint | null>) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch {}
}

// Haversine distance in km
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

export function estimateTravelTime(km: number): string {
  if (km < 2) {
    const m = Math.round((km / 5) * 60)
    return m <= 1 ? '1 min walk' : `${m} min walk`
  }
  const m = Math.round((km / 40) * 60)
  return m < 60 ? `${m} min drive` : `${Math.floor(m / 60)}h ${m % 60}m drive`
}

// ── Photon geocoder (Komoot) — free, no key, location-biased ─────────────
// Photon searches OpenStreetMap data with Elasticsearch — much more accurate
// than Nominatim for place name searches, especially with a lat/lon bias.
async function photon(query: string, near?: GeoPoint): Promise<GeoPoint | null> {
  try {
    let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en`
    if (near) url += `&lat=${near.lat}&lon=${near.lng}`
    const res  = await fetch(url)
    const data = await res.json() as { features?: Array<{ geometry: { coordinates: [number, number] } }> }
    if (data.features?.[0]) {
      const [lng, lat] = data.features[0].geometry.coordinates
      return { lat, lng }
    }
    return null
  } catch {
    return null
  }
}

export async function geocode(query: string, near?: GeoPoint): Promise<GeoPoint | null> {
  const key   = near ? `${query}|${near.lat.toFixed(3)},${near.lng.toFixed(3)}` : query
  const cache = loadCache()
  if (key in cache) return cache[key]
  const result = await photon(query, near)
  cache[key] = result
  saveCache(cache)
  return result
}

// Parallel geocoding — Photon has no strict per-second rate limit
export async function geocodeBatch(
  queries: string[],
  onProgress?: (done: number) => void,
  near?: GeoPoint,
): Promise<(GeoPoint | null)[]> {
  let done = 0
  return Promise.all(
    queries.map(async q => {
      const r = await geocode(q, near)
      onProgress?.(++done)
      return r
    })
  )
}
