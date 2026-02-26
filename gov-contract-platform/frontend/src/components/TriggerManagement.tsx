import { useState, useEffect } from 'react'
import { 
  Plus, Trash2, Edit3, Play, Pause, Clock, 
  Calendar, MousePointer, Zap, FileText, FileSignature,
  Users, Settings, AlertCircle, CheckCircle, X,
  ChevronDown, ChevronUp, MoreHorizontal, Copy,
  Activity, History, Bell
} from 'lucide-react'

interface Trigger {
  id: string
  name: string
  description?: string
  trigger_type: string
  status: 'active' | 'paused' | 'error' | 'disabled'
  priority: number
  conditions: Record<string, any>
  schedule_config?: Record<string, any>
  periodic_config?: Record<string, any>
  applicable_pages: string[]
  button_config?: Record<string, any>
  max_executions_per_day: number
  cooldown_seconds: number
  notification_config?: Record<string, any>
  execution_count: number
  last_executed_at?: string
}

interface TriggerTemplate {
  id: string
  name: string
  description?: string
  category: string
  trigger_type: string
  default_conditions: Record<string, any>
  applicable_pages: string[]
  icon?: string
}

interface TriggerType {
  value: string
  label: string
  category: 'event' | 'schedule' | 'manual' | 'data'
  icon: string
}

interface TriggerManagementProps {
  agentId: string
  triggers: Trigger[]
  templates: TriggerTemplate[]
  triggerTypes: TriggerType[]
  pages: { value: string; label: string; category: string }[]
  onCreate: (trigger: Partial<Trigger>) => void
  onUpdate: (id: string, trigger: Partial<Trigger>) => void
  onDelete: (id: string) => void
  onToggle: (id: string) => void
  onTest: (id: string, testData?: any) => void
}

const categoryColors: Record<string, string> = {
  event: 'bg-blue-100 text-blue-800',
  schedule: 'bg-green-100 text-green-800',
  manual: 'bg-purple-100 text-purple-800',
  data: 'bg-amber-100 text-amber-800'
}

const categoryLabels: Record<string, string> = {
  event: 'เหตุการณ์',
  schedule: 'ตารางเวลา',
  manual: 'ด้วยตนเอง',
  data: 'ข้อมูล'
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  disabled: 'bg-gray-100 text-gray-800'
}

const statusLabels: Record<string, string> = {
  active: 'ใช้งาน',
  paused: 'หยุดชั่วคราว',
  error: 'ผิดพลาด',
  disabled: 'ปิดใช้งาน'
}

