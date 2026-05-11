import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Compass, Plus, Trash2, Eye, Calendar,
  DollarSign, Clock, Globe, Sparkles, MapPin,
  TrendingUp, BarChart3, Plane,
  Search, Filter, History, RefreshCw,
  MessageSquare, ChevronRight, Loader2
} from 'lucide-react'
import { useTripContext } from '@/context/TripContext'
import { useAuth } from '@/context/AuthContext'
import type { SavedTrip } from '@/types'
import type { SearchHistoryEntry } from '@/context/TripContext'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' as const }
  })
}

const STATUS_COLORS: Record<SavedTrip['status'], { bg: string; text: string; label: string }> = {
  planned:   { bg: '#4cc9f020', text: '#4cc9f0', label: 'Planned' },
  ongoing:   { bg: '#ffd16620', text: '#ffd166', label: 'Ongoing' },
  completed: { bg: '#06d6a020', text: '#06d6a0', label: 'Completed' },
}

const DEST_EMOJIS: Record<string, string> = {
  bali: '🌴', japan: '🗼', tokyo: '🗼', kyoto: '⛩️',
  pakistan: '🏔️', hunza: '🏔️', skardu: '🏔️',
  paris: '🗺️', france: '🗼', rome: '🏛️', italy: '🍝',
  kenya: '🦁', safari: '🦁', africa: '🌍',
  greece: '⛵', santorini: '⛵', thailand: '🌺',
  maldives: '🏝️', dubai: '🏙️', indonesia: '🌴',
}

