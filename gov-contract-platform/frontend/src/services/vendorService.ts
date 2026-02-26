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

export interface Vendor {
  id: string
  name: string
  name_en?: string
  tax_id: string
  vendor_type: 'individual' | 'company' | 'partnership' | 'cooperative' | 'state_enterprise'
  status: 'active' | 'inactive' | 'blacklisted' | 'suspended' | 'pending'
  email?: string
  phone?: string
  address?: string
  province?: string
  district?: string
  postal_code?: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  contact_position?: string
  website?: string
  registration_no?: string
  registration_date?: string
  bank_name?: string
  bank_account?: string
  bank_branch?: string
  bank_account_no?: string
  bank_account_name?: string
  is_blacklisted: boolean
  blacklist_reason?: string
  blacklisted_at?: string
  notes?: string
  custom_fields?: Record<string, any>
  created_at?: string
  updated_at?: string
}

export interface VendorStats {
  total_vendors: number
  active_vendors: number
  blacklisted_vendors: number
}

export interface VendorListResponse {
  success: boolean
  data: Vendor[]
  meta: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export interface VendorResponse {
  success: boolean
  data: Vendor
  message?: string
}

export interface VendorStatsResponse {
  success: boolean
  data: VendorStats
}

export const vendorService = {
  // List vendors with filters
  getVendors: async (params?: {
    status?: string
    vendor_type?: string
    search?: string
    page?: number
    limit?: number
  }): Promise<VendorListResponse> => {
    const response = await api.get('/vendors', { params })
    return response.data
  },

  // Get single vendor
  getVendor: async (id: string): Promise<VendorResponse> => {
    const response = await api.get(`/vendors/${id}`)
    return response.data
  },

  // Create vendor
  createVendor: async (data: Partial<Vendor>): Promise<VendorResponse> => {
    const response = await api.post('/vendors', data)
    return response.data
  },

  // Update vendor
  updateVendor: async (id: string, data: Partial<Vendor>): Promise<VendorResponse> => {
    const response = await api.put(`/vendors/${id}`, data)
    return response.data
  },

  // Delete vendor (soft delete)
  deleteVendor: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/vendors/${id}`)
    return response.data
  },

  // Blacklist vendor
  blacklistVendor: async (id: string, reason: string): Promise<VendorResponse> => {
    const response = await api.post(`/vendors/${id}/blacklist`, { reason })
    return response.data
  },

  // Get vendor stats
  getVendorStats: async (): Promise<VendorStatsResponse> => {
    const response = await api.get('/vendors/stats/summary')
    return response.data
  }
}

export default vendorService
