import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1'
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ============== Notifications ==============
export const getNotificationSettings = async () => {
  const response = await api.get('/settings/notifications')
  return response.data.data
}

export const saveNotificationSettings = async (settings: any) => {
  const response = await api.post('/settings/notifications', settings)
  return response.data
}

// ============== Preferences ==============
export const getPreferences = async () => {
  const response = await api.get('/settings/preferences')
  return response.data.data
}

export const savePreferences = async (settings: any) => {
  const response = await api.post('/settings/preferences', settings)
  return response.data
}

// ============== OCR Settings ==============
export const getOCRSettings = async () => {
  const response = await api.get('/settings/ocr')
  return response.data.data
}

export const saveOCRSettings = async (settings: any) => {
  const response = await api.post('/settings/ocr', settings)
  return response.data
}

// ============== AI Settings ==============
export const getAISettings = async () => {
  const response = await api.get('/settings/ai')
  return response.data.data
}

export const saveAISettings = async (settings: any) => {
  const response = await api.post('/settings/ai', settings)
  return response.data
}

export const saveAIFeatures = async (features: any) => {
  const response = await api.post('/settings/ai/features', features)
  return response.data
}

export const setDefaultAIProvider = async (providerId: string) => {
  const response = await api.patch(`/settings/ai/providers/${providerId}/set-default`)
  return response.data
}

// ============== RAG Settings ==============
export const getRagSettings = async () => {
  const response = await api.get('/settings/rag')
  return response.data.data
}

export const saveRagSettings = async (settings: any) => {
  const response = await api.post('/settings/rag', settings)
  return response.data
}

// ============== GraphRAG Settings (Legacy - for backward compatibility) ==============
export const getGraphRAGSettings = async () => {
  const response = await api.get('/settings/graphrag')
  return response.data.data
}

export const saveGraphRAGSettings = async (settings: any) => {
  const response = await api.post('/settings/graphrag', settings)
  return response.data
}

// ============== Contracts GraphRAG Settings ==============
export const getContractsGraphRAGSettings = async () => {
  const response = await api.get('/settings/graphrag/contracts')
  return response.data.data
}

export const saveContractsGraphRAGSettings = async (settings: any) => {
  const response = await api.post('/settings/graphrag/contracts', settings)
  return response.data
}

// ============== Knowledge Base GraphRAG Settings ==============
export const getKBGraphRAGSettings = async () => {
  const response = await api.get('/settings/graphrag/kb')
  return response.data.data
}

export const saveKBGraphRAGSettings = async (settings: any) => {
  const response = await api.post('/settings/graphrag/kb', settings)
  return response.data
}

// ============== GraphRAG Overview (both domains) ==============
export const getGraphRAGOverview = async () => {
  const response = await api.get('/settings/graphrag/overview')
  return response.data.data
}

// ============== Graph Stats ==============
export const getGraphStats = async () => {
  const response = await api.get('/graph/stats')
  return response.data.data
}

export const searchGraphEntities = async (query: string, limit = 20) => {
  // Use contracts graph search endpoint (with security filtering)
  try {
    const response = await api.get(`/graph/contracts/entities/search?q=${encodeURIComponent(query)}&limit=${limit}`)
    return response.data.data || []
  } catch (error: any) {
    // Fallback to legacy endpoint if contracts endpoint not available
    if (error.response?.status === 404) {
      try {
        const response = await api.get(`/graph/entities/search?q=${encodeURIComponent(query)}&limit=${limit}`)
        return response.data.data || []
      } catch (legacyError: any) {
        console.warn('Graph entity search failed:', legacyError)
        return []
      }
    }
    console.warn('Graph entity search failed:', error)
    return []
  }
}

// ============== Health Check ==============
export const checkHealth = async () => {
  const response = await api.get('/health')
  return response.data
}
