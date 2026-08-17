import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Mail, Lock, Eye, EyeOff, Plane, Sparkles,
  ArrowRight, AlertCircle, Loader2
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const DESTINATIONS = ['🗼 Tokyo', '🌴 Bali', '🏔️ Hunza', '🗺️ Paris', '🦁 Kenya', '⛵ Santorini']

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [destIndex, setDestIndex] = useState(0)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from ?? '/'

  const heroRef = useRef<HTMLDivElement>(null)

  // Rotate destination label
  useEffect(() => {
    const id = setInterval(() => setDestIndex(i => (i + 1) % DESTINATIONS.length), 2200)
    return () => clearInterval(id)
  }, [])

  // Mouse-tracking gradient
  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
      el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
    }
    el.addEventListener('mousemove', move)
    return () => el.removeEventListener('mousemove', move)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Please fill in all fields'); return }
    setError('')
    setIsLoading(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      ref={heroRef}
      className="min-h-screen flex"
      style={{
        background: 'radial-gradient(ellipse at var(--mx,50%) var(--my,40%), rgba(233,30,140,0.10) 0%, transparent 60%), #06060e',
      }}
    >
      {/* ── Left panel — decorative ── */}
      <div className="hidden lg:flex flex-col justify-between w-[46%] relative overflow-hidden p-12 border-r border-white/5">
        {/* Background glow orbs */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}
        >
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-[#e91e8c]/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-[#4cc9f0]/8 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-[#ffd166]/6 blur-3xl" />
        </motion.div>

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="relative z-10 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#e91e8c] to-[#ffd166] flex items-center justify-center shadow-xl">
            <Plane size={20} className="text-white rotate-45" />
          </div>
          <span className="font-display font-bold text-2xl text-white">
            Travel<span className="text-[#e91e8c]">Buddy</span>
          </span>
        </motion.div>

        {/* Central illustration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.7, ease: 'easeOut' }}
          className="relative z-10 flex flex-col items-center text-center"
        >
          {/* Globe ring */}
          <div className="relative w-56 h-56 mb-10">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#e91e8c]/20 to-[#4cc9f0]/10 border border-white/10 flex items-center justify-center">
              <div className="text-8xl animate-float select-none">🌍</div>
            </div>
            {/* Orbiting dots */}
            {[0, 120, 240].map((deg, i) => (
              <motion.div
                key={i}
                className="absolute w-3 h-3 rounded-full"
                style={{
                  top: '50%', left: '50%',
                  background: ['#e91e8c', '#4cc9f0', '#ffd166'][i],
                  boxShadow: `0 0 8px ${['#e91e8c', '#4cc9f0', '#ffd166'][i]}`,
                  transform: `rotate(${deg}deg) translateX(110px) translateY(-50%)`,
                }}
                animate={{ rotate: [deg, deg + 360] }}
                transition={{ duration: 8 + i * 2, repeat: Infinity, ease: 'linear' }}
              />
            ))}
          </div>

          <div className="text-white/40 text-sm uppercase tracking-widest mb-3">Your next destination</div>
          <motion.div
            key={destIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="font-display text-4xl font-extrabold gradient-text"
          >
            {DESTINATIONS[destIndex]}
          </motion.div>
        </motion.div>

        {/* Bottom testimonial */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="relative z-10 glass rounded-2xl p-5"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#e91e8c] to-[#ffd166] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              A
            </div>
            <div>
              <p className="text-white/70 text-sm leading-relaxed italic">
                "TravelBuddy planned my entire 10-day Japan trip in minutes. The AI itinerary was spot on!"
              </p>
              <div className="text-white/30 text-xs mt-2">Ayesha K. · Lahore, Pakistan</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10 justify-center">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#e91e8c] to-[#ffd166] flex items-center justify-center">
              <Plane size={18} className="text-white rotate-45" />
            </div>
            <span className="font-display font-bold text-xl text-white">
              Travel<span className="text-[#e91e8c]">Buddy</span>
            </span>
          </div>

          {/* Heading */}
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-coral text-[#e91e8c] text-xs font-semibold mb-5">
              <Sparkles size={12} /> Welcome back
            </div>
            <h1 className="font-display text-4xl font-extrabold text-white leading-tight">
              Sign in to your<br />
              <span className="gradient-text">adventure</span>
            </h1>
            <p className="text-white/40 mt-3 text-sm">
              Don't have an account?{' '}
              <Link to="/register" className="text-[#e91e8c] hover:text-[#f06ab3] font-semibold transition-colors">
                Sign up free
              </Link>
            </p>
          </div>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6"
            >
              <AlertCircle size={16} className="flex-shrink-0" />
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={e => void handleSubmit(e)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-2 block">
                Email Address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="email"
                  value={email}
                  onChange={e => {setEmail(e.target.value)}}
                  placeholder="you@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-[#e91e8c]/50 focus:bg-[#e91e8c]/5 transition-all"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-white/60 text-xs font-semibold uppercase tracking-widest">
                  Password
                </label>
                <button
                  type="button"
                  className="text-[#e91e8c] text-xs hover:text-[#f06ab3] transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-12 py-3.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-[#e91e8c]/50 focus:bg-[#e91e8c]/5 transition-all"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-5 h-5 rounded-md border border-white/15 bg-white/5 peer-checked:bg-[#e91e8c] peer-checked:border-[#e91e8c] transition-all flex items-center justify-center">
                  <svg className="w-3 h-3 text-white hidden peer-checked:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <span className="text-white/50 text-sm group-hover:text-white/70 transition-colors">Keep me signed in</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-[#e91e8c] to-[#f06ab3] text-white font-bold text-base shadow-xl shadow-[#e91e8c]/25 hover:shadow-[#e91e8c]/40 hover:scale-[1.02] active:scale-[0.99] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 mt-2"
            >
              {isLoading ? (
                <><Loader2 size={18} className="animate-spin" /> Signing in...</>
              ) : (
                <> Sign In <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-7">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-white/25 text-xs">or continue with</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {/* Social buttons */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Google', icon: '🅖' },
              { label: 'GitHub', icon: '🐙' },
            ].map(({ label, icon }) => (
              <button
                key={label}
                type="button"
                className="flex items-center justify-center gap-2.5 py-3 rounded-xl glass text-white/60 text-sm font-medium hover:text-white hover:bg-white/8 transition-all"
              >
                <span>{icon}</span> {label}
              </button>
            ))}
          </div>

          {/* Sign up link — mobile */}
          <p className="text-center text-white/30 text-sm mt-8">
            New to TravelBuddy?{' '}
            <Link to="/register" className="text-[#e91e8c] font-semibold hover:text-[#f06ab3] transition-colors">
              Create an account
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
