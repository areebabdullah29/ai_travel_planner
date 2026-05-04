import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Sparkles, Plane, RefreshCw, Zap, RotateCcw,
  MapPin, Clock, Users, Thermometer, Heart, Coins, Search,
  Maximize2, Minimize2, X, Star, Calendar, TrendingUp, CheckCircle
} from 'lucide-react'
import { useTripContext } from '@/context/TripContext'
import { streamChat, deleteSession, buildTripPlanFromAgent } from '@/services/agentService'
import type { Message, TripPlan } from '@/types'

const CURRENCIES = [
  { code: 'PKR', flag: '🇵🇰', name: 'Pakistani Rupee' },
  { code: 'USD', flag: '🇺🇸', name: 'US Dollar' },
  { code: 'EUR', flag: '🇪🇺', name: 'Euro' },
  { code: 'GBP', flag: '🇬🇧', name: 'British Pound' },
  { code: 'AED', flag: '🇦🇪', name: 'UAE Dirham' },
  { code: 'SAR', flag: '🇸🇦', name: 'Saudi Riyal' },
  { code: 'CAD', flag: '🇨🇦', name: 'Canadian Dollar' },
  { code: 'AUD', flag: '🇦🇺', name: 'Australian Dollar' },
  { code: 'INR', flag: '🇮🇳', name: 'Indian Rupee' },
  { code: 'TRY', flag: '🇹🇷', name: 'Turkish Lira' },
]

const DEFAULT_BUDGETS: Record<string, number> = {
  PKR: 400000, USD: 1500, EUR: 1400, GBP: 1200,
  AED: 5500, SAR: 5600, CAD: 2000, AUD: 2300, INR: 125000, TRY: 45000,
}

const INITIAL_MESSAGE: Message = {
  id: '0',
  role: 'assistant',
  content: `Hey there, adventurer! ✈️ I'm TravelBuddy, your AI travel planning companion.

I'll help you plan your perfect trip — just tell me where you dream of going, or give me a budget and I'll suggest amazing destinations!

To get started, tell me:
- **Where** do you want to go (or what region interests you)?
- **When** are you planning to travel and for how long?
- What's your **budget**?`,
  timestamp: new Date(),
}

const QUICK_PROMPTS = [
  { icon: '🏔️', text: 'Adventure trip in Asia on a budget' },
  { icon: '🌊', text: 'Beach vacation for 7 days' },
  { icon: '🗼', text: '10 days in Japan' },
  { icon: '🏔️', text: '5-day trek in northern Pakistan' },
  { icon: '🦁', text: 'African safari for 8 days' },
  { icon: '🍜', text: 'Food & culture tour in SE Asia' },
]

// ── Preference extraction helpers ─────────────────────────────────────────

type DestInfo = { dest: string; style: string; interests: string[] }

