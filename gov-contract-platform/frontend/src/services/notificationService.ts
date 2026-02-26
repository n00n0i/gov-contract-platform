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

// SMTP Settings
export type SMTPSettings = {
  id?: string
  host: string
  port: string
  username: string
  password: string
  use_tls: boolean
  use_ssl: boolean
  from_email: string
  from_name: string
  timeout: string
  max_retries: string
  is_active?: boolean
  is_verified?: boolean
  last_tested?: string
  last_error?: string
}

export type TestEmailRequest = {
  to_email: string
  subject?: string
  message?: string
}

// Global Notifications
export type GlobalNotification = {
  id?: string
  name: string
  description?: string
  notification_type: string
  channel: 'in_app' | 'email' | 'both'
  email_subject_template?: string
  email_body_template?: string
  recipient_roles: string[]
  recipient_emails: string[]
  conditions?: Record<string, any>
  is_scheduled?: boolean
  schedule_cron?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  is_active?: boolean
}

// User Notification Settings
export type UserNotificationSetting = {
  id: string
  user_id: string
  notification_type: string
  enabled: boolean
  channel: 'in_app' | 'email' | 'both'
  email?: string
  frequency: 'immediate' | 'daily_digest' | 'weekly_digest'
  digest_day?: string
  digest_time?: string
  respect_quiet_hours: boolean
  quiet_hours_start?: string
  quiet_hours_end?: string
}

// Notification Types
export type NotificationType = {
  value: string
  label: string
  description: string
  category: string
}

// Notification Logs
export type NotificationLog = {
  id: string
  notification_type: string
  user_id?: string
  title: string
  message: string
  data?: Record<string, any>
  channel: string
  email_to?: string
  status: 'pending' | 'sent' | 'read' | 'failed'
  error_message?: string
  sent_at?: string
  read_at?: string
  created_at: string
}

// SMTP APIs
export const getSMTPSettings = () => api.get('/notifications/smtp')

export const createSMTPSettings = (settings: SMTPSettings) =>
  api.post('/notifications/smtp', settings)

export const testSMTPConnection = () =>
  api.post('/notifications/smtp/test')

export const sendTestEmail = (data: TestEmailRequest) =>
  api.post('/notifications/smtp/test-email', data)

export const deleteSMTPSettings = () =>
  api.delete('/notifications/smtp')

// Global Notification APIs
export const getGlobalNotifications = (activeOnly = false) =>
  api.get('/notifications/global', { params: { active_only: activeOnly } })

export const createGlobalNotification = (data: GlobalNotification) =>
  api.post('/notifications/global', data)

export const updateGlobalNotification = (id: string, data: GlobalNotification) =>
  api.put(`/notifications/global/${id}`, data)

export const deleteGlobalNotification = (id: string) =>
  api.delete(`/notifications/global/${id}`)

// User Notification Settings APIs
export const getUserNotificationSettings = () =>
  api.get('/notifications/user/settings')

export const updateUserNotificationSetting = (id: string, data: Partial<UserNotificationSetting>) =>
  api.put(`/notifications/user/settings/${id}`, data)

export const updateBulkUserSettings = (settings: UserNotificationSetting[]) =>
  api.post('/notifications/user/settings/bulk', settings)

export const getUserNotificationEmail = () =>
  api.get('/notifications/user/email')

export const setUserNotificationEmail = (email: string) =>
  api.post('/notifications/user/email', null, { params: { email } })

// Notification Logs APIs
export const getNotificationLogs = (params?: { limit?: number; offset?: number; type?: string; status?: string }) =>
  api.get('/notifications/logs', { params })

export const getMyNotificationLogs = (params?: { limit?: number; offset?: number; unread_only?: boolean }) =>
  api.get('/notifications/logs/my', { params })

export const markNotificationRead = (logId: string) =>
  api.post(`/notifications/logs/${logId}/read`)

// Notification Types
export const getNotificationTypes = () =>
  api.get('/notifications/types')
