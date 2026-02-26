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

export interface Template {
  id: string
  name: string
  type: string
  description?: string
  clauses: number
  isDefault: boolean
  lastUsed?: string
  createdAt: string
  updatedAt: string
  createdBy: string
  isSystem: boolean
  clauses_data?: TemplateClause[]
}

export interface TemplateClause {
  number: number
  title: string
  content: string
}

export const getTemplates = async (): Promise<Template[]> => {
  const response = await api.get('/templates')
  return response.data.data
}

export const getTemplate = async (id: string): Promise<Template> => {
  const response = await api.get(`/templates/${id}`)
  return response.data.data
}

export const createTemplate = async (data: Partial<Template>) => {
  const response = await api.post('/templates', data)
  return response.data
}

export const updateTemplate = async (id: string, data: Partial<Template>) => {
  const response = await api.put(`/templates/${id}`, data)
  return response.data
}

export const deleteTemplate = async (id: string) => {
  const response = await api.delete(`/templates/${id}`)
  return response.data
}

export const setDefaultTemplate = async (id: string) => {
  const response = await api.post(`/templates/${id}/set-default`)
  return response.data
}

export const useTemplate = async (id: string) => {
  const response = await api.post(`/templates/${id}/use`)
  return response.data
}

export const getTemplateTypes = async () => {
  const response = await api.get('/templates/types/list')
  return response.data.data
}
