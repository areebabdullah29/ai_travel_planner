import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, MapPin, Star, Shield, Thermometer, Calendar,
  Zap, X, ChevronDown, Globe, DollarSign, SlidersHorizontal,
} from 'lucide-react'
import rawDestinations from '@/data/destinations.json'
import type { Destination } from '@/types'

const destinations = rawDestinations as Destination[]

// ── Derived filter options ─────────────────────────────────────────────────
const ALL_TYPES    = [...new Set(destinations.map(d => d.type))].sort()
const ALL_REGIONS  = [...new Set(destinations.map(d => d.region))].sort()
const ALL_SEASONS  = ['January–March', 'April–June', 'July–September', 'October–December',
                      'Year-round', 'Spring', 'Summer', 'Autumn', 'Winter',
                      'May', 'October', 'November', 'March']

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  Adventure:  { bg: '#e91e8c20', text: '#f06ab3' },
  Cultural:   { bg: '#9b5de520', text: '#c084fc' },
  Relaxation: { bg: '#4cc9f020', text: '#4cc9f0' },
  Family:     { bg: '#ffd16620', text: '#ffd166' },
  Luxury:     { bg: '#06d6a020', text: '#06d6a0' },
}

const SEASON_ICONS: Record<string, string> = {
  Summer: '☀️', Winter: '❄️', Spring: '🌸', Autumn: '🍂', 'Year-round': '🌍',
}

const DEST_GRADIENTS: Record<string, string> = {
  Adventure:  'from-[#e91e8c]/30 to-[#9b5de5]/20',
  Cultural:   'from-[#9b5de5]/30 to-[#4cc9f0]/20',
  Relaxation: 'from-[#4cc9f0]/30 to-[#06d6a0]/20',
  Family:     'from-[#ffd166]/30 to-[#e91e8c]/20',
  Luxury:     'from-[#06d6a0]/30 to-[#9b5de5]/20',
}

const DEST_EMOJI: Record<string, string> = {
  'hunza-valley': '🏔️', lahore: '🕌', islamabad: '🌳', murree: '🌲',
  skardu: '🏔️', 'swat-valley': '🌿', 'neelum-valley': '🌊', gwadar: '🐠',
  dubai: '🏙️', london: '🎡', istanbul: '🕌', bali: '🌴',
}

function getSeasonIcon(season: string): string {
  for (const [key, icon] of Object.entries(SEASON_ICONS)) {
    if (season.toLowerCase().includes(key.toLowerCase())) return icon
  }
  return '📅'
}

function formatCost(pkr: number): string {
  if (pkr >= 100000) return `Rs ${(pkr / 1000).toFixed(0)}K`
  return `Rs ${pkr.toLocaleString()}`
}

function StarRating({ value, color = '#ffd166' }: { value: number; color?: string }) {
  return (
    <span className="flex items-center gap-1">
      <Star size={12} fill={color} stroke="none" />
      <span className="text-xs font-medium" style={{ color }}>{value.toFixed(1)}</span>
    </span>
  )
}

function ShieldRating({ value }: { value: number }) {
  const color = value >= 4.5 ? '#06d6a0' : value >= 4 ? '#ffd166' : '#f06ab3'
  return (
    <span className="flex items-center gap-1">
      <Shield size={12} style={{ color }} />
      <span className="text-xs font-medium" style={{ color }}>{value.toFixed(1)}</span>
    </span>
  )
}

