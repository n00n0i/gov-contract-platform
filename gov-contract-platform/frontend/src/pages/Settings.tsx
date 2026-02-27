import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Shield, Lock, Bell, Globe, Moon, Sun,
  CheckCircle, AlertTriangle, Save, Eye, EyeOff,
  Smartphone, Mail, User, Server, Database, FileText,
  Activity, XCircle, ExternalLink, Info, ScanLine, Brain,
  FileImage, Type, Languages, Sparkles, Sliders,
  Bot, FileStack, Copy, Plus, Trash2, Edit3, Play, Pause,
  Settings2, Workflow, Cpu, MessagesSquare, Key, Settings as SettingsIcon, Clock,
  BookOpen, X, Users, UserPlus, UserCog, Building2, ChevronRight, ChevronDown, FolderTree, Zap,
  HardDrive, FileArchive, BrainCircuit, DatabaseBackup, Layers,
  Loader2
} from 'lucide-react'
import NavigationHeader from '../components/NavigationHeader'
import axios from 'axios'
import { useI18n } from '../i18n'
import {
  getNotificationSettings, saveNotificationSettings,
  getPreferences, savePreferences,
  getOCRSettings, saveOCRSettings,
  getAISettings, saveAISettings, saveAIFeatures,
  getRagSettings, saveRagSettings,
  getGraphRAGSettings, saveGraphRAGSettings,
  getGraphStats, searchGraphEntities,
  checkHealth
} from '../services/settingsService'
import { 
  getTemplates, createTemplate, updateTemplate, deleteTemplate, 
  setDefaultTemplate, getTemplateTypes, type Template 
} from '../services/templateService'
import { 
  getAgents, createAgent, updateAgent, deleteAgent, toggleAgent,
  getGlobalConfig, saveGlobalConfig, type Agent,
  getTriggerEvents, getOutputActions, getAgentPages, getAgentModels,
  getKnowledgeBases, createKnowledgeBase, deleteKnowledgeBase, type KnowledgeBase,
  getAgentTriggers, createAgentTrigger, updateAgentTrigger, deleteAgentTrigger, testAgentTrigger,
  getTriggerTemplates, getTriggerTypes,
  getTriggerPresets, enableAgentPreset, disableAgentPreset, getAgentPresets
} from '../services/agentService'
import AgentConfigForm from '../components/AgentConfigForm'
import NotificationSettings from '../components/NotificationSettings'
import TriggerManagement from '../components/TriggerManagement'
import TriggerPresetSelector from '../components/TriggerPresetSelector'
import GraphVisualization from '../components/GraphVisualization'
import CreateTemplate from '../components/CreateTemplate'
import {
  getOrgStats, getOrgTree, getPositions, createOrgUnit, createPosition,
  orgLevelLabels, careerTrackLabels, type OrgUnit, type Position as OrgPosition
} from '../services/organizationService'
import {
  listUsers, getUserStats, listRoles, createUser, deactivateUser,
  type UserItem, type UserStats, type RoleItem
} from '../services/userService'

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

interface HealthStatus {
  status: string
  platform: string
  version: string
  environment: string
}

