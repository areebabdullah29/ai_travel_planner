import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plane, Clock, ArrowRight, ExternalLink, Loader2, Search, AlertCircle, Users } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

interface FlightLeg {
  airline: string
  airline_name: string
  from: string
  to: string
  departure: string
  arrival: string
}

interface Flight {
  id: string
  price: number
  currency: string
  airlines: string[]
  airline_names: string[]
  from: string
  to: string
  city_from: string
  city_to: string
  departure: string
  arrival: string
  duration_mins: number
  stops: number
  deep_link: string
  route: FlightLeg[]
}

interface SearchResult {
  flights:  Flight[]
  currency: string
  from:     string
  to:       string
  count:    number
  source?:  string
  note?:    string
}

interface Props {
  originCity:  string
  destination: string
  startDate?:  string   // ISO date string e.g. "2024-03-15"
  endDate?:    string
  travelers:   number
  currency:    string
}

// Convert ISO date "2024-03-15" → "15/03/2024" for Kiwi API
function toKiwiDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m > 0 ? ` ${m}m` : ''}`
}

export default function FlightSearch({ originCity, destination, startDate, endDate, travelers, currency }: Props) {
  const today   = new Date().toISOString().split('T')[0]
  const [depDate,  setDepDate]  = useState(startDate  || today)
  const [retDate,  setRetDate]  = useState(endDate    || '')
  const [adults,   setAdults]   = useState(Math.max(1, travelers || 1))
  const [flights,  setFlights]  = useState<Flight[]>([])
  const [source,   setSource]   = useState<string>('')
  const [note,     setNote]     = useState<string>('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const search = async () => {
    if (!depDate || !originCity || !destination) return
    setLoading(true)
    setError(null)

    const p = new URLSearchParams({
      fly_from:  originCity,
      fly_to:    destination,
      date_from: toKiwiDate(depDate),
      date_to:   toKiwiDate(depDate),
      adults:    String(adults),
      curr:      currency || 'PKR',
      limit:     '8',
    })
    if (retDate) {
      p.set('return_from', toKiwiDate(retDate))
      p.set('return_to',   toKiwiDate(retDate))
    }

    try {
      const res  = await fetch(`${API_URL}/api/flights/search?${p}`)
      const data = await res.json()
      if (data.success) {
        setFlights(data.data.flights)
        setSource(data.data.source || '')
        setNote(data.data.note || '')
        if (data.data.flights.length === 0) setError('No flights found for these dates. Try different dates.')
      } else {
        setError(data.error || 'Flight search failed')
      }
    } catch {
      setError('Could not connect to the flight service. Make sure the backend is running.')
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }

  // Auto-search when component mounts if we have a departure city
  useEffect(() => {
    if (originCity && originCity !== 'Your city' && depDate) search()
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">

      {/* Search form */}
      <div className="glass rounded-2xl p-5 border border-white/8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-[#4cc9f0]/15 flex items-center justify-center">
            <Plane size={15} className="text-[#4cc9f0]" />
          </div>
          <h3 className="font-display text-white font-bold">Flight Search</h3>
          <span className="ml-auto text-white/25 text-xs">
            {source === 'skyscanner' ? '✓ Live Skyscanner data' : 'Estimated prices · Book on Skyscanner'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {/* From */}
          <div className="flex flex-col gap-1">
            <label className="text-white/40 text-[10px] uppercase tracking-wide">From</label>
            <div className="glass rounded-xl px-3 py-2.5 text-white text-sm border border-white/10 bg-white/5">
              {originCity || '—'}
            </div>
          </div>

          {/* To */}
          <div className="flex flex-col gap-1">
            <label className="text-white/40 text-[10px] uppercase tracking-wide">To</label>
            <div className="glass rounded-xl px-3 py-2.5 text-white text-sm border border-white/10 bg-white/5">
              {destination}
            </div>
          </div>

          {/* Departure */}
          <div className="flex flex-col gap-1">
            <label className="text-white/40 text-[10px] uppercase tracking-wide">Departure</label>
            <input
              type="date"
              value={depDate}
              min={today}
              onChange={e => setDepDate(e.target.value)}
              className="glass rounded-xl px-3 py-2.5 text-white text-sm border border-white/10 bg-[#06060e] focus:border-[#e91e8c]/50 outline-none transition-colors"
            />
          </div>

          {/* Return */}
          <div className="flex flex-col gap-1">
            <label className="text-white/40 text-[10px] uppercase tracking-wide">Return (optional)</label>
            <input
              type="date"
              value={retDate}
              min={depDate || today}
              onChange={e => setRetDate(e.target.value)}
              className="glass rounded-xl px-3 py-2.5 text-white text-sm border border-white/10 bg-[#06060e] focus:border-[#e91e8c]/50 outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-white/30" />
            <label className="text-white/40 text-xs">Adults</label>
            <select
              value={adults}
              onChange={e => setAdults(Number(e.target.value))}
              className="glass rounded-lg px-2 py-1.5 text-white text-sm border border-white/10 bg-[#06060e] outline-none"
            >
              {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <button
            onClick={search}
            disabled={loading || !depDate}
            className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#e91e8c] to-[#f06ab3] text-white font-semibold text-sm hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-[#e91e8c]/20"
          >
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Searching…</>
              : <><Search size={14} /> Search Flights</>
            }
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 glass rounded-2xl p-4 border border-red-500/20">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass rounded-2xl p-5 border border-white/8 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/10 rounded-lg w-3/4" />
                  <div className="h-3 bg-white/5 rounded-lg w-1/2" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="h-6 bg-white/10 rounded-lg w-24" />
                  <div className="h-7 bg-[#e91e8c]/20 rounded-lg w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && flights.length > 0 && (
        <div className="space-y-3">
          <p className="text-white/30 text-xs px-1">
            {flights.length} flights found · sorted by price · {retDate ? 'Round trip' : 'One way'}
            {source !== 'skyscanner' && (
              <span className="text-yellow-400/50"> · Estimated prices — click Book for live rates</span>
            )}
            {note && source === 'mock' && (
              <span className="text-white/20"> · {note}</span>
            )}
          </p>

          {flights.map((f, i) => (
            <motion.div
              key={f.id || i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="glass rounded-2xl p-5 border border-white/8 hover:border-[#e91e8c]/30 transition-all"
            >
              <div className="flex items-center gap-4">

                {/* Airline icon */}
                <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-[#4cc9f0]/20 to-[#9b5de5]/20 flex items-center justify-center border border-white/10">
                  <Plane size={18} className="text-[#4cc9f0]" />
                </div>

                {/* Route timeline */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-center">
                      <div className="text-white font-bold text-base leading-none">{formatTime(f.departure)}</div>
                      <div className="text-white/35 text-[10px] mt-0.5">{f.from}</div>
                    </div>

                    <div className="flex-1 flex flex-col items-center gap-0.5 px-1">
                      <div className="text-white/25 text-[9px]">
                        {f.stops === 0 ? '✈ Direct' : `${f.stops} stop${f.stops > 1 ? 's' : ''}`}
                      </div>
                      <div className="w-full flex items-center gap-1">
                        <div className="flex-1 h-px bg-white/15" />
                        <ArrowRight size={10} className="text-white/30 shrink-0" />
                      </div>
                      <div className="flex items-center gap-1 text-white/25 text-[9px]">
                        <Clock size={8} /> {formatDuration(f.duration_mins)}
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-white font-bold text-base leading-none">{formatTime(f.arrival)}</div>
                      <div className="text-white/35 text-[10px] mt-0.5">{f.to}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    <span className="text-white/25 text-[10px]">{formatDateShort(f.departure)}</span>
                    <span className="text-white/10">·</span>
                    {f.airline_names.map((name, ni) => (
                      <span key={ni} className="text-white/30 text-[10px] bg-white/5 rounded px-1.5 py-0.5">{name}</span>
                    ))}
                  </div>
                </div>

                {/* Price + Book */}
                <div className="shrink-0 text-right pl-2">
                  <div className="text-[#e91e8c] font-extrabold text-xl leading-none">
                    {currency} {f.price.toLocaleString()}
                  </div>
                  <div className="text-white/25 text-[10px] mt-0.5 mb-2.5">per person</div>
                  <a
                    href={f.deep_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e91e8c]/15 text-[#e91e8c] text-xs font-semibold hover:bg-[#e91e8c] hover:text-white transition-all border border-[#e91e8c]/30"
                  >
                    Book <ExternalLink size={10} />
                  </a>
                </div>
              </div>

              {/* Leg breakdown for connecting flights */}
              {f.route.length > 1 && (
                <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-2">
                  {f.route.map((leg, li) => (
                    <div key={li} className="flex items-center gap-1 text-[10px] text-white/25 bg-white/5 rounded-lg px-2 py-1">
                      <span className="font-medium">{leg.from}</span>
                      <ArrowRight size={8} />
                      <span className="font-medium">{leg.to}</span>
                      <span className="text-white/15 ml-1">{leg.airline_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty state (after search, no results, no error) */}
      {searched && !loading && flights.length === 0 && !error && (
        <div className="glass rounded-2xl p-10 text-center border border-white/8">
          <div className="text-5xl mb-3">✈️</div>
          <p className="text-white font-semibold mb-1">No flights found</p>
          <p className="text-white/40 text-sm">Try different dates or check the departure city name.</p>
        </div>
      )}
    </div>
  )
}
