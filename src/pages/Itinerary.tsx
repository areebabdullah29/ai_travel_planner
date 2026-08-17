import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Clock, DollarSign, Star, Utensils, Zap,
  Heart, ArrowLeft, ChevronDown,
  ChevronUp, Sparkles, Calendar, Users, Globe,
  Plane, Hotel, Car, ShoppingBag, Coffee, AlertCircle,
  CheckCircle, X, LogIn, CloudSun, Droplets, MessageSquare,
} from 'lucide-react'
import { useTripContext } from '@/context/TripContext'
import { useAuth } from '@/context/AuthContext'
import TripMap from '@/components/TripMap'
import type { DayPlan, TripWeather } from '@/types'
import {
  fetchHotels,
  weatherEmoji, formatForecastDay,
  type RealHotel,
} from '@/services/weatherService'
import { fetchAgentWeather } from '@/services/agentService'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' as const }
  })
}

const COST_ICONS: Record<string, typeof Plane> = {
  flights: Plane,
  accommodation: Hotel,
  transport: Car,
  food: Coffee,
  activities: Zap,
  miscellaneous: ShoppingBag,
}

const COST_COLORS: Record<string, string> = {
  flights: '#4cc9f0',
  accommodation: '#ffd166',
  transport: '#06d6a0',
  food: '#e91e8c',
  activities: '#9b5de5',
  miscellaneous: '#8899aa',
}

