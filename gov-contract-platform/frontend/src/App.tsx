import { BrowserRouter, Routes, Route } from 'react-router-dom'
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

function App() {
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
