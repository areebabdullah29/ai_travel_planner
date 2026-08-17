import { useEffect, useState, useMemo } from 'react'
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

// ── Fix Leaflet default marker icons broken by Vite ─────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Custom SVG markers ────────────────────────────────────────────────────
function makeIcon(label: string | number, color: string) {
  const bg = color
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${bg};
      width:34px;height:34px;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.45);
      display:flex;align-items:center;justify-content:center;
    ">
      <span style="transform:rotate(45deg);color:#fff;font-weight:700;font-size:12px;line-height:1">${label}</span>
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -36],
  })
}

const COLORS = {
  activity:   '#e91e8c',
  restaurant: '#ffd166',
  hotel:      '#4cc9f0',
  start:      '#06d6a0',
}

const CATEGORY_COLOR: Record<string, string> = {
  Adventure:   '#e91e8c',
  Sightseeing: '#9b5de5',
  Culture:     '#4cc9f0',
  Food:        '#ffd166',
  Shopping:    '#06d6a0',
  Beach:       '#4cc9f0',
}

// ── Auto-fit bounds ───────────────────────────────────────────────────────
function FitBounds({ points }: { points: GeoPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13)
      return
    }
    const lats = points.map(p => p.lat)
    const lngs = points.map(p => p.lng)
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [50, 50] }
    )
  }, [map, points])
  return null
}

// ── Types ─────────────────────────────────────────────────────────────────
interface PlacePoint {
  name: string
  type: 'activity' | 'restaurant' | 'hotel'
  category?: string
  time?: string
  cost?: number
  duration?: string
  description?: string
  coords: GeoPoint
}

interface Leg {
  from: string
  to: string
  distanceKm: number
  time: string
}

// ── Props ─────────────────────────────────────────────────────────────────
interface TripMapProps {
  destination: string
  country: string
  itinerary: DayPlan[]
  hotels?: string[]
}

