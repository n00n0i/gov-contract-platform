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

export interface Agent {
  id: string
  name: string
  description: string
  status: 'active' | 'paused' | 'error'
  is_system: boolean
  model: string
  model_config: {
    temperature: number
    max_tokens: number
  }
  system_prompt: string
  knowledge_base_ids: string[]
  use_graphrag: boolean
  trigger_events: string[]
  trigger_pages: string[]
  trigger_condition?: string
  enabled_presets: string[]
  input_schema: Record<string, boolean>
  output_action: string
  output_target?: string
  output_format: string
  allowed_roles: string[]
  execution_count: number
  last_executed_at?: string
  avg_execution_time: number
  created_at: string
  updated_at: string
}

export interface KnowledgeBase {
  id: string
  name: string
  description: string
  kb_type: string
  document_count: number
  is_system: boolean
  document_ids?: string[]
  is_indexed?: boolean
}

export const getAgents = async (): Promise<Agent[]> => {
  const response = await api.get('/agents')
  return response.data.data
}

export const getAgent = async (id: string): Promise<Agent> => {
  const response = await api.get(`/agents/${id}`)
  return response.data.data
}

export const createAgent = async (data: Partial<Agent>) => {
  const response = await api.post('/agents', data)
  return response.data
}

export const updateAgent = async (id: string, data: Partial<Agent>) => {
  const response = await api.put(`/agents/${id}`, data)
  return response.data
}

export const deleteAgent = async (id: string) => {
  const response = await api.delete(`/agents/${id}`)
  return response.data
}

export const toggleAgent = async (id: string) => {
  const response = await api.post(`/agents/${id}/toggle`)
  return response.data
}

export const executeAgent = async (
  id: string, 
  input: Record<string, any>, 
  context?: Record<string, any>,
  triggerEvent?: string,
  triggerPage?: string
) => {
  const response = await api.post(`/agents/${id}/execute`, { 
    input, 
    context,
    trigger_event: triggerEvent,
    trigger_page: triggerPage
  })
  return response.data
}

export const getAgentExecutions = async (id: string, limit: number = 20) => {
  const response = await api.get(`/agents/${id}/executions?limit=${limit}`)
  return response.data.data
}

export const getGlobalConfig = async () => {
  const response = await api.get('/agents/config/global')
  return response.data.data
}

export const saveGlobalConfig = async (config: Record<string, any>) => {
  const response = await api.post('/agents/config/global', config)
  return response.data
}

// Metadata
export const getTriggerEvents = async () => {
  const response = await api.get('/agents/metadata/trigger-events')
  return response.data.data
}

export const getOutputActions = async () => {
  const response = await api.get('/agents/metadata/output-actions')
  return response.data.data
}

export const getAgentPages = async () => {
  const response = await api.get('/agents/metadata/pages')
  return response.data.data
}

export const getAgentModels = async () => {
  const response = await api.get('/agents/metadata/models')
  return response.data.data
}

// Knowledge Bases
export const getKnowledgeBases = async (): Promise<KnowledgeBase[]> => {
  const response = await api.get('/agents/knowledge-bases/list')
  return response.data.data
}

export const createKnowledgeBase = async (data: Partial<KnowledgeBase>) => {
  const response = await api.post('/agents/knowledge-bases', data)
  return response.data
}

export const deleteKnowledgeBase = async (id: string) => {
  const response = await api.delete(`/agents/knowledge-bases/${id}`)
  return response.data
}

// Trigger Management
export const getAgentTriggers = async (agentId: string) => {
  const response = await api.get(`/agents/${agentId}/triggers`)
  return response.data.data
}

export const createAgentTrigger = async (agentId: string, data: any) => {
  const response = await api.post(`/agents/${agentId}/triggers`, data)
  return response.data
}

export const updateAgentTrigger = async (agentId: string, triggerId: string, data: any) => {
  const response = await api.put(`/agents/${agentId}/triggers/${triggerId}`, data)
  return response.data
}

export const deleteAgentTrigger = async (agentId: string, triggerId: string) => {
  const response = await api.delete(`/agents/${agentId}/triggers/${triggerId}`)
  return response.data
}

export const testAgentTrigger = async (agentId: string, triggerId: string, testData?: any) => {
  const response = await api.post(`/agents/${agentId}/triggers/${triggerId}/test`, testData || {})
  return response.data
}

// Trigger Templates
export const getTriggerTemplates = async (category?: string) => {
  const url = category 
    ? `/agents/trigger-templates/list?category=${category}`
    : '/agents/trigger-templates/list'
  const response = await api.get(url)
  return response.data.data
}

export const getTriggerCategories = async () => {
  const response = await api.get('/agents/trigger-templates/categories')
  return response.data.data
}

// Trigger Types (comprehensive list)
export const getTriggerTypes = async () => {
  const response = await api.get('/agents/metadata/trigger-types')
  return response.data.data
}

// Trigger Presets - NEW
export const getTriggerPresets = async (category?: string) => {
  const url = category 
    ? `/agents/metadata/presets?category=${category}`
    : '/agents/metadata/presets'
  const response = await api.get(url)
  return response.data
}

export const enableAgentPreset = async (agentId: string, presetId: string, customConditions?: any) => {
  const response = await api.post(`/agents/${agentId}/presets/enable`, {
    preset_id: presetId,
    custom_conditions: customConditions
  })
  return response.data
}

export const disableAgentPreset = async (agentId: string, presetId: string) => {
  const response = await api.post(`/agents/${agentId}/presets/disable`, {
    preset_id: presetId
  })
  return response.data
}

export const getAgentPresets = async (agentId: string) => {
  const response = await api.get(`/agents/${agentId}/presets`)
  return response.data
}