// ── Destination Card ───────────────────────────────────────────────────────
function DestinationCard({ dest, index }: { dest: Destination; index: number }) {
  const navigate = useNavigate()
  const typeStyle = TYPE_COLORS[dest.type] ?? { bg: '#ffffff10', text: '#ffffff80' }
  const gradient = DEST_GRADIENTS[dest.type] ?? 'from-[#e91e8c]/20 to-[#9b5de5]/20'
  const emoji = DEST_EMOJI[dest.id] ?? '✈️'
  const topActivities = [...new Set(dest.activities.map(a => a.category))].slice(0, 4)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="glass rounded-2xl overflow-hidden group cursor-pointer hover:border-[#e91e8c]/30 transition-all duration-300 hover:-translate-y-1 flex flex-col"
      onClick={() => navigate(`/plan?destination=${encodeURIComponent(dest.name)}`)}
    >
      {/* Card hero */}
      <div className={`relative bg-gradient-to-br ${gradient} h-36 flex items-center justify-center`}>
        <span className="text-6xl select-none">{emoji}</span>

        {/* Type badge */}
        <div
          className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ background: typeStyle.bg, color: typeStyle.text }}
        >
          {dest.type}
        </div>

        {/* Country badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/30 text-white/60 text-xs">
          <Globe size={10} />
          {dest.country}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-[#e91e8c]/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-2xl">
          <span className="text-white font-semibold text-sm flex items-center gap-2">
            <Zap size={16} /> Plan This Trip
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Name + ratings */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display font-bold text-white text-base leading-tight">{dest.name}</h3>
            <div className="flex items-center gap-1 text-white/40 text-xs mt-0.5">
              <MapPin size={10} />
              {dest.region}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <StarRating value={dest.user_rating} />
            <ShieldRating value={dest.safety_rating} />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {/* Cost */}
          <div className="bg-white/5 rounded-xl p-2 text-center">
            <DollarSign size={12} className="text-[#ffd166] mx-auto mb-1" />
            <div className="text-white font-semibold text-xs">{formatCost(dest.baseCostPKR)}</div>
            <div className="text-white/30 text-[10px]">Base cost</div>
          </div>
          {/* Climate */}
          <div className="bg-white/5 rounded-xl p-2 text-center">
            <Thermometer size={12} className="text-[#4cc9f0] mx-auto mb-1" />
            <div className="text-white font-semibold text-[10px] leading-tight line-clamp-2">{dest.weather.split(',')[0]}</div>
            <div className="text-white/30 text-[10px]">Climate</div>
          </div>
          {/* Best season */}
          <div className="bg-white/5 rounded-xl p-2 text-center">
            <Calendar size={12} className="text-[#06d6a0] mx-auto mb-1" />
            <div className="text-white font-semibold text-[10px] leading-tight line-clamp-2">{dest.best_season.split('–')[0].trim()}</div>
            <div className="text-white/30 text-[10px]">Best time</div>
          </div>
        </div>

        {/* Activity chips */}
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {topActivities.map(cat => (
            <span key={cat} className="px-2 py-0.5 rounded-full bg-white/8 text-white/50 text-[10px] border border-white/10">
              {cat}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Destinations() {
  const [query, setQuery]         = useState('')
  const [typeFilter, setTypeFilter]     = useState<string[]>([])
  const [regionFilter, setRegionFilter] = useState('')
  const [seasonFilter, setSeasonFilter] = useState('')
  const [budgetMax, setBudgetMax]       = useState(0)          // 0 = no limit
  const [sortBy, setSortBy]             = useState<'user_rating' | 'safety_rating' | 'baseCostPKR' | 'name'>('user_rating')
  const [showFilters, setShowFilters]   = useState(false)

  const filtered = useMemo(() => {
    let list = [...destinations]

    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.region.toLowerCase().includes(q) ||
        d.country.toLowerCase().includes(q) ||
        d.type.toLowerCase().includes(q) ||
        d.aliases.some(a => a.includes(q)) ||
        d.highlights.some(h => h.toLowerCase().includes(q))
      )
    }

    if (typeFilter.length > 0) {
      list = list.filter(d => typeFilter.includes(d.type))
    }

    if (regionFilter) {
      list = list.filter(d => d.region === regionFilter)
    }

    if (seasonFilter) {
      list = list.filter(d =>
        d.best_season.toLowerCase().includes(seasonFilter.toLowerCase())
      )
    }

    if (budgetMax > 0) {
      list = list.filter(d => d.baseCostPKR <= budgetMax)
    }

    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'baseCostPKR') return a.baseCostPKR - b.baseCostPKR
      return b[sortBy] - a[sortBy]
    })

    return list
  }, [query, typeFilter, regionFilter, seasonFilter, budgetMax, sortBy])

  const toggleType = (t: string) =>
    setTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const clearFilters = () => {
    setQuery('')
    setTypeFilter([])
    setRegionFilter('')
    setSeasonFilter('')
    setBudgetMax(0)
    setSortBy('user_rating')
  }

  const hasActiveFilters = typeFilter.length > 0 || regionFilter || seasonFilter || budgetMax > 0

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-coral text-[#e91e8c] text-sm font-medium mb-3">
            <Globe size={14} />
            Destination Explorer
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-3">
            Find Your Perfect <span className="bg-gradient-to-r from-[#e91e8c] via-[#9b5de5] to-[#4cc9f0] bg-clip-text text-transparent">Destination</span>
          </h1>
          <p className="text-white/50 text-base max-w-xl mx-auto">
            Browse {destinations.length} curated destinations with detailed cost, climate, safety, and activity data.
          </p>
        </motion.div>

        {/* Search bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative mb-6"
        >
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search destinations, regions, activities…"
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-12 py-4 text-white placeholder-white/25 focus:outline-none focus:border-[#e91e8c]/40 transition-colors text-base"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              <X size={16} />
            </button>
          )}
        </motion.div>

        {/* Filter bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex flex-wrap items-center gap-3 mb-6"
        >
          {/* Type chips */}
          {ALL_TYPES.map(t => {
            const style = TYPE_COLORS[t] ?? { bg: '#ffffff10', text: '#ffffff80' }
            const active = typeFilter.includes(t)
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                style={active
                  ? { background: style.bg, color: style.text, borderColor: style.text + '60' }
                  : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)', borderColor: 'rgba(255,255,255,0.1)' }
                }
              >
                {t}
              </button>
            )
          })}

          {/* More filters toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ml-auto ${
              showFilters || hasActiveFilters
                ? 'bg-[#e91e8c]/15 border-[#e91e8c]/40 text-[#f06ab3]'
                : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
            }`}
          >
            <SlidersHorizontal size={12} />
            Filters {hasActiveFilters && `(${[regionFilter, seasonFilter, budgetMax > 0].filter(Boolean).length})`}
            <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </motion.div>

        {/* Expanded filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="glass rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Region */}
                <div>
                  <label className="block text-white/40 text-xs mb-2">Region</label>
                  <select
                    value={regionFilter}
                    onChange={e => setRegionFilter(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#e91e8c]/40 transition-colors"
                  >
                    <option value="">All regions</option>
                    {ALL_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                {/* Best season */}
                <div>
                  <label className="block text-white/40 text-xs mb-2">Best Season</label>
                  <select
                    value={seasonFilter}
                    onChange={e => setSeasonFilter(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#e91e8c]/40 transition-colors"
                  >
                    <option value="">Any season</option>
                    {ALL_SEASONS.map(s => <option key={s} value={s}>{getSeasonIcon(s)} {s}</option>)}
                  </select>
                </div>

                {/* Max budget */}
                <div>
                  <label className="block text-white/40 text-xs mb-2">
                    Max Budget {budgetMax > 0 ? `— ${formatCost(budgetMax)}` : ''}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={400000}
                    step={5000}
                    value={budgetMax}
                    onChange={e => setBudgetMax(Number(e.target.value))}
                    className="w-full accent-[#e91e8c]"
                  />
                  <div className="flex justify-between text-white/25 text-[10px] mt-1">
                    <span>No limit</span><span>Rs 400K</span>
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <label className="block text-white/40 text-xs mb-2">Sort by</label>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as typeof sortBy)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#e91e8c]/40 transition-colors"
                  >
                    <option value="user_rating">⭐ User Rating</option>
                    <option value="safety_rating">🛡️ Safety Rating</option>
                    <option value="baseCostPKR">💰 Budget (Low to High)</option>
                    <option value="name">🔤 Name (A–Z)</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results header */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-white/40 text-sm">
            {filtered.length === destinations.length
              ? `${destinations.length} destinations`
              : `${filtered.length} of ${destinations.length} destinations`}
          </p>
          {(hasActiveFilters || query) && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 text-[#f06ab3] text-xs hover:text-[#e91e8c] transition-colors">
              <X size={12} /> Clear all filters
            </button>
          )}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-24 text-white/30">
            <Globe size={40} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No destinations match your filters</p>
            <button onClick={clearFilters} className="mt-3 text-[#f06ab3] text-sm hover:underline">Clear filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((dest, i) => (
              <DestinationCard key={dest.id} dest={dest} index={i} />
            ))}
          </div>
        )}

        {/* Stats footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-14"
        >
          {[
            { label: 'Destinations', value: destinations.length.toString(), icon: '🌍' },
            { label: 'Avg Safety Rating', value: (destinations.reduce((s,d) => s+d.safety_rating,0)/destinations.length).toFixed(1)+'★', icon: '🛡️' },
            { label: 'Avg User Rating', value: (destinations.reduce((s,d) => s+d.user_rating,0)/destinations.length).toFixed(1)+'★', icon: '⭐' },
            { label: 'Activity Types', value: [...new Set(destinations.flatMap(d=>d.activities.map(a=>a.category)))].length.toString()+'+', icon: '🎯' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="glass rounded-2xl p-4 text-center">
              <div className="text-2xl mb-1">{icon}</div>
              <div className="font-display text-xl font-bold text-white">{value}</div>
              <div className="text-white/40 text-xs mt-0.5">{label}</div>
            </div>
          ))}
        </motion.div>

      </div>
    </div>
  )
}
