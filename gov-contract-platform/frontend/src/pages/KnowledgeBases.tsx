import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Trash2, Upload, FileText, Database,
  ChevronDown, ChevronUp, Loader2, CheckCircle,
  AlertCircle, Clock, X, BookOpen, BarChart2, RefreshCw
} from 'lucide-react'
import NavigationHeader from '../components/NavigationHeader'
import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1' })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Toast ────────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info'
interface Toast { id: number; type: ToastType; message: string }

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const show = useCallback((type: ToastType, message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])
  return { toasts, show }
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  const bg: Record<ToastType, string> = {
    success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600'
  }
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className={`${bg[t.type]} text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-xs`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ── Types ────────────────────────────────────────────────────────────────────
interface KnowledgeBase {
  id: string
  name: string
  description: string
  kb_type: string
  visibility: string
  is_system: boolean
  document_count: number
  total_chunks: number
  is_indexed: boolean
  owner_user_id: string | null
  created_at: string
}

interface KBDocument {
  id: string
  kb_id: string
  filename: string
  mime_type: string
  file_size: number
  status: 'pending' | 'processing' | 'indexed' | 'error'
  error_message: string | null
  chunk_count: number
  entity_count: number
  created_at: string
}

// ── Status badge ─────────────────────────────────────────────────────────────
function DocStatusBadge({ status }: { status: KBDocument['status'] }) {
  const cfg = {
    pending:    { icon: Clock,         label: 'รอประมวลผล',    cls: 'bg-yellow-100 text-yellow-700' },
    processing: { icon: Loader2,       label: 'กำลังประมวลผล', cls: 'bg-blue-100 text-blue-700' },
    indexed:    { icon: CheckCircle,   label: 'พร้อมใช้งาน',   cls: 'bg-green-100 text-green-700' },
    error:      { icon: AlertCircle,   label: 'เกิดข้อผิดพลาด', cls: 'bg-red-100 text-red-700' },
  }[status] ?? { icon: Clock, label: status, cls: 'bg-gray-100 text-gray-700' }
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      <Icon size={11} className={status === 'processing' ? 'animate-spin' : ''} />
      {cfg.label}
    </span>
  )
}

