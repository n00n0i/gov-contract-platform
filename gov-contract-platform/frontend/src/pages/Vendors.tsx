import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, Building2,
  Phone, Mail, MapPin, CheckCircle,
  XCircle, AlertTriangle, ChevronLeft, ChevronRight,
  Eye, Edit, Trash2, User, Ban, Power, PowerOff, X
} from 'lucide-react'
import NavigationHeader from '../components/NavigationHeader'
import vendorService from '../services/vendorService'
import type { Vendor, VendorStats } from '../services/vendorService'

// ── Toast ───────────────────────────────────────────────────────────────────
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
        <div key={t.id} className={`${bg[t.type]} text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-xs animate-fade-in`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({
  message, onConfirm, onCancel
}: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <p className="text-gray-800 text-sm mb-5">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
            ยกเลิก
          </button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getStatusBadge(status: string, isBlacklisted: boolean) {
  if (isBlacklisted) return { label: 'แบล็คลิสต์', color: 'text-red-600', bg: 'bg-red-100', icon: Ban }
  const configs: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    active:      { label: 'พร้อมใช้งาน',         color: 'text-green-600',  bg: 'bg-green-100',  icon: CheckCircle },
    inactive:    { label: 'ไม่ใช้งาน',             color: 'text-gray-600',   bg: 'bg-gray-100',   icon: XCircle },
    blacklisted: { label: 'แบล็คลิสต์',           color: 'text-red-600',    bg: 'bg-red-100',    icon: AlertTriangle },
    suspended:   { label: 'ระงับชั่วคราว',         color: 'text-yellow-600', bg: 'bg-yellow-100', icon: AlertTriangle },
    pending:     { label: 'รอตรวจสอบเอกสาร',      color: 'text-blue-600',   bg: 'bg-blue-100',   icon: CheckCircle },
  }
  return configs[status] ?? configs.inactive
}

function getVendorTypeLabel(type: string) {
  const types: Record<string, { label: string; icon: any }> = {
    individual:       { label: 'บุคคลธรรมดา', icon: User },
    company:          { label: 'นิติบุคคล',   icon: Building2 },
    partnership:      { label: 'ห้างหุ้นส่วน', icon: Building2 },
    cooperative:      { label: 'สหกรณ์',       icon: Building2 },
    state_enterprise: { label: 'รัฐวิสาหกิจ', icon: Building2 },
    other:            { label: 'อื่นๆ',         icon: Building2 },
  }
  return types[type] ?? { label: type, icon: Building2 }
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Vendors() {
  const navigate = useNavigate()
  const { toasts, show: showToast } = useToast()

  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')          // UI value
  const [searchQuery, setSearchQuery] = useState('')          // debounced
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])

  const [stats, setStats] = useState<VendorStats>({ total_vendors: 0, active_vendors: 0, blacklisted_vendors: 0 })
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)

  // ── Debounce search ──────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput)
      setCurrentPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // ── Reset page when filters change ──────────────────────────────────────
  useEffect(() => { setCurrentPage(1) }, [statusFilter, typeFilter])

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchVendors()
  }, [currentPage, statusFilter, typeFilter, searchQuery])

  useEffect(() => { fetchStats() }, [])

  const fetchVendors = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await vendorService.getVendors({
        page: currentPage,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        vendor_type: typeFilter !== 'all' ? typeFilter : undefined,
        search: searchQuery || undefined,
      })
      if (res.success) {
        setVendors(res.data)
        setTotalPages(res.meta.pages)
        setTotalItems(res.meta.total)
      }
    } catch {
      setError('ไม่สามารถโหลดข้อมูลผู้รับจ้างได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await vendorService.getVendorStats()
      if (res.success) setStats(res.data)
    } catch { /* stats are non-critical */ }
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleDelete = (id: string, name: string) => {
    setConfirm({
      message: `ยืนยันการลบ "${name}" ออกจากระบบ?`,
      onConfirm: async () => {
        setConfirm(null)
        try {
          await vendorService.deleteVendor(id)
          showToast('success', 'ลบผู้รับจ้างสำเร็จ')
          fetchVendors()
          fetchStats()
        } catch {
          showToast('error', 'ไม่สามารถลบผู้รับจ้างได้')
        }
      }
    })
  }

  const handleBulkAction = (action: 'activate' | 'deactivate' | 'delete') => {
    const labels = { activate: 'เปิดใช้งาน', deactivate: 'ปิดใช้งาน', delete: 'ลบ' }
    setConfirm({
      message: `ยืนยันการ${labels[action]} ${selectedVendors.length} รายการ?`,
      onConfirm: async () => {
        setConfirm(null)
        try {
          const res = await vendorService.bulkAction(action, selectedVendors)
          showToast('success', res.message || `ดำเนินการ ${labels[action]} สำเร็จ`)
          setSelectedVendors([])
          fetchVendors()
          fetchStats()
        } catch {
          showToast('error', `ไม่สามารถ${labels[action]}ได้`)
        }
      }
    })
  }

  const toggleSelectAll = () =>
    setSelectedVendors(selectedVendors.length === vendors.length ? [] : vendors.map(v => v.id))

  const toggleSelect = (id: string) =>
    setSelectedVendors(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader
        title="ทะเบียนผู้รับจ้าง"
        subtitle="Vendor Management"
        breadcrumbs={[{ label: 'ผู้รับจ้าง' }]}
        actions={(
          <button
            onClick={() => navigate('/vendors/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" /> เพิ่มผู้รับจ้าง
          </button>
        )}
      />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard title="ผู้รับจ้างทั้งหมด" value={stats.total_vendors} subtitle="ราย"
            icon={<Building2 className="w-6 h-6 text-blue-600" />} color="blue" />
          <StatCard title="ใช้งาน" value={stats.active_vendors} subtitle="ราย"
            icon={<CheckCircle className="w-6 h-6 text-green-600" />} color="green" />
          <StatCard title="แบล็คลิสต์" value={stats.blacklisted_vendors} subtitle="ราย"
            icon={<AlertTriangle className="w-6 h-6 text-red-600" />} color="red" />
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
            <button onClick={() => { setError(null); fetchVendors() }}
              className="text-sm text-red-600 hover:underline ml-4">ลองใหม่</button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[280px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อผู้รับจ้าง รหัส หรือเลขประจำตัวผู้เสียภาษี..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {searchInput && (
                <button onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="all">สถานะทั้งหมด</option>
              <option value="active">พร้อมใช้งาน</option>
              <option value="inactive">ไม่ใช้งาน</option>
              <option value="pending">รอตรวจสอบเอกสาร</option>
              <option value="suspended">ระงับชั่วคราว</option>
              <option value="blacklisted">แบล็คลิสต์</option>
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="all">ประเภททั้งหมด</option>
              <option value="company">นิติบุคคล</option>
              <option value="individual">บุคคลธรรมดา</option>
              <option value="partnership">ห้างหุ้นส่วน</option>
              <option value="cooperative">สหกรณ์</option>
              <option value="state_enterprise">รัฐวิสาหกิจ</option>
              <option value="other">อื่นๆ</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {/* Table toolbar */}
          <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <input type="checkbox"
                checked={selectedVendors.length === vendors.length && vendors.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300" />
              <span className="text-sm text-gray-600">
                {selectedVendors.length > 0
                  ? `เลือก ${selectedVendors.length} รายการ`
                  : `ทั้งหมด ${totalItems} รายการ`}
              </span>
            </div>
            {selectedVendors.length > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={() => handleBulkAction('activate')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
                  <Power className="w-4 h-4" /> เปิดใช้งาน
                </button>
                <button onClick={() => handleBulkAction('deactivate')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700">
                  <PowerOff className="w-4 h-4" /> ปิดใช้งาน
                </button>
                <button onClick={() => handleBulkAction('delete')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
                  <Trash2 className="w-4 h-4" /> ลบ
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-10 px-6 py-3"></th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้รับจ้าง</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ประเภท / เลขผู้เสียภาษี</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ติดต่อ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                      <p className="text-gray-500 mt-2">กำลังโหลด...</p>
                    </td>
                  </tr>
                ) : vendors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">ไม่พบข้อมูลผู้รับจ้าง</p>
                      {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all') && (
                        <button onClick={() => { setSearchInput(''); setStatusFilter('all'); setTypeFilter('all') }}
                          className="mt-2 text-sm text-blue-600 hover:underline">ล้างตัวกรอง</button>
                      )}
                    </td>
                  </tr>
                ) : (
                  vendors.map((vendor) => {
                    const status = getStatusBadge(vendor.status, vendor.is_blacklisted)
                    const StatusIcon = status.icon
                    const type = getVendorTypeLabel(vendor.vendor_type)
                    const TypeIcon = type.icon
                    return (
                      <tr key={vendor.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4">
                          <input type="checkbox" checked={selectedVendors.includes(vendor.id)}
                            onChange={() => toggleSelect(vendor.id)} className="w-4 h-4 rounded border-gray-300" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${vendor.is_blacklisted ? 'bg-red-100' : 'bg-blue-100'}`}>
                              <TypeIcon className={`w-5 h-5 ${vendor.is_blacklisted ? 'text-red-600' : 'text-blue-600'}`} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{vendor.name}</p>
                              {vendor.name_en && <p className="text-sm text-gray-500">{vendor.name_en}</p>}
                              {vendor.is_blacklisted && vendor.blacklist_reason && (
                                <p className="text-xs text-red-600 mt-1 bg-red-50 px-1.5 py-0.5 rounded">
                                  {vendor.blacklist_reason}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm">
                            {type.label}
                          </span>
                          {vendor.tax_id && <p className="text-sm text-gray-600 mt-1">{vendor.tax_id}</p>}
                        </td>
                        <td className="px-6 py-4 space-y-1">
                          {vendor.phone && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Phone className="w-4 h-4 flex-shrink-0" /> {vendor.phone}
                            </div>
                          )}
                          {vendor.email && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Mail className="w-4 h-4 flex-shrink-0" /> {vendor.email}
                              {!vendor.email_verified && (
                                <span className="text-xs text-amber-600 ml-1" title="ยังไม่ยืนยันอีเมล">⚠️</span>
                              )}
                            </div>
                          )}
                          {vendor.province && (
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <MapPin className="w-4 h-4 flex-shrink-0" /> {vendor.province}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                            <StatusIcon className="w-3 h-3" /> {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => navigate(`/vendors/${vendor.id}`)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition" title="ดูรายละเอียด">
                              <Eye className="w-4 h-4 text-gray-600" />
                            </button>
                            <button onClick={() => navigate(`/vendors/${vendor.id}/edit`)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition" title="แก้ไข">
                              <Edit className="w-4 h-4 text-gray-600" />
                            </button>
                            {!vendor.is_system && (
                              <button onClick={() => handleDelete(vendor.id, vendor.name)}
                                className="p-2 hover:bg-red-50 rounded-lg transition" title="ลบ">
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalItems > 0 && (
            <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                แสดง {vendors.length} จาก {totalItems} รายการ
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="p-2 hover:bg-gray-200 rounded-lg disabled:opacity-40">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-600">หน้า {currentPage} / {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="p-2 hover:bg-gray-200 rounded-lg disabled:opacity-40">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Confirm dialog */}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} />
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ title, value, subtitle, icon, color }: {
  title: string; value: number; subtitle: string; icon: React.ReactNode; color: string
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200', green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
  }
  return (
    <div className={`${colors[color] ?? 'bg-gray-50 border-gray-200'} border rounded-xl p-4`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-lg shadow-sm">{icon}</div>
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}
