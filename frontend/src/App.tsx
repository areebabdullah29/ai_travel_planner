import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { TripProvider } from '@/context/TripContext'
import { AuthProvider } from '@/context/AuthContext'
import Layout from '@/components/layout/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import Home from '@/pages/Home'
import TripPlanner from '@/pages/TripPlanner'
import Itinerary from '@/pages/Itinerary'
import Dashboard from '@/pages/Dashboard'
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
                    <Route path="/itinerary" element={<Itinerary />} />

                    {/* Dashboard requires login — saved trips are personal */}
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <Dashboard />
                        </ProtectedRoute>
                      }
                    />
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
