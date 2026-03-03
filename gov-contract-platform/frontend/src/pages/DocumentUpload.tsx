import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  FileText, Upload, CheckCircle, Search, Calendar, DollarSign,
  AlertCircle, ChevronRight, X, Home, ChevronDown, Brain, Loader2, Eye,
  FileCheck, Edit3, Hash, User,
  FilePlus, FolderOpen, ScanText, Settings2,
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
  documents?: { id: string; filename: string; document_type: string; created_at: string }[]
}

interface LLMProvider {
  id: string
  name: string
  type?: string
  modelType?: string
  model?: string
}

interface DocumentJob {
  id: string
  filename: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  contract_id: string | null
  contract_title: string | null
  document_type: string
  is_draft: boolean
  is_main_document: boolean
  page_count: number | null
  ocr_engine: string | null
  ocr_error: string | null
  llm_error: string | null
  extracted_text?: string
  extracted_data?: Record<string, unknown>
  created_at: string | null
  completed_at: string | null
}

interface OCROption {
  mode: string
  label: string
  detail: string
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
  '  "end_date": "YYYY-MM-DD หรือ null",\n' +
  '  "summary": "สรุปเนื้อหาสำคัญของสัญญา 3-5 ประโยค"\n' +
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
  return new Intl.NumberFormat('th-TH').format(v) + ' บาท'
}
function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH')
}
function statusBadge(s: string) {
  const config: Record<string, { cls: string; label: string }> = {
    active: { cls: 'bg-green-100 text-green-700', label: 'ดำเนินการ' },
    on_hold: { cls: 'bg-purple-100 text-purple-700', label: 'พักการดำเนินการ' },
    completed: { cls: 'bg-blue-100 text-blue-700', label: 'เสร็จสิ้น' },
    draft: { cls: 'bg-gray-100 text-gray-600', label: 'ร่าง' },
    expired: { cls: 'bg-red-100 text-red-700', label: 'หมดอายุ' },
    terminated: { cls: 'bg-orange-100 text-orange-700', label: 'ยกเลิก' },
  }
  const c = config[s] || { cls: 'bg-gray-100 text-gray-600', label: s }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.cls}`}>
      {c.label}
    </span>
  )
}


// ─── Main Component ───────────────────────────────────────────────────────────

export default function DocumentUpload() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedId = searchParams.get('contract_id')
  const reviewMode = searchParams.get('review') === '1'

  // ── Flow
  const [step, setStep] = useState<'choose' | 'upload' | 'review'>('choose')
  const [uploadMode, setUploadMode] = useState<'main' | 'attach' | null>(null)

  // ── Step 1 – OCR config
  const [ocrOptions, setOcrOptions] = useState<OCROption[]>([
    { mode: 'default', label: 'Tesseract / pdfplumber', detail: 'โหมดเริ่มต้น (ไม่ต้อง API)' },
  ])
  const [selectedOcrMode, setSelectedOcrMode] = useState('default')

  // ── Step 1 – LLM config
  const [llmProviders, setLLMProviders] = useState<LLMProvider[]>([])
  const [selectedLLMId, setSelectedLLMId] = useState('')
  const [extractionPrompt, setExtractionPrompt] = useState(DEFAULT_PROMPT)
  const [showPromptEditor, setShowPromptEditor] = useState(false)

  // ── Step 1 – contract selection
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loadingContracts, setLoadingContracts] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null)

  // ── Step 2 – upload & job tracking
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedDocType, setSelectedDocType] = useState('amendment')
  const [isDraft, setIsDraft] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [ocrEngineName, setOcrEngineName] = useState('Tesseract / pdfplumber')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploadDone, setUploadDone] = useState(false)

  // ── Effects
  useEffect(() => {
    loadLLMProviders()
    loadOCRSettings()
  }, [])

  useEffect(() => {
    if (uploadMode === 'attach') loadContracts()
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
      .catch(() => { })
  }, [preselectedId])



  // ── Data loaders
  const loadContracts = async () => {
    setLoadingContracts(true)
    try {
      const r = await api.get('/contracts?limit=100')
      const items = r.data.items || r.data.data?.items || r.data.data || []
      setContracts(items)
    } catch (err) {
      console.error('Failed to load contracts:', err)
      setContracts([])
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
      const activeId = r.data.data?.activeLLMId
      const match = providers.find(p => p.id === activeId)
      setSelectedLLMId(match ? match.id : providers[0]?.id || '')
    } catch (err) {
      console.error('Failed to load LLM providers:', err)
    }
  }

  const loadOCRSettings = async () => {
    try {
      const r = await api.get('/settings/ocr')
      const s = r.data.data || {}
      const mode = s.mode || 'default'
      // Build OCR model options list
      const opts: OCROption[] = [
        { mode: 'default', label: 'Tesseract / pdfplumber', detail: 'โหมดเริ่มต้น (ไม่ต้อง API)' },
      ]
      if (s.typhoon_key) {
        opts.push({ mode: 'typhoon', label: `Typhoon OCR (${s.typhoon_model || 'typhoon-ocr'})`, detail: 'Cloud OCR สำหรับภาษาไทย' })
      }
      if (s.ollama_url) {
        opts.push({ mode: 'ollama', label: `Ollama (${s.ollama_model || 'vision model'})`, detail: 'Local vision model' })
      }
      if (s.custom_api_url) {
        opts.push({ mode: 'custom', label: `Custom API (${s.custom_api_model || 'vision model'})`, detail: s.custom_api_url })
      }
      setOcrOptions(opts)
      setSelectedOcrMode(mode)
      // Set engine name display
      const matched = opts.find(o => o.mode === mode)
      setOcrEngineName(matched?.label || 'Tesseract / pdfplumber')
    } catch { /* ignore */ }
  }

  const loadContractDetail = async (id: string) => {
    try {
      const r = await api.get(`/contracts/${id}`)
      const c = r.data.data || r.data

      let documents: any[] = []
      try {
        const docRes = await api.get(`/documents?contract_id=${id}`)
        const allDocs = docRes.data.data?.items || docRes.data.items || docRes.data || []
        documents = allDocs.filter((d: any) =>
          d.contract_id === id || d.contractId === id || (d.contract && d.contract.id === id)
        )
      } catch { documents = [] }

      setContracts(prev => prev.map(p =>
        p.id === id ? {
          ...p,
          description: c.description,
          contract_type: c.contract_type,
          project_name: c.project_name,
          budget_year: c.budget_year,
          department_name: c.department_name,
          documents,
        } : p
      ))
    } catch (err) {
      console.error('Failed to load contract detail:', err)
    }
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

  const handleUploadJob = async () => {
    if (!selectedFile) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      if (selectedContract?.id) fd.append('contract_id', selectedContract.id)
      fd.append('document_type', uploadMode === 'main' ? 'contract' : selectedDocType)
      fd.append('is_draft', String(isDraft))
      fd.append('is_main_document', String(uploadMode === 'main' ? true : !isDraft))
      if (selectedLLMId) fd.append('llm_provider_id', selectedLLMId)
      if (extractionPrompt && extractionPrompt !== DEFAULT_PROMPT) {
        fd.append('extraction_prompt', extractionPrompt)
      }
      await api.post('/documents/jobs', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      // Upload done — reset file, show success flash
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setUploadDone(true)
      setTimeout(() => setUploadDone(false), 6000)
    } catch (e: any) {
      alert(e.response?.data?.detail || 'อัพโหลดไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setUploading(false)
    }
  }

  // ── Computed
  const filtered = contracts.filter(c => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return true
    return (
      (c.title || '').toLowerCase().includes(query) ||
      (c.contract_number || '').toLowerCase().includes(query) ||
      (c.vendor_name || '').toLowerCase().includes(query) ||
      (c.contract_type || '').toLowerCase().includes(query) ||
      (c.project_name || '').toLowerCase().includes(query)
    )
  })

  const canProceedStep1 = uploadMode === 'main' || (uploadMode === 'attach' && !!selectedContract)

  const progressSteps = [
    { key: 'choose', label: 'เลือกประเภท', done: canProceedStep1 && step !== 'choose' },
    { key: 'upload', label: 'อัพโหลด & ประมวลผล', done: false },
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
            STEP 1: CHOOSE MODE + CONFIG + FILE SELECT
        ────────────────────────────────────────────────────── */}
        {step === 'choose' && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-xl font-bold text-gray-900">เลือกประเภทการอัพโหลด</h2>
              <p className="text-sm text-gray-500 mt-1">ตั้งค่า OCR · AI · เลือกไฟล์ และอัพโหลดได้ในหน้าเดียว</p>
            </div>

            {/* Mode cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => handleSelectMode('main')}
                className={`p-6 rounded-xl border-2 text-left transition-all hover:shadow-md ${uploadMode === 'main' ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-300'
                  }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${uploadMode === 'main' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <FilePlus className={`w-6 h-6 ${uploadMode === 'main' ? 'text-blue-600' : 'text-gray-500'}`} />
                </div>
                <h3 className={`font-bold text-lg mb-2 ${uploadMode === 'main' ? 'text-blue-900' : 'text-gray-900'}`}>สัญญาหลักใหม่</h3>
                <p className="text-sm text-gray-500">สร้างรายการสัญญาใหม่ — AI จะถอดข้อมูลสำคัญอัตโนมัติ</p>
                {uploadMode === 'main' && (
                  <div className="mt-3 flex items-center gap-1 text-blue-600">
                    <CheckCircle className="w-4 h-4" /><span className="text-xs font-medium">เลือกแล้ว</span>
                  </div>
                )}
              </button>

              <button
                onClick={() => handleSelectMode('attach')}
                className={`p-6 rounded-xl border-2 text-left transition-all hover:shadow-md ${uploadMode === 'attach' ? 'border-green-500 bg-green-50 shadow-md' : 'border-gray-200 bg-white hover:border-green-300'
                  }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${uploadMode === 'attach' ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <FolderOpen className={`w-6 h-6 ${uploadMode === 'attach' ? 'text-green-600' : 'text-gray-500'}`} />
                </div>
                <h3 className={`font-bold text-lg mb-2 ${uploadMode === 'attach' ? 'text-green-900' : 'text-gray-900'}`}>แนบสัญญาที่มีอยู่</h3>
                <p className="text-sm text-gray-500">เลือกสัญญาแล้วแบบเอกสารเพิ่มเติม เช่น ใบส่งมอบ สัญญาแก้ไข</p>
                {uploadMode === 'attach' && (
                  <div className="mt-3 flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-4 h-4" /><span className="text-xs font-medium">เลือกแล้ว</span>
                  </div>
                )}
              </button>
            </div>

            {/* AI Config Panel – visible for both modes once selected */}
            {uploadMode && (
              <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
                <div className="flex items-center gap-2 mb-1">
                  <Settings2 className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-semibold text-gray-900">ตั้งค่า AI</h3>
                </div>

                {/* OCR Model */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <ScanText className="w-4 h-4 inline mr-1 text-indigo-500" />
                    OCR Model
                  </label>
                  <select
                    value={selectedOcrMode}
                    onChange={e => {
                      setSelectedOcrMode(e.target.value)
                      const o = ocrOptions.find(x => x.mode === e.target.value)
                      setOcrEngineName(o?.label || 'Tesseract / pdfplumber')
                    }}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    {ocrOptions.map(o => (
                      <option key={o.mode} value={o.mode}>{o.label} — {o.detail}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">เปลี่ยนโมดเพิ่มเติมได้ใน <a href="/settings?tab=ocr" className="underline text-indigo-600">ตั้งค่า OCR</a></p>
                </div>

                {/* LLM Model */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Brain className="w-4 h-4 inline mr-1 text-purple-500" />
                    LLM Model (สกัดข้อมูลสัญญา)
                  </label>
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
                        <option key={p.id} value={p.id}>{p.name}{p.model ? ` (${p.model})` : ''}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* System Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">System Prompt (LLM)</label>
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
                        rows={12}
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

            {/* Contract selector (attach mode) */}
            {uploadMode === 'attach' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Search className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-gray-900">เลือกสัญญา</h3>
                </div>

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
                    <div className="text-center py-10 px-4">
                      {searchQuery.trim() ? (
                        <>
                          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <Search className="w-7 h-7 text-amber-400" />
                          </div>
                          <p className="text-gray-600 font-medium text-sm">ไม่พบสัญญาที่ตรงกับ "{searchQuery.trim()}"</p>
                          <button onClick={() => setSearchQuery('')} className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 mt-3">
                            <X className="w-3.5 h-3.5" />ล้างการค้นหา
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <FolderOpen className="w-7 h-7 text-gray-400" />
                          </div>
                          <p className="text-gray-500 text-sm">ยังไม่มีสัญญาในระบบ</p>
                        </>
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
                            {isSelected ? <CheckCircle className="w-4 h-4 text-green-500" /> : <ChevronRight className="w-4 h-4 text-gray-300" />}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-4 pb-3 pt-3 bg-gray-50 border-t">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs mb-4">
                              <div>
                                <span className="text-gray-400 block mb-0.5">เลขที่สัญญา</span>
                                <span className="font-medium text-gray-700">{c.contract_number || '-'}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 block mb-0.5">ชื่อโครงการ</span>
                                <span className="font-medium text-gray-700 truncate block">{c.project_name || '-'}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 block mb-0.5">ระยะเวลาโครงการ</span>
                                <span className="font-medium text-gray-700">{fmtDate(c.start_date)} – {fmtDate(c.end_date)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 block mb-0.5">มูลค่าสัญญา</span>
                                <span className="font-medium text-gray-700">{c.value > 0 ? fmt(c.value) : '-'}</span>
                              </div>
                            </div>
                            <div className="border-t border-gray-200 pt-3 mb-3">
                              <p className="text-xs font-medium text-gray-500 mb-2">รายการเอกสาร</p>
                              {c.documents && c.documents.length > 0 ? (
                                <div className="grid grid-cols-3 gap-2">
                                  {c.documents.map((doc, idx) => (
                                    <div key={doc.id || idx} className="bg-white rounded-lg p-2 border border-gray-200">
                                      <p className="text-xs font-medium text-gray-700 truncate">{doc.filename}</p>
                                      <p className="text-[10px] text-gray-400 mt-0.5">{doc.document_type || 'เอกสาร'}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400 italic">ไม่มีเอกสารแนบ</p>
                              )}
                            </div>
                            <button
                              onClick={() => handleSelectContract(c)}
                              className="w-full py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition font-medium"
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

            {/* Proceed button */}
            {uploadMode && (
              <div className="flex justify-end">
                <button
                  onClick={() => setStep('upload')}
                  disabled={!canProceedStep1}
                  className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-sm
                    ${canProceedStep1
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 hover:shadow-blue-300 hover:shadow-md'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  ถัดไป — อัพโหลดไฟล์
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────
            STEP 2: UPLOAD + JOB TRACKING
        ────────────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="space-y-5">
            {/* Attach mode: document type + draft toggle */}
            {uploadMode === 'attach' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold text-gray-900 mb-4">ประเภทเอกสาร</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
                  {ATTACH_DOCUMENT_TYPES.map(dt => (
                    <button
                      key={dt.value}
                      onClick={() => setSelectedDocType(dt.value)}
                      className={`p-3 rounded-lg border-2 text-left transition text-sm ${selectedDocType === dt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
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
                      className={`flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition ${!isDraft ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                    >
                      <FileCheck className="w-4 h-4 inline mr-1.5" />เอกสารหลัก
                    </button>
                    <button
                      onClick={() => setIsDraft(true)}
                      className={`flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition ${isDraft ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
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
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'
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

            {/* Upload success flash */}
            {uploadDone && (
              <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-green-900 text-sm">อัพโหลดสำเร็จ! ไฟล์อยู่ในคิวประมวลผล</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    ไฟล์กำลังอยู่ในคิวประมวลผล — กรุณารอสักครู่แล้วรีเฟรชหน้าเพื่อตรวจสอบผล
                  </p>
                </div>
              </div>
            )}

            {/* Upload success — replace action buttons */}
            {uploadDone ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-green-900 text-base">อัพโหลดสำเร็จ! ไฟล์อยู่ในคิวประมวลผล</p>
                  <p className="text-sm text-green-700 mt-1">
                    ระบบจะทำการ OCR และ AI extraction โดยอัตโนมัติ — ติดตามผลได้ที่หน้างานประมวลผล
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 flex-wrap pt-1">
                  <button
                    onClick={() => navigate('/jobs')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition shadow-sm"
                  >
                    <Brain className="w-4 h-4" />
                    ดูหน้างานประมวลผล
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition border"
                  >
                    <Home className="w-4 h-4" />
                    กลับหน้าหลัก
                  </button>
                  <button
                    onClick={() => { setUploadDone(false); setSelectedFile(null) }}
                    className="text-sm text-gray-400 hover:text-gray-600 px-3 py-2.5 transition"
                  >
                    อัพโหลดไฟล์เพิ่ม
                  </button>
                </div>
              </div>
            ) : (
              /* Action buttons — only show before upload */
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setStep('choose'); setSelectedFile(null) }}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  ← ย้อนกลับ
                </button>
                <button
                  onClick={handleUploadJob}
                  disabled={!selectedFile || uploading}
                  className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-sm
                    ${selectedFile && !uploading
                      ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  {uploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />กำลังอัพโหลด...</>
                  ) : (
                    <><Upload className="w-4 h-4" />ส่งประมวลผล<ChevronRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            )}

          </div>
        )}

      </main>
    </div>
  )
}
