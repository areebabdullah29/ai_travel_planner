import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { motion } from 'framer-motion'
import { Globe, Zap, Star, Shield, DollarSign, Calendar, Filter, X } from 'lucide-react'
import rawDestinations from '@/data/destinations.json'
import { DEST_COORDS } from '@/data/destinationCoords'
import type { Destination } from '@/types'

// Fix Leaflet icon paths in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const destinations = rawDestinations as Destination[]

const TYPE_COLORS: Record<string, string> = {
  Adventure:  '#e91e8c',
  Cultural:   '#9b5de5',
  Relaxation: '#4cc9f0',
  Family:     '#ffd166',
  Luxury:     '#06d6a0',
}

const TYPE_EMOJIS: Record<string, string> = {
  Adventure: '🏔️', Cultural: '🏛️', Relaxation: '🌊', Family: '👨‍👩‍👧', Luxury: '💎',
}

const DEST_EMOJIS: Record<string, string> = {
  'hunza-valley': '🏔️', lahore: '🕌', islamabad: '🌳', murree: '🌲',
  skardu: '🏔️', 'swat-valley': '🌿', 'neelum-valley': '🏞️', gwadar: '🐠',
  dubai: '🏙️', london: '🎡', istanbul: '🕌', bali: '🌴',
  'kuala-lumpur': '🌆', paris: '🗼', barcelona: '⛪', bangkok: '🛕',
  tokyo: '⛩️', singapore: '🦁',
}

function makeTypeIcon(type: string, name: string) {
  const color = TYPE_COLORS[type] ?? '#e91e8c'
  const emoji = DEST_EMOJIS[name.toLowerCase().replace(/\s+/g, '-')] ?? '✈️'
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};
      width:42px;height:42px;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:3px solid #fff;
      box-shadow:0 3px 12px rgba(0,0,0,0.5);
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;
    ">
      <span style="transform:rotate(45deg);font-size:18px;line-height:1">${emoji}</span>
    </div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 42],
    popupAnchor: [0, -44],
  })
}

function formatCost(pkr: number): string {
  if (pkr >= 100000) return `Rs ${(pkr / 1000).toFixed(0)}K`
  return `Rs ${pkr.toLocaleString()}`
}

const ALL_TYPES = [...new Set(destinations.map(d => d.type))].sort()

