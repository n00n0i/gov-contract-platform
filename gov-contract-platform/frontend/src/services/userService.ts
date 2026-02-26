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

export interface UserItem {
  id: string
  username: string
  email: string
  first_name?: string
  last_name?: string
  full_name: string
  title?: string
  phone?: string
  role: string
  roles: string[]
  role_names: string[]
  department: string
  department_id?: string
  status: string
  is_active: boolean
  is_superuser: boolean
  mfa_enabled: boolean
  last_login_at?: string
  created_at?: string
}

export interface UserStats {
  total: number
  active: number
  pending: number
  suspended: number
  inactive: number
}

export interface RoleItem {
  id: string
  code: string
  name: string
  description?: string
  is_system: boolean
  level: number
  user_count: number
  permissions: string[]
}

export const listUsers = async (params?: {
  department_id?: string
  role?: string
  status?: string
  search?: string
  page?: number
  limit?: number
}): Promise<{ data: UserItem[]; meta: any }> => {
  const response = await api.get('/identity/users', { params })
  return response.data
}

export const getUserStats = async (): Promise<UserStats> => {
  const response = await api.get('/identity/stats')
  return response.data.data
}

export const createUser = async (data: {
  username: string
  email: string
  password: string
  first_name?: string
  last_name?: string
  title?: string
  phone?: string
  department_id?: string
  role_ids?: string[]
}) => {
  const response = await api.post('/identity/users', data)
  return response.data
}

export const updateUser = async (id: string, data: {
  first_name?: string
  last_name?: string
  title?: string
  phone?: string
  email?: string
  department_id?: string
  status?: string
  role_ids?: string[]
}) => {
  const response = await api.put(`/identity/users/${id}`, data)
  return response.data
}

export const deactivateUser = async (id: string) => {
  const response = await api.patch(`/identity/users/${id}/deactivate`)
  return response.data
}

export const listRoles = async (): Promise<RoleItem[]> => {
  const response = await api.get('/identity/roles')
  return response.data.data
}

export const listDepartments = async () => {
  const response = await api.get('/identity/departments')
  return response.data.data
}
