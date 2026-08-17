import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Sparkles, Plane, RefreshCw, Zap, RotateCcw,
  MapPin, Clock, Users, Thermometer, Heart, Coins, Search,
  Maximize2, Minimize2,
} from 'lucide-react'
import { useTripContext } from '@/context/TripContext'
import { useAuth } from '@/context/AuthContext'
import { streamChat, deleteSession, generatePlan, type AgentRequirements } from '@/services/agentService'
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

type ExtractedPrefs = {
  origin: string
  destination: string
  days: number
  travelers: number
  interests: string[]
  budget: number
  travelMonth: string
}

export default function TripPlanner() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showGenerateButton, setShowGenerateButton] = useState(false)
  const [extractedPreferences, setExtractedPreferences] = useState<ExtractedPrefs | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState('PKR')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const initialQuerySentRef = useRef(false)

  const navigate = useNavigate()
  const location = useLocation()
  const { setCurrentPreferences, setCurrentPlan, saveTrip, addSearchHistory, savedTrips, searchHistory } = useTripContext()
  const { user, isAuthenticated } = useAuth()

  const plannerGreeting = (() => {
    if (!isAuthenticated || !user) return null
    const firstName = user.name.split(' ')[0]
    const ongoingTrip = savedTrips.find(t => t.status === 'ongoing')
    if (ongoingTrip) return `Welcome back, ${firstName}! Still exploring ${ongoingTrip.destination}? 🌍`
    if (savedTrips.length > 0) return `Welcome back, ${firstName}! Ready for your next adventure? ✈️`
    if (searchHistory.length > 0) {
      const recent = searchHistory[0].destination
      if (recent) return `Welcome back, ${firstName}! Still dreaming of ${recent}? ✨`
    }
    return `Welcome, ${firstName}! Let's plan your first adventure! 🌏`
  })()

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
        onRequirementsReady: (prefs: AgentRequirements) => {
          setExtractedPreferences({
            origin: prefs.origin,
            destination: prefs.destination,
            days: prefs.duration_days,
            travelers: prefs.travelers,
            interests: prefs.interests ?? [],
            budget: prefs.budget ?? 0,
            travelMonth: prefs.travel_month ?? '',
          })
          setShowGenerateButton(true)
          if (prefs.currency) setSelectedCurrency(prefs.currency)
        },
      })

      if (resolvedSessionId && resolvedSessionId !== sessionId) {
        setSessionId(resolvedSessionId)
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

    const { origin, destination, days, travelers, interests, budget, travelMonth } = extractedPreferences

    const loadingMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '🗺️ Building your personalised trip plan from real destination data… This takes about 10–15 seconds!',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, loadingMsg])

    // Auto-derive a sensible budget when the user didn't share one
    const fallbackPerPerson = DEFAULT_BUDGETS[selectedCurrency] ?? DEFAULT_BUDGETS.PKR
    const effectiveBudget = budget > 0 ? budget : fallbackPerPerson * travelers

    const planParams = {
      destination,
      durationDays: days,
      budget: effectiveBudget,
      currency: selectedCurrency,
      interests: interests.length > 0 ? interests : ['culture', 'food'],
      travelStyle: 'Mixed',
      groupType: travelers > 1 ? 'group' : 'solo',
      origin,
      travelers,
      travelMonth,
    }

    try {
      const plan = await generatePlan(planParams)

      // Auto-save: persist trip + chat transcript, then jump to trip detail
      const conversation = [...messages, loadingMsg]
        .filter(m => m.id !== '0' && m.content.trim() && !m.content.startsWith('🗺️ Building your'))
        .map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp.toISOString() }))

      const planWithConvo = conversation.length ? { ...plan, conversation } : plan

      setCurrentPreferences(plan.preferences)
      setCurrentPlan(planWithConvo)
      saveTrip(plan, conversation)
      addSearchHistory({
        query: destination,
        destination,
        budget: effectiveBudget,
        currency: selectedCurrency,
        duration: days,
        interests: plan.preferences.interests,
        resultPlanId: plan.id,
      })
      navigate(`/trips/${plan.id}`)
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
  }, [isGenerating, extractedPreferences, selectedCurrency, messages, setCurrentPreferences, setCurrentPlan, saveTrip, addSearchHistory, navigate])

  const resetChat = () => {
    if (sessionId) void deleteSession(sessionId, 'anonymous')
    setSessionId(null)
    setMessages([INITIAL_MESSAGE])
    setInput('')
    setIsTyping(false)
    setShowGenerateButton(false)
    setExtractedPreferences(null)
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
          {plannerGreeting && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#e91e8c]/10 border border-[#e91e8c]/20 text-[#f06ab3] text-sm font-medium"
            >
              {plannerGreeting}
            </motion.p>
          )}
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
