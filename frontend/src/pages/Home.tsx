import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles, MapPin, DollarSign, Clock, CloudSun,
  Utensils, Compass, ArrowRight,
  Star, Globe, Zap, Search, Send
} from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: 'easeOut' as const }
  })
}

const destinations = [
  { name: 'Bali, Indonesia', tag: 'Relaxation', days: '7 days', cost: 'Rs 3,36,000', img: '🌴', color: '#4cc9f0' },
  { name: 'Tokyo, Japan', tag: 'Culture', days: '10 days', cost: 'Rs 7,84,000', img: '🗼', color: '#ffd166' },
  { name: 'Hunza Valley', tag: 'Adventure', days: '5 days', cost: 'Rs 1,12,000', img: '🏔️', color: '#e91e8c' },
  { name: 'Paris, France', tag: 'Romantic', days: '6 days', cost: 'Rs 5,88,000', img: '🗺️', color: '#06d6a0' },
  { name: 'Safari, Kenya', tag: 'Wildlife', days: '8 days', cost: 'Rs 9,80,000', img: '🦁', color: '#ffd166' },
  { name: 'Santorini, Greece', tag: 'Scenic', days: '5 days', cost: 'Rs 5,04,000', img: '⛵', color: '#4cc9f0' },
]

const features = [
  {
    icon: Sparkles,
    title: 'AI-Powered Planning',
    desc: 'Claude AI generates personalized itineraries based on your unique preferences, budget, and travel style.',
    color: '#e91e8c'
  },
  {
    icon: DollarSign,
    title: 'Smart Budget Analysis',
    desc: 'Get detailed cost breakdowns for flights, hotels, food, and activities — no hidden surprises.',
    color: '#ffd166'
  },
  {
    icon: CloudSun,
    title: 'Weather-Aware Itineraries',
    desc: 'Plans that match the best seasons and weather conditions for your chosen destinations.',
    color: '#4cc9f0'
  },
  {
    icon: Utensils,
    title: 'Restaurant Picks',
    desc: 'Curated local dining recommendations from street food to fine dining, matching your budget.',
    color: '#06d6a0'
  },
]

const stats = [
  { label: 'Destinations', value: '190+', icon: Globe },
  { label: 'Trips Planned', value: '12K+', icon: Compass },
  { label: 'Happy Travelers', value: '8K+', icon: Star },
  { label: 'Avg. Cost Saved', value: '32%', icon: Zap },
]

function FloatingOrb({ x, y, size, color, delay }: { x: string; y: string; size: number; color: string; delay: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: x, top: y,
        width: size, height: size,
        background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
        filter: 'blur(40px)',
      }}
      animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 5 + delay, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  )
}

