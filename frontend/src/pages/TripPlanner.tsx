import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Sparkles, Plane, RefreshCw, Zap, RotateCcw,
  MapPin, Clock, Users, Thermometer, Heart, Coins, Search,
  Maximize2, Minimize2
} from 'lucide-react'
import { useTripContext } from '@/context/TripContext'
import {
  TRAVEL_SYSTEM_PROMPT,
  parsePreferencesFromResponse,
  generateTripPlan,
  generateMockPlan,
} from '@/services/claudeService'
import type { Message } from '@/types'

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

// Default budget per currency (sensible amounts for a 7-day trip)
const DEFAULT_BUDGETS: Record<string, number> = {
  PKR: 400000,
  USD: 1500,
  EUR: 1400,
  GBP: 1200,
  AED: 5500,
  SAR: 5600,
  CAD: 2000,
  AUD: 2300,
  INR: 125000,
  TRY: 45000,
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
  const [extractedPreferences, setExtractedPreferences] = useState<ReturnType<typeof parsePreferencesFromResponse> | null>(null)
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [selectedCurrency, setSelectedCurrency] = useState('PKR')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const initialQuerySentRef = useRef(false)
  // Tracks the destination, days, and budget across all conversation turns
  const detectedDestinationRef = useRef<{ dest: string; style: string; interests: string[] } | null>(null)
  const detectedDaysRef = useRef<number | null>(null)
  const detectedBudgetRef = useRef<number | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { setCurrentPreferences, setCurrentPlan, saveTrip, addSearchHistory } = useTripContext()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const generateSmartResponse = useCallback((userMessage: string, turnCount: number): string => {
    const msg = userMessage.toLowerCase()
    const cur = selectedCurrency
    const defaultBudget = DEFAULT_BUDGETS[cur] ?? 1500

    // ── Shared types and helpers (declared first so smart shortcut can use them) ──
    // minPerDayPKR = minimum recommended daily budget in PKR for a comfortable trip (optional, defaults to 20000)
    type DestInfo = { dest: string; style: string; interests: string[]; minPerDayPKR?: number }
    const setDest = (d: DestInfo) => { detectedDestinationRef.current = d; return d }

    // ── Extract duration from message ─────────────────────────────────────────
    const wkMatch = userMessage.match(/\b(\d+)\s*week/i)
    const dayMatch = userMessage.match(/\b(\d+)\s*(?:day|days|night|nights)\b/i)
    const extractedDays = wkMatch ? +wkMatch[1] * 7 : dayMatch ? +dayMatch[1] : null
    if (extractedDays) detectedDaysRef.current = extractedDays
    const knownDays = extractedDays ?? detectedDaysRef.current

    // ── Extract budget from message ───────────────────────────────────────────
    const cleanText = userMessage.replace(/,/g, '')
    const kBudget = cleanText.match(/\b(\d+(?:\.\d+)?)\s*[kK]\b/)
    const lacBudget = cleanText.match(/\b(\d+(?:\.\d+)?)\s*(?:lac|lakh|lacs|lakhs)\b/i)
    const curBudget = cleanText.match(/\b(\d{3,})\s*(?:pkr|usd|gbp|eur|aed|sar|inr|cad|aud|try)\b/i)
    const wordBudget = cleanText.match(/budget\s*(?:of|is|:)?\s*(\d{3,})/i)
    const extractedBudget = kBudget ? Math.round(+kBudget[1] * 1000)
      : lacBudget ? Math.round(+lacBudget[1] * 100000)
      : curBudget ? +curBudget[1]
      : wordBudget ? +wordBudget[1]
      : null
    if (extractedBudget) detectedBudgetRef.current = extractedBudget
    const knownBudget = extractedBudget ?? detectedBudgetRef.current

    // ── Multi-city detection (checked BEFORE the single-city DEST_MAP) ─────────
    const multiCity: DestInfo | null = (() => {
      // Thailand combinations
      if (msg.includes('pattaya') && msg.includes('bangkok'))
        return { dest: 'Bangkok & Pattaya, Thailand',  style: 'Mixed',      interests: ['culture', 'food', 'beach', 'nightlife'], minPerDayPKR: 22000 }
      if (msg.includes('phuket') && msg.includes('bangkok'))
        return { dest: 'Bangkok & Phuket, Thailand',   style: 'Mixed',      interests: ['culture', 'food', 'beach'],              minPerDayPKR: 25000 }
      if (msg.includes('phuket') && msg.includes('chiang mai'))
        return { dest: 'Phuket & Chiang Mai, Thailand',style: 'Mixed',      interests: ['beach', 'culture', 'food'],              minPerDayPKR: 22000 }
      if (msg.includes('pattaya') && msg.includes('chiang mai'))
        return { dest: 'Pattaya & Chiang Mai, Thailand',style: 'Mixed',     interests: ['beach', 'culture', 'food'],              minPerDayPKR: 20000 }
      // Japan combinations
      if (msg.includes('tokyo') && msg.includes('kyoto') && msg.includes('osaka'))
        return { dest: 'Tokyo, Kyoto & Osaka, Japan',  style: 'Cultural',   interests: ['culture', 'food', 'history'],            minPerDayPKR: 48000 }
      if (msg.includes('tokyo') && msg.includes('kyoto'))
        return { dest: 'Tokyo & Kyoto, Japan',         style: 'Cultural',   interests: ['culture', 'food', 'history'],            minPerDayPKR: 46000 }
      if (msg.includes('tokyo') && msg.includes('osaka'))
        return { dest: 'Tokyo & Osaka, Japan',         style: 'Cultural',   interests: ['culture', 'food', 'technology'],         minPerDayPKR: 46000 }
      // UAE combinations
      if (msg.includes('dubai') && msg.includes('abu dhabi'))
        return { dest: 'Dubai & Abu Dhabi, UAE',       style: 'Luxury',     interests: ['luxury', 'shopping', 'architecture'],    minPerDayPKR: 55000 }
      // Pakistan combinations
      if (msg.includes('hunza') && msg.includes('skardu'))
        return { dest: 'Hunza & Skardu, Pakistan',     style: 'Adventure',  interests: ['trekking', 'mountains', 'nature'],       minPerDayPKR: 9000  }
      if (msg.includes('lahore') && msg.includes('islamabad'))
        return { dest: 'Lahore & Islamabad, Pakistan', style: 'Cultural',   interests: ['culture', 'food', 'history'],            minPerDayPKR: 7000  }
      // Europe combinations
      if (msg.includes('paris') && msg.includes('rome'))
        return { dest: 'Paris & Rome',                 style: 'Cultural',   interests: ['culture', 'food', 'art'],                minPerDayPKR: 50000 }
      if (msg.includes('paris') && msg.includes('barcelona'))
        return { dest: 'Paris & Barcelona',            style: 'Cultural',   interests: ['culture', 'food', 'architecture'],       minPerDayPKR: 48000 }
      return null
    })()

    // ── Inline destination detection ──────────────────────────────────────────
    const DEST_MAP: Array<{ kw: string[]; info: DestInfo }> = [
      { kw: ['paris', 'france'],                                                              info: { dest: 'Paris',            style: 'Romantic',   interests: ['culture', 'food', 'art'],             minPerDayPKR: 45000 } },
      { kw: ['thailand', 'bangkok', 'phuket', 'chiang mai', 'pattaya', 'koh samui', 'krabi'],info: { dest: 'Bangkok',           style: 'Cultural',   interests: ['culture', 'food', 'temples'],          minPerDayPKR: 20000 } },
      { kw: ['japan', 'tokyo', 'kyoto', 'osaka', 'hiroshima'],                               info: { dest: 'Tokyo',             style: 'Cultural',   interests: ['culture', 'food', 'technology'],       minPerDayPKR: 45000 } },
      { kw: ['singapore', 'sentosa', 'marina bay'],                                          info: { dest: 'Singapore',         style: 'Luxury',     interests: ['food', 'shopping', 'city'],            minPerDayPKR: 35000 } },
      { kw: ['london', 'uk', 'england', 'britain'],                                          info: { dest: 'London',            style: 'Cultural',   interests: ['culture', 'history', 'museums'],       minPerDayPKR: 50000 } },
      { kw: ['dubai', 'uae', 'emirates', 'abu dhabi'],                                       info: { dest: 'Dubai',             style: 'Luxury',     interests: ['luxury', 'shopping', 'architecture'],  minPerDayPKR: 50000 } },
      { kw: ['bali', 'indonesia'],                                                            info: { dest: 'Bali',              style: 'Relaxation', interests: ['beach', 'temples', 'culture'],         minPerDayPKR: 18000 } },
      { kw: ['istanbul', 'turkey'],                                                           info: { dest: 'Istanbul',          style: 'Cultural',   interests: ['history', 'culture', 'food'],          minPerDayPKR: 22000 } },
      { kw: ['kuala lumpur', 'malaysia'],                                                     info: { dest: 'Kuala Lumpur',      style: 'Mixed',      interests: ['food', 'culture', 'city'],             minPerDayPKR: 18000 } },
      { kw: ['barcelona', 'spain'],                                                           info: { dest: 'Barcelona',         style: 'Cultural',   interests: ['culture', 'food', 'architecture'],     minPerDayPKR: 40000 } },
      { kw: ['rome', 'italy'],                                                                info: { dest: 'Rome, Italy',       style: 'Cultural',   interests: ['history', 'art', 'food'],              minPerDayPKR: 38000 } },
      { kw: ['morocco', 'marrakech', 'casablanca'],                                           info: { dest: 'Marrakech, Morocco',style: 'Cultural',   interests: ['culture', 'bazaar', 'food'],           minPerDayPKR: 20000 } },
      { kw: ['vietnam', 'hanoi', 'ho chi', 'saigon', 'hoi an'],                              info: { dest: 'Hanoi, Vietnam',    style: 'Cultural',   interests: ['culture', 'food', 'history'],          minPerDayPKR: 15000 } },
      { kw: ['egypt', 'cairo', 'pyramids'],                                                   info: { dest: 'Cairo, Egypt',      style: 'Cultural',   interests: ['history', 'pyramids', 'culture'],      minPerDayPKR: 22000 } },
      { kw: ['greece', 'athens', 'santorini', 'mykonos'],                                    info: { dest: 'Athens, Greece',    style: 'Cultural',   interests: ['history', 'beaches', 'food'],          minPerDayPKR: 38000 } },
      { kw: ['pakistan', 'hunza', 'skardu', 'lahore', 'islamabad', 'swat', 'murree'],        info: { dest: 'Hunza Valley',      style: 'Adventure',  interests: ['trekking', 'mountains', 'nature'],     minPerDayPKR:  8000 } },
      { kw: ['maldives', 'maldive'],                                                          info: { dest: 'Maldives',          style: 'Relaxation', interests: ['beach', 'relaxation', 'snorkeling'],   minPerDayPKR: 80000 } },
      { kw: ['africa', 'safari', 'kenya', 'nairobi', 'masai mara', 'serengeti'],             info: { dest: 'Nairobi, Kenya',    style: 'Adventure',  interests: ['wildlife', 'safari', 'nature'],        minPerDayPKR: 25000 } },
      { kw: ['nepal', 'kathmandu', 'everest', 'pokhara'],                                    info: { dest: 'Kathmandu, Nepal',  style: 'Adventure',  interests: ['trekking', 'mountains', 'culture'],    minPerDayPKR: 15000 } },
      { kw: ['new york', 'nyc', 'manhattan', 'usa', 'america', 'united states'],             info: { dest: 'New York, USA',     style: 'Cultural',   interests: ['city', 'culture', 'food'],             minPerDayPKR: 55000 } },
      { kw: ['australia', 'sydney', 'melbourne', 'brisbane'],                                info: { dest: 'Sydney, Australia', style: 'Mixed',      interests: ['beaches', 'culture', 'nature'],        minPerDayPKR: 50000 } },
    ]
    const inlineDest = multiCity
      ?? DEST_MAP.find(({ kw }) => kw.some(k => msg.includes(k)))?.info
      ?? (detectedDestinationRef.current as DestInfo | null)

    // ── Budget-to-PKR conversion (for minimum budget check) ──────────────────
    const toPKR: Record<string, number> = {
      PKR: 1, USD: 280, EUR: 305, GBP: 355,
      AED: 76, SAR: 75, CAD: 207, AUD: 180, INR: 1 / 3.4, TRY: 9,
    }

    // ── Helper: build the "generate" JSON block ───────────────────────────────
    const makeGenerateJSON = (d: DestInfo, days: number, budget: number) => `\`\`\`json
{
  "readyToGenerate": true,
  "preferences": {
    "budget": ${budget},
    "currency": "${cur}",
    "duration": ${days},
    "interests": ${JSON.stringify(d.interests)},
    "weather": "mild",
    "travelStyle": "${d.style}",
    "departureCity": "Your city",
    "groupType": "solo"
  },
  "suggestedDestination": "${d.dest}"
}
\`\`\``

    // ── Smart shortcut: all info known (current + remembered) → validate budget → generate ──
    if (knownDays && knownBudget && inlineDest) {
      const budgetPKR   = Math.round(knownBudget * (toPKR[cur] ?? 1))
      const minPerDay   = inlineDest.minPerDayPKR ?? 20000
      const minTotalPKR = minPerDay * knownDays
      const minDisplay  = Math.round(minTotalPKR / (toPKR[cur] ?? 1))
      const ratio       = budgetPKR / minTotalPKR

      if (ratio < 0.5) {
        const feasibleDays = Math.max(2, Math.floor(budgetPKR / minPerDay))
        return `Hmm, **${knownBudget.toLocaleString()} ${cur}** for **${knownDays} days** in **${inlineDest.dest}** is quite tight — it won't comfortably cover flights, accommodation, meals, and activities. 😬

For a decent **${knownDays}-day** trip to ${inlineDest.dest}, the recommended minimum is around **${minDisplay.toLocaleString()} ${cur}**.

Here are your options:
- 💰 **Increase your budget** to at least **${minDisplay.toLocaleString()} ${cur}** — I'll plan a great trip!
- 📅 **Shorten the trip** — with ${knownBudget.toLocaleString()} ${cur} you could comfortably do **${feasibleDays} days** in ${inlineDest.dest}
- ✈️ **Choose a cheaper destination** — Vietnam, Morocco, Bali, or Pakistan are all great on a tighter budget

What would you like to do?`
      }

      setDest(inlineDest)

      if (ratio < 0.8) {
        return `Budget noted! **${knownBudget.toLocaleString()} ${cur}** for ${knownDays} days in **${inlineDest.dest}** is a little under the recommended **${minDisplay.toLocaleString()} ${cur}**, but I can still put together a solid budget-friendly plan for you! 🤏

- 📍 **Destination**: ${inlineDest.dest}
- 📅 **Duration**: ${knownDays} days
- 💰 **Budget**: ${knownBudget.toLocaleString()} ${cur} _(budget-friendly mode)_

I'll prioritise affordable guesthouses, street food, and free or low-cost activities to make every rupee count. Click **"Generate My Trip Plan"** to proceed!

${makeGenerateJSON(inlineDest, knownDays, knownBudget)}`
      }

      return `Got it — I have everything I need! 🎯

- 📍 **Destination**: ${inlineDest.dest}
- 📅 **Duration**: ${knownDays} days
- 💰 **Budget**: ${knownBudget.toLocaleString()} ${cur}

Click **"Generate My Trip Plan"** below for your complete personalised itinerary!

${makeGenerateJSON(inlineDest, knownDays, knownBudget)}`
    }

    // ── Partial-info: handle every 1-of-3 or 2-of-3 combination ─────────────
    // inlineDest already falls back to detectedDestinationRef via the ?? above.
    const knownDest = inlineDest   // null when truly unknown
    if (knownDest) setDest(knownDest)

    // dest + budget, missing days
    if (knownDest && knownBudget && !knownDays) {
      return `Budget locked in — **${knownBudget.toLocaleString()} ${cur}**! 💰

- 📍 **Destination**: ${knownDest.dest} ✅
- 💰 **Budget**: ${knownBudget.toLocaleString()} ${cur} ✅
- 📅 **Duration**: How many days are you planning?`
    }

    // dest + days, missing budget
    if (knownDest && knownDays && !knownBudget) {
      return `${knownDays} days in **${knownDest.dest}** — great choice! ✈️

- 📍 **Destination**: ${knownDest.dest} ✅
- 📅 **Duration**: ${knownDays} days ✅
- 💰 **Budget**: What's your total budget in ${cur}?`
    }

    // days + budget, missing destination
    if (!knownDest && knownDays && knownBudget) {
      return `**${knownDays} days** with a **${knownBudget.toLocaleString()} ${cur}** budget — let's plan! 🌍

Just tell me your destination and I'll generate your complete itinerary instantly!`
    }

    // only budget given
    if (knownBudget && !knownDays && !knownDest) {
      return `Budget of **${knownBudget.toLocaleString()} ${cur}** noted! 💰

Where would you like to go, and for how many days?`
    }

    // only days given
    if (knownDays && !knownBudget && !knownDest) {
      return `**${knownDays} days** — perfect trip length! ✈️

Where would you like to go, and what's your total budget in ${cur}?`
    }

    // Helper: pick destination from current message keywords, also updating detectedDestinationRef
    const pickDestination = (): DestInfo => {
      if (detectedDestinationRef.current) return detectedDestinationRef.current as DestInfo
      if (msg.includes('london') || msg.includes('uk') || msg.includes('england') || msg.includes('britain'))
        return setDest({ dest: 'London',            style: 'Cultural',   interests: ['culture', 'history', 'museums'],      minPerDayPKR: 50000 })
      if (msg.includes('paris') || msg.includes('france'))
        return setDest({ dest: 'Paris',             style: 'Romantic',   interests: ['culture', 'food', 'art'],             minPerDayPKR: 45000 })
      if (msg.includes('spain') || msg.includes('barcelona'))
        return setDest({ dest: 'Barcelona',         style: 'Cultural',   interests: ['culture', 'food', 'architecture'],    minPerDayPKR: 40000 })
      if (msg.includes('rome') || msg.includes('italy') || msg.includes('italian'))
        return setDest({ dest: 'Rome, Italy',       style: 'Cultural',   interests: ['history', 'art', 'food'],             minPerDayPKR: 38000 })
      if (msg.includes('dubai') || msg.includes('uae') || msg.includes('emirates') || msg.includes('abu dhabi'))
        return setDest({ dest: 'Dubai',             style: 'Luxury',     interests: ['luxury', 'shopping', 'architecture'], minPerDayPKR: 50000 })
      if (msg.includes('turkey') || msg.includes('istanbul'))
        return setDest({ dest: 'Istanbul',          style: 'Cultural',   interests: ['history', 'culture', 'food'],         minPerDayPKR: 22000 })
      if (msg.includes('bali') || msg.includes('indonesia'))
        return setDest({ dest: 'Bali',              style: 'Relaxation', interests: ['beach', 'temples', 'culture'],        minPerDayPKR: 18000 })
      if (msg.includes('malaysia') || msg.includes('kuala lumpur') || msg.includes(' kl ') || msg.includes('kl,'))
        return setDest({ dest: 'Kuala Lumpur',      style: 'Mixed',      interests: ['food', 'culture', 'city'],            minPerDayPKR: 18000 })
      if (msg.includes('thailand') || msg.includes('bangkok') || msg.includes('phuket') || msg.includes('chiang mai') || msg.includes('pattaya') || msg.includes('koh samui'))
        return setDest({ dest: 'Bangkok',           style: 'Cultural',   interests: ['culture', 'food', 'temples'],         minPerDayPKR: 20000 })
      if (msg.includes('japan') || msg.includes('tokyo') || msg.includes('kyoto') || msg.includes('osaka') || msg.includes('hiroshima'))
        return setDest({ dest: 'Tokyo',             style: 'Cultural',   interests: ['culture', 'food', 'technology'],      minPerDayPKR: 45000 })
      if (msg.includes('singapore') || msg.includes(' sg ') || msg.includes('sentosa') || msg.includes('marina bay'))
        return setDest({ dest: 'Singapore',         style: 'Luxury',     interests: ['food', 'shopping', 'city'],           minPerDayPKR: 35000 })
      if (msg.includes('morocco') || msg.includes('marrakech') || msg.includes('casablanca') || msg.includes('fes'))
        return setDest({ dest: 'Marrakech, Morocco',style: 'Cultural',   interests: ['culture', 'bazaar', 'food'],          minPerDayPKR: 20000 })
      if (msg.includes('vietnam') || msg.includes('hanoi') || msg.includes('ho chi') || msg.includes('saigon'))
        return setDest({ dest: 'Hanoi, Vietnam',    style: 'Cultural',   interests: ['culture', 'food', 'history'],         minPerDayPKR: 15000 })
      if (msg.includes('maldives') || msg.includes('maldive'))
        return setDest({ dest: 'Maldives',          style: 'Relaxation', interests: ['beach', 'relaxation', 'snorkeling'],  minPerDayPKR: 80000 })
      if (msg.includes('nepal') || msg.includes('everest') || msg.includes('kathmandu'))
        return setDest({ dest: 'Kathmandu, Nepal',  style: 'Adventure',  interests: ['trekking', 'mountains', 'culture'],   minPerDayPKR: 15000 })
      if (msg.includes('africa') || msg.includes('safari') || msg.includes('kenya') || msg.includes('nairobi'))
        return setDest({ dest: 'Nairobi, Kenya',    style: 'Adventure',  interests: ['wildlife', 'safari', 'nature'],       minPerDayPKR: 25000 })
      if (msg.includes('new york') || msg.includes('nyc') || msg.includes('manhattan') || msg.includes('america') || msg.includes('usa') || msg.includes('united states'))
        return setDest({ dest: 'New York, USA',     style: 'Cultural',   interests: ['city', 'culture', 'food'],            minPerDayPKR: 55000 })
      if (msg.includes('australia') || msg.includes('sydney') || msg.includes('melbourne'))
        return setDest({ dest: 'Sydney, Australia', style: 'Mixed',      interests: ['beaches', 'culture', 'nature'],       minPerDayPKR: 50000 })
      if (msg.includes('egypt') || msg.includes('cairo') || msg.includes('pyramids'))
        return setDest({ dest: 'Cairo, Egypt',      style: 'Cultural',   interests: ['history', 'pyramids', 'culture'],     minPerDayPKR: 22000 })
      if (msg.includes('greece') || msg.includes('athens') || msg.includes('santorini') || msg.includes('mykonos'))
        return setDest({ dest: 'Athens, Greece',    style: 'Cultural',   interests: ['history', 'beaches', 'food'],         minPerDayPKR: 38000 })
      // Default: rotate through popular destinations
      const defaults: DestInfo[] = [
        { dest: 'Bangkok',   style: 'Cultural',   interests: ['culture', 'food', 'temples'],  minPerDayPKR: 20000 },
        { dest: 'Istanbul',  style: 'Cultural',   interests: ['history', 'culture', 'food'],  minPerDayPKR: 22000 },
        { dest: 'Bali',      style: 'Relaxation', interests: ['beach', 'culture', 'food'],    minPerDayPKR: 18000 },
        { dest: 'Dubai',     style: 'Luxury',     interests: ['luxury', 'shopping', 'city'],  minPerDayPKR: 50000 },
      ]
      const d = defaults[turnCount % defaults.length]
      detectedDestinationRef.current = d
      return d
    }

    // Generic greeting ONLY when nothing useful was detected at all
    if ((turnCount === 0 || msg.includes('hello') || msg.includes('hi')) && !knownDest && !knownDays && !knownBudget) {
      return `Great to meet you! 🌍 I'm excited to help plan your trip.

Tell me your dream destination (or a region), how many days, and your budget — I'll handle the rest!`
    }

    // Helper: build a "what's still missing" reply for destination-only messages
    const missingAfterDest = (_emoji: string, destName: string, note: string): string => {
      const daysLine = knownDays ? `- 📅 **Duration**: ${knownDays} days ✅` : `- 📅 **Duration**: How many days are you planning?`
      const budgetLine = knownBudget ? `- 💰 **Budget**: ${knownBudget.toLocaleString()} ${cur} ✅` : `- 💰 **Budget**: What's your total budget in ${cur}?`
      const allSet = knownDays && knownBudget
      return `${note}

Here's what I have so far:
- 📍 **Destination**: ${destName} ✅
${daysLine}
${budgetLine}${allSet ? '\n\nI have everything I need — click **"Generate My Trip Plan"** below! 🎯' : '\n\nJust reply with the missing details and I\'ll generate your plan instantly!'}`
    }

    // Helper: if dest is now known and we already have days + budget, auto-generate
    const autoGenerateIfComplete = (d: DestInfo): string | null => {
      if (!knownDays || !knownBudget) return null
      setDest(d)
      const budgetPKR   = Math.round(knownBudget * (toPKR[cur] ?? 1))
      const minTotalPKR = (d.minPerDayPKR ?? 20000) * knownDays
      const ratio       = budgetPKR / minTotalPKR
      if (ratio < 0.5) return null  // Let the budget-warning path handle it on next check
      return `Got it — I have everything I need! 🎯

- 📍 **Destination**: ${d.dest}
- 📅 **Duration**: ${knownDays} days
- 💰 **Budget**: ${knownBudget.toLocaleString()} ${cur}

Click **"Generate My Trip Plan"** below for your complete personalised itinerary!

${makeGenerateJSON(d, knownDays, knownBudget)}`
    }

    if (msg.includes('pakistan') || msg.includes('hunza') || msg.includes('northern') || msg.includes('skardu') || msg.includes('lahore') || msg.includes('islamabad') || msg.includes('swat') || msg.includes('murree')) {
      const d: DestInfo = { dest: 'Hunza Valley', style: 'Adventure', interests: ['trekking', 'mountains', 'nature'] }
      return autoGenerateIfComplete(d) ?? (setDest(d), missingAfterDest('🏔️', 'Hunza Valley, Pakistan', 'Pakistan is absolutely stunning! 🏔️ The northern areas — Hunza, Skardu, Fairy Meadows — are breathtaking.'))
    }

    if (msg.includes('thailand') || msg.includes('bangkok') || msg.includes('phuket') || msg.includes('chiang mai') || msg.includes('pattaya') || msg.includes('koh samui') || msg.includes('krabi')) {
      const d: DestInfo = { dest: 'Bangkok', style: 'Cultural', interests: ['culture', 'food', 'temples'], minPerDayPKR: 20000 }
      return autoGenerateIfComplete(d) ?? (setDest(d), missingAfterDest('🇹🇭', 'Bangkok, Thailand', "Thailand is incredible! 🇹🇭🏯 Glittering temples, Phuket beaches, and Chiang Mai's night bazaars."))
    }

    if (msg.includes('japan') || msg.includes('tokyo') || msg.includes('kyoto') || msg.includes('osaka') || msg.includes('hiroshima')) {
      const d: DestInfo = { dest: 'Tokyo', style: 'Cultural', interests: ['culture', 'food', 'technology'], minPerDayPKR: 45000 }
      return autoGenerateIfComplete(d) ?? (setDest(d), missingAfterDest('🗼', 'Tokyo, Japan', "Japan is a magical destination! 🗼🌸 Tokyo's futuristic skyline, Kyoto's ancient temples, and incredible food."))
    }

    if (msg.includes('singapore') || msg.includes('marina bay') || msg.includes('sentosa')) {
      const d: DestInfo = { dest: 'Singapore', style: 'Luxury', interests: ['food', 'shopping', 'city'], minPerDayPKR: 35000 }
      return autoGenerateIfComplete(d) ?? (setDest(d), missingAfterDest('🇸🇬', 'Singapore', 'Singapore is a world-class city-state! 🇸🇬✨ Marina Bay Sands, Gardens by the Bay, and incredible food.'))
    }

    if (msg.includes('london') || msg.includes('uk') || msg.includes('england') || msg.includes('britain')) {
      const d: DestInfo = { dest: 'London', style: 'Cultural', interests: ['culture', 'history', 'museums'], minPerDayPKR: 50000 }
      return autoGenerateIfComplete(d) ?? (setDest(d), missingAfterDest('🏙️', 'London, UK', "London is a world-class city! 🏙️🎭 Buckingham Palace, the British Museum, West End shows, and an incredible food scene."))
    }

    if (msg.includes('paris') || msg.includes('france')) {
      const d: DestInfo = { dest: 'Paris', style: 'Romantic', interests: ['culture', 'food', 'art'], minPerDayPKR: 45000 }
      return autoGenerateIfComplete(d) ?? (setDest(d), missingAfterDest('🗼', 'Paris, France', 'Paris, the City of Light! 🗼✨ The Eiffel Tower, Louvre, and world-famous cuisine await.'))
    }

    if (msg.includes('dubai') || msg.includes('uae') || msg.includes('emirates')) {
      const d: DestInfo = { dest: 'Dubai', style: 'Luxury', interests: ['luxury', 'shopping', 'architecture'], minPerDayPKR: 50000 }
      return autoGenerateIfComplete(d) ?? (setDest(d), missingAfterDest('🏙️', 'Dubai, UAE', 'Dubai — where luxury meets adventure! 🏙️✨ Burj Khalifa, desert safaris, and world-class dining.'))
    }

    if (msg.includes('bali') || msg.includes('indonesia')) {
      const d: DestInfo = { dest: 'Bali', style: 'Relaxation', interests: ['beach', 'temples', 'culture'], minPerDayPKR: 18000 }
      return autoGenerateIfComplete(d) ?? (setDest(d), missingAfterDest('🌴', 'Bali, Indonesia', 'Bali is simply magical! 🌴🌺 Stunning temples, rice terraces, beaches, and vibrant culture.'))
    }

    if (msg.includes('istanbul') || (msg.includes('turkey') && !msg.includes('turkey sandwich'))) {
      const d: DestInfo = { dest: 'Istanbul', style: 'Cultural', interests: ['history', 'culture', 'food'], minPerDayPKR: 22000 }
      return autoGenerateIfComplete(d) ?? (setDest(d), missingAfterDest('🕌', 'Istanbul, Turkey', 'Istanbul — where East meets West! 🕌🌉 Ancient bazaars, the Hagia Sophia, and incredible food.'))
    }

    if (msg.includes('kuala lumpur') || msg.includes('malaysia') || msg.includes(' kl ') || msg.includes('kl,')) {
      const d: DestInfo = { dest: 'Kuala Lumpur', style: 'Mixed', interests: ['food', 'culture', 'city'], minPerDayPKR: 18000 }
      return autoGenerateIfComplete(d) ?? (setDest(d), missingAfterDest('🏙️', 'Kuala Lumpur, Malaysia', 'Kuala Lumpur is vibrant and affordable! 🏙️🌃 Petronas Towers, amazing street food, and colonial charm.'))
    }

    if (msg.includes('morocco') || msg.includes('marrakech') || msg.includes('casablanca')) {
      const d: DestInfo = { dest: 'Marrakech, Morocco', style: 'Cultural', interests: ['culture', 'bazaar', 'food'], minPerDayPKR: 20000 }
      return autoGenerateIfComplete(d) ?? (setDest(d), missingAfterDest('🕌', 'Marrakech, Morocco', "Morocco is enchanting! 🕌🌺 Marrakech's medinas, the Sahara Desert, and incredible cuisine."))
    }

    if (msg.includes('egypt') || msg.includes('cairo') || msg.includes('pyramids') || msg.includes('luxor')) {
      const d: DestInfo = { dest: 'Cairo, Egypt', style: 'Cultural', interests: ['history', 'pyramids', 'culture'], minPerDayPKR: 22000 }
      return autoGenerateIfComplete(d) ?? (setDest(d), missingAfterDest('🏺', 'Cairo, Egypt', "Egypt — one of history's greatest civilizations! 🏺🌅 The Pyramids, the Nile, and ancient temples."))
    }

    if (msg.includes('greece') || msg.includes('athens') || msg.includes('santorini') || msg.includes('mykonos')) {
      const d: DestInfo = { dest: 'Athens, Greece', style: 'Cultural', interests: ['history', 'beaches', 'food'], minPerDayPKR: 38000 }
      return autoGenerateIfComplete(d) ?? (setDest(d), missingAfterDest('🏛️', 'Athens, Greece', 'Greece is breathtaking! 🏛️⛵ Ancient history, stunning island scenery, and amazing Mediterranean food.'))
    }

    if (msg.includes('vietnam') || msg.includes('hanoi') || msg.includes('ho chi') || msg.includes('saigon') || msg.includes('hoi an')) {
      const d: DestInfo = { dest: 'Hanoi, Vietnam', style: 'Cultural', interests: ['culture', 'food', 'history'], minPerDayPKR: 15000 }
      return autoGenerateIfComplete(d) ?? (setDest(d), missingAfterDest('🌿', 'Hanoi, Vietnam', "Vietnam is a traveler's dream! 🌿🍜 Ancient culture, incredible street food, and stunning landscapes."))
    }

    if (msg.includes('budget') || msg.match(/\$[\d,]+/) || msg.match(/\d+\s*(usd|pkr|gbp|eur|aed|sar|inr|cad|aud|try)/i)) {
      return `Perfect, I've noted your budget! 💰

Now let me understand what makes your ideal trip:
- **Top interests**: Adventure sports, cultural exploration, food & dining, relaxation, photography?
- **Weather preference**: Do you prefer warm/tropical, cool/mountainous, or mild weather?
- **Travel group**: Solo traveler, couple, friends, or family?`
    }

    if (msg.includes('adventure') || msg.includes('hiking') || msg.includes('trekking') || msg.includes('mountain')) {
      return `Love the adventurous spirit! 🏔️⛺

Based on what you've shared, I have enough to create an amazing itinerary. Hit **"Generate My Trip Plan"** below!

\`\`\`json
{
  "readyToGenerate": true,
  "preferences": {
    "budget": ${defaultBudget},
    "currency": "${cur}",
    "duration": 7,
    "interests": ["adventure", "hiking", "nature"],
    "weather": "cool mountain",
    "travelStyle": "Adventure",
    "departureCity": "Your city",
    "groupType": "solo"
  },
  "suggestedDestination": "Hunza Valley, Pakistan"
}
\`\`\``
    }

    if (msg.includes('relax') || msg.includes('beach') || msg.includes('chill') || msg.includes('resort')) {
      return `A relaxing beach escape sounds perfect! 🌊🌴

Almost ready to build your plan!

\`\`\`json
{
  "readyToGenerate": true,
  "preferences": {
    "budget": ${Math.round(defaultBudget * 0.85)},
    "currency": "${cur}",
    "duration": 7,
    "interests": ["relaxation", "beach", "snorkeling"],
    "weather": "tropical warm",
    "travelStyle": "Relaxation",
    "departureCity": "Your city",
    "groupType": "couple"
  },
  "suggestedDestination": "Bali, Indonesia"
}
\`\`\``
    }

    if (turnCount >= 3) {
      const { dest, style, interests } = pickDestination()
      return `I think I have a great picture of your dream trip now! 🎯

Based on our conversation, I'm ready to create your personalized travel plan with:
- ✅ Day-by-day itinerary
- ✅ Restaurant recommendations
- ✅ Activity suggestions
- ✅ Cost breakdown in ${cur}

Click **"Generate My Trip Plan"** below to see your complete itinerary!

\`\`\`json
{
  "readyToGenerate": true,
  "preferences": {
    "budget": ${defaultBudget},
    "currency": "${cur}",
    "duration": 7,
    "interests": ${JSON.stringify(interests)},
    "weather": "mild",
    "travelStyle": "${style}",
    "departureCity": "Your city",
    "groupType": "solo"
  },
  "suggestedDestination": "${dest}"
}
\`\`\``
    }

    // Smart fallback: only ask for what's genuinely missing
    const missing: string[] = []
    if (!knownDest) missing.push('📍 **Destination** — where would you like to go?')
    if (!knownDays) missing.push(`📅 **Duration** — how many days?`)
    if (!knownBudget) missing.push(`💰 **Budget** — total budget in ${cur}?`)

    if (missing.length === 3) {
      return `That sounds exciting! 🌍 To create your perfect itinerary, just tell me:\n${missing.map(m => `- ${m}`).join('\n')}`
    }
    return `Almost there! 🎯 I just need:\n${missing.map(m => `- ${m}`).join('\n')}`
  }, [selectedCurrency])

  const callAI = useCallback(async (userMessage: string, history: typeof conversationHistory) => {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

    if (!apiKey) {
      return generateSmartResponse(userMessage, history.length)
    }

    const newHistory = [
      ...history,
      { role: 'user' as const, content: userMessage }
    ]

    const dynamicSystemPrompt = `${TRAVEL_SYSTEM_PROMPT}

IMPORTANT: The user has selected **${selectedCurrency}** as their preferred budget currency. Always use ${selectedCurrency} when discussing budget or costs, and always set "currency": "${selectedCurrency}" in the JSON response.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: dynamicSystemPrompt,
        messages: newHistory,
      }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>
    }
    return data.content[0]?.text || ''
  }, [selectedCurrency, generateSmartResponse])

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

    const newHistory = [...conversationHistory, { role: 'user' as const, content: messageText }]

    try {
      const aiResponse = await callAI(messageText, conversationHistory)

      const parsed = parsePreferencesFromResponse(aiResponse)
      if (parsed.readyToGenerate && parsed.preferences) {
        setExtractedPreferences(parsed)
        setShowGenerateButton(true)
      }

      const cleanResponse = aiResponse.replace(/```json[\s\S]*?```/g, '').trim()

      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: cleanResponse || "I'm ready to generate your trip plan! Click the button below.",
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, aiMessage])
      setConversationHistory([...newHistory, { role: 'assistant', content: aiResponse }])
    } catch {
      const errMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please check your API key or try again in a moment. 🔄",
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errMessage])
    } finally {
      setIsTyping(false)
    }
  }, [input, isTyping, conversationHistory, callAI])

  // Auto-send query when navigated from Home search bar
  useEffect(() => {
    const query = (location.state as { initialQuery?: string } | null)?.initialQuery
    if (query?.trim() && !initialQuerySentRef.current) {
      initialQuerySentRef.current = true
      setTimeout(() => void sendMessage(query.trim()), 150)
    }
  }, [location.state, sendMessage])

  const handleGeneratePlan = useCallback(async () => {
    if (isGenerating) return
    setIsGenerating(true)

    const preferences = extractedPreferences?.preferences || {
      budget: DEFAULT_BUDGETS[selectedCurrency] ?? 1500,
      currency: selectedCurrency,
      duration: 7,
      interests: ['exploration', 'culture'],
      weather: 'mild',
      travelStyle: 'Mixed',
      departureCity: 'Unknown',
      groupType: 'solo',
    }

    const loadingMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '🗺️ Crafting your personalised itinerary with real destinations, hotels, and restaurants… This takes about 15–20 seconds!',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, loadingMessage])

    try {
      // Try the real Claude-powered backend first; fall back to mock if unavailable
      let plan
      try {
        plan = await generateTripPlan(preferences, extractedPreferences?.suggestedDestination)
      } catch {
        plan = generateMockPlan(preferences, extractedPreferences?.suggestedDestination)
      }

      setCurrentPreferences(preferences)
      setCurrentPlan(plan)
      saveTrip(plan)
      addSearchHistory({
        query: extractedPreferences?.suggestedDestination ?? 'Trip',
        destination: extractedPreferences?.suggestedDestination,
        budget: preferences.budget,
        currency: preferences.currency,
        duration: preferences.duration,
        interests: preferences.interests,
        resultPlanId: plan.id,
      })
      navigate('/itinerary')
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
  }, [isGenerating, extractedPreferences, selectedCurrency, setCurrentPreferences, setCurrentPlan, saveTrip, navigate, addSearchHistory])

  const resetChat = () => {
    setMessages([INITIAL_MESSAGE])
    setInput('')
    setIsTyping(false)
    setShowGenerateButton(false)
    setExtractedPreferences(null)
    setConversationHistory([])
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

  return (
    <div className="min-h-screen pt-16 sm:pt-20 pb-8 px-3 sm:px-4 flex flex-col">
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
                  {/* Ambient glow */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#e91e8c]/20 to-[#4cc9f0]/20 blur-2xl group-focus-within:from-[#e91e8c]/35 group-focus-within:to-[#4cc9f0]/35 transition-all duration-500 pointer-events-none" />
                  {/* Input pill */}
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
                            {msg.content.split('**').map((part, i) =>
                              i % 2 === 1
                                ? <strong key={i} className="text-white font-semibold">{part}</strong>
                                : <span key={i}>{part}</span>
                            )}
                          </div>
                          <span className="text-white/25 text-xs ml-1">
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  <AnimatePresence>
                    <AITyping active={isTyping} />
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
