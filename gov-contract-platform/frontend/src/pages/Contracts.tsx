import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Search, Plus, FileText, Calendar, DollarSign, Building2,
  AlertCircle, CheckCircle, Clock, XCircle, ChevronLeft, ChevronRight,
  Eye, Edit, Trash2, Paperclip, RefreshCw, MoreVertical, X,
  LayoutGrid, List, AlertTriangle, ChevronDown, Filter
} from 'lucide-react'
import NavigationHeader from '../components/NavigationHeader'
import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1' })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

interface Contract {
  id: string
  contract_number: string
  title: string
  description?: string
  contract_type: string
  status: string
  value: number
  currency?: string
  start_date: string
  end_date: string
  vendor_name?: string
  vendor_id?: string
  department_name?: string
  document_count: number
  project_name?: string
  budget_year?: string
  created_at: string
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  draft:            { label: 'ร่าง',              color: 'text-gray-600',   bg: 'bg-gray-100',   icon: FileText },
  pending_review:   { label: 'รอตรวจสอบ',        color: 'text-yellow-600', bg: 'bg-yellow-100', icon: Clock },
  pending_approval: { label: 'รออนุมัติ',         color: 'text-orange-600', bg: 'bg-orange-100', icon: Clock },
  approved:         { label: 'อนุมัติแล้ว',       color: 'text-teal-600',   bg: 'bg-teal-100',   icon: CheckCircle },
  active:           { label: 'ดำเนินการ',         color: 'text-green-600',  bg: 'bg-green-100',  icon: CheckCircle },
  on_hold:          { label: 'พักการดำเนินการ',   color: 'text-purple-600', bg: 'bg-purple-100', icon: Clock },
  completed:        { label: 'เสร็จสิ้น',         color: 'text-blue-600',   bg: 'bg-blue-100',   icon: CheckCircle },
  terminated:       { label: 'ยกเลิก',            color: 'text-red-600',    bg: 'bg-red-100',    icon: XCircle },
  cancelled:        { label: 'ยกเลิก',            color: 'text-red-600',    bg: 'bg-red-100',    icon: XCircle },
  expired:          { label: 'หมดอายุ',           color: 'text-orange-600', bg: 'bg-orange-100', icon: Clock },
}

const contractTypeLabels: Record<string, string> = {
  procurement: 'จัดซื้อจัดจ้าง', construction: 'เหมาก่อสร้าง',
  service: 'จ้างบริการ', consultant: 'จ้างที่ปรึกษา', consulting: 'จ้างที่ปรึกษา',
  rental: 'เช่าทรัพย์สิน', concession: 'สัมปทาน', supply: 'จัดหาอุปกรณ์',
  maintenance: 'ซ่อมบำรุง', training: 'ฝึกอบรม', research: 'วิจัยและพัฒนา',
  software: 'พัฒนาซอฟต์แวร์', other: 'อื่นๆ',
}

const contractTypeColors: Record<string, string> = {
  procurement: 'bg-blue-100 text-blue-700', construction: 'bg-green-100 text-green-700',
  service: 'bg-purple-100 text-purple-700', consultant: 'bg-indigo-100 text-indigo-700',
  consulting: 'bg-indigo-100 text-indigo-700', maintenance: 'bg-gray-100 text-gray-700',
  research: 'bg-teal-100 text-teal-700', software: 'bg-cyan-100 text-cyan-700',
  supply: 'bg-orange-100 text-orange-700', other: 'bg-gray-100 text-gray-700',
}

interface EditForm {
  title: string
  description: string
  contract_type: string
  status: string
  vendor_name: string
  value: number | string
  start_date: string
  end_date: string
  project_name: string
  budget_year: string
}

function Toast({ toast, onClose }: { toast: { type: string; text: string }; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {toast.text}
      <button onClick={onClose}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
    </div>
  )
}

