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

export interface OrgUnit {
  id: string
  code: string
  name_th: string
  name_en?: string
  short_name?: string
  level: string
  unit_type: string
  parent_id?: string
  ministry_id?: string
  address?: string
  phone?: string
  email?: string
  director_name?: string
  director_position?: string
  is_active: boolean
  is_head_office: boolean
  order_index: number
  full_path: string
  user_count: number
  children?: OrgUnit[]
  created_at?: string
  updated_at?: string
}

export interface Position {
  id: string
  code: string
  name_th: string
  name_en?: string
  level: number
  position_type: string
  org_unit_id?: string
  org_unit_name?: string
  career_track?: string
  is_active: boolean
  is_management: boolean
  user_count: number
}

export interface OrgStats {
  total_units: number
  total_positions: number
  users_with_org_assignment: number
  units_by_level: Record<string, number>
}

// Organization Units
export const getOrgUnits = async (params?: { level?: string; parent_id?: string; tree_view?: boolean }): Promise<OrgUnit[]> => {
  const response = await api.get('/organization/units', { params })
  return response.data.data
}

export const getOrgTree = async (root_id?: string): Promise<OrgUnit[]> => {
  const response = await api.get('/organization/units/tree', { params: { root_id } })
  return response.data.data
}

export const getOrgUnit = async (id: string): Promise<OrgUnit> => {
  const response = await api.get(`/organization/units/${id}`)
  return response.data.data
}

export const createOrgUnit = async (data: Partial<OrgUnit>) => {
  const response = await api.post('/organization/units', data)
  return response.data
}

export const updateOrgUnit = async (id: string, data: Partial<OrgUnit>) => {
  const response = await api.put(`/organization/units/${id}`, data)
  return response.data
}

export const deleteOrgUnit = async (id: string) => {
  const response = await api.delete(`/organization/units/${id}`)
  return response.data
}

// Positions
export const getPositions = async (params?: { org_unit_id?: string; career_track?: string }): Promise<Position[]> => {
  const response = await api.get('/organization/positions', { params })
  return response.data.data
}

export const createPosition = async (data: Partial<Position>) => {
  const response = await api.post('/organization/positions', data)
  return response.data
}

export const updatePosition = async (id: string, data: Partial<Position>) => {
  const response = await api.put(`/organization/positions/${id}`, data)
  return response.data
}

// User Assignment
export const assignUserToOrg = async (user_id: string, org_unit_id?: string, position_id?: string) => {
  const response = await api.post('/organization/assign-user', {
    user_id,
    org_unit_id,
    position_id
  })
  return response.data
}

export const getUserOrgInfo = async (user_id: string) => {
  const response = await api.get(`/organization/users/${user_id}/org-info`)
  return response.data.data
}

// Stats
export const getOrgStats = async (): Promise<OrgStats> => {
  const response = await api.get('/organization/stats')
  return response.data.data
}

// Level labels in Thai
export const orgLevelLabels: Record<string, string> = {
  ministry: 'กระทรวง',
  department: 'กรม/สำนักงาน',
  bureau: 'สำนัก/กอง',
  division: 'งาน/ฝ่าย',
  section: 'กลุ่ม/หมวด',
  unit: 'หน่วยย่อย'
}

export const careerTrackLabels: Record<string, string> = {
  admin: 'สายบริหาร',
  academic: 'สายวิชาการ',
  support: 'สายอำนวยการ',
  technical: 'สายเทคนิค'
}