// ── Main component ────────────────────────────────────────────────────────
export default function TripMap({ destination, country, itinerary, hotels = [] }: TripMapProps) {
  const [selectedDay, setSelectedDay] = useState(0)
  const [places, setPlaces] = useState<PlacePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)

  const centreCoords: GeoPoint = useMemo(
    () => resolveDestCoords(destination) ?? { lat: 30, lng: 70 },
    [destination]
  )

  const currentDay = itinerary[selectedDay]

  // Build query list for Nominatim
  useEffect(() => {
    if (!currentDay) return
    setLoading(true)
    setPlaces([])

    const queries: { q: string; meta: Omit<PlacePoint, 'coords'> }[] = []

    currentDay.activities.forEach(act => {
      queries.push({
        q: `${act.name}, ${destination}, ${country}`,
        meta: {
          name: act.name,
          type: 'activity',
          category: act.category,
          time: act.time,
          cost: act.cost,
          duration: act.duration,
          description: act.description,
        },
      })
    })

    if (hotels[0]) {
      queries.push({
        q: `${hotels[0]}, ${destination}, ${country}`,
        meta: { name: hotels[0], type: 'hotel' },
      })
    }

    setTotal(queries.length)

    geocodeBatch(
      queries.map(q => q.q),
      (done) => setProgress(done)
    ).then(coords => {
      const resolved: PlacePoint[] = []
      coords.forEach((coord, i) => {
        if (coord) {
          resolved.push({ ...queries[i].meta, coords: coord })
        } else {
          // Fallback: scatter around destination centre
          const jitter = (Math.random() - 0.5) * 0.04
          resolved.push({
            ...queries[i].meta,
            coords: { lat: centreCoords.lat + jitter, lng: centreCoords.lng + jitter },
          })
        }
      })
      setPlaces(resolved)
      setLoading(false)
    })
  }, [selectedDay, currentDay, destination, country, hotels, centreCoords])

  // Compute legs between consecutive activity markers
  const legs: Leg[] = useMemo(() => {
    const acts = places.filter(p => p.type === 'activity')
    return acts.slice(0, -1).map((p, i) => {
      const next = acts[i + 1]
      const km = haversineKm(p.coords, next.coords)
      return {
        from: p.name,
        to: next.name,
        distanceKm: km,
        time: estimateTravelTime(km),
      }
    })
  }, [places])

  const activityPoints = places.filter(p => p.type === 'activity')
  const otherPoints    = places.filter(p => p.type !== 'activity')
  const hotelPoint     = otherPoints.find(p => p.type === 'hotel') ?? null
  const polylineCoords = activityPoints.map(p => [p.coords.lat, p.coords.lng] as [number, number])
  const allCoords      = places.map(p => p.coords)

  // Hotel ↔ activity route segments
  const hotelToFirst: [number, number][] | null =
    hotelPoint && activityPoints.length > 0
      ? [[hotelPoint.coords.lat, hotelPoint.coords.lng], [activityPoints[0].coords.lat, activityPoints[0].coords.lng]]
      : null

  const lastToHotel: [number, number][] | null =
    hotelPoint && activityPoints.length > 0
      ? [[activityPoints[activityPoints.length - 1].coords.lat, activityPoints[activityPoints.length - 1].coords.lng], [hotelPoint.coords.lat, hotelPoint.coords.lng]]
      : null

  const hotelToFirstKm = hotelPoint && activityPoints.length > 0
    ? haversineKm(hotelPoint.coords, activityPoints[0].coords)
    : null

  const lastToHotelKm = hotelPoint && activityPoints.length > 0
    ? haversineKm(activityPoints[activityPoints.length - 1].coords, hotelPoint.coords)
    : null

  return (
    <div className="flex flex-col gap-4">

      {/* Day selector */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {itinerary.map((day, i) => (
          <button
            key={i}
            onClick={() => setSelectedDay(i)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              i === selectedDay
                ? 'bg-[#e91e8c] text-white shadow-lg shadow-[#e91e8c]/30'
                : 'glass text-white/60 hover:text-white'
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
            <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-[#06060e]/80 backdrop-blur-sm gap-3">
              <Loader2 size={28} className="animate-spin text-[#e91e8c]" />
              <p className="text-white/70 text-sm">
                Locating attractions… {progress}/{total}
              </p>
              <div className="w-40 h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#e91e8c] transition-all duration-300 rounded-full"
                  style={{ width: total ? `${(progress / total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          )}

          <MapContainer
            center={[centreCoords.lat, centreCoords.lng]}
            zoom={13}
            style={{ height: '100%', width: '100%', minHeight: '400px', background: '#1a1a2e' }}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
              maxZoom={19}
            />

            {/* Activity markers */}
            {activityPoints.map((place, i) => {
              const color = CATEGORY_COLOR[place.category ?? ''] ?? COLORS.activity
              return (
                <Marker key={`act-${i}`} position={[place.coords.lat, place.coords.lng]} icon={makeIcon(i + 1, color)}>
                  <Popup>
                    <div style={{ minWidth: '180px', fontFamily: 'sans-serif' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px', color: '#111' }}>
                        {i + 1}. {place.name}
                      </div>
                      {place.time && <div style={{ color: '#666', fontSize: '12px' }}>🕐 {place.time} · {place.duration}</div>}
                      {place.category && <div style={{ color: '#888', fontSize: '12px' }}>📍 {place.category}</div>}
                      {place.cost !== undefined && (
                        <div style={{ color: '#e91e8c', fontSize: '12px', fontWeight: 600, marginTop: '4px' }}>
                          Rs {place.cost.toLocaleString()}
                        </div>
                      )}
                      {place.description && (
                        <div style={{ color: '#555', fontSize: '11px', marginTop: '6px', lineHeight: '1.4' }}>
                          {place.description}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )
            })}

            {/* Hotel marker */}
            {otherPoints.filter(p => p.type === 'hotel').map((p, i) => (
              <Marker key={`hotel-${i}`} position={[p.coords.lat, p.coords.lng]} icon={makeIcon('🏨', COLORS.hotel)}>
                <Popup>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>🏨 {p.name}</div>
                  <div style={{ color: '#555', fontSize: '12px' }}>Accommodation</div>
                </Popup>
              </Marker>
            ))}

            {/* Activity route polyline */}
            {polylineCoords.length >= 2 && (
              <>
                <Polyline positions={polylineCoords} pathOptions={{ color: '#000', weight: 6, opacity: 0.25 }} />
                <Polyline positions={polylineCoords} pathOptions={{ color: '#e91e8c', weight: 3, opacity: 0.85, dashArray: '8 6' }} />
              </>
            )}

            {/* Hotel → first activity */}
            {hotelToFirst && (
              <>
                <Polyline positions={hotelToFirst} pathOptions={{ color: '#000', weight: 6, opacity: 0.2 }} />
                <Polyline positions={hotelToFirst} pathOptions={{ color: '#4cc9f0', weight: 2.5, opacity: 0.8, dashArray: '5 5' }} />
              </>
            )}

            {/* Last activity → hotel */}
            {lastToHotel && (
              <>
                <Polyline positions={lastToHotel} pathOptions={{ color: '#000', weight: 6, opacity: 0.2 }} />
                <Polyline positions={lastToHotel} pathOptions={{ color: '#4cc9f0', weight: 2.5, opacity: 0.8, dashArray: '5 5' }} />
              </>
            )}

            <FitBounds points={allCoords} />
          </MapContainer>
        </div>

        {/* Side panel */}
        <div className="lg:w-72 flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: '520px' }}>

          {/* Day summary */}
          <div className="glass rounded-2xl p-4">
            <h3 className="font-display font-bold text-white text-sm mb-0.5">Day {currentDay?.day}</h3>
            <p className="text-white/50 text-xs">{currentDay?.title}</p>
          </div>

          {/* Activity sequence */}
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
                {/* Hotel start */}
                {hotelPoint && (
                  <div>
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-2.5"
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
                        style={{ background: COLORS.hotel }}
                      >
                        🏨
                      </div>
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

                {activityPoints.map((place, i) => {
                  const leg = legs[i]
                  const color = CATEGORY_COLOR[place.category ?? ''] ?? COLORS.activity
                  return (
                    <div key={i}>
                      {/* Stop */}
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-start gap-2.5"
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
                          style={{ background: color }}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-medium leading-tight line-clamp-1">{place.name}</p>
                          {place.time && (
                            <p className="text-white/40 text-[10px] mt-0.5">{place.time} · {place.duration}</p>
                          )}
                        </div>
                        {place.cost !== undefined && (
                          <span className="text-[#f06ab3] text-[10px] font-semibold shrink-0">
                            Rs {place.cost.toLocaleString()}
                          </span>
                        )}
                      </motion.div>

                      {/* Leg info */}
                      {leg && (
                        <div className="ml-3 pl-4 border-l border-dashed border-white/10 py-1.5 flex items-center gap-3 text-[10px] text-white/35">
                          <span className="flex items-center gap-1">
                            <Ruler size={9} /> {formatDistance(leg.distanceKm)}
                          </span>
                          <ChevronRight size={9} />
                          <span className="flex items-center gap-1">
                            <Clock size={9} /> {leg.time}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Return to hotel */}
                {hotelPoint && lastToHotelKm !== null && (
                  <div>
                    <div className="ml-3 pl-4 border-l border-dashed border-[#4cc9f0]/30 py-1.5 flex items-center gap-3 text-[10px] text-[#4cc9f0]/60">
                      <span className="flex items-center gap-1"><Ruler size={9} /> {formatDistance(lastToHotelKm)}</span>
                      <ChevronRight size={9} />
                      <span className="flex items-center gap-1"><Clock size={9} /> {estimateTravelTime(lastToHotelKm)}</span>
                    </div>
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-2.5"
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
                        style={{ background: COLORS.hotel }}
                      >
                        🏨
                      </div>
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
                <div className="flex items-center justify-center gap-1 text-[#4cc9f0] mb-1">
                  <Ruler size={13} />
                </div>
                <div className="text-white font-bold text-sm">
                  {formatDistance(
                    legs.reduce((s, l) => s + l.distanceKm, 0) +
                    (hotelToFirstKm ?? 0) +
                    (lastToHotelKm ?? 0)
                  )}
                </div>
                <div className="text-white/30 text-[10px]">Total distance</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-[#ffd166] mb-1">
                  <MapPin size={13} />
                </div>
                <div className="text-white font-bold text-sm">{activityPoints.length}</div>
                <div className="text-white/30 text-[10px]">Stops today</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-white/40">
        {[
          { color: '#e91e8c', label: 'Activities' },
          { color: '#9b5de5', label: 'Culture/Sightseeing' },
          { color: '#ffd166', label: 'Food' },
          { color: '#4cc9f0', label: 'Hotel' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-6 border-t-2 border-dashed border-[#e91e8c] inline-block" />
          Activity route
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-6 border-t-2 border-dashed border-[#4cc9f0] inline-block" />
          Hotel route
        </span>
      </div>
    </div>
  )
}