export default function TriggerManagement({
  agentId,
  triggers,
  templates,
  triggerTypes,
  pages,
  onCreate,
  onUpdate,
  onDelete,
  onToggle,
  onTest
}: TriggerManagementProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingTrigger, setEditingTrigger] = useState<Trigger | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [expandedTrigger, setExpandedTrigger] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'triggers' | 'templates' | 'history'>('triggers')

  const handleCreateFromTemplate = (template: TriggerTemplate) => {
    const newTrigger: Partial<Trigger> = {
      name: template.name,
      description: template.description,
      trigger_type: template.trigger_type,
      conditions: template.default_conditions,
      applicable_pages: template.applicable_pages,
      status: 'active',
      priority: 0,
      max_executions_per_day: 1000,
      cooldown_seconds: 0
    }
    onCreate(newTrigger)
    setSelectedTemplate(null)
  }

  const getTriggerTypeInfo = (typeValue: string) => {
    return triggerTypes.find(t => t.value === typeValue) || {
      value: typeValue,
      label: typeValue,
      category: 'event',
      icon: 'zap'
    }
  }

  const getCategoryFromType = (typeValue: string): string => {
    const type = triggerTypes.find(t => t.value === typeValue)
    return type?.category || 'event'
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('triggers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'triggers'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Zap className="w-4 h-4 inline mr-1" />
          Triggers ({triggers.length})
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'templates'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-1" />
          Templates ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'history'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <History className="w-4 h-4 inline mr-1" />
          ประวัติ
        </button>
      </div>

      {/* Triggers Tab */}
      {activeTab === 'triggers' && (
        <div className="space-y-4">
          {/* Add Button */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              กำหนดว่า Agent จะทำงานเมื่อใดและที่ไหน
            </p>
            <button
              onClick={() => {
                setEditingTrigger(null)
                setShowForm(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              เพิ่ม Trigger
            </button>
          </div>

          {/* Triggers List */}
          {triggers.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Zap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">ยังไม่มี Trigger</p>
              <p className="text-sm text-gray-400 mt-1">
                เพิ่ม Trigger เพื่อให้ Agent ทำงานอัตโนมัติ
              </p>
              <button
                onClick={() => setActiveTab('templates')}
                className="mt-4 text-blue-600 hover:text-blue-700 text-sm"
              >
                เลือกจาก Templates →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {triggers.map(trigger => {
                const typeInfo = getTriggerTypeInfo(trigger.trigger_type)
                const category = getCategoryFromType(trigger.trigger_type)
                const isExpanded = expandedTrigger === trigger.id

                return (
                  <div
                    key={trigger.id}
                    className={`border rounded-lg overflow-hidden ${
                      isExpanded ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    {/* Header */}
                    <div
                      className="flex items-center justify-between p-4 bg-white cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedTrigger(isExpanded ? null : trigger.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${categoryColors[category]}`}>
                          {categoryLabels[category]}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">{trigger.name}</p>
                          <p className="text-sm text-gray-500">
                            {typeInfo.label}
                            {trigger.execution_count > 0 && (
                              <span className="ml-2 text-blue-600">
                                • ทำงานแล้ว {trigger.execution_count} ครั้ง
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${statusColors[trigger.status]}`}>
                          {statusLabels[trigger.status]}
                        </span>
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t bg-gray-50 p-4 space-y-4">
                        {trigger.description && (
                          <p className="text-sm text-gray-600">{trigger.description}</p>
                        )}

                        {/* Conditions */}
                        {Object.keys(trigger.conditions).length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">เงื่อนไข:</p>
                            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                              {JSON.stringify(trigger.conditions, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Applicable Pages */}
                        {trigger.applicable_pages.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">หน้าที่ใช้งาน:</p>
                            <div className="flex flex-wrap gap-1">
                              {trigger.applicable_pages.map(page => (
                                <span key={page} className="px-2 py-1 text-xs bg-white border rounded">
                                  {page}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Schedule Info */}
                        {trigger.schedule_config?.cron && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            <span>Cron: {trigger.schedule_config.cron}</span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <button
                            onClick={() => onToggle(trigger.id)}
                            className={`flex items-center gap-1 px-3 py-1 rounded text-sm ${
                              trigger.status === 'active'
                                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {trigger.status === 'active' ? (
                              <><Pause className="w-4 h-4" /> หยุดชั่วคราว</>
                            ) : (
                              <><Play className="w-4 h-4" /> เปิดใช้งาน</>
                            )}
                          </button>
                          <button
                            onClick={() => onTest(trigger.id)}
                            className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                          >
                            <Activity className="w-4 h-4" /> ทดสอบ
                          </button>
                          <button
                            onClick={() => {
                              setEditingTrigger(trigger)
                              setShowForm(true)
                            }}
                            className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                          >
                            <Edit3 className="w-4 h-4" /> แก้ไข
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('ลบ Trigger นี้?')) {
                                onDelete(trigger.id)
                              }
                            }}
                            className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                          >
                            <Trash2 className="w-4 h-4" /> ลบ
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            เลือก Template เพื่อสร้าง Trigger อย่างรวดเร็ว
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(template => (
              <div
                key={template.id}
                className="border rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                onClick={() => handleCreateFromTemplate(template)}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    {template.category === 'document' && <FileText className="w-5 h-5 text-blue-600" />}
                    {template.category === 'contract' && <FileSignature className="w-5 h-5 text-blue-600" />}
                    {template.category === 'vendor' && <Users className="w-5 h-5 text-blue-600" />}
                    {template.category === 'system' && <Settings className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{template.name}</p>
                    <p className="text-sm text-gray-500">{template.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                        {triggerTypes.find(t => t.value === template.trigger_type)?.label || template.trigger_type}
                      </span>
                    </div>
                  </div>
                  <Plus className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            ประวัติการทำงานของ Triggers
          </p>
          <div className="text-center py-12 text-gray-500">
            <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p>ประวัติการทำงานจะแสดงที่นี่</p>
          </div>
        </div>
      )}
    </div>
  )
}
