import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  User, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2,
  CheckCircle, Save, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p: string) => /\d/.test(p) },
]

const TRAVEL_STYLES = [
  'Adventure', 'Beach', 'Culture', 'Food & Cuisine',
  'Photography', 'Relaxation', 'Wildlife', 'City Break',
  'Road Trip', 'Backpacking',
]

const PREFERRED_REGIONS = [
  'South Asia', 'Southeast Asia', 'East Asia', 'Middle East',
  'Europe', 'North America', 'South America', 'Africa', 'Oceania',
]

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}

export default function Profile() {
  const { user, updateProfile } = useAuth()

  // Personal Info
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [infoLoading, setInfoLoading] = useState(false)
  const [infoError, setInfoError] = useState('')
  const [infoSuccess, setInfoSuccess] = useState(false)

  // Password
  const [showPassSection, setShowPassSection] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPass, setShowCurrentPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [passLoading, setPassLoading] = useState(false)
  const [passError, setPassError] = useState('')
  const [passSuccess, setPassSuccess] = useState(false)

  // Preferences
  const [travelStyles, setTravelStyles] = useState<string[]>(
    user?.preferences?.travelStyles ?? []
  )
  const [preferredRegions, setPreferredRegions] = useState<string[]>(
    user?.preferences?.preferredRegions ?? []
  )
  const [budgetMin, setBudgetMin] = useState(
    user?.preferences?.budgetRange?.min ?? 10000
  )
  const [budgetMax, setBudgetMax] = useState(
    user?.preferences?.budgetRange?.max ?? 50000
  )
  const [tripDuration, setTripDuration] = useState(
    user?.preferences?.tripDuration ?? 5
  )
  const [prefsLoading, setPrefsLoading] = useState(false)
  const [prefsError, setPrefsError] = useState('')
  const [prefsSuccess, setPrefsSuccess] = useState(false)

  // Sync fields when user object updates
  useEffect(() => {
    if (user) {
      setName(user.name)
      setEmail(user.email)
      setTravelStyles(user.preferences?.travelStyles ?? [])
      setPreferredRegions(user.preferences?.preferredRegions ?? [])
      setBudgetMin(user.preferences?.budgetRange?.min ?? 10000)
      setBudgetMax(user.preferences?.budgetRange?.max ?? 50000)
      setTripDuration(user.preferences?.tripDuration ?? 5)
    }
  }, [user])

  const passRulesOk = PASSWORD_RULES.map(r => r.test(newPassword))
  const passStrength = passRulesOk.filter(Boolean).length
  const strengthLabel = ['', 'Weak', 'Medium', 'Strong'][passStrength]
  const strengthColor = ['', '#ef4444', '#ffd166', '#06d6a0'][passStrength]

  const getInitials = (n: string) =>
    n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    } catch {
      return ''
    }
  }

  const handleInfoSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setInfoError('')
    const trimmedName = name.trim()
    if (!trimmedName) { setInfoError('Name cannot be empty'); return }
    if (!email.trim() || !/.+@.+\..+/.test(email)) { setInfoError('Please enter a valid email'); return }
    if (trimmedName === user?.name && email === user?.email) {
      setInfoSuccess(true)
      setTimeout(() => setInfoSuccess(false), 3000)
      return
    }
    setInfoLoading(true)
    try {
      await updateProfile({ name: trimmedName, email: email.trim() })
      setInfoSuccess(true)
      setTimeout(() => setInfoSuccess(false), 3000)
    } catch (err) {
      setInfoError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setInfoLoading(false)
    }
  }

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setPassError('')
    if (!currentPassword) { setPassError('Please enter your current password'); return }
    if (passStrength < 2) { setPassError('Please choose a stronger password'); return }
    if (newPassword !== confirmPassword) { setPassError('Passwords do not match'); return }
    setPassLoading(true)
    try {
      await updateProfile({ currentPassword, newPassword, confirmPassword })
      setPassSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => { setPassSuccess(false); setShowPassSection(false) }, 3000)
    } catch (err) {
      setPassError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setPassLoading(false)
    }
  }

  const handlePrefsSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setPrefsError('')
    if (budgetMin < 0) { setPrefsError('Budget minimum cannot be negative'); return }
    if (budgetMax <= budgetMin) { setPrefsError('Maximum budget must be greater than minimum'); return }
    if (tripDuration < 1 || tripDuration > 90) { setPrefsError('Trip duration must be between 1 and 90 days'); return }
    setPrefsLoading(true)
    try {
      await updateProfile({
        preferences: {
          travelStyles,
          preferredRegions,
          budgetRange: { min: budgetMin, max: budgetMax },
          tripDuration,
        },
      })
      setPrefsSuccess(true)
      setTimeout(() => setPrefsSuccess(false), 3000)
    } catch (err) {
      setPrefsError(err instanceof Error ? err.message : 'Failed to update preferences')
    } finally {
      setPrefsLoading(false)
    }
  }

  const toggleStyle = (s: string) =>
    setTravelStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const toggleRegion = (r: string) =>
    setPreferredRegions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Page Header */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-5 mb-10"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#e91e8c] to-[#9b5de5] flex items-center justify-center text-white font-bold text-xl font-display shrink-0">
            {user ? getInitials(user.name) : '?'}
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white">{user?.name}</h1>
            <p className="text-white/50 text-sm">{user?.email}</p>
            {user?.createdAt && (
              <p className="text-white/30 text-xs mt-0.5">Member since {formatDate(user.createdAt)}</p>
            )}
          </div>
        </motion.div>

        {/* Section 1: Personal Info */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="glass rounded-2xl p-6 mb-5"
        >
          <div className="flex items-center gap-2 mb-5">
            <User size={16} className="text-[#e91e8c]" />
            <h2 className="font-display font-semibold text-white">Personal Information</h2>
          </div>

          <form onSubmit={handleInfoSave} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-white/60 text-xs mb-1.5">Full Name</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#e91e8c]/50 transition-colors"
                  placeholder="Your full name"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-white/60 text-xs mb-1.5">Email Address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#e91e8c]/50 transition-colors"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            {infoError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                <AlertCircle size={14} />
                {infoError}
              </div>
            )}

            {infoSuccess && (
              <div className="flex items-center gap-2 bg-[#06d6a0]/10 border border-[#06d6a0]/20 rounded-xl px-4 py-3 text-[#06d6a0] text-sm">
                <CheckCircle size={14} />
                Profile updated successfully!
              </div>
            )}

            <button
              type="submit"
              disabled={infoLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#e91e8c] to-[#9b5de5] text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {infoLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Changes
            </button>
          </form>
        </motion.div>

        {/* Section 2: Password */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="glass rounded-2xl p-6 mb-5"
        >
          <button
            type="button"
            onClick={() => { setShowPassSection(v => !v); setPassError(''); setPassSuccess(false) }}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-[#e91e8c]" />
              <h2 className="font-display font-semibold text-white">Change Password</h2>
            </div>
            {showPassSection ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
          </button>

          {showPassSection && (
            <form onSubmit={handlePasswordSave} className="space-y-4 mt-5">
              {/* Current Password */}
              <div>
                <label className="block text-white/60 text-xs mb-1.5">Current Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#e91e8c]/50 transition-colors"
                    placeholder="Enter current password"
                  />
                  <button type="button" onClick={() => setShowCurrentPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                    {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-white/60 text-xs mb-1.5">New Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#e91e8c]/50 transition-colors"
                    placeholder="Enter new password"
                  />
                  <button type="button" onClick={() => setShowNewPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                    {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                {/* Strength meter */}
                {newPassword && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{ background: i < passStrength ? strengthColor : 'rgba(255,255,255,0.1)' }}
                        />
                      ))}
                    </div>
                    {strengthLabel && (
                      <p className="text-xs" style={{ color: strengthColor }}>{strengthLabel} password</p>
                    )}
                    <div className="space-y-1">
                      {PASSWORD_RULES.map((rule, i) => (
                        <div key={i} className={`flex items-center gap-1.5 text-xs ${passRulesOk[i] ? 'text-[#06d6a0]' : 'text-white/30'}`}>
                          <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${passRulesOk[i] ? 'bg-[#06d6a0] border-[#06d6a0]' : 'border-white/20'}`}>
                            {passRulesOk[i] && <span className="text-[8px] text-black font-bold">✓</span>}
                          </div>
                          {rule.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-white/60 text-xs mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#e91e8c]/50 transition-colors"
                    placeholder="Confirm new password"
                  />
                  <button type="button" onClick={() => setShowConfirmPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                    {showConfirmPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {passError && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                  <AlertCircle size={14} />
                  {passError}
                </div>
              )}

              {passSuccess && (
                <div className="flex items-center gap-2 bg-[#06d6a0]/10 border border-[#06d6a0]/20 rounded-xl px-4 py-3 text-[#06d6a0] text-sm">
                  <CheckCircle size={14} />
                  Password changed successfully!
                </div>
              )}

              <button
                type="submit"
                disabled={passLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#e91e8c] to-[#9b5de5] text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {passLoading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                Update Password
              </button>
            </form>
          )}
        </motion.div>

        {/* Section 3: Travel Preferences */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <span className="text-[#e91e8c] text-base">✈️</span>
            <h2 className="font-display font-semibold text-white">Travel Preferences</h2>
          </div>

          <form onSubmit={handlePrefsSave} className="space-y-6">
            {/* Travel Styles */}
            <div>
              <label className="block text-white/60 text-xs mb-2">Travel Styles</label>
              <div className="flex flex-wrap gap-2">
                {TRAVEL_STYLES.map(style => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => toggleStyle(style)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      travelStyles.includes(style)
                        ? 'bg-[#e91e8c]/20 border-[#e91e8c]/50 text-[#f06ab3]'
                        : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Preferred Regions */}
            <div>
              <label className="block text-white/60 text-xs mb-2">Preferred Regions</label>
              <div className="flex flex-wrap gap-2">
                {PREFERRED_REGIONS.map(region => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => toggleRegion(region)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      preferredRegions.includes(region)
                        ? 'bg-[#9b5de5]/20 border-[#9b5de5]/50 text-[#c084fc]'
                        : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget Range */}
            <div>
              <label className="block text-white/60 text-xs mb-2">Budget Range (PKR)</label>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    value={budgetMin}
                    onChange={e => setBudgetMin(Number(e.target.value))}
                    min={0}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#e91e8c]/50 transition-colors"
                    placeholder="Min"
                  />
                  <span className="text-white/30 text-xs mt-1 block">Minimum</span>
                </div>
                <span className="text-white/30 text-sm">—</span>
                <div className="flex-1">
                  <input
                    type="number"
                    value={budgetMax}
                    onChange={e => setBudgetMax(Number(e.target.value))}
                    min={0}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#e91e8c]/50 transition-colors"
                    placeholder="Max"
                  />
                  <span className="text-white/30 text-xs mt-1 block">Maximum</span>
                </div>
              </div>
            </div>

            {/* Trip Duration */}
            <div>
              <label className="block text-white/60 text-xs mb-2">
                Preferred Trip Duration: <span className="text-white">{tripDuration} days</span>
              </label>
              <input
                type="range"
                min={1}
                max={30}
                value={tripDuration}
                onChange={e => setTripDuration(Number(e.target.value))}
                className="w-full accent-[#e91e8c]"
              />
              <div className="flex justify-between text-white/30 text-xs mt-1">
                <span>1 day</span>
                <span>30 days</span>
              </div>
            </div>

            {prefsError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                <AlertCircle size={14} />
                {prefsError}
              </div>
            )}

            {prefsSuccess && (
              <div className="flex items-center gap-2 bg-[#06d6a0]/10 border border-[#06d6a0]/20 rounded-xl px-4 py-3 text-[#06d6a0] text-sm">
                <CheckCircle size={14} />
                Preferences saved!
              </div>
            )}

            <button
              type="submit"
              disabled={prefsLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#e91e8c] to-[#9b5de5] text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {prefsLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Preferences
            </button>
          </form>
        </motion.div>

      </div>
    </div>
  )
}
