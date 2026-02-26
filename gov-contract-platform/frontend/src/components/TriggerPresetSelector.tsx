import { useState } from 'react'
import { 
  Zap, Check, FileText, FileSignature, Users, Shield, Settings,
  ChevronRight, ChevronDown, AlertCircle, Sparkles
} from 'lucide-react'

interface TriggerPreset {
  id: string
  name: string
  name_en: string
  description: string
  category: string
  trigger_type: string
  icon: string
  color: string
  requires_kb: boolean
  requires_graphrag: boolean
  suggested_models: string[]
  applicable_pages: string[]
  button_config?: {
    label: string
    icon: string
    position: string
    style: string
  } | null
}

interface TriggerPresetSelectorProps {
  presets: TriggerPreset[]
  categories: { value: string; label: string; icon: string; color: string }[]
  enabledPresets: string[]
  agentHasKB: boolean
  agentHasGraphRAG: boolean
  agentModel: string
  onTogglePreset: (presetId: string, enabled: boolean) => void
}

const colorMap: Record<string, string> = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100',
  cyan: 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100',
  purple: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
  amber: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
  orange: 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100',
  violet: 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100',
  teal: 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100',
  sky: 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100',
  rose: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100',
  red: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100',
  slate: 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100',
  green: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100',
  fuchsia: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-100',
}

const selectedColorMap: Record<string, string> = {
  blue: 'bg-blue-600 border-blue-600 text-white',
  indigo: 'bg-indigo-600 border-indigo-600 text-white',
  cyan: 'bg-cyan-600 border-cyan-600 text-white',
  purple: 'bg-purple-600 border-purple-600 text-white',
  emerald: 'bg-emerald-600 border-emerald-600 text-white',
  amber: 'bg-amber-600 border-amber-600 text-white',
  orange: 'bg-orange-600 border-orange-600 text-white',
  violet: 'bg-violet-600 border-violet-600 text-white',
  teal: 'bg-teal-600 border-teal-600 text-white',
  sky: 'bg-sky-600 border-sky-600 text-white',
  rose: 'bg-rose-600 border-rose-600 text-white',
  red: 'bg-red-600 border-red-600 text-white',
  slate: 'bg-slate-600 border-slate-600 text-white',
  green: 'bg-green-600 border-green-600 text-white',
  fuchsia: 'bg-fuchsia-600 border-fuchsia-600 text-white',
}

const categoryIcons: Record<string, any> = {
  document: FileText,
  contract: FileSignature,
  vendor: Users,
  compliance: Shield,
  system: Settings,
}

