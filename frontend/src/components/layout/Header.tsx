import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, Compass, Map, Navigation2, LayoutDashboard, Plane, LogOut, ChevronDown, User, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { AnimatePresence, motion } from 'framer-motion'

const publicNavLinks = [
  { href: '/', label: 'Home', icon: Compass },
  { href: '/destinations', label: 'Explore', icon: Globe },
  { href: '/map', label: 'Map', icon: Navigation2 },
  { href: '/plan', label: 'Plan Trip', icon: Map },
]

const authNavLinks = [
  { href: '/', label: 'Home', icon: Compass },
  { href: '/destinations', label: 'Explore', icon: Globe },
  { href: '/map', label: 'Map', icon: Navigation2 },
  { href: '/plan', label: 'Plan Trip', icon: Map },
  { href: '/dashboard', label: 'My Trips', icon: LayoutDashboard },
  { href: '/profile', label: 'My Profile', icon: User },
]

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setIsOpen(false)
  }, [location])

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    logout()
    setUserMenuOpen(false)
    navigate('/login')
  }

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'glass border-b border-white/10 py-3'
          : 'bg-transparent py-5'
      )}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#e91e8c] to-[#ffd166] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
              <Plane size={18} className="text-white rotate-45" />
            </div>
            <div className="absolute -inset-1 bg-gradient-to-br from-[#e91e8c] to-[#ffd166] rounded-xl opacity-0 group-hover:opacity-30 blur-md transition-opacity duration-300" />
          </div>
          <span className="font-display font-bold text-xl text-white">
            Travel<span className="text-[#e91e8c]">Buddy</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {(isAuthenticated ? authNavLinks : publicNavLinks).map(({ href, label }) => {
            const active = location.pathname === href
            return (
              <Link
                key={href}
                to={href}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-[#e91e8c]/15 text-[#e91e8c]'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                )}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated && user ? (
            /* User menu */
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl glass hover:bg-white/8 transition-all duration-200"
              >
                {/* Avatar */}
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#e91e8c] to-[#ffd166] flex items-center justify-center text-white font-bold text-xs">
                  {getInitials(user.name)}
                </div>
                <span className="text-white/80 text-sm font-medium max-w-[100px] truncate">
                  {user.name.split(' ')[0]}
                </span>
                <ChevronDown
                  size={14}
                  className={cn('text-white/40 transition-transform duration-200', userMenuOpen && 'rotate-180')}
                />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-52 glass rounded-2xl py-1.5 shadow-2xl border border-white/10"
                  >
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-white/8">
                      <div className="text-white font-semibold text-sm truncate">{user.name}</div>
                      <div className="text-white/40 text-xs truncate mt-0.5">{user.email}</div>
                    </div>

                    <div className="py-1">
                      <Link
                        to="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                      >
                        <User size={15} /> My Profile
                      </Link>
                      <Link
                        to="/dashboard"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                      >
                        <LayoutDashboard size={15} /> My Trips
                      </Link>
                      <Link
                        to="/plan"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
                      >
                        <Map size={15} /> Plan New Trip
                      </Link>
                    </div>

                    <div className="border-t border-white/8 py-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/8 text-sm transition-colors"
                      >
                        <LogOut size={15} /> Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            /* Auth buttons */
            <>
              <Link
                to="/login"
                className="px-4 py-2 rounded-xl text-white/70 text-sm font-medium hover:text-white hover:bg-white/5 transition-all"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#e91e8c] to-[#f06ab3] text-white text-sm font-semibold hover:shadow-lg hover:shadow-[#e91e8c]/30 hover:scale-105 transition-all duration-200"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-t border-white/10 mt-2 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-1">
              {/* User info strip (mobile) */}
              {isAuthenticated && user && (
                <div className="flex items-center gap-3 px-4 py-3 mb-2 rounded-xl bg-white/4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#e91e8c] to-[#ffd166] flex items-center justify-center text-white font-bold text-xs">
                    {getInitials(user.name)}
                  </div>
                  <div>
                    <div className="text-white text-sm font-semibold">{user.name}</div>
                    <div className="text-white/40 text-xs">{user.email}</div>
                  </div>
                </div>
              )}

              {(isAuthenticated ? authNavLinks : publicNavLinks).map(({ href, label, icon: Icon }) => {
                const active = location.pathname === href
                return (
                  <Link
                    key={href}
                    to={href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                      active
                        ? 'bg-[#e91e8c]/15 text-[#e91e8c]'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                )
              })}

              {/* Guest note on mobile */}
              {!isAuthenticated && (
                <p className="text-white/25 text-xs px-4 pt-1">
                  Sign in to save trips & access your dashboard
                </p>
              )}

              <div className="mt-2 flex flex-col gap-2">
                {isAuthenticated ? (
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-red-400 glass border border-red-500/20 text-sm font-medium"
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="px-4 py-3 rounded-xl glass text-white/70 text-sm font-medium text-center hover:text-white"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      className="px-4 py-3 rounded-xl bg-gradient-to-r from-[#e91e8c] to-[#f06ab3] text-white text-sm font-semibold text-center"
                    >
                      Get Started Free
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
