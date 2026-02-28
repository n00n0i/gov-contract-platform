import { useState, useEffect } from 'react'
import { 
  Bot, Brain, BookOpen, Zap, Settings, 
  ChevronDown, ChevronUp, AlertCircle, CheckCircle,
  FileText, Layout, MousePointer, Save, X, Plus
} from 'lucide-react'
import { getAgentModels } from '../services/agentService'

interface AgentConfig {
  id?: string
  name: string
  description: string
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
  output_action: string
  output_target: string
  output_format: string
  allowed_roles: string[]
}

interface KnowledgeBase {
  id: string
  name: string
  description: string
  document_count: number
}

interface MetadataOption {
  value: string
  label: string
  description?: string
  model?: string
  provider_type?: string
  url?: string
  requires_key?: boolean
}

export default function AgentConfigForm({
  initialData,
  onSave,
  onCancel,
  knowledgeBases = [],
  triggerEvents = [],
  outputActions = [],
  pages = [],
}: {
  initialData?: Partial<AgentConfig>
  onSave: (data: AgentConfig) => void
  onCancel: () => void
  knowledgeBases: KnowledgeBase[]
  triggerEvents: MetadataOption[]
  outputActions: MetadataOption[]
  pages: MetadataOption[]
}) {
  const [activeTab, setActiveTab] = useState<'basic' | 'prompt' | 'knowledge' | 'trigger' | 'output'>('basic')
  const [models, setModels] = useState<MetadataOption[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  
  // KB Creation state
  const [showKBForm, setShowKBForm] = useState(false)
  const [kbFormData, setKBFormData] = useState({
    name: '',
    description: '',
    kb_type: 'contract'
  })
  const [creatingKB, setCreatingKB] = useState(false)
  const [localKBs, setLocalKBs] = useState<KnowledgeBase[]>(knowledgeBases)
  
  // Debug: Log triggerEvents received from parent
  useEffect(() => {
    console.log('TriggerEvents received:', triggerEvents.length, 'items')
    console.log('TriggerEvents data:', triggerEvents)
  }, [triggerEvents])
  
  const [formData, setFormData] = useState<AgentConfig>({
    name: '',
    description: '',
    model: '',
    model_config: { temperature: 0.7, max_tokens: 2000 },
    system_prompt: '',
    knowledge_base_ids: [],
    use_graphrag: false,
    trigger_events: ['manual'],
    trigger_pages: [],
    output_action: 'show_popup',
    output_target: '',
    output_format: 'json',
    allowed_roles: [],
    ...initialData
  })

  // Sync localKBs with prop
  useEffect(() => {
    setLocalKBs(knowledgeBases)
  }, [knowledgeBases])

  // Fetch models from API on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setModelsLoading(true)
        const modelsData = await getAgentModels()
        setModels(modelsData || [])
      } catch (err) {
        console.error('Failed to fetch models:', err)
        setModels([])
      } finally {
        setModelsLoading(false)
      }
    }
    fetchModels()
  }, [])
  
  // Handle KB creation
  const handleCreateKB = async () => {
    if (!kbFormData.name.trim()) {
      alert('กรุณาระบุชื่อ Knowledge Base')
      return
    }
    
    setCreatingKB(true)
    try {
      // Import service dynamically
      const { createKnowledgeBase } = await import('../services/agentService')
      const result = await createKnowledgeBase({
        name: kbFormData.name,
        description: kbFormData.description,
        kb_type: kbFormData.kb_type,
        document_ids: []
      })
      
      // Add new KB to local list
      const newKB = {
        id: result.data?.id || result.id || Date.now().toString(),
        name: kbFormData.name,
        description: kbFormData.description,
        document_count: 0
      }
      
      setLocalKBs(prev => [...prev, newKB])
      
      // Auto-select the new KB
      setFormData(prev => ({
        ...prev,
        knowledge_base_ids: [...prev.knowledge_base_ids, newKB.id]
      }))
      
      // Reset form
      setKBFormData({ name: '', description: '', kb_type: 'contract' })
      setShowKBForm(false)
      
      alert('สร้าง Knowledge Base สำเร็จ')
    } catch (err) {
      console.error('Failed to create KB:', err)
      alert('ไม่สามารถสร้าง Knowledge Base ได้')
    } finally {
      setCreatingKB(false)
    }
  }

  // Set default model when models are loaded
  useEffect(() => {
    if (models.length > 0 && !formData.model && !initialData?.model) {
      setFormData(prev => ({ ...prev, model: models[0].value }))
    }
  }, [models, initialData])

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'กรุณาระบุชื่อ Agent'
    if (!formData.system_prompt.trim()) newErrors.system_prompt = 'กรุณาระบุ System Prompt'
    if (formData.trigger_events.length === 0) newErrors.trigger_events = 'กรุณาเลือกอย่างน้อย 1 Trigger'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData)
    }
  }

  const renderBasicTab = () => (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ชื่อ Agent <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="เช่น Contract Analyzer"
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          รายละเอียด
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="อธิบายว่า Agent นี้ทำอะไร"
          rows={2}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* AI Model */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          AI Model <span className="text-red-500">*</span>
        </label>
        <p className="text-sm text-gray-500 mb-2">เลือกจาก AI Providers ที่ตั้งค่าไว้ใน Settings &gt; AI Models</p>
        
        {modelsLoading ? (
          <div className="flex items-center gap-2 text-gray-500 py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>กำลังโหลด AI Models...</span>
          </div>
        ) : models.length === 0 ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ยังไม่มี AI Provider ที่ตั้งค่าไว้ 
              <a href="#/settings" className="underline ml-1 hover:text-yellow-900">ไปตั้งค่า</a>
            </p>
          </div>
        ) : (
          <select
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">เลือก AI Model</option>
            {models.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Model Config */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Temperature
          </label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={formData.model_config.temperature}
            onChange={(e) => setFormData({
              ...formData,
              model_config: { ...formData.model_config, temperature: parseFloat(e.target.value) }
            })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">0 = ตอบแบบเดิมซ้ำ, 1 = สุ่มมาก</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Tokens
          </label>
          <input
            type="number"
            min="100"
            max="32000"
            step="100"
            value={formData.model_config.max_tokens}
            onChange={(e) => setFormData({
              ...formData,
              model_config: { ...formData.model_config, max_tokens: parseInt(e.target.value) }
            })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  )

  const renderPromptTab = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          System Prompt <span className="text-red-500">*</span>
        </label>
        <p className="text-sm text-gray-500 mb-2">
          คำสั่งเริ่มต้นที่บอก AI ว่าต้องทำอะไร มีบทบาทอะไร
        </p>
        <textarea
          value={formData.system_prompt}
          onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
          placeholder={`คุณเป็นผู้ช่วยวิเคราะห์สัญญาภาครัฐ มีหน้าที่:
1. ตรวจสอบความสมบูรณ์ของสัญญา
2. ระบุข้อความที่เสี่ยงต่อการฟ้องร้อง
3. แนะนำแก้ไขตาม พรบ. จัดซื้อจัดจ้าง

ตอบในรูปแบบ JSON ที่มี structure ชัดเจน`}
          rows={12}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
        />
        {errors.system_prompt && <p className="text-red-500 text-sm mt-1">{errors.system_prompt}</p>}
      </div>
    </div>
  )

  const renderKnowledgeTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">Knowledge Base (RAG)</h3>
          <p className="text-sm text-gray-500">เลือกฐานความรู้ที่ Agent จะอ้างอิง</p>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.use_graphrag}
            onChange={(e) => setFormData({ ...formData, use_graphrag: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm">ใช้ GraphRAG</span>
        </label>
      </div>

      {/* KB Creation Modal */}
      {showKBForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">สร้าง Knowledge Base</h3>
              <button
                onClick={() => setShowKBForm(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Form */}
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={kbFormData.name}
                  onChange={(e) => setKBFormData({ ...kbFormData, name: e.target.value })}
                  placeholder="เช่น ระเบียบปฏิบัติจัดจ้าง"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                <textarea
                  value={kbFormData.description}
                  onChange={(e) => setKBFormData({ ...kbFormData, description: e.target.value })}
                  placeholder="อธิบายว่า Knowledge Base นี้เก็บข้อมูลอะไร"
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
                <select
                  value={kbFormData.kb_type}
                  onChange={(e) => setKBFormData({ ...kbFormData, kb_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="contract">สัญญา</option>
                  <option value="document">เอกสารทั่วไป</option>
                  <option value="regulation">กฎระเบียบ</option>
                  <option value="template">Template</option>
                </select>
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowKBForm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCreateKB}
                disabled={creatingKB || !kbFormData.name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {creatingKB ? 'กำลังสร้าง...' : 'สร้าง'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!showKBForm && localKBs.length === 0 ? (
        <div className="p-6 bg-gray-50 border rounded-lg text-center">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">ยังไม่มี Knowledge Base</p>
          <button
            onClick={() => setShowKBForm(true)} 
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            สร้าง Knowledge Base
          </button>
          <p className="text-xs text-gray-400 mt-2">คุณต้องสร้าง Knowledge Base ก่อนจึงจะสามารถเลือกใช้ได้</p>
        </div>
      ) : (
        <div className="space-y-2">
          {localKBs.map((kb) => (
            <label key={kb.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.knowledge_base_ids.includes(kb.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData({
                      ...formData,
                      knowledge_base_ids: [...formData.knowledge_base_ids, kb.id]
                    })
                  } else {
                    setFormData({
                      ...formData,
                      knowledge_base_ids: formData.knowledge_base_ids.filter(id => id !== kb.id)
                    })
                  }
                }}
                className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="font-medium text-gray-900">{kb.name}</p>
                <p className="text-sm text-gray-500">{kb.description || `${kb.document_count} เอกสาร`}</p>
              </div>
            </label>
          ))}
          
          {/* Add New KB Button */}
          {!showKBForm && (
            <button
              onClick={() => setShowKBForm(true)}
              className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
            >
              <Plus className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">เพิ่ม Knowledge Base ใหม่</span>
            </button>
          )}
        </div>
      )}
    </div>
  )

  const renderTriggerTab = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Trigger Presets <span className="text-red-500">*</span>
        </label>
        <p className="text-sm text-gray-500 mb-3">เลือก Triggers ที่ต้องการให้ Agent ทำงานอัตโนมัติ</p>
        
        {triggerEvents.length === 0 ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">ไม่พบ Trigger Presets - กำลังโหลด...</p>
          </div>
        ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
            {triggerEvents.map((preset) => (
              <label key={preset.value} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.trigger_events.includes(preset.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({
                        ...formData,
                        trigger_events: [...formData.trigger_events, preset.value]
                      })
                    } else {
                      setFormData({
                        ...formData,
                        trigger_events: formData.trigger_events.filter(ev => ev !== preset.value)
                      })
                    }
                  }}
                  className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{preset.label}</p>
                    {(preset as any).requires_kb && (
                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">ต้องการ KB</span>
                    )}
                    {(preset as any).requires_graphrag && (
                      <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">ต้องการ GraphRAG</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{preset.description}</p>
                  <p className="text-xs text-gray-400 mt-1">ประเภท: {(preset as any).category}</p>
                </div>
              </label>
            ))}
          </div>
        )}
        {errors.trigger_events && <p className="text-red-500 text-sm mt-1">{errors.trigger_events}</p>}
      </div>

      <div className="p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <span className="font-medium">หมายเหตุ:</span> Triggers จะทำงานอัตโนมัติเมื่อมีเหตุการณ์ที่กำหนด เช่น อัพโหลดเอกสาร, สร้างสัญญา, ฯลฯ
        </p>
      </div>
    </div>
  )

  const renderOutputTab = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Output Action
        </label>
        <p className="text-sm text-gray-500 mb-3">เลือกว่าจะให้ Agent ทำอะไรกับผลลัพธ์</p>
        
        <div className="space-y-2">
          {outputActions.map((action) => (
            <label key={action.value} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition ${
              formData.output_action === action.value ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
            }`}>
              <input
                type="radio"
                name="output_action"
                value={action.value}
                checked={formData.output_action === action.value}
                onChange={(e) => setFormData({ ...formData, output_action: e.target.value })}
                className="mt-1 border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="font-medium text-gray-900">{action.label}</p>
                <p className="text-sm text-gray-500">{action.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {formData.output_action === 'save_to_field' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Output Target Field
          </label>
          <input
            type="text"
            value={formData.output_target}
            onChange={(e) => setFormData({ ...formData, output_target: e.target.value })}
            placeholder="เช่น contract.notes, document.metadata"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">ระบุ field ที่จะบันทึกผลลัพธ์</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Output Format
        </label>
        <div className="flex gap-4">
          {['json', 'markdown', 'text'].map((format) => (
            <label key={format} className="flex items-center gap-2">
              <input
                type="radio"
                name="output_format"
                value={format}
                checked={formData.output_format === format}
                onChange={(e) => setFormData({ ...formData, output_format: e.target.value })}
                className="border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm capitalize">{format}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Bot className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {initialData ? 'แก้ไข Agent' : 'สร้าง Agent ใหม่'}
            </h3>
            <p className="text-sm text-gray-500">ตั้งค่า AI Agent สำหรับงานเฉพาะทาง</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {[
          { id: 'basic', label: 'พื้นฐาน', icon: Settings },
          { id: 'prompt', label: 'Prompt', icon: Brain },
          { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
          { id: 'trigger', label: 'Trigger', icon: Zap },
          { id: 'output', label: 'Output', icon: FileText },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'basic' && renderBasicTab()}
        {activeTab === 'prompt' && renderPromptTab()}
        {activeTab === 'knowledge' && renderKnowledgeTab()}
        {activeTab === 'trigger' && renderTriggerTab()}
        {activeTab === 'output' && renderOutputTab()}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
        >
          ยกเลิก
        </button>
        <button
          onClick={handleSubmit}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Save className="w-4 h-4" />
          {initialData ? 'บันทึกการแก้ไข' : 'สร้าง Agent'}
        </button>
      </div>
    </div>
  )
}