export default function TriggerPresetSelector({
  presets,
  categories,
  enabledPresets,
  agentHasKB,
  agentHasGraphRAG,
  agentModel,
  onTogglePreset
}: TriggerPresetSelectorProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('contract')
  const [showDetails, setShowDetails] = useState<string | null>(null)

  // Group presets by category
  const groupedPresets = presets.reduce((acc, preset) => {
    if (!acc[preset.category]) acc[preset.category] = []
    acc[preset.category].push(preset)
    return acc
  }, {} as Record<string, TriggerPreset[]>)

  const isPresetAvailable = (preset: TriggerPreset) => {
    if (preset.requires_kb && !agentHasKB) return false
    if (preset.requires_graphrag && !agentHasGraphRAG) return false
    return true
  }

  const getUnavailableReason = (preset: TriggerPreset) => {
    if (preset.requires_kb && !agentHasKB) {
      return 'ต้องการ Knowledge Base'
    }
    if (preset.requires_graphrag && !agentHasGraphRAG) {
      return 'ต้องการ GraphRAG'
    }
    return null
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Trigger Presets
          </h3>
          <p className="text-sm text-gray-500">
            เลือก Triggers ที่ต้องการให้ Agent ทำงาน (คลิกเพื่อเปิด/ปิด)
          </p>
        </div>
        <span className="text-sm text-gray-500">
          ใช้งาน {enabledPresets.length} / {presets.length}
        </span>
      </div>

      {/* Categories */}
      <div className="space-y-2">
        {categories.map((category) => {
          const catPresets = groupedPresets[category.value] || []
          const enabledCount = catPresets.filter(p => enabledPresets.includes(p.id)).length
          const isExpanded = expandedCategory === category.value
          const CategoryIcon = categoryIcons[category.value] || Zap

          return (
            <div key={category.value} className="border rounded-lg overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : category.value)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition"
              >
                <div className="flex items-center gap-3">
                  <CategoryIcon className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">{category.label}</span>
                  {enabledCount > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {enabledCount}
                    </span>
                  )}
                </div>
                {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>

              {/* Presets List */}
              {isExpanded && (
                <div className="p-3 space-y-2 bg-white">
                  {catPresets.map((preset) => {
                    const isEnabled = enabledPresets.includes(preset.id)
                    const isAvailable = isPresetAvailable(preset)
                    const unavailableReason = getUnavailableReason(preset)
                    const isDetailsOpen = showDetails === preset.id

                    return (
                      <div
                        key={preset.id}
                        className={`border rounded-lg transition ${
                          isEnabled 
                            ? selectedColorMap[preset.color] || 'bg-blue-600 border-blue-600 text-white'
                            : isAvailable
                              ? colorMap[preset.color] || 'bg-gray-50 border-gray-200'
                              : 'bg-gray-100 border-gray-200 opacity-60'
                        }`}
                      >
                        <div className="p-3">
                          <div className="flex items-start gap-3">
                            {/* Toggle Button */}
                            <button
                              onClick={() => isAvailable && onTogglePreset(preset.id, !isEnabled)}
                              disabled={!isAvailable}
                              className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition ${
                                isEnabled
                                  ? 'bg-white border-white'
                                  : isAvailable
                                    ? 'border-current bg-transparent'
                                    : 'border-gray-400 bg-gray-200'
                              }`}
                            >
                              {isEnabled && <Check className="w-4 h-4 text-blue-600" />}
                            </button>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{preset.name}</span>
                                {!isAvailable && (
                                  <span className="text-xs px-2 py-0.5 bg-gray-200 rounded-full">
                                    {unavailableReason}
                                  </span>
                                )}
                              </div>
                              <p className={`text-sm mt-0.5 ${isEnabled ? 'text-blue-100' : 'text-gray-600'}`}>
                                {preset.description}
                              </p>

                              {/* Tags */}
                              <div className="flex flex-wrap gap-1 mt-2">
                                {preset.requires_kb && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${isEnabled ? 'bg-blue-500' : 'bg-amber-100 text-amber-700'}`}>
                                    KB
                                  </span>
                                )}
                                {preset.requires_graphrag && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${isEnabled ? 'bg-blue-500' : 'bg-purple-100 text-purple-700'}`}>
                                    GraphRAG
                                  </span>
                                )}
                                {preset.button_config && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${isEnabled ? 'bg-blue-500' : 'bg-gray-200'}`}>
                                    ปุ่ม: {preset.button_config.label}
                                  </span>
                                )}
                              </div>

                              {/* Details Toggle */}
                              <button
                                onClick={() => setShowDetails(isDetailsOpen ? null : preset.id)}
                                className={`text-xs mt-2 hover:underline ${isEnabled ? 'text-blue-200' : 'text-gray-500'}`}
                              >
                                {isDetailsOpen ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
                              </button>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isDetailsOpen && (
                            <div className={`mt-3 pt-3 border-t ${isEnabled ? 'border-blue-400' : 'border-gray-200'}`}>
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="font-medium">Trigger Type:</span> {preset.trigger_type}
                                </div>
                                {preset.applicable_pages.length > 0 && (
                                  <div>
                                    <span className="font-medium">ใช้ในหน้า:</span> {preset.applicable_pages.join(', ')}
                                  </div>
                                )}
                                {preset.suggested_models.length > 0 && (
                                  <div>
                                    <span className="font-medium">แนะนำ Model:</span> {preset.suggested_models.join(', ')}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary */}
      {enabledPresets.length > 0 && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800">
            <Sparkles className="w-4 h-4" />
            <span className="font-medium">Agent จะทำงานเมื่อ:</span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-green-700">
            {enabledPresets.map(presetId => {
              const preset = presets.find(p => p.id === presetId)
              return preset ? (
                <li key={presetId} className="flex items-center gap-2">
                  <Check className="w-3 h-3" />
                  {preset.name}
                </li>
              ) : null
            })}
          </ul>
        </div>
      )}

      {/* Requirements Notice */}
      {(!agentHasKB || !agentHasGraphRAG) && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">ต้องการ Feature เพิ่มเติม:</p>
            {!agentHasKB && <p>• บาง Triggers ต้องการ Knowledge Base</p>}
            {!agentHasGraphRAG && <p>• บาง Triggers ต้องการ GraphRAG</p>}
          </div>
        </div>
      )}
    </div>
  )
}
