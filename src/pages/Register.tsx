import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  User, Mail, Lock, Eye, EyeOff, Plane, Sparkles,
  ArrowRight, AlertCircle, Loader2, CheckCircle, Check
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const INTERESTS = ['🏔️ Adventure', '🌊 Beach', '🏛️ Culture', '🍜 Food', '📸 Photography', '🧘 Relaxation']

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p: string) => /\d/.test(p) },
]

export default function Register() {
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { register } = useAuth()
  const navigate = useNavigate()
  const heroRef = useRef<HTMLDivElement>(null)

  const passRulesOk = PASSWORD_RULES.map(r => r.test(password))
  const passStrength = passRulesOk.filter(Boolean).length
  const strengthLabel = ['', 'Weak', 'Medium', 'Strong'][passStrength]
  const strengthColor = ['', '#ef4444', '#ffd166', '#06d6a0'][passStrength]

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

  const toggleInterest = (i: string) => {
    setSelectedInterests(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
    )
  }

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Please enter your name'); return }
    if (!email.trim()) { setError('Please enter your email'); return }
    if (!password) { setError('Please enter a password'); return }
    if (passStrength < 2) { setError('Please use a stronger password'); return }
    if (password !== confirmPass) { setError('Passwords do not match'); return }
    setError('')
    setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await register(name.trim(), email.trim(), password, selectedInterests)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      ref={heroRef}
      className="min-h-screen flex"
      style={{
        background: 'radial-gradient(ellipse at var(--mx,50%) var(--my,40%), rgba(76,201,240,0.09) 0%, transparent 60%), #06060e',
      }}
    >
      {/* ── Left decorative panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[46%] relative overflow-hidden p-12 border-r border-white/5">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-20 w-[450px] h-[450px] rounded-full bg-[#4cc9f0]/10 blur-3xl" />
          <div className="absolute bottom-10 left-0 w-[350px] h-[350px] rounded-full bg-[#e91e8c]/8 blur-3xl" />
        </div>
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#e91e8c] to-[#ffd166] flex items-center justify-center shadow-xl">
            <Plane size={20} className="text-white rotate-45" />
          </div>
          <span className="font-display font-bold text-2xl text-white">
            Travel<span className="text-[#e91e8c]">Buddy</span>
          </span>
        </motion.div>

        {/* Feature list */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="relative z-10 space-y-5"
        >
          <div className="mb-8">
            <h2 className="font-display text-3xl font-bold text-white mb-3 leading-tight">
              Plan your next trip<br />
              <span className="gradient-text">with AI magic</span>
            </h2>
            <p className="text-white/40 text-sm leading-relaxed">
              Join thousands of travelers who use TravelBuddy to create perfect, personalized itineraries.
            </p>
          </div>

          {[
            { icon: '🤖', title: 'AI-Powered Planning', desc: 'Get a full itinerary in seconds' },
            { icon: '💰', title: 'Budget Optimizer', desc: 'Best trips within your budget' },
            { icon: '🗺️', title: '190+ Destinations', desc: 'Explore anywhere in the world' },
            { icon: '⭐', title: 'Free to Get Started', desc: 'No credit card required' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl glass flex items-center justify-center text-xl flex-shrink-0">
                {icon}
              </div>
              <div>
                <div className="text-white font-semibold text-sm">{title}</div>
                <div className="text-white/35 text-xs">{desc}</div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Bottom stat strip */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="relative z-10 flex gap-6"
        >
          {[
            { label: 'Travelers', value: '8K+' },
            { label: 'Trips Planned', value: '12K+' },
            { label: 'Destinations', value: '190+' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="font-display text-2xl font-bold text-white">{value}</div>
              <div className="text-white/35 text-xs">{label}</div>
            </div>
          ))}
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
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-[#4cc9f0] text-xs font-semibold mb-5 border border-[#4cc9f0]/20">
              <Sparkles size={12} /> Create your free account
            </div>
            <h1 className="font-display text-4xl font-extrabold text-white leading-tight">
              Start your travel<br />
              <span className="gradient-text">journey today</span>
            </h1>
            <p className="text-white/40 mt-3 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-[#e91e8c] hover:text-[#f06ab3] font-semibold transition-colors">
                Sign in
              </Link>
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  step === s
                    ? 'bg-[#e91e8c] text-white shadow-lg shadow-[#e91e8c]/30'
                    : step > s
                    ? 'bg-[#06d6a0] text-white'
                    : 'bg-white/8 text-white/30'
                }`}>
                  {step > s ? <Check size={14} /> : s}
                </div>
                <span className={`text-xs font-medium ${step === s ? 'text-white' : 'text-white/30'}`}>
                  {s === 1 ? 'Account Info' : 'Interests'}
                </span>
                {s < 2 && <div className="w-12 h-px bg-white/10 ml-1" />}
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-5"
            >
              <AlertCircle size={16} className="flex-shrink-0" />
              {error}
            </motion.div>
          )}

          {/* ── STEP 1: Account Info ── */}
          {step === 1 && (
            <motion.form
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={e => void handleStep1(e)}
              className="space-y-4"
            >
              {/* Full Name */}
              <div>
                <label className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-2 block">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Areeba Khan"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-[#e91e8c]/50 focus:bg-[#e91e8c]/5 transition-all"
                    autoComplete="name"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-2 block">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-[#e91e8c]/50 focus:bg-[#e91e8c]/5 transition-all"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-2 block">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-12 py-3.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-[#e91e8c]/50 focus:bg-[#e91e8c]/5 transition-all"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Strength meter */}
                {password.length > 0 && (
                  <div className="mt-2.5 space-y-2">
                    <div className="flex gap-1.5">
                      {[1, 2, 3].map(n => (
                        <div key={n} className="flex-1 h-1 rounded-full transition-all duration-300"
                          style={{ background: passStrength >= n ? strengthColor : 'rgba(255,255,255,0.08)' }} />
                      ))}
                    </div>
                    <div className="flex justify-between text-xs">
                      <div className="space-y-1">
                        {PASSWORD_RULES.map((rule, i) => (
                          <div key={i} className={`flex items-center gap-1.5 transition-colors ${passRulesOk[i] ? 'text-[#06d6a0]' : 'text-white/25'}`}>
                            <CheckCircle size={10} />
                            <span>{rule.label}</span>
                          </div>
                        ))}
                      </div>
                      <span style={{ color: strengthColor }} className="font-semibold">{strengthLabel}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-2 block">Confirm Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full bg-white/5 border rounded-xl pl-11 pr-12 py-3.5 text-white placeholder-white/25 text-sm focus:outline-none transition-all ${
                      confirmPass && confirmPass !== password
                        ? 'border-red-500/40 bg-red-500/5'
                        : confirmPass && confirmPass === password
                        ? 'border-[#06d6a0]/40 bg-[#06d6a0]/5'
                        : 'border-white/10 focus:border-[#e91e8c]/50 focus:bg-[#e91e8c]/5'
                    }`}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  {confirmPass && confirmPass === password && (
                    <CheckCircle size={16} className="absolute right-11 top-1/2 -translate-y-1/2 text-[#06d6a0]" />
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-[#e91e8c] to-[#f06ab3] text-white font-bold text-base shadow-xl shadow-[#e91e8c]/25 hover:shadow-[#e91e8c]/40 hover:scale-[1.02] active:scale-[0.99] transition-all duration-200 mt-2"
              >
                Continue <ArrowRight size={18} />
              </button>
            </motion.form>
          )}

          {/* ── STEP 2: Interests ── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <p className="text-white/50 text-sm mb-5 leading-relaxed">
                Pick your travel interests so we can personalize your recommendations. You can change these later.
              </p>
              <div className="flex flex-wrap gap-2.5 mb-6">
                {INTERESTS.map(interest => {
                  const active = selectedInterests.includes(interest)
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        active
                          ? 'bg-[#e91e8c] text-white shadow-lg shadow-[#e91e8c]/20'
                          : 'glass text-white/50 hover:text-white hover:border-[#e91e8c]/20'
                      }`}
                    >
                      {interest}
                    </button>
                  )
                })}
              </div>

              {/* Terms */}
              <label className="flex items-start gap-3 cursor-pointer group mb-6">
                <div className="relative mt-0.5 flex-shrink-0">
                  <input type="checkbox" className="sr-only peer" required />
                  <div className="w-5 h-5 rounded-md border border-white/15 bg-white/5 peer-checked:bg-[#e91e8c] peer-checked:border-[#e91e8c] transition-all" />
                </div>
                <span className="text-white/45 text-xs leading-relaxed group-hover:text-white/60 transition-colors">
                  I agree to the{' '}
                  <span className="text-[#e91e8c]">Terms of Service</span>
                  {' '}and{' '}
                  <span className="text-[#e91e8c]">Privacy Policy</span>
                </span>
              </label>

              <form onSubmit={e => void handleSubmit(e)} className="space-y-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-[#e91e8c] to-[#f06ab3] text-white font-bold text-base shadow-xl shadow-[#e91e8c]/25 hover:shadow-[#e91e8c]/40 hover:scale-[1.02] active:scale-[0.99] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isLoading ? (
                    <><Loader2 size={18} className="animate-spin" /> Creating account...</>
                  ) : (
                    <><Sparkles size={18} /> Create My Account</>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep(1); setError('') }}
                  className="w-full py-3 rounded-xl glass text-white/50 text-sm font-medium hover:text-white hover:bg-white/5 transition-all"
                >
                  ← Back to account info
                </button>
              </form>
            </motion.div>
          )}

          <p className="text-center text-white/30 text-sm mt-8">
            Already registered?{' '}
            <Link to="/login" className="text-[#e91e8c] font-semibold hover:text-[#f06ab3] transition-colors">
              Sign in here
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