const HERO_CHIPS = [
  { label: '🏔️ Adventure in Pakistan', query: 'Adventure trip in northern Pakistan' },
  { label: '🌊 Beach getaway under Rs 2,80,000', query: 'Beach getaway under Rs 280000 budget' },
  { label: '🗼 10 days in Japan', query: '10 days in Japan' },
  { label: '🦁 African Safari', query: 'African safari for 8 days' },
]

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  const handleSearch = (query?: string) => {
    const q = (query ?? searchQuery).trim()
    if (q) navigate('/plan', { state: { initialQuery: q } })
  }

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const onMove = (e: MouseEvent) => {
      const rect = hero.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      hero.style.setProperty('--mouse-x', `${x}%`)
      hero.style.setProperty('--mouse-y', `${y}%`)
    }
    hero.addEventListener('mousemove', onMove)
    return () => hero.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div className="overflow-hidden">
      {/* ── HERO ── */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center pt-24 pb-20 px-4 sm:px-6"
        style={{
          background: 'radial-gradient(ellipse at var(--mouse-x, 50%) var(--mouse-y, 40%), rgba(233,30,140,0.12) 0%, transparent 60%), #06060e',
        }}
      >
        {/* Background orbs */}
        <FloatingOrb x="10%" y="20%" size={500} color="#e91e8c" delay={0} />
        <FloatingOrb x="70%" y="10%" size={400} color="#4cc9f0" delay={1.5} />
        <FloatingOrb x="60%" y="60%" size={350} color="#ffd166" delay={2.5} />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.h1
            custom={1} variants={fadeUp} initial="hidden" animate="visible"
            className="font-display text-4xl sm:text-6xl md:text-8xl font-extrabold leading-[1.05] tracking-tight mb-6"
          >
            Your AI Travel{' '}
            <span className="gradient-text">Companion</span>
          </motion.h1>

          <motion.p
            custom={2} variants={fadeUp} initial="hidden" animate="visible"
            className="text-white/60 text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Tell our AI your budget, interests, and dream destinations.
            Get a complete, personalized itinerary — restaurants, activities,
            costs — in seconds.
          </motion.p>

          {/* Hero Search Bar */}
          <motion.div
            custom={3} variants={fadeUp} initial="hidden" animate="visible"
            className="max-w-2xl mx-auto w-full px-4"
          >
            <div className="relative group">
              {/* Ambient glow */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#e91e8c]/20 to-[#4cc9f0]/20 blur-2xl group-focus-within:from-[#e91e8c]/40 group-focus-within:to-[#4cc9f0]/40 transition-all duration-500 pointer-events-none" />
              {/* Input pill */}
              <div className="relative flex items-center glass rounded-full border border-white/10 group-focus-within:border-[#e91e8c]/50 transition-colors duration-300 shadow-2xl shadow-black/50">
                <Search size={20} className="ml-5 text-[#e91e8c]/70 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
                  placeholder="Where do you want to go? e.g. 'Paris for 7 days'"
                  className="flex-1 bg-transparent px-4 py-5 text-white placeholder-white/30 text-base focus:outline-none"
                />
                <button
                  onClick={() => handleSearch()}
                  disabled={!searchQuery.trim()}
                  className="mr-2 flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-[#e91e8c] to-[#f06ab3] text-white font-semibold text-sm hover:shadow-lg hover:shadow-[#e91e8c]/40 hover:scale-105 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex-shrink-0"
                >
                  <Send size={16} />
                  <span className="hidden sm:inline">Plan Trip</span>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Quick suggestion chips */}
          <motion.div
            custom={4} variants={fadeUp} initial="hidden" animate="visible"
            className="mt-4 flex flex-wrap gap-2 justify-center"
          >
            {HERO_CHIPS.map(({ label, query }) => (
              <button
                key={label}
                onClick={() => handleSearch(query)}
                className="px-4 py-2 rounded-full glass text-white/60 text-sm hover:text-white hover:border-[#e91e8c]/30 hover:bg-[#e91e8c]/5 transition-all duration-200 cursor-pointer"
              >
                {label}
              </button>
            ))}
          </motion.div>
        </div>

        {/* Floating destination badges */}
        <motion.div
          className="absolute left-8 top-1/3 hidden xl:block"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🗼</span>
            <div>
              <div className="text-white text-sm font-semibold">Tokyo, Japan</div>
              <div className="text-white/40 text-xs">10 days · Rs 7,84,000</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="absolute right-8 top-1/2 hidden xl:block"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        >
          <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🏔️</span>
            <div>
              <div className="text-white text-sm font-semibold">Hunza Valley</div>
              <div className="text-white/40 text-xs">5 days · Rs 1,12,000</div>
            </div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30"
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-white/30 to-transparent" />
        </motion.div>
      </section>

      {/* ── STATS ── */}
      <section className="py-12 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map(({ label, value, icon: Icon }, i) => (
              <motion.div
                key={label}
                custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#e91e8c]/10 text-[#e91e8c] mb-3">
                  <Icon size={20} />
                </div>
                <div className="font-display text-3xl font-bold text-white">{value}</div>
                <div className="text-white/40 text-sm mt-1">{label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-[#e91e8c] text-sm font-semibold tracking-widest uppercase">How It Works</span>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white mt-3">
              Plan in 3 simple steps
            </h2>
          </motion.div>

          <div className="relative">
            {/* Connector line */}
            <div className="absolute top-12 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#e91e8c]/30 to-transparent hidden md:block" />

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: '01', icon: '💬', title: 'Chat with AI', desc: 'Tell our AI your budget, travel dates, interests, and preferred weather. It asks smart questions to understand your dream trip.' },
                { step: '02', icon: '🤖', title: 'AI Generates Plan', desc: 'Claude AI analyzes your preferences and creates a complete, personalized itinerary with costs, restaurants, and activities.' },
                { step: '03', icon: '✈️', title: 'Travel & Explore', desc: 'Download your itinerary, save trips to your dashboard, and head off on your perfectly planned adventure.' },
              ].map(({ step, icon, title, desc }, i) => (
                <motion.div
                  key={step}
                  custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  className="relative"
                >
                  <div className="glass rounded-2xl p-7 h-full hover:border-[#e91e8c]/20 transition-colors">
                    <div className="absolute -top-4 left-7 font-display text-xs font-bold text-[#e91e8c]/60 tracking-widest">
                      STEP {step}
                    </div>
                    <div className="text-4xl mb-5">{icon}</div>
                    <h3 className="font-display text-xl font-bold text-white mb-3">{title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ background: 'rgba(233,30,140,0.03)' }}>
        <div className="max-w-6xl mx-auto">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-[#4cc9f0] text-sm font-semibold tracking-widest uppercase">Features</span>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white mt-3">
              Everything you need to{' '}
              <span className="gradient-text">travel smarter</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map(({ icon: Icon, title, desc, color }, i) => (
              <motion.div
                key={title}
                custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="group glass rounded-2xl p-8 hover:bg-white/5 transition-all duration-300 cursor-default"
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: `${color}15`, color }}
                >
                  <Icon size={22} />
                </div>
                <h3 className="font-display text-xl font-bold text-white mb-3 group-hover:text-[#e91e8c] transition-colors">
                  {title}
                </h3>
                <p className="text-white/50 leading-relaxed text-sm">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DESTINATIONS CAROUSEL ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="flex items-end justify-between mb-12"
          >
            <div>
              <span className="text-[#ffd166] text-sm font-semibold tracking-widest uppercase">Popular Destinations</span>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-white mt-3">
                Where will you go?
              </h2>
            </div>
            <Link
              to="/plan"
              className="hidden md:flex items-center gap-2 text-[#e91e8c] text-sm font-medium hover:gap-3 transition-all"
            >
              Plan your own <ArrowRight size={16} />
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {destinations.map(({ name, tag, days, cost, img, color }, i) => (
              <motion.div
                key={name}
                custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
                className="group relative glass rounded-2xl overflow-hidden cursor-pointer"
              >
                {/* Mock image area */}
                <div
                  className="h-48 flex items-center justify-center text-7xl"
                  style={{ background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)` }}
                >
                  <motion.span
                    whileHover={{ scale: 1.2, rotate: 10 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    {img}
                  </motion.span>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-display font-bold text-white text-lg">{name}</h3>
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: `${color}20`, color }}
                    >
                      {tag}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-white/40 text-sm">
                    <span className="flex items-center gap-1.5"><Clock size={13} />{days}</span>
                    <span className="flex items-center gap-1.5">{cost}</span>
                  </div>
                </div>

                <Link
                  to="/plan"
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
                  style={{ background: 'rgba(8, 13, 26, 0.85)' }}
                >
                  <span className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm"
                    style={{ background: color }}>
                    <MapPin size={16} /> Plan This Trip
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INTERESTS ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white">
              What's your travel style?
            </h2>
            <p className="text-white/50 mt-4 text-base">Our AI adapts to any type of traveler</p>
          </motion.div>

          <div className="flex flex-wrap gap-3 justify-center">
            {[
              { emoji: '🏔️', label: 'Adventure' },
              { emoji: '🧘', label: 'Relaxation' },
              { emoji: '🏛️', label: 'Culture' },
              { emoji: '🍜', label: 'Food & Dining' },
              { emoji: '📸', label: 'Photography' },
              { emoji: '🏖️', label: 'Beach' },
              { emoji: '🎭', label: 'Nightlife' },
              { emoji: '👨‍👩‍👧', label: 'Family' },
              { emoji: '💑', label: 'Romance' },
              { emoji: '🎒', label: 'Backpacking' },
              { emoji: '🦁', label: 'Wildlife' },
              { emoji: '🏔️', label: 'Trekking' },
            ].map(({ emoji, label }, i) => (
              <motion.div
                key={label}
                custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                whileHover={{ scale: 1.08 }}
                className="flex items-center gap-2.5 px-5 py-3 rounded-2xl glass cursor-default hover:border-[#e91e8c]/30 hover:bg-[#e91e8c]/5 transition-all"
              >
                <span className="text-xl">{emoji}</span>
                <span className="text-white/70 font-medium text-sm">{label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI SHOWCASE ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="glass rounded-3xl p-8 md:p-14 relative overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[#e91e8c]/10 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-[#4cc9f0]/10 blur-3xl" />
            </div>

            <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="font-display text-4xl font-bold text-white mb-5 leading-tight">
                  Conversational travel planning — just chat
                </h2>
                <p className="text-white/60 leading-relaxed mb-8">
                  No forms. No clicking through hundreds of options.
                  Just have a natural conversation with our AI and watch your perfect trip come to life.
                </p>
                <Link
                  to="/plan"
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#e91e8c] to-[#f06ab3] text-white font-semibold hover:shadow-lg hover:shadow-[#e91e8c]/30 hover:scale-105 transition-all duration-300"
                >
                  <Sparkles size={18} />
                  Start Planning
                </Link>
              </div>

              {/* Mock chat preview */}
              <div className="space-y-4">
                {[
                  { role: 'ai', msg: 'Hi! I\'m your AI travel buddy. Tell me about your dream trip — where do you want to go, and what\'s your budget?' },
                  { role: 'user', msg: 'I want a 7-day adventure trip somewhere in Asia. Budget is Rs 4,20,000.' },
                  { role: 'ai', msg: 'Amazing! I have some great options for you. What kind of adventures excite you most — hiking, water sports, or city exploration?' },
                ].map(({ role, msg }, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: role === 'user' ? 20 : -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.2, duration: 0.5 }}
                    viewport={{ once: true }}
                    className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        role === 'user'
                          ? 'bg-[#e91e8c] text-white rounded-tr-sm'
                          : 'glass text-white/80 rounded-tl-sm'
                      }`}
                    >
                      {role === 'ai' && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className="w-4 h-4 rounded-full bg-[#e91e8c]/20 flex items-center justify-center">
                            <Sparkles size={10} className="text-[#e91e8c]" />
                          </div>
                          <span className="text-[#e91e8c] text-xs font-semibold">TravelBuddy AI</span>
                        </div>
                      )}
                      {msg}
                    </div>
                  </motion.div>
                ))}
                {/* Typing indicator */}
                <div className="flex justify-start">
                  <div className="glass px-4 py-3 rounded-2xl rounded-tl-sm">
                    <div className="flex gap-1.5 items-center h-4">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
          >
            <h2 className="font-display text-3xl sm:text-5xl md:text-7xl font-extrabold text-white mb-6 leading-tight">
              Ready to{' '}
              <span className="gradient-text">explore?</span>
            </h2>
            <p className="text-white/50 text-lg mb-10 max-w-xl mx-auto">
              Your next adventure is one conversation away. Let our AI plan the perfect trip for you.
            </p>
            <Link
              to="/plan"
              className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-gradient-to-r from-[#e91e8c] to-[#f06ab3] text-white font-bold text-lg shadow-2xl shadow-[#e91e8c]/40 hover:shadow-[#e91e8c]/60 hover:scale-105 transition-all duration-300"
            >
              <Sparkles size={22} />
              Start Your Journey
              <ArrowRight size={20} className="ml-1" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
