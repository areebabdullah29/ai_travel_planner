import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Sparkles, Plane, RefreshCw, Zap, RotateCcw,
  MapPin, Clock, Users, Thermometer, Heart, Coins, Search
} from 'lucide-react'
import { useTripContext } from '@/context/TripContext'
import {
  TRAVEL_SYSTEM_PROMPT,
  parsePreferencesFromResponse,
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

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const initialQuerySentRef = useRef(false)
  // Tracks the destination the user mentioned across all conversation turns
  const detectedDestinationRef = useRef<{ dest: string; style: string; interests: string[] } | null>(null)
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

    // Helper: pick destination from current message keywords, also updating detectedDestinationRef
    const setDest = (d: { dest: string; style: string; interests: string[] }) => {
      detectedDestinationRef.current = d
      return d
    }
    const pickDestination = (): { dest: string; style: string; interests: string[] } => {
      // Always prefer a destination detected earlier in the conversation
      if (detectedDestinationRef.current) return detectedDestinationRef.current
      if (msg.includes('london') || msg.includes('uk') || msg.includes('england') || msg.includes('britain'))
        return setDest({ dest: 'London', style: 'Cultural', interests: ['culture', 'history', 'museums'] })
      if (msg.includes('paris') || msg.includes('france'))
        return setDest({ dest: 'Paris', style: 'Romantic', interests: ['culture', 'food', 'art'] })
      if (msg.includes('spain') || msg.includes('barcelona'))
        return setDest({ dest: 'Barcelona', style: 'Cultural', interests: ['culture', 'food', 'architecture'] })
      if (msg.includes('rome') || msg.includes('italy') || msg.includes('italian'))
        return setDest({ dest: 'Rome, Italy', style: 'Cultural', interests: ['history', 'art', 'food'] })
      if (msg.includes('dubai') || msg.includes('uae') || msg.includes('emirates') || msg.includes('abu dhabi'))
        return setDest({ dest: 'Dubai', style: 'Luxury', interests: ['luxury', 'shopping', 'architecture'] })
      if (msg.includes('turkey') || msg.includes('istanbul'))
        return setDest({ dest: 'Istanbul', style: 'Cultural', interests: ['history', 'culture', 'food'] })
      if (msg.includes('bali') || msg.includes('indonesia'))
        return setDest({ dest: 'Bali', style: 'Relaxation', interests: ['beach', 'temples', 'culture'] })
      if (msg.includes('malaysia') || msg.includes('kuala lumpur') || msg.includes(' kl ') || msg.includes('kl,'))
        return setDest({ dest: 'Kuala Lumpur', style: 'Mixed', interests: ['food', 'culture', 'city'] })
      if (msg.includes('thailand') || msg.includes('bangkok') || msg.includes('phuket') || msg.includes('chiang mai') || msg.includes('pattaya') || msg.includes('koh samui'))
        return setDest({ dest: 'Bangkok', style: 'Cultural', interests: ['culture', 'food', 'temples'] })
      if (msg.includes('japan') || msg.includes('tokyo') || msg.includes('kyoto') || msg.includes('osaka') || msg.includes('hiroshima'))
        return setDest({ dest: 'Tokyo', style: 'Cultural', interests: ['culture', 'food', 'technology'] })
      if (msg.includes('singapore') || msg.includes(' sg ') || msg.includes('sentosa') || msg.includes('marina bay'))
        return setDest({ dest: 'Singapore', style: 'Luxury', interests: ['food', 'shopping', 'city'] })
      if (msg.includes('morocco') || msg.includes('marrakech') || msg.includes('casablanca') || msg.includes('fes'))
        return setDest({ dest: 'Marrakech, Morocco', style: 'Cultural', interests: ['culture', 'bazaar', 'food'] })
      if (msg.includes('vietnam') || msg.includes('hanoi') || msg.includes('ho chi') || msg.includes('saigon'))
        return setDest({ dest: 'Hanoi, Vietnam', style: 'Cultural', interests: ['culture', 'food', 'history'] })
      if (msg.includes('maldives') || msg.includes('maldive'))
        return setDest({ dest: 'Maldives', style: 'Relaxation', interests: ['beach', 'relaxation', 'snorkeling'] })
      if (msg.includes('nepal') || msg.includes('everest') || msg.includes('kathmandu'))
        return setDest({ dest: 'Kathmandu, Nepal', style: 'Adventure', interests: ['trekking', 'mountains', 'culture'] })
      if (msg.includes('africa') || msg.includes('safari') || msg.includes('kenya') || msg.includes('nairobi'))
        return setDest({ dest: 'Nairobi, Kenya', style: 'Adventure', interests: ['wildlife', 'safari', 'nature'] })
      if (msg.includes('new york') || msg.includes('nyc') || msg.includes('manhattan') || msg.includes('america') || msg.includes('usa') || msg.includes('united states'))
        return setDest({ dest: 'New York, USA', style: 'Cultural', interests: ['city', 'culture', 'food'] })
      if (msg.includes('australia') || msg.includes('sydney') || msg.includes('melbourne'))
        return setDest({ dest: 'Sydney, Australia', style: 'Mixed', interests: ['beaches', 'culture', 'nature'] })
      if (msg.includes('egypt') || msg.includes('cairo') || msg.includes('pyramids'))
        return setDest({ dest: 'Cairo, Egypt', style: 'Cultural', interests: ['history', 'pyramids', 'culture'] })
      if (msg.includes('greece') || msg.includes('athens') || msg.includes('santorini') || msg.includes('mykonos'))
        return setDest({ dest: 'Athens, Greece', style: 'Cultural', interests: ['history', 'beaches', 'food'] })
      // Default: rotate through popular destinations
      const defaults = [
        { dest: 'Bangkok', style: 'Cultural', interests: ['culture', 'food', 'temples'] },
        { dest: 'Istanbul', style: 'Cultural', interests: ['history', 'culture', 'food'] },
        { dest: 'Bali', style: 'Relaxation', interests: ['beach', 'culture', 'food'] },
        { dest: 'Dubai', style: 'Luxury', interests: ['luxury', 'shopping', 'city'] },
      ]
      const d = defaults[turnCount % defaults.length]
      detectedDestinationRef.current = d
      return d
    }

    if (turnCount === 0 || msg.includes('hello') || msg.includes('hi')) {
      return `Great to meet you! 🌍 I'm excited to help plan your trip.

Let me understand your dream adventure better. Could you tell me:
1. **Where** would you like to go? (specific country/city, or a region like "Southeast Asia")
2. **How long** are you planning to travel?`
    }

    if (msg.includes('pakistan') || msg.includes('hunza') || msg.includes('northern') || msg.includes('skardu') || msg.includes('lahore') || msg.includes('islamabad') || msg.includes('swat') || msg.includes('murree')) {
      setDest({ dest: 'Hunza Valley', style: 'Adventure', interests: ['trekking', 'mountains', 'nature'] })
      return `Pakistan is absolutely stunning! 🏔️ The northern areas — Hunza, Skardu, Fairy Meadows — are breathtaking.

A few questions to tailor your Pakistan adventure:
- **Budget**: What's your total budget in ${cur}?
- **Interests**: Hiking & trekking, cultural sites, photography, or a mix?
- **Group**: Traveling solo, with friends, or family?`
    }

    if (msg.includes('thailand') || msg.includes('bangkok') || msg.includes('phuket') || msg.includes('chiang mai') || msg.includes('pattaya') || msg.includes('koh samui') || msg.includes('krabi')) {
      setDest({ dest: 'Bangkok', style: 'Cultural', interests: ['culture', 'food', 'temples'] })
      return `Thailand is incredible! 🇹🇭🏯 From Bangkok's glittering temples to Phuket's beaches and Chiang Mai's night bazaars.

Tell me more:
- **Duration**: How many days are you planning?
- **Which part**: Bangkok city, Phuket beaches, Chiang Mai culture, or island-hopping?
- **Interests**: Temples & culture, street food, beaches & diving, nightlife, or a mix?
- **Budget**: What's your budget in ${cur}?`
    }

    if (msg.includes('japan') || msg.includes('tokyo') || msg.includes('kyoto') || msg.includes('osaka') || msg.includes('hiroshima')) {
      setDest({ dest: 'Tokyo', style: 'Cultural', interests: ['culture', 'food', 'technology'] })
      return `Japan is a magical destination! 🗼🌸 From Tokyo's futuristic skyline to Kyoto's ancient temples.

Tell me more:
- **Duration**: How many days are you planning?
- **Interests**: Culture & temples, anime/gaming, street food tours, nature, or all of it?
- **Season**: Any preferred time? Cherry blossom season in April is absolutely spectacular!
- **Budget**: What's your budget in ${cur}?`
    }

    if (msg.includes('singapore') || msg.includes('marina bay') || msg.includes('sentosa')) {
      setDest({ dest: 'Singapore', style: 'Luxury', interests: ['food', 'shopping', 'city'] })
      return `Singapore is a world-class city-state! 🇸🇬✨ Marina Bay Sands, Gardens by the Bay, and incredible food.

Tell me:
- **Duration**: How many days?
- **Interests**: City sightseeing, hawker food culture, Universal Studios, shopping, or nature?
- **Budget**: What's your budget in ${cur}?`
    }

    if (msg.includes('london') || msg.includes('uk') || msg.includes('england') || msg.includes('britain')) {
      setDest({ dest: 'London', style: 'Cultural', interests: ['culture', 'history', 'museums'] })
      return `London is a world-class city! 🏙️🎭 From Buckingham Palace to the British Museum, the West End shows, and an incredible food scene.

Tell me more:
- **Duration**: How many days in London?
- **Interests**: History & museums, theatre, royal sites, shopping, or food?
- **Budget**: What's your budget in ${cur}?`
    }

    if (msg.includes('paris') || msg.includes('france')) {
      setDest({ dest: 'Paris', style: 'Romantic', interests: ['culture', 'food', 'art'] })
      return `Paris, the City of Light! 🗼✨ The Eiffel Tower, Louvre, and world-famous cuisine await.

A few questions:
- **Duration**: How many days in Paris?
- **Interests**: Art & museums, fine dining, fashion, day trips, or architecture?
- **Budget**: What's your budget in ${cur}?`
    }

    if (msg.includes('dubai') || msg.includes('uae') || msg.includes('emirates')) {
      setDest({ dest: 'Dubai', style: 'Luxury', interests: ['luxury', 'shopping', 'architecture'] })
      return `Dubai — where luxury meets adventure! 🏙️✨ Burj Khalifa, desert safaris, and world-class dining.

Let me know:
- **Duration**: How many days are you planning?
- **Interests**: Shopping, desert safari, beaches, architecture, or nightlife?
- **Budget**: What's your budget in ${cur}? (Dubai suits every budget!)`
    }

    if (msg.includes('bali') || msg.includes('indonesia')) {
      setDest({ dest: 'Bali', style: 'Relaxation', interests: ['beach', 'temples', 'culture'] })
      return `Bali is simply magical! 🌴🌺 Stunning temples, rice terraces, beaches, and vibrant culture.

Tell me:
- **Duration**: How many days in Bali?
- **Interests**: Beaches & surfing, temples & culture, yoga & wellness, food, or nightlife?
- **Budget**: What's your budget in ${cur}?`
    }

    if (msg.includes('istanbul') || (msg.includes('turkey') && !msg.includes('turkey sandwich'))) {
      setDest({ dest: 'Istanbul', style: 'Cultural', interests: ['history', 'culture', 'food'] })
      return `Istanbul — where East meets West! 🕌🌉 Ancient bazaars, the Hagia Sophia, Bosphorus cruises, and incredible food.

Let me know:
- **Duration**: How many days in Istanbul?
- **Interests**: History & mosques, bazaars, food tours, Bosphorus, or architecture?
- **Budget**: What's your budget in ${cur}?`
    }

    if (msg.includes('kuala lumpur') || msg.includes('malaysia') || msg.includes(' kl ') || msg.includes('kl,')) {
      setDest({ dest: 'Kuala Lumpur', style: 'Mixed', interests: ['food', 'culture', 'city'] })
      return `Kuala Lumpur is vibrant and affordable! 🏙️🌃 Petronas Towers, amazing street food, and colonial charm.

Tell me:
- **Duration**: How many days in KL?
- **Interests**: City sightseeing, street food, shopping, nature retreats, or day trips?
- **Budget**: What's your budget in ${cur}?`
    }

    if (msg.includes('morocco') || msg.includes('marrakech') || msg.includes('casablanca')) {
      setDest({ dest: 'Marrakech, Morocco', style: 'Cultural', interests: ['culture', 'bazaar', 'food'] })
      return `Morocco is enchanting! 🕌🌺 Marrakech's medinas, the Sahara Desert, and incredible cuisine await.

Tell me:
- **Duration**: How many days?
- **Interests**: Ancient medinas & souks, Sahara desert tour, food & cooking, architecture, or beaches?
- **Budget**: What's your budget in ${cur}?`
    }

    if (msg.includes('egypt') || msg.includes('cairo') || msg.includes('pyramids') || msg.includes('luxor')) {
      setDest({ dest: 'Cairo, Egypt', style: 'Cultural', interests: ['history', 'pyramids', 'culture'] })
      return `Egypt — one of history's greatest civilizations! 🏺🌅 The Pyramids, the Nile, and ancient temples.

Tell me:
- **Duration**: How many days?
- **Interests**: Ancient monuments & pyramids, Nile cruise, diving in the Red Sea, or Cairo city life?
- **Budget**: What's your budget in ${cur}?`
    }

    if (msg.includes('greece') || msg.includes('athens') || msg.includes('santorini') || msg.includes('mykonos')) {
      setDest({ dest: 'Athens, Greece', style: 'Cultural', interests: ['history', 'beaches', 'food'] })
      return `Greece is breathtaking! 🏛️⛵ Ancient history, stunning island scenery, and amazing Mediterranean food.

Tell me:
- **Duration**: How many days?
- **Interests**: Ancient history & Acropolis, island-hopping, beaches & sailing, food & wine, or city life?
- **Budget**: What's your budget in ${cur}?`
    }

    if (msg.includes('vietnam') || msg.includes('hanoi') || msg.includes('ho chi') || msg.includes('saigon') || msg.includes('hoi an')) {
      setDest({ dest: 'Hanoi, Vietnam', style: 'Cultural', interests: ['culture', 'food', 'history'] })
      return `Vietnam is a traveler's dream! 🌿🍜 Ancient culture, incredible street food, and stunning landscapes.

Tell me:
- **Duration**: How many days?
- **Which region**: Hanoi (north), Hoi An & Da Nang (central), Ho Chi Minh City (south), or Ha Long Bay?
- **Budget**: What's your budget in ${cur}?`
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

    return `That sounds exciting! 🌍

To create your perfect itinerary, I need a few more details:
- What's your **budget** for this trip? (in ${cur})
- How many **days** are you planning?
- What are your main **interests** while traveling?`
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
      content: '🗺️ Generating your personalized trip plan... This might take a moment!',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, loadingMessage])

    try {
      await new Promise(resolve => setTimeout(resolve, 1500))
      const plan = generateMockPlan(preferences, extractedPreferences?.suggestedDestination)
      setCurrentPreferences(preferences)
      setCurrentPlan(plan)
      saveTrip(plan)   // Auto-save so it persists in the dashboard immediately
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
        content: 'Something went wrong generating your plan. Please try again!',
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
              <div className="flex-1 glass rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col" style={{ minHeight: '45vh', maxHeight: '60vh' }}>
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