export default function Itinerary() {
  const { currentPlan, savedTrips, saveTrip } = useTripContext()
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  // Resolve plan: prefer currentPlan when it matches the URL id,
  // otherwise find the saved trip by id (e.g. navigating from Dashboard)
  const plan = (currentPlan?.id === id ? currentPlan : null)
    ?? savedTrips.find(t => t.id === id)
    ?? null
  const [expandedDay, setExpandedDay] = useState<number | null>(1)
  const [saved, setSaved] = useState(false)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [activeTab, setActiveTab] = useState<'itinerary' | 'restaurants' | 'costs' | 'info' | 'weather' | 'conversation' | 'map'>('itinerary')
  // Weather is embedded in the plan — only fall back to live API for old plans
  const [liveWeather, setLiveWeather] = useState<TripWeather | null>(null)
  const [realHotels, setRealHotels] = useState<RealHotel[]>([])
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherFetched, setWeatherFetched] = useState(false)

  const loadWeather = (city: string) => {
    // If the plan already has embedded weather, just load hotels
    if (plan?.weather) {
      if (weatherFetched || weatherLoading) return
      setWeatherLoading(true)
      fetchHotels(city).then(h => {
        setRealHotels(h)
        setWeatherLoading(false)
        setWeatherFetched(true)
      })
      return
    }
    // Legacy plans without embedded weather — fetch live
    if (weatherFetched || weatherLoading) return
    setWeatherLoading(true)
    Promise.all([fetchAgentWeather(city, 5), fetchHotels(city)]).then(([w, h]) => {
      if (w) setLiveWeather(w as unknown as TripWeather)
      setRealHotels(h)
      setWeatherLoading(false)
      setWeatherFetched(true)
    })
  }

  const displayWeather: TripWeather | null = plan?.weather ?? liveWeather

  if (!plan) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 pt-20 gap-6">
        <div className="glass rounded-3xl p-12 text-center max-w-md">
          <div className="text-6xl mb-6">🗺️</div>
          <h2 className="font-display text-2xl font-bold text-white mb-3">No Trip Plan Yet</h2>
          <p className="text-white/50 mb-6">Chat with our AI to generate your personalized itinerary</p>
          <Link
            to="/plan"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#e91e8c] to-[#f06ab3] text-white font-semibold hover:scale-105 transition-transform"
          >
            <Sparkles size={18} /> Start Planning
          </Link>
        </div>
      </div>
    )
  }

  const {
    destination, country, duration, totalCost, currency,
    highlights, bestTime, itinerary, restaurants,
    practicalInfo, costBreakdown, preferences
  } = plan
  const origin = preferences?.departureCity && preferences.departureCity !== 'Your city'
    ? preferences.departureCity : null
  const travelers = preferences?.travelers ?? null

  const handleSave = () => {
    if (!isAuthenticated) {
      setShowAuthPrompt(true)
      return
    }
    saveTrip(plan)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const totalBreakdown = Object.values(costBreakdown).reduce((a, b) => a + b, 0)

  const costTableData = [
    {
      category: 'flights',
      unit: 'trip',
      rate: costBreakdown.flights,
      qty: 1,
      total: costBreakdown.flights,
      notes: 'Round trip airfare',
    },
    {
      category: 'accommodation',
      unit: 'night',
      rate: Math.round(costBreakdown.accommodation / duration),
      qty: duration,
      total: costBreakdown.accommodation,
      notes: `${duration} nights`,
    },
    {
      category: 'food',
      unit: 'day',
      rate: Math.round(costBreakdown.food / duration),
      qty: duration,
      total: costBreakdown.food,
      notes: 'Meals & dining',
    },
    {
      category: 'activities',
      unit: 'day',
      rate: Math.round(costBreakdown.activities / duration),
      qty: duration,
      total: costBreakdown.activities,
      notes: 'Excursions & tours',
    },
    {
      category: 'transport',
      unit: 'day',
      rate: Math.round(costBreakdown.transport / duration),
      qty: duration,
      total: costBreakdown.transport,
      notes: 'Local transport',
    },
    {
      category: 'miscellaneous',
      unit: 'trip',
      rate: costBreakdown.miscellaneous,
      qty: 1,
      total: costBreakdown.miscellaneous,
      notes: 'Shopping & tips',
    },
  ]

  return (
    <div className="min-h-screen pt-20 pb-16">

      {/* Sign-in prompt modal (guest save attempt) */}
      <AnimatePresence>
        {showAuthPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: 'rgba(6,6,14,0.85)' }}
            onClick={() => setShowAuthPrompt(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' as const }}
              className="glass rounded-3xl p-8 max-w-md w-full border border-white/10 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setShowAuthPrompt(false)}
                className="absolute top-4 right-4 p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X size={18} />
              </button>

              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#e91e8c] to-[#ffd166] flex items-center justify-center mb-5 mx-auto">
                <Heart size={24} className="text-white" />
              </div>

              <h2 className="font-display text-2xl font-bold text-white text-center mb-2">
                Save Your Trip
              </h2>
              <p className="text-white/50 text-sm text-center mb-6 leading-relaxed">
                Create a free account to save this itinerary, access your personal dashboard, and keep all your trips in one place.
              </p>

              <div className="flex flex-col gap-3">
                <Link
                  to="/register"
                  state={{ from: '/itinerary' }}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-[#e91e8c] to-[#f06ab3] text-white font-bold hover:shadow-xl hover:shadow-[#e91e8c]/30 hover:scale-[1.02] transition-all duration-200"
                >
                  <Sparkles size={16} /> Create Free Account
                </Link>
                <Link
                  to="/login"
                  state={{ from: '/itinerary' }}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-2xl glass text-white/70 font-semibold hover:text-white transition-colors"
                >
                  <LogIn size={16} /> Sign In
                </Link>
              </div>

              <p className="text-white/25 text-xs text-center mt-4">
                You can continue browsing without an account
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Banner */}
      <div className="relative h-72 md:h-80 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, #e91e8c 0%, #ffd166 50%, #4cc9f0 100%)`,
            opacity: 0.15,
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' as const }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-coral text-[#e91e8c] text-sm font-medium mb-5">
              <Sparkles size={14} /> AI-Generated Itinerary
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-extrabold text-white mb-4">
              {destination}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-5 text-white/60 text-sm">
              {origin && (
                <span className="flex items-center gap-2">
                  <Plane size={15} className="text-[#06d6a0]" />
                  {origin} → {destination}
                </span>
              )}
              <span className="flex items-center gap-2">
                <Globe size={15} className="text-[#4cc9f0]" />
                {country}
              </span>
              <span className="flex items-center gap-2">
                <Calendar size={15} className="text-[#ffd166]" />
                {duration} days
              </span>
              {travelers !== null && (
                <span className="flex items-center gap-2">
                  <Users size={15} className="text-[#9b5de5]" />
                  {travelers} traveller{travelers === 1 ? '' : 's'}
                </span>
              )}
              <span className="flex items-center gap-2">
                <span className="text-[#e91e8c] font-semibold text-sm">{currency}</span>
                {totalCost.toLocaleString()} total
              </span>
              <span className="flex items-center gap-2">
                <Star size={15} className="text-[#ffd166]" fill="#ffd166" />
                Best: {bestTime}
              </span>
            </div>
          </motion.div>
        </div>

        {/* Action buttons */}
        <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 glass px-4 py-2 rounded-xl text-white/70 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>

        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 mt-8">
        {/* Highlights */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="visible"
          className="glass rounded-2xl p-6 mb-8"
        >
          <h3 className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-4">Trip Highlights</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {highlights.map((h, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#e91e8c]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle size={11} className="text-[#e91e8c]" />
                </div>
                <span className="text-white/70 text-sm">{h}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Budget overage warning */}
        {preferences?.budget && preferences.budget > 0 && totalCost > preferences.budget * 1.05 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-4 mb-6 flex items-start gap-3 border border-[#ffd166]/30 bg-[#ffd166]/5"
          >
            <AlertCircle size={18} className="text-[#ffd166] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[#ffd166] font-semibold text-sm">Estimated cost exceeds your budget</p>
              <p className="text-white/50 text-xs mt-0.5">
                Estimated {currency} {totalCost.toLocaleString()} vs your budget of {currency} {preferences.budget.toLocaleString()}.
                Consider reducing duration, choosing budget accommodation, or adjusting activities.
              </p>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 p-1 glass rounded-2xl mb-8">
          {(['itinerary', 'map', 'restaurants', 'costs', 'info', 'weather', 'conversation'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                if (tab === 'weather') loadWeather(destination)
              }}
              className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs sm:text-sm font-semibold capitalize transition-all ${
                activeTab === tab
                  ? 'bg-[#e91e8c] text-white shadow-lg'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {tab === 'info' ? 'Info'
                : tab === 'weather' ? '🌤 Weather'
                : tab === 'conversation' ? 'Chat'
                : tab === 'map' ? '🗺 Map'
                : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── ITINERARY TAB ── */}
          {activeTab === 'itinerary' && (
            <motion.div
              key="itinerary"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              {itinerary.map((day: DayPlan, i: number) => (
                <motion.div
                  key={day.day}
                  custom={i} variants={fadeUp} initial="hidden" animate="visible"
                  className="glass rounded-2xl overflow-hidden"
                >
                  {/* Day Header */}
                  <button
                    onClick={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
                    className="w-full flex items-center justify-between p-5 hover:bg-white/3 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#e91e8c] to-[#ffd166] flex items-center justify-center text-white font-display font-bold text-sm flex-shrink-0">
                        {day.day}
                      </div>
                      <div>
                        <div className="text-white font-semibold text-base">{day.title}</div>
                        <div className="text-white/40 text-sm mt-0.5">
                          {day.activities.length} activities · Est. {currency} {day.estimatedCost}
                        </div>
                      </div>
                    </div>
                    <div className="text-white/40">
                      {expandedDay === day.day ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {expandedDay === day.day && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
                          {/* Activities */}
                          <div className="space-y-3">
                            {day.activities.map((activity, ai) => (
                              <div key={ai} className="flex items-start gap-4 p-3 rounded-xl bg-white/3">
                                <div className="text-[#e91e8c]/60 font-mono text-xs pt-0.5 w-12 flex-shrink-0">
                                  {activity.time}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-white font-medium text-sm">{activity.name}</div>
                                  <div className="text-white/40 text-xs mt-0.5">{activity.description}</div>
                                  <div className="flex items-center gap-3 mt-1.5">
                                    <span className="flex items-center gap-1 text-white/30 text-xs">
                                      <Clock size={10} />{activity.duration}
                                    </span>
                                    {activity.cost > 0 && (
                                      <span className="flex items-center gap-1 text-white/30 text-xs">
                                        {currency} {activity.cost}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-[#e91e8c]/10 text-[#e91e8c] flex-shrink-0">
                                  {activity.category}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Meals */}
                          <div className="p-4 rounded-xl bg-[#ffd166]/5 border border-[#ffd166]/10">
                            <div className="flex items-center gap-2 text-[#ffd166] text-xs font-semibold mb-2.5">
                              <Utensils size={12} /> Meals
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              {(['breakfast', 'lunch', 'dinner'] as const).map(meal => (
                                day.meals[meal] && (
                                  <div key={meal}>
                                    <div className="text-white/30 text-xs capitalize mb-1">{meal}</div>
                                    <div className="text-white/70 text-xs">{day.meals[meal]}</div>
                                  </div>
                                )
                              ))}
                            </div>
                          </div>

                          {/* Accommodation */}
                          {day.accommodation && (
                            <div className="flex items-center gap-3 text-white/50 text-sm">
                              <Hotel size={14} className="text-[#4cc9f0]" />
                              <span>Stay: {day.accommodation}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* ── RESTAURANTS TAB ── */}
          {activeTab === 'restaurants' && (
            <motion.div
              key="restaurants"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {restaurants.map((r, i) => (
                <motion.div
                  key={r.name}
                  custom={i} variants={fadeUp} initial="hidden" animate="visible"
                  className="glass rounded-2xl p-5 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-[#e91e8c]/10 flex items-center justify-center text-2xl">
                      🍽️
                    </div>
                    <div className="flex items-center gap-1 bg-[#ffd166]/10 px-2.5 py-1 rounded-full">
                      <Star size={11} className="text-[#ffd166]" fill="#ffd166" />
                      <span className="text-[#ffd166] text-xs font-bold">{r.rating}</span>
                    </div>
                  </div>
                  <h3 className="font-display font-bold text-white text-lg mb-1">{r.name}</h3>
                  <p className="text-white/40 text-sm mb-3">{r.specialty}</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <Utensils size={11} className="text-[#e91e8c]" />
                      {r.cuisine} Cuisine
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <DollarSign size={11} className="text-[#ffd166]" />
                      {r.priceRange === '$' ? 'Budget-friendly' : r.priceRange === '$$' ? 'Mid-range' : 'Upscale'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <MapPin size={11} className="text-[#4cc9f0]" />
                      {r.location}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* ── COSTS TAB ── */}
          {activeTab === 'costs' && (
            <motion.div
              key="costs"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-5"
            >
              {/* Total */}
              <div className="glass rounded-2xl p-6 text-center">
                <div className="text-white/50 text-sm mb-2">Total Estimated Cost</div>
                <div className="font-display text-5xl font-extrabold gradient-text">
                  {currency} {totalCost.toLocaleString()}
                </div>
                <div className="text-white/40 text-sm mt-2">for {duration} days · {plan.preferences.groupType}</div>
              </div>

              {/* Breakdown Table */}
              <div className="glass rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-5">Cost Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/30 text-xs uppercase tracking-wider border-b border-white/8">
                        <th className="text-left pb-3 font-medium">Category</th>
                        <th className="text-right pb-3 font-medium">Rate</th>
                        <th className="text-right pb-3 font-medium">×</th>
                        <th className="text-left pb-3 pl-1 font-medium">Unit</th>
                        <th className="text-right pb-3 font-medium">Total</th>
                        <th className="text-right pb-3 font-medium hidden sm:table-cell">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costTableData.map(({ category, unit, rate, qty, total, notes }, idx) => {
                        const Icon = COST_ICONS[category] || DollarSign
                        const color = COST_COLORS[category] || '#8899aa'
                        const pct = Math.round((total / totalBreakdown) * 100)
                        return (
                          <motion.tr
                            key={category}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.06, duration: 0.35 }}
                            className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors"
                          >
                            <td className="py-3.5 pr-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18`, color }}>
                                  <Icon size={13} />
                                </div>
                                <div>
                                  <div className="text-white/85 capitalize font-medium leading-tight">{category}</div>
                                  <div className="text-white/30 text-xs">{notes}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 text-right text-white/55 text-xs whitespace-nowrap">
                              {currency} {rate.toLocaleString()}
                            </td>
                            <td className="py-3.5 text-right text-white/40 font-mono">
                              {qty}
                            </td>
                            <td className="py-3.5 pl-1 text-white/30 text-xs">
                              /{unit}
                            </td>
                            <td className="py-3.5 text-right font-semibold text-white whitespace-nowrap">
                              {currency} {total.toLocaleString()}
                            </td>
                            <td className="py-3.5 hidden sm:table-cell">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-14 h-1.5 rounded-full bg-white/8 overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ delay: 0.3 + idx * 0.06, duration: 0.7, ease: 'easeOut' }}
                                    className="h-full rounded-full"
                                    style={{ background: color }}
                                  />
                                </div>
                                <span className="text-white/30 text-xs w-7 text-right">{pct}%</span>
                              </div>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-white/10">
                        <td colSpan={4} className="pt-4 pb-1 text-white/50 font-semibold text-sm">Grand Total</td>
                        <td className="pt-4 pb-1 text-right font-display font-extrabold text-lg gradient-text whitespace-nowrap">
                          {currency} {totalBreakdown.toLocaleString()}
                        </td>
                        <td className="hidden sm:table-cell" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Per day */}
              <div className="glass rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <div className="text-white/50 text-sm">Daily Budget</div>
                  <div className="font-display text-2xl font-bold text-white mt-1">
                    {currency} {Math.round(totalCost / duration).toLocaleString()}
                    <span className="text-white/40 text-base font-normal"> / day</span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-[#ffd166]/10 flex items-center justify-center">
                  <DollarSign size={22} className="text-[#ffd166]" />
                </div>
              </div>
            </motion.div>
          )}

          {/* ── WEATHER TAB ── */}
          {activeTab === 'weather' && (
            <motion.div
              key="weather"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-5"
            >
              {weatherLoading ? (
                <div className="glass rounded-2xl p-10 text-center">
                  <div className="text-4xl mb-3 animate-spin inline-block">🌀</div>
                  <p className="text-white/50">Loading weather data…</p>
                </div>
              ) : displayWeather ? (
                <>
                  {/* Month suitability banner (only when travel month is known) */}
                  {displayWeather.travel_month && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`glass rounded-2xl p-4 flex items-start gap-3 border ${
                        displayWeather.suitability === 'excellent'
                          ? 'border-[#06d6a0]/30 bg-[#06d6a0]/5'
                          : displayWeather.suitability === 'poor'
                          ? 'border-[#ffd166]/30 bg-[#ffd166]/5'
                          : 'border-white/10'
                      }`}
                    >
                      <span className="text-2xl flex-shrink-0">
                        {displayWeather.suitability === 'excellent' ? '✅'
                          : displayWeather.suitability === 'poor' ? '⚠️' : '🌤'}
                      </span>
                      <div>
                        <p className={`font-semibold text-sm ${
                          displayWeather.suitability === 'excellent' ? 'text-[#06d6a0]'
                            : displayWeather.suitability === 'poor' ? 'text-[#ffd166]'
                            : 'text-white'
                        }`}>
                          {displayWeather.travel_month} in {destination} —{' '}
                          {displayWeather.suitability === 'excellent' ? 'Excellent time to visit!'
                            : displayWeather.suitability === 'poor' ? 'Poor season — see advice below'
                            : 'Fair travel conditions'}
                        </p>
                        {displayWeather.travel_advisory && (
                          <p className="text-white/55 text-xs mt-1 leading-relaxed">
                            {displayWeather.travel_advisory}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Header with data source badge */}
                  <div className="glass rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Weather Forecast</div>
                        <h3 className="font-display text-2xl font-bold text-white">{displayWeather.city || destination}</h3>
                      </div>
                      <span className="text-xs px-3 py-1.5 rounded-full glass text-white/50 border border-white/10">
                        <CloudSun size={11} className="inline mr-1.5 text-[#4cc9f0]" />
                        {displayWeather.source?.includes('live') || displayWeather.source?.includes('OpenWeather')
                          ? 'Live data'
                          : 'Seasonal estimates'}
                      </span>
                    </div>

                    {/* Forecast grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {displayWeather.forecast.map((day, i) => (
                        <motion.div
                          key={day.date}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.07 }}
                          className="rounded-xl p-4 bg-white/3 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-white/50 text-xs font-medium">{formatForecastDay(day.date)}</div>
                            <span className="text-xl">{weatherEmoji(day.conditions)}</span>
                          </div>
                          {day.temp_min !== undefined && day.temp_max !== undefined ? (
                            <div className="font-display font-bold text-white text-xl mb-1">
                              {day.temp_min}° – {day.temp_max}°<span className="text-white/30 text-sm font-normal">C</span>
                            </div>
                          ) : day.temp_range ? (
                            <div className="font-display font-bold text-white text-base mb-1">{day.temp_range}</div>
                          ) : null}
                          <div className="text-white/50 text-xs mb-2">{day.conditions}</div>
                          {day.rain_probability && (
                            <div className="flex items-center gap-2 text-white/30 text-xs">
                              <Droplets size={10} className="text-[#4cc9f0]" />
                              {day.rain_probability} rain chance
                            </div>
                          )}
                          {day.advisory && day.advisory !== 'Pleasant conditions for travel.' && (
                            <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-[#ffd166]/10 border border-[#ffd166]/20">
                              <AlertCircle size={12} className="text-[#ffd166] flex-shrink-0 mt-0.5" />
                              <p className="text-[#ffd166] text-xs leading-relaxed">{day.advisory}</p>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Hotels */}
                  {realHotels.length > 0 && (
                    <div className="glass rounded-2xl p-6">
                      <h3 className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-4">
                        <Hotel size={13} className="inline mr-2 text-[#ffd166]" />
                        Hotels Near {destination}
                      </h3>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {realHotels.slice(0, 9).map((h, i) => (
                          <motion.div
                            key={h.xid || i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-start gap-3 p-3 rounded-xl bg-white/3 hover:bg-white/5 transition-colors"
                          >
                            <div className="w-9 h-9 rounded-xl bg-[#ffd166]/10 flex items-center justify-center flex-shrink-0">
                              <Hotel size={16} className="text-[#ffd166]" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-white font-medium text-sm truncate">{h.name}</div>
                              <div className="text-white/30 text-xs mt-0.5">{h.dist} m from center</div>
                              {h.rate > 0 && (
                                <div className="flex items-center gap-0.5 mt-1">
                                  {Array.from({ length: Math.min(h.rate, 5) }).map((_, j) => (
                                    <Star key={j} size={9} className="text-[#ffd166]" fill="#ffd166" />
                                  ))}
                                </div>
                          )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="glass rounded-2xl p-10 text-center">
                  <div className="text-4xl mb-3">☁️</div>
                  <h3 className="text-white font-semibold mb-2">Weather data unavailable</h3>
                  <p className="text-white/40 text-sm">
                    Make sure the backend is running and <code className="text-[#e91e8c]">OPENWEATHER_API_KEY</code> is configured.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── CONVERSATION TAB ── */}
          {activeTab === 'conversation' && (
            <motion.div
              key="conversation"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              {!plan.conversation || plan.conversation.length === 0 ? (
                <div className="glass rounded-2xl p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#e91e8c]/10 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare size={24} className="text-[#e91e8c]/50" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">No conversation recorded</h3>
                  <p className="text-white/40 text-sm">
                    The chat transcript is saved when a trip is generated from an AI conversation.
                  </p>
                </div>
              ) : (
                <div className="glass rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/8">
                    <MessageSquare size={16} className="text-[#e91e8c]" />
                    <span className="text-white font-semibold text-sm">Planning Conversation</span>
                    <span className="ml-auto text-white/30 text-xs">{plan.conversation.length} messages · read-only</span>
                  </div>
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                    {plan.conversation.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                          msg.role === 'user'
                            ? 'bg-[#4cc9f0]/20 text-[#4cc9f0]'
                            : 'bg-gradient-to-br from-[#e91e8c] to-[#ffd166]'
                        }`}>
                          {msg.role === 'user' ? 'U' : <Sparkles size={12} className="text-white" />}
                        </div>
                        <div className={`max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                            msg.role === 'user'
                              ? 'bg-[#4cc9f0]/10 text-white/85 rounded-tr-sm'
                              : 'glass text-white/80 rounded-tl-sm'
                          }`}>
                            {msg.content}
                          </div>
                          <span className="text-white/20 text-xs px-1">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── MAP TAB ── */}
          {activeTab === 'map' && (
            <motion.div
              key="map"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <TripMap
                destination={destination}
                country={country}
                itinerary={itinerary}
                hotels={itinerary.map(d => d.accommodation).filter(Boolean) as string[]}
              />
            </motion.div>
          )}

          {/* ── INFO TAB ── */}
          {activeTab === 'info' && (
            <motion.div
              key="info"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid md:grid-cols-2 gap-5"
            >
              {[
                { icon: Globe, label: 'Language', value: practicalInfo.language, color: '#4cc9f0' },
                { icon: Clock, label: 'Timezone', value: practicalInfo.timezone, color: '#ffd166' },
                { icon: DollarSign, label: 'Currency', value: practicalInfo.currency, color: '#e91e8c' },
                { icon: Users, label: 'Tipping', value: practicalInfo.tipping, color: '#06d6a0' },
                { icon: Car, label: 'Transportation', value: practicalInfo.transportation, color: '#9b5de5' },
                { icon: AlertCircle, label: 'Best Season', value: bestTime, color: '#ffd166' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="glass rounded-2xl p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}15`, color }}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="text-white/40 text-xs mb-1">{label}</div>
                    <div className="text-white font-medium text-sm">{value}</div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom CTA */}
        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleSave}
            className={`flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl font-semibold transition-all duration-300 ${
              saved
                ? 'bg-[#06d6a0] text-white'
                : 'bg-gradient-to-r from-[#e91e8c] to-[#f06ab3] text-white hover:shadow-xl hover:shadow-[#e91e8c]/30 hover:scale-105'
            }`}
          >
            {saved ? <CheckCircle size={18} /> : <Heart size={18} />}
            {saved ? 'Saved to Dashboard!' : 'Save This Trip'}
          </button>
          <Link
            to="/plan"
            className="flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl glass text-white/70 font-semibold hover:text-white hover:bg-white/5 transition-all"
          >
            <Sparkles size={18} /> Plan Another Trip
          </Link>
          <Link
            to="/dashboard"
            className="flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl glass text-white/70 font-semibold hover:text-white hover:bg-white/5 transition-all"
          >
            View Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