export default function Contracts() {
  const navigate = useNavigate()
  const location = useLocation()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [apiSearchQuery, setApiSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedContracts, setSelectedContracts] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  const [stats, setStats] = useState({ total: 0, active: 0, expiringSoon: 0, totalValue: 0 })

  // Edit
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    title: '', description: '', contract_type: 'procurement', status: 'draft',
    vendor_name: '', value: '', start_date: '', end_date: '', project_name: '', budget_year: ''
  })
  const [saving, setSaving] = useState(false)

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  // Menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Toast
  const [toast, setToast] = useState<{ type: string; text: string } | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const q = params.get('search')
    if (q) { setSearchQuery(q); setApiSearchQuery(q) }
  }, [location.search])

  useEffect(() => {
    fetchContracts()
    fetchStats()
  }, [currentPage, statusFilter, typeFilter, apiSearchQuery])

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchContracts = async () => {
    try {
      setLoading(true)
      const params: any = { page: currentPage, page_size: 20 }
      if (statusFilter !== 'all') params.status = statusFilter
      if (typeFilter !== 'all') params.contract_type = typeFilter
      if (apiSearchQuery) params.search = apiSearchQuery
      const res = await api.get('/contracts', { params })
      setContracts(res.data.items || [])
      setTotalPages(res.data.pages || 1)
      setTotalCount(res.data.total || 0)
    } catch (e) {
      console.error(e)
      setContracts([])
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await api.get('/contracts/stats/summary')
      if (res.data?.success) {
        const d = res.data.data
        setStats({ total: d.total_contracts || 0, active: d.active_contracts || 0, expiringSoon: d.expiring_soon || 0, totalValue: d.total_value || 0 })
      }
    } catch {}
  }

  const formatCurrency = (v: number) => v ? new Intl.NumberFormat('th-TH').format(v) : '-'
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'
  const getDaysRemaining = (end: string) => Math.ceil((new Date(end).getTime() - Date.now()) / 86400000)

  // Edit
  const openEdit = (c: Contract) => {
    setEditingContract(c)
    setEditForm({
      title: c.title || '',
      description: c.description || '',
      contract_type: c.contract_type || 'procurement',
      status: c.status || 'draft',
      vendor_name: c.vendor_name || '',
      value: c.value || '',
      start_date: c.start_date ? c.start_date.split('T')[0] : '',
      end_date: c.end_date ? c.end_date.split('T')[0] : '',
      project_name: c.project_name || '',
      budget_year: c.budget_year || '',
    })
    setOpenMenuId(null)
  }

  const handleSaveEdit = async () => {
    if (!editingContract) return
    setSaving(true)
    try {
      await api.put(`/contracts/${editingContract.id}`, {
        title: editForm.title,
        description: editForm.description,
        contract_type: editForm.contract_type,
        status: editForm.status,
        vendor_name: editForm.vendor_name,
        value_original: editForm.value ? Number(editForm.value) : null,
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
        project_name: editForm.project_name,
        budget_year: editForm.budget_year,
      })
      setEditingContract(null)
      setToast({ type: 'success', text: 'แก้ไขสัญญาสำเร็จ' })
      fetchContracts()
      fetchStats()
    } catch (e: any) {
      setToast({ type: 'error', text: e.response?.data?.detail || 'ไม่สามารถแก้ไขได้' })
    } finally {
      setSaving(false)
    }
  }

  // Delete
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/contracts/${id}`)
      setDeletingId(null)
      setSelectedContracts(prev => prev.filter(i => i !== id))
      setToast({ type: 'success', text: 'ลบสัญญาสำเร็จ' })
      fetchContracts()
      fetchStats()
    } catch (e: any) {
      setToast({ type: 'error', text: e.response?.data?.detail || 'ไม่สามารถลบได้' })
      setDeletingId(null)
    }
  }

  const handleBulkDelete = async () => {
    setSaving(true)
    try {
      await Promise.all(selectedContracts.map(id => api.delete(`/contracts/${id}`)))
      setSelectedContracts([])
      setBulkDeleteConfirm(false)
      setToast({ type: 'success', text: `ลบ ${selectedContracts.length} สัญญาสำเร็จ` })
      fetchContracts()
      fetchStats()
    } catch (e: any) {
      setToast({ type: 'error', text: 'บางรายการลบไม่สำเร็จ' })
    } finally {
      setSaving(false)
    }
  }

  // Status change
  const handleStatusChange = async (id: string, newStatus: string) => {
    setOpenMenuId(null)
    try {
      await api.put(`/contracts/${id}`, { status: newStatus })
      setToast({ type: 'success', text: 'เปลี่ยนสถานะสำเร็จ' })
      fetchContracts()
      fetchStats()
    } catch (e: any) {
      setToast({ type: 'error', text: e.response?.data?.detail || 'ไม่สามารถเปลี่ยนสถานะได้' })
    }
  }

  const toggleSelectAll = () => {
    if (selectedContracts.length === contracts.length) setSelectedContracts([])
    else setSelectedContracts(contracts.map(c => c.id))
  }

  const toggleSelect = (id: string) =>
    setSelectedContracts(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])

  const statusTransitions: Record<string, { label: string; value: string }[]> = {
    draft: [{ label: 'ส่งรออนุมัติ', value: 'pending_approval' }, { label: 'เปิดใช้งาน', value: 'active' }],
    pending_review: [{ label: 'ส่งรออนุมัติ', value: 'pending_approval' }],
    pending_approval: [{ label: 'อนุมัติ', value: 'approved' }, { label: 'ส่งคืนแก้ไข', value: 'draft' }],
    approved: [{ label: 'เปิดใช้งาน', value: 'active' }],
    active: [{ label: 'เสร็จสิ้น', value: 'completed' }, { label: 'พักการดำเนินการ', value: 'on_hold' }, { label: 'ยกเลิก', value: 'terminated' }],
    on_hold: [{ label: 'เปิดใช้งานอีกครั้ง', value: 'active' }, { label: 'ยกเลิก', value: 'terminated' }],
    completed: [],
    terminated: [],
    cancelled: [],
    expired: [],
  }

  // Row rendering
  const renderListRow = (contract: Contract) => {
    const s = statusConfig[contract.status] || statusConfig.draft
    const StatusIcon = s.icon
    const days = getDaysRemaining(contract.end_date)
    const isDeleting = deletingId === contract.id
    const isSelected = selectedContracts.includes(contract.id)
    const transitions = statusTransitions[contract.status] || []

    if (isDeleting) {
      return (
        <tr key={contract.id} className="bg-red-50">
          <td colSpan={9} className="px-6 py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700 flex-1">ลบสัญญา <strong>{contract.title}</strong>? การดำเนินการนี้ไม่สามารถย้อนกลับได้</span>
              <button onClick={() => handleDelete(contract.id)} className="px-4 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">ยืนยันลบ</button>
              <button onClick={() => setDeletingId(null)} className="px-4 py-1.5 border text-sm rounded-lg hover:bg-gray-50">ยกเลิก</button>
            </div>
          </td>
        </tr>
      )
    }

    return (
      <tr key={contract.id} className={`hover:bg-gray-50 transition ${isSelected ? 'bg-blue-50' : ''}`}>
        <td className="px-6 py-4">
          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(contract.id)} className="w-4 h-4 rounded border-gray-300" />
        </td>
        <td className="px-6 py-4">
          <button onClick={() => navigate(`/contracts/${contract.id}`)} className="text-left group">
            <p className="font-medium text-gray-900 group-hover:text-blue-600 transition">{contract.title}</p>
            <p className="text-sm text-gray-500 mt-0.5">เลขที่ {contract.contract_number}</p>
            {contract.document_count > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-600 mt-1">
                <Paperclip className="w-3 h-3" />{contract.document_count} เอกสาร
              </span>
            )}
          </button>
        </td>
        <td className="px-6 py-4">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${contractTypeColors[contract.contract_type] || 'bg-gray-100 text-gray-700'}`}>
            {contractTypeLabels[contract.contract_type] || contract.contract_type}
          </span>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-700">{contract.vendor_name || '-'}</span>
          </div>
          {contract.department_name && <p className="text-xs text-gray-500 mt-1">{contract.department_name}</p>}
        </td>
        <td className="px-6 py-4">
          <span className="font-medium text-gray-900">{formatCurrency(contract.value)}</span>
          <p className="text-xs text-gray-500">บาท</p>
        </td>
        <td className="px-6 py-4">
          <div className="text-sm">
            <p className="text-gray-700">{formatDate(contract.start_date)}</p>
            <p className="text-gray-500">ถึง {formatDate(contract.end_date)}</p>
            {days < 0 ? (
              <p className="text-xs text-red-600 mt-1 font-medium">เกินกำหนด {Math.abs(days)} วัน</p>
            ) : contract.status === 'active' && days <= 30 ? (
              <p className="text-xs text-orange-600 mt-1 font-medium">เหลือ {days} วัน</p>
            ) : null}
          </div>
        </td>
        <td className="px-6 py-4">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${s.bg} ${s.color}`}>
            <StatusIcon className="w-3 h-3" />{s.label}
          </span>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center justify-center gap-1">
            <button onClick={() => navigate(`/contracts/${contract.id}`)} className="p-2 hover:bg-gray-100 rounded-lg transition" title="ดูรายละเอียด">
              <Eye className="w-4 h-4 text-gray-600" />
            </button>
            <button onClick={() => openEdit(contract)} className="p-2 hover:bg-gray-100 rounded-lg transition" title="แก้ไข">
              <Edit className="w-4 h-4 text-gray-600" />
            </button>
            <button onClick={() => navigate(`/upload?contract_id=${contract.id}`)} className="p-2 hover:bg-gray-100 rounded-lg transition" title="อัปโหลดเอกสาร">
              <Paperclip className="w-4 h-4 text-gray-600" />
            </button>
            {/* MoreVertical dropdown */}
            <div className="relative" ref={openMenuId === contract.id ? menuRef : undefined}>
              <button onClick={() => setOpenMenuId(openMenuId === contract.id ? null : contract.id)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <MoreVertical className="w-4 h-4 text-gray-600" />
              </button>
              {openMenuId === contract.id && (
                <div className="absolute right-0 top-9 bg-white rounded-xl shadow-xl border z-30 py-1 w-48">
                  {transitions.length > 0 && (
                    <>
                      <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">เปลี่ยนสถานะ</p>
                      {transitions.map(t => (
                        <button key={t.value} onClick={() => handleStatusChange(contract.id, t.value)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          {`-> ${t.label}`}
                        </button>
                      ))}
                      <div className="border-t my-1" />
                    </>
                  )}
                  <button onClick={() => { openEdit(contract); setOpenMenuId(null) }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <Edit className="w-4 h-4" /> แก้ไขข้อมูล
                  </button>
                  <button onClick={() => { navigate(`/upload?contract_id=${contract.id}`); setOpenMenuId(null) }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <Paperclip className="w-4 h-4" /> อัปโหลดเอกสาร
                  </button>
                  <div className="border-t my-1" />
                  <button onClick={() => { setDeletingId(contract.id); setOpenMenuId(null) }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                    <Trash2 className="w-4 h-4" /> ลบสัญญา
                  </button>
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>
    )
  }

  const renderGridCard = (contract: Contract) => {
    const s = statusConfig[contract.status] || statusConfig.draft
    const StatusIcon = s.icon
    const days = getDaysRemaining(contract.end_date)

    return (
      <div key={contract.id} className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition p-4 flex flex-col gap-3 ${selectedContracts.includes(contract.id) ? 'ring-2 ring-blue-500 border-blue-300' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <input type="checkbox" checked={selectedContracts.includes(contract.id)} onChange={() => toggleSelect(contract.id)} className="w-4 h-4 rounded border-gray-300 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{contract.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">เลขที่ {contract.contract_number}</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${s.bg} ${s.color}`}>
            <StatusIcon className="w-3 h-3" />{s.label}
          </span>
        </div>

        <div className="space-y-1.5 text-sm">
          {contract.vendor_name && (
            <div className="flex items-center gap-2 text-gray-600">
              <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate">{contract.vendor_name}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-600">
            <DollarSign className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="font-medium text-gray-900">{formatCurrency(contract.value)}</span>
            <span className="text-xs text-gray-400">บาท</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{formatDate(contract.start_date)} – {formatDate(contract.end_date)}</span>
          </div>
          {days < 0 ? (
            <p className="text-xs text-red-600 font-medium">เกินกำหนด {Math.abs(days)} วัน</p>
          ) : contract.status === 'active' && days <= 30 ? (
            <p className="text-xs text-orange-600 font-medium">เหลือ {days} วัน</p>
          ) : null}
        </div>

        <div className="flex items-center justify-between pt-1 border-t">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${contractTypeColors[contract.contract_type] || 'bg-gray-100 text-gray-700'}`}>
            {contractTypeLabels[contract.contract_type] || contract.contract_type}
          </span>
          {contract.document_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-blue-600">
              <Paperclip className="w-3 h-3" />{contract.document_count}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={() => navigate(`/contracts/${contract.id}`)} className="flex-1 py-1.5 text-xs border rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1">
            <Eye className="w-3.5 h-3.5" /> ดูรายละเอียด
          </button>
          <button onClick={() => openEdit(contract)} className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1">
            <Edit className="w-3.5 h-3.5" /> แก้ไข
          </button>
          <button onClick={() => setDeletingId(contract.id)} className="p-1.5 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Delete confirm in grid mode */}
        {deletingId === contract.id && (
          <div className="bg-red-50 rounded-lg p-3 border border-red-200">
            <p className="text-xs text-red-700 mb-2">ยืนยันการลบสัญญานี้?</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(contract.id)} className="flex-1 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700">ยืนยัน</button>
              <button onClick={() => setDeletingId(null)} className="flex-1 py-1 border text-xs rounded-lg hover:bg-gray-50">ยกเลิก</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader
        title="จัดการสัญญา"
        subtitle="Contract Management"
        breadcrumbs={[{ label: 'สัญญา' }]}
        actions={(
          <div className="flex items-center gap-2">
            <button onClick={() => { fetchContracts(); fetchStats() }} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              รีเฟรช
            </button>
            <button onClick={() => navigate('/contracts/new')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              <Plus className="w-4 h-4" /> สร้างสัญญาใหม่
            </button>
          </div>
        )}
      />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'สัญญาทั้งหมด', value: stats.total, sub: 'รายการ', color: 'blue', filter: 'all' as string | null },
            { label: 'กำลังดำเนินการ', value: stats.active, sub: 'สัญญา', color: 'green', filter: 'active' as string | null },
            { label: 'ใกล้หมดอายุ', value: stats.expiringSoon, sub: 'สัญญา', color: 'orange', filter: 'active' as string | null },
            { label: 'มูลค่ารวม', value: formatCurrency(stats.totalValue), sub: 'บาท', color: 'purple', filter: null as string | null },
          ].map(card => {
            const colorMap: Record<string, string> = {
              blue: 'bg-blue-50 border-blue-200 text-blue-700',
              green: 'bg-green-50 border-green-200 text-green-700',
              orange: 'bg-orange-50 border-orange-200 text-orange-700',
              purple: 'bg-purple-50 border-purple-200 text-purple-700',
            }
            return (
              <div key={card.label} onClick={() => card.filter !== null && setStatusFilter(card.filter)} className={`border rounded-xl p-4 ${colorMap[card.color]} ${card.filter !== null ? 'cursor-pointer hover:shadow-md transition' : ''}`}>
                <p className="text-sm opacity-80">{card.label}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
                <p className="text-xs opacity-60 mt-0.5">{card.sub}</p>
              </div>
            )
          })}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[260px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <form onSubmit={e => { e.preventDefault(); setCurrentPage(1); setApiSearchQuery(searchQuery) }}>
                <input type="text" placeholder="ค้นหาชื่อสัญญา เลขที่ หรือผู้รับจ้าง... (Enter)" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </form>
            </div>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1) }} className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
              <option value="all">สถานะทั้งหมด</option>
              <option value="draft">ร่าง</option>
              <option value="pending_review">รอตรวจสอบ</option>
              <option value="pending_approval">รออนุมัติ</option>
              <option value="approved">อนุมัติแล้ว</option>
              <option value="active">ดำเนินการ</option>
              <option value="on_hold">พักการดำเนินการ</option>
              <option value="completed">เสร็จสิ้น</option>
              <option value="terminated">ยกเลิก</option>
              <option value="expired">หมดอายุ</option>
            </select>
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1) }} className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
              <option value="all">ประเภทสัญญาทั้งหมด</option>
              {Object.entries(contractTypeLabels).filter(([k]) => !['consultant'].includes(k)).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <div className="flex border rounded-lg overflow-hidden ml-auto">
              <button onClick={() => setViewMode('list')} className={`px-3 py-2 flex items-center gap-1.5 text-sm ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                <List className="w-4 h-4" /> รายการ
              </button>
              <button onClick={() => setViewMode('grid')} className={`px-3 py-2 flex items-center gap-1.5 text-sm ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                <LayoutGrid className="w-4 h-4" /> กริด
              </button>
            </div>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedContracts.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-4">
            <span className="text-sm text-blue-700 font-medium">เลือก {selectedContracts.length} รายการ</span>
            {bulkDeleteConfirm ? (
              <>
                <span className="text-sm text-red-700">ยืนยันลบ {selectedContracts.length} สัญญา?</span>
                <button onClick={handleBulkDelete} disabled={saving} className="px-4 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {saving ? 'กำลังลบ...' : 'ยืนยัน'}
                </button>
                <button onClick={() => setBulkDeleteConfirm(false)} className="px-4 py-1.5 border text-sm rounded-lg hover:bg-gray-50">ยกเลิก</button>
              </>
            ) : (
              <>
                <button onClick={() => setBulkDeleteConfirm(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" /> ลบที่เลือก
                </button>
                <button onClick={() => setSelectedContracts([])} className="text-sm text-gray-500 hover:text-gray-700">ยกเลิกการเลือก</button>
              </>
            )}
          </div>
        )}

        {/* Contracts list/grid */}
        {viewMode === 'list' ? (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="w-10 px-6 py-3">
                      <input type="checkbox" checked={selectedContracts.length === contracts.length && contracts.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300" />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">สัญญา</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ประเภท</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ผู้รับจ้าง</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">มูลค่า</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ระยะเวลา</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">สถานะ</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={8} className="py-16 text-center text-gray-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />กำลังโหลด...
                    </td></tr>
                  ) : contracts.length === 0 ? (
                    <tr><td colSpan={8} className="py-16 text-center text-gray-400">
                      <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />ไม่พบข้อมูลสัญญา
                    </td></tr>
                  ) : contracts.map(renderListRow)}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
              <p className="text-sm text-gray-600">แสดง {contracts.length} จาก {totalCount} รายการ</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="p-2 hover:bg-gray-200 rounded-lg disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">หน้า {currentPage} / {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="p-2 hover:bg-gray-200 rounded-lg disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Grid view */
          <>
            {loading ? (
              <div className="py-16 text-center text-gray-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
            ) : contracts.length === 0 ? (
              <div className="py-16 text-center text-gray-400"><FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />ไม่พบข้อมูลสัญญา</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contracts.map(renderGridCard)}
              </div>
            )}
            {/* Pagination for grid */}
            <div className="flex items-center justify-between bg-white rounded-xl border shadow-sm px-6 py-3">
              <p className="text-sm text-gray-600">แสดง {contracts.length} จาก {totalCount} รายการ</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm">หน้า {currentPage} / {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Edit Modal */}
      {editingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">แก้ไขสัญญา</h3>
                <p className="text-sm text-gray-500 mt-0.5">เลขที่ {editingContract.contract_number}</p>
              </div>
              <button onClick={() => setEditingContract(null)} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสัญญา *</label>
                <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทสัญญา</label>
                  <select value={editForm.contract_type} onChange={e => setEditForm({ ...editForm, contract_type: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    {Object.entries(contractTypeLabels).filter(([k]) => !['consultant'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                  <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ผู้รับจ้าง / คู่สัญญา</label>
                  <input value={editForm.vendor_name} onChange={e => setEditForm({ ...editForm, vendor_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="ชื่อบริษัท / ผู้รับจ้าง" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">มูลค่าสัญญา (บาท)</label>
                  <input type="number" value={editForm.value} onChange={e => setEditForm({ ...editForm, value: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">วันเริ่มต้น</label>
                  <input type="date" value={editForm.start_date} onChange={e => setEditForm({ ...editForm, start_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">วันสิ้นสุด</label>
                  <input type="date" value={editForm.end_date} onChange={e => setEditForm({ ...editForm, end_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อโครงการ</label>
                  <input value={editForm.project_name} onChange={e => setEditForm({ ...editForm, project_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ปีงบประมาณ</label>
                  <input value={editForm.budget_year} onChange={e => setEditForm({ ...editForm, budget_year: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="เช่น 2567" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t">
              <button onClick={handleSaveEdit} disabled={saving || !editForm.title} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition">
                {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
              <button onClick={() => setEditingContract(null)} className="px-6 py-2.5 border rounded-xl font-medium hover:bg-gray-50 transition">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
