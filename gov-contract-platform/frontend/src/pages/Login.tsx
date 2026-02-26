import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  Shield, Eye, EyeOff, Mail, Lock, ArrowRight,
  AlertCircle, CheckCircle, Building2, Loader2
} from 'lucide-react'
import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Response interceptor for handling token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      try {
        const refreshToken = localStorage.getItem('refresh_token')
        if (refreshToken) {
          const response = await axios.post('/api/v1/auth/refresh', {
            refresh_token: refreshToken
          })
          
          const { access_token } = response.data
          localStorage.setItem('access_token', access_token)
          
          originalRequest.headers.Authorization = `Bearer ${access_token}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
      }
    }
    
    return Promise.reject(error)
  }
)

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Form state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  // Check if already logged in
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      // Verify token is valid
      verifyToken(token)
    }
    
    // Check for message from other pages (e.g., session expired)
    const message = location.state?.message
    if (message) {
      setError(message)
    }
  }, [location])
  
  const verifyToken = async (token: string) => {
    try {
      await axios.get('/api/v1/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      })
      // Token valid, redirect to home
      navigate('/', { replace: true })
    } catch {
      // Token invalid, clear it
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    }
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!username.trim() || !password.trim()) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await api.post('/auth/login', {
        username: username.trim(),
        password: password
      })
      
      const { access_token, refresh_token, expires_in } = response.data
      
      // Store tokens
      localStorage.setItem('access_token', access_token)
      localStorage.setItem('refresh_token', refresh_token)
      
      // Store remember me preference
      if (rememberMe) {
        localStorage.setItem('remember_username', username)
      } else {
        localStorage.removeItem('remember_username')
      }
      
      // Set token expiry (for auto refresh logic)
      const expiryTime = new Date().getTime() + (expires_in * 1000)
      localStorage.setItem('token_expiry', expiryTime.toString())
      
      // Success
      setSuccessMessage('เข้าสู่ระบบสำเร็จ กำลังนำทาง...')
      
      // Redirect after short delay
      setTimeout(() => {
        const from = location.state?.from?.pathname || '/'
        navigate(from, { replace: true })
      }, 1000)
      
    } catch (err: any) {
      console.error('Login error:', err)
      
      // Handle specific error messages
      if (err.response?.status === 401) {
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
      } else if (err.response?.status === 403) {
        setError('บัญชีถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ')
      } else if (err.response?.data?.detail) {
        setError(err.response.data.detail)
      } else {
        setError('ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง')
      }
    } finally {
      setLoading(false)
    }
  }
  
  const handleForgotPassword = () => {
    // TODO: Implement forgot password flow
    alert('กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ตรหัสผ่าน')
  }
  
  // Load remembered username
  useEffect(() => {
    const remembered = localStorage.getItem('remember_username')
    if (remembered) {
      setUsername(remembered)
      setRememberMe(true)
    }
  }, [])
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
      </div>
      
      {/* Login Card */}
      <div className="relative w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-lg mb-4">
            <Shield className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Gov Contract Platform
          </h1>
          <p className="text-blue-200">
            ระบบบริหารจัดการสัญญาภาครัฐ
          </p>
        </div>
        
        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">เข้าสู่ระบบ</h2>
            <p className="text-gray-500 text-sm mt-1">
              กรุณาเข้าสู่ระบบเพื่อใช้งาน
            </p>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          
          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">{successMessage}</p>
            </div>
          )}
          
          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ชื่อผู้ใช้ หรือ อีเมล
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="กรอกชื่อผู้ใช้"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  disabled={loading}
                  autoComplete="username"
                />
              </div>
            </div>
            
            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                รหัสผ่าน
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5 text-gray-500" />
                  ) : (
                    <Eye className="w-5 h-5 text-gray-500" />
                  )}
                </button>
              </div>
            </div>
            
            {/* Options Row */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  disabled={loading}
                />
                <span className="text-sm text-gray-600">จดจำฉัน</span>
              </label>
              
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                disabled={loading}
              >
                ลืมรหัสผ่าน?
              </button>
            </div>
            
            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                <>
                  เข้าสู่ระบบ
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
          
          {/* Demo Accounts */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-2 font-medium">บัญชีทดสอบ:</p>
            <div className="space-y-1 text-xs text-gray-600">
              <p>• admin / password123</p>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="text-center mt-8 text-blue-200 text-sm">
          <p>© 2024 Gov Contract Platform</p>
          <p className="mt-1">สำหรับหน่วยงานราชการไทย</p>
        </div>
      </div>
    </div>
  )
}

// Export auth utilities
export const isAuthenticated = () => {
  const token = localStorage.getItem('access_token')
  if (!token) return false
  
  // Check if token is expired
  const expiry = localStorage.getItem('token_expiry')
  if (expiry && new Date().getTime() > parseInt(expiry)) {
    return false
  }
  
  return true
}

export const logout = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('token_expiry')
  window.location.href = '/login'
}

export const getAuthToken = () => {
  return localStorage.getItem('access_token')
}
