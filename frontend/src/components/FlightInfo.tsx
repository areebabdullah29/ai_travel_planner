/**
 * Shows the flights that the AI already planned in the itinerary.
 * Uses plan data (route, cost, dates) — not an independent search —
 * so it always matches what's in the itinerary.
 */
import { motion } from 'framer-motion'
import { Plane, ArrowRight, Clock, Users, ExternalLink, Info } from 'lucide-react'
import type { TripPlan } from '@/types'

// Popular airlines per region — shown as suggestions
const ROUTE_AIRLINES: Record<string, { code: string; name: string; logo: string }[]> = {
  europe: [
    { code: 'EK', name: 'Emirates',       logo: '🇦🇪' },
    { code: 'QR', name: 'Qatar Airways',  logo: '🇶🇦' },
    { code: 'TK', name: 'Turkish Airlines', logo: '🇹🇷' },
    { code: 'EY', name: 'Etihad',         logo: '🇦🇪' },
  ],
  middleeast: [
    { code: 'EK', name: 'Emirates',       logo: '🇦🇪' },
    { code: 'PK', name: 'PIA',            logo: '🇵🇰' },
    { code: 'G9', name: 'Air Arabia',     logo: '🇦🇪' },
    { code: 'FZ', name: 'flydubai',       logo: '🇦🇪' },
  ],
  asia: [
    { code: 'EK', name: 'Emirates',       logo: '🇦🇪' },
    { code: 'QR', name: 'Qatar Airways',  logo: '🇶🇦' },
    { code: 'SQ', name: 'Singapore Air',  logo: '🇸🇬' },
    { code: 'MH', name: 'Malaysia Airlines', logo: '🇲🇾' },
  ],
  default: [
    { code: 'EK', name: 'Emirates',       logo: '🇦🇪' },
    { code: 'QR', name: 'Qatar Airways',  logo: '🇶🇦' },
    { code: 'EY', name: 'Etihad Airways', logo: '🇦🇪' },
    { code: 'TK', name: 'Turkish Airlines', logo: '🇹🇷' },
  ],
}

const EUROPE_COUNTRIES = [
  'greece', 'italy', 'france', 'spain', 'germany', 'uk', 'england',
  'netherlands', 'austria', 'switzerland', 'portugal', 'turkey',
  'croatia', 'czech republic', 'hungary', 'poland', 'sweden', 'norway',
  'denmark', 'finland', 'ireland', 'belgium',
]
const ME_COUNTRIES = ['uae', 'qatar', 'bahrain', 'kuwait', 'oman', 'saudi arabia', 'jordan', 'egypt']

function getRegionAirlines(country: string) {
  const c = country.toLowerCase()
  if (EUROPE_COUNTRIES.some(e => c.includes(e))) return ROUTE_AIRLINES.europe
  if (ME_COUNTRIES.some(e => c.includes(e))) return ROUTE_AIRLINES.middleeast
  if (c.includes('asia') || c.includes('thailand') || c.includes('bali') || c.includes('indonesia')
      || c.includes('singapore') || c.includes('malaysia') || c.includes('japan') || c.includes('korea'))
    return ROUTE_AIRLINES.asia
  return ROUTE_AIRLINES.default
}

// Build Skyscanner & Google Flights deep-link for a given route
function skyscannerUrl(from: string, to: string, date: string, adults: number) {
  // date in yyyy-mm-dd → YYMMDD
  const compact = date.replace(/-/g, '').slice(2)
  const fromSlug = from.toLowerCase().replace(/\s+/g, '-')
  const toSlug   = to.toLowerCase().replace(/\s+/g, '-')
  return `https://www.skyscanner.net/transport/flights/${fromSlug}/${toSlug}/${compact}/?adults=${adults}`
}

function googleFlightsUrl(from: string, to: string, date: string) {
  const q = encodeURIComponent(`flights from ${from} to ${to} on ${date}`)
  return `https://www.google.com/search?q=${q}`
}

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function perPerson(total: number, travelers: number) {
  return travelers > 1 ? Math.round(total / travelers) : null
}

// Extract flight-related activities from itinerary day 1
function extractFlightActivity(plan: TripPlan): string | null {
  const day1 = plan.itinerary?.[0]
  if (!day1) return null
  const flightAct = day1.activities?.find(a =>
    /flight|fly|depart|airport|arrival|land/i.test(a.name + ' ' + a.description)
  )
  if (flightAct) return `${flightAct.name}${flightAct.description ? ' — ' + flightAct.description : ''}`
  if (/flight|fly|depart|airport/i.test(day1.title)) return day1.title
  return null
}

interface Props {
  plan: TripPlan
}

