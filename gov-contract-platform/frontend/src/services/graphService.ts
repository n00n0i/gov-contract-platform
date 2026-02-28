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

export interface GraphEntity {
  id: string
  name: string
  type: string
  properties: Record<string, any>
  source_doc?: string
  confidence: number
}

export interface GraphStats {
  total_entities: number
  total_relationships: number
  total_documents: number
  entities_by_type: Record<string, number>
}

export interface GraphNode {
  id: string
  name: string
  type: string
  x?: number
  y?: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: string
}

export interface GraphVisualizationData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export const getGraphStats = async (): Promise<GraphStats> => {
  const response = await api.get('/graph/stats')
  return response.data.data
}

export const searchEntities = async (query: string, entityType?: string, limit: number = 20): Promise<GraphEntity[]> => {
  // Use contracts graph search endpoint (with security filtering)
  try {
    const response = await api.get('/graph/contracts/entities/search', {
      params: { q: query, entity_type: entityType, limit }
    })
    return response.data.data || []
  } catch (error: any) {
    // Fallback to legacy endpoint if contracts endpoint not available
    if (error.response?.status === 404) {
      try {
        const response = await api.get('/graph/entities/search', {
          params: { q: query, entity_type: entityType, limit }
        })
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

export const getEntity = async (entityId: string): Promise<GraphEntity> => {
  const response = await api.get(`/graph/entities/${entityId}`)
  return response.data.data
}

export const getEntityNeighborhood = async (entityId: string, depth: number = 2) => {
  const response = await api.get(`/graph/entities/${entityId}/neighborhood`, {
    params: { depth }
  })
  return response.data.data
}

export const getGraphVisualization = async (centerEntity?: string, depth: number = 2, limit: number = 100): Promise<GraphVisualizationData> => {
  // Use contracts graph visualization endpoint (with security filtering)
  try {
    const response = await api.get('/graph/contracts/visualization', {
      params: { center_entity: centerEntity, depth, limit }
    })
    return response.data.data || { nodes: [], edges: [] }
  } catch (error: any) {
    // Fallback to legacy endpoint if contracts endpoint not available
    if (error.response?.status === 404) {
      try {
        const response = await api.get('/graph/visualization', {
          params: { center_entity: centerEntity, depth, limit }
        })
        return response.data.data || { nodes: [], edges: [] }
      } catch (legacyError: any) {
        console.warn('Graph visualization failed:', legacyError)
        return { nodes: [], edges: [] }
      }
    }
    console.warn('Graph visualization failed:', error)
    return { nodes: [], edges: [] }
  }
}

export const getKBGraphVisualization = async (kbId?: string, centerEntity?: string, depth: number = 2, limit: number = 100): Promise<GraphVisualizationData> => {
  // Use KB graph visualization endpoint (agent-only)
  const response = await api.get('/graph/kb/visualization', {
    params: { kb_id: kbId, center_entity: centerEntity, depth, limit }
  })
  return response.data.data
}

export const checkGraphHealth = async () => {
  const response = await api.get('/graph/health')
  return response.data
}
