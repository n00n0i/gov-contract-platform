import { useState, useEffect } from 'react'
import { 
  Plus, Trash2, GripVertical, ChevronUp, ChevronDown,
  FileText, Save, X, AlertCircle, CheckCircle
} from 'lucide-react'
import { createTemplate, getTemplateTypes } from '../services/templateService'

interface CreateTemplateProps {
  onClose: () => void
  onSuccess: () => void
}

interface Clause {
  id: string
  number: number
  title: string
  content: string
}

export default function CreateTemplate({ onClose, onSuccess }: CreateTemplateProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templateTypes, setTemplateTypes] = useState<{value: string, label: string}[]>([])
  
  // Form state
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [description, setDescription] = useState('')
  const [clauses, setClauses] = useState<Clause[]>([
    { id: '1', number: 1, title: '', content: '' }
  ])
  
  useEffect(() => {
    loadTemplateTypes()
  }, [])
  
  const loadTemplateTypes = async () => {
    try {
      const types = await getTemplateTypes()
      setTemplateTypes(types || [])
      if (types && types.length > 0) {
        setType(types[0].value)
      }
    } catch (err) {
      console.error('Failed to load template types:', err)
      // Set default types if API fails
      setTemplateTypes([
        { value: 'procurement', label: 'จัดซื้อจัดจ้าง' },
        { value: 'construction', label: 'ก่อสร้าง' },
        { value: 'service', label: 'บริการ' },
        { value: 'consultant', label: 'ที่ปรึกษา' },
        { value: 'rental', label: 'เช่า' },
        { value: 'software', label: 'ไอที/ซอฟต์แวร์' }
      ])
      setType('procurement')
    }
  }
  
  const addClause = () => {
    const newNumber = clauses.length + 1
    setClauses([...clauses, {
      id: Date.now().toString(),
      number: newNumber,
      title: '',
      content: ''
    }])
  }
  
  const removeClause = (id: string) => {
    if (clauses.length <= 1) {
      setError('ต้องมีข้อกำหนดอย่างน้อย 1 ข้อ')
      return
    }
    const updated = clauses.filter(c => c.id !== id)
    // Renumber clauses
    const renumbered = updated.map((c, idx) => ({
      ...c,
      number: idx + 1
    }))
    setClauses(renumbered)
    setError(null)
  }
  
  const updateClause = (id: string, field: keyof Clause, value: string) => {
    setClauses(clauses.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ))
  }
  
  const moveClause = (id: string, direction: 'up' | 'down') => {
    const index = clauses.findIndex(c => c.id === id)
    if (index === -1) return
    
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === clauses.length - 1) return
    
    const newClauses = [...clauses]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    
    // Swap using temp variable (avoid JSX parsing issue)
    const temp = newClauses[index]
    newClauses[index] = newClauses[targetIndex]
    newClauses[targetIndex] = temp
    
    // Renumber
    const renumbered = newClauses.map((c, idx) => ({
      ...c,
      number: idx + 1
    }))
    
    setClauses(renumbered)
  }
  
  const validateForm = () => {
    if (!name.trim()) {
      setError('กรุณาระบุชื่อ Template')
      return false
    }
    if (!type) {
      setError('กรุณาเลือกประเภทสัญญา')
      return false
    }
    
    // Check if all clauses have title
    const emptyClauses = clauses.filter(c => !c.title.trim())
    if (emptyClauses.length > 0) {
      setError(`ข้อที่ ${emptyClauses[0].number} ยังไม่มีหัวข้อ`)
      return false
    }
    
    setError(null)
    return true
  }
  
  const handleSave = async () => {
    if (!validateForm()) return
    
    setSaving(true)
    try {
      const templateData = {
        name: name.trim(),
        type,
        description: description.trim(),
        clauses_data: clauses.map(c => ({
          number: c.number,
          title: c.title.trim(),
          content: c.content.trim()
        }))
      }
      
      await createTemplate(templateData)
      onSuccess()
    } catch (err: any) {
      console.error('Failed to create template:', err)
      setError(err.response?.data?.detail || 'ไม่สามารถสร้าง Template ได้')
    } finally {
      setSaving(false)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">สร้าง Template ใหม่</h2>
              <p className="text-sm text-gray-500">สร้างแม่แบบสัญญาสำหรับใช้งานซ้ำ</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-gray-900">ข้อมูลพื้นฐาน</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ชื่อ Template <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="เช่น สัญญาจัดซื้อจัดจ้างทั่วไป"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ประเภทสัญญา <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">เลือกประเภท</option>
                    {templateTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  คำอธิบาย
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="คำอธิบายเกี่ยวกับ Template นี้..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            {/* Clauses */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">ข้อกำหนดในสัญญา</h3>
                <span className="text-sm text-gray-500">
                  จำนวน {clauses.length} ข้อ
                </span>
              </div>
              
              <div className="space-y-3">
                {clauses.map((clause, index) => (
                  <div 
                    key={clause.id}
                    className="bg-white border rounded-lg p-4 hover:border-blue-300 transition"
                  >
                    <div className="flex items-start gap-3">
                      {/* Drag handle & Number */}
                      <div className="flex flex-col items-center gap-1 pt-1">
                        <div className="p-1 hover:bg-gray-100 rounded cursor-move">
                          <GripVertical className="w-4 h-4 text-gray-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-500 w-6 text-center">
                          {clause.number}
                        </span>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 space-y-3">
                        <input
                          type="text"
                          value={clause.title}
                          onChange={(e) => updateClause(clause.id, 'title', e.target.value)}
                          placeholder={`หัวข้อข้อที่ ${clause.number}`}
                          className="w-full px-3 py-2 border rounded-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <textarea
                          value={clause.content}
                          onChange={(e) => updateClause(clause.id, 'content', e.target.value)}
                          placeholder="เนื้อหาข้อกำหนด..."
                          rows={3}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      {/* Actions */}
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveClause(clause.id, 'up')}
                          disabled={index === 0}
                          className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"
                          title="เลื่อนขึ้น"
                        >
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => moveClause(clause.id, 'down')}
                          disabled={index === clauses.length - 1}
                          className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"
                          title="เลื่อนลง"
                        >
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => removeClause(clause.id)}
                          className="p-1.5 hover:bg-red-100 rounded text-red-500"
                          title="ลบข้อนี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Add Clause Button */}
              <button
                onClick={addClause}
                className="mt-3 w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                เพิ่มข้อกำหนด
              </button>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                บันทึก Template
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