function getEmoji(dest: string): string {
  const lower = dest.toLowerCase()
  for (const [key, emoji] of Object.entries(DEST_EMOJIS)) {
    if (lower.includes(key)) return emoji
  }
  return '✈️'
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type DashTab = 'trips' | 'history'

export default function Dashboard() {
  const { savedTrips, deleteTrip, updateTripStatus, searchHistory, clearSearchHistory, isSyncing } = useTripContext()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SavedTrip['status'] | 'all'>('all')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<DashTab>('trips')
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null)

  // Close status dropdown when clicking outside
  useEffect(() => {
    if (!statusMenuId) return
    const close = () => setStatusMenuId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [statusMenuId])

  const filtered = savedTrips.filter(t => {
    const matchSearch = t.destination.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    return matchSearch && matchStatus
  })

  const totalSpent = savedTrips.filter(t => t.status === 'completed').reduce((s, t) => s + t.totalCost, 0)
  const totalDays = savedTrips.reduce((s, t) => s + t.duration, 0)
  const avgCostPerDay = savedTrips.length > 0
    ? Math.round(savedTrips.reduce((s, t) => s + (t.totalCost / t.duration), 0) / savedTrips.length)
    : 0

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  const timeGreeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const dashSubtitle = (() => {
    if (savedTrips.length === 0) return 'Ready to plan your first adventure? ✈️'
    const last = savedTrips[0]
    return `Last planned: ${last.destination} · ${last.duration} days`
  })()

  const topDestination = (() => {
    if (searchHistory.length === 0) return '—'
    const counts: Record<string, number> = {}
    searchHistory.forEach(e => { const k = e.destination ?? 'Other'; counts[k] = (counts[k] ?? 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
  })()

  const avgBudget = (() => {
    const withBudget = searchHistory.filter(e => e.budget)
    if (withBudget.length === 0) return '—'
    const avg = Math.round(withBudget.reduce((s, e) => s + (e.budget ?? 0), 0) / withBudget.length)
    const commonCurrency = withBudget[0]?.currency ?? 'PKR'
    return `${commonCurrency} ${avg.toLocaleString()}`
  })()

  return (
    <div className="min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 mb-10"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#e91e8c] to-[#9b5de5] flex items-center justify-center text-white font-display font-bold text-xl shadow-lg shadow-[#e91e8c]/20">
              {user ? getInitials(user.name) : 'U'}
            </div>
            <div>
              <p className="text-white/40 text-sm">{timeGreeting},</p>
              <h1 className="font-display text-3xl md:text-4xl font-extrabold text-white">
                {user?.name.split(' ')[0] ?? 'Traveler'}<span className="text-[#e91e8c]">!</span>
              </h1>
              <p className="text-white/30 text-xs mt-1">{dashSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isSyncing && (
              <span className="flex items-center gap-1.5 text-white/30 text-xs">
                <Loader2 size={13} className="animate-spin" /> Syncing…
              </span>
            )}
            <Link to="/plan"
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-[#e91e8c] to-[#f06ab3] text-white font-semibold hover:shadow-lg hover:shadow-[#e91e8c]/30 hover:scale-105 transition-all duration-300">
              <Plus size={18} /> Plan New Trip
            </Link>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { icon: Globe,      label: 'Total Trips',  value: savedTrips.length.toString(),     color: '#e91e8c' },
            { icon: Clock,      label: 'Total Days',   value: `${totalDays}d`,                   color: '#4cc9f0' },
            { icon: DollarSign, label: 'Budget Used',  value: `Rs ${totalSpent.toLocaleString()}`, color: '#ffd166' },
            { icon: TrendingUp, label: 'Avg / Day',    value: `Rs ${avgCostPerDay}`,               color: '#06d6a0' },
          ].map(({ icon: Icon, label, value, color }, i) => (
            <motion.div key={label} custom={i} variants={fadeUp} initial="hidden" animate="visible" className="glass rounded-2xl p-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}15`, color }}>
                <Icon size={18} />
              </div>
              <div className="font-display text-2xl font-bold text-white">{value}</div>
              <div className="text-white/40 text-sm mt-1">{label}</div>
            </motion.div>
          ))}
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 p-1 glass rounded-2xl mb-8 w-fit">
          {([
            { id: 'trips'   as DashTab, label: 'My Trips',      icon: Plane   },
            { id: 'history' as DashTab, label: 'Search History', icon: History },
          ]).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === id ? 'bg-[#e91e8c] text-white shadow-lg shadow-[#e91e8c]/25' : 'text-white/50 hover:text-white'
              }`}>
              <Icon size={15} />{label}
              {id === 'history' && searchHistory.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-white/15 text-white text-xs flex items-center justify-center">
                  {searchHistory.length > 99 ? '99+' : searchHistory.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* MY TRIPS */}
          {activeTab === 'trips' && (
            <motion.div key="trips"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>

              <div className="flex flex-col sm:flex-row gap-3 mb-7">
                <div className="flex-1 relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search your trips..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#e91e8c]/40 transition-colors" />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-white/30 flex-shrink-0" />
                  {(['all', 'planned', 'ongoing', 'completed'] as const).map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                        statusFilter === s ? 'bg-[#e91e8c] text-white' : 'glass text-white/40 hover:text-white'
                      }`}>{s}</button>
                  ))}
                </div>
              </div>

              {filtered.length === 0 ? (
                <motion.div variants={fadeUp} initial="hidden" animate="visible" className="text-center py-24">
                  <div className="text-7xl mb-6">🗺️</div>
                  <h3 className="font-display text-2xl font-bold text-white mb-3">
                    {search ? 'No trips found' : 'No trips saved yet'}
                  </h3>
                  <p className="text-white/40 mb-8">
                    {search ? 'Try a different search' : 'Plan your first AI-powered adventure!'}
                  </p>
                  <Link to="/plan"
                    className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#e91e8c] to-[#f06ab3] text-white font-semibold hover:scale-105 transition-transform">
                    <Sparkles size={18} /> Plan My First Trip
                  </Link>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  <AnimatePresence>
                    {filtered.map((trip, i) => {
                      const st = STATUS_COLORS[trip.status]
                      const emoji = getEmoji(trip.destination)
                      const savedDate = new Date(trip.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      return (
                        <motion.div key={trip.id} custom={i} variants={fadeUp} initial="hidden" animate="visible"
                          exit={{ opacity: 0, scale: 0.95 }} layout
                          className="glass rounded-2xl overflow-hidden group hover:border-[#e91e8c]/20 transition-all duration-300">
                          <div className="h-36 flex items-center justify-center text-6xl relative overflow-hidden"
                            style={{ background: `linear-gradient(135deg, ${trip.status === 'completed' ? '#06d6a0' : trip.status === 'ongoing' ? '#ffd166' : '#e91e8c'}10, #0e0e1a20)` }}>
                            <motion.span whileHover={{ scale: 1.2, rotate: 10 }} transition={{ type: 'spring', stiffness: 300 }}>{emoji}</motion.span>
                            {/* Status badge — click to change status */}
                            <div className="absolute top-3 right-3">
                              <button
                                onClick={e => { e.stopPropagation(); setStatusMenuId(statusMenuId === trip.id ? null : trip.id) }}
                                className="px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                                style={{ background: st.bg, color: st.text }}
                                title="Change status"
                              >
                                {st.label} ▾
                              </button>
                              {statusMenuId === trip.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  className="absolute right-0 top-8 z-20 glass rounded-xl overflow-hidden shadow-xl border border-white/10 min-w-[120px]"
                                  onClick={e => e.stopPropagation()}
                                >
                                  {(['planned', 'ongoing', 'completed'] as const).map(s => (
                                    <button
                                      key={s}
                                      onClick={() => { updateTripStatus(trip.id, s); setStatusMenuId(null) }}
                                      className="w-full text-left px-3 py-2 text-xs capitalize hover:bg-white/8 transition-colors"
                                      style={{ color: STATUS_COLORS[s].text }}
                                    >
                                      {trip.status === s ? '✓ ' : ''}{STATUS_COLORS[s].label}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </div>
                            <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
                              <Link to={`/trips/${trip.id}`}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#e91e8c] text-white text-xs font-semibold">
                                <Eye size={13} /> View Plan
                              </Link>
                              <button onClick={() => setConfirmDelete(trip.id)}
                                className="p-2 rounded-xl bg-white/10 text-white/70 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                          <div className="p-5">
                            <h3 className="font-display font-bold text-white text-lg mb-1 truncate">{trip.destination}</h3>
                            <p className="text-white/40 text-xs flex items-center gap-1.5 mb-4"><MapPin size={10} />{trip.country}</p>
                            <div className="grid grid-cols-3 gap-2 text-center mb-4">
                              <div className="bg-white/4 rounded-xl p-2">
                                <div className="text-[#4cc9f0] font-bold text-sm">{trip.duration}d</div>
                                <div className="text-white/30 text-xs">Days</div>
                              </div>
                              <div className="bg-white/4 rounded-xl p-2">
                                <div className="text-[#e91e8c] font-bold text-sm">{trip.currency} {trip.totalCost.toLocaleString()}</div>
                                <div className="text-white/30 text-xs">Budget</div>
                              </div>
                              <div className="bg-white/4 rounded-xl p-2">
                                <div className="text-[#ffd166] font-bold text-sm capitalize">{trip.preferences.groupType}</div>
                                <div className="text-white/30 text-xs">Type</div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mb-4">
                              {trip.preferences.interests.slice(0, 3).map(interest => (
                                <span key={interest} className="text-xs px-2.5 py-1 rounded-full bg-[#e91e8c]/10 text-[#e91e8c] capitalize">{interest}</span>
                              ))}
                            </div>
                            <div className="flex items-center justify-between text-white/30 text-xs border-t border-white/5 pt-3">
                              <span className="flex items-center gap-1.5"><Calendar size={10} />{savedDate}</span>
                              <Link to={`/trips/${trip.id}`}
                                className="text-[#e91e8c] hover:text-[#f06ab3] transition-colors flex items-center gap-1">
                                View <Plane size={10} />
                              </Link>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              )}

              {savedTrips.length > 0 && (
                <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  className="mt-16 glass rounded-3xl p-8">
                  <h3 className="font-display text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <BarChart3 size={22} className="text-[#e91e8c]" /> Overview
                  </h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <div className="text-white/40 text-xs uppercase tracking-widest mb-4">Trip Status</div>
                      {(['planned', 'ongoing', 'completed'] as const).map(status => {
                        const count = savedTrips.filter(t => t.status === status).length
                        const pct = savedTrips.length > 0 ? (count / savedTrips.length) * 100 : 0
                        const s = STATUS_COLORS[status]
                        return (
                          <div key={status} className="mb-2">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="capitalize" style={{ color: s.text }}>{status}</span>
                              <span className="text-white/40">{count}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/5">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: s.text }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div>
                      <div className="text-white/40 text-xs uppercase tracking-widest mb-4">Top Interests</div>
                      <div className="flex flex-wrap gap-2">
                        {[...new Set(savedTrips.flatMap(t => t.preferences.interests))].slice(0, 8).map(i => (
                          <span key={i} className="px-3 py-1.5 rounded-full glass text-white/60 text-xs capitalize">{i}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/40 text-xs uppercase tracking-widest mb-4">Quick Actions</div>
                      <div className="space-y-2">
                        <Link to="/plan" className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#e91e8c]/10 text-[#e91e8c] text-sm font-medium hover:bg-[#e91e8c]/20 transition-colors">
                          <Sparkles size={15} /> Plan New Trip
                        </Link>
                        <Link to="/" className="flex items-center gap-2.5 px-4 py-3 rounded-xl glass text-white/60 text-sm font-medium hover:text-white hover:bg-white/5 transition-colors">
                          <Compass size={15} /> Explore Destinations
                        </Link>
                        <button onClick={() => setActiveTab('history')}
                          className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl glass text-white/60 text-sm font-medium hover:text-white hover:bg-white/5 transition-colors">
                          <History size={15} /> View Search History
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* SEARCH HISTORY */}
          {activeTab === 'history' && (
            <motion.div key="history"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>

              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-display text-xl font-bold text-white">Your Search History</h2>
                  <p className="text-white/40 text-sm mt-1">
                    {searchHistory.length === 0
                      ? 'No searches recorded yet'
                      : `${searchHistory.length} search${searchHistory.length !== 1 ? 'es' : ''} — private to your account`}
                  </p>
                </div>
                {searchHistory.length > 0 && (
                  <button onClick={clearSearchHistory}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl glass text-white/40 text-sm hover:text-red-400 transition-all">
                    <Trash2 size={14} /> Clear All
                  </button>
                )}
              </div>

              {searchHistory.length === 0 ? (
                <motion.div variants={fadeUp} initial="hidden" animate="visible"
                  className="text-center py-24 glass rounded-3xl">
                  <div className="text-6xl mb-5">🔍</div>
                  <h3 className="font-display text-xl font-bold text-white mb-3">No search history yet</h3>
                  <p className="text-white/40 text-sm mb-8 max-w-xs mx-auto">
                    Every trip you plan gets recorded here. Start chatting with the AI!
                  </p>
                  <Link to="/plan"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#e91e8c] to-[#f06ab3] text-white font-semibold hover:scale-105 transition-transform">
                    <MessageSquare size={16} /> Start Planning
                  </Link>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {searchHistory.map((entry: SearchHistoryEntry, i: number) => (
                    <motion.div key={entry.id} custom={i} variants={fadeUp} initial="hidden" animate="visible"
                      className="glass rounded-2xl p-5 flex items-start gap-4 group hover:border-[#e91e8c]/15 transition-all">
                      <div className="w-10 h-10 rounded-xl bg-[#e91e8c]/10 flex items-center justify-center flex-shrink-0 text-lg">
                        {getEmoji(entry.destination ?? entry.query)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-white font-semibold text-sm truncate">{entry.destination ?? entry.query}</h4>
                            <p className="text-white/35 text-xs mt-0.5 truncate italic">"{entry.query}"</p>
                          </div>
                          <span className="text-white/25 text-xs flex-shrink-0">{timeAgo(entry.searchedAt)}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {entry.duration && (
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#4cc9f0]/10 text-[#4cc9f0] text-xs">
                              <Clock size={10} />{entry.duration} days
                            </span>
                          )}
                          {entry.budget && (
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#ffd166]/10 text-[#ffd166] text-xs">
                              <DollarSign size={10} />{entry.currency} {entry.budget.toLocaleString()}
                            </span>
                          )}
                          {entry.interests?.slice(0, 3).map(int => (
                            <span key={int} className="px-2.5 py-1 rounded-full bg-[#e91e8c]/10 text-[#e91e8c] text-xs capitalize">{int}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Link to="/plan" title="Search again"
                          className="p-2 rounded-lg glass text-white/50 hover:text-[#e91e8c] transition-colors">
                          <RefreshCw size={14} />
                        </Link>
                        {entry.resultPlanId && savedTrips.find(t => t.id === entry.resultPlanId) && (
                          <Link to={`/trips/${entry.resultPlanId}`}
                            title="View plan" className="p-2 rounded-lg glass text-white/50 hover:text-[#4cc9f0] transition-colors">
                            <ChevronRight size={14} />
                          </Link>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                    className="mt-8 glass rounded-2xl p-6 grid sm:grid-cols-3 gap-5 border border-[#e91e8c]/10">
                    <div className="text-center">
                      <div className="text-white/40 text-xs mb-2 uppercase tracking-widest">Total Searches</div>
                      <div className="font-display text-3xl font-bold text-white">{searchHistory.length}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-white/40 text-xs mb-2 uppercase tracking-widest">Top Destination</div>
                      <div className="font-display text-lg font-bold gradient-text truncate">{topDestination}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-white/40 text-xs mb-2 uppercase tracking-widest">Avg. Budget</div>
                      <div className="font-display text-3xl font-bold text-white">{avgBudget}</div>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Delete confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-6"
            onClick={() => setConfirmDelete(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()} className="glass rounded-2xl p-7 max-w-sm w-full text-center">
              <div className="text-4xl mb-4">🗑️</div>
              <h3 className="font-display text-xl font-bold text-white mb-2">Delete this trip?</h3>
              <p className="text-white/40 text-sm mb-6">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 rounded-xl glass text-white/60 font-medium hover:text-white transition-colors">Cancel</button>
                <button onClick={() => { deleteTrip(confirmDelete); setConfirmDelete(null) }}
                  className="flex-1 py-3 rounded-xl bg-red-500/80 text-white font-medium hover:bg-red-500 transition-colors">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
