import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Sparkles, Plane, RefreshCw, Zap, RotateCcw,
  MapPin, Clock, Users, Thermometer, Heart, Coins
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
  const navigate = useNavigate()
  const { setCurrentPreferences, setCurrentPlan, saveTrip, addSearchHistory } = useTripContext()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const generateSmartResponse = useCallback((userMessage: string, turnCount: number): string => {
    const msg = userMessage.toLowerCase()
    const cur = selectedCurrency
    const defaultBudget = DEFAULT_BUDGETS[cur] ?? 1500

    // Helper: pick a destination based on message keywords (only destinations in destinations.json)
    const pickDestination = (): { dest: string; style: string; interests: string[] } => {
      if (msg.includes('london') || msg.includes('uk') || msg.includes('england') || msg.includes('britain'))
        return { dest: 'London, UK', style: 'Cultural', interests: ['culture', 'history', 'museums'] }
      if (msg.includes('paris') || msg.includes('france'))
        return { dest: 'Paris, France', style: 'Romantic', interests: ['culture', 'food', 'art'] }
      if (msg.includes('spain') || msg.includes('barcelona'))
        return { dest: 'Barcelona, Spain', style: 'Cultural', interests: ['culture', 'food', 'architecture'] }
      if (msg.includes('europe') || msg.includes('rome') || msg.includes('italy'))
        return { dest: 'Istanbul, Turkey', style: 'Cultural', interests: ['history', 'culture', 'food'] }
      if (msg.includes('middle east') || msg.includes('dubai') || msg.includes('arab') || msg.includes('uae'))
        return { dest: 'Dubai, UAE', style: 'Luxury', interests: ['luxury', 'shopping', 'architecture'] }
      if (msg.includes('turkey') || msg.includes('istanbul'))
        return { dest: 'Istanbul, Turkey', style: 'Cultural', interests: ['history', 'culture', 'food'] }
      if (msg.includes('bali') || msg.includes('indonesia'))
        return { dest: 'Bali, Indonesia', style: 'Relaxation', interests: ['beach', 'temples', 'culture'] }
      if (msg.includes('malaysia') || msg.includes('kuala lumpur') || msg.includes(' kl '))
        return { dest: 'Kuala Lumpur, Malaysia', style: 'Mixed', interests: ['food', 'culture', 'city'] }
      if (msg.includes('africa') || msg.includes('safari') || msg.includes('kenya'))
        return { dest: 'Bali, Indonesia', style: 'Adventure', interests: ['nature', 'culture', 'adventure'] }
      if (msg.includes('morocco') || msg.includes('marrakech'))
        return { dest: 'Istanbul, Turkey', style: 'Cultural', interests: ['culture', 'bazaar', 'food'] }
      if (msg.includes('vietnam') || msg.includes('hanoi') || msg.includes('ho chi'))
        return { dest: 'Kuala Lumpur, Malaysia', style: 'Cultural', interests: ['culture', 'food', 'history'] }
      if (msg.includes('maldives') || msg.includes('island') || msg.includes('resort'))
        return { dest: 'Bali, Indonesia', style: 'Luxury', interests: ['beach', 'relaxation', 'snorkeling'] }
      if (msg.includes('nepal') || msg.includes('everest') || msg.includes('kathmandu'))
        return { dest: 'Hunza Valley, Pakistan', style: 'Adventure', interests: ['trekking', 'mountains', 'nature'] }
      // Default: rotate through destinations in our database
      const defaults = [
        { dest: 'Bali, Indonesia', style: 'Relaxation', interests: ['beach', 'culture', 'food'] },
        { dest: 'Istanbul, Turkey', style: 'Cultural', interests: ['history', 'culture', 'food'] },
        { dest: 'Kuala Lumpur, Malaysia', style: 'Mixed', interests: ['food', 'culture', 'city'] },
        { dest: 'Dubai, UAE', style: 'Luxury', interests: ['luxury', 'shopping', 'city'] },
      ]
      return defaults[turnCount % defaults.length]
    }

    if (turnCount === 0 || msg.includes('hello') || msg.includes('hi')) {
      return `Great to meet you! 🌍 I'm excited to help plan your trip.

Let me understand your dream adventure better. Could you tell me:
1. **Where** would you like to go? (specific country/city, or a region like "Southeast Asia")
2. **How long** are you planning to travel?`
    }

    if (msg.includes('pakistan') || msg.includes('hunza') || msg.includes('northern') || msg.includes('skardu')) {
      return `Pakistan is absolutely stunning! 🏔️ The northern areas — Hunza, Skardu, Fairy Meadows — are breathtaking.

A few questions to tailor your Pakistan adventure:
- **Budget**: What's your total budget in ${cur}?
- **Interests**: Hiking & trekking, cultural sites, photography, or a mix?
- **Group**: Traveling solo, with friends, or family?`
    }

    if (msg.includes('japan') || msg.includes('tokyo') || msg.includes('kyoto') || msg.includes('osaka')) {
      return `Japan is a magical destination! 🗼 From ancient temples to futuristic cities.

Tell me more:
- **Duration**: How many days are you planning?
- **Interests**: Culture & temples, anime/gaming, food tours, nature, or nightlife?
- **Season**: Any preferred time of year? (Cherry blossom season in April is spectacular!)`
    }

    if (msg.includes('london') || msg.includes('uk') || msg.includes('england') || msg.includes('britain')) {
      return `London is a world-class city! 🏙️🎭 From Buckingham Palace to the British Museum, the West End shows, and an incredible food scene.

Tell me more:
- **Duration**: How many days in London?
- **Interests**: History & museums, theatre, royal sites, shopping, or food?
- **Budget**: What's your budget in ${cur}?`
    }

    if (msg.includes('paris') || msg.includes('france')) {
      return `Paris, the City of Light! 🗼✨ The Eiffel Tower, Louvre, and world-famous cuisine await.

A few questions:
- **Duration**: How many days in Paris?
- **Interests**: Art & museums, fine dining, fashion, day trips, or architecture?
- **Budget**: What's your budget in ${cur}?`
    }

    if (msg.includes('dubai') || msg.includes('uae') || msg.includes('emirates')) {
      return `Dubai — where luxury meets adventure! 🏙️✨ Burj Khalifa, desert safaris, and world-class dining.

Let me know:
- **Duration**: How many days are you planning?
- **Interests**: Shopping, desert safari, beaches, architecture, or nightlife?
- **Budget**: What's your budget in ${cur}? (Dubai suits every budget!)`
    }

    if (msg.includes('bali') || msg.includes('indonesia')) {
      return `Bali is simply magical! 🌴🌺 Stunning temples, rice terraces, beaches, and vibrant culture.

Tell me:
- **Duration**: How many days in Bali?
- **Interests**: Beaches & surfing, temples & culture, yoga & wellness, food, or nightlife?
- **Budget**: What's your budget in ${cur}?`
    }

    if (msg.includes('istanbul') || (msg.includes('turkey') && !msg.includes('turkey sandwich'))) {
      return `Istanbul — where East meets West! 🕌🌉 Ancient bazaars, the Hagia Sophia, Bosphorus cruises, and incredible food.

Let me know:
- **Duration**: How many days in Istanbul?
- **Interests**: History & mosques, bazaars, food tours, Bosphorus, or architecture?
- **Budget**: What's your budget in ${cur}?`
    }

    if (msg.includes('kuala lumpur') || msg.includes('malaysia')) {
      return `Kuala Lumpur is vibrant and affordable! 🏙️🌃 Petronas Towers, amazing street food, and colonial charm.

Tell me:
- **Duration**: How many days in KL?
- **Interests**: City sightseeing, street food, shopping, nature retreats, or day trips?
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
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const selectedCurrencyInfo = CURRENCIES.find(c => c.code === selectedCurrency)

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex flex-col h-full gap-5">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-coral text-[#e91e8c] text-sm font-medium mb-4">
            <Sparkles size={14} />
            AI Travel Assistant
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-3">
            Plan Your Perfect Trip
          </h1>
          <p className="text-white/50 text-base">
            Chat with our AI to create a personalized travel itinerary
          </p>
        </motion.div>

        {/* Currency Selector */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-2xl p-4"
        >
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
        </motion.div>

        {/* Context pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="flex flex-wrap gap-2 justify-center"
        >
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
        </motion.div>

        {/* Chat Window */}
        <div className="flex-1 glass rounded-3xl overflow-hidden flex flex-col" style={{ minHeight: '55vh', maxHeight: '65vh' }}>
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
      </div>
    </div>
  )
}
