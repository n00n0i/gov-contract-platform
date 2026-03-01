import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  FileText, Upload, CheckCircle, Search, Building2, Calendar, DollarSign,
  AlertCircle, ChevronRight, X, Home, ChevronDown, Brain, Loader2, Eye,
  EyeOff, Save, FileCheck, Sparkles, Edit3, Hash, User, Briefcase,
  FilePlus, FolderOpen, ScanText,
} from 'lucide-react'
import NavigationHeader from '../components/NavigationHeader'
import axios from 'axios'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Contract {
  id: string
  title: string
  contract_number: string
  value: number
  status: string
  start_date: string
  end_date: string
  vendor_name?: string
  contract_type?: string
  project_name?: string
  description?: string
  budget_year?: number
  department_name?: string
}

interface LLMProvider {
  id: string
  name: string
  type?: string
  modelType?: string
  model?: string
}

interface ExtractedData {
  contract_number: string
  title: string
  counterparty: string
  contract_type: string
  contract_value: string
  project_name: string
  start_date: string
  end_date: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTRACT_TYPES = [
  { value: 'procurement', label: 'จัดซื้อ' },
  { value: 'construction', label: 'ก่อสร้าง' },
  { value: 'service', label: 'บริการ' },
  { value: 'consulting', label: 'ที่ปรึกษา' },
  { value: 'maintenance', label: 'ซ่อมบำรุง' },
  { value: 'rental', label: 'เช่า' },
  { value: 'other', label: 'อื่นๆ' },
]

const ATTACH_DOCUMENT_TYPES = [
  { value: 'amendment', label: 'สัญญาแก้ไข' },
  { value: 'guarantee', label: 'หนังสือค้ำประกัน' },
  { value: 'invoice', label: 'ใบแจ้งหนี้' },
  { value: 'receipt', label: 'ใบเสร็จ' },
  { value: 'delivery', label: 'ใบส่งมอบ' },
  { value: 'other', label: 'เอกสารอื่นๆ' },
]

const DEFAULT_PROMPT =
  'สกัดข้อมูลสัญญาจากข้อความ OCR ต่อไปนี้ ตอบในรูปแบบ JSON เท่านั้น ห้ามมีข้อความอื่น:\n' +
  '{\n' +
  '  "contract_number": "เลขที่สัญญา (ถ้าไม่พบ ใส่ null)",\n' +
  '  "title": "ชื่อโครงการ/สัญญา",\n' +
  '  "counterparty": "ชื่อผู้รับจ้าง/คู่สัญญา",\n' +
  '  "contract_type": "service|construction|procurement|consulting|other",\n' +
  '  "contract_value": 0.0,\n' +
  '  "project_name": "ชื่อโครงการ",\n' +
  '  "start_date": "YYYY-MM-DD หรือ null",\n' +
  '  "end_date": "YYYY-MM-DD หรือ null"\n' +
  '}\n\nข้อความ OCR:'

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/tiff',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const api = axios.create({ baseURL: '/api/v1' })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(v)
}
function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH')
}
function statusBadge(s: string) {
  const cls: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    draft: 'bg-gray-100 text-gray-600',
    expired: 'bg-red-100 text-red-700',
    terminated: 'bg-orange-100 text-orange-700',
  }
  const label: Record<string, string> = {
    active: 'ใช้งาน', draft: 'ร่าง', expired: 'หมดอายุ', terminated: 'ยกเลิก',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[s] || 'bg-gray-100 text-gray-600'}`}>
      {label[s] || s}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DocumentUpload() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedId = searchParams.get('contract_id')

  // ── Flow
  const [step, setStep] = useState<'choose' | 'upload' | 'review'>('choose')
  const [uploadMode, setUploadMode] = useState<'main' | 'attach' | null>(null)

  // ── Step 1 – Mode A: LLM config
  const [llmProviders, setLLMProviders] = useState<LLMProvider[]>([])
  const [selectedLLMId, setSelectedLLMId] = useState('')
  const [extractionPrompt, setExtractionPrompt] = useState(DEFAULT_PROMPT)
  const [showPromptEditor, setShowPromptEditor] = useState(false)

  // ── Step 1 – Mode B: contract selection
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loadingContracts, setLoadingContracts] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null)

  // ── Step 2 – upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedDocType, setSelectedDocType] = useState('amendment')
  const [isDraft, setIsDraft] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processingPhase, setProcessingPhase] = useState<'ocr' | 'llm' | null>(null)
  const [ocrEngineName, setOcrEngineName] = useState('Tesseract / pdfplumber')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Step 3 – review
  const [storagePath, setStoragePath] = useState('')
  const [storageBucket, setStorageBucket] = useState('govplatform')
  const [fileSize, setFileSize] = useState(0)
  const [mimeType, setMimeType] = useState('application/pdf')
  const [ocrEngine, setOcrEngine] = useState('')
  const [rawOcrText, setRawOcrText] = useState('')
  const [showRawText, setShowRawText] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [llmError, setLlmError] = useState<string | null>(null)
  const [editData, setEditData] = useState<ExtractedData>({
    contract_number: '', title: '', counterparty: '',
    contract_type: '', contract_value: '', project_name: '',
    start_date: '', end_date: '',
  })
  const [saving, setSaving] = useState(false)
  const [savedDocId, setSavedDocId] = useState<string | null>(null)

  // ── Effects
  useEffect(() => {
    loadLLMProviders()
    loadOCRSettings()
  }, [])

  useEffect(() => {
    if (uploadMode === 'attach' && contracts.length === 0) loadContracts()
  }, [uploadMode])

  useEffect(() => {
    if (!preselectedId) return
    setUploadMode('attach')
    api.get(`/contracts/${preselectedId}`)
      .then(r => {
        const c = r.data.data
        setSelectedContract({
          id: c.id, title: c.title,
          contract_number: c.contract_no || c.contract_number || '',
          value: c.value_original || c.value || 0,
          status: c.status, start_date: c.start_date, end_date: c.end_date,
          vendor_name: c.vendor_name, contract_type: c.contract_type,
          project_name: c.project_name, description: c.description,
          budget_year: c.budget_year, department_name: c.department_name,
        })
        setStep('upload')
      })
      .catch(() => {})
  }, [preselectedId])

  // ── Data loaders
  const loadContracts = async () => {
    setLoadingContracts(true)
    try {
      const r = await api.get('/contracts?page_size=200')
      setContracts(r.data.items || [])
    } finally {
      setLoadingContracts(false)
    }
  }

  const loadLLMProviders = async () => {
    try {
      const r = await api.get('/settings/ai')
      const providers: LLMProvider[] = (r.data.data?.providers || []).filter(
        (p: LLMProvider) => p.modelType === 'llm'
      )
      setLLMProviders(providers)
      // Prefer the activeLLMId if available
      const activeId = r.data.data?.activeLLMId
      const match = providers.find(p => p.id === activeId)
      setSelectedLLMId(match ? match.id : providers[0]?.id || '')
    } catch { /* ignore */ }
  }

  const loadOCRSettings = async () => {
    try {
      const r = await api.get('/settings/ocr')
      const s = r.data.data || {}
      const mode = s.mode || 'default'
      if (mode === 'typhoon') {
        setOcrEngineName(`Typhoon OCR (${s.typhoon_model || 'typhoon-ocr'})`)
      } else if (mode === 'custom') {
        setOcrEngineName(`Custom API (${s.custom_api_model || 'vision model'})`)
      } else {
        setOcrEngineName('Tesseract / pdfplumber')
      }
    } catch { /* ignore */ }
  }

  const loadContractDetail = async (id: string) => {
    try {
      const r = await api.get(`/contracts/${id}`)
      const c = r.data.data
      setContracts(prev => prev.map(p =>
        p.id === id ? { ...p, description: c.description, contract_type: c.contract_type, project_name: c.project_name, budget_year: c.budget_year, department_name: c.department_name } : p
      ))
    } catch { /* ignore */ }
  }

  // ── Step 1 handlers
  const handleSelectMode = (mode: 'main' | 'attach') => {
    setUploadMode(mode)
    setSelectedContract(null)
    setSearchQuery('')
  }

  const handleSelectContract = (c: Contract) => setSelectedContract(c)

  const handleExpandContract = (id: string) => {
    if (expandedContractId === id) {
      setExpandedContractId(null)
    } else {
      setExpandedContractId(id)
      loadContractDetail(id)
    }
  }

  // ── Step 2 handlers
  const handleFileSelect = (f: File) => {
    if (!ALLOWED_TYPES.includes(f.type) && f.size > 0) {
      alert('ไฟล์ที่รองรับ: PDF, JPG, PNG, TIFF, DOC, DOCX')
      return
    }
    if (f.size > 100 * 1024 * 1024) { alert('ขนาดไฟล์ไม่เกิน 100MB'); return }
    setSelectedFile(f)
  }

  const handleProcessFile = async () => {
    if (!selectedFile) return
    setProcessing(true)
    setProcessingPhase('ocr')

    // Switch to LLM phase after ~8s (OCR typically takes 5-15s)
    phaseTimerRef.current = setTimeout(() => setProcessingPhase('llm'), 8000)

    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      if (selectedLLMId) fd.append('llm_provider_id', selectedLLMId)
      fd.append('extraction_prompt', extractionPrompt)

      const r = await api.post('/documents/ocr-preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const d = r.data.data
      setStoragePath(d.storage_path)
      setStorageBucket(d.storage_bucket)
      setFileSize(d.file_size)
      setMimeType(d.mime_type)
      setOcrEngine(d.ocr_engine || 'unknown')
      setRawOcrText(d.extracted_text || '')
      setOcrError(d.ocr_error || null)
      setLlmError(d.llm_error || null)

      const ext = d.extracted_data || {}
      setEditData({
        contract_number: ext.contract_number || selectedContract?.contract_number || '',
        title: ext.title || selectedContract?.title || '',
        counterparty: ext.counterparty || selectedContract?.vendor_name || '',
        contract_type: ext.contract_type || selectedContract?.contract_type || '',
        contract_value: ext.contract_value ? String(ext.contract_value) : selectedContract?.value ? String(selectedContract.value) : '',
        project_name: ext.project_name || selectedContract?.project_name || '',
        start_date: ext.start_date || selectedContract?.start_date || '',
        end_date: ext.end_date || selectedContract?.end_date || '',
      })
      setStep('review')
    } catch (e: any) {
      alert(e.response?.data?.detail || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current)
      setProcessing(false)
      setProcessingPhase(null)
    }
  }

  // ── Step 3 handler
  const handleSave = async () => {
    setSaving(true)
    try {
      let contractId: string | null = null

      if (uploadMode === 'main') {
        const r = await api.post('/contracts', {
          title: editData.title || 'สัญญาใหม่',
          contract_no: editData.contract_number || undefined,
          vendor_name: editData.counterparty || undefined,
          contract_type: editData.contract_type || 'procurement',
          value: parseFloat(editData.contract_value) || 0,
          start_date: editData.start_date || undefined,
          end_date: editData.end_date || undefined,
          project_name: editData.project_name || undefined,
          status: 'active',
        })
        contractId = r.data.data.id
      } else {
        contractId = selectedContract?.id || null
      }

      const r = await api.post('/documents/confirm', {
        storage_path: storagePath,
        storage_bucket: storageBucket,
        filename: selectedFile?.name || 'document',
        file_size: fileSize,
        mime_type: mimeType,
        contract_id: contractId || undefined,
        document_type: uploadMode === 'main' ? 'contract' : selectedDocType,
        is_draft: isDraft,
        is_main_document: uploadMode === 'main' ? true : !isDraft,
        extracted_text: rawOcrText,
        extracted_data: {
          contract_number: editData.contract_number || undefined,
          title: editData.title || undefined,
          counterparty: editData.counterparty || undefined,
          contract_type: editData.contract_type || undefined,
          contract_value: editData.contract_value ? parseFloat(editData.contract_value) : undefined,
          project_name: editData.project_name || undefined,
          start_date: editData.start_date || undefined,
          end_date: editData.end_date || undefined,
        },
      })
      setSavedDocId(r.data.data.id)
    } catch (e: any) {
      alert(e.response?.data?.detail || 'บันทึกไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setStep('choose')
    setUploadMode(null)
    setSelectedContract(null)
    setSelectedFile(null)
    setStoragePath('')
    setEditData({ contract_number: '', title: '', counterparty: '', contract_type: '', contract_value: '', project_name: '', start_date: '', end_date: '' })
    setRawOcrText('')
    setOcrError(null)
    setLlmError(null)
    setSavedDocId(null)
    setSearchQuery('')
    setSelectedDocType('amendment')
    setIsDraft(false)
  }

  // ── Computed
  const filtered = contracts.filter(c =>
    (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.contract_number || '').includes(searchQuery) ||
    (c.vendor_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const canProceedStep1 = uploadMode === 'main' || (uploadMode === 'attach' && !!selectedContract)

  const progressSteps = [
    { key: 'choose', label: 'เลือกประเภท', done: canProceedStep1 && step !== 'choose' },
    { key: 'upload', label: 'อัพโหลด & ประมวลผล', done: !!storagePath },
    { key: 'review', label: 'ตรวจสอบ & บันทึก', done: !!savedDocId },
  ]

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader
        title="อัปโหลดเอกสาร"
        subtitle="Upload & Smart Extraction"
        breadcrumbs={[{ label: 'อัปโหลด' }]}
      />

      <main className="max-w-5xl mx-auto px-4 py-6">

        {/* Progress bar */}
        <div className="flex items-center justify-center mb-8">
          {progressSteps.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div className={`flex items-center gap-2 ${step === s.key ? 'text-blue-600' : s.done ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm
                  ${step === s.key ? 'bg-blue-100 ring-2 ring-blue-400' : s.done ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {s.done && step !== s.key ? <CheckCircle className="w-5 h-5" /> : i + 1}
                </div>
                <span className="font-medium text-sm">{s.label}</span>
              </div>
              {i < progressSteps.length - 1 && <ChevronRight className="w-4 h-4 mx-3 text-gray-300" />}
            </div>
          ))}
        </div>

        {/* ──────────────────────────────────────────────────────
            STEP 1: CHOOSE MODE
        ────────────────────────────────────────────────────── */}
        {step === 'choose' && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-xl font-bold text-gray-900">เลือกประเภทการอัพโหลด</h2>
              <p className="text-sm text-gray-500 mt-1">กรุณาเลือกว่าต้องการอัพโหลดสัญญาใหม่ หรือเพิ่มเอกสารในสัญญาที่มีอยู่</p>
            </div>

            {/* Mode cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card A: Main contract */}
              <button
                onClick={() => handleSelectMode('main')}
                className={`p-6 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                  uploadMode === 'main'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  uploadMode === 'main' ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  <FilePlus className={`w-6 h-6 ${uploadMode === 'main' ? 'text-blue-600' : 'text-gray-500'}`} />
                </div>
                <h3 className={`font-bold text-lg mb-2 ${uploadMode === 'main' ? 'text-blue-900' : 'text-gray-900'}`}>
                  อัพโหลดสัญญาหลักใหม่
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  อัพโหลดไฟล์สัญญา — AI จะถอดข้อมูลสำคัญจากเอกสารโดยอัตโนมัติ และสร้างรายการสัญญาใหม่ในระบบ
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-500" />
                  <span className="text-xs text-purple-600 font-medium">ต้องการ AI Model สำหรับถอดข้อมูล</span>
                </div>
                {uploadMode === 'main' && (
                  <div className="mt-3 flex items-center gap-1 text-blue-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-xs font-medium">เลือกแล้ว</span>
                  </div>
                )}
              </button>

              {/* Card B: Attach to existing */}
              <button
                onClick={() => handleSelectMode('attach')}
                className={`p-6 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                  uploadMode === 'attach'
                    ? 'border-green-500 bg-green-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-green-300'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  uploadMode === 'attach' ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <FolderOpen className={`w-6 h-6 ${uploadMode === 'attach' ? 'text-green-600' : 'text-gray-500'}`} />
                </div>
                <h3 className={`font-bold text-lg mb-2 ${uploadMode === 'attach' ? 'text-green-900' : 'text-gray-900'}`}>
                  เพิ่มเอกสารในสัญญาที่มีอยู่
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  เลือกสัญญาที่มีอยู่แล้วในระบบ และแนบเอกสารเพิ่มเติม เช่น ใบแจ้งหนี้ ใบส่งมอบ หรือสัญญาแก้ไข
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-600 font-medium">เลือกสัญญาก่อนอัพโหลด</span>
                </div>
                {uploadMode === 'attach' && (
                  <div className="mt-3 flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-xs font-medium">เลือกแล้ว</span>
                  </div>
                )}
              </button>
            </div>

            {/* Mode A: LLM config panel */}
            {uploadMode === 'main' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Brain className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">ตั้งค่า AI สกัดข้อมูล</h3>
                </div>

                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">AI Model</label>
                  {llmProviders.length === 0 ? (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>ไม่พบ LLM Provider — <a href="/settings?tab=ai" className="underline">ไปตั้งค่า AI</a></span>
                    </div>
                  ) : (
                    <select
                      value={selectedLLMId}
                      onChange={e => setSelectedLLMId(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                    >
                      {llmProviders.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.model ? ` (${p.model})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">System Prompt</label>
                    <button
                      onClick={() => setShowPromptEditor(p => !p)}
                      className="text-xs text-purple-600 hover:underline flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {showPromptEditor ? 'ซ่อน' : 'แก้ไข Prompt'}
                    </button>
                  </div>
                  {showPromptEditor ? (
                    <div>
                      <textarea
                        value={extractionPrompt}
                        onChange={e => setExtractionPrompt(e.target.value)}
                        rows={8}
                        className="w-full border rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-purple-500 resize-y"
                      />
                      <button
                        onClick={() => setExtractionPrompt(DEFAULT_PROMPT)}
                        className="text-xs text-gray-500 hover:text-gray-700 underline mt-1"
                      >
                        รีเซ็ตเป็นค่าเริ่มต้น
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 border font-mono leading-relaxed line-clamp-2">
                      {extractionPrompt.split('\n')[0]}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mode B: Contract selector */}
            {uploadMode === 'attach' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Search className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-gray-900">เลือกสัญญา</h3>
                </div>

                {/* Selected contract badge */}
                {selectedContract && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-green-900">{selectedContract.title}</p>
                        <p className="text-xs text-green-700">
                          {selectedContract.contract_number && `เลขที่ ${selectedContract.contract_number} · `}
                          {selectedContract.vendor_name}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedContract(null)} className="p-1 hover:bg-green-100 rounded">
                      <X className="w-4 h-4 text-green-600" />
                    </button>
                  </div>
                )}

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อสัญญา, เลขที่, หรือผู้รับจ้าง..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                    autoFocus
                  />
                </div>

                <div className="space-y-2 max-h-[360px] overflow-y-auto">
                  {loadingContracts ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-green-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">กำลังโหลด...</p>
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">ไม่พบสัญญา</p>
                      {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="text-xs text-blue-600 hover:underline mt-1">ล้างการค้นหา</button>
                      )}
                    </div>
                  ) : filtered.map(c => {
                    const isExpanded = expandedContractId === c.id
                    const isSelected = selectedContract?.id === c.id
                    return (
                      <div key={c.id} className={`border rounded-lg overflow-hidden transition ${isSelected ? 'border-green-400' : 'border-gray-200'}`}>
                        <div
                          className={`flex items-start p-3 gap-3 cursor-pointer ${isSelected ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-50'}`}
                          onClick={() => handleSelectContract(c)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900 text-sm">{c.title}</span>
                              {statusBadge(c.status)}
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-0.5">
                              {c.contract_number && <span><Hash className="w-3 h-3 inline mr-0.5" />{c.contract_number}</span>}
                              {c.vendor_name && <span><User className="w-3 h-3 inline mr-0.5" />{c.vendor_name}</span>}
                              {c.value > 0 && <span><DollarSign className="w-3 h-3 inline mr-0.5" />{fmt(c.value)}</span>}
                              {(c.start_date || c.end_date) && (
                                <span><Calendar className="w-3 h-3 inline mr-0.5" />{fmtDate(c.start_date)} – {fmtDate(c.end_date)}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={e => { e.stopPropagation(); handleExpandContract(c.id) }}
                              className="p-1 hover:bg-gray-100 rounded text-gray-400"
                            >
                              <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            {isSelected
                              ? <CheckCircle className="w-4 h-4 text-green-500" />
                              : <ChevronRight className="w-4 h-4 text-gray-300" />
                            }
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-4 pb-3 pt-1 bg-gray-50 border-t text-xs text-gray-600">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              {c.project_name && <div><span className="text-gray-400">โครงการ:</span> {c.project_name}</div>}
                              {c.budget_year && <div><span className="text-gray-400">ปีงบ:</span> {c.budget_year}</div>}
                              {(c.start_date || c.end_date) && (
                                <div className="col-span-2"><span className="text-gray-400">ระยะเวลา:</span> {fmtDate(c.start_date)} – {fmtDate(c.end_date)}</div>
                              )}
                              {c.description && <div className="col-span-2"><span className="text-gray-400">คำอธิบาย:</span> {c.description}</div>}
                            </div>
                            <button
                              onClick={() => handleSelectContract(c)}
                              className="mt-2 w-full py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition font-medium"
                            >
                              เลือกสัญญานี้
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {!loadingContracts && filtered.length > 0 && (
                  <p className="text-xs text-gray-400 text-right mt-2">
                    {filtered.length} สัญญา{searchQuery ? ` (จาก ${contracts.length})` : ''}
                  </p>
                )}
              </div>
            )}

            {/* Continue button */}
            {uploadMode && (
              <div className="flex justify-end">
                <button
                  onClick={() => setStep('upload')}
                  disabled={!canProceedStep1}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  ไปขั้นตอนถัดไป <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────
            STEP 2: UPLOAD + PROCESS
        ────────────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="space-y-5">
            {/* Context banner */}
            <div className={`rounded-xl p-4 flex items-center justify-between border ${
              uploadMode === 'main' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center gap-3">
                {uploadMode === 'main'
                  ? <FilePlus className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  : <Building2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                }
                <div>
                  <p className={`text-sm font-medium ${uploadMode === 'main' ? 'text-blue-900' : 'text-green-900'}`}>
                    {uploadMode === 'main'
                      ? 'สัญญาหลักใหม่ — AI จะถอดข้อมูลอัตโนมัติ'
                      : `สัญญา: ${selectedContract?.title}`
                    }
                  </p>
                  {uploadMode === 'attach' && selectedContract && (
                    <p className="text-xs text-green-700">
                      {selectedContract.contract_number && `เลขที่ ${selectedContract.contract_number} · `}
                      {selectedContract.vendor_name}
                    </p>
                  )}
                  {uploadMode === 'main' && selectedLLMId && (
                    <p className="text-xs text-blue-600">
                      AI: {llmProviders.find(p => p.id === selectedLLMId)?.name || selectedLLMId}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => { setStep('choose'); setSelectedFile(null) }}
                className={`p-1.5 rounded-lg ${uploadMode === 'main' ? 'hover:bg-blue-100' : 'hover:bg-green-100'}`}
              >
                <X className={`w-4 h-4 ${uploadMode === 'main' ? 'text-blue-500' : 'text-green-500'}`} />
              </button>
            </div>

            {/* Attach mode: document type + draft toggle */}
            {uploadMode === 'attach' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold text-gray-900 mb-4">ประเภทเอกสาร</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
                  {ATTACH_DOCUMENT_TYPES.map(dt => (
                    <button
                      key={dt.value}
                      onClick={() => setSelectedDocType(dt.value)}
                      className={`p-3 rounded-lg border-2 text-left transition text-sm ${
                        selectedDocType === dt.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className={`font-medium ${selectedDocType === dt.value ? 'text-blue-700' : 'text-gray-800'}`}>
                        {dt.label}
                      </p>
                    </button>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">สถานะเอกสาร</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsDraft(false)}
                      className={`flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition ${
                        !isDraft ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <FileCheck className="w-4 h-4 inline mr-1.5" />เอกสารหลัก
                    </button>
                    <button
                      onClick={() => setIsDraft(true)}
                      className={`flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition ${
                        isDraft ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Edit3 className="w-4 h-4 inline mr-1.5" />เอกสารร่าง
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* File upload */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">
                  {uploadMode === 'main' ? 'อัพโหลดไฟล์สัญญา' : 'อัพโหลดเอกสาร'}
                </h3>
                {/* OCR engine badge */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <ScanText className="w-3.5 h-3.5" />
                  OCR: {ocrEngineName}
                </span>
              </div>
              {!selectedFile ? (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]) }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition ${
                    dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'
                  }`}
                >
                  <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="font-medium text-gray-700">ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือก</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, TIFF, DOC, DOCX · สูงสุด 100MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.tiff,.doc,.docx"
                    className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]) }}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-4 p-4 border rounded-xl bg-green-50 border-green-200">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button onClick={() => setSelectedFile(null)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Processing progress (shown while processing) */}
            {processing && (
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600 flex-shrink-0" />
                  <p className="font-medium text-gray-800">กำลังประมวลผล...</p>
                </div>
                <div className="flex gap-3">
                  {/* Phase 1: OCR */}
                  <div className={`flex-1 rounded-lg p-3 border-2 transition-all ${
                    processingPhase === 'ocr'
                      ? 'border-indigo-400 bg-indigo-50'
                      : processingPhase === 'llm'
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {processingPhase === 'llm'
                        ? <CheckCircle className="w-4 h-4 text-green-500" />
                        : <ScanText className={`w-4 h-4 ${processingPhase === 'ocr' ? 'text-indigo-600 animate-pulse' : 'text-gray-400'}`} />
                      }
                      <span className={`text-sm font-medium ${
                        processingPhase === 'ocr' ? 'text-indigo-700' : processingPhase === 'llm' ? 'text-green-700' : 'text-gray-500'
                      }`}>
                        ขั้นที่ 1: OCR
                      </span>
                    </div>
                    <p className={`text-xs ${processingPhase === 'ocr' ? 'text-indigo-600' : 'text-gray-400'}`}>
                      {ocrEngineName}
                    </p>
                  </div>
                  {/* Arrow */}
                  <div className="flex items-center text-gray-300">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                  {/* Phase 2: LLM */}
                  <div className={`flex-1 rounded-lg p-3 border-2 transition-all ${
                    processingPhase === 'llm'
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Brain className={`w-4 h-4 ${processingPhase === 'llm' ? 'text-purple-600 animate-pulse' : 'text-gray-400'}`} />
                      <span className={`text-sm font-medium ${processingPhase === 'llm' ? 'text-purple-700' : 'text-gray-400'}`}>
                        ขั้นที่ 2: AI ถอดข้อมูล
                      </span>
                    </div>
                    <p className={`text-xs ${processingPhase === 'llm' ? 'text-purple-600' : 'text-gray-400'}`}>
                      {selectedLLMId
                        ? llmProviders.find(p => p.id === selectedLLMId)?.name || 'LLM'
                        : 'ไม่ได้ตั้งค่า LLM'
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setStep('choose'); setSelectedFile(null) }}
                className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                disabled={processing}
              >
                ← ย้อนกลับ
              </button>
              <button
                onClick={handleProcessFile}
                disabled={!selectedFile || processing}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {processing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลังประมวลผล...</>
                  : <><Sparkles className="w-4 h-4" /> เริ่มประมวลผล OCR + AI</>
                }
              </button>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────
            STEP 3: REVIEW + SAVE
        ────────────────────────────────────────────────────── */}
        {step === 'review' && !savedDocId && (
          <div className="space-y-5">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border p-5 flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-900">ตรวจสอบและแก้ไขข้อมูล</h2>
                <p className="text-sm text-gray-500">
                  ไฟล์: <span className="font-medium">{selectedFile?.name}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    ocrError ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    <ScanText className="w-3 h-3" />
                    OCR: {ocrEngine}
                    {ocrError && ' ⚠'}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    llmError ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    <Brain className="w-3 h-3" />
                    AI: {llmError ? 'ไม่สำเร็จ ⚠' : 'สกัดข้อมูลแล้ว'}
                  </span>
                  {rawOcrText && (
                    <span className="text-xs text-gray-400">
                      ({rawOcrText.length.toLocaleString()} ตัวอักษร)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* OCR / LLM error banners */}
            {ocrError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-sm text-red-800">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium mb-0.5">OCR ล้มเหลว</p>
                  <p className="text-xs text-red-600">{ocrError}</p>
                </div>
              </div>
            )}
            {llmError && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-sm text-amber-800">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium mb-0.5">AI ถอดข้อมูลไม่สำเร็จ — กรุณากรอกข้อมูลด้านล่างด้วยตนเอง</p>
                  <p className="text-xs text-amber-600">{llmError}</p>
                </div>
              </div>
            )}

            {/* Editable fields */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600" />
                ข้อมูลสัญญา
                {uploadMode === 'main' && (
                  <span className="text-xs font-normal text-gray-400 ml-1">(จะถูกสร้างเป็นสัญญาใหม่)</span>
                )}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">เลขที่สัญญา</label>
                  <input value={editData.contract_number} onChange={e => setEditData(p => ({ ...p, contract_number: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">ชื่อสัญญา/โครงการ</label>
                  <input value={editData.title} onChange={e => setEditData(p => ({ ...p, title: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">ผู้รับจ้าง/คู่สัญญา</label>
                  <input value={editData.counterparty} onChange={e => setEditData(p => ({ ...p, counterparty: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">ประเภทสัญญา</label>
                  <select value={editData.contract_type} onChange={e => setEditData(p => ({ ...p, contract_type: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">— เลือก —</option>
                    {CONTRACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">มูลค่าสัญญา (บาท)</label>
                  <input type="number" value={editData.contract_value} onChange={e => setEditData(p => ({ ...p, contract_value: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">ชื่อโครงการ</label>
                  <input value={editData.project_name} onChange={e => setEditData(p => ({ ...p, project_name: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">วันที่เริ่มต้น</label>
                  <input type="date" value={editData.start_date} onChange={e => setEditData(p => ({ ...p, start_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">วันที่สิ้นสุด</label>
                  <input type="date" value={editData.end_date} onChange={e => setEditData(p => ({ ...p, end_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {/* Raw OCR text (collapsible) */}
            {rawOcrText && (
              <div className="bg-white rounded-xl shadow-sm border">
                <button
                  onClick={() => setShowRawText(p => !p)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
                >
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    ข้อความ OCR ดิบ ({rawOcrText.length.toLocaleString()} ตัวอักษร)
                  </span>
                  {showRawText ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                </button>
                {showRawText && (
                  <div className="px-4 pb-4">
                    <pre className="bg-gray-900 text-green-300 text-xs rounded-lg p-4 overflow-x-auto max-h-60 whitespace-pre-wrap font-mono leading-relaxed">
                      {rawOcrText}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Info note */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">ข้อมูลจะถูกบันทึกเมื่อกด "บันทึก"</p>
                <p>บันทึกลง PostgreSQL · MinIO · VectorDB (RAG) · Neo4j (GraphRAG)</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between">
              <button onClick={() => setStep('upload')} className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                ← ย้อนกลับ
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-7 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลังบันทึก...</>
                  : <><Save className="w-4 h-4" /> บันทึก</>
                }
              </button>
            </div>
          </div>
        )}

        {/* ── Success ───────────────────────────────────────────── */}
        {savedDocId && (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-9 h-9 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">บันทึกสำเร็จ!</h2>
            <p className="text-gray-500 mb-1">
              เอกสาร <span className="font-medium">{selectedFile?.name}</span> ถูกบันทึกแล้ว
            </p>
            <p className="text-sm text-gray-400 mb-8">ข้อความ OCR กำลัง index ลง ContractRAG + GraphRAG ในพื้นหลัง</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                <Upload className="w-4 h-4" />อัพโหลดเพิ่มเติม
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                <Home className="w-4 h-4" />กลับหน้าแรก
              </button>
              {selectedContract && (
                <button
                  onClick={() => navigate(`/contracts/${selectedContract.id}`)}
                  className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  <FileText className="w-4 h-4" />ดูสัญญา
                </button>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