export default function MapExplorer() {
  const navigate = useNavigate()
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [selected, setSelected]     = useState<string | null>(null)

  const filtered = useMemo(
    () => typeFilter.length > 0
      ? destinations.filter(d => typeFilter.includes(d.type))
      : destinations,
    [typeFilter]
  )

  const toggleType = (t: string) =>
    setTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  return (
    <div className="min-h-screen pt-24 pb-10 px-4">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-coral text-[#e91e8c] text-sm font-medium mb-3">
            <Globe size={14} /> Interactive World Map
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-bold text-white mb-2">
            Explore <span className="bg-gradient-to-r from-[#e91e8c] via-[#9b5de5] to-[#4cc9f0] bg-clip-text text-transparent">Destinations</span>
          </h1>
          <p className="text-white/50 text-sm">{destinations.length} destinations · click any pin to explore</p>
        </motion.div>

        {/* Type filter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center gap-2 justify-center"
        >
          <span className="flex items-center gap-1 text-white/30 text-xs">
            <Filter size={11} /> Filter:
          </span>
          {ALL_TYPES.map(t => {
            const color = TYPE_COLORS[t] ?? '#e91e8c'
            const active = typeFilter.includes(t)
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                style={active
                  ? { background: color + '25', color, borderColor: color + '60' }
                  : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)', borderColor: 'rgba(255,255,255,0.1)' }
                }
              >
                {TYPE_EMOJIS[t]} {t}
              </button>
            )
          })}
          {typeFilter.length > 0 && (
            <button onClick={() => setTypeFilter([])} className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 px-2">
              <X size={10} /> Clear
            </button>
          )}
        </motion.div>

        {/* Map + sidebar layout */}
        <div className="flex flex-col xl:flex-row gap-5" style={{ minHeight: '560px' }}>

          {/* Leaflet map */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="flex-1 rounded-2xl overflow-hidden border border-white/10"
            style={{ minHeight: '480px' }}
          >
            <MapContainer
              center={[20, 50]}
              zoom={3}
              style={{ height: '100%', width: '100%', minHeight: '480px', background: '#0d0d1a' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
                maxZoom={19}
              />

              {filtered.map(dest => {
                const coords = DEST_COORDS[dest.id]
                if (!coords) return null
                return (
                  <Marker
                    key={dest.id}
                    position={[coords.lat, coords.lng]}
                    icon={makeTypeIcon(dest.type, dest.id)}
                    eventHandlers={{ click: () => setSelected(dest.id) }}
                  >
                    <Popup maxWidth={260}>
                      <div style={{ fontFamily: 'sans-serif', minWidth: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '20px' }}>{DEST_EMOJIS[dest.id] ?? '✈️'}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '15px', color: '#111' }}>{dest.name}</div>
                            <div style={{ fontSize: '11px', color: '#888' }}>{dest.region} · {dest.country}</div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                          <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#999' }}>Base Cost</div>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#e91e8c' }}>{formatCost(dest.baseCostPKR)}</div>
                          </div>
                          <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#999' }}>Best Season</div>
                            <div style={{ fontWeight: 600, fontSize: '11px', color: '#333' }}>{dest.best_season}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px', color: '#555' }}>
                          <span>⭐ {dest.user_rating.toFixed(1)} user rating</span>
                          <span>🛡️ {dest.safety_rating.toFixed(1)} safety</span>
                        </div>

                        <div style={{ marginBottom: '10px', fontSize: '11px', color: '#666' }}>
                          🌡️ {dest.weather}
                        </div>

                        <button
                          onClick={() => navigate(`/plan?destination=${encodeURIComponent(dest.name)}`)}
                          style={{
                            width: '100%', padding: '8px', borderRadius: '8px',
                            background: 'linear-gradient(135deg,#e91e8c,#9b5de5)',
                            color: '#fff', fontWeight: 700, fontSize: '13px',
                            border: 'none', cursor: 'pointer',
                          }}
                        >
                          ✈️ Plan This Trip
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}
            </MapContainer>
          </motion.div>

          {/* Destination list sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="xl:w-72 glass rounded-2xl p-4 flex flex-col gap-2 overflow-y-auto"
            style={{ maxHeight: '560px' }}
          >
            <p className="text-white/40 text-xs uppercase tracking-wide font-semibold mb-1">
              {filtered.length} destination{filtered.length !== 1 ? 's' : ''}
            </p>
            {filtered.map(dest => {
              const color = TYPE_COLORS[dest.type] ?? '#e91e8c'
              const isSelected = selected === dest.id
              return (
                <button
                  key={dest.id}
                  onClick={() => setSelected(isSelected ? null : dest.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-[#e91e8c]/50 bg-[#e91e8c]/10'
                      : 'border-white/5 hover:border-white/15 bg-white/3 hover:bg-white/6'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{DEST_EMOJIS[dest.id] ?? '✈️'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-semibold truncate">{dest.name}</div>
                      <div className="text-white/40 text-xs">{dest.country}</div>
                    </div>
                    <div
                      className="px-1.5 py-0.5 rounded-md text-[10px] font-medium shrink-0"
                      style={{ background: color + '20', color }}
                    >
                      {dest.type}
                    </div>
                  </div>

                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-2 pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-[11px]"
                    >
                      <div className="flex items-center gap-1 text-white/50">
                        <DollarSign size={10} className="text-[#ffd166]" />
                        {formatCost(dest.baseCostPKR)}
                      </div>
                      <div className="flex items-center gap-1 text-white/50">
                        <Calendar size={10} className="text-[#06d6a0]" />
                        {dest.best_season.split('–')[0]}
                      </div>
                      <div className="flex items-center gap-1 text-white/50">
                        <Star size={10} fill="#ffd166" stroke="none" />
                        {dest.user_rating.toFixed(1)}
                      </div>
                      <div className="flex items-center gap-1 text-white/50">
                        <Shield size={10} className="text-[#06d6a0]" />
                        {dest.safety_rating.toFixed(1)}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/plan?destination=${encodeURIComponent(dest.name)}`) }}
                        className="col-span-2 mt-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#e91e8c]/15 border border-[#e91e8c]/30 text-[#f06ab3] text-[11px] font-medium hover:bg-[#e91e8c]/25 transition-colors"
                      >
                        <Zap size={10} /> Plan This Trip
                      </button>
                    </motion.div>
                  )}
                </button>
              )
            })}
          </motion.div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 text-xs text-white/40">
          {ALL_TYPES.map(t => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: TYPE_COLORS[t] ?? '#fff' }} />
              {TYPE_EMOJIS[t]} {t}
            </span>
          ))}
        </div>

      </div>
    </div>
  )
}
