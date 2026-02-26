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

// ============== RAG Settings ==============
export const getRagSettings = async () => {
  const response = await api.get('/settings/rag')
  return response.data.data
}

export const saveRagSettings = async (settings: any) => {
  const response = await api.post('/settings/rag', settings)
  return response.data
}

// ============== GraphRAG Settings ==============
export const getGraphRAGSettings = async () => {
  const response = await api.get('/settings/graphrag')
  return response.data.data
}

export const saveGraphRAGSettings = async (settings: any) => {
  const response = await api.post('/settings/graphrag', settings)
  return response.data
}

// ============== Graph Stats ==============
export const getGraphStats = async () => {
  const response = await api.get('/graph/stats')
  return response.data.data
}

export const searchGraphEntities = async (query: string, limit = 20) => {
  const response = await api.get(`/graph/entities/search?q=${encodeURIComponent(query)}&limit=${limit}`)
  return response.data.data
}

// ============== Health Check ==============
export const checkHealth = async () => {
  const response = await api.get('/health')
  return response.data
}
