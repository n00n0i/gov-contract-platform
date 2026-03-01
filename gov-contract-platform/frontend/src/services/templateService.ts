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

export interface TemplateVariable {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  required: boolean
  options?: string[]
  default?: string
  description?: string
}

export interface ConditionalGroup {
  key: string
  label: string
  options: { value: string; label: string }[]
  default?: string
}

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
  variables?: TemplateVariable[]
  conditionalGroups?: ConditionalGroup[]
  hasRawContent?: boolean
}

export interface TemplateClause {
  number: number
  title: string
  content: string
  content_template?: string
  optional?: boolean
  condition_key?: string
  condition_value?: string
}

export interface AIExtractResult {
  template_name: string
  template_type: string
  description: string
  clauses: TemplateClause[]
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

// AI Extraction API
export const extractTemplateFromFile = async (
  file: File,
  customPrompt?: string
): Promise<{ success: boolean; data: AIExtractResult; message?: string }> => {
  const formData = new FormData()
  formData.append('file', file)
  if (customPrompt) {
    formData.append('custom_prompt', customPrompt)
  }

  const response = await api.post('/templates/ai-extract', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return response.data
}

export const getDefaultExtractionPrompt = async (): Promise<{ 
  success: boolean; 
  data: { default_prompt: string; description: string } 
}> => {
  const response = await api.get('/templates/ai-extraction/prompt')
  return response.data
}

export const testExtractionPrompt = async (
  customPrompt: string
): Promise<{ success: boolean; data: { prompt_used: string; ai_response: string; note: string } }> => {
  const response = await api.post('/templates/ai-extraction/test-prompt', {
    custom_prompt: customPrompt
  })
  return response.data
}

// System Extraction Prompt Settings
export const getSystemExtractionPrompt = async (): Promise<{
  success: boolean
  data: {
    prompt: string
    updated_at: string
    updated_by: string
  }
}> => {
  const response = await api.get('/templates/settings/extraction-prompt')
  return response.data
}

export const updateSystemExtractionPrompt = async (prompt: string): Promise<{
  success: boolean
  message: string
  data: {
    updated_at: string
    updated_by: string
  }
}> => {
  const response = await api.put('/templates/settings/extraction-prompt', { prompt })
  return response.data
}

export const resetSystemExtractionPrompt = async (): Promise<{
  success: boolean
  message: string
  data: {
    updated_at: string
  }
}> => {
  const response = await api.post('/templates/settings/extraction-prompt/reset')
  return response.data
}

// Smart Import
export const smartImportTemplate = async (rawText: string, save = true, extraPrompt?: string): Promise<{
  success: boolean
  message: string
  data: { template_id: string; template_name: string; clauses_count: number; variables_count: number; conditional_groups_count: number }
}> => {
  const response = await api.post('/templates/import-smart', { raw_text: rawText, save, extra_prompt: extraPrompt || null })
  return response.data
}

export const extractTextFromFile = async (file: File): Promise<{ success: boolean; raw_text: string; char_count: number }> => {
  const form = new FormData()
  form.append('file', file)
  const response = await api.post('/templates/extract-text', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

// Draft Contract
export const draftContract = async (
  templateId: string,
  variableValues: Record<string, any>,
  conditionalSelections: Record<string, string> = {},
  includeOptional: Record<string, boolean> = {}
): Promise<{
  success: boolean
  data: { contract_text: string; template_name: string; variables_filled: number }
}> => {
  const response = await api.post(`/templates/${templateId}/draft`, {
    variable_values: variableValues,
    conditional_selections: conditionalSelections,
    include_optional: includeOptional,
  })
  return response.data
}