// ── Create KB Modal ──────────────────────────────────────────────────────────
function CreateKBModal({ onClose, onCreated }: { onClose: () => void; onCreated: (kb: KnowledgeBase) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [kbType, setKbType] = useState('documents')
  const [visibility, setVisibility] = useState('private')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim()) { setError('กรุณาระบุชื่อ Knowledge Base'); return }
    setSaving(true)
    setError('')
    try {
      const res = await api.post('/knowledge-bases', { name, description, kb_type: kbType, visibility })
      onCreated(res.data.data)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'สร้างไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">สร้าง Knowledge Base ใหม่</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ <span className="text-red-500">*</span></label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="เช่น คู่มือกฎหมายพัสดุ"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="อธิบายการใช้งาน KB นี้"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
              <select
                value={kbType} onChange={e => setKbType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="documents">เอกสารทั่วไป</option>
                <option value="regulations">กฎหมาย / ระเบียบ</option>
                <option value="templates">แม่แบบสัญญา</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">การมองเห็น</label>
              <select
                value={visibility} onChange={e => setVisibility(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="private">ส่วนตัว</option>
                <option value="org">หน่วยงาน</option>
                <option value="shared">แชร์</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
            ยกเลิก
          </button>
          <button
            onClick={submit} disabled={saving}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            สร้าง KB
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stats Panel ──────────────────────────────────────────────────────────────
function StatsPanel({ kb, onClose }: { kb: KnowledgeBase; onClose: () => void }) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/knowledge-bases/${kb.id}/stats`)
      .then(r => setStats(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [kb.id])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">สถิติ: {kb.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="px-6 py-5">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-blue-500" /></div>
          ) : stats ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'เอกสารทั้งหมด', value: stats.document_count },
                  { label: 'Chunks (Vector)', value: stats.total_chunks },
                  { label: 'Entities (GraphRAG)', value: stats.neo4j_entities },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{s.value ?? 0}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
              {stats.status_counts && Object.keys(stats.status_counts).length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">สถานะเอกสาร</p>
                  <div className="space-y-1">
                    {Object.entries(stats.status_counts as Record<string, number>).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-sm">
                        <span className="text-gray-600 capitalize">{k}</span>
                        <span className="font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">ไม่สามารถโหลดข้อมูลได้</p>
          )}
        </div>
        <div className="px-6 py-4 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}

// ── KB Row (expanded documents) ──────────────────────────────────────────────
function KBRow({
  kb, onDelete, onShowStats, toast
}: {
  kb: KnowledgeBase
  onDelete: (id: string) => void
  onShowStats: (kb: KnowledgeBase) => void
  toast: (type: ToastType, msg: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [docs, setDocs] = useState<KBDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchDocs = useCallback(async () => {
    setDocsLoading(true)
    try {
      const r = await api.get(`/knowledge-bases/${kb.id}/documents`)
      setDocs(r.data.data)
    } catch { /* ignore */ }
    finally { setDocsLoading(false) }
  }, [kb.id])

  // Auto-poll while any doc is pending/processing
  useEffect(() => {
    if (!expanded) { pollRef.current && clearInterval(pollRef.current); return }
    fetchDocs()
    pollRef.current = setInterval(() => {
      fetchDocs()
    }, 5000)
    return () => { pollRef.current && clearInterval(pollRef.current) }
  }, [expanded, fetchDocs])

  // Stop polling when all docs are settled
  useEffect(() => {
    const hasPending = docs.some(d => d.status === 'pending' || d.status === 'processing')
    if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [docs])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const form = new FormData()
    form.append('file', file)
    setUploading(true)
    try {
      await api.post(`/knowledge-bases/${kb.id}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      toast('success', `อัปโหลด "${file.name}" สำเร็จ — กำลังประมวลผล`)
      fetchDocs()
      // resume polling
      if (!pollRef.current) {
        pollRef.current = setInterval(fetchDocs, 5000)
      }
    } catch (err: any) {
      toast('error', err.response?.data?.detail || 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDoc = async (docId: string) => {
    try {
      await api.delete(`/knowledge-bases/${kb.id}/documents/${docId}`)
      setDocs(prev => prev.filter(d => d.id !== docId))
      toast('success', 'ลบเอกสารสำเร็จ')
    } catch {
      toast('error', 'ลบไม่สำเร็จ')
    } finally {
      setDeleteDocId(null)
    }
  }

  const handleReprocess = async (docId: string) => {
    try {
      await api.post(`/knowledge-bases/${kb.id}/documents/${docId}/reprocess`)
      toast('info', 'กำลังประมวลผลใหม่...')
      fetchDocs()
      if (!pollRef.current) {
        pollRef.current = setInterval(fetchDocs, 5000)
      }
    } catch (err: any) {
      toast('error', err.response?.data?.detail || 'ไม่สามารถประมวลผลใหม่ได้')
    }
  }

  const formatSize = (bytes: number) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const kbTypeLabel: Record<string, string> = {
    documents: 'เอกสาร', regulations: 'กฎหมาย', templates: 'แม่แบบ'
  }
  const visLabel: Record<string, string> = {
    private: 'ส่วนตัว', org: 'หน่วยงาน', shared: 'แชร์', public: 'สาธารณะ'
  }

  return (
    <>
      {/* Confirm delete doc dialog */}
      {deleteDocId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <p className="text-sm text-gray-800 mb-5">ยืนยันการลบเอกสารนี้? ข้อมูล vector และ graph จะถูกลบด้วย</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteDocId(null)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">ยกเลิก</button>
              <button onClick={() => handleDeleteDoc(deleteDocId)} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">ลบ</button>
            </div>
          </div>
        </div>
      )}

      {/* KB card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-4">
          {/* Icon */}
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <BookOpen size={20} className="text-blue-600" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 truncate">{kb.name}</span>
              {kb.is_system && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">ระบบ</span>
              )}
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                {kbTypeLabel[kb.kb_type] || kb.kb_type}
              </span>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                {visLabel[kb.visibility] || kb.visibility}
              </span>
            </div>
            {kb.description && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{kb.description}</p>
            )}
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
              <span>{kb.document_count} เอกสาร</span>
              <span>{kb.total_chunks} chunks</span>
              {kb.is_indexed && <span className="text-green-600 flex items-center gap-1"><CheckCircle size={11} /> indexed</span>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onShowStats(kb)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="สถิติ"
            >
              <BarChart2 size={16} />
            </button>
            {!kb.is_system && (
              <button
                onClick={() => onDelete(kb.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="ลบ KB"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Expanded: document list */}
        {expanded && (
          <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
            {/* Upload button */}
            {!kb.is_system && (
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700">เอกสารใน KB</p>
                <div>
                  <input
                    ref={fileInputRef} type="file" className="hidden"
                    accept=".pdf,.docx,.doc,.txt,.md"
                    onChange={handleUpload}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    อัปโหลดเอกสาร
                  </button>
                </div>
              </div>
            )}

            {docsLoading && docs.length === 0 ? (
              <div className="flex justify-center py-4">
                <Loader2 className="animate-spin text-blue-500" size={20} />
              </div>
            ) : docs.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <FileText size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">ยังไม่มีเอกสาร — อัปโหลดเพื่อเริ่มต้น</p>
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 bg-white rounded-lg border px-4 py-3">
                    <FileText size={16} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.filename}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                        <span>{formatSize(doc.file_size)}</span>
                        {doc.status === 'indexed' && (
                          <>
                            <span>{doc.chunk_count} chunks</span>
                            <span>{doc.entity_count} entities</span>
                          </>
                        )}
                        {doc.error_message && (
                          <span className="text-red-500 truncate max-w-xs" title={doc.error_message}>
                            {doc.error_message}
                          </span>
                        )}
                      </div>
                    </div>
                    <DocStatusBadge status={doc.status} />
                    {!kb.is_system && (doc.status === 'error' || doc.status === 'processing') && (
                      <button
                        onClick={() => handleReprocess(doc.id)}
                        className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                        title="ประมวลผลใหม่"
                      >
                        <RefreshCw size={14} />
                      </button>
                    )}
                    {!kb.is_system && (
                      <button
                        onClick={() => setDeleteDocId(doc.id)}
                        className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function KnowledgeBases() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteKbId, setDeleteKbId] = useState<string | null>(null)
  const [statsKb, setStatsKb] = useState<KnowledgeBase | null>(null)
  const { toasts, show: toast } = useToast()

  const fetchKbs = useCallback(async () => {
    try {
      const r = await api.get('/knowledge-bases')
      setKbs(r.data.data)
    } catch {
      toast('error', 'โหลด Knowledge Bases ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchKbs() }, [fetchKbs])

  const handleKBCreated = (kb: KnowledgeBase) => {
    setKbs(prev => [kb, ...prev])
    setShowCreate(false)
    toast('success', `สร้าง "${kb.name}" สำเร็จ`)
  }

  const handleDeleteKb = async (kbId: string) => {
    try {
      await api.delete(`/knowledge-bases/${kbId}`)
      setKbs(prev => prev.filter(k => k.id !== kbId))
      toast('success', 'ลบ Knowledge Base สำเร็จ')
    } catch (e: any) {
      toast('error', e.response?.data?.detail || 'ลบไม่สำเร็จ')
    } finally {
      setDeleteKbId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader
        title="Knowledge Bases"
        subtitle="จัดการฐานความรู้สำหรับ RAG และ GraphRAG"
        breadcrumbs={[
          { label: 'หน้าหลัก', path: '/' },
          { label: 'Knowledge Bases' }
        ]}
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm"
          >
            <Plus size={16} />
            สร้าง KB ใหม่
          </button>
        }
      />

      {/* Confirm delete KB */}
      {deleteKbId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <p className="text-sm text-gray-800 mb-5">
              ยืนยันการลบ Knowledge Base นี้? เอกสาร, Vector Chunks และ Graph Entities ทั้งหมดจะถูกลบด้วย
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteKbId(null)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
                ยกเลิก
              </button>
              <button onClick={() => handleDeleteKb(deleteKbId)} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateKBModal
          onClose={() => setShowCreate(false)}
          onCreated={handleKBCreated}
        />
      )}

      {statsKb && (
        <StatsPanel kb={statsKb} onClose={() => setStatsKb(null)} />
      )}

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex gap-3">
          <Database size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800">เกี่ยวกับ Knowledge Base</p>
            <p className="text-xs text-blue-600 mt-0.5">
              อัปโหลดเอกสาร (PDF, DOCX, TXT, MD) เพื่อให้ AI สามารถค้นหาและตอบคำถามจากข้อมูลของคุณ
              ระบบจะสร้าง Vector Embeddings สำหรับ RAG และ Graph Entities สำหรับ GraphRAG โดยอัตโนมัติ
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        ) : kbs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium text-gray-500">ยังไม่มี Knowledge Base</p>
            <p className="text-sm mt-1">กด "สร้าง KB ใหม่" เพื่อเริ่มต้น</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus size={16} /> สร้าง KB แรกของคุณ
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {kbs.map(kb => (
              <KBRow
                key={kb.id}
                kb={kb}
                onDelete={setDeleteKbId}
                onShowStats={setStatsKb}
                toast={toast}
              />
            ))}
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  )
}