export default function FlightInfo({ plan }: Props) {
  const {
    destination, country, currency, costBreakdown, itinerary, preferences,
  } = plan

  const origin   = preferences?.departureCity && preferences.departureCity !== 'Your city'
    ? preferences.departureCity : 'Your city'
  const travelers = preferences?.travelers ?? 1
  const depDate   = itinerary?.[0]?.date
  const retDate   = itinerary?.[itinerary.length - 1]?.date
  const flightCost = costBreakdown?.flights ?? 0
  const ppCost    = perPerson(flightCost, travelers)
  const airlines  = getRegionAirlines(country)
  const flightNote = extractFlightActivity(plan)

  const skLink  = depDate
    ? skyscannerUrl(origin, destination, depDate, travelers)
    : `https://www.skyscanner.net`
  const gfLink  = googleFlightsUrl(origin, destination, depDate || '')

  return (
    <div className="space-y-5">

      {/* Route summary card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl border border-white/8 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#4cc9f0]/15 flex items-center justify-center">
            <Plane size={16} className="text-[#4cc9f0]" />
          </div>
          <div>
            <h3 className="font-display text-white font-bold text-base">Planned Flights</h3>
            <p className="text-white/35 text-xs">As estimated in your itinerary</p>
          </div>
        </div>

        {/* Route visual */}
        <div className="px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="text-center min-w-[80px]">
              <div className="text-white font-extrabold text-2xl leading-none mb-1">
                {origin.split(',')[0].trim().slice(0, 3).toUpperCase()}
              </div>
              <div className="text-white/40 text-xs">{origin.split(',')[0].trim()}</div>
            </div>

            <div className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-center gap-1.5">
                <div className="flex-1 h-px bg-gradient-to-r from-white/10 via-[#4cc9f0]/40 to-white/10" />
                <div className="w-7 h-7 rounded-full bg-[#4cc9f0]/20 border border-[#4cc9f0]/30 flex items-center justify-center shrink-0">
                  <Plane size={12} className="text-[#4cc9f0]" />
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-white/10 via-[#4cc9f0]/40 to-white/10" />
              </div>
              <div className="text-white/25 text-[10px]">Round trip</div>
            </div>

            <div className="text-center min-w-[80px]">
              <div className="text-white font-extrabold text-2xl leading-none mb-1">
                {destination.split(',')[0].trim().slice(0, 3).toUpperCase()}
              </div>
              <div className="text-white/40 text-xs">{destination.split(',')[0].trim()}</div>
            </div>
          </div>

          {/* Dates */}
          {(depDate || retDate) && (
            <div className="mt-4 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-white/40">
                <Clock size={11} />
                <span>Depart: <span className="text-white/60">{formatDate(depDate)}</span></span>
              </div>
              {retDate && retDate !== depDate && (
                <div className="flex items-center gap-1.5 text-white/40">
                  <span>Return: <span className="text-white/60">{formatDate(retDate)}</span></span>
                </div>
              )}
            </div>
          )}

          {travelers > 1 && (
            <div className="mt-2 flex items-center gap-1.5 text-white/35 text-xs">
              <Users size={11} />
              <span>{travelers} travelers</span>
            </div>
          )}
        </div>

        {/* Cost */}
        {flightCost > 0 && (
          <div className="px-6 py-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
            <div>
              <div className="text-white/40 text-xs mb-0.5">Estimated total flight cost</div>
              <div className="text-[#4cc9f0] font-extrabold text-2xl">
                {currency} {flightCost.toLocaleString()}
              </div>
              {ppCost && (
                <div className="text-white/30 text-xs mt-0.5">
                  ≈ {currency} {ppCost.toLocaleString()} per person
                </div>
              )}
            </div>
            <div className="text-white/10 text-5xl font-bold">✈</div>
          </div>
        )}
      </motion.div>

      {/* AI flight note from Day 1 */}
      {flightNote && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-start gap-3 glass rounded-2xl p-4 border border-[#9b5de5]/20"
        >
          <Info size={15} className="text-[#9b5de5] shrink-0 mt-0.5" />
          <div>
            <div className="text-white/50 text-[10px] uppercase tracking-wide mb-1">From your itinerary — Day 1</div>
            <p className="text-white/70 text-sm">{flightNote}</p>
          </div>
        </motion.div>
      )}

      {/* Airlines that fly this route */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass rounded-2xl p-5 border border-white/8"
      >
        <h4 className="text-white/50 text-xs uppercase tracking-wide mb-3">Popular airlines on this route</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {airlines.map(a => (
            <div key={a.code} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 border border-white/8">
              <span className="text-lg leading-none">{a.logo}</span>
              <div>
                <div className="text-white/70 text-xs font-semibold">{a.code}</div>
                <div className="text-white/35 text-[10px] leading-tight">{a.name}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Book buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-2xl p-5 border border-white/8"
      >
        <h4 className="text-white/50 text-xs uppercase tracking-wide mb-3">
          Search & book this route
        </h4>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href={skLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#e91e8c] to-[#f06ab3] text-white font-semibold text-sm hover:scale-105 transition-all shadow-lg shadow-[#e91e8c]/20"
          >
            <Plane size={15} /> Search on Skyscanner <ExternalLink size={12} />
          </a>
          <a
            href={gfLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-white/15 text-white/70 font-semibold text-sm hover:bg-white/5 hover:text-white transition-all"
          >
            <Plane size={15} /> Google Flights <ExternalLink size={12} />
          </a>
        </div>
        <p className="text-white/20 text-[10px] text-center mt-3">
          Opens the exact route {origin} → {destination} on the departure date · real-time prices
        </p>
      </motion.div>

      {/* Tip */}
      <div className="flex items-start gap-2.5 px-1">
        <ArrowRight size={13} className="text-white/20 shrink-0 mt-0.5" />
        <p className="text-white/25 text-xs">
          The estimated cost above ({currency} {flightCost.toLocaleString()}) is what the AI included in your total budget.
          Actual prices vary — click Search to see live fares for your dates.
        </p>
      </div>

    </div>
  )
}