const DEST_MAP: Array<{ kw: string[]; info: DestInfo }> = [
  { kw: ['paris', 'france'],                                                              info: { dest: 'Paris',            style: 'Romantic',   interests: ['culture', 'food', 'art'] } },
  { kw: ['thailand', 'bangkok', 'phuket', 'chiang mai', 'pattaya', 'koh samui', 'krabi'],info: { dest: 'Bangkok',           style: 'Cultural',   interests: ['culture', 'food', 'temples'] } },
  { kw: ['japan', 'tokyo', 'kyoto', 'osaka', 'hiroshima'],                               info: { dest: 'Tokyo',             style: 'Cultural',   interests: ['culture', 'food', 'technology'] } },
  { kw: ['singapore', 'sentosa', 'marina bay'],                                          info: { dest: 'Singapore',         style: 'Luxury',     interests: ['food', 'shopping', 'city'] } },
  { kw: ['london', 'uk', 'england', 'britain'],                                          info: { dest: 'London',            style: 'Cultural',   interests: ['culture', 'history', 'museums'] } },
  { kw: ['dubai', 'uae', 'emirates', 'abu dhabi'],                                       info: { dest: 'Dubai',             style: 'Luxury',     interests: ['luxury', 'shopping', 'architecture'] } },
  { kw: ['bali', 'indonesia'],                                                            info: { dest: 'Bali',              style: 'Relaxation', interests: ['beach', 'temples', 'culture'] } },
  { kw: ['istanbul', 'turkey'],                                                           info: { dest: 'Istanbul',          style: 'Cultural',   interests: ['history', 'culture', 'food'] } },
  { kw: ['kuala lumpur', 'malaysia'],                                                     info: { dest: 'Kuala Lumpur',      style: 'Mixed',      interests: ['food', 'culture', 'city'] } },
  { kw: ['barcelona', 'spain'],                                                           info: { dest: 'Barcelona',         style: 'Cultural',   interests: ['culture', 'food', 'architecture'] } },
  { kw: ['rome', 'italy'],                                                                info: { dest: 'Rome',              style: 'Cultural',   interests: ['history', 'art', 'food'] } },
  { kw: ['morocco', 'marrakech', 'casablanca'],                                           info: { dest: 'Marrakech',         style: 'Cultural',   interests: ['culture', 'bazaar', 'food'] } },
  { kw: ['vietnam', 'hanoi', 'ho chi', 'saigon', 'hoi an'],                              info: { dest: 'Hanoi',             style: 'Cultural',   interests: ['culture', 'food', 'history'] } },
  { kw: ['egypt', 'cairo', 'pyramids'],                                                   info: { dest: 'Cairo',             style: 'Cultural',   interests: ['history', 'pyramids', 'culture'] } },
  { kw: ['greece', 'athens', 'santorini', 'mykonos'],                                    info: { dest: 'Athens',            style: 'Cultural',   interests: ['history', 'beaches', 'food'] } },
  { kw: ['pakistan', 'hunza', 'skardu', 'lahore', 'islamabad', 'swat', 'murree'],        info: { dest: 'Lahore',            style: 'Cultural',   interests: ['culture', 'food', 'history'] } },
  { kw: ['maldives', 'maldive'],                                                          info: { dest: 'Maldives',          style: 'Relaxation', interests: ['beach', 'relaxation', 'snorkeling'] } },
  { kw: ['africa', 'safari', 'kenya', 'nairobi', 'masai mara', 'serengeti'],             info: { dest: 'Nairobi',           style: 'Adventure',  interests: ['wildlife', 'safari', 'nature'] } },
  { kw: ['nepal', 'kathmandu', 'everest', 'pokhara'],                                    info: { dest: 'Kathmandu',         style: 'Adventure',  interests: ['trekking', 'mountains', 'culture'] } },
  { kw: ['new york', 'nyc', 'manhattan', 'usa', 'america', 'united states'],             info: { dest: 'New York',          style: 'Cultural',   interests: ['city', 'culture', 'food'] } },
  { kw: ['australia', 'sydney', 'melbourne', 'brisbane'],                                info: { dest: 'Sydney',            style: 'Mixed',      interests: ['beaches', 'culture', 'nature'] } },
]

function extractDays(text: string): number | null {
  const wk = text.match(/\b(\d+)\s*week/i)
  if (wk) return +wk[1] * 7
  const day = text.match(/\b(\d+)\s*(?:day|days|night|nights)\b/i)
  return day ? +day[1] : null
}

function extractBudget(text: string): number | null {
  const clean = text.replace(/,/g, '')
  const k = clean.match(/\b(\d+(?:\.\d+)?)\s*[kK]\b/)
  if (k) return Math.round(+k[1] * 1000)
  const lac = clean.match(/\b(\d+(?:\.\d+)?)\s*(?:lac|lakh|lacs|lakhs)\b/i)
  if (lac) return Math.round(+lac[1] * 100000)
  const cur = clean.match(/\b(\d{3,})\s*(?:pkr|usd|gbp|eur|aed|sar|inr|cad|aud|try)\b/i)
  if (cur) return +cur[1]
  const word = clean.match(/budget\s*(?:of|is|:)?\s*(\d{3,})/i)
  return word ? +word[1] : null
}

function extractDestination(text: string): DestInfo | null {
  const msg = text.toLowerCase()
  return DEST_MAP.find(({ kw }) => kw.some(k => msg.includes(k)))?.info ?? null
}

// ── Typing indicator ──────────────────────────────────────────────────────

