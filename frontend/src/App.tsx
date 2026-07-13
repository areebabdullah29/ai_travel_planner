import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TripProvider } from '@/context/TripContext'
import { AuthProvider } from '@/context/AuthContext'
import Layout from '@/components/layout/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import Home from '@/pages/Home'
import TripPlanner from '@/pages/TripPlanner'
import Itinerary from '@/pages/Itinerary'
import Dashboard from '@/pages/Dashboard'
import Profile from '@/pages/Profile'
import Destinations from '@/pages/Destinations'
import MapExplorer from '@/pages/MapExplorer'
import Login from '@/pages/Login'
import Register from '@/pages/Register'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TripProvider>
          <Routes>
            {/* Public auth routes — full-screen, no Layout */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Public app routes — guests can browse freely */}
            <Route
              path="/*"
              element={
                <Layout>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/plan" element={<TripPlanner />} />
                    {/* Canonical trip detail URL */}
                    <Route path="/trips/:id" element={<Itinerary />} />
                    {/* Legacy redirect — keeps old bookmarks working */}
                    <Route path="/itinerary" element={<Navigate to="/plan" replace />} />

                    {/* Dashboard requires login — saved trips are personal */}
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <Dashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <Profile />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/destinations" element={<Destinations />} />
                    <Route path="/map" element={<MapExplorer />} />
                  </Routes>
                </Layout>
              }
            />
          </Routes>
        </TripProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
