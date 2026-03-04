import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Brain, CheckCircle, XCircle, Loader2, Clock, RefreshCw,
    FileText, Sparkles, Upload, Search, Home,
    ScanText, AlertCircle, Trash2, History, ChevronDown,
    Calendar, MoreVertical, Save, X, Eye, FileText as FileTextIcon
} from 'lucide-react'
import NavigationHeader from '../components/NavigationHeader'
import axios from 'axios'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocumentJob {
    id: string
    filename: string
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'saved' | 'deleted'
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
    has_ocr_text?: boolean
    extracted_data?: Record<string, unknown>
    created_at: string | null
    completed_at: string | null
}

interface OcrPageStatus {
    id: string
    page_number: number
    status: 'pending' | 'processing' | 'completed' | 'failed'
    ocr_engine: string | null
    word_count: number | null
    attempts: number
    error: string | null
    has_selectable_text: boolean
    updated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const api = axios.create({ baseURL: '/api/v1' })
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

function timeAgo(iso: string | null) {
    if (!iso) return ''
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'เมื่อกี้'
    if (m < 60) return `${m} น.ที่แล้ว`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} ชม.ที่แล้ว`
    return `${Math.floor(h / 24)} วันที่แล้ว`
}

function fmtDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('th-TH', {
        day: '2-digit', month: 'short', year: '2-digit',
        hour: '2-digit', minute: '2-digit',
    })
}

function StatusIcon({ status }: { status: DocumentJob['status'] }) {
    if (status === 'completed' || status === 'saved') return <CheckCircle className="w-4 h-4 text-green-500" />
    if (status === 'failed' || status === 'deleted') return <XCircle className="w-4 h-4 text-red-500" />
    if (status === 'processing') return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
    return <Clock className="w-4 h-4 text-yellow-500" />
}

function statusLabel(s: DocumentJob['status']) {
    return { pending: 'รอดำเนินการ', processing: 'กำลังประมวลผล', completed: 'สำเร็จ', failed: 'ล้มเหลว', saved: 'บันทึกแล้ว', deleted: 'ลบแล้ว' }[s] || s
}

// ─── Pipeline Step Logic ──────────────────────────────────────────────────────

type StepState = 'done' | 'active' | 'error' | 'waiting'

interface PipelineStep {
    label: string
    sublabel: string
    state: StepState
    error?: string
}

function inferPipeline(job: DocumentJob): PipelineStep[] {
    const { status, ocr_engine, ocr_error, llm_error, extracted_text, extracted_data } = job
    const hasOcrText = !!extracted_text && extracted_text.length > 0
    const hasLlmData = !!extracted_data && Object.keys(extracted_data as object).length > 0
    const isProcessing = status === 'processing'
    const isPending = status === 'pending'
    const isFailed = status === 'failed' || status === 'deleted'
    const isCompleted = status === 'completed' || status === 'saved'

    // Step 1: Upload — always done when job exists
    const s1: PipelineStep = { label: 'อัพโหลด', sublabel: 'บันทึกลง MinIO', state: 'done' }

    // Step 2: OCR
    let ocrState: StepState = 'waiting'
    let ocrSub = 'ถอดข้อความ PDF'
    if (isPending) {
        ocrState = 'waiting'
    } else if (isFailed && ocr_error && !hasOcrText) {
        ocrState = 'error'; ocrSub = 'ล้มเหลว'
    } else if (isProcessing && !hasOcrText) {
        ocrState = 'active'; ocrSub = 'กำลังถอดข้อความ...'
    } else if (hasOcrText || isCompleted || (isProcessing && hasOcrText)) {
        ocrState = 'done'; ocrSub = ocr_engine ? `สำเร็จ · ${ocr_engine}` : 'สำเร็จ'
    } else if (isProcessing) {
        ocrState = 'done'; ocrSub = ocr_engine ? `สำเร็จ · ${ocr_engine}` : 'สำเร็จ'
    }
    const s2: PipelineStep = { label: 'OCR', sublabel: ocrSub, state: ocrState, error: ocr_error || undefined }

    // Step 3: LLM Extraction
    let llmState: StepState = 'waiting'
    let llmSub = 'AI สกัดข้อมูล'
    if (isPending || (isProcessing && !hasOcrText)) {
        llmState = 'waiting'
    } else if (isFailed && llm_error) {
        llmState = 'error'; llmSub = 'ล้มเหลว'
    } else if (isProcessing && hasOcrText && !hasLlmData) {
        llmState = 'active'; llmSub = 'AI กำลังวิเคราะห์...'
    } else if (hasLlmData || isCompleted) {
        const n = extracted_data ? Object.values(extracted_data as object).filter(Boolean).length : 0
        llmSub = n > 0 ? `สกัดได้ ${n} ฟิลด์` : 'สำเร็จ'
        llmState = 'done'
    }
    const s3: PipelineStep = { label: 'AI Extraction', sublabel: llmSub, state: llmState, error: llm_error || undefined }

    // Step 4: Ready for review
    const s4: PipelineStep = {
        label: 'พร้อมตรวจสอบ',
        sublabel: isCompleted ? 'รอการยืนยัน' : 'รอประมวลผล',
        state: isCompleted ? 'done' : 'waiting',
    }

    return [s1, s2, s3, s4]
}

// ─── Pipeline visual ──────────────────────────────────────────────────────────

const DOT_CLS: Record<StepState, string> = {
    done: 'bg-green-500 ring-4 ring-green-100',
    active: 'bg-blue-500 ring-4 ring-blue-100',
    error: 'bg-red-500 ring-4 ring-red-100',
    waiting: 'bg-gray-200 ring-4 ring-gray-50',
}
const LABEL_CLS: Record<StepState, string> = {
    done: 'text-green-700 font-semibold',
    active: 'text-blue-700 font-semibold',
    error: 'text-red-700 font-semibold',
    waiting: 'text-gray-400',
}
const SUB_CLS: Record<StepState, string> = {
    done: 'text-green-600', active: 'text-blue-500', error: 'text-red-500', waiting: 'text-gray-400',
}
const LINE_CLS: Record<StepState, string> = {
    done: 'bg-green-300', active: 'bg-blue-200', error: 'bg-red-200', waiting: 'bg-gray-200',
}

function RawTextPreview({ text }: { text: string }) {
    // split by form feed \f which is \x0c
    const rawPages = text.split('\x0c').map(p => p.trim()).filter(Boolean)
    const [page, setPage] = useState(1)

    // Fallback if no \f or only 1 page
    if (rawPages.length <= 1) {
        return (
            <pre className="mt-3 bg-gray-900 border border-gray-700 shadow-inner text-green-300 text-[10px] leading-relaxed rounded-lg p-4 overflow-x-auto w-full max-h-80 whitespace-pre-wrap font-mono">
                {text.substring(0, 1500)}{text.length > 1500 ? '\n\n… (truncated)' : ''}
            </pre>
        )
    }

    const cur = Math.min(Math.max(0, page - 1), rawPages.length - 1)
    return (
        <div className="mt-3 bg-gray-900 border border-gray-700 shadow-inner rounded-lg overflow-hidden flex flex-col">
            <div className="bg-gray-800 px-3 py-2 flex items-center justify-between border-b border-gray-700">
                <span className="text-[10px] font-mono text-gray-300">หน้า {cur + 1} จาก {rawPages.length}</span>
                <div className="flex items-center gap-2">
                    <button
                        disabled={cur === 0}
                        onClick={(e) => { e.preventDefault(); setPage(p => p - 1) }}
                        className="px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-[10px] disabled:opacity-30 disabled:hover:bg-gray-700 transition"
                    >
                        ก่อนหน้า
                    </button>
                    <button
                        disabled={cur === rawPages.length - 1}
                        onClick={(e) => { e.preventDefault(); setPage(p => p + 1) }}
                        className="px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-[10px] disabled:opacity-30 disabled:hover:bg-gray-700 transition"
                    >
                        ถัดไป
                    </button>
                </div>
            </div>
            <pre className="text-green-300 text-[10px] leading-relaxed p-4 overflow-x-auto w-full max-h-80 whitespace-pre-wrap font-mono">
                {rawPages[cur].length > 0 ? rawPages[cur] : '(หน้าว่างเปล่า)'}
            </pre>
        </div>
    )
}

function JobPipeline({ job, onOpenPages }: { job: DocumentJob, onOpenPages: (job: DocumentJob) => void }) {
    const steps = inferPipeline(job)
    const ext = (job.extracted_data || {}) as Record<string, string | number | null>
    const hasExt = Object.keys(ext).length > 0
    const hasOcr = !!job.extracted_text && job.extracted_text.length > 0

    // Key fields to display
    const summaryFields = [
        { label: 'ชื่อโครงการ / สัญญา', value: ext.title || ext.project_name },
        { label: 'ประเภทสัญญา', value: ext.contract_type },
        { label: 'ผู้รับจ้าง / คู่สัญญา', value: ext.counterparty },
        { label: 'มูลค่าสัญญา (บาท)', value: ext.contract_value ? Number(ext.contract_value).toLocaleString('th-TH') : null },
        { label: 'วันเริ่ม', value: ext.start_date },
        { label: 'วันสิ้นสุด', value: ext.end_date },
    ].filter(f => f.value)

    const summary = ext.summary || ext.description

    // Progress % — 25% per done step, +12.5% per active step
    const doneCnt = steps.filter(s => s.state === 'done').length
    const activeCnt = steps.filter(s => s.state === 'active').length
    const pct = Math.min(100, Math.round((doneCnt + activeCnt * 0.5) / steps.length * 100))

    return (
        <div className="border-t border-gray-100 bg-gradient-to-br from-slate-50 to-white">
            {/* ── Pipeline steps ── */}
            <div className="px-5 pt-4 pb-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">ขั้นตอนการประมวลผล</p>
                <div className="flex items-start">
                    {steps.map((step, i) => {
                        const isLast = i === steps.length - 1
                        return (
                            <div key={step.label} className="flex items-start flex-1">
                                <div className="flex flex-col items-center min-w-0">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${DOT_CLS[step.state]}`}>
                                        {step.state === 'done' && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                        {step.state === 'active' && <Loader2 className="w-3 h-3 text-white animate-spin" />}
                                        {step.state === 'error' && <XCircle className="w-3.5 h-3.5 text-white" />}
                                        {step.state === 'waiting' && <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />}
                                    </div>
                                    <p className={`text-[11px] mt-1.5 text-center leading-tight px-0.5 ${LABEL_CLS[step.state]}`}>
                                        {step.label}
                                    </p>
                                    <p className={`text-[10px] text-center leading-tight mt-0.5 px-0.5 ${SUB_CLS[step.state]}`}>
                                        {step.sublabel}
                                    </p>
                                    {step.error && step.state === 'error' && (
                                        <p className="text-[10px] text-red-500 text-center leading-tight mt-1 px-1 max-w-[90px]" title={step.error}>
                                            {step.error.substring(0, 40)}{step.error.length > 40 ? '…' : ''}
                                        </p>
                                    )}
                                </div>
                                {!isLast && (
                                    <div className="flex-1 flex flex-col items-center justify-start mx-1.5 mt-2">
                                        {/* Connector label */}
                                        {i === 0 && job.page_count != null && (
                                            <span className="text-[9px] font-medium text-indigo-500 mb-0.5 whitespace-nowrap">
                                                {job.page_count} หน้า
                                            </span>
                                        )}
                                        {i === 1 && (
                                            <span className={`text-[9px] font-bold mb-0.5 whitespace-nowrap ${pct >= 50 ? 'text-green-600' : 'text-blue-500'
                                                }`}>
                                                {pct}%
                                            </span>
                                        )}
                                        {/* The line itself */}
                                        <div className={`w-full h-0.5 rounded-full transition-all ${LINE_CLS[step.state]}`} />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ── Extracted Data Summary ── */}
            {hasExt && summaryFields.length > 0 && (
                <div className="mx-5 mb-4 p-4 bg-white rounded-xl border border-purple-100 shadow-sm">
                    <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Brain className="w-3 h-3" />
                        ผลการสกัดข้อมูล (AI Extraction)
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                        {summaryFields.map(f => (
                            <div key={f.label}>
                                <p className="text-[10px] text-gray-400">{f.label}</p>
                                <p className="text-xs font-semibold text-gray-800 truncate" title={String(f.value)}>
                                    {String(f.value)}
                                </p>
                            </div>
                        ))}
                    </div>
                    {summary && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-[10px] text-gray-400 mb-1">สรุปเนื้อหา</p>
                            <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">{String(summary)}</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── OCR Text Preview ── */}
            {job.status !== 'pending' && (
                <div className="mx-5 mb-4">
                    <div className="flex justify-between items-start w-full">
                        {hasOcr ? (
                            <details className="flex-1 mr-4 group">
                                <summary className="inline-flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg cursor-pointer select-none hover:bg-blue-100 transition list-none">
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>ดู Raw OCR Text ({job.extracted_text!.length.toLocaleString()} ตัวอักษร)</span>
                                    <ChevronDown className="w-3 h-3 ml-1 group-open:rotate-180 transition-transform" />
                                </summary>
                                <RawTextPreview text={job.extracted_text!} />
                            </details>
                        ) : <div className="flex-1" />}

                        <button
                            onClick={() => onOpenPages(job)}
                            className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition shadow-sm whitespace-nowrap flex-shrink-0"
                        >
                            <Eye className="w-3.5 h-3.5" />
                            ตรวจสอบสถานะรายหน้า
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

const STATUS_FILTERS = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'pending', label: 'รอ' },
    { value: 'processing', label: 'กำลังทำ' },
    { value: 'completed', label: 'สำเร็จ' },
    { value: 'failed', label: 'ล้มเหลว' },
]

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({ job, onConfirm, onCancel }: {
    job: DocumentJob
    onConfirm: () => void
    onCancel: () => void
}) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
                <div className="flex items-start gap-3 mb-5">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Trash2 className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">ลบงานนี้?</h3>
                        <p className="text-sm text-gray-500 mt-1 break-all">{job.filename}</p>
                        <p className="text-xs text-gray-400 mt-2">
                            ข้อมูล job จะถูกลบออกจากระบบ ไฟล์ใน MinIO ยังคงอยู่
                        </p>
                    </div>
                </div>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
                    >ยกเลิก</button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700"
                    >ลบ</button>
                </div>
            </div>
        </div>
    )
}

// ─── Document OCR Pages Modal ────────────────────────────────────────────────
function OcrPagesModal({ job, onClose }: { job: DocumentJob, onClose: () => void }) {
    const [pages, setPages] = useState<OcrPageStatus[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [retrying, setRetrying] = useState(false)

    const fetchPages = async () => {
        try {
            setLoading(true)
            const res = await api.get(`/documents/jobs/${job.id}/pages`)
            setPages(res.data.data || [])
        } catch (e: any) {
            setError(e.response?.data?.detail || e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPages()
        // Poll every 3 seconds if not completed
        const isFinished = job.status === 'completed' || job.status === 'failed'
        let interval: any
        if (!isFinished) {
            interval = setInterval(fetchPages, 3000)
        }
        return () => { if (interval) clearInterval(interval) }
    }, [job.id, job.status])

    const handleRetryFailed = async () => {
        try {
            setRetrying(true)
            await api.post(`/documents/jobs/${job.id}/retry-pages`)
            await fetchPages()
        } catch (e: any) {
            alert('Failed to retry: ' + (e.response?.data?.detail || e.message))
        } finally {
            setRetrying(false)
        }
    }

    const hasFailed = pages.some(p => p.status === 'failed')

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50/80">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <FileTextIcon className="w-5 h-5 text-indigo-500" />
                            สถานะการอ่านข้อความ (OCR) รายหน้า
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                            ไฟล์: <span className="font-mono text-indigo-600">{job.filename}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto bg-slate-50/50">
                    {loading && pages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-4" />
                            <span className="text-sm">กำลังโหลดข้อมูลหน้า...</span>
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            {error}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Summary header */}
                            <div className="flex items-center justify-between">
                                <div className="flex gap-4">
                                    <div className="bg-white px-4 py-2 rounded-lg border shadow-sm flex flex-col">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">ทั้งหมด</span>
                                        <span className="text-lg font-mono font-bold text-gray-800">{pages.length}</span>
                                    </div>
                                    <div className="bg-green-50 px-4 py-2 rounded-lg border border-green-100 shadow-sm flex flex-col">
                                        <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider mb-1">สำเร็จ</span>
                                        <span className="text-lg font-mono font-bold text-green-700">{pages.filter(p => p.status === 'completed').length}</span>
                                    </div>
                                    <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 shadow-sm flex flex-col">
                                        <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mb-1">กำลังทำ</span>
                                        <span className="text-lg font-mono font-bold text-blue-700">{pages.filter(p => p.status === 'processing').length}</span>
                                    </div>
                                    <div className="bg-red-50 px-4 py-2 rounded-lg border border-red-100 shadow-sm flex flex-col">
                                        <span className="text-[10px] text-red-600 font-bold uppercase tracking-wider mb-1">ล้มเหลว</span>
                                        <span className="text-lg font-mono font-bold text-red-700">{pages.filter(p => p.status === 'failed').length}</span>
                                    </div>
                                </div>

                                {hasFailed && (
                                    <button
                                        onClick={handleRetryFailed}
                                        disabled={retrying}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold rounded-xl hover:bg-amber-100 transition shadow-sm disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                                        {retrying ? 'กำลังเริ่มใหม่...' : 'ลองใหม่เฉพาะหน้าที่ล้มเหลว'}
                                    </button>
                                )}
                            </div>

                            {/* Grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">
                                {pages.map(p => {
                                    const isDone = p.status === 'completed'
                                    const isFail = p.status === 'failed'
                                    const isProc = p.status === 'processing'

                                    const cardClass = isDone ? 'bg-white border-green-200 hover:border-green-300' :
                                        isFail ? 'bg-red-50 border-red-200 hover:border-red-300' :
                                            isProc ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100' :
                                                'bg-gray-50 border-gray-200'

                                    return (
                                        <div key={p.page_number} className={`border rounded-xl p-3 shadow-sm transition-all flex flex-col ${cardClass}`}>
                                            <div className="flex items-center justify-between border-b pb-2 mb-2 border-black/5">
                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                                    Page {p.page_number}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    {isDone && <CheckCircle className="w-4 h-4 text-green-500" />}
                                                    {isFail && <XCircle className="w-4 h-4 text-red-500" />}
                                                    {isProc && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                                                    {p.status === 'pending' && <Clock className="w-3.5 h-3.5 text-gray-400" />}
                                                </div>
                                            </div>

                                            <div className="flex-1 space-y-1.5">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-500">Engine:</span>
                                                    <span className="font-medium text-gray-700">{p.ocr_engine || '—'}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-500">Words:</span>
                                                    <span className="font-mono text-gray-700">{p.word_count != null ? p.word_count.toLocaleString() : '—'}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-500">Status:</span>
                                                    <span className={`font-semibold ${isDone ? 'text-green-600' : isFail ? 'text-red-600' : isProc ? 'text-blue-600' : 'text-gray-500'}`}>
                                                        {p.status}
                                                    </span>
                                                </div>
                                            </div>

                                            {isFail && p.error && (
                                                <div className="mt-2 text-[10px] text-red-600 bg-red-100/50 p-1.5 rounded break-words line-clamp-2" title={p.error}>
                                                    {p.error}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}


// ─── Job Row Actions Menu ────────────────────────────────────────────────────

function JobActions({ job, onReview, onRerun, onDelete }: {
    job: DocumentJob
    onReview: () => void
    onRerun: () => void
    onDelete: () => void
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    return (
        <div className="relative" ref={ref}>
            <div className="flex items-center gap-1.5">
                {/* Primary action */}
                {job.status === 'completed' && (
                    <button
                        onClick={onReview}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition shadow-sm"
                    >
                        <Sparkles className="w-3 h-3" />
                        ตรวจสอบ
                    </button>
                )}
                {job.status === 'saved' && (
                    <button
                        onClick={onReview}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition shadow-sm"
                    >
                        <Eye className="w-3 h-3" />
                        ดูข้อมูลที่บันทึก
                    </button>
                )}
                {job.status === 'failed' && (
                    <button
                        onClick={onRerun}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-lg hover:bg-amber-100 border border-amber-200 transition"
                    >
                        <RefreshCw className="w-3 h-3" />
                        ลองใหม่
                    </button>
                )}
                {(job.status === 'processing' || job.status === 'pending') && (
                    <span className="flex items-center gap-1 text-xs text-blue-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        กำลังทำงาน
                    </span>
                )}

                {/* More menu */}
                <button
                    onClick={() => setOpen(v => !v)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                    <MoreVertical className="w-4 h-4" />
                </button>
            </div>

            {open && (
                <div className="absolute right-0 top-8 w-40 bg-white border rounded-lg shadow-lg py-1 z-20">
                    <button
                        onClick={() => { setOpen(false); onDelete() }}
                        disabled={job.status === 'processing'}
                        className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Trash2 className="w-3 h-3" />
                        ลบ job นี้
                    </button>
                </div>
            )}
        </div>
    )
}

// ─── Review Modal ─────────────────────────────────────────────────────────────

const CONTRACT_TYPES = [
    { value: 'procurement', label: 'จัดซื้อจัดจ้าง' },
    { value: 'construction', label: 'ก่อสร้าง' },
    { value: 'service', label: 'บริการ' },
    { value: 'lease', label: 'เช่า' },
    { value: 'other', label: 'อื่นๆ' },
]

interface ReviewFormData {
    contract_number: string
    title: string
    counterparty: string
    contract_type: string
    contract_value: string
    project_name: string
    start_date: string
    end_date: string
    description: string
    status: string
    budget_year: string
    department_name: string
}

function ReviewModal({ job, onClose, onSaved }: {
    job: DocumentJob
    onClose: () => void
    onSaved: () => void
}) {
    const isReadOnly = job.status === 'saved' || job.status === 'deleted'
    const ext = (job.extracted_data || {}) as Record<string, string | number | null>

    const buildForm = (d: Record<string, string | number | null>): ReviewFormData => ({
        contract_number: String(d.contract_number || ''),
        title: String(d.title || ''),
        counterparty: String(d.counterparty || ''),
        contract_type: String(d.contract_type || ''),
        contract_value: d.contract_value ? String(d.contract_value) : '',
        project_name: String(d.project_name || ''),
        start_date: String(d.start_date || ''),
        end_date: String(d.end_date || ''),
        description: String(d.summary || d.description || ''),
        status: 'active',
        budget_year: '',
        department_name: '',
    })

    const [form, setForm] = useState<ReviewFormData>(buildForm(ext))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // ── Raw OCR text toggle + paginated view
    const [showRaw, setShowRaw] = useState(false)
    const [rawText, setRawText] = useState<string | null>(job.extracted_text || null)
    const [loadingRaw, setLoadingRaw] = useState(false)
    const [rawPageIdx, setRawPageIdx] = useState(0)

    // Split raw text into pages for pagination
    const rawPages = useMemo(() => {
        if (!rawText) return []
        // Form-feed split (PDF pages)
        if (rawText.includes('\f')) {
            const parts = rawText.split('\f').filter(p => p.trim().length > 10)
            if (parts.length > 1) return parts
        }
        // --- Page N --- style markers
        const byMarker = rawText.split(/---\s*(?:Page|หน้า)\s*\d+\s*---/i).filter(p => p.trim().length > 10)
        if (byMarker.length > 1) return byMarker
        // Fall back to 800-char chunks
        const chunks: string[] = []
        for (let i = 0; i < rawText.length; i += 800) chunks.push(rawText.slice(i, i + 800))
        return chunks
    }, [rawText])

    const handleShowRaw = async () => {
        if (rawText !== null) { setShowRaw(v => !v); return }
        setLoadingRaw(true)
        try {
            const r = await api.get(`/documents/jobs/${job.id}/raw-text`)
            const txt = r.data.data.extracted_text || '(ไม่มีข้อความ OCR)'
            setRawText(txt)
            setRawPageIdx(0)
            setShowRaw(true)
        } catch { setRawText('(โหลดไม่สำเร็จ)'); setShowRaw(true) } finally { setLoadingRaw(false) }
    }

    // ── AI Re-fill
    const [refilling, setRefilling] = useState(false)
    const [refillOk, setRefillOk] = useState(false)
    const [refillMsg, setRefillMsg] = useState('')
    const [elapsed, setElapsed] = useState(0)

    const handleReExtract = async () => {
        setRefilling(true); setError(null); setRefillOk(false); setElapsed(0)
        setRefillMsg('เริ่มวิเคราะห์...')

        // Elapsed-time ticker
        const tick = setInterval(() => setElapsed(s => s + 1), 1000)

        try {
            const r = await api.post(
                `/documents/jobs/${job.id}/re-extract`,
                {},
                { timeout: 5 * 60 * 1000 }   // 5-min timeout
            )
            clearInterval(tick)
            const newExt = r.data.data.extracted_data as Record<string, string | number | null>
            const windows = r.data.data.windows_processed as number
            const fields = (r.data.data.fields_extracted as string[]) || []
            setForm(buildForm(newExt))
            setRefillOk(true)
            setRefillMsg(`✓ วิเคราะห์ ${windows} windows • พบ ${fields.length} fields`)
            setTimeout(() => { setRefillOk(false); setRefillMsg('') }, 5000)
        } catch (e: any) {
            clearInterval(tick)
            const detail = e.response?.data?.detail
                || (e.code === 'ECONNABORTED' ? 'หมดเวลา (timeout) — ไฟลอาจมีหน้ามากเกินไป' : null)
                || e.message
                || 'AI re-fill ไม่สำเร็จ'
            setError(`❌ ${detail}`)
            setRefillMsg('')
        } finally { setRefilling(false) }
    }

    const set = (k: keyof ReviewFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm(prev => ({ ...prev, [k]: e.target.value }))

    const handleSave = async () => {
        setSaving(true)
        setError(null)
        try {
            await api.post(`/documents/jobs/${job.id}/confirm`, {
                extracted_data: {
                    contract_number: form.contract_number || undefined,
                    title: form.title || undefined,
                    counterparty: form.counterparty || undefined,
                    contract_type: form.contract_type || undefined,
                    contract_value: form.contract_value ? parseFloat(form.contract_value) : undefined,
                    project_name: form.project_name || undefined,
                    start_date: form.start_date || undefined,
                    end_date: form.end_date || undefined,
                },
                document_type: job.document_type || 'contract',
                is_draft: false,
                is_main_document: job.document_type === 'contract',
            })
            onSaved()
        } catch (e: any) {
            setError(e.response?.data?.detail || 'บันทึกไม่สำเร็จ กรุณาลองใหม่')
        } finally {
            setSaving(false)
        }
    }

    const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500'

    return (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
                {/* Header */}
                <div className="flex items-start gap-3 p-5 border-b">
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-gray-900">ตรวจสอบ &amp; บันทึก</h2>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{job.filename}</p>
                        {job.ocr_error && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> OCR: {job.ocr_error}
                            </p>
                        )}
                        {/* Tool buttons */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <button
                                onClick={handleShowRaw}
                                disabled={loadingRaw}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
                            >
                                {loadingRaw ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                                {showRaw ? 'ซ่อน OCR Text' : 'ดู Raw OCR Text'}
                            </button>
                            {!isReadOnly && (
                                <button
                                    onClick={handleReExtract}
                                    disabled={refilling || (!job.extracted_text && !job.has_ocr_text)}
                                    title={(!job.extracted_text && !job.has_ocr_text) ? 'ไม่มี OCR text' : 'ให้ AI วิเคราะห์ใหม่'}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition disabled:opacity-50 ${refillOk ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                        }`}
                                >
                                    {refilling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                                    {refillOk ? '✓ Fill ใหม่แล้ว' : 'AI Fill ใหม่'}
                                </button>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Raw OCR text panel — paginated */}
                {showRaw && rawText !== null && (
                    <div className="mx-5 mt-4 rounded-xl overflow-hidden border border-gray-700">
                        {/* Toolbar */}
                        <div className="flex items-center justify-between px-3 py-2 bg-gray-800 gap-2">
                            <span className="text-xs text-gray-400 font-mono flex-1 min-w-0 truncate">
                                Raw OCR Text &middot; {rawText.length.toLocaleString()} chars
                                {rawPages.length > 1 && ` &middot; ${rawPages.length} หน้า`}
                            </span>
                            {/* Pagination */}
                            {rawPages.length > 1 && (
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => setRawPageIdx(p => Math.max(0, p - 1))}
                                        disabled={rawPageIdx === 0}
                                        className="px-1.5 py-0.5 text-[10px] text-gray-300 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                    >
                                        ←
                                    </button>
                                    <span className="text-[10px] text-gray-400 font-mono px-1">
                                        {rawPageIdx + 1} / {rawPages.length}
                                    </span>
                                    <button
                                        onClick={() => setRawPageIdx(p => Math.min(rawPages.length - 1, p + 1))}
                                        disabled={rawPageIdx === rawPages.length - 1}
                                        className="px-1.5 py-0.5 text-[10px] text-gray-300 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                    >
                                        →
                                    </button>
                                </div>
                            )}
                            <button onClick={() => setShowRaw(false)} className="text-gray-500 hover:text-gray-300 shrink-0">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        {/* Content */}
                        <pre className="bg-gray-900 text-green-300 text-[10px] leading-relaxed p-3 overflow-x-auto max-h-52 whitespace-pre-wrap font-mono">
                            {rawPages.length > 1
                                ? rawPages[rawPageIdx]
                                : rawText.substring(0, 1500) + (rawText.length > 1500 ? '\n\n… (truncated)' : '')}
                        </pre>
                    </div>
                )}

                {/* refilling progress / success note */}
                {(refilling || refillMsg) && (
                    <div className={`mx-5 mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2 transition-all ${refillOk
                        ? 'bg-green-50 text-green-700'
                        : 'bg-purple-50 text-purple-700'
                        }`}>
                        {refilling
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                            : <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                            <span>{refillMsg || 'AI กำลังวิเคราะห์ทีละ 2 หน้า (sliding window)...'}</span>
                            {refilling && elapsed > 0 && (
                                <span className="ml-2 font-mono opacity-70">{elapsed}s</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Form */}
                <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">เลขที่สัญญา</label>
                            <input value={form.contract_number} onChange={set('contract_number')} disabled={isReadOnly} className={inputCls} placeholder="เช่น สัญญา 001/2568" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">ชื่อสัญญา / โครงการ</label>
                            <input value={form.title} onChange={set('title')} disabled={isReadOnly} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">ผู้รับจ้าง / คู่สัญญา</label>
                            <input value={form.counterparty} onChange={set('counterparty')} disabled={isReadOnly} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">ประเภทสัญญา</label>
                            <select value={form.contract_type} onChange={set('contract_type')} disabled={isReadOnly} className={inputCls}>
                                <option value="">— เลือก —</option>
                                {CONTRACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">มูลค่าสัญญา (บาท)</label>
                            <input type="number" value={form.contract_value} onChange={set('contract_value')} disabled={isReadOnly} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">ชื่อโครงการ</label>
                            <input value={form.project_name} onChange={set('project_name')} disabled={isReadOnly} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">วันที่เริ่มต้น</label>
                            <input type="date" value={form.start_date} onChange={set('start_date')} disabled={isReadOnly} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">วันที่สิ้นสุด</label>
                            <input type="date" value={form.end_date} onChange={set('end_date')} disabled={isReadOnly} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">สถานะ</label>
                            <select value={form.status} onChange={set('status')} disabled={isReadOnly} className={inputCls}>
                                <option value="active">ใช้งาน</option>
                                <option value="draft">ร่าง</option>
                                <option value="pending_approval">รออนุมัติ</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">ปีงบประมาณ</label>
                            <input value={form.budget_year} onChange={set('budget_year')} disabled={isReadOnly} className={inputCls} placeholder="เช่น 2568" />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-gray-500 mb-1">หน่วยงาน</label>
                            <input value={form.department_name} onChange={set('department_name')} disabled={isReadOnly} className={inputCls} />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-gray-500 mb-1">สรุปเนื้อหา</label>
                            <textarea value={form.description} onChange={set('description')} rows={3} disabled={isReadOnly}
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none disabled:bg-gray-50 disabled:text-gray-500" />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-5 border-t bg-gray-50 rounded-b-2xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-white transition">
                        ปิด
                    </button>
                    {!isReadOnly && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition shadow-sm"
                        >
                            {saving
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลังบันทึก...</>
                                : <><Save className="w-4 h-4" /> บันทึก</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}


export default function JobsPage() {
    const navigate = useNavigate()

    const [jobs, setJobs] = useState<DocumentJob[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

    // View state
    const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())
    const [reviewJob, setReviewJob] = useState<DocumentJob | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<DocumentJob | null>(null)
    const [viewPagesJob, setViewPagesJob] = useState<DocumentJob | null>(null) // New state for OcrPagesModal

    const toggleExpand = (id: string) =>
        setExpandedJobs(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })

    // ── History mode
    const [historyMode, setHistoryMode] = useState(false)
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // ── Load jobs
    const loadJobs = async (showSpinner = false) => {
        if (showSpinner) setLoading(true)
        try {
            const params: Record<string, string> = { limit: '200' }
            if (statusFilter !== 'all') params.status = statusFilter
            params.is_history = historyMode ? 'true' : 'false'
            if (historyMode && dateFrom) params.date_from = dateFrom + 'T00:00:00'
            if (historyMode && dateTo) params.date_to = dateTo + 'T23:59:59'

            const r = await api.get('/documents/jobs', { params })
            setJobs(r.data.data || [])
            setLastUpdated(new Date())
        } catch { /* ignore */ } finally {
            setLoading(false)
        }
    }

    // Auto-poll only in live mode (not history)
    useEffect(() => {
        loadJobs(true)
        if (!historyMode) {
            intervalRef.current = setInterval(() => loadJobs(false), 5000)
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    }, [historyMode, statusFilter])

    // ── Actions
    const handleRerun = async (jobId: string) => {
        try {
            await api.post(`/documents/jobs/${jobId}/rerun`)
            loadJobs()
        } catch (e: any) {
            alert(e.response?.data?.detail || 'ไม่สามารถเรียกใหม่ได้')
        }
    }

    const handleDelete = async (jobId: string) => {
        try {
            await api.delete(`/documents/jobs/${jobId}`)
            setJobs(prev => prev.filter(j => j.id !== jobId))
        } catch (e: any) {
            alert(e.response?.data?.detail || 'ลบไม่สำเร็จ')
        } finally {
            setDeleteTarget(null)
        }
    }

    const handleReview = (job: DocumentJob) => setReviewJob(job)

    // ── Filter (client-side search only)
    const filtered = jobs.filter(j => {
        const q = search.toLowerCase()
        return !q
            || j.filename.toLowerCase().includes(q)
            || (j.contract_title || '').toLowerCase().includes(q)
            || (j.ocr_engine || '').toLowerCase().includes(q)
    })

    // ── Stats (from full unfiltered list)
    const counts = {
        pending: jobs.filter(j => j.status === 'pending').length,
        processing: jobs.filter(j => j.status === 'processing').length,
        completed: jobs.filter(j => j.status === 'completed').length,
        failed: jobs.filter(j => j.status === 'failed').length,
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <NavigationHeader
                title="งานประมวลผล"
                subtitle="OCR & AI Extraction Jobs"
                breadcrumbs={[{ label: 'งานประมวลผล' }]}
            />

            <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">

                {/* ── Stats row ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'รอดำเนินการ', count: counts.pending, color: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-400 animate-pulse' },
                        { label: 'กำลังประมวลผล', count: counts.processing, color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500 animate-pulse' },
                        { label: 'สำเร็จ', count: counts.completed, color: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
                        { label: 'ล้มเหลว', count: counts.failed, color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
                    ].map(s => (
                        <button
                            key={s.label}
                            onClick={() => {
                                const map: Record<string, string> = {
                                    'รอดำเนินการ': 'pending', 'กำลังประมวลผล': 'processing',
                                    'สำเร็จ': 'completed', 'ล้มเหลว': 'failed',
                                }
                                setStatusFilter(prev => prev === map[s.label] ? 'all' : map[s.label])
                            }}
                            className={`rounded-xl border p-4 flex items-center gap-3 transition hover:shadow-sm text-left ${s.color}`}
                        >
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                            <div>
                                <p className="text-2xl font-bold">{s.count}</p>
                                <p className="text-xs mt-0.5 opacity-80">{s.label}</p>
                            </div>
                        </button>
                    ))}
                </div>

                {/* ── Toolbar ── */}
                <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        {/* Search */}
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="ค้นหาชื่อไฟล์, สัญญา..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Status filter */}
                            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                                {STATUS_FILTERS.map(f => (
                                    <button
                                        key={f.value}
                                        onClick={() => setStatusFilter(f.value)}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition ${statusFilter === f.value
                                            ? 'bg-white text-indigo-700 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            {/* History toggle */}
                            <button
                                onClick={() => setHistoryMode(v => !v)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${historyMode
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                <History className="w-3.5 h-3.5" />
                                ประวัติ
                            </button>

                            {/* Refresh */}
                            <button
                                onClick={() => loadJobs(false)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg transition border border-transparent"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                รีเฟรช
                            </button>

                            {/* Upload */}
                            <button
                                onClick={() => navigate('/upload')}
                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                อัพโหลดใหม่
                            </button>
                        </div>
                    </div>

                    {/* History date range */}
                    {historyMode && (
                        <div className="flex items-center gap-3 pt-2 border-t">
                            <History className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                            <span className="text-xs text-gray-500 whitespace-nowrap">ช่วงวันที่:</span>
                            <div className="flex items-center gap-2 flex-wrap">
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={e => setDateFrom(e.target.value)}
                                    className="text-xs border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                                <span className="text-xs text-gray-400">ถึง</span>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={e => setDateTo(e.target.value)}
                                    className="text-xs border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                                <button
                                    onClick={() => loadJobs(true)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition"
                                >
                                    <Search className="w-3 h-3" />
                                    ค้นหา
                                </button>
                                <button
                                    onClick={() => { setDateFrom(''); setDateTo(''); loadJobs(true) }}
                                    className="text-xs text-gray-400 hover:text-gray-600 px-2"
                                >
                                    ล้าง
                                </button>
                            </div>
                            <span className="ml-auto text-xs text-amber-600 font-medium flex items-center gap-1">
                                <History className="w-3 h-3" />
                                โหมดประวัติ — ไม่อัพเดตอัตโนมัติ
                            </span>
                        </div>
                    )}
                </div>

                {/* Last updated */}
                {lastUpdated && !historyMode && (
                    <p className="text-xs text-gray-400 text-right -mt-2">
                        อัพเดตล่าสุด: {lastUpdated.toLocaleTimeString('th-TH')} · อัพเดตอัตโนมัติทุก 5 วิ
                    </p>
                )}

                {/* ── Jobs Table ── */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                            <p className="text-sm text-gray-400">กำลังโหลด...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 px-4">
                            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                                <Brain className="w-8 h-8 text-gray-300" />
                            </div>
                            <p className="text-gray-500 font-medium">
                                {search || statusFilter !== 'all' ? 'ไม่พบงานที่ตรงกับเงื่อนไข' : 'ยังไม่มีงานประมวลผล'}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                {historyMode ? 'เลือกช่วงวันที่แล้วกดค้นหา' : 'อัพโหลดเอกสารเพื่อเริ่มต้น'}
                            </p>
                            {!search && statusFilter === 'all' && !historyMode && (
                                <button
                                    onClick={() => navigate('/upload')}
                                    className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
                                >
                                    <Upload className="w-4 h-4" /> อัพโหลดเอกสาร
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Table header */}
                            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] px-5 py-3 border-b bg-gray-50/80 text-xs font-semibold text-gray-500 gap-4 uppercase tracking-wide">
                                <span>ไฟล์ / สัญญา</span>
                                <span className="text-center w-24">OCR Engine</span>
                                <span className="text-center w-20">หน้า</span>
                                <span className="text-center w-32">วันที่</span>
                                <span className="text-right w-44">การดำเนินการ</span>
                            </div>

                            {/* Rows */}
                            <div className="divide-y divide-gray-100">
                                {filtered.map(job => {
                                    const isExpanded = expandedJobs.has(job.id)
                                    const statusBg = job.status === 'completed' || job.status === 'saved' ? 'bg-green-100' :
                                        job.status === 'processing' ? 'bg-blue-100' :
                                            job.status === 'pending' ? 'bg-yellow-100' : 'bg-gray-100'
                                    const statusPill = job.status === 'completed' || job.status === 'saved' ? 'bg-green-100 text-green-700' :
                                        job.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                                            job.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                job.status === 'deleted' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-700'

                                    return (
                                        <div key={job.id} className={`transition-colors ${isExpanded ? 'bg-indigo-50/30' : 'hover:bg-gray-50/60'}`}>

                                            {/* ── Main row (clickable to expand) ── */}
                                            <div
                                                className="grid grid-cols-[1fr_auto_auto_auto_auto] px-5 py-3.5 items-center gap-4 cursor-pointer select-none"
                                                onClick={() => toggleExpand(job.id)}
                                            >
                                                {/* File info */}
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${statusBg}`}>
                                                            <StatusIcon status={job.status} />
                                                        </div>
                                                        <p className="text-sm font-medium text-gray-800 truncate">{job.filename}</p>
                                                        {/* expand chevron */}
                                                        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                    </div>
                                                    <div className="pl-9 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                        {job.contract_title && (
                                                            <span className="text-xs text-indigo-600 truncate max-w-[200px]">
                                                                📄 {job.contract_title}
                                                            </span>
                                                        )}
                                                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${statusPill}`}>
                                                            {statusLabel(job.status)}
                                                        </span>
                                                        {job.status === 'failed' && (job.ocr_error || job.llm_error) && (
                                                            <span className="text-xs text-red-500 flex items-center gap-1 truncate max-w-[180px]">
                                                                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                                                {(job.ocr_error || job.llm_error)!.substring(0, 60)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* OCR Engine */}
                                                <div className="w-24 text-center" onClick={e => e.stopPropagation()}>
                                                    {job.ocr_engine ? (
                                                        <span className="inline-flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                            <ScanText className="w-3 h-3" />
                                                            {job.ocr_engine}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-300">—</span>
                                                    )}
                                                </div>

                                                {/* Page count */}
                                                <div className="w-20 text-center">
                                                    <span className="text-sm text-gray-600">
                                                        {job.page_count != null ? `${job.page_count} หน้า` : '—'}
                                                    </span>
                                                </div>

                                                {/* Date */}
                                                <div className="w-32 text-center">
                                                    <p className="text-xs text-gray-500">{fmtDate(job.created_at)}</p>
                                                    {job.completed_at && (
                                                        <p className="text-[11px] text-gray-400 mt-0.5">เสร็จ {timeAgo(job.completed_at)}</p>
                                                    )}
                                                </div>

                                                {/* Actions — stop propagation so clicks don't toggle expand */}
                                                <div className="w-44 flex justify-end" onClick={e => e.stopPropagation()}>
                                                    <JobActions
                                                        job={job}
                                                        onReview={() => handleReview(job)}
                                                        onRerun={() => handleRerun(job.id)}
                                                        onDelete={() => setDeleteTarget(job)}
                                                    />
                                                </div>
                                            </div>

                                            {/* ── Pipeline (expanded) ── */}
                                            {isExpanded && <JobPipeline job={job} onOpenPages={setViewPagesJob} />}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Footer */}
                            <div className="px-5 py-3 border-t bg-gray-50/60 text-xs text-gray-400 flex items-center justify-between">
                                <span>แสดง {filtered.length} จาก {jobs.length} งาน</span>
                                <button
                                    onClick={() => navigate('/upload')}
                                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    <Upload className="w-3 h-3" /> อัพโหลดเพิ่มเติม
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Back */}
                <div className="flex justify-center">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition"
                    >
                        <Home className="w-4 h-4" />
                        กลับหน้าแรก
                    </button>
                </div>
            </main>

            {/* Delete confirm modal */}
            {deleteTarget && (
                <DeleteConfirmModal
                    job={deleteTarget}
                    onConfirm={() => handleDelete(deleteTarget.id)}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}

            {/* Review & Save modal */}
            {reviewJob && (
                <ReviewModal
                    job={reviewJob}
                    onClose={() => setReviewJob(null)}
                    onSaved={() => {
                        setReviewJob(null)
                        loadJobs(false)
                    }}
                />
            )}

            {/* View OCR Pages modal */}
            {viewPagesJob && (
                <OcrPagesModal
                    job={viewPagesJob}
                    onClose={() => setViewPagesJob(null)}
                />
            )}
        </div>
    )
}