interface AITypingProps { active: boolean }
function AITyping({ active }: AITypingProps) {
  if (!active) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex items-start gap-3"
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e91e8c] to-[#ffd166] flex items-center justify-center flex-shrink-0">
        <Sparkles size={14} className="text-white" />
      </div>
      <div className="glass rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1.5 items-center h-5">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </motion.div>
  )
}

export default function TripPlanner() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showGenerateButton, setShowGenerateButton] = useState(false)
  const [extractedPreferences, setExtractedPreferences] = useState<{
    destination: string; days: number; budget: number
  } | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState('PKR')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showPlanPreview, setShowPlanPreview] = useState(false)
  const [builtPlan, setBuiltPlan] = useState<TripPlan | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const initialQuerySentRef = useRef(false)
  const detectedDestinationRef = useRef<DestInfo | null>(null)
  const detectedDaysRef = useRef<number | null>(null)
  const detectedBudgetRef = useRef<number | null>(null)

  const navigate = useNavigate()
  const location = useLocation()
  const { setCurrentPreferences, setCurrentPlan, saveTrip, addSearchHistory } = useTripContext()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const sendMessage = useCallback(async (text?: string) => {
    const messageText = (text ?? input).trim()
    if (!messageText || isTyping) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    // Extract trip details from user message
    const newDays = extractDays(messageText)
    const newBudget = extractBudget(messageText)
    const newDest = extractDestination(messageText)
    if (newDays) detectedDaysRef.current = newDays
    if (newBudget) detectedBudgetRef.current = newBudget
    if (newDest) detectedDestinationRef.current = newDest

    // Add a streaming placeholder message
    const streamMsgId = crypto.randomUUID()
    setMessages(prev => [
      ...prev,
      { id: streamMsgId, role: 'assistant', content: '', timestamp: new Date() },
    ])

    const controller = new AbortController()

    try {
      let accumulated = ''
      let resolvedSessionId = sessionId

      await streamChat({
        message: messageText,
        sessionId: sessionId ?? undefined,
        userId: 'anonymous',
        signal: controller.signal,
        onSessionId: (id) => {
          resolvedSessionId = id
          setSessionId(id)
        },
        onChunk: (chunk) => {
          accumulated += chunk
          setMessages(prev =>
            prev.map(m => m.id === streamMsgId ? { ...m, content: accumulated } : m)
          )
        },
      })

      // Also scan the full agent reply for any trip details mentioned
      if (accumulated) {
        const replyDest = extractDestination(accumulated)
        const replyDays = extractDays(accumulated)
        const replyBudget = extractBudget(accumulated)
        if (replyDest && !detectedDestinationRef.current) detectedDestinationRef.current = replyDest
        if (replyDays && !detectedDaysRef.current) detectedDaysRef.current = replyDays
        if (replyBudget && !detectedBudgetRef.current) detectedBudgetRef.current = replyBudget
      }

      // Keep the resolved session id in sync
      if (resolvedSessionId && resolvedSessionId !== sessionId) {
        setSessionId(resolvedSessionId)
      }

      // Show Generate button when all three preferences are collected
      const dest = detectedDestinationRef.current
      const days = detectedDaysRef.current
      const budget = detectedBudgetRef.current
      if (dest && days && budget) {
        setExtractedPreferences({ destination: dest.dest, days, budget })
        setShowGenerateButton(true)
      }

    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setMessages(prev =>
        prev.map(m =>
          m.id === streamMsgId
            ? { ...m, content: "I'm having trouble connecting to the AI agent. Please check your backend is running and try again. 🔄" }
            : m
        )
      )
    } finally {
      setIsTyping(false)
    }
  }, [input, isTyping, sessionId])

  // Auto-send initial query when navigated from Home search bar
  useEffect(() => {
    const query = (location.state as { initialQuery?: string } | null)?.initialQuery
    if (query?.trim() && !initialQuerySentRef.current) {
      initialQuerySentRef.current = true
      setTimeout(() => void sendMessage(query.trim()), 150)
    }
  }, [location.state, sendMessage])

  const handleGeneratePlan = useCallback(async () => {
    if (isGenerating || !extractedPreferences) return
    setIsGenerating(true)

    const { destination, days, budget } = extractedPreferences
    const destInfo = detectedDestinationRef.current

    const loadingMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '🗺️ Building your personalised trip plan from real destination data… This takes about 10–15 seconds!',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, loadingMsg])

    try {
      const plan = await buildTripPlanFromAgent({
        destination,
        durationDays: days,
        budget,
        currency: selectedCurrency,
        interests: destInfo?.interests ?? ['culture', 'food'],
        travelStyle: destInfo?.style ?? 'Mixed',
        groupType: 'solo',
      })

      setBuiltPlan(plan)
      setShowPlanPreview(true)
    } catch {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Something went wrong generating your plan. Please try again! 🔄',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsGenerating(false)
    }
  }, [isGenerating, extractedPreferences, selectedCurrency, setBuiltPlan, setShowPlanPreview])

  const handleConfirmPlan = useCallback(() => {
    if (!builtPlan || !extractedPreferences) return
    const conversation = messages
      .filter(m => m.id !== '0' && m.content.trim() && !m.content.startsWith('🗺️ Building your'))
      .map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp.toISOString() }))

    setCurrentPreferences(builtPlan.preferences)
    setCurrentPlan(builtPlan)
    saveTrip(builtPlan, conversation)
    addSearchHistory({
      query: extractedPreferences.destination,
      destination: extractedPreferences.destination,
      budget: extractedPreferences.budget,
      currency: selectedCurrency,
      duration: extractedPreferences.days,
      interests: builtPlan.preferences.interests,
      resultPlanId: builtPlan.id,
    })
    navigate('/itinerary')
  }, [builtPlan, extractedPreferences, messages, selectedCurrency, setCurrentPreferences, setCurrentPlan, saveTrip, addSearchHistory, navigate])

  const resetChat = () => {
    if (sessionId) void deleteSession(sessionId, 'anonymous')
    setSessionId(null)
    setMessages([INITIAL_MESSAGE])
    setInput('')
    setIsTyping(false)
    setShowGenerateButton(false)
    setExtractedPreferences(null)
    detectedDestinationRef.current = null
    detectedDaysRef.current = null
    detectedBudgetRef.current = null
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const selectedCurrencyInfo = CURRENCIES.find(c => c.code === selectedCurrency)
  const isInitialState = messages.length === 1

  const formatCost = (amount: number) => {
    if (selectedCurrency === 'PKR' && amount >= 100000)
      return `PKR ${(amount / 100000).toFixed(1)} lac`
    if (amount >= 1000)
      return `${selectedCurrency} ${amount.toLocaleString()}`
    return `${selectedCurrency} ${amount}`
  }

  const breakdownItems = builtPlan ? [
    { label: 'Flights',       value: builtPlan.costBreakdown.flights,       color: '#e91e8c' },
    { label: 'Accommodation', value: builtPlan.costBreakdown.accommodation, color: '#9b5de5' },
    { label: 'Food',          value: builtPlan.costBreakdown.food,          color: '#ffd166' },
    { label: 'Activities',    value: builtPlan.costBreakdown.activities,    color: '#4cc9f0' },
    { label: 'Transport',     value: builtPlan.costBreakdown.transport,     color: '#06d6a0' },
    { label: 'Misc',          value: builtPlan.costBreakdown.miscellaneous, color: '#f06ab3' },
  ] : []
  const breakdownTotal = breakdownItems.reduce((s, i) => s + i.value, 0) || 1

  return (
    <div className="min-h-screen pt-16 sm:pt-20 pb-8 px-3 sm:px-4 flex flex-col">

      {/* ── Plan Preview Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showPlanPreview && builtPlan && (
          <motion.div
            key="plan-preview-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
            onClick={() => setShowPlanPreview(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 24 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0d0d1a] border border-white/10 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header gradient */}
              <div className="relative p-8 bg-gradient-to-br from-[#e91e8c]/20 via-[#9b5de5]/15 to-[#4cc9f0]/10 rounded-t-3xl border-b border-white/8">
                <button
                  onClick={() => setShowPlanPreview(false)}
                  className="absolute top-4 right-4 p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/8 transition-colors"
                >
                  <X size={18} />
                </button>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={16} className="text-[#06d6a0]" />
                  <span className="text-[#06d6a0] text-sm font-semibold">Your plan is ready!</span>
                </div>
                <h2 className="font-display text-3xl font-bold text-white mb-1">
                  {builtPlan.destination}
                </h2>
                <p className="text-white/50 text-sm mb-4">{builtPlan.country}</p>
                <div className="flex flex-wrap gap-3">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 text-white/70 text-sm">
                    <Clock size={13} className="text-[#e91e8c]" />
                    {builtPlan.duration} days
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 text-white/70 text-sm">
                    <Coins size={13} className="text-[#ffd166]" />
                    {formatCost(builtPlan.totalCost)}
                  </span>
                  {builtPlan.bestTime && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 text-white/70 text-sm">
                      <Calendar size={13} className="text-[#4cc9f0]" />
                      Best: {builtPlan.bestTime}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Highlights */}
                {builtPlan.highlights.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Star size={14} className="text-[#ffd166]" />
                      <span className="text-white/60 text-xs uppercase tracking-widest font-semibold">Highlights</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {builtPlan.highlights.slice(0, 8).map(h => (
                        <span key={h} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/8 text-white/70 text-xs">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Day-by-day overview */}
                {builtPlan.itinerary.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar size={14} className="text-[#4cc9f0]" />
                      <span className="text-white/60 text-xs uppercase tracking-widest font-semibold">Itinerary Overview</span>
                    </div>
                    <div className="space-y-2">
                      {builtPlan.itinerary.map(day => (
                        <div key={day.day} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/3 border border-white/5">
                          <span className="text-[#e91e8c] text-xs font-bold w-12 flex-shrink-0">Day {day.day}</span>
                          <span className="text-white/70 text-sm">{day.title}</span>
                          <span className="ml-auto text-white/30 text-xs flex-shrink-0">{formatCost(day.estimatedCost)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cost breakdown */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={14} className="text-[#9b5de5]" />
                    <span className="text-white/60 text-xs uppercase tracking-widest font-semibold">Cost Breakdown</span>
                  </div>
                  <div className="space-y-2.5">
                    {breakdownItems.filter(i => i.value > 0).map(item => (
                      <div key={item.label} className="flex items-center gap-3">
                        <span className="text-white/50 text-xs w-28 flex-shrink-0">{item.label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.round((item.value / breakdownTotal) * 100)}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                        <span className="text-white/60 text-xs w-28 text-right flex-shrink-0">{formatCost(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Conversation saved note */}
                <p className="text-center text-white/25 text-xs">
                  💬 Your AI conversation will be saved with this trip
                </p>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowPlanPreview(false)}
                    className="flex-1 py-3 rounded-2xl glass border border-white/10 text-white/60 text-sm font-semibold hover:text-white hover:bg-white/5 transition-all duration-200"
                  >
                    ← Back to Chat
                  </button>
                  <button
                    onClick={handleConfirmPlan}
                    className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-[#e91e8c] to-[#ffd166] text-white font-bold text-sm hover:shadow-xl hover:shadow-[#e91e8c]/30 hover:scale-[1.02] transition-all duration-200"
                  >
                    <Plane size={16} />
                    View Full Itinerary
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="max-w-4xl mx-auto w-full flex flex-col h-full gap-4 sm:gap-5">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-3 sm:py-6"
        >
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass-coral text-[#e91e8c] text-xs sm:text-sm font-medium mb-3">
            <Sparkles size={13} />
            AI Travel Assistant
          </div>
          <h1 className="font-display text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-2">
            Plan Your Perfect Trip
          </h1>
          <p className="text-white/50 text-sm sm:text-base">
            Chat with our AI to create a personalized travel itinerary
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {isInitialState ? (
            /* ── Initial state: Google-style prominent search ── */
            <motion.div
              key="search-hero"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="flex flex-col items-center gap-7"
            >
              {/* Currency Selector */}
              <div className="glass rounded-2xl p-4 w-full">
                <div className="flex items-center gap-2 mb-3">
                  <Coins size={14} className="text-[#e91e8c]" />
                  <span className="text-white/60 text-xs uppercase tracking-widest font-semibold">
                    Budget Currency
                  </span>
                  {selectedCurrencyInfo && (
                    <span className="ml-auto text-white/50 text-xs">
                      {selectedCurrencyInfo.flag} {selectedCurrencyInfo.name}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {CURRENCIES.map(({ code, flag }) => (
                    <button
                      key={code}
                      onClick={() => setSelectedCurrency(code)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        selectedCurrency === code
                          ? 'bg-[#e91e8c] text-white shadow-lg shadow-[#e91e8c]/30 scale-105'
                          : 'glass text-white/50 hover:text-white hover:bg-white/8'
                      }`}
                    >
                      <span>{flag}</span>
                      <span>{code}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Prominent Search Bar */}
              <div className="w-full max-w-2xl">
                <p className="text-white/40 text-sm text-center mb-5">
                  Describe your dream trip — destination, duration, budget, or travel style
                </p>
                <div className="relative group">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#e91e8c]/20 to-[#4cc9f0]/20 blur-2xl group-focus-within:from-[#e91e8c]/35 group-focus-within:to-[#4cc9f0]/35 transition-all duration-500 pointer-events-none" />
                  <div className="relative flex items-center glass rounded-full border border-white/10 group-focus-within:border-[#e91e8c]/50 transition-colors duration-300 shadow-2xl shadow-black/40">
                    <Search size={20} className="ml-5 text-[#e91e8c]/70 flex-shrink-0" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="e.g. 'Paris for 7 days on a $2000 budget'"
                      autoFocus
                      className="flex-1 bg-transparent px-4 py-5 text-white placeholder-white/30 text-base focus:outline-none"
                    />
                    <button
                      onClick={() => void sendMessage()}
                      disabled={!input.trim() || isTyping}
                      className="mr-2 flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-[#e91e8c] to-[#f06ab3] text-white font-semibold text-sm hover:shadow-lg hover:shadow-[#e91e8c]/40 hover:scale-105 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex-shrink-0"
                    >
                      <Send size={16} />
                      <span className="hidden sm:inline">Plan Trip</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick suggestion chips */}
              <div className="w-full max-w-2xl">
                <p className="text-white/30 text-xs text-center mb-3 uppercase tracking-widest">Try these</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {QUICK_PROMPTS.map(({ icon, text }) => (
                    <button
                      key={text}
                      onClick={() => void sendMessage(text)}
                      disabled={isTyping}
                      className="flex items-center gap-1.5 glass px-4 py-2 rounded-full text-white/55 text-sm hover:text-white hover:border-[#e91e8c]/30 hover:bg-[#e91e8c]/8 transition-all duration-200 disabled:opacity-40"
                    >
                      <span>{icon}</span>
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            /* ── Chat state: normal conversation layout ── */
            <motion.div
              key="chat-layout"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col gap-5 flex-1"
            >
              {/* Currency Selector */}
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Coins size={14} className="text-[#e91e8c]" />
                  <span className="text-white/60 text-xs uppercase tracking-widest font-semibold">
                    Budget Currency
                  </span>
                  {selectedCurrencyInfo && (
                    <span className="ml-auto text-white/50 text-xs">
                      {selectedCurrencyInfo.flag} {selectedCurrencyInfo.name}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {CURRENCIES.map(({ code, flag }) => (
                    <button
                      key={code}
                      onClick={() => setSelectedCurrency(code)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        selectedCurrency === code
                          ? 'bg-[#e91e8c] text-white shadow-lg shadow-[#e91e8c]/30 scale-105'
                          : 'glass text-white/50 hover:text-white hover:bg-white/8'
                      }`}
                    >
                      <span>{flag}</span>
                      <span>{code}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Context pills */}
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  { icon: Coins, label: selectedCurrency },
                  { icon: Clock, label: 'Duration-based' },
                  { icon: Heart, label: 'Interest-driven' },
                  { icon: Thermometer, label: 'Weather-smart' },
                  { icon: Users, label: 'Group-optimized' },
                  { icon: MapPin, label: '190+ destinations' },
                ].map(({ icon: Icon, label }) => (
                  <span key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-white/50 text-xs">
                    <Icon size={11} className="text-[#e91e8c]" />
                    {label}
                  </span>
                ))}
              </div>

              {/* Chat Window */}
              <div className={`glass overflow-hidden flex flex-col transition-all duration-300 ${
                isFullscreen
                  ? 'fixed inset-0 z-50 rounded-none'
                  : 'flex-1 rounded-2xl sm:rounded-3xl'
              }`} style={isFullscreen ? {} : { minHeight: '45vh', maxHeight: '60vh' }}>
                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                      >
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          msg.role === 'assistant'
                            ? 'bg-gradient-to-br from-[#e91e8c] to-[#ffd166]'
                            : 'bg-gradient-to-br from-[#4cc9f0] to-[#0066cc]'
                        }`}>
                          {msg.role === 'assistant'
                            ? <Sparkles size={14} className="text-white" />
                            : <span className="text-white text-xs font-bold">U</span>
                          }
                        </div>

                        {/* Bubble */}
                        <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          {msg.role === 'assistant' && (
                            <span className="text-[#e91e8c] text-xs font-semibold ml-1">TravelBuddy AI</span>
                          )}
                          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                            msg.role === 'user'
                              ? 'bg-[#e91e8c] text-white rounded-tr-sm'
                              : 'glass text-white/85 rounded-tl-sm'
                          }`}>
                            {msg.content
                              ? msg.content.split('**').map((part, i) =>
                                  i % 2 === 1
                                    ? <strong key={i} className="text-white font-semibold">{part}</strong>
                                    : <span key={i}>{part}</span>
                                )
                              : <span className="opacity-40">…</span>
                            }
                          </div>
                          <span className="text-white/25 text-xs ml-1">
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  <AnimatePresence>
                    <AITyping active={isTyping && messages[messages.length - 1]?.content === ''} />
                  </AnimatePresence>

                  <div ref={messagesEndRef} />
                </div>

                {/* Generate Plan Button */}
                <AnimatePresence>
                  {showGenerateButton && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-6 py-3 border-t border-white/5"
                    >
                      <button
                        onClick={() => void handleGeneratePlan()}
                        disabled={isGenerating}
                        className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-gradient-to-r from-[#e91e8c] to-[#ffd166] text-white font-bold text-base hover:shadow-xl hover:shadow-[#e91e8c]/30 hover:scale-[1.01] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isGenerating ? (
                          <>
                            <RefreshCw size={18} className="animate-spin" />
                            Creating your perfect itinerary...
                          </>
                        ) : (
                          <>
                            <Zap size={18} />
                            Generate My Trip Plan
                            <Plane size={16} />
                          </>
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Input area */}
                <div className="p-4 border-t border-white/5">
                  <div className="flex items-end gap-3">
                    <button
                      onClick={resetChat}
                      className="p-2.5 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors flex-shrink-0"
                      title="Reset conversation"
                    >
                      <RotateCcw size={18} />
                    </button>

                    <button
                      onClick={() => setIsFullscreen(v => !v)}
                      className="p-2.5 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors flex-shrink-0"
                      title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    >
                      {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>

                    <div className="flex-1 relative">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Tell me about your dream trip..."
                        rows={1}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/30 text-sm resize-none focus:outline-none focus:border-[#e91e8c]/40 transition-colors"
                        style={{ minHeight: '46px', maxHeight: '120px' }}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement
                          target.style.height = 'auto'
                          target.style.height = `${Math.min(target.scrollHeight, 120)}px`
                        }}
                      />
                    </div>

                    <button
                      onClick={() => void sendMessage()}
                      disabled={!input.trim() || isTyping}
                      className="p-2.5 rounded-xl bg-gradient-to-r from-[#e91e8c] to-[#f06ab3] text-white hover:shadow-lg hover:shadow-[#e91e8c]/30 hover:scale-105 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex-shrink-0"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Prompts */}
              <div>
                <p className="text-white/30 text-xs text-center mb-3 uppercase tracking-widest">Quick start prompts</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {QUICK_PROMPTS.map(({ icon, text }) => (
                    <button
                      key={text}
                      onClick={() => void sendMessage(text)}
                      disabled={isTyping}
                      className="glass text-left px-4 py-3 rounded-xl text-white/60 text-sm hover:text-white hover:border-[#e91e8c]/20 hover:bg-[#e91e8c]/5 transition-all duration-200 disabled:opacity-40"
                    >
                      <span className="mr-2">{icon}</span>
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
