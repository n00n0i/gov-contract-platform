import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import axios from 'axios'
import DocumentUpload from './pages/DocumentUpload'
import Contracts from './pages/Contracts'
import Vendors from './pages/Vendors'
import CreateVendor from './pages/CreateVendor'
import VendorDetail from './pages/VendorDetail'
import Login, { logout } from './pages/Login'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Dashboard from './pages/Dashboard'
import Reports from './pages/Reports'
import Notifications from './pages/Notifications'
import CreateContract from './pages/CreateContract'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { setupTokenRefresh } from './services/authService'

// Create axios instance with auth
const api = axios.create({
  baseURL: '/api/v1'
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Add response interceptor for 401/403 handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, try to refresh
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken && error.config && !error.config._retry) {
        error.config._retry = true
        try {
          const response = await axios.post('/api/v1/auth/refresh', {
            refresh_token: refreshToken
          })
          const { access_token } = response.data
          localStorage.setItem('access_token', access_token)
          error.config.headers.Authorization = `Bearer ${access_token}`
          return api(error.config)
        } catch (refreshError) {
          // Refresh failed, logout
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
          return Promise.reject(refreshError)
        }
      } else {
        // No refresh token, redirect to login
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

function App() {
  useEffect(() => {
    const theme = localStorage.getItem('theme')
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    const density = localStorage.getItem('display_density')
    if (density) {
      document.documentElement.setAttribute('data-density', density)
    }

    // Setup auto token refresh
    setupTokenRefresh()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/upload" element={
          <ProtectedRoute>
            <DocumentUpload />
          </ProtectedRoute>
        } />
        <Route path="/contracts" element={
          <ProtectedRoute>
            <Contracts />
          </ProtectedRoute>
        } />
        <Route path="/vendors" element={
          <ProtectedRoute>
            <Vendors />
          </ProtectedRoute>
        } />
        <Route path="/vendors/new" element={
          <ProtectedRoute>
            <CreateVendor />
          </ProtectedRoute>
        } />
        <Route path="/vendors/:id" element={
          <ProtectedRoute>
            <VendorDetail />
          </ProtectedRoute>
        } />
        <Route path="/vendors/:id/edit" element={
          <ProtectedRoute>
            <CreateVendor />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        } />
        <Route path="/notifications" element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        } />
        <Route path="/contracts/new" element={
          <ProtectedRoute>
            <CreateContract />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}

export default App