// 2FA Settings Component
function TwoFASettings() {
  const [status, setStatus] = useState({ enabled: false, has_secret: false })
  const [loading, setLoading] = useState(false)
  const [setupData, setSetupData] = useState<any>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [showSetup, setShowSetup] = useState(false)
  const [showDisable, setShowDisable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetch 2FA status on mount
  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await api.get('/auth/2fa/status')
      setStatus(response.data)
    } catch (err) {
      console.error('Failed to fetch 2FA status:', err)
    }
  }

  const handleSetup = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post('/auth/2fa/setup')
      setSetupData(response.data.data)
      setShowSetup(true)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'ไม่สามารถตั้งค่า 2FA ได้')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      setError('กรุณาใส่รหัส 6 หลัก')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await api.post('/auth/2fa/verify', null, { params: { code: verifyCode } })
      setSuccess('เปิดใช้งาน 2FA สำเร็จ')
      setShowSetup(false)
      setVerifyCode('')
      fetchStatus()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'รหัสยืนยันไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  const handleDisable = async () => {
    if (!disableCode || disableCode.length !== 6) {
      setError('กรุณาใส่รหัส 6 หลัก')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await api.post('/auth/2fa/disable', null, { params: { code: disableCode } })
      setSuccess('ปิดใช้งาน 2FA สำเร็จ')
      setShowDisable(false)
      setDisableCode('')
      fetchStatus()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'รหัสยืนยันไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Smartphone className="w-6 h-6 text-green-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">การยืนยันตัวตนแบบสองขั้นตอน (2FA)</h2>
            <p className="text-sm text-gray-500">เพิ่มความปลอดภัยให้บัญชีของคุณด้วย Authenticator App</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm ${
          status.enabled 
            ? 'bg-green-100 text-green-700' 
            : 'bg-gray-100 text-gray-600'
        }`}>
          {status.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
        </span>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Status Info */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-gray-900">ความปลอดภัยของบัญชี</p>
            <p className="text-sm text-gray-500 mt-1">
              {status.enabled 
                ? 'บัญชีของคุณได้รับการปกป้องด้วย 2FA คุณจะต้องใส่รหัสจาก Authenticator App ทุกครั้งที่เข้าสู่ระบบ'
                : 'การเปิดใช้งาน 2FA จะเพิ่มความปลอดภัยโดยต้องใส่รหัสยืนยันจาก Authenticator App นอกจากรหัสผ่านปกติ'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-3">
        {!status.enabled ? (
          <button
            onClick={handleSetup}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            เปิดใช้งาน 2FA
          </button>
        ) : (
          <button
            onClick={() => setShowDisable(true)}
            className="flex items-center gap-2 px-6 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
          >
            <Shield className="w-4 h-4" />
            ปิดใช้งาน 2FA
          </button>
        )}
      </div>

      {/* Setup Modal */}
      {showSetup && setupData && (
        <div className="mt-6 p-6 border-2 border-green-200 rounded-xl bg-green-50">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-green-600" />
            ตั้งค่า 2FA
          </h3>

          {/* Instructions */}
          <div className="space-y-2 mb-6">
            {setupData.instructions.map((step: string, i: number) => (
              <p key={i} className="text-sm text-gray-700">{step}</p>
            ))}
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <img 
                src={setupData.qr_code} 
                alt="2FA QR Code" 
                className="w-48 h-48"
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">สแกน QR Code ด้วย Authenticator App</p>
          </div>

          {/* Manual Key */}
          <div className="mb-6 p-3 bg-white rounded-lg">
            <p className="text-sm text-gray-600 mb-2">หรือป้อนรหัสด้วยตนเอง:</p>
            <code className="block p-2 bg-gray-100 rounded text-sm font-mono break-all">
              {setupData.manual_entry_key}
            </code>
          </div>

          {/* Verify Code */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              ใส่รหัส 6 หลักจาก Authenticator App
            </label>
            <input
              type="text"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center text-2xl tracking-widest"
              maxLength={6}
            />
            <div className="flex gap-2">
              <button
                onClick={handleVerify}
                disabled={loading || verifyCode.length !== 6}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {loading ? 'กำลังยืนยัน...' : 'ยืนยันและเปิดใช้งาน'}
              </button>
              <button
                onClick={() => { setShowSetup(false); setVerifyCode(''); setError(null); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disable Modal */}
      {showDisable && (
        <div className="mt-6 p-6 border-2 border-red-200 rounded-xl bg-red-50">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            ปิดใช้งาน 2FA
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            การปิดใช้งาน 2FA จะลดความปลอดภัยของบัญชี กรุณาใส่รหัสจาก Authenticator App เพื่อยืนยัน
          </p>

          <div className="space-y-3">
            <input
              type="text"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-center text-2xl tracking-widest"
              maxLength={6}
            />
            <div className="flex gap-2">
              <button
                onClick={handleDisable}
                disabled={loading || disableCode.length !== 6}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {loading ? 'กำลังปิดใช้งาน...' : 'ปิดใช้งาน 2FA'}
              </button>
              <button
                onClick={() => { setShowDisable(false); setDisableCode(''); setError(null); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recommended Apps */}
      <div className="mt-6 pt-6 border-t">
        <p className="text-sm font-medium text-gray-700 mb-2">แอพที่แนะนำ:</p>
        <div className="flex gap-4 text-sm text-gray-500">
          <span>• Google Authenticator</span>
          <span>• Microsoft Authenticator</span>
          <span>• Authy</span>
        </div>
      </div>
    </div>
  )
}

// AI Provider Form Component
interface AIProvider {
  id: string
  name: string
  type: 'openai-compatible' | 'ollama' | 'vllm'
  modelType: 'llm' | 'embedding'
  url: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  // GraphRAG specific
  supportsGraphRAG?: boolean
  graphRAGConfig?: {
    entityExtractionModel?: string
    relationshipModel?: string
    communityModel?: string
  }
}

function ProviderForm({ 
  initialData, 
  onSave, 
  onCancel,
  defaultModelType = 'llm'
}: { 
  initialData: AIProvider | null
  onSave: (provider: AIProvider) => void
  onCancel: () => void
  defaultModelType?: 'llm' | 'embedding'
}) {
  const [formData, setFormData] = useState<AIProvider>({
    id: initialData?.id || '',
    name: initialData?.name || '',
    type: initialData?.type || 'openai-compatible',
    modelType: initialData?.modelType || defaultModelType,
    url: initialData?.url || '',
    apiKey: initialData?.apiKey || '',
    model: initialData?.model || '',
    temperature: initialData?.temperature ?? 0.7,
    maxTokens: initialData?.maxTokens ?? 2048,
    supportsGraphRAG: initialData?.supportsGraphRAG ?? false,
    graphRAGConfig: initialData?.graphRAGConfig || {}
  })
  const [showKey, setShowKey] = useState(false)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Default URLs by type
  const defaultUrls: Record<string, string> = {
    'ollama': 'http://localhost:11434',
    'vllm': 'http://localhost:8000',
    'openai-compatible': 'https://api.openai.com/v1'
  }

  // Common models for each type
  // Common models for LLM
  const commonLLMModels: Record<string, string[]> = {
    'ollama': ['llama3.1', 'mistral', 'codellama', 'llama3', 'phi3', 'gemma2', 'qwen2.5'],
    'vllm': ['meta-llama/Llama-3.1-8B-Instruct', 'mistralai/Mistral-7B-Instruct-v0.3'],
    'openai-compatible': ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini']
  }

  // Common models for Embedding
  const commonEmbeddingModels: Record<string, string[]> = {
    'ollama': ['nomic-embed-text', 'mxbai-embed-large', 'snowflake-arctic-embed'],
    'vllm': ['sentence-transformers/all-MiniLM-L6-v2'],
    'openai-compatible': ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002']
  }

  const getCommonModels = () => {
    if (formData.modelType === 'embedding') {
      return commonEmbeddingModels[formData.type] || []
    }
    return commonLLMModels[formData.type] || []
  }

  const handleTypeChange = (type: AIProvider['type']) => {
    setFormData({
      ...formData,
      type,
      url: defaultUrls[type] || formData.url,
      model: ''
    })
    setAvailableModels([])
    setFetchError(null)
  }

  // Filter models by type based on name patterns
  const filterModelsByType = (models: string[], modelType: 'llm' | 'embedding', providerType: string): string[] => {
    // OpenAI compatible models have specific patterns
    if (providerType === 'openai-compatible') {
      if (modelType === 'embedding') {
        // OpenAI embedding models
        return models.filter(m => 
          m.includes('embedding') || 
          m.includes('text-embedding-3') ||
          m.includes('text-embedding-ada')
        )
      } else {
        // OpenAI LLM models (exclude embeddings)
        return models.filter(m => !m.includes('embedding'))
      }
    }
    
    // Ollama and other providers
    const embeddingPatterns = [
      'embed', 'embedding', 'bge-', 'e5-', 'gte-', 'jina-embed',
      'nomic-embed', 'mxbai-embed', 'snowflake-arctic-embed',
      'multilingual-e5', 'all-minilm'
    ]
    
    const visionPatterns = ['vision', 'vl-', 'mm-', 'multimodal', 'llava']
    
    return models.filter(model => {
      const lowerModel = model.toLowerCase()
      const isEmbedding = embeddingPatterns.some(p => lowerModel.includes(p))
      const isVision = visionPatterns.some(p => lowerModel.includes(p))
      
      if (modelType === 'embedding') {
        return isEmbedding
      } else {
        // LLM: exclude embedding and vision models
        return !isEmbedding && !isVision
      }
    })
  }

  const fetchModels = async () => {
    if (!formData.url) {
      setFetchError('กรุณาใส่ URL ก่อน')
      return
    }

    setFetchingModels(true)
    setFetchError(null)

    try {
      let models: string[] = []

      if (formData.type === 'ollama') {
        // Ollama: GET /api/tags
        const response = await fetch(`${formData.url.replace(/\/$/, '')}/api/tags`)
        if (response.ok) {
          const data = await response.json()
          models = data.models?.map((m: any) => m.name) || []
        }
      } else if (formData.type === 'openai-compatible' || formData.type === 'vllm') {
        // OpenAI/vLLM: GET /v1/models
        const headers: Record<string, string> = {}
        if (formData.apiKey) {
          headers['Authorization'] = `Bearer ${formData.apiKey}`
        }
        const response = await fetch(`${formData.url.replace(/\/$/, '')}/v1/models`, { headers })
        if (response.ok) {
          const data = await response.json()
          models = data.data?.map((m: any) => m.id) || []
        }
      }

      if (models.length > 0) {
        // Filter models by selected type
        const filteredModels = filterModelsByType(models, formData.modelType, formData.type)
        
        if (filteredModels.length > 0) {
          setAvailableModels(filteredModels)
          // Auto-select first model if none selected
          if (!formData.model && filteredModels.length > 0) {
            setFormData(prev => ({ ...prev, model: filteredModels[0] }))
          }
        } else {
          // No matching models found, use common models
          setAvailableModels(getCommonModels())
          setFetchError(`ไม่พบ ${formData.modelType === 'embedding' ? 'Embedding' : 'LLM'} Models จาก Endpoint ใช้รายการทั่วไปแทน`)
        }
      } else {
        // Fallback to common models
        setAvailableModels(getCommonModels())
        setFetchError('ไม่พบรายการ Models จาก Endpoint ใช้รายการทั่วไปแทน')
      }
    } catch (err) {
      console.error('Fetch models error:', err)
      setAvailableModels(getCommonModels())
      setFetchError('ไม่สามารถเชื่อมต่อ Endpoint ได้ ใช้รายการทั่วไปแทน')
    } finally {
      setFetchingModels(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Provider Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ประเภท <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'ollama', label: 'Ollama', desc: 'Local' },
            { value: 'vllm', label: 'vLLM', desc: 'Local Server' },
            { value: 'openai-compatible', label: 'OpenAI Compatible', desc: 'API' }
          ].map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => handleTypeChange(type.value as AIProvider['type'])}
              className={`p-3 rounded-lg border-2 text-left transition ${
                formData.type === type.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="font-medium text-gray-900">{type.label}</p>
              <p className="text-xs text-gray-500">{type.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Model Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ประเภท Model <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setFormData({...formData, modelType: 'llm'})}
            className={`p-3 rounded-lg border-2 text-left transition ${
              formData.modelType === 'llm'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="font-medium text-gray-900">LLM (Language Model)</p>
            <p className="text-xs text-gray-500">สำหรับสร้างข้อความ ตอบคำถาม</p>
          </button>
          <button
            type="button"
            onClick={() => setFormData({...formData, modelType: 'embedding'})}
            className={`p-3 rounded-lg border-2 text-left transition ${
              formData.modelType === 'embedding'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="font-medium text-gray-900">Embedding Model</p>
            <p className="text-xs text-gray-500">สำหรับ RAG / Vector Search</p>
          </button>
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ชื่อ Provider <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          placeholder="e.g., Local Ollama, OpenAI GPT-4"
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          URL <span className="text-red-500">*</span>
        </label>
        <input
          type="url"
          required
          value={formData.url}
          onChange={(e) => setFormData({...formData, url: e.target.value})}
          placeholder={defaultUrls[formData.type]}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          {formData.type === 'ollama' && 'Ollama API endpoint (e.g., http://localhost:11434)'}
          {formData.type === 'vllm' && 'vLLM server URL (e.g., http://localhost:8000)'}
          {formData.type === 'openai-compatible' && 'OpenAI compatible API endpoint'}
        </p>
      </div>

      {/* API Key (optional for local) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          API Key {formData.type === 'openai-compatible' && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={formData.apiKey}
            onChange={(e) => setFormData({...formData, apiKey: e.target.value})}
            placeholder={formData.type === 'ollama' ? 'Optional (usually empty for local)' : 'sk-...'}
            className="w-full px-4 py-2 pr-20 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {formData.apiKey && (
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
            >
              {showKey ? <EyeOff className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
            </button>
          )}
        </div>
      </div>

      {/* Model with Fetch Button */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Model <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <select
            required
            value={formData.model}
            onChange={(e) => setFormData({...formData, model: e.target.value})}
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">-- เลือก Model --</option>
            {availableModels.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={fetchModels}
            disabled={fetchingModels || !formData.url}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition disabled:opacity-50 whitespace-nowrap"
          >
            {fetchingModels ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                กำลังโหลด...
              </span>
            ) : (
              'ดึงรายการ'
            )}
          </button>
        </div>
        {fetchError && (
          <p className="text-xs text-amber-600 mt-1">{fetchError}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          กด "ดึงรายการ" เพื่อดึง Models จาก Endpoint หรือเลือกจากรายการที่มี
        </p>
      </div>

      {/* Temperature */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Temperature: <span className="text-blue-600">{formData.temperature}</span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={formData.temperature}
          onChange={(e) => setFormData({...formData, temperature: parseFloat(e.target.value)})}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>แม่นยำ (0.0)</span>
          <span>สร้างสรรค์ (1.0)</span>
        </div>
      </div>

      {/* Max Tokens - Only for LLM */}
      {formData.modelType === 'llm' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Tokens
          </label>
          <select
            value={formData.maxTokens}
            onChange={(e) => setFormData({...formData, maxTokens: parseInt(e.target.value)})}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={1024}>1,024</option>
            <option value={2048}>2,048</option>
            <option value={4096}>4,096</option>
            <option value={8192}>8,192</option>
            <option value={16384}>16,384</option>
            <option value={32768}>32,768</option>
          </select>
        </div>
      )}

      {/* Embedding Dimensions - Only for Embedding */}
      {formData.modelType === 'embedding' && (
        <div className="p-4 bg-purple-50 rounded-lg">
          <p className="text-sm text-purple-700">
            <span className="font-medium">Embedding Model:</span> ใช้สำหรับแปลงข้อความเป็นเวกเตอร์ เพื่อทำ RAG และ Vector Search
          </p>
        </div>
      )}

      {/* GraphRAG Settings - Only for LLM */}
      {formData.modelType === 'llm' && (
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              id="supportsGraphRAG"
              checked={formData.supportsGraphRAG}
              onChange={(e) => setFormData({...formData, supportsGraphRAG: e.target.checked})}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="supportsGraphRAG" className="font-medium text-gray-700">
              รองรับ GraphRAG
            </label>
          </div>

          {formData.supportsGraphRAG && (
            <div className="space-y-3 pl-6">
              <p className="text-sm text-gray-500 mb-2">
                GraphRAG ใช้ LLM สำหรับสร้าง Knowledge Graph จากเอกสาร เพื่อการค้นหาที่แม่นยำยิ่งขึ้น
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Entity Extraction Model (Optional)
                </label>
                <input
                  type="text"
                  value={formData.graphRAGConfig?.entityExtractionModel || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    graphRAGConfig: { ...formData.graphRAGConfig, entityExtractionModel: e.target.value }
                  })}
                  placeholder="เว้นว่างเพื่อใช้ Model หลัก"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Relationship Model (Optional)
                </label>
                <input
                  type="text"
                  value={formData.graphRAGConfig?.relationshipModel || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    graphRAGConfig: { ...formData.graphRAGConfig, relationshipModel: e.target.value }
                  })}
                  placeholder="เว้นว่างเพื่อใช้ Model หลัก"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          {initialData ? 'บันทึกการแก้ไข' : 'เพิ่ม Provider'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const { t, language: i18nLanguage, setLanguage: setI18nLanguage } = useI18n()
  const [activeTab, setActiveTab] = useState<'security' | 'notifications' | 'preferences' | 'system' | 'ocr' | 'ai' | 'ai-features' | 'agents' | 'knowledge' | 'graphrag' | 'org-structure' | 'users' | 'templates' | 'storage'>('security')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)

  // OCR Test State
  const [ocrTestFile, setOcrTestFile] = useState<File | null>(null)
  const [ocrTestResult, setOcrTestResult] = useState<string>('')
  const [ocrTestLoading, setOcrTestLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Show/Hide API Keys
  const [showTyphoonKey, setShowTyphoonKey] = useState(false)
  const [showCustomApiKey, setShowCustomApiKey] = useState(false)

  // 2FA State
  const [twoFAStatus, setTwoFAStatus] = useState({ enabled: false, has_secret: false })
  const [twoFALoading, setTwoFALoading] = useState(false)
  const [twoFASetupData, setTwoFASetupData] = useState<any>(null)
  const [twoFAVerifyCode, setTwoFAVerifyCode] = useState('')
  const [twoFADisableCode, setTwoFADisableCode] = useState('')
  const [showTwoFASetup, setShowTwoFASetup] = useState(false)
  const [showTwoFADisable, setShowTwoFADisable] = useState(false)

  // Security settings
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  })

  // Notification settings
  const [notifications, setNotifications] = useState({
    email_notifications: true,
    contract_expiry: true,
    payment_reminders: true,
    document_uploads: false,
    system_updates: true
  })

  // Preferences - initialize from localStorage first
  const getInitialPreferences = () => {
    const savedTheme = localStorage.getItem('theme')
    const savedDensity = localStorage.getItem('display_density')
    const savedLanguage = localStorage.getItem('language')
    return {
      dark_mode: savedTheme === 'dark',
      language: savedLanguage || 'th',
      items_per_page: 20,
      date_format: 'dd/mm/yyyy',
      calendar_system: 'buddhist',
      default_page: 'dashboard',
      display_density: savedDensity || 'normal'
    }
  }
  
  const [preferences, setPreferences] = useState(getInitialPreferences())

  // OCR Settings
  const [ocrSettings, setOcrSettings] = useState({
    mode: 'default', // 'default' | 'typhoon' | 'custom'
    engine: 'tesseract',
    language: 'tha+eng',
    dpi: 300,
    auto_rotate: true,
    deskew: true,
    enhance_contrast: true,
    extract_tables: true,
    confidence_threshold: 80,
    // Typhoon OCR settings (https://api.opentyphoon.ai/v1/ocr)
    typhoon_url: 'https://api.opentyphoon.ai/v1/ocr',
    typhoon_key: '',
    typhoon_model: 'typhoon-ocr',
    typhoon_task_type: 'default',
    typhoon_max_tokens: 16384,
    typhoon_temperature: 0.1,
    typhoon_top_p: 0.6,
    typhoon_repetition_penalty: 1.2,
    typhoon_pages: '', // JSON array e.g. [1, 2, 3]
    // Custom API settings
    custom_api_url: '',
    custom_api_key: '',
    custom_api_model: '',
    // OCR Template/Prompt
    ocr_template: `คุณเป็นระบบ OCR สำหรับเอกสารสัญญาภาครัฐ

กรุณาอ่านเอกสารที่ให้มาและสกัดข้อมูลตามโครงสร้างนี้:

1. เลขที่สัญญา: [contract_number]
2. ชื่อสัญญา: [title]
3. ผู้ว่าจ้าง: [employer]
4. ผู้รับจ้าง: [contractor]
5. มูลค่าสัญญา: [value] บาท
6. วันเริ่มต้น: [start_date]
7. วันสิ้นสุด: [end_date]
8. รายละเอียดงาน: [description]

หมายเหตุ: 
- ถ้าไม่พบข้อมูลให้ใส่ "-"
- วันที่ให้ใช้รูปแบบ YYYY-MM-DD
- มูลค่าให้ระบุเฉพาะตัวเลข ไม่ต้องใส่คำว่า "บาท"`
  })

  // AI Providers - Multiple providers with selection
  const [aiProviders, setAiProviders] = useState<AIProvider[]>([
    {
      id: 'default-llm',
      name: 'Local Ollama (LLM)',
      type: 'ollama',
      modelType: 'llm',
      url: 'http://localhost:11434',
      apiKey: '',
      model: 'llama3.1',
      temperature: 0.7,
      maxTokens: 2048,
      supportsGraphRAG: false
    },
    {
      id: 'default-embedding',
      name: 'Local Ollama (Embedding)',
      type: 'ollama',
      modelType: 'embedding',
      url: 'http://localhost:11434',
      apiKey: '',
      model: 'nomic-embed-text',
      temperature: 0,
      maxTokens: 512,
      supportsGraphRAG: false
    }
  ])
  const [activeLLMId, setActiveLLMId] = useState<string>('default-llm')
  const [activeEmbeddingId, setActiveEmbeddingId] = useState<string>('default-embedding')
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null)
  const [showAddLLM, setShowAddLLM] = useState(false)
  const [showAddEmbedding, setShowAddEmbedding] = useState(false)
  const [showAiKey, setShowAiKey] = useState<Record<string, boolean>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  // AI Features (global settings)
  const [aiFeatures, setAiFeatures] = useState({
    auto_extract: true,
    smart_classification: true,
    anomaly_detection: true,
    contract_analysis: true
  })

  // Agent Settings
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentGlobalConfig, setAgentGlobalConfig] = useState({
    auto_execute: false,
    parallel_processing: false,
    notification_on_complete: true
  })
  const [showAgentForm, setShowAgentForm] = useState(false)
  const [showKBForm, setShowKBForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [knowledgeBases, setKnowledgeBases] = useState<any[]>([])
  const [triggerEvents, setTriggerEvents] = useState<any[]>([])
  const [triggerTypes, setTriggerTypes] = useState<any[]>([])
  const [triggerTemplates, setTriggerTemplates] = useState<any[]>([])
  const [outputActions, setOutputActions] = useState<any[]>([])
  const [agentPages, setAgentPages] = useState<any[]>([])
  const [agentModels, setAgentModels] = useState<any[]>([])
  
  // Agent Triggers (Legacy - will be replaced by presets)
  const [agentTriggers, setAgentTriggers] = useState<Record<string, any[]>>({})
  const [managingTriggersFor, setManagingTriggersFor] = useState<Agent | null>(null)
  
  // Trigger Presets (NEW)
  const [triggerPresets, setTriggerPresets] = useState<any[]>([])
  const [triggerPresetCategories, setTriggerPresetCategories] = useState<any[]>([])
  const [editingAgentPresets, setEditingAgentPresets] = useState<Agent | null>(null)

  // Contract Templates
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateTypes, setTemplateTypes] = useState<any[]>([])

  // Template Content Data (for preview)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  
  // Create Template Modal
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)

  // RAG Settings
  const [ragSettings, setRagSettings] = useState({
    embeddingProviderId: 'default-embedding',
    chunkSize: 512,
    chunkOverlap: 50
  })

  // GraphRAG Settings
  const [graphragSettings, setGraphragSettings] = useState({
    auto_extract_on_upload: false,
    extract_relationships: true,
    min_confidence: 0.7
  })

  // GraphRAG Stats
  const [graphStats, setGraphStats] = useState({
    total_entities: 0,
    total_relationships: 0,
    total_documents: 0
  })
  const [graphStatsLoading, setGraphStatsLoading] = useState(false)

  // GraphRAG Entity Search
  const [entitySearchQuery, setEntitySearchQuery] = useState('')
  const [entitySearchResults, setEntitySearchResults] = useState<any[]>([])
  const [entitySearchLoading, setEntitySearchLoading] = useState(false)

  // Organization Structure State
  const [orgStats, setOrgStats] = useState({ total_units: 0, total_positions: 0, users_with_org_assignment: 0, units_by_level: {} as Record<string, number> })
  const [orgTree, setOrgTree] = useState<OrgUnit[]>([])
  const [orgPositions, setOrgPositions] = useState<OrgPosition[]>([])
  const [orgLoading, setOrgLoading] = useState(false)
  const [showOrgUnitForm, setShowOrgUnitForm] = useState(false)
  const [newOrgUnitForm, setNewOrgUnitForm] = useState({ code: '', name_th: '', name_en: '', level: 'bureau' as string, parent_id: '' })
  const [showPositionForm, setShowPositionForm] = useState(false)
  const [newPositionForm, setNewPositionForm] = useState({ code: '', name_th: '', name_en: '', level: 3, position_type: 'permanent', career_track: 'support', is_management: false })

  // User Management State
  const [userList, setUserList] = useState<UserItem[]>([])
  const [userStats, setUserStats] = useState<UserStats>({ total: 0, active: 0, pending: 0, suspended: 0, inactive: 0 })
  const [userRoles, setUserRoles] = useState<RoleItem[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [showUserForm, setShowUserForm] = useState(false)
  const [newUserForm, setNewUserForm] = useState({ username: '', email: '', password: '', first_name: '', last_name: '', title: '', role_ids: [] as string[] })

  // Profile form
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', title: '', phone: '' })
  const [profileSaving, setProfileSaving] = useState(false)

  // Load Templates and Agents
  useEffect(() => {
    fetchTemplates()
    fetchAgents()
    fetchTemplateTypes()
  }, [])

  // Load org/user data when tab becomes active
  useEffect(() => {
    if (activeTab === 'org-structure') fetchOrgData()
    if (activeTab === 'users') fetchUsers()
  }, [activeTab])

  // Initialize settings on mount (runs once)
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    
    const savedDensity = localStorage.getItem('display_density')
    if (savedDensity) {
      document.documentElement.setAttribute('data-density', savedDensity)
    }
    
    const savedLanguage = localStorage.getItem('language')
    if (savedLanguage) {
      document.documentElement.lang = savedLanguage
    }
  }, [])

  // Apply dark mode to document when preferences change
  useEffect(() => {
    if (preferences.dark_mode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [preferences.dark_mode])

  // Apply display density
  useEffect(() => {
    document.documentElement.setAttribute('data-density', preferences.display_density)
    localStorage.setItem('display_density', preferences.display_density)
  }, [preferences.display_density])

  // Apply language
  useEffect(() => {
    document.documentElement.lang = preferences.language
    localStorage.setItem('language', preferences.language)
  }, [preferences.language])

  const fetchTemplates = async () => {
    try {
      const data = await getTemplates()
      setTemplates(data)
      // Select first template by default
      if (data.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(data[0].id)
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err)
    }
  }
  
  const handleTemplateSuccess = () => {
    setShowCreateTemplate(false)
    fetchTemplates()
  }

  const fetchAgents = async () => {
    try {
      // Use Promise.allSettled to handle partial failures
      const results = await Promise.allSettled([
        getAgents(),
        getKnowledgeBases(),
        getTriggerEvents(),
        getTriggerTypes(),
        getTriggerTemplates(),
        getTriggerPresets(),
        getOutputActions(),
        getAgentPages(),
        getAgentModels(),
        getGlobalConfig()
      ])
      
      const [agentsRes, kbsRes, eventsRes, typesRes, templatesRes, presetsRes, actionsRes, pagesRes, modelsRes, configRes] = results
      
      // Handle each result individually
      if (agentsRes.status === 'fulfilled') setAgents(agentsRes.value)
      if (kbsRes.status === 'fulfilled') setKnowledgeBases(kbsRes.value)
      
      if (presetsRes.status === 'fulfilled' && presetsRes.value?.data) {
        const mappedPresets = presetsRes.value.data.map((p: any) => ({
          value: p.id,
          label: p.name,
          description: p.description,
          category: p.category,
          requires_kb: p.requires_kb,
          requires_graphrag: p.requires_graphrag,
        }))
        setTriggerEvents(mappedPresets)
        setTriggerPresets(presetsRes.value.data)
        setTriggerPresetCategories(presetsRes.value.categories || [])
      } else {
        console.error('Failed to fetch trigger presets:', presetsRes)
        setTriggerEvents([])
      }
      
      if (typesRes.status === 'fulfilled') setTriggerTypes(typesRes.value)
      if (templatesRes.status === 'fulfilled') setTriggerTemplates(templatesRes.value)
      if (actionsRes.status === 'fulfilled') setOutputActions(actionsRes.value)
      if (pagesRes.status === 'fulfilled') setAgentPages(pagesRes.value)
      if (modelsRes.status === 'fulfilled') setAgentModels(modelsRes.value)
      
      if (configRes.status === 'fulfilled' && configRes.value) {
        setAgentGlobalConfig({
          auto_execute: configRes.value.auto_execute ?? false,
          parallel_processing: configRes.value.parallel_processing ?? false,
          notification_on_complete: configRes.value.notification_on_complete ?? true
        })
      }
      
      // Fetch triggers for each agent
      const triggersMap: Record<string, any[]> = {}
      if (agentsRes.status === 'fulfilled' && agentsRes.value) {
        for (const agent of agentsRes.value) {
          try {
            const triggers = await getAgentTriggers(agent.id)
            triggersMap[agent.id] = triggers
          } catch (e) {
            triggersMap[agent.id] = []
          }
        }
      }
      setAgentTriggers(triggersMap)
    } catch (err) {
      console.error('Failed to fetch agents:', err)
    }
  }

  const fetchTemplateTypes = async () => {
    try {
      const data = await getTemplateTypes()
      setTemplateTypes(data)
    } catch (err) {
      console.error('Failed to fetch template types:', err)
    }
  }

  // Template handlers
  const handleSetDefaultTemplate = async (id: string) => {
    try {
      await setDefaultTemplate(id)
      // Update local state
      setTemplates(prev => prev.map(t => ({
        ...t,
        isDefault: t.id === id
      })))
      setMessage({ type: 'success', text: 'ตั้งค่า Template เริ่มต้นสำเร็จ' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถตั้งค่าได้' })
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('ยืนยันการลบ Template นี้?')) return
    try {
      await deleteTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
      if (selectedTemplateId === id) {
        setSelectedTemplateId(null)
        setSelectedTemplate(null)
      }
      setMessage({ type: 'success', text: 'ลบ Template สำเร็จ' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถลบได้' })
    }
  }

  // Agent handlers
  const handleToggleAgent = async (id: string) => {
    try {
      await toggleAgent(id)
      setAgents(prev => prev.map(a => 
        a.id === id ? { ...a, status: a.status === 'active' ? 'paused' : 'active' } : a
      ))
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถเปลี่ยนสถานะได้' })
    }
  }

  const handleDeleteAgent = async (id: string) => {
    if (!confirm('ยืนยันการลบ Agent นี้?')) return
    try {
      await deleteAgent(id)
      setAgents(prev => prev.filter(a => a.id !== id))
      setMessage({ type: 'success', text: 'ลบ Agent สำเร็จ' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถลบได้' })
    }
  }

  const handleSaveAgentGlobalConfig = async () => {
    setSaving(true)
    try {
      await saveGlobalConfig(agentGlobalConfig)
      setMessage({ type: 'success', text: 'บันทึกการตั้งค่า Agents สำเร็จ' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถบันทึกได้' })
    } finally {
      setSaving(false)
    }
  }

  const handleCreateAgent = async (data: any) => {
    setSaving(true)
    try {
      await createAgent(data)
      await fetchAgents()
      setShowAgentForm(false)
      setMessage({ type: 'success', text: 'สร้าง Agent สำเร็จ' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถสร้างได้' })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateAgent = async (data: any) => {
    if (!editingAgent) return
    setSaving(true)
    try {
      await updateAgent(editingAgent.id, data)
      await fetchAgents()
      setEditingAgent(null)
      setMessage({ type: 'success', text: 'อัพเดต Agent สำเร็จ' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถอัพเดตได้' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteKnowledgeBase = async (id: string) => {
    if (!confirm('ยืนยันการลบ Knowledge Base นี้?')) return
    try {
      await deleteKnowledgeBase(id)
      setKnowledgeBases(prev => prev.filter(kb => kb.id !== id))
      setMessage({ type: 'success', text: 'ลบ Knowledge Base สำเร็จ' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถลบได้' })
    }
  }

  const handleCreateKnowledgeBase = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    try {
      const formData = new FormData(e.currentTarget)
      await createKnowledgeBase({
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        kb_type: formData.get('kb_type') as string,
        document_ids: []
      })
      await fetchAgents()
      setShowKBForm(false)
      setMessage({ type: 'success', text: 'สร้าง Knowledge Base สำเร็จ' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถสร้างได้' })
    } finally {
      setSaving(false)
    }
  }

  // Load selected template details
  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === selectedTemplateId)
      setSelectedTemplate(template || null)
    }
  }, [selectedTemplateId, templates])

  useEffect(() => {
    fetchUser()
    fetchHealth()
    fetchSettings()
  }, [])

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me')
      setUser(response.data)
      if (response.data) {
        setProfileForm({
          first_name: response.data.first_name || '',
          last_name: response.data.last_name || '',
          title: response.data.title || '',
          phone: response.data.phone || ''
        })
      }
    } catch (err) {
      console.error('Failed to fetch user:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchHealth = async () => {
    try {
      const data = await checkHealth()
      setHealth(data)
    } catch (err) {
      console.error('Health check failed:', err)
      setHealth(null)
    }
  }

  const fetchSettings = async () => {
    try {
      // Load preferences
      const prefs = await getPreferences()
      if (prefs) {
        setPreferences(prev => ({...prev, ...prefs}))
      }
      
      // Load notifications
      const notifs = await getNotificationSettings()
      if (notifs) {
        setNotifications(prev => ({...prev, ...notifs}))
      }
      
      // Load OCR settings
      const ocr = await getOCRSettings()
      if (ocr) {
        setOcrSettings(prev => ({...prev, ...ocr}))
      }
      
      // Load AI settings
      const ai = await getAISettings()
      if (ai) {
        if (ai.providers) setAiProviders(ai.providers)
        if (ai.activeLLMId) setActiveLLMId(ai.activeLLMId)
        if (ai.activeEmbeddingId) {
          setActiveEmbeddingId(ai.activeEmbeddingId)
          setRagSettings(prev => ({ ...prev, embeddingProviderId: ai.activeEmbeddingId }))
        }
        if (ai.features) setAiFeatures(prev => ({...prev, ...ai.features}))
      }

      // Load RAG settings
      try {
        const rag = await getRagSettings()
        if (rag) setRagSettings(prev => ({ ...prev, ...rag }))
      } catch (err) {
        console.error('Failed to fetch RAG settings:', err)
      }

      // Load GraphRAG settings
      try {
        const grag = await getGraphRAGSettings()
        if (grag) setGraphragSettings(prev => ({ ...prev, ...grag }))
      } catch (err) {
        console.error('Failed to fetch GraphRAG settings:', err)
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    }
  }

  const fetchGraphStats = async () => {
    setGraphStatsLoading(true)
    try {
      const stats = await getGraphStats()
      if (stats) {
        setGraphStats({
          total_entities: stats.total_entities || 0,
          total_relationships: stats.total_relationships || 0,
          total_documents: stats.total_documents || 0
        })
      }
    } catch (err) {
      console.error('Failed to fetch graph stats:', err)
    } finally {
      setGraphStatsLoading(false)
    }
  }

  const handleEntitySearch = async () => {
    if (!entitySearchQuery.trim()) return
    setEntitySearchLoading(true)
    try {
      const results = await searchGraphEntities(entitySearchQuery)
      setEntitySearchResults(results || [])
    } catch (err) {
      console.error('Entity search failed:', err)
      setEntitySearchResults([])
    } finally {
      setEntitySearchLoading(false)
    }
  }

  const fetchOrgData = async () => {
    setOrgLoading(true)
    try {
      const [statsRes, treeRes, posRes] = await Promise.allSettled([
        getOrgStats(),
        getOrgTree(),
        getPositions()
      ])
      if (statsRes.status === 'fulfilled') setOrgStats(statsRes.value)
      if (treeRes.status === 'fulfilled') setOrgTree(Array.isArray(treeRes.value) ? treeRes.value : [])
      if (posRes.status === 'fulfilled') setOrgPositions(Array.isArray(posRes.value) ? posRes.value : [])
    } catch (err) {
      console.error('Failed to fetch org data:', err)
    } finally {
      setOrgLoading(false)
    }
  }

  const fetchUsers = async () => {
    setUsersLoading(true)
    try {
      const [usersRes, statsRes, rolesRes] = await Promise.allSettled([
        listUsers({ limit: 100 }),
        getUserStats(),
        listRoles()
      ])
      if (usersRes.status === 'fulfilled') setUserList(usersRes.value.data || [])
      if (statsRes.status === 'fulfilled') setUserStats(statsRes.value)
      if (rolesRes.status === 'fulfilled') setUserRoles(rolesRes.value || [])
    } catch (err) {
      console.error('Failed to fetch users:', err)
    } finally {
      setUsersLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    setProfileSaving(true)
    try {
      await api.put('/auth/me', profileForm)
      setMessage({ type: 'success', text: 'บันทึกข้อมูลส่วนตัวสำเร็จ' })
      fetchUser()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถบันทึกข้อมูลได้' })
    } finally {
      setProfileSaving(false)
    }
  }

  const handleCreateOrgUnit = async () => {
    if (!newOrgUnitForm.code || !newOrgUnitForm.name_th) {
      setMessage({ type: 'error', text: 'กรุณากรอกรหัสและชื่อหน่วยงาน' })
      return
    }
    setSaving(true)
    try {
      await createOrgUnit({ ...newOrgUnitForm, unit_type: 'government' } as any)
      setShowOrgUnitForm(false)
      setNewOrgUnitForm({ code: '', name_th: '', name_en: '', level: 'bureau', parent_id: '' })
      await fetchOrgData()
      setMessage({ type: 'success', text: 'เพิ่มหน่วยงานสำเร็จ' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถเพิ่มหน่วยงานได้' })
    } finally {
      setSaving(false)
    }
  }

  const handleCreatePosition = async () => {
    if (!newPositionForm.code || !newPositionForm.name_th) {
      setMessage({ type: 'error', text: 'กรุณากรอกรหัสและชื่อตำแหน่ง' })
      return
    }
    setSaving(true)
    try {
      await createPosition(newPositionForm as any)
      setShowPositionForm(false)
      setNewPositionForm({ code: '', name_th: '', name_en: '', level: 3, position_type: 'permanent', career_track: 'support', is_management: false })
      await fetchOrgData()
      setMessage({ type: 'success', text: 'เพิ่มตำแหน่งสำเร็จ' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถเพิ่มตำแหน่งได้' })
    } finally {
      setSaving(false)
    }
  }

  const handleCreateUser = async () => {
    if (!newUserForm.username || !newUserForm.email || !newUserForm.password) {
      setMessage({ type: 'error', text: 'กรุณากรอกชื่อผู้ใช้ อีเมล และรหัสผ่าน' })
      return
    }
    setSaving(true)
    try {
      await createUser(newUserForm)
      setShowUserForm(false)
      setNewUserForm({ username: '', email: '', password: '', first_name: '', last_name: '', title: '', role_ids: [] })
      await fetchUsers()
      setMessage({ type: 'success', text: 'สร้างผู้ใช้สำเร็จ' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถสร้างผู้ใช้ได้' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivateUser = async (id: string, username: string) => {
    if (!confirm(`ยืนยันการระงับบัญชี "${username}"?`)) return
    try {
      await deactivateUser(id)
      await fetchUsers()
      setMessage({ type: 'success', text: 'ระงับผู้ใช้สำเร็จ' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถระงับผู้ใช้ได้' })
    }
  }

  const handleChangePassword = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setMessage({ type: 'error', text: 'รหัสผ่านใหม่ไม่ตรงกัน' })
      return
    }
    if (passwordForm.new_password.length < 8) {
      setMessage({ type: 'error', text: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      await api.post('/auth/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
        confirm_password: passwordForm.confirm_password
      })
      setMessage({ type: 'success', text: 'เปลี่ยนรหัสผ่านสำเร็จ' })
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err: any) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.detail || 'ไม่สามารถเปลี่ยนรหัสผ่านได้' 
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNotifications = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await saveNotificationSettings(notifications)
      setMessage({ type: 'success', text: 'บันทึกการตั้งค่าการแจ้งเตือนสำเร็จ' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถบันทึกได้' })
    } finally {
      setSaving(false)
    }
  }

  const handleSavePreferences = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await savePreferences(preferences)
      setMessage({ type: 'success', text: 'บันทึกการตั้งค่าสำเร็จ' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถบันทึกได้' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveOcrSettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await saveOCRSettings(ocrSettings)
      setMessage({ type: 'success', text: 'บันทึกการตั้งค่า OCR สำเร็จ' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถบันทึกได้' })
    } finally {
      setSaving(false)
    }
  }

  // OCR Test Functions
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff']
      const maxSize = 10 * 1024 * 1024 // 10MB
      
      if (!validTypes.includes(file.type)) {
        setMessage({ type: 'error', text: 'ไฟล์ไม่รองรับ กรุณาอัพโหลด PDF, PNG, JPG หรือ TIFF' })
        return
      }
      
      if (file.size > maxSize) {
        setMessage({ type: 'error', text: 'ไฟล์ใหญ่เกินไป (สูงสุด 10MB)' })
        return
      }
      
      setOcrTestFile(file)
      setMessage(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff']
      const maxSize = 10 * 1024 * 1024
      
      if (!validTypes.includes(file.type)) {
        setMessage({ type: 'error', text: 'ไฟล์ไม่รองรับ กรุณาอัพโหลด PDF, PNG, JPG หรือ TIFF' })
        return
      }
      
      if (file.size > maxSize) {
        setMessage({ type: 'error', text: 'ไฟล์ใหญ่เกินไป (สูงสุด 10MB)' })
        return
      }
      
      setOcrTestFile(file)
      setMessage(null)
    }
  }

  // Test OCR with current settings (custom settings)
  const handleOcrTest = async () => {
    if (!ocrTestFile) {
      setMessage({ type: 'error', text: 'กรุณาเลือกไฟล์ก่อน' })
      return
    }

    setOcrTestLoading(true)
    setOcrTestResult('')
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', ocrTestFile)
      formData.append('settings', JSON.stringify(ocrSettings))

      const response = await api.post('/ocr/test', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (response.data?.text) {
        setOcrTestResult(response.data.text)
        setMessage({ type: 'success', text: 'OCR สำเร็จ (ใช้การตั้งค่าชั่วคราว)' })
      } else {
        setOcrTestResult(JSON.stringify(response.data, null, 2))
      }
    } catch (err: any) {
      console.error('OCR Error:', err)
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.detail || 'OCR ล้มเหลว กรุณาลองใหม่' 
      })
    } finally {
      setOcrTestLoading(false)
    }
  }

  // Test OCR with saved settings from database (production mode)
  const handleOcrTestWithSavedSettings = async () => {
    if (!ocrTestFile) {
      setMessage({ type: 'error', text: 'กรุณาเลือกไฟล์ก่อน' })
      return
    }

    setOcrTestLoading(true)
    setOcrTestResult('')
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', ocrTestFile)
      // No settings - backend will use saved OCR settings

      const response = await api.post('/ocr/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (response.data?.text) {
        setOcrTestResult(response.data.text)
        const mode = response.data?.settings_used?.mode || 'default'
        setMessage({ type: 'success', text: `OCR สำเร็จ (โหมด: ${mode})` })
      } else {
        setOcrTestResult(JSON.stringify(response.data, null, 2))
      }
    } catch (err: any) {
      console.error('OCR Error:', err)
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.detail || 'OCR ล้มเหลว กรุณาตรวจสอบการตั้งค่า' 
      })
    } finally {
      setOcrTestLoading(false)
    }
  }

  const handleSaveAiSettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await saveAISettings({
        providers: aiProviders,
        activeLLMId,
        activeEmbeddingId,
        features: aiFeatures
      })
      setMessage({ type: 'success', text: 'บันทึกการตั้งค่า AI สำเร็จ' })
    } catch (err: any) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.detail || 'ไม่สามารถบันทึกได้'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAIFeatures = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await saveAIFeatures(aiFeatures)
      setMessage({ type: 'success', text: 'บันทึกการตั้งค่า AI Features สำเร็จ' })
    } catch (err: any) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.detail || 'ไม่สามารถบันทึกได้'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <NavigationHeader
        title="ตั้งค่า"
        subtitle="Settings"
        breadcrumbs={[{ label: 'ตั้งค่า' }]}
      />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              {message.text}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <nav className="space-y-0.5">

              {/* Group: Personal */}
              <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('settings.personal')}</p>
              <button
                onClick={() => setActiveTab('security')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-left ${
                  activeTab === 'security' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span className="text-sm font-medium">{t('settings.security')}</span>
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-left ${
                  activeTab === 'notifications' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Bell className="w-4 h-4" />
                <span className="text-sm font-medium">{t('settings.notifications')}</span>
              </button>
              <button
                onClick={() => setActiveTab('preferences')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-left ${
                  activeTab === 'preferences' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span className="text-sm font-medium">{t('settings.general')}</span>
              </button>

              {/* Group: Contracts */}
              <p className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('settings.contracts')}</p>
              <button
                onClick={() => setActiveTab('templates')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-left ${
                  activeTab === 'templates' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <FileStack className="w-4 h-4" />
                <span className="text-sm font-medium">{t('settings.templates')}</span>
              </button>

              {/* Group: AI & Automation */}
              <p className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('settings.ai_automation')}</p>
              <button
                onClick={() => setActiveTab('ai')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-left ${
                  activeTab === 'ai' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Brain className="w-4 h-4" />
                <span className="text-sm font-medium">AI Models</span>
              </button>
              <button
                onClick={() => setActiveTab('ai-features')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-left ${
                  activeTab === 'ai-features' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">AI Features</span>
              </button>
              <button
                onClick={() => setActiveTab('agents')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-left ${
                  activeTab === 'agents' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Bot className="w-4 h-4" />
                <span className="text-sm font-medium">Agents</span>
              </button>
              <button
                onClick={() => setActiveTab('knowledge')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-left ${
                  activeTab === 'knowledge' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span className="text-sm font-medium">Knowledge Base (RAG)</span>
              </button>
              <button
                onClick={() => { setActiveTab('graphrag'); fetchGraphStats() }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-left ${
                  activeTab === 'graphrag' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Workflow className="w-4 h-4" />
                <span className="text-sm font-medium">GraphRAG</span>
              </button>

              {/* Group: System */}
              <p className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('settings.system')}</p>
              <button
                onClick={() => setActiveTab('ocr')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-left ${
                  activeTab === 'ocr' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <ScanLine className="w-4 h-4" />
                <span className="text-sm font-medium">OCR</span>
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-left ${
                  activeTab === 'system' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Server className="w-4 h-4" />
                <span className="text-sm font-medium">{t('settings.server_api')}</span>
              </button>
              <button
                onClick={() => setActiveTab('storage')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-left ${
                  activeTab === 'storage' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <HardDrive className="w-4 h-4" />
                <span className="text-sm font-medium">{t('settings.storage')}</span>
              </button>

              {/* Group: Management */}
              <p className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('settings.management')}</p>
              <button
                onClick={() => setActiveTab('org-structure')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-left ${
                  activeTab === 'org-structure' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span className="text-sm font-medium">{t('settings.org_structure')}</span>
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-left ${
                  activeTab === 'users' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">{t('settings.user_management')}</span>
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="md:col-span-3 space-y-6">
            {/* Security Settings */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                {/* Profile */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <User className="w-6 h-6 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-900">ข้อมูลส่วนตัว</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">ชื่อ</label>
                      <input
                        type="text"
                        value={profileForm.first_name}
                        onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="ชื่อ"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">นามสกุล</label>
                      <input
                        type="text"
                        value={profileForm.last_name}
                        onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="นามสกุล"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">ตำแหน่ง</label>
                      <input
                        type="text"
                        value={profileForm.title}
                        onChange={(e) => setProfileForm({ ...profileForm, title: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="ตำแหน่งงาน"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">เบอร์โทรศัพท์</label>
                      <input
                        type="text"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="เบอร์โทรศัพท์"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSaveProfile}
                    disabled={profileSaving}
                    className="mt-4 flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {profileSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลส่วนตัว'}
                  </button>
                </div>

                {/* Change Password */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Lock className="w-6 h-6 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-900">เปลี่ยนรหัสผ่าน</h2>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        รหัสผ่านปัจจุบัน
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword.current ? 'text' : 'password'}
                          value={passwordForm.current_password}
                          onChange={(e) => setPasswordForm({...passwordForm, current_password: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword({...showPassword, current: !showPassword.current})}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          {showPassword.current ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        รหัสผ่านใหม่
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword.new ? 'text' : 'password'}
                          value={passwordForm.new_password}
                          onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword({...showPassword, new: !showPassword.new})}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          {showPassword.new ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ยืนยันรหัสผ่านใหม่
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword.confirm ? 'text' : 'password'}
                          value={passwordForm.confirm_password}
                          onChange={(e) => setPasswordForm({...passwordForm, confirm_password: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword({...showPassword, confirm: !showPassword.confirm})}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          {showPassword.confirm ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handleChangePassword}
                      disabled={saving || !passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
                    </button>
                  </div>
                </div>

                {/* Two Factor Auth */}
                <TwoFASettings />
              </div>
            )}

            {/* Preferences */}
            {activeTab === 'preferences' && (
              <div className="space-y-6">
                {/* Date & Region */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Clock className="w-6 h-6 text-blue-600" />
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('date.title')}</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('date.subtitle')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Calendar System */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('date.calendar_system')}</label>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setPreferences({ ...preferences, calendar_system: 'buddhist' })}
                          className={`flex-1 py-2.5 px-3 rounded-lg border-2 text-center transition ${
                            preferences.calendar_system === 'buddhist' 
                              ? 'border-blue-500 bg-blue-50 text-blue-700' 
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                          }`}
                        >
                          <p className="font-medium text-sm">{t('date.calendar.buddhist')}</p>
                          <p className="text-xs text-gray-400">{t('date.calendar.buddhist_year')} 2568</p>
                        </button>
                        <button
                          onClick={() => setPreferences({ ...preferences, calendar_system: 'gregorian' })}
                          className={`flex-1 py-2.5 px-3 rounded-lg border-2 text-center transition ${
                            preferences.calendar_system === 'gregorian' 
                              ? 'border-blue-500 bg-blue-50 text-blue-700' 
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                          }`}
                        >
                          <p className="font-medium text-sm">{t('date.calendar.gregorian')}</p>
                          <p className="text-xs text-gray-400">{t('date.calendar.gregorian_year')} 2025</p>
                        </button>
                      </div>
                    </div>

                    {/* Date Format */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('date.date_format')}</label>
                      <select
                        value={preferences.date_format}
                        onChange={(e) => setPreferences({ ...preferences, date_format: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option value="dd/mm/yyyy">dd/mm/yyyy (26/02/2025)</option>
                        <option value="dd-mm-yyyy">dd-mm-yyyy (26-02-2025)</option>
                        <option value="yyyy-mm-dd">yyyy-mm-dd (2025-02-26)</option>
                        <option value="dd mmmm yyyy">dd mmmm yyyy (26 February 2025)</option>
                        <option value="mmmm dd, yyyy">mmmm dd, yyyy (February 26, 2025)</option>
                      </select>
                    </div>

                    {/* Timezone (display only) */}
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('date.timezone')}</label>
                      <div className="flex items-center gap-3 px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
                        <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">Asia/Bangkok (UTC+7)</span>
                          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">— {t('date.timezone_bangkok')}</span>
                        </div>
                        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded">{i18nLanguage === 'th' ? 'ค่าคงที่' : 'Fixed'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <SettingsIcon className="w-6 h-6 text-blue-600" />
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('navigation.title')}</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('navigation.subtitle')}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('navigation.default_page')}</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'dashboard', label: t('navigation.dashboard'), icon: Activity },
                        { value: 'contracts', label: t('navigation.contracts'), icon: FileText },
                        { value: 'vendors', label: t('navigation.vendors'), icon: Users }
                      ].map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          onClick={() => setPreferences({ ...preferences, default_page: value })}
                          className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition ${
                            preferences.default_page === value 
                              ? 'border-blue-500 bg-blue-50 text-blue-700' 
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="font-medium text-sm">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Save */}
                <div className="flex justify-end">
                  <button
                    onClick={handleSavePreferences}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                  </button>
                </div>
              </div>
            )}

            {/* System Settings */}
            {activeTab === 'system' && (
              <div className="space-y-6">
                {/* Status Cards */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    สถานะระบบ
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StatusCard 
                      icon={<Server className="w-6 h-6 text-blue-600" />}
                      title="Backend API"
                      value={health?.version || '-'}
                      subtitle={health?.environment || 'unknown'}
                      color="blue"
                      status={health ? 'online' : 'offline'}
                    />
                    <StatusCard 
                      icon={<Database className="w-6 h-6 text-green-600" />}
                      title="Database"
                      value="PostgreSQL"
                      subtitle="Connected"
                      color="green"
                      status="online"
                    />
                    <StatusCard 
                      icon={<User className="w-6 h-6 text-purple-600" />}
                      title="Active Users"
                      value={user ? '1' : '0'}
                      subtitle={user?.email || 'Not logged in'}
                      color="purple"
                      status="online"
                    />
                    <StatusCard 
                      icon={<FileText className="w-6 h-6 text-orange-600" />}
                      title="Documents"
                      value="0"
                      subtitle="No data yet"
                      color="orange"
                      status="online"
                    />
                  </div>
                </div>

                {/* API Endpoints Status */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <Activity className="w-5 h-5" />
                      API Endpoints Status
                    </h2>
                    <button 
                      onClick={checkHealth}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="divide-y divide-gray-200">
                    <EndpointStatus name="Health Check" method="GET" path="/health" status={health?.status === 'healthy' ? 'online' : health ? 'offline' : 'offline'} />
                    <EndpointStatus name="Register" method="POST" path="/auth/register" status="online" />
                    <EndpointStatus name="Login" method="POST" path="/auth/login" status="online" />
                    <EndpointStatus name="Upload Document" method="POST" path="/documents/upload" status="online" />
                    <EndpointStatus name="Get Contracts" method="GET" path="/contracts" status="online" />
                    <EndpointStatus name="Get Vendors" method="GET" path="/vendors" status="online" />
                  </div>
                </div>

                {/* Quick Links & System Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Links</h3>
                    <div className="space-y-2">
                      <a href="http://localhost:8000/docs" target="_blank" rel="noopener noreferrer"
                         className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition border border-gray-200">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <span>API Documentation (Swagger)</span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </a>
                      <a href="http://localhost:8000/redoc" target="_blank" rel="noopener noreferrer"
                         className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition border border-gray-200">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-green-600" />
                          <span>API Documentation (ReDoc)</span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </a>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">System Info</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-600">Platform</span>
                        <span className="font-medium">{health?.platform || '-'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-600">Version</span>
                        <span className="font-medium">{health?.version || '-'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-600">Environment</span>
                        <span className="font-medium capitalize">{health?.environment || '-'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-600">Frontend</span>
                        <span className="font-medium">React + Vite</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-gray-600">Build Date</span>
                        <span className="font-medium">{new Date().toLocaleDateString('th-TH')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* OCR Settings */}
            {activeTab === 'ocr' && (
              <div className="space-y-6">
                {/* API Configuration */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <ScanLine className="w-6 h-6 text-blue-600" />
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">ตั้งค่า OCR Engine</h2>
                      <p className="text-sm text-gray-500">กำหนด OCR Engine ที่ใช้สำหรับอ่านเอกสาร</p>
                    </div>
                  </div>

                  {/* Mode Selection */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Tesseract Option */}
                      <button
                        onClick={() => setOcrSettings({...ocrSettings, mode: 'default'})}
                        className={`p-4 rounded-xl border-2 text-left transition ${
                          ocrSettings.mode === 'default'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            ocrSettings.mode === 'default' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                          }`}>
                            {ocrSettings.mode === 'default' && <div className="w-2 h-2 bg-white rounded-full m-0.5" />}
                          </div>
                          <span className="font-semibold text-gray-900">Tesseract</span>
                        </div>
                        <p className="text-sm text-gray-500 ml-7">OCR ในเครื่อง (ฟรี ไม่ต้องตั้งค่า)</p>
                      </button>

                      {/* Typhoon OCR Option */}
                      <button
                        onClick={() => setOcrSettings({...ocrSettings, mode: 'typhoon'})}
                        className={`p-4 rounded-xl border-2 text-left transition ${
                          ocrSettings.mode === 'typhoon'
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            ocrSettings.mode === 'typhoon' ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                          }`}>
                            {ocrSettings.mode === 'typhoon' && <div className="w-2 h-2 bg-white rounded-full m-0.5" />}
                          </div>
                          <span className="font-semibold text-gray-900">Typhoon OCR</span>
                        </div>
                        <p className="text-sm text-gray-500 ml-7">OpenThailand OCR API</p>
                      </button>

                      {/* Custom API Option */}
                      <button
                        onClick={() => setOcrSettings({...ocrSettings, mode: 'custom'})}
                        className={`p-4 rounded-xl border-2 text-left transition ${
                          ocrSettings.mode === 'custom'
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            ocrSettings.mode === 'custom' ? 'border-green-500 bg-green-500' : 'border-gray-300'
                          }`}>
                            {ocrSettings.mode === 'custom' && <div className="w-2 h-2 bg-white rounded-full m-0.5" />}
                          </div>
                          <span className="font-semibold text-gray-900">Custom API</span>
                        </div>
                        <p className="text-sm text-gray-500 ml-7">OCR ภายนอกอื่นๆ</p>
                      </button>
                    </div>

                    {/* Typhoon OCR Settings */}
                    {ocrSettings.mode === 'typhoon' && (
                      <div className="p-4 bg-purple-50 rounded-xl space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4 text-purple-600" />
                          <span className="font-medium text-purple-900">การตั้งค่า Typhoon OCR</span>
                        </div>

                        {/* API Endpoint */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            API Endpoint URL
                          </label>
                          <input
                            type="url"
                            value={ocrSettings.typhoon_url}
                            onChange={(e) => setOcrSettings({...ocrSettings, typhoon_url: e.target.value})}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">Default: https://api.opentyphoon.ai/v1/ocr</p>
                        </div>

                        {/* API Key */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            API Key <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showTyphoonKey ? 'text' : 'password'}
                              placeholder="Bearer token..."
                              value={ocrSettings.typhoon_key}
                              onChange={(e) => setOcrSettings({...ocrSettings, typhoon_key: e.target.value})}
                              className="w-full px-4 py-2 pr-20 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              {ocrSettings.typhoon_key && (
                                <button
                                  type="button"
                                  onClick={() => setShowTyphoonKey(!showTyphoonKey)}
                                  className="p-1 hover:bg-gray-100 rounded transition"
                                  title={showTyphoonKey ? 'ซ่อน' : 'แสดง'}
                                >
                                  {showTyphoonKey ? (
                                    <EyeOff className="w-4 h-4 text-gray-500" />
                                  ) : (
                                    <Eye className="w-4 h-4 text-gray-500" />
                                  )}
                                </button>
                              )}
                              <Key className="w-4 h-4 text-gray-400" />
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Authorization: Bearer {`{api_key}`}</p>
                        </div>

                        {/* Model & Task Type */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Model
                            </label>
                            <select
                              value={ocrSettings.typhoon_model}
                              onChange={(e) => setOcrSettings({...ocrSettings, typhoon_model: e.target.value})}
                              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            >
                              <option value="typhoon-ocr">typhoon-ocr</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Task Type
                            </label>
                            <select
                              value={ocrSettings.typhoon_task_type}
                              onChange={(e) => setOcrSettings({...ocrSettings, typhoon_task_type: e.target.value})}
                              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            >
                              <option value="default">default</option>
                              <option value="extract_text">extract_text</option>
                              <option value="structured">structured</option>
                            </select>
                          </div>
                        </div>

                        {/* Generation Parameters */}
                        <div className="pt-4 border-t border-purple-200">
                          <p className="font-medium text-gray-700 mb-4">พารามิเตอร์การประมวลผล</p>
                          
                          <div className="grid grid-cols-2 gap-4">
                            {/* Max Tokens */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Max Tokens: <span className="text-purple-600">{ocrSettings.typhoon_max_tokens}</span>
                              </label>
                              <input
                                type="range"
                                min="1024"
                                max="32768"
                                step="1024"
                                value={ocrSettings.typhoon_max_tokens}
                                onChange={(e) => setOcrSettings({...ocrSettings, typhoon_max_tokens: parseInt(e.target.value)})}
                                className="w-full accent-purple-600"
                              />
                            </div>

                            {/* Temperature */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Temperature: <span className="text-purple-600">{ocrSettings.typhoon_temperature}</span>
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={ocrSettings.typhoon_temperature}
                                onChange={(e) => setOcrSettings({...ocrSettings, typhoon_temperature: parseFloat(e.target.value)})}
                                className="w-full accent-purple-600"
                              />
                            </div>

                            {/* Top P */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Top P: <span className="text-purple-600">{ocrSettings.typhoon_top_p}</span>
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={ocrSettings.typhoon_top_p}
                                onChange={(e) => setOcrSettings({...ocrSettings, typhoon_top_p: parseFloat(e.target.value)})}
                                className="w-full accent-purple-600"
                              />
                            </div>

                            {/* Repetition Penalty */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Repetition Penalty: <span className="text-purple-600">{ocrSettings.typhoon_repetition_penalty}</span>
                              </label>
                              <input
                                type="range"
                                min="1"
                                max="2"
                                step="0.1"
                                value={ocrSettings.typhoon_repetition_penalty}
                                onChange={(e) => setOcrSettings({...ocrSettings, typhoon_repetition_penalty: parseFloat(e.target.value)})}
                                className="w-full accent-purple-600"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Pages (Optional) */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Pages (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder='e.g., [1, 2, 3] หรือ {"start": 1, "end": 5}'
                            value={ocrSettings.typhoon_pages}
                            onChange={(e) => setOcrSettings({...ocrSettings, typhoon_pages: e.target.value})}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">ระบุหน้าที่ต้องการ OCR (JSON format)</p>
                        </div>

                        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                          <ExternalLink className="w-4 h-4 text-blue-600" />
                          <a 
                            href="https://playground.opentyphoon.ai/ocr" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            ไปที่ Typhoon OCR Playground
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Custom API Settings */}
                    {ocrSettings.mode === 'custom' && (
                      <div className="p-4 bg-green-50 rounded-xl space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Key className="w-4 h-4 text-green-600" />
                          <span className="font-medium text-green-900">การตั้งค่า Custom API</span>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            API URL <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="url"
                            placeholder="https://api.example.com/ocr"
                            value={ocrSettings.custom_api_url}
                            onChange={(e) => setOcrSettings({...ocrSettings, custom_api_url: e.target.value})}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">URL ของ OCR API endpoint</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            API Key <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showCustomApiKey ? 'text' : 'password'}
                              placeholder="sk-xxxxxxxxxxxxxxxx"
                              value={ocrSettings.custom_api_key}
                              onChange={(e) => setOcrSettings({...ocrSettings, custom_api_key: e.target.value})}
                              className="w-full px-4 py-2 pr-20 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              {ocrSettings.custom_api_key && (
                                <button
                                  type="button"
                                  onClick={() => setShowCustomApiKey(!showCustomApiKey)}
                                  className="p-1 hover:bg-gray-100 rounded transition"
                                  title={showCustomApiKey ? 'ซ่อน' : 'แสดง'}
                                >
                                  {showCustomApiKey ? (
                                    <EyeOff className="w-4 h-4 text-gray-500" />
                                  ) : (
                                    <Eye className="w-4 h-4 text-gray-500" />
                                  )}
                                </button>
                              )}
                              <Key className="w-4 h-4 text-gray-400" />
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">API Key สำหรับยืนยันตัวตน</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Model (optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., gpt-4-vision, azure-ocr-v3"
                            value={ocrSettings.custom_api_model}
                            onChange={(e) => setOcrSettings({...ocrSettings, custom_api_model: e.target.value})}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* OCR Processing Options - Tesseract Only */}
                {ocrSettings.mode === 'default' && (
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <SettingsIcon className="w-6 h-6 text-blue-600" />
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">ตัวเลือกการประมวลผล (Tesseract)</h2>
                        <p className="text-sm text-gray-500">กำหนดค่าการประมวลผลเอกสารสำหรับ Tesseract OCR</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Language */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ภาษาสำหรับ OCR
                        </label>
                        <select
                          value={ocrSettings.language}
                          onChange={(e) => setOcrSettings({...ocrSettings, language: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="tha+eng">ไทย + อังกฤษ (Thai + English)</option>
                          <option value="tha">ไทยอย่างเดียว (Thai only)</option>
                          <option value="eng">อังกฤษอย่างเดียว (English only)</option>
                          <option value="tha+eng+chi">ไทย + อังกฤษ + จีน</option>
                        </select>
                      </div>

                      {/* DPI */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ความละเอียด (DPI)
                        </label>
                        <select
                          value={ocrSettings.dpi}
                          onChange={(e) => setOcrSettings({...ocrSettings, dpi: parseInt(e.target.value)})}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value={150}>150 DPI (ประหยัดพื้นที่)</option>
                          <option value={200}>200 DPI</option>
                          <option value={300}>300 DPI (คุณภาพสูง)</option>
                          <option value={400}>400 DPI</option>
                          <option value={600}>600 DPI (คุณภาพสูงสุด)</option>
                        </select>
                      </div>
                    </div>

                    {/* Confidence Threshold */}
                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        เกณฑ์ความเชื่อมั่นขั้นต่ำ (%)
                      </label>
                      <input
                        type="range"
                        min="50"
                        max="95"
                        value={ocrSettings.confidence_threshold}
                        onChange={(e) => setOcrSettings({...ocrSettings, confidence_threshold: parseInt(e.target.value)})}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>50%</span>
                        <span className="font-medium text-blue-600">{ocrSettings.confidence_threshold}%</span>
                        <span>95%</span>
                      </div>
                    </div>

                    {/* Toggle Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t">
                      {[
                        { key: 'auto_rotate', label: 'หมุนเอกสารอัตโนมัติ', desc: 'ตรวจจับและหมุนเอกสารให้ถูกต้อง' },
                        { key: 'deskew', label: 'แก้ไขความเอียง', desc: 'ปรับแต่งเอกสารที่สแกนเอียง' },
                        { key: 'enhance_contrast', label: 'ปรับปรุงความคมชัด', desc: 'เพิ่มความคมชัดให้ข้อความชัดเจนขึ้น' },
                        { key: 'extract_tables', label: 'ดึงข้อมูลตาราง', desc: 'แยกและจัดรูปแบบตารางในเอกสาร' },
                      ].map((item) => (
                        <div key={item.key} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50">
                          <input
                            type="checkbox"
                            id={item.key}
                            checked={(ocrSettings as any)[item.key]}
                            onChange={(e) => setOcrSettings({...ocrSettings, [item.key]: e.target.checked})}
                            className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <label htmlFor={item.key} className="cursor-pointer">
                            <p className="font-medium text-gray-900">{item.label}</p>
                            <p className="text-sm text-gray-500">{item.desc}</p>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* OCR Template - LLM-based Engines Only (Typhoon & Custom) */}
                {(ocrSettings.mode === 'typhoon' || ocrSettings.mode === 'custom') && (
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <FileText className="w-6 h-6 text-purple-600" />
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">Prompt Template สำหรับ OCR</h2>
                        <p className="text-sm text-gray-500">Prompt ที่ส่งไปยัง LLM เพื่อกำหนดรูปแบบผลลัพธ์ที่ต้องการ</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          OCR Prompt Template
                        </label>
                        <textarea
                          value={ocrSettings.ocr_template}
                          onChange={(e) => setOcrSettings({...ocrSettings, ocr_template: e.target.value})}
                          rows={15}
                          className="w-full px-4 py-3 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          placeholder="ใส่ prompt template ที่ใช้ส่งไปยัง OCR API..."
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          ตัวแปรที่ใช้ได้: {'{image}'}, {'{language}'}, {'{contract_type}'}
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => setOcrSettings({...ocrSettings, ocr_template: `คุณเป็นระบบ OCR สำหรับเอกสารสัญญาภาครัฐ

กรุณาอ่านเอกสารที่ให้มาและสกัดข้อมูลตามโครงสร้างนี้:

1. เลขที่สัญญา: [contract_number]
2. ชื่อสัญญา: [title]
3. ผู้ว่าจ้าง: [employer]
4. ผู้รับจ้าง: [contractor]
5. มูลค่าสัญญา: [value] บาท
6. วันเริ่มต้น: [start_date]
7. วันสิ้นสุด: [end_date]
8. รายละเอียดงาน: [description]

หมายเหตุ: 
- ถ้าไม่พบข้อมูลให้ใส่ "-"
- วันที่ให้ใช้รูปแบบ YYYY-MM-DD
- มูลค่าให้ระบุเฉพาะตัวเลข ไม่ต้องใส่คำว่า "บาท"`})}
                          className="px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition"
                        >
                          รีเซ็ตเป็น Default
                        </button>
                        <button
                          onClick={() => navigator.clipboard.writeText(ocrSettings.ocr_template)}
                          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                        >
                          คัดลอก
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Test OCR */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <FileImage className="w-5 h-5 text-orange-600" />
                      <h3 className="font-semibold text-gray-900">ทดสอบ OCR</h3>
                    </div>
                    {ocrTestFile && (
                      <button
                        onClick={() => { setOcrTestFile(null); setOcrTestResult('') }}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        ล้างไฟล์
                      </button>
                    )}
                  </div>

                  {/* File Upload Area */}
                  <div 
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
                      ocrTestFile 
                        ? 'border-green-400 bg-green-50' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.tiff"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    
                    {ocrTestFile ? (
                      <div className="space-y-2">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                          <FileText className="w-6 h-6 text-green-600" />
                        </div>
                        <p className="font-medium text-gray-900">{ocrTestFile.name}</p>
                        <p className="text-sm text-gray-500">
                          {(ocrTestFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <>
                        <ScanLine className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 mb-2">ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</p>
                        <p className="text-sm text-gray-400">รองรับ PDF, PNG, JPG, TIFF (สูงสุด 10MB)</p>
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                        >
                          เลือกไฟล์
                        </button>
                      </>
                    )}
                  </div>

                  {/* Run OCR Buttons */}
                  {ocrTestFile && (
                    <div className="mt-4 space-y-3">
                      {/* Primary: Test with saved settings */}
                      <button
                        onClick={handleOcrTestWithSavedSettings}
                        disabled={ocrTestLoading}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
                      >
                        {ocrTestLoading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            กำลังประมวลผล OCR...
                          </>
                        ) : (
                          <>
                            <ScanLine className="w-5 h-5" />
                            ทดสอบด้วยการตั้งค่าที่บันทึก
                          </>
                        )}
                      </button>
                      
                      {/* Secondary: Test with current settings (custom) */}
                      <button
                        onClick={handleOcrTest}
                        disabled={ocrTestLoading}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 transition disabled:opacity-50"
                      >
                        <ScanLine className="w-5 h-5" />
                        ทดสอบด้วยการตั้งค่าชั่วคราว (ไม่บันทึก)
                      </button>
                    </div>
                  )}

                  {/* OCR Result */}
                  {ocrTestResult && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">ผลลัพธ์ OCR</h4>
                        <button
                          onClick={() => navigator.clipboard.writeText(ocrTestResult)}
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <Copy className="w-4 h-4" />
                          คัดลอก
                        </button>
                      </div>
                      <div className="bg-gray-50 border rounded-lg p-4 max-h-96 overflow-auto">
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                          {ocrTestResult}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveOcrSettings}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    <Save className="w-5 h-5" />
                    {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า OCR'}
                  </button>
                </div>
              </div>
            )}

            {/* AI Models */}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                {/* LLM Models Section */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Brain className="w-6 h-6 text-blue-600" />
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">LLM Models</h2>
                        <p className="text-sm text-gray-500">Language Models สำหรับสร้างข้อความและตอบคำถาม</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAddLLM(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <Plus className="w-4 h-4" />
                      เพิ่ม LLM Model
                    </button>
                  </div>

                  {/* LLM Provider Cards */}
                  <div className="space-y-3">
                    {aiProviders.filter(p => p.modelType === 'llm').map((provider) => (
                      <div
                        key={provider.id}
                        className={`p-4 rounded-xl border-2 transition ${
                          activeLLMId === provider.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => setActiveLLMId(provider.id)}
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                activeLLMId === provider.id
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300'
                              }`}
                            >
                              {activeLLMId === provider.id && (
                                <div className="w-2.5 h-2.5 bg-white rounded-full" />
                              )}
                            </button>
                            
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  provider.type === 'ollama' ? 'bg-orange-100 text-orange-700' :
                                  provider.type === 'vllm' ? 'bg-purple-100 text-purple-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {provider.type}
                                </span>
                                {provider.supportsGraphRAG && (
                                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
                                    GraphRAG
                                  </span>
                                )}
                                {activeLLMId === provider.id && (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                    กำลังใช้งาน
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 mt-1">{provider.url}</p>
                              <p className="text-sm text-gray-500">Model: {provider.model}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingProvider(provider)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition"
                              title="แก้ไข"
                            >
                              <Edit3 className="w-4 h-4 text-gray-500" />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(provider.id)}
                              className="p-2 hover:bg-red-50 rounded-lg transition"
                              title="ลบ"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Embedding Models Section */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">Embedding Models</h2>
                        <p className="text-sm text-gray-500">Models สำหรับ RAG / Vector Search และ GraphRAG</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAddEmbedding(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                      <Plus className="w-4 h-4" />
                      เพิ่ม Embedding Model
                    </button>
                  </div>

                  {/* Embedding Provider Cards */}
                  <div className="space-y-3">
                    {aiProviders.filter(p => p.modelType === 'embedding').map((provider) => (
                      <div
                        key={provider.id}
                        className={`p-4 rounded-xl border-2 transition ${
                          activeEmbeddingId === provider.id
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => setActiveEmbeddingId(provider.id)}
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                activeEmbeddingId === provider.id
                                  ? 'border-purple-500 bg-purple-500'
                                  : 'border-gray-300'
                              }`}
                            >
                              {activeEmbeddingId === provider.id && (
                                <div className="w-2.5 h-2.5 bg-white rounded-full" />
                              )}
                            </button>
                            
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  provider.type === 'ollama' ? 'bg-orange-100 text-orange-700' :
                                  provider.type === 'vllm' ? 'bg-purple-100 text-purple-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {provider.type}
                                </span>
                                {activeEmbeddingId === provider.id && (
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                    กำลังใช้งาน
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 mt-1">{provider.url}</p>
                              <p className="text-sm text-gray-500">Model: {provider.model}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingProvider(provider)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition"
                              title="แก้ไข"
                            >
                              <Edit3 className="w-4 h-4 text-gray-500" />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(provider.id)}
                              className="p-2 hover:bg-red-50 rounded-lg transition"
                              title="ลบ"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleSaveAiSettings}
                    disabled={saving}
                    className="mt-6 flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                  </button>
                </div>

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-red-100 rounded-full">
                          <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">ยืนยันการลบ</h3>
                      </div>
                      <p className="text-gray-600 mb-6">
                        คุณแน่ใจหรือไม่ว่าต้องการลบ Model นี้? การกระทำนี้ไม่สามารถย้อนกลับได้
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            const provider = aiProviders.find(p => p.id === showDeleteConfirm)
                            setAiProviders(aiProviders.filter(p => p.id !== showDeleteConfirm))
                            if (provider?.modelType === 'llm' && activeLLMId === showDeleteConfirm) {
                              const remainingLLMs = aiProviders.filter(p => p.modelType === 'llm' && p.id !== showDeleteConfirm)
                              setActiveLLMId(remainingLLMs[0]?.id || '')
                            }
                            if (provider?.modelType === 'embedding' && activeEmbeddingId === showDeleteConfirm) {
                              const remainingEmbeddings = aiProviders.filter(p => p.modelType === 'embedding' && p.id !== showDeleteConfirm)
                              setActiveEmbeddingId(remainingEmbeddings[0]?.id || '')
                            }
                            setShowDeleteConfirm(null)
                          }}
                          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                        >
                          ลบ
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add LLM Modal */}
                {showAddLLM && (
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-900">เพิ่ม LLM Model</h3>
                      <button
                        onClick={() => setShowAddLLM(false)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                      >
                        <XCircle className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>

                    <ProviderForm
                      initialData={null}
                      defaultModelType="llm"
                      onSave={(provider) => {
                        const newProvider = { ...provider, id: `provider-${Date.now()}` }
                        setAiProviders([...aiProviders, newProvider])
                        setActiveLLMId(newProvider.id)
                        setShowAddLLM(false)
                      }}
                      onCancel={() => setShowAddLLM(false)}
                    />
                  </div>
                )}

                {/* Add Embedding Modal */}
                {showAddEmbedding && (
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-900">เพิ่ม Embedding Model</h3>
                      <button
                        onClick={() => setShowAddEmbedding(false)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                      >
                        <XCircle className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>

                    <ProviderForm
                      initialData={null}
                      defaultModelType="embedding"
                      onSave={(provider) => {
                        const newProvider = { ...provider, id: `provider-${Date.now()}` }
                        setAiProviders([...aiProviders, newProvider])
                        setActiveEmbeddingId(newProvider.id)
                        setShowAddEmbedding(false)
                      }}
                      onCancel={() => setShowAddEmbedding(false)}
                    />
                  </div>
                )}

                {/* Edit Provider Modal */}
                {editingProvider && (
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-900">แก้ไข Model</h3>
                      <button
                        onClick={() => setEditingProvider(null)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                      >
                        <XCircle className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>

                    <ProviderForm
                      initialData={editingProvider}
                      defaultModelType={editingProvider.modelType}
                      onSave={(provider) => {
                        setAiProviders(aiProviders.map(p => p.id === provider.id ? provider : p))
                        setEditingProvider(null)
                      }}
                      onCancel={() => setEditingProvider(null)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* AI Features */}
            {activeTab === 'ai-features' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Sparkles className="w-6 h-6 text-yellow-500" />
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">AI Features</h2>
                      <p className="text-sm text-gray-500">เปิด/ปิด ฟีเจอร์การทำงานของ AI (ใช้กับทุก Model)</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      { key: 'auto_extract', label: 'ดึงข้อมูลอัตโนมัติ', desc: 'ดึงข้อมูลสำคัญจากสัญญาอัตโนมัติ' },
                      { key: 'smart_classification', label: 'จำแนกประเภทเอกสารอัจฉริยะ', desc: 'AI จำแนกประเภทสัญญาโดยอัตโนมัติ' },
                      { key: 'anomaly_detection', label: 'ตรวจจับความผิดปกติ', desc: 'ตรวจสอบข้อผิดพลาดและความผิดปกติในสัญญา' },
                      { key: 'contract_analysis', label: 'วิเคราะห์สัญญา', desc: 'วิเคราะห์ความเสี่ยงและข้อความสำคัญ' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between py-4 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-yellow-100 rounded-lg">
                            <Sparkles className="w-5 h-5 text-yellow-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{item.label}</p>
                            <p className="text-sm text-gray-500">{item.desc}</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(aiFeatures as any)[item.key]}
                            onChange={(e) => setAiFeatures({...aiFeatures, [item.key]: e.target.checked})}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">หมายเหตุ:</span> การตั้งค่าฟีเจอร์เหล่านี้จะใช้กับทุก AI Model ที่เลือกใช้งาน ไม่ว่าจะเป็น Ollama, vLLM หรือ OpenAI Compatible
                    </p>
                  </div>

                  <button
                    onClick={handleSaveAIFeatures}
                    disabled={saving}
                    className="mt-6 flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                  </button>
                </div>
              </div>
            )}

            {/* Agent Settings */}
            {activeTab === 'agents' && (
              <div className="space-y-6">
                {/* Agent List or Form */}
                {showAgentForm || editingAgent ? (
                  <AgentConfigForm
                    initialData={editingAgent || undefined}
                    onSave={editingAgent ? handleUpdateAgent : handleCreateAgent}
                    onCancel={() => {
                      setShowAgentForm(false)
                      setEditingAgent(null)
                    }}
                    knowledgeBases={knowledgeBases}
                    triggerEvents={triggerEvents}
                    outputActions={outputActions}
                    pages={agentPages}
                  />
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <Bot className="w-6 h-6 text-blue-600" />
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900">ตั้งค่า AI Agents</h2>
                          <p className="text-sm text-gray-500">จัดการ AI Agents ที่ใช้งานในระบบ</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowAgentForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        <Plus className="w-4 h-4" />
                        เพิ่ม Agent
                      </button>
                    </div>

                    <div className="space-y-4">
                      {agents.map((agent) => (
                        <div key={agent.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border hover:border-blue-300 transition">
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-lg ${
                              agent.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                            }`}>
                              <Bot className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-gray-900">{agent.name}</h3>
                                <span className={`px-2 py-0.5 text-xs rounded-full ${
                                  agent.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {agent.status === 'active' ? 'ทำงาน' : 'หยุด'}
                                </span>
                                {agent.is_system && (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                    System
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{agent.description}</p>
                              <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                                <span>Model: {agent.model}</span>
                                <span>•</span>
                                <span>Triggers: {agent.trigger_events?.join(', ') || 'manual'}</span>
                                <span>•</span>
                                <span>รัน {agent.execution_count || 0} ครั้ง</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setManagingTriggersFor(agent)}
                              className="p-2 hover:bg-purple-50 text-purple-600 rounded-lg transition"
                              title="จัดการ Triggers"
                            >
                              <Zap className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingAgent(agent)}
                              className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition"
                              title="แก้ไข"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleAgent(agent.id)}
                              className={`p-2 rounded-lg transition ${
                                agent.status === 'active' 
                                  ? 'hover:bg-yellow-50 text-yellow-600' 
                                  : 'hover:bg-green-50 text-green-600'
                              }`}
                              title={agent.status === 'active' ? 'หยุดการทำงาน' : 'เริ่มทำงาน'}
                            >
                              {agent.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                            {!agent.is_system && (
                              <button 
                                onClick={() => handleDeleteAgent(agent.id)}
                                className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition"
                                title="ลบ"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trigger Preset Selector Modal */}
                {managingTriggersFor && (
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Zap className="w-6 h-6 text-purple-600" />
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            ตั้งค่า Triggers: {managingTriggersFor.name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            เลือก Triggers ที่ต้องการให้ Agent ทำงาน
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setManagingTriggersFor(null)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <TriggerPresetSelector
                      presets={triggerPresets}
                      categories={triggerPresetCategories}
                      enabledPresets={managingTriggersFor.enabled_presets || []}
                      agentHasKB={(managingTriggersFor.knowledge_base_ids?.length || 0) > 0}
                      agentHasGraphRAG={managingTriggersFor.use_graphrag || false}
                      agentModel={managingTriggersFor.model || ''}
                      onTogglePreset={async (presetId, enabled) => {
                        try {
                          if (enabled) {
                            await enableAgentPreset(managingTriggersFor.id, presetId)
                          } else {
                            await disableAgentPreset(managingTriggersFor.id, presetId)
                          }
                          // Refresh agents to get updated enabled_presets
                          await fetchAgents()
                        } catch (err) {
                          console.error('Failed to toggle preset:', err)
                          alert('ไม่สามารถเปลี่ยนการตั้งค่าได้')
                        }
                      }}
                    />
                  </div>
                )}

                {/* Agent Configuration */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Settings2 className="w-5 h-5" />
                      การตั้งค่าทั่วไป
                    </h3>
                    <button
                      onClick={handleSaveAgentGlobalConfig}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b">
                      <div>
                        <p className="font-medium text-gray-900">Auto-execute Agents</p>
                        <p className="text-sm text-gray-500">ให้ Agents ทำงานอัตโนมัติเมื่อมีเอกสารใหม่</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={agentGlobalConfig.auto_execute}
                          onChange={(e) => setAgentGlobalConfig({...agentGlobalConfig, auto_execute: e.target.checked})}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b">
                      <div>
                        <p className="font-medium text-gray-900">Parallel Processing</p>
                        <p className="text-sm text-gray-500">ให้ Agents ทำงานพร้อมกันเพื่อความเร็ว</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={agentGlobalConfig.parallel_processing}
                          onChange={(e) => setAgentGlobalConfig({...agentGlobalConfig, parallel_processing: e.target.checked})}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-gray-900">Notification on Complete</p>
                        <p className="text-sm text-gray-500">แจ้งเตือนเมื่อ Agent ทำงานเสร็จ</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={agentGlobalConfig.notification_on_complete}
                          onChange={(e) => setAgentGlobalConfig({...agentGlobalConfig, notification_on_complete: e.target.checked})}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Knowledge Base Settings */}
            {activeTab === 'knowledge' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-6 h-6 text-blue-600" />
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">Knowledge Base (RAG)</h2>
                        <p className="text-sm text-gray-500">จัดการฐานความรู้สำหรับ AI Agents</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowKBForm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <Plus className="w-4 h-4" />
                      สร้าง Knowledge Base
                    </button>
                  </div>

                  {knowledgeBases.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
                      <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">ยังไม่มี Knowledge Base</h3>
                      <p className="text-gray-500 mb-4">สร้าง Knowledge Base เพื่อให้ AI Agents อ้างอิงข้อมูล</p>
                      <button 
                        onClick={() => setShowKBForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition mx-auto"
                      >
                        <Plus className="w-4 h-4" />
                        สร้าง Knowledge Base
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {knowledgeBases.map((kb) => (
                        <div 
                          key={kb.id} 
                          className="p-4 bg-gray-50 rounded-lg border hover:border-blue-300 transition"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 rounded-lg">
                                <BookOpen className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <h3 className="font-medium text-gray-900">{kb.name}</h3>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  kb.is_system ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {kb.is_system ? 'System' : (kb.kb_type || 'custom')}
                                </span>
                              </div>
                            </div>
                            {!kb.is_system && (
                              <button 
                                onClick={() => handleDeleteKnowledgeBase(kb.id)}
                                className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition"
                                title="ลบ"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mb-3 line-clamp-2">{kb.description || 'ไม่มีรายละเอียด'}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              {kb.document_count || 0} เอกสาร
                            </span>
                            {kb.is_indexed && (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                Indexed
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* KB Configuration Info */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Settings2 className="w-5 h-5" />
                    การตั้งค่า RAG
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b">
                      <div>
                        <p className="font-medium text-gray-900">Vector Store</p>
                        <p className="text-sm text-gray-500">ใช้ pgvector ในฐานข้อมูล PostgreSQL</p>
                      </div>
                      <span className="text-sm text-green-600 font-medium">พร้อมใช้งาน</span>
                    </div>
                    
                    {/* Embedding Model Selection */}
                    <div className="py-3 border-b">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">Embedding Model</p>
                          <p className="text-sm text-gray-500">โมเดลสำหรับแปลงข้อความเป็นเวกเตอร์</p>
                        </div>
                      </div>
                      <select
                        value={ragSettings.embeddingProviderId}
                        onChange={(e) => setRagSettings({...ragSettings, embeddingProviderId: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      >
                        <option value="">เลือก Embedding Model</option>
                        {aiProviders
                          .filter(p => p.modelType === 'embedding')
                          .map(provider => (
                            <option key={provider.id} value={provider.id}>
                              {provider.name} ({provider.model})
                            </option>
                          ))}
                      </select>
                      {ragSettings.embeddingProviderId && (
                        <p className="mt-1 text-xs text-gray-500">
                          {(() => {
                            const provider = aiProviders.find(p => p.id === ragSettings.embeddingProviderId)
                            return provider ? `Provider: ${provider.type} | Model: ${provider.model}` : ''
                          })()}
                        </p>
                      )}
                    </div>
                    
                    {/* Chunk Size Selection */}
                    <div className="py-3 border-b">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">Chunk Size</p>
                          <p className="text-sm text-gray-500">ขนาดของแต่ละส่วนที่แบ่งจากเอกสาร</p>
                        </div>
                      </div>
                      <select
                        value={ragSettings.chunkSize}
                        onChange={(e) => setRagSettings({...ragSettings, chunkSize: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      >
                        <option value={256}>256 tokens (เหมาะกับเอกสารสั้น)</option>
                        <option value={512}>512 tokens (ค่าเริ่มต้น)</option>
                        <option value={1024}>1024 tokens (เหมาะกับเอกสารยาว)</option>
                        <option value={2048}>2048 tokens (เอกสารที่ซับซ้อนมาก)</option>
                      </select>
                    </div>
                    
                    {/* Chunk Overlap Selection */}
                    <div className="py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">Chunk Overlap</p>
                          <p className="text-sm text-gray-500">จำนวน tokens ที่ทับซ้อนกันระหว่าง chunks</p>
                        </div>
                      </div>
                      <select
                        value={ragSettings.chunkOverlap}
                        onChange={(e) => setRagSettings({...ragSettings, chunkOverlap: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      >
                        <option value={0}>0 tokens (ไม่ทับซ้อน)</option>
                        <option value={25}>25 tokens</option>
                        <option value={50}>50 tokens (ค่าเริ่มต้น)</option>
                        <option value={100}>100 tokens</option>
                        <option value={200}>200 tokens (ทับซ้อนมาก - ความแม่นยำสูง)</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Save RAG Settings Button */}
                  <div className="mt-4 pt-4 border-t flex justify-end">
                    <button
                      onClick={async () => {
                        setSaving(true)
                        try {
                          await saveRagSettings(ragSettings)
                          setMessage({ type: 'success', text: 'บันทึกการตั้งค่า RAG สำเร็จ' })
                        } catch (err: any) {
                          setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถบันทึกได้' })
                        } finally {
                          setSaving(false)
                        }
                      }}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                    </button>
                  </div>
                </div>

                {/* Create Knowledge Base Modal */}
                {showKBForm && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">สร้าง Knowledge Base</h3>
                        <button 
                          onClick={() => setShowKBForm(false)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition"
                        >
                          <X className="w-5 h-5 text-gray-500" />
                        </button>
                      </div>
                      <form onSubmit={handleCreateKnowledgeBase} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            ชื่อ <span className="text-red-500">*</span>
                          </label>
                          <input
                            name="name"
                            type="text"
                            required
                            placeholder="เช่น ระเบียบจัดซื้อจัดจ้าง"
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            รายละเอียด
                          </label>
                          <textarea
                            name="description"
                            rows={3}
                            placeholder="อธิบายว่า Knowledge Base นี้มีข้อมูลอะไร"
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            ประเภท
                          </label>
                          <select
                            name="kb_type"
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="documents">เอกสารทั่วไป</option>
                            <option value="regulations">ระเบียบ/กฎหมาย</option>
                            <option value="templates">แม่แบบสัญญา</option>
                          </select>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                          <button
                            type="button"
                            onClick={() => setShowKBForm(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                          >
                            ยกเลิก
                          </button>
                          <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                          >
                            <Save className="w-4 h-4" />
                            {saving ? 'กำลังบันทึก...' : 'สร้าง'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* GraphRAG */}
            {activeTab === 'graphrag' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Workflow className="w-6 h-6 text-purple-600" />
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">GraphRAG</h2>
                        <p className="text-sm text-gray-500">Knowledge Graph สำหรับ AI Agents</p>
                      </div>
                    </div>
                  </div>

                  {/* Graph Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {graphStatsLoading ? <span className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> : graphStats.total_entities}
                      </p>
                      <p className="text-sm text-blue-600/70">Entities (สิ่ง)</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {graphStatsLoading ? <span className="inline-block w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" /> : graphStats.total_relationships}
                      </p>
                      <p className="text-sm text-green-600/70">ความสัมพันธ์</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        {graphStatsLoading ? <span className="inline-block w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" /> : graphStats.total_documents}
                      </p>
                      <p className="text-sm text-purple-600/70">เอกสาร</p>
                    </div>
                  </div>

                  {/* Graph Visualization */}
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-900 mb-3">มุมมองกราฟ Knowledge</h3>
                    <GraphVisualization height={400} />
                  </div>

                  {/* Entity Search */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-3">ค้นหา Entity</h3>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={entitySearchQuery}
                        onChange={(e) => setEntitySearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleEntitySearch()}
                        placeholder="ค้นหา บุคคล, องค์กร, สัญญา..."
                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                      <button
                        onClick={handleEntitySearch}
                        disabled={entitySearchLoading}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-2"
                      >
                        {entitySearchLoading ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : null}
                        ค้นหา
                      </button>
                    </div>
                    {entitySearchResults.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {entitySearchResults.map((entity: any) => (
                          <div key={entity.id} className="flex items-center justify-between p-2 bg-white rounded border">
                            <div>
                              <span className="font-medium text-gray-900">{entity.name}</span>
                              <span className="ml-2 text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">{entity.type}</span>
                            </div>
                            <span className="text-xs text-gray-400">{(entity.confidence * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {entitySearchResults.length === 0 && entitySearchQuery && !entitySearchLoading && (
                      <p className="mt-2 text-sm text-gray-500">ไม่พบ Entity ที่ตรงกับ "{entitySearchQuery}"</p>
                    )}
                  </div>
                </div>

                {/* Graph Extraction Settings */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Cpu className="w-5 h-5" />
                    การสกัด Entity
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b">
                      <div>
                        <p className="font-medium text-gray-900">สกัดอัตโนมัติตอนอัพโหลด</p>
                        <p className="text-sm text-gray-500">สกัด entities อัตโนมัติเมื่ออัพโหลดเอกสารใหม่</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={graphragSettings.auto_extract_on_upload}
                          onChange={(e) => setGraphragSettings({ ...graphragSettings, auto_extract_on_upload: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b">
                      <div>
                        <p className="font-medium text-gray-900">สกัดความสัมพันธ์</p>
                        <p className="text-sm text-gray-500">สกัดความสัมพันธ์ระหว่าง entities</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={graphragSettings.extract_relationships}
                          onChange={(e) => setGraphragSettings({ ...graphragSettings, extract_relationships: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-gray-900">ความมั่นใจขั้นต่ำ</p>
                        <p className="text-sm text-gray-500">ค่าความมั่นใจขั้นต่ำสำหรับยอมรับ entity (0.5-0.9)</p>
                      </div>
                      <input
                        type="number"
                        min="0.5"
                        max="0.9"
                        step="0.1"
                        value={graphragSettings.min_confidence}
                        onChange={(e) => setGraphragSettings({ ...graphragSettings, min_confidence: parseFloat(e.target.value) })}
                        className="w-20 px-3 py-2 border rounded-lg text-center"
                      />
                    </div>
                  </div>

                  {/* Save GraphRAG Settings */}
                  <div className="mt-4 pt-4 border-t flex justify-end">
                    <button
                      onClick={async () => {
                        setSaving(true)
                        try {
                          await saveGraphRAGSettings(graphragSettings)
                          setMessage({ type: 'success', text: 'บันทึกการตั้งค่า GraphRAG สำเร็จ' })
                        } catch (err: any) {
                          setMessage({ type: 'error', text: err.response?.data?.detail || 'ไม่สามารถบันทึกได้' })
                        } finally {
                          setSaving(false)
                        }
                      }}
                      disabled={saving}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า GraphRAG'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Organization Structure */}
            {activeTab === 'org-structure' && (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg text-center">
                    {orgLoading ? <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" /> : <p className="text-2xl font-bold text-blue-600">{orgStats.total_units}</p>}
                    <p className="text-sm text-blue-600/70 mt-1">หน่วยงาน</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg text-center">
                    {orgLoading ? <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin mx-auto" /> : <p className="text-2xl font-bold text-green-600">{orgStats.total_positions}</p>}
                    <p className="text-sm text-green-600/70 mt-1">ตำแหน่ง</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg text-center">
                    {orgLoading ? <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto" /> : <p className="text-2xl font-bold text-purple-600">{orgStats.users_with_org_assignment}</p>}
                    <p className="text-sm text-purple-600/70 mt-1">ผู้ใช้ในหน่วยงาน</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg text-center">
                    {orgLoading ? <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto" /> : <p className="text-2xl font-bold text-orange-600">{Object.keys(orgStats.units_by_level).length}</p>}
                    <p className="text-sm text-orange-600/70 mt-1">ระดับ</p>
                  </div>
                </div>

                {/* Organization Tree */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <FolderTree className="w-6 h-6 text-blue-600" />
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">โครงสร้างองค์กร</h2>
                        <p className="text-sm text-gray-500">กระทรวง &gt; กรม &gt; สำนัก/กอง &gt; งาน/ฝ่าย</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowOrgUnitForm(!showOrgUnitForm)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <Plus className="w-4 h-4" />
                      เพิ่มหน่วยงาน
                    </button>
                  </div>

                  {/* Add unit form */}
                  {showOrgUnitForm && (
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-3">เพิ่มหน่วยงานใหม่</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">รหัสหน่วยงาน *</label>
                          <input type="text" value={newOrgUnitForm.code} onChange={(e) => setNewOrgUnitForm({ ...newOrgUnitForm, code: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="เช่น DEPT001" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">ชื่อ (ไทย) *</label>
                          <input type="text" value={newOrgUnitForm.name_th} onChange={(e) => setNewOrgUnitForm({ ...newOrgUnitForm, name_th: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="ชื่อหน่วยงาน" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">ชื่อ (อังกฤษ)</label>
                          <input type="text" value={newOrgUnitForm.name_en} onChange={(e) => setNewOrgUnitForm({ ...newOrgUnitForm, name_en: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="Department Name" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">ระดับ</label>
                          <select value={newOrgUnitForm.level} onChange={(e) => setNewOrgUnitForm({ ...newOrgUnitForm, level: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                            {Object.entries(orgLevelLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={handleCreateOrgUnit} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                        <button onClick={() => setShowOrgUnitForm(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">ยกเลิก</button>
                      </div>
                    </div>
                  )}

                  {/* Tree View */}
                  <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                    {orgLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
                        <span className="text-gray-500">กำลังโหลด...</span>
                      </div>
                    ) : orgTree.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        <p>ยังไม่มีข้อมูลโครงสร้างองค์กร</p>
                        <p className="text-sm mt-1">เริ่มต้นโดยการเพิ่มหน่วยงานระดับบน (กระทรวง/สำนักงาน)</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {orgTree.map((node) => {
                          const renderNode = (n: any, depth: number): React.ReactNode => {
                            const levelColorMap: Record<string, string> = {
                              ministry: 'border-purple-200 bg-purple-50 text-purple-700',
                              department: 'border-blue-200 bg-blue-50 text-blue-700',
                              bureau: 'border-green-200 bg-green-50 text-green-700',
                              division: 'border-yellow-200 bg-yellow-50 text-yellow-700',
                              section: 'border-orange-200 bg-orange-50 text-orange-700',
                              unit: 'border-gray-200 bg-gray-50 text-gray-700',
                            }
                            const color = levelColorMap[n.level] || 'border-gray-200 bg-gray-50 text-gray-700'
                            return (
                              <div key={n.id} style={{ marginLeft: `${depth * 20}px` }}>
                                <div className={`flex items-center gap-2 p-2 rounded-lg border ${color} mb-1`}>
                                  {n.children?.length > 0 ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-0" />}
                                  <Building2 className="w-4 h-4 flex-shrink-0" />
                                  <span className="font-medium text-sm flex-1">{n.name_th}</span>
                                  <span className="text-xs px-2 py-0.5 bg-white/70 rounded-full border">{orgLevelLabels[n.level] || n.level}</span>
                                  <span className="text-xs opacity-70">{n.user_count} คน</span>
                                </div>
                                {n.children?.map((child: any) => renderNode(child, depth + 1))}
                              </div>
                            )
                          }
                          return renderNode(node, 0)
                        })}
                      </div>
                    )}
                  </div>

                  {/* Level Legend */}
                  <div className="mt-4 flex flex-wrap gap-3 text-xs">
                    {Object.entries(orgLevelLabels).map(([level, label]) => {
                      const dotColors: Record<string, string> = { ministry: 'bg-purple-600', department: 'bg-blue-600', bureau: 'bg-green-600', division: 'bg-yellow-600', section: 'bg-orange-600', unit: 'bg-gray-600' }
                      return (
                        <div key={level} className="flex items-center gap-1.5">
                          <div className={`w-2.5 h-2.5 rounded ${dotColors[level] || 'bg-gray-600'}`}></div>
                          <span className="text-gray-600">{label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Positions */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <UserCog className="w-6 h-6 text-blue-600" />
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">ตำแหน่ง</h2>
                        <p className="text-sm text-gray-500">จัดการตำแหน่งในองค์กร</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowPositionForm(!showPositionForm)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <Plus className="w-4 h-4" />
                      เพิ่มตำแหน่ง
                    </button>
                  </div>

                  {/* Add position form */}
                  {showPositionForm && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-3">เพิ่มตำแหน่งใหม่</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">รหัสตำแหน่ง *</label>
                          <input type="text" value={newPositionForm.code} onChange={(e) => setNewPositionForm({ ...newPositionForm, code: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="เช่น POS001" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">ชื่อตำแหน่ง (ไทย) *</label>
                          <input type="text" value={newPositionForm.name_th} onChange={(e) => setNewPositionForm({ ...newPositionForm, name_th: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="ชื่อตำแหน่ง" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">สายงาน</label>
                          <select value={newPositionForm.career_track} onChange={(e) => setNewPositionForm({ ...newPositionForm, career_track: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                            {Object.entries(careerTrackLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">ระดับ (1-10)</label>
                          <input type="number" min={1} max={10} value={newPositionForm.level} onChange={(e) => setNewPositionForm({ ...newPositionForm, level: parseInt(e.target.value) || 3 })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={newPositionForm.is_management} onChange={(e) => setNewPositionForm({ ...newPositionForm, is_management: e.target.checked })} className="w-4 h-4 rounded" />
                          ตำแหน่งบริหาร
                        </label>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={handleCreatePosition} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                        <button onClick={() => setShowPositionForm(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">ยกเลิก</button>
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-gray-700">รหัส</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">ชื่อตำแหน่ง</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">ระดับ</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">สังกัด</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">สายงาน</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">ผู้ใช้</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orgLoading ? (
                          <tr><td colSpan={6} className="py-8 text-center text-gray-400">กำลังโหลด...</td></tr>
                        ) : orgPositions.length === 0 ? (
                          <tr><td colSpan={6} className="py-8 text-center text-gray-400">ยังไม่มีข้อมูลตำแหน่ง</td></tr>
                        ) : (
                          orgPositions.map((pos) => (
                            <tr key={pos.id} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-4 font-mono text-sm text-gray-600">{pos.code}</td>
                              <td className="py-3 px-4">
                                <p className="font-medium text-gray-900">{pos.name_th}</p>
                                {pos.name_en && <p className="text-xs text-gray-500">{pos.name_en}</p>}
                              </td>
                              <td className="py-3 px-4 text-gray-600">{pos.level}</td>
                              <td className="py-3 px-4 text-gray-600">{pos.org_unit_name || '-'}</td>
                              <td className="py-3 px-4">
                                {pos.career_track ? (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                    {careerTrackLabels[pos.career_track] || pos.career_track}
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="py-3 px-4 text-gray-600">{pos.user_count}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* User Management */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Users className="w-6 h-6 text-blue-600" />
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">จัดการผู้ใช้</h2>
                        <p className="text-sm text-gray-500">จัดการบัญชีผู้ใช้และสิทธิ์การใช้งาน</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowUserForm(!showUserForm)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <UserPlus className="w-4 h-4" />
                      เพิ่มผู้ใช้
                    </button>
                  </div>

                  {/* Add user form */}
                  {showUserForm && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-3">เพิ่มผู้ใช้ใหม่</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">ชื่อผู้ใช้ *</label>
                          <input type="text" value={newUserForm.username} onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="username" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">อีเมล *</label>
                          <input type="email" value={newUserForm.email} onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="email@gov.th" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">รหัสผ่าน *</label>
                          <input type="password" value={newUserForm.password} onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="อย่างน้อย 8 ตัว" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">ชื่อ</label>
                          <input type="text" value={newUserForm.first_name} onChange={(e) => setNewUserForm({ ...newUserForm, first_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="ชื่อ" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">นามสกุล</label>
                          <input type="text" value={newUserForm.last_name} onChange={(e) => setNewUserForm({ ...newUserForm, last_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="นามสกุล" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">ตำแหน่ง</label>
                          <input type="text" value={newUserForm.title} onChange={(e) => setNewUserForm({ ...newUserForm, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="ตำแหน่งงาน" />
                        </div>
                        {userRoles.length > 0 && (
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">บทบาท</label>
                            <div className="flex flex-wrap gap-2">
                              {userRoles.map((role) => (
                                <label key={role.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={newUserForm.role_ids.includes(role.id)}
                                    onChange={(e) => {
                                      const ids = e.target.checked
                                        ? [...newUserForm.role_ids, role.id]
                                        : newUserForm.role_ids.filter(id => id !== role.id)
                                      setNewUserForm({ ...newUserForm, role_ids: ids })
                                    }}
                                    className="w-3.5 h-3.5 rounded"
                                  />
                                  {role.name}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={handleCreateUser} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                          {saving ? 'กำลังบันทึก...' : 'สร้างผู้ใช้'}
                        </button>
                        <button onClick={() => setShowUserForm(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">ยกเลิก</button>
                      </div>
                    </div>
                  )}

                  {/* User Stats */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      {usersLoading ? <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" /> : <p className="text-2xl font-bold text-blue-600">{userStats.total}</p>}
                      <p className="text-sm text-blue-600/70 mt-1">ผู้ใช้ทั้งหมด</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                      {usersLoading ? <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin mx-auto" /> : <p className="text-2xl font-bold text-green-600">{userStats.active}</p>}
                      <p className="text-sm text-green-600/70 mt-1">กำลังใช้งาน</p>
                    </div>
                    <div className="p-4 bg-yellow-50 rounded-lg text-center">
                      {usersLoading ? <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto" /> : <p className="text-2xl font-bold text-yellow-600">{userStats.pending}</p>}
                      <p className="text-sm text-yellow-600/70 mt-1">รอการยืนยัน</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg text-center">
                      {usersLoading ? <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin mx-auto" /> : <p className="text-2xl font-bold text-red-600">{userStats.suspended}</p>}
                      <p className="text-sm text-red-600/70 mt-1">ถูกระงับ</p>
                    </div>
                  </div>

                  {/* User List */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-gray-700">ผู้ใช้</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">ตำแหน่ง</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">สิทธิ์</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">สถานะ</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">เข้าสู่ระบบล่าสุด</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersLoading ? (
                          <tr><td colSpan={6} className="py-8 text-center text-gray-400">กำลังโหลด...</td></tr>
                        ) : userList.length === 0 ? (
                          <tr><td colSpan={6} className="py-8 text-center text-gray-400">ยังไม่มีผู้ใช้ในระบบ</td></tr>
                        ) : (
                          userList.map((u) => (
                            <tr key={u.id} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <User className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">{u.full_name || u.username}</p>
                                    <p className="text-xs text-gray-500">{u.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-gray-600 text-sm">{u.title || u.department || '-'}</td>
                              <td className="py-3 px-4">
                                <div className="flex flex-wrap gap-1">
                                  {u.is_superuser ? (
                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">Super Admin</span>
                                  ) : u.role_names?.length > 0 ? (
                                    u.role_names.map((rn, i) => (
                                      <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{rn}</span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-gray-400">ไม่มีบทบาท</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                {u.status === 'active' ? (
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                    <span className="text-sm text-gray-600">ใช้งาน</span>
                                  </span>
                                ) : u.status === 'inactive' ? (
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                                    <span className="text-sm text-gray-500">ระงับ</span>
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                                    <span className="text-sm text-gray-500">{u.status}</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-xs text-gray-500">
                                {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('th-TH') : '-'}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1">
                                  {u.status === 'active' && (
                                    <button
                                      onClick={() => handleDeactivateUser(u.id, u.username)}
                                      className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition"
                                      title="ระงับผู้ใช้"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Role Management */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <UserCog className="w-5 h-5" />
                    บทบาทในระบบ (Roles)
                  </h3>
                  {usersLoading ? (
                    <div className="text-center py-4 text-gray-400">กำลังโหลด...</div>
                  ) : userRoles.length === 0 ? (
                    <div className="text-center py-4 text-gray-400">ยังไม่มีข้อมูลบทบาท</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {userRoles.map((role) => (
                        <div key={role.id} className="p-4 border rounded-lg hover:border-blue-300 transition">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-5 h-5 text-blue-600" />
                            <h4 className="font-medium text-gray-900">{role.name}</h4>
                            {role.is_system && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">ระบบ</span>}
                          </div>
                          <p className="text-sm text-gray-500 mb-2">{role.description || '-'}</p>
                          <p className="text-xs text-gray-400">{role.user_count} ผู้ใช้</p>
                          <p className="text-xs text-gray-400 mt-1">{role.permissions.length} สิทธิ์</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notifications */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Bell className="w-6 h-6 text-blue-600" />
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">การแจ้งเตือน</h2>
                      <p className="text-sm text-gray-500">ตั้งค่าการแจ้งเตือนส่วนตัวและระดับองค์กร</p>
                    </div>
                  </div>
                  
                  <NotificationSettings userRole={user?.role || 'user'} />
                </div>
              </div>
            )}

            {/* Contract Templates */}
            {activeTab === 'templates' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <FileStack className="w-6 h-6 text-blue-600" />
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">ตัวอย่างสัญญา (Templates)</h2>
                        <p className="text-sm text-gray-500">จัดการแม่แบบสัญญาสำหรับใช้งานซ้ำ</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowCreateTemplate(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <Plus className="w-4 h-4" />
                      สร้าง Template ใหม่
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {templates.map((template) => (
                      <div 
                        key={template.id} 
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition ${
                          selectedTemplateId === template.id 
                            ? 'border-blue-500 bg-blue-50 shadow-sm' 
                            : 'hover:border-blue-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-lg ${
                            selectedTemplateId === template.id ? 'bg-blue-200' : 'bg-blue-100'
                          }`}>
                            <Copy className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-gray-900">{template.name}</h3>
                              {template.isDefault && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                  ค่าเริ่มต้น
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {template.clauses} ข้อ
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                ใช้ล่าสุด: {template.lastUsed}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                template.type === 'procurement' ? 'bg-green-100 text-green-700' :
                                template.type === 'construction' ? 'bg-orange-100 text-orange-700' :
                                template.type === 'service' ? 'bg-blue-100 text-blue-700' :
                                template.type === 'consultant' ? 'bg-purple-100 text-purple-700' :
                                template.type === 'rental' ? 'bg-yellow-100 text-yellow-700' :
                                template.type === 'concession' ? 'bg-red-100 text-red-700' :
                                template.type === 'software' ? 'bg-indigo-100 text-indigo-700' :
                                template.type === 'energy' ? 'bg-amber-100 text-amber-700' :
                                template.type === 'logistics' ? 'bg-cyan-100 text-cyan-700' :
                                template.type === 'security' ? 'bg-rose-100 text-rose-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {template.type === 'procurement' ? 'จัดซื้อ' :
                                 template.type === 'construction' ? 'ก่อสร้าง' :
                                 template.type === 'service' ? 'บริการ' :
                                 template.type === 'consultant' ? 'ที่ปรึกษา' :
                                 template.type === 'rental' ? 'เช่า' :
                                 template.type === 'concession' ? 'สัมปทาน' :
                                 template.type === 'maintenance' ? 'ซ่อม' :
                                 template.type === 'training' ? 'อบรม' :
                                 template.type === 'research' ? 'วิจัย' :
                                 template.type === 'software' ? 'ไอที' :
                                 template.type === 'land_sale' ? 'ที่ดิน' :
                                 template.type === 'insurance' ? 'ประกัน' :
                                 template.type === 'advertising' ? 'โฆษณา' :
                                 template.type === 'medical' ? 'สาธารณสุข' :
                                 template.type === 'agriculture' ? 'เกษตร' :
                                 template.type === 'energy' ? 'พลังงาน' :
                                 template.type === 'logistics' ? 'ขนส่ง' :
                                 template.type === 'waste_management' ? 'ขยะ' :
                                 template.type === 'water_management' ? 'น้ำ' :
                                 template.type === 'catering' ? 'อาหาร' :
                                 template.type === 'security' ? 'รปภ.' :
                                 template.type === 'cleaning' ? 'ทำความสะอาด' :
                                 template.type === 'printing' ? 'พิมพ์' :
                                 template.type === 'telecom' ? 'โทรคมฯ' :
                                 template.type === 'survey' ? 'สำรวจ' : template.type}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div 
                          className="flex items-center gap-2" 
                          style={{ pointerEvents: 'auto' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSetDefaultTemplate(template.id)
                            }}
                            className={`p-2 rounded-lg transition ${
                              template.isDefault ? 'text-blue-600 bg-blue-50' : 'hover:bg-gray-100 text-gray-400'
                            }`}
                            title="ตั้งเป็นค่าเริ่มต้น"
                            style={{ pointerEvents: 'auto', position: 'relative', zIndex: 10 }}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedTemplateId(template.id)
                            }}
                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition" 
                            title="ดูตัวอย่าง"
                            style={{ pointerEvents: 'auto', position: 'relative', zIndex: 10 }}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {!template.isSystem && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteTemplate(template.id)
                              }}
                              className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition"
                              title="ลบ"
                              style={{ pointerEvents: 'auto', position: 'relative', zIndex: 10 }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Template Preview Section */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">ตัวอย่าง Template ที่เลือก</h3>
                    {selectedTemplate && (
                      <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
                        <Copy className="w-4 h-4" />
                        ใช้ Template นี้
                      </button>
                    )}
                  </div>
                  
                  {selectedTemplate ? (
                    <div className="bg-gray-50 rounded-lg p-6 border">
                      <h4 className="text-lg font-bold text-gray-900 text-center mb-6">
                        {selectedTemplate.name}
                      </h4>
                      <div className="space-y-4">
                        {selectedTemplate.clauses_data ? (
                          selectedTemplate.clauses_data.map((clause, idx) => (
                            <div key={idx} className="flex gap-3">
                              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                                {clause.number}
                              </span>
                              <div>
                                <p className="font-medium text-gray-900">{clause.title}</p>
                                <p className="text-gray-700 leading-relaxed text-sm">{clause.content}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500 text-center">ไม่มีข้อมูลเนื้อหา Template</p>
                        )}
                      </div>
                      <div className="mt-6 pt-4 border-t text-center">
                        <p className="text-sm text-gray-500 italic">
                          ... (เนื้อหาสัญญาฉบับสมบูรณ์มี {selectedTemplate.clauses} ข้อ)
                        </p>
                        {selectedTemplate.description && (
                          <p className="text-sm text-gray-600 mt-2">{selectedTemplate.description}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">คลิกที่ Template ด้านบนเพื่อดูตัวอย่างเนื้อหา</p>
                    </div>
                  )}
                </div>
              </div>
          )}

            {/* Storage Settings - พื้นที่จัดเก็บสัญญา */}
            {activeTab === 'storage' && (
              <div className="space-y-6">
                <StorageSettings />
              </div>
            )}
          </div>
        </div>

        {showCreateTemplate ? (
          <CreateTemplate
            onClose={() => setShowCreateTemplate(false)}
            onSuccess={handleTemplateSuccess}
          />
        ) : null}
      </main>
    </div>
  )
}

// Storage Settings Component - 2 Sections: MinIO (Files) & RAG (Content)
function StorageSettings() {
  const [activeStorageTab, setActiveStorageTab] = useState<'minio' | 'rag'>('minio')
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  
  // MinIO State - เก็บไฟล์ตัวจริง
  const [minioStats, setMinioStats] = useState({
    totalSize: 0,
    documentCount: 0,
    bucketName: 'govplatform',
    endpoint: 'minio:9000'
  })
  const [minioConfig, setMinioConfig] = useState({
    type: 'minio',
    bucket: 'govplatform',
    endpoint: 'minio:9000',
    accessKey: '',
    secretKey: '',
    secure: false
  })
  const [showMinioKeys, setShowMinioKeys] = useState(false)
  const [minioLoading, setMinioLoading] = useState(true)
  
  // RAG State - เก็บ content ที่ได้จากการประมวลผล
  const [ragStats, setRagStats] = useState({
    totalChunks: 0,
    totalEmbeddings: 0,
    vectorSize: 0,
    lastSync: null as string | null
  })
  const [ragConfig, setRagConfig] = useState({
    enabled: true,
    provider: 'pgvector', // pgvector, elasticsearch, pinecone, chroma
    indexName: 'contract_embeddings',
    chunkSize: 512,
    chunkOverlap: 50,
    embeddingModel: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
    dimension: 384,
    // For external vector DBs
    apiKey: '',
    endpoint: '',
    environment: ''
  })
  const [showRagKey, setShowRagKey] = useState(false)
  const [ragLoading, setRagLoading] = useState(true)
  
  // Common Retention Settings
  const [retentionDays, setRetentionDays] = useState(2555) // 7 years default
  const [autoCleanup, setAutoCleanup] = useState(false)

  // File List Modal State
  const [showFileModal, setShowFileModal] = useState(false)
  const [fileList, setFileList] = useState<Array<{
    id: string
    filename: string
    document_type: string
    file_size: number
    created_at: string
    contract_name?: string
    ocr_status: string
  }>>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [fileListLoading, setFileListLoading] = useState(false)
  const [fileListPage, setFileListPage] = useState(1)
  const [fileListTotal, setFileListTotal] = useState(0)
  const [actionLoading, setActionLoading] = useState<string | null>(null) // file_id being processed
  const FILE_LIST_LIMIT = 20

  useEffect(() => {
    fetchMinioStats()
    fetchRagStats()
  }, [])

  const fetchMinioStats = async () => {
    setMinioLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/v1/admin/storage/minio/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.status === 403) {
        setMessage({ type: 'error', text: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' })
        setTimeout(() => window.location.href = '/login', 2000)
        return
      }
      if (response.ok) {
        const data = await response.json()
        setMinioStats(data)
      } else {
        setMessage({ type: 'error', text: 'ไม่สามารถโหลดข้อมูล MinIO ได้' })
      }
    } catch (err) {
      console.error('Failed to fetch MinIO stats:', err)
      setMessage({ type: 'error', text: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้' })
    } finally {
      setMinioLoading(false)
    }
  }

  const fetchRagStats = async () => {
    setRagLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/v1/admin/storage/rag/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.status === 403) {
        setMessage({ type: 'error', text: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' })
        setTimeout(() => window.location.href = '/login', 2000)
        return
      }
      if (response.ok) {
        const data = await response.json()
        setRagStats(data)
      } else {
        setMessage({ type: 'error', text: 'ไม่สามารถโหลดข้อมูล RAG ได้' })
      }
    } catch (err) {
      console.error('Failed to fetch RAG stats:', err)
    } finally {
      setRagLoading(false)
    }
  }

  const handleSaveMinioConfig = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/v1/admin/storage/minio/config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(minioConfig)
      })
      if (response.status === 403) {
        setMessage({ type: 'error', text: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' })
        setTimeout(() => window.location.href = '/login', 2000)
        return
      }
      if (response.ok) {
        setMessage({ type: 'success', text: 'บันทึกการตั้งค่า MinIO สำเร็จ' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: 'ไม่สามารถบันทึกการตั้งค่า MinIO ได้' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' })
    }
  }

  const handleSaveRagConfig = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/v1/admin/storage/rag/config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(ragConfig)
      })
      if (response.status === 403) {
        setMessage({ type: 'error', text: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' })
        setTimeout(() => window.location.href = '/login', 2000)
        return
      }
      if (response.ok) {
        setMessage({ type: 'success', text: 'บันทึกการตั้งค่า RAG Storage สำเร็จ' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: 'ไม่สามารถบันทึกการตั้งค่า RAG ได้' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' })
    }
  }

  const handleTestMinioConnection = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/v1/admin/storage/minio/test', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(minioConfig)
      })
      if (response.status === 403) {
        setMessage({ type: 'error', text: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' })
        setTimeout(() => window.location.href = '/login', 2000)
        return
      }
      if (response.ok) {
        setMessage({ type: 'success', text: 'ทดสอบการเชื่อมต่อ MinIO สำเร็จ' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        const data = await response.json()
        setMessage({ type: 'error', text: data.message || 'ไม่สามารถเชื่อมต่อ MinIO ได้' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ MinIO' })
    }
  }

  const handleTestRagConnection = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/v1/admin/storage/rag/test', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(ragConfig)
      })
      if (response.status === 403) {
        setMessage({ type: 'error', text: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' })
        setTimeout(() => window.location.href = '/login', 2000)
        return
      }
      if (response.ok) {
        setMessage({ type: 'success', text: 'ทดสอบการเชื่อมต่อ RAG Storage สำเร็จ' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        const data = await response.json()
        setMessage({ type: 'error', text: data.message || 'ไม่สามารถเชื่อมต่อ RAG Storage ได้' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ RAG' })
    }
  }

  const handleSyncRag = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/v1/admin/storage/rag/sync', { 
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.status === 403) {
        setMessage({ type: 'error', text: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' })
        setTimeout(() => window.location.href = '/login', 2000)
        return
      }
      if (response.ok) {
        setMessage({ type: 'success', text: 'เริ่มการซิงค์ข้อมูล RAG แล้ว' })
        setTimeout(() => setMessage(null), 3000)
        fetchRagStats()
      } else {
        setMessage({ type: 'error', text: 'ไม่สามารถซิงค์ข้อมูลได้' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการซิงค์' })
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // File List Functions
  const fetchFileList = async (page = 1) => {
    setFileListLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`/api/v1/admin/storage/minio/files?page=${page}&limit=${FILE_LIST_LIMIT}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.status === 403) {
        setMessage({ type: 'error', text: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' })
        setTimeout(() => window.location.href = '/login', 2000)
        return
      }
      if (response.ok) {
        const data = await response.json()
        setFileList(data.files || [])
        setFileListTotal(data.total || 0)
        setFileListPage(page)
      } else {
        setMessage({ type: 'error', text: 'ไม่สามารถโหลดรายการไฟล์ได้' })
      }
    } catch (err) {
      console.error('Failed to fetch file list:', err)
      setMessage({ type: 'error', text: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้' })
    } finally {
      setFileListLoading(false)
    }
  }

  const openFileModal = () => {
    setShowFileModal(true)
    setSelectedFiles(new Set())
    fetchFileList(1)
  }

  const closeFileModal = () => {
    setShowFileModal(false)
    setSelectedFiles(new Set())
    setFileList([])
  }

  const toggleFileSelection = (fileId: string) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId)
    } else {
      newSelected.add(fileId)
    }
    setSelectedFiles(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedFiles.size === fileList.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(fileList.map(f => f.id)))
    }
  }

  const handleDeleteSelectedFiles = async () => {
    if (selectedFiles.size === 0) return
    
    if (!confirm(`คุณต้องการลบไฟล์ที่เลือก ${selectedFiles.size} รายการใช่หรือไม่?`)) {
      return
    }

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/v1/admin/storage/minio/files/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ file_ids: Array.from(selectedFiles) })
      })

      if (response.status === 403) {
        setMessage({ type: 'error', text: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' })
        setTimeout(() => window.location.href = '/login', 2000)
        return
      }

      if (response.ok) {
        const result = await response.json()
        setMessage({ type: 'success', text: `ลบสำเร็จ ${result.deleted_count || selectedFiles.size} รายการ` })
        setSelectedFiles(new Set())
        fetchFileList(fileListPage)
        fetchMinioStats() // Refresh stats
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: 'ไม่สามารถลบไฟล์ได้' })
      }
    } catch (err) {
      console.error('Failed to delete files:', err)
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการลบไฟล์' })
    }
  }

  // Re-process OCR for a file
  const handleReprocessFile = async (fileId: string) => {
    setActionLoading(fileId)
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`/api/v1/admin/storage/minio/files/${fileId}/reprocess`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.status === 403) {
        setMessage({ type: 'error', text: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' })
        setTimeout(() => window.location.href = '/login', 2000)
        return
      }

      if (response.ok) {
        const result = await response.json()
        setMessage({ type: 'success', text: `ส่งไฟล์ไปประมวลผลใหม่แล้ว (Task: ${result.task_id?.slice(0, 8)}...)` })
        // Refresh file list after a short delay
        setTimeout(() => fetchFileList(fileListPage), 1000)
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.detail || 'ไม่สามารถประมวลผลไฟล์ได้' })
      }
    } catch (err) {
      console.error('Failed to reprocess file:', err)
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการประมวลผลไฟล์' })
    } finally {
      setActionLoading(null)
    }
  }

  // Create GraphRAG for a file
  const handleCreateGraph = async (fileId: string) => {
    setActionLoading(fileId)
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`/api/v1/admin/storage/minio/files/${fileId}/graph`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.status === 403) {
        setMessage({ type: 'error', text: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' })
        setTimeout(() => window.location.href = '/login', 2000)
        return
      }

      if (response.ok) {
        const result = await response.json()
        setMessage({ type: 'success', text: `สร้าง Graph แล้ว (Task: ${result.task_id?.slice(0, 8)}...)` })
        setTimeout(() => setMessage(null), 3000)
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.detail || 'ไม่สามารถสร้าง Graph ได้' })
      }
    } catch (err) {
      console.error('Failed to create graph:', err)
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการสร้าง Graph' })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-4">
          <HardDrive className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">พื้นที่จัดเก็บสัญญา</h2>
            <p className="text-sm text-gray-500">จัดการการตั้งค่าการจัดเก็บไฟล์และเนื้อหา (แยกจาก Knowledge Base)</p>
          </div>
        </div>

        {message && (
          <div className={`p-3 rounded-lg flex items-center gap-2 ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            {message.text}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveStorageTab('minio')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition ${
              activeStorageTab === 'minio'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'hover:bg-gray-50 text-gray-600'
            }`}
          >
            <FileArchive className="w-5 h-5" />
            <div className="text-left">
              <p className="font-medium">MinIO Storage</p>
              <p className="text-xs opacity-75">เก็บไฟล์ตัวจริง (PDF, รูปภาพ)</p>
            </div>
          </button>
          <button
            onClick={() => setActiveStorageTab('rag')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition ${
              activeStorageTab === 'rag'
                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                : 'hover:bg-gray-50 text-gray-600'
            }`}
          >
            <BrainCircuit className="w-5 h-5" />
            <div className="text-left">
              <p className="font-medium">RAG Storage</p>
              <p className="text-xs opacity-75">เก็บเนื้อหาและ Embeddings</p>
            </div>
          </button>
        </div>
      </div>

      {/* MinIO Section - เก็บไฟล์ตัวจริง */}
      {activeStorageTab === 'minio' && (
        <div className="space-y-6">
          {/* MinIO Stats */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-2 mb-4">
              <DatabaseBackup className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">สถิติการใช้งาน (Object Storage)</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <p className="text-sm text-gray-600 mb-1">พื้นที่ใช้งานทั้งหมด</p>
                <p className="text-2xl font-bold text-blue-700">{minioLoading ? '...' : formatSize(minioStats.totalSize)}</p>
              </div>
              <button
                onClick={openFileModal}
                className="bg-green-50 rounded-lg p-4 border border-green-100 text-left hover:bg-green-100 transition cursor-pointer"
              >
                <p className="text-sm text-gray-600 mb-1">จำนวนไฟล์</p>
                <p className="text-2xl font-bold text-green-700">{minioLoading ? '...' : minioStats.documentCount.toLocaleString()}</p>
                <p className="text-xs text-green-600 mt-1">คลิกเพื่อดูรายการ</p>
              </button>
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                <p className="text-sm text-gray-600 mb-1">Bucket</p>
                <p className="text-lg font-bold text-purple-700">{minioStats.bucketName}</p>
              </div>
            </div>
          </div>

          {/* MinIO Configuration */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-gray-600" />
              ตั้งค่า MinIO (Object Storage)
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ประเภท Storage</label>
                  <select
                    value={minioConfig.type}
                    onChange={(e) => setMinioConfig({...minioConfig, type: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="minio">MinIO (Local)</option>
                    <option value="s3">Amazon S3</option>
                    <option value="gcs">Google Cloud Storage</option>
                    <option value="azure">Azure Blob Storage</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bucket Name</label>
                  <input
                    type="text"
                    value={minioConfig.bucket}
                    onChange={(e) => setMinioConfig({...minioConfig, bucket: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Endpoint URL</label>
                <input
                  type="text"
                  value={minioConfig.endpoint}
                  onChange={(e) => setMinioConfig({...minioConfig, endpoint: e.target.value})}
                  placeholder="minio:9000 หรือ s3.amazonaws.com"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Access Key</label>
                  <input
                    type={showMinioKeys ? 'text' : 'password'}
                    value={minioConfig.accessKey}
                    onChange={(e) => setMinioConfig({...minioConfig, accessKey: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Secret Key</label>
                  <input
                    type={showMinioKeys ? 'text' : 'password'}
                    value={minioConfig.secretKey}
                    onChange={(e) => setMinioConfig({...minioConfig, secretKey: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showMinioKeys"
                  checked={showMinioKeys}
                  onChange={(e) => setShowMinioKeys(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="showMinioKeys" className="text-sm text-gray-700">แสดง API Keys</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleTestMinioConnection}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  <Activity className="w-4 h-4" />
                  ทดสอบการเชื่อมต่อ
                </button>
                <button
                  onClick={handleSaveMinioConfig}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Save className="w-4 h-4" />
                  บันทึกการตั้งค่า
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RAG Section - เก็บ content ที่ได้จากการประมวลผล */}
      {activeStorageTab === 'rag' && (
        <div className="space-y-6">
          {/* RAG Stats */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">สถิติการใช้งาน (Vector Storage)</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                <p className="text-sm text-gray-600 mb-1">จำนวน Chunks</p>
                <p className="text-2xl font-bold text-purple-700">{ragLoading ? '...' : ragStats.totalChunks.toLocaleString()}</p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
                <p className="text-sm text-gray-600 mb-1">จำนวน Embeddings</p>
                <p className="text-2xl font-bold text-indigo-700">{ragLoading ? '...' : ragStats.totalEmbeddings.toLocaleString()}</p>
              </div>
              <div className="bg-pink-50 rounded-lg p-4 border border-pink-100">
                <p className="text-sm text-gray-600 mb-1">Vector Size</p>
                <p className="text-2xl font-bold text-pink-700">{ragLoading ? '...' : formatSize(ragStats.vectorSize)}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
                <p className="text-sm text-gray-600 mb-1">ซิงค์ล่าสุด</p>
                <p className="text-lg font-bold text-orange-700">{ragStats.lastSync || 'ยังไม่มี'}</p>
              </div>
            </div>
          </div>

          {/* RAG Configuration */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-gray-600" />
              ตั้งค่า RAG Storage (Vector Database)
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">เปิดใช้งาน RAG Storage</p>
                  <p className="text-sm text-gray-500">เก็บเนื้อหาและ embeddings สำหรับการค้นหา</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ragConfig.enabled}
                    onChange={(e) => setRagConfig({...ragConfig, enabled: e.target.checked})}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vector Database Provider</label>
                  <select
                    value={ragConfig.provider}
                    onChange={(e) => setRagConfig({...ragConfig, provider: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="pgvector">PostgreSQL pgvector (Local)</option>
                    <option value="elasticsearch">Elasticsearch</option>
                    <option value="pinecone">Pinecone</option>
                    <option value="chroma">ChromaDB</option>
                    <option value="weaviate">Weaviate</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Index Name</label>
                  <input
                    type="text"
                    value={ragConfig.indexName}
                    onChange={(e) => setRagConfig({...ragConfig, indexName: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Chunk Size</label>
                  <input
                    type="number"
                    value={ragConfig.chunkSize}
                    onChange={(e) => setRagConfig({...ragConfig, chunkSize: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">จำนวนตัวอักษรต่อ chunk</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Chunk Overlap</label>
                  <input
                    type="number"
                    value={ragConfig.chunkOverlap}
                    onChange={(e) => setRagConfig({...ragConfig, chunkOverlap: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">จำนวนตัวอักษรทับซ้อนกัน</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Embedding Model</label>
                <select
                  value={ragConfig.embeddingModel}
                  onChange={(e) => setRagConfig({...ragConfig, embeddingModel: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2">MiniLM-L12 (384 dim) - แนะนำ</option>
                  <option value="sentence-transformers/all-MiniLM-L6-v2">All-MiniLM-L6 (384 dim)</option>
                  <option value="sentence-transformers/paraphrase-multilingual-MiniLM-L6-v2">MiniLM-L6 (384 dim)</option>
                  <option value="BAAI/bge-m3">BGE-M3 (1024 dim) - รองรับภาษาไทยดี</option>
                  <option value="intfloat/multilingual-e5-large">E5-Large (1024 dim)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">โมเดลสำหรับแปลงข้อความเป็นเวกเตอร์</p>
              </div>

              {/* External Provider Settings (show only for external providers) */}
              {ragConfig.provider !== 'pgvector' && ragConfig.provider !== 'chroma' && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900">ตั้งค่า External Provider</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                    <input
                      type={showRagKey ? 'text' : 'password'}
                      value={ragConfig.apiKey}
                      onChange={(e) => setRagConfig({...ragConfig, apiKey: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>

                  {ragConfig.provider === 'pinecone' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Environment</label>
                      <input
                        type="text"
                        value={ragConfig.environment}
                        onChange={(e) => setRagConfig({...ragConfig, environment: e.target.value})}
                        placeholder="us-west1-gcp"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Endpoint URL (Optional)</label>
                    <input
                      type="text"
                      value={ragConfig.endpoint}
                      onChange={(e) => setRagConfig({...ragConfig, endpoint: e.target.value})}
                      placeholder="https://api.example.com"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="showRagKey"
                      checked={showRagKey}
                      onChange={(e) => setShowRagKey(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <label htmlFor="showRagKey" className="text-sm text-gray-700">แสดง API Key</label>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleTestRagConnection}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  <Activity className="w-4 h-4" />
                  ทดสอบการเชื่อมต่อ
                </button>
                <button
                  onClick={handleSyncRag}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition"
                >
                  <Zap className="w-4 h-4" />
                  ซิงค์ข้อมูล
                </button>
                <button
                  onClick={handleSaveRagConfig}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  <Save className="w-4 h-4" />
                  บันทึกการตั้งค่า
                </button>
              </div>
            </div>
          </div>

          {/* RAG Tips */}
          <div className="bg-purple-50 rounded-xl border border-purple-200 p-6">
            <h3 className="text-sm font-semibold text-purple-800 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              ข้อมูลเพิ่มเติม
            </h3>
            <ul className="text-sm text-purple-700 space-y-1 list-disc list-inside">
              <li>RAG Storage ใช้เก็บเนื้อหาที่แยกจากไฟล์ (extracted text) และ embeddings</li>
              <li>แยกจาก Knowledge Base ที่ใช้เก็บเอกสารอ้างอิงสำหรับ AI</li>
              <li>การซิงค์จะประมวลผลเอกสารทั้งหมดใน MinIO ใหม่อีกครั้ง</li>
              <li>การเปลี่ยน Embedding Model ต้องซิงค์ข้อมูลใหม่ทั้งหมด</li>
            </ul>
          </div>
        </div>
      )}

      {/* Common Retention Policy */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-600" />
          นโยบายการเก็บรักษาเอกสาร (ทั้ง MinIO และ RAG)
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">ลบเอกสารอัตโนมัติ</p>
              <p className="text-sm text-gray-500">ลบไฟล์และข้อมูล RAG ที่เกินระยะเวลาที่กำหนด</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoCleanup}
                onChange={(e) => setAutoCleanup(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ระยะเวลาเก็บรักษา: <span className="text-blue-600 font-bold">{retentionDays} วัน</span>
              <span className="text-gray-500 ml-2">({Math.floor(retentionDays / 365)} ปี)</span>
            </label>
            <input
              type="range"
              min="365"
              max="3650"
              step="365"
              value={retentionDays}
              onChange={(e) => setRetentionDays(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1 ปี</span>
              <span>5 ปี</span>
              <span>10 ปี</span>
            </div>
          </div>
        </div>
      </div>

      {/* File List Modal */}
      {showFileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <FileArchive className="w-6 h-6 text-green-600" />
                  รายการไฟล์ทั้งหมด
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  เลือกไฟล์เพื่อลบ (เลือกได้หลายไฟล์)
                </p>
              </div>
              <button
                onClick={closeFileModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-6">
              {fileListLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <span className="ml-3 text-gray-600">กำลังโหลด...</span>
                </div>
              ) : fileList.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileArchive className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>ไม่พบไฟล์</p>
                </div>
              ) : (
                <>
                  {/* Select All Header */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedFiles.size === fileList.length && fileList.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        เลือกทั้งหมด ({selectedFiles.size}/{fileList.length})
                      </span>
                    </label>
                    <span className="text-sm text-gray-500">
                      แสดง {fileList.length} จาก {fileListTotal} รายการ
                    </span>
                  </div>

                  {/* File List */}
                  <div className="space-y-2">
                    {fileList.map((file) => (
                      <div
                        key={file.id}
                        className={`flex items-center gap-4 p-4 rounded-lg border transition ${
                          selectedFiles.has(file.id)
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(file.id)}
                          onChange={() => toggleFileSelection(file.id)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <p className="font-medium text-gray-900 truncate">{file.filename}</p>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            <span>{file.document_type}</span>
                            <span>•</span>
                            <span>{formatSize(file.file_size || 0)}</span>
                            <span>•</span>
                            <span>{new Date(file.created_at).toLocaleDateString('th-TH')}</span>
                            {file.contract_name && (
                              <>
                                <span>•</span>
                                <span className="text-blue-600 truncate max-w-[200px]">{file.contract_name}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Status Badge */}
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            file.ocr_status === 'completed' ? 'bg-green-100 text-green-700' :
                            file.ocr_status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                            file.ocr_status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {file.ocr_status === 'completed' ? 'ประมวลผลแล้ว' :
                             file.ocr_status === 'processing' ? 'กำลังประมวลผล' :
                             file.ocr_status === 'failed' ? 'ล้มเหลว' :
                             'รอดำเนินการ'}
                          </span>
                          
                          {/* Action Buttons */}
                          {(file.ocr_status === 'pending' || file.ocr_status === 'failed') && (
                            <button
                              onClick={() => handleReprocessFile(file.id)}
                              disabled={actionLoading === file.id}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition disabled:opacity-50"
                              title="ประมวลผลอีกครั้ง"
                            >
                              {actionLoading === file.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Play className="w-3 h-3" />
                              )}
                              ดำเนินการ
                            </button>
                          )}
                          
                          {file.ocr_status === 'completed' && (
                            <button
                              onClick={() => handleCreateGraph(file.id)}
                              disabled={actionLoading === file.id}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition disabled:opacity-50"
                              title="สร้าง Graph"
                            >
                              {actionLoading === file.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <BrainCircuit className="w-3 h-3" />
                              )}
                              สร้าง Graph
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {fileListTotal > FILE_LIST_LIMIT && (
                    <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
                      <button
                        onClick={() => fetchFileList(fileListPage - 1)}
                        disabled={fileListPage === 1 || fileListLoading}
                        className="px-3 py-1 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ก่อนหน้า
                      </button>
                      <span className="text-sm text-gray-600">
                        หน้า {fileListPage} / {Math.ceil(fileListTotal / FILE_LIST_LIMIT)}
                      </span>
                      <button
                        onClick={() => fetchFileList(fileListPage + 1)}
                        disabled={fileListPage >= Math.ceil(fileListTotal / FILE_LIST_LIMIT) || fileListLoading}
                        className="px-3 py-1 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ถัดไป
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-6 border-t bg-gray-50 rounded-b-xl">
              <span className="text-sm text-gray-600">
                เลือก {selectedFiles.size} รายการ
              </span>
              <div className="flex gap-3">
                <button
                  onClick={closeFileModal}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition"
                >
                  ปิด
                </button>
                <button
                  onClick={handleDeleteSelectedFiles}
                  disabled={selectedFiles.size === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  ลบที่เลือก ({selectedFiles.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusCard({ icon, title, value, subtitle, color, status }: { 
  icon: React.ReactNode
  title: string
  value: string
  subtitle: string
  color: 'blue' | 'green' | 'purple' | 'orange'
  status: 'online' | 'offline'
}) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200'
  }

  return (
    <div className={`${colors[color]} border rounded-xl p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            {icon}
          </div>
          <div>
            <p className="text-sm text-gray-600">{title}</p>
            <p className="text-lg font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
        {status === 'online' ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : (
          <XCircle className="w-5 h-5 text-red-500" />
        )}
      </div>
    </div>
  )
}

function EndpointStatus({ name, method, path, status }: { 
  name: string
  method: string
  path: string
  status: 'online' | 'offline'
}) {
  return (
    <div className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
      <div className="flex items-center gap-4">
        <span className={`px-2 py-1 text-xs font-medium rounded ${
          method === 'GET' ? 'bg-green-100 text-green-700' :
          method === 'POST' ? 'bg-blue-100 text-blue-700' :
          method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
          method === 'DELETE' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {method}
        </span>
        <div>
          <p className="font-medium text-gray-900">{name}</p>
          <p className="text-sm text-gray-500">{path}</p>
        </div>
      </div>
      {status === 'online' ? (
        <CheckCircle className="w-5 h-5 text-green-500" />
      ) : (
        <XCircle className="w-5 h-5 text-red-500" />
      )}
    </div>
  )
}
