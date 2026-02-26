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

// Types
export type NotificationRecipient = {
  id: string
  email: string
  name?: string
  recipient_type: 'email' | 'user' | 'role' | 'department'
  user_id?: string
  role?: string
  department?: string
  notification_types: string
  channel: 'email' | 'in_app' | 'both'
  min_priority: 'low' | 'medium' | 'high' | 'urgent'
  is_active: boolean
  is_verified: boolean
  verified_at?: string
  last_sent_at?: string
  send_count: number
  fail_count: number
  created_at?: string
  updated_at?: string
}

export type RecipientStats = {
  total: number
  active: number
  inactive: number
  verified: number
  unverified: number
  by_type: Record<string, number>
}

// API Functions
export const getRecipients = (params?: {
  recipient_type?: string
  role?: string
  department?: string
  is_active?: boolean
  search?: string
  limit?: number
  offset?: number
}) => api.get('/notifications/recipients', { params })

export const getRecipient = (id: string) => api.get(`/notifications/recipients/${id}`)

export const createRecipient = (data: Partial<NotificationRecipient>) => 
  api.post('/notifications/recipients', data)

export const createBulkRecipients = (data: {
  emails: string[]
  recipient_type?: string
  notification_types?: string
  channel?: string
  min_priority?: string
}) => api.post('/notifications/recipients/bulk', data)

export const updateRecipient = (id: string, data: Partial<NotificationRecipient>) => 
  api.put(`/notifications/recipients/${id}`, data)

export const deleteRecipient = (id: string) => 
  api.delete(`/notifications/recipients/${id}`)

export const toggleRecipient = (id: string) => 
  api.post(`/notifications/recipients/${id}/toggle`)

export const verifyRecipient = (id: string) => 
  api.post(`/notifications/recipients/${id}/verify`)

export const getRecipientStats = () => 
  api.get('/notifications/recipients/stats/summary')
