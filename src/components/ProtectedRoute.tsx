import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Loader2, Plane } from 'lucide-react'
import type { ReactNode } from 'react'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#06060e' }}>
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#e91e8c] to-[#ffd166] flex items-center justify-center animate-pulse">
          <Plane size={26} className="text-white rotate-45" />
        </div>
        <Loader2 size={22} className="text-[#e91e8c] animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}
