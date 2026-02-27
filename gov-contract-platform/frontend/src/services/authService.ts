import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1'
})

// Track if we're currently refreshing token
let isRefreshing = false
let refreshSubscribers: ((token: string) => void)[] = []

const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback)
}

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach(callback => callback(token))
  refreshSubscribers = []
}

// Request interceptor - add token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor - handle 401 and auto-refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for token refresh
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(api(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = localStorage.getItem('refresh_token')
        if (!refreshToken) {
          // No refresh token, redirect to login
          window.location.href = '/login'
          return Promise.reject(error)
        }

        // Call refresh endpoint
        const response = await axios.post('/api/v1/auth/refresh', {
          refresh_token: refreshToken
        })

        const { access_token, refresh_token } = response.data

        // Store new tokens
        localStorage.setItem('access_token', access_token)
        if (refresh_token) {
          localStorage.setItem('refresh_token', refresh_token)
        }

        // Update authorization header
        api.defaults.headers.common.Authorization = `Bearer ${access_token}`
        originalRequest.headers.Authorization = `Bearer ${access_token}`

        // Notify subscribers
        onTokenRefreshed(access_token)

        return api(originalRequest)
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    // Handle 403 (Forbidden) - token might be invalid
    if (error.response?.status === 403) {
      console.error('Access forbidden - token may be invalid')
      // Optional: redirect to login after a few seconds
      // setTimeout(() => window.location.href = '/login', 2000)
    }

    return Promise.reject(error)
  }
)

// Auth API functions
export const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) {
    throw new Error('No refresh token')
  }

  const response = await axios.post('/api/v1/auth/refresh', {
    refresh_token: refreshToken
  })

  const { access_token, refresh_token } = response.data
  localStorage.setItem('access_token', access_token)
  if (refresh_token) {
    localStorage.setItem('refresh_token', refresh_token)
  }

  return access_token
}

export const logout = async () => {
  try {
    await api.post('/auth/logout')
  } catch (e) {
    // Ignore errors
  } finally {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    window.location.href = '/login'
  }
}

// Check if token is about to expire and refresh if needed
export const checkAndRefreshToken = async () => {
  const token = localStorage.getItem('access_token')
  if (!token) return false

  try {
    // Decode JWT to check expiration
    const payload = JSON.parse(atob(token.split('.')[1]))
    const exp = payload.exp * 1000 // Convert to milliseconds
    const now = Date.now()
    const timeUntilExpiry = exp - now

    // Refresh if token expires in less than 1 hour
    if (timeUntilExpiry < 60 * 60 * 1000) {
      console.log('Token expiring soon, refreshing...')
      await refreshAccessToken()
      return true
    }

    return false
  } catch (e) {
    console.error('Error checking token:', e)
    return false
  }
}

// Setup periodic token check
export const setupTokenRefresh = () => {
  // Check every 30 minutes
  setInterval(() => {
    checkAndRefreshToken()
  }, 30 * 60 * 1000)

  // Also check on window focus
  window.addEventListener('focus', () => {
    checkAndRefreshToken()
  })
}

export default api
