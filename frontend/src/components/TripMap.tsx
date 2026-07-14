import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { motion } from 'framer-motion'
import { Loader2, Navigation, Clock, Ruler, MapPin, ChevronRight } from 'lucide-react'
import {
  geocodeBatch,
  haversineKm,
  formatDistance,
  estimateTravelTime,
  type GeoPoint,
} from '@/services/geocodeService'
import { resolveDestCoords } from '@/data/destinationCoords'
import type { DayPlan } from '@/types'

// ── Fix Leaflet default marker icons broken by Vite ──────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Custom SVG teardrop markers ──────────────────────────────────────────
function makeIcon(label: string | number, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 28 18 28S36 31.5 36 18C36 8.06 27.94 0 18 0z"
      fill="${color}" stroke="#fff" stroke-width="2.5"/>
    <text x="18" y="23" text-anchor="middle" font-family="sans-serif"
      font-weight="700" font-size="13" fill="#fff">${label}</text>
  </svg>`
  return L.divIcon({
    className: '',
    html: `<div style="width:36px;height:46px">${svg}</div>`,
    iconSize:    [36, 46],
    iconAnchor:  [18, 46],
    popupAnchor: [0, -48],
  })
}

const COLORS = { activity: '#e91e8c', hotel: '#4cc9f0' }

const CATEGORY_COLOR: Record<string, string> = {
  Adventure:   '#e91e8c',
  Sightseeing: '#9b5de5',
  Culture:     '#4cc9f0',
  Food:        '#ffd166',
  Shopping:    '#06d6a0',
  Beach:       '#4cc9f0',
}

// ── FitBounds: remounts on key change, waits for layout ─────────────────
function FitBounds({ points }: { points: GeoPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    const t = setTimeout(() => {
      map.invalidateSize()
      if (points.length === 1) { map.setView([points[0].lat, points[0].lng], 14); return }
      const lats = points.map(p => p.lat)
      const lngs = points.map(p => p.lng)
      map.fitBounds(
        [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
        { padding: [60, 60] }
      )
    }, 80)
    return () => clearTimeout(t)
  }, [map, points])
  return null
}

// ── Types ────────────────────────────────────────────────────────────────
interface PlacePoint {
  name: string; type: 'activity' | 'hotel'
  category?: string; time?: string; cost?: number; duration?: string; description?: string
  coords: GeoPoint
}
interface Leg { from: string; to: string; distanceKm: number; time: string }
interface TripMapProps { destination: string; country: string; itinerary: DayPlan[]; hotels?: string[] }

// ── Extract a geocodable location name from a vague hotel description ────
// e.g. "3-star hotel in Geylang or Lavender" → "Geylang"
//      "Budget hotel near Orchard Road"       → "Orchard Road"
//      "Hotel in Marina Bay area"             → "Marina Bay"
function extractHotelLocation(raw: string): string {
  return raw
    // Remove star-rating prefix: "3-star hotel in/near/at "
    .replace(/^\d[-–]?\s*star\s+hotel\s+(in|near|at|around|close to)\s+/i, '')
    // Remove quality prefix: "budget/luxury hotel in/near "
    .replace(/^(budget|luxury|cheap|affordable|mid[-\s]range|boutique)\s+(hotel|resort|inn|hostel|guesthouse)\s+(in|near|at|around)?\s*/i, '')
    // Remove bare "hotel in/near "
    .replace(/^hotel\s+(in|near|at|around)\s+/i, '')
    // Remove leading prepositions
    .replace(/^(in|near|at|around|close to)\s+/i, '')
    // Take only the first option when multiple are given: "Geylang or Lavender" → "Geylang"
    .replace(/\s+(or|and|\/)\s+.*/i, '')
    // Remove trailing "area", "district", "neighborhood"
    .replace(/\s+(area|district|neighborhood|neighbourhood|region|zone)$/i, '')
    .trim()
}

// ── OSRM road-route fetcher ───────────────────────────────────────────────
async function fetchRoadRoute(from: GeoPoint, to: GeoPoint): Promise<[number, number][] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
    const d = await (await fetch(url)).json()
    if (d.routes?.[0]) {
      return d.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number])
    }
  } catch {}
  return null
}

// ── Main component ────────────────────────────────────────────────────────
export default function TripMap({ destination, country, itinerary, hotels = [] }: TripMapProps) {
  const [selectedDay, setSelectedDay] = useState(0)
  const [places,      setPlaces]      = useState<PlacePoint[]>([])
  const [loading,     setLoading]     = useState(true)
  const [progress,    setProgress]    = useState(0)
  const [total,       setTotal]       = useState(0)

  // Road-route segments (OSRM)
  const [actSegs,  setActSegs]  = useState<[number, number][][]>([])
  const [h2fSeg,   setH2fSeg]   = useState<[number, number][] | null>(null)
  const [l2hSeg,   setL2hSeg]   = useState<[number, number][] | null>(null)

  const centreCoords = useMemo(() => resolveDestCoords(destination) ?? { lat: 30, lng: 70 }, [destination])
  const currentDay   = itinerary[selectedDay]

  // Memoised slices
  const activityPoints = useMemo(() => places.filter(p => p.type === 'activity'), [places])
  const hotelPoint     = useMemo(() => places.find(p => p.type === 'hotel') ?? null,  [places])
  const allCoords      = useMemo(() => places.map(p => p.coords), [places])

  // ── Step 1: Geocode with Photon (location-biased, parallel) ─────────────
  useEffect(() => {
    if (!currentDay) return
    setLoading(true)
    setPlaces([])
    setActSegs([])
    setH2fSeg(null)
    setL2hSeg(null)
    setProgress(0)

    const queries: { q: string; meta: Omit<PlacePoint, 'coords'> }[] = []

    currentDay.activities.forEach(act => queries.push({
      q:    `${act.name}, ${destination}, ${country}`,
      meta: { name: act.name, type: 'activity', category: act.category, time: act.time, cost: act.cost, duration: act.duration, description: act.description },
    }))

    // Use the current day's hotel (falls back to first day's if not set)
    const rawHotel = currentDay.accommodation ?? hotels[selectedDay] ?? hotels[0]
    if (rawHotel) {
      queries.push({
        q:    `${extractHotelLocation(rawHotel)}, ${destination}, ${country}`,
        meta: { name: rawHotel, type: 'hotel' },
      })
    }

    setTotal(queries.length)

    // Pass centreCoords as location bias → Photon returns results near the destination city
    geocodeBatch(queries.map(q => q.q), setProgress, centreCoords).then(coords => {
      const resolved = coords.map((coord, i) => {
        if (coord) return { ...queries[i].meta, coords: coord }
        const j = (Math.random() - 0.5) * 0.02
        return { ...queries[i].meta, coords: { lat: centreCoords.lat + j, lng: centreCoords.lng + j } }
      })
      setPlaces(resolved)
      setLoading(false)
    })
  }, [selectedDay, currentDay, destination, country, hotels, centreCoords])

  // ── Step 2: Fetch OSRM road routes after geocoding ───────────────────────
  useEffect(() => {
    if (loading || activityPoints.length === 0) return

    const straight = (a: GeoPoint, b: GeoPoint): [number, number][] => [[a.lat, a.lng], [b.lat, b.lng]]

    const actPs = [...activityPoints]
    const hotel = hotelPoint

    // Activity-to-activity segments
    const actPromises = actPs.slice(0, -1).map((p, i) => fetchRoadRoute(p.coords, actPs[i + 1].coords))
    const h2fPromise  = hotel && actPs.length > 0 ? fetchRoadRoute(hotel.coords, actPs[0].coords)                    : Promise.resolve(null)
    const l2hPromise  = hotel && actPs.length > 0 ? fetchRoadRoute(actPs[actPs.length - 1].coords, hotel.coords)     : Promise.resolve(null)

    Promise.all([...actPromises, h2fPromise, l2hPromise]).then(results => {
      const actResults = results.slice(0, actPromises.length) as ([number, number][] | null)[]
      const h2f        = results[actPromises.length]     as [number, number][] | null
      const l2h        = results[actPromises.length + 1] as [number, number][] | null

      setActSegs(actResults.map((r, i) => r ?? straight(actPs[i].coords, actPs[i + 1].coords)))
      setH2fSeg(h2f ?? (hotel && actPs.length > 0 ? straight(hotel.coords, actPs[0].coords)                    : null))
      setL2hSeg(l2h ?? (hotel && actPs.length > 0 ? straight(actPs[actPs.length - 1].coords, hotel.coords)     : null))
    })
  }, [loading, activityPoints, hotelPoint])

  // ── Distance legs for side panel ─────────────────────────────────────────
  const legs: Leg[] = useMemo(() =>
    activityPoints.slice(0, -1).map((p, i) => {
      const km = haversineKm(p.coords, activityPoints[i + 1].coords)
      return { from: p.name, to: activityPoints[i + 1].name, distanceKm: km, time: estimateTravelTime(km) }
    }),
    [activityPoints]
  )
  const hotelToFirstKm = hotelPoint && activityPoints.length > 0 ? haversineKm(hotelPoint.coords, activityPoints[0].coords) : null
  const lastToHotelKm  = hotelPoint && activityPoints.length > 0 ? haversineKm(activityPoints[activityPoints.length - 1].coords, hotelPoint.coords) : null

  return (
    <div className="flex flex-col gap-4">

      {/* Day selector */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {itinerary.map((day, i) => (
          <button key={i} onClick={() => setSelectedDay(i)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              i === selectedDay ? 'bg-[#e91e8c] text-white shadow-lg shadow-[#e91e8c]/30' : 'glass text-white/60 hover:text-white'
            }`}
          >
            Day {day.day}
            <span className="hidden sm:inline ml-1 text-xs opacity-70">· {day.title.split('&')[0].trim()}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: '520px' }}>

        {/* Map */}
        <div className="flex-1 rounded-2xl overflow-hidden border border-white/10 relative" style={{ minHeight: '400px' }}>
          {loading && (
            <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-[#06060e]/85 backdrop-blur-sm gap-3">
              <Loader2 size={28} className="animate-spin text-[#e91e8c]" />
              <p className="text-white/70 text-sm">Locating places… {progress}/{total}</p>
              <div className="w-40 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-[#e91e8c] transition-all duration-300 rounded-full"
                  style={{ width: total ? `${(progress / total) * 100}%` : '0%' }} />
              </div>
            </div>
          )}

          <MapContainer
            center={[centreCoords.lat, centreCoords.lng]}
            zoom={13}
            style={{ height: '100%', width: '100%', minHeight: '400px', background: '#0d0d1a' }}
            zoomControl
          >
            {/* Dark tile layer — free, no key */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
              maxZoom={19}
            />

            {/* Activity markers */}
            {activityPoints.map((place, i) => (
              <Marker key={`act-${i}`}
                position={[place.coords.lat, place.coords.lng]}
                icon={makeIcon(i + 1, CATEGORY_COLOR[place.category ?? ''] ?? COLORS.activity)}
              >
                <Popup>
                  <div style={{ minWidth: 180, fontFamily: 'sans-serif' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: '#111' }}>{i + 1}. {place.name}</div>
                    {place.time      && <div style={{ color: '#666', fontSize: 12 }}>🕐 {place.time} · {place.duration}</div>}
                    {place.category  && <div style={{ color: '#888', fontSize: 12 }}>📍 {place.category}</div>}
                    {place.cost !== undefined && <div style={{ color: '#e91e8c', fontSize: 12, fontWeight: 600, marginTop: 4 }}>Rs {place.cost.toLocaleString()}</div>}
                    {place.description && <div style={{ color: '#555', fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>{place.description}</div>}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Hotel marker */}
            {hotelPoint && (
              <Marker position={[hotelPoint.coords.lat, hotelPoint.coords.lng]} icon={makeIcon('🏨', COLORS.hotel)}>
                <Popup>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>🏨 {hotelPoint.name}</div>
                  <div style={{ color: '#555', fontSize: 12 }}>Accommodation</div>
                </Popup>
              </Marker>
            )}

            {/* Activity road routes (pink) */}
            {actSegs.map((seg, i) => (
              <React.Fragment key={`seg-${i}`}>
                <Polyline positions={seg} pathOptions={{ color: '#000',    weight: 6, opacity: 0.25 }} />
                <Polyline positions={seg} pathOptions={{ color: '#e91e8c', weight: 4, opacity: 0.9 }} />
              </React.Fragment>
            ))}

            {/* Hotel → first activity (cyan dashed) */}
            {h2fSeg && (
              <>
                <Polyline positions={h2fSeg} pathOptions={{ color: '#000',    weight: 6, opacity: 0.2 }} />
                <Polyline positions={h2fSeg} pathOptions={{ color: '#4cc9f0', weight: 3, opacity: 0.85, dashArray: '7 5' }} />
              </>
            )}

            {/* Last activity → hotel (cyan dashed) */}
            {l2hSeg && (
              <>
                <Polyline positions={l2hSeg} pathOptions={{ color: '#000',    weight: 6, opacity: 0.2 }} />
                <Polyline positions={l2hSeg} pathOptions={{ color: '#4cc9f0', weight: 3, opacity: 0.85, dashArray: '7 5' }} />
              </>
            )}

            {/* FitBounds — remounts when day or place count changes */}
            <FitBounds key={`fit-${selectedDay}-${places.length}`} points={allCoords} />
          </MapContainer>
        </div>

        {/* Side panel */}
        <div className="lg:w-72 flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: '520px' }}>

          <div className="glass rounded-2xl p-4">
            <h3 className="font-display font-bold text-white text-sm mb-0.5">Day {currentDay?.day}</h3>
            <p className="text-white/50 text-xs">{currentDay?.title}</p>
          </div>

          <div className="glass rounded-2xl p-4 flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Navigation size={13} className="text-[#e91e8c]" />
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wide">Route</span>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-white/30 text-xs py-2">
                <Loader2 size={13} className="animate-spin" /> Loading…
              </div>
            ) : activityPoints.length === 0 ? (
              <p className="text-white/30 text-xs">No activities found for this day</p>
            ) : (
              <div className="space-y-2">

                {/* Hotel — start */}
                {hotelPoint && (
                  <div>
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5" style={{ background: COLORS.hotel }}>🏨</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium leading-tight line-clamp-1">{hotelPoint.name}</p>
                        <p className="text-white/40 text-[10px] mt-0.5">Hotel · Start here</p>
                      </div>
                    </motion.div>
                    {hotelToFirstKm !== null && (
                      <div className="ml-3 pl-4 border-l border-dashed border-[#4cc9f0]/30 py-1.5 flex items-center gap-3 text-[10px] text-[#4cc9f0]/60">
                        <span className="flex items-center gap-1"><Ruler size={9} /> {formatDistance(hotelToFirstKm)}</span>
                        <ChevronRight size={9} />
                        <span className="flex items-center gap-1"><Clock size={9} /> {estimateTravelTime(hotelToFirstKm)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Activities */}
                {activityPoints.map((place, i) => {
                  const leg   = legs[i]
                  const color = CATEGORY_COLOR[place.category ?? ''] ?? COLORS.activity
                  return (
                    <div key={i}>
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5" style={{ background: color }}>{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-medium leading-tight line-clamp-1">{place.name}</p>
                          {place.time && <p className="text-white/40 text-[10px] mt-0.5">{place.time} · {place.duration}</p>}
                        </div>
                        {place.cost !== undefined && <span className="text-[#f06ab3] text-[10px] font-semibold shrink-0">Rs {place.cost.toLocaleString()}</span>}
                      </motion.div>
                      {leg && (
                        <div className="ml-3 pl-4 border-l border-dashed border-white/10 py-1.5 flex items-center gap-3 text-[10px] text-white/35">
                          <span className="flex items-center gap-1"><Ruler size={9} /> {formatDistance(leg.distanceKm)}</span>
                          <ChevronRight size={9} />
                          <span className="flex items-center gap-1"><Clock size={9} /> {leg.time}</span>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Hotel — return */}
                {hotelPoint && lastToHotelKm !== null && (
                  <div>
                    <div className="ml-3 pl-4 border-l border-dashed border-[#4cc9f0]/30 py-1.5 flex items-center gap-3 text-[10px] text-[#4cc9f0]/60">
                      <span className="flex items-center gap-1"><Ruler size={9} /> {formatDistance(lastToHotelKm)}</span>
                      <ChevronRight size={9} />
                      <span className="flex items-center gap-1"><Clock size={9} /> {estimateTravelTime(lastToHotelKm)}</span>
                    </div>
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5" style={{ background: COLORS.hotel }}>🏨</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium leading-tight line-clamp-1">{hotelPoint.name}</p>
                        <p className="text-white/40 text-[10px] mt-0.5">Return to hotel</p>
                      </div>
                    </motion.div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          {!loading && (legs.length > 0 || hotelToFirstKm !== null) && (
            <div className="glass rounded-2xl p-4 grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-[#4cc9f0] mb-1"><Ruler size={13} /></div>
                <div className="text-white font-bold text-sm">
                  {formatDistance(legs.reduce((s, l) => s + l.distanceKm, 0) + (hotelToFirstKm ?? 0) + (lastToHotelKm ?? 0))}
                </div>
                <div className="text-white/30 text-[10px]">Total distance</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-[#ffd166] mb-1"><MapPin size={13} /></div>
                <div className="text-white font-bold text-sm">{activityPoints.length}</div>
                <div className="text-white/30 text-[10px]">Stops today</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-white/40">
        {[{ color: '#e91e8c', label: 'Activities' }, { color: '#9b5de5', label: 'Culture/Sightseeing' }, { color: '#ffd166', label: 'Food' }, { color: '#4cc9f0', label: 'Hotel' }]
          .map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />{label}
            </span>
          ))}
        <span className="flex items-center gap-1.5">
          <span className="w-6 border-t-2 border-[#e91e8c] inline-block" /> Activity route
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-6 border-t-2 border-dashed border-[#4cc9f0] inline-block" /> Hotel route
        </span>
      </div>
    </div>
  )
}
