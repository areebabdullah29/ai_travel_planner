import type { GeoPoint } from '@/services/geocodeService'

// Centre coordinates for every destination in destinations.json
export const DEST_COORDS: Record<string, GeoPoint> = {
  'hunza-valley':  { lat: 36.3167, lng: 74.6500 },
  'lahore':        { lat: 31.5497, lng: 74.3436 },
  'islamabad':     { lat: 33.6844, lng: 73.0479 },
  'murree':        { lat: 33.9076, lng: 73.3903 },
  'skardu':        { lat: 35.2946, lng: 75.6317 },
  'swat-valley':   { lat: 35.2227, lng: 72.4258 },
  'neelum-valley': { lat: 34.5553, lng: 74.0711 },
  'gwadar':        { lat: 25.1264, lng: 62.3225 },
  'dubai':         { lat: 25.2048, lng: 55.2708 },
  'london':        { lat: 51.5074, lng: -0.1278 },
  'istanbul':      { lat: 41.0082, lng: 28.9784 },
  'bali':          { lat: -8.3405, lng: 115.0920 },
  'kuala-lumpur':  { lat:  3.1390, lng: 101.6869 },
  'paris':         { lat: 48.8566, lng:   2.3522 },
  'barcelona':     { lat: 41.3851, lng:   2.1734 },
  'bangkok':       { lat: 13.7563, lng: 100.5018 },
  'tokyo':         { lat: 35.6762, lng: 139.6503 },
  'singapore':     { lat:  1.3521, lng: 103.8198 },
}

// Resolve a destination name or id to its centre point
export function resolveDestCoords(nameOrId: string): GeoPoint | null {
  const key = nameOrId
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  return DEST_COORDS[key] ?? null
}

// All destinations for the explorer map
export interface DestMapEntry {
  id: string
  name: string
  country: string
  type: string
  baseCostPKR: number
  user_rating: number
  safety_rating: number
  best_season: string
  weather: string
  coords: GeoPoint
}
