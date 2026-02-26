import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Search, Plus, Filter, MoreVertical, Building2, 
  Star, Phone, Mail, MapPin, FileText, CheckCircle,
  XCircle, AlertTriangle, ChevronLeft, ChevronRight,
  Download, Eye, Edit, Trash2, Award, TrendingUp,
  Calendar, DollarSign, User, Ban, Power, PowerOff
} from 'lucide-react'
import NavigationHeader from '../components/NavigationHeader'
import vendorService from '../services/vendorService'
import type { Vendor, VendorStats } from '../services/vendorService'

export default function Vendors() {
  const navigate = useNavigate()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])

  // Stats
  const [stats, setStats] = useState<VendorStats>({
    total_vendors: 0,
    active_vendors: 0,
    blacklisted_vendors: 0
  })

  useEffect(() => {
    fetchVendors()
    fetchStats()
  }, [currentPage, statusFilter, typeFilter, searchQuery])

  const fetchVendors = async () => {
    try {
      setLoading(true)
      const response = await vendorService.getVendors({
        page: currentPage,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        vendor_type: typeFilter !== 'all' ? typeFilter : undefined,
        search: searchQuery || undefined
      })
      
      if (response.success) {
        setVendors(response.data)
        setTotalPages(response.meta.pages)
        setTotalItems(response.meta.total)
      }
    } catch (error) {
      console.error('Failed to fetch vendors:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await vendorService.getVendorStats()
      if (response.success) {
        setStats(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบผู้รับจ้างนี้?')) return
    
    try {
      await vendorService.deleteVendor(id)
      fetchVendors()
      fetchStats()
    } catch (error) {
      console.error('Failed to delete vendor:', error)
      alert('ไม่สามารถลบผู้รับจ้างได้')
    }
  }

  const formatCurrency = (value?: number) => {
    if (!value) return '-'
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`
    }
    return value.toString()
  }

  const getStatusBadge = (status: string, isBlacklisted: boolean) => {
    if (isBlacklisted) {
      return { 
        label: 'แบล็คลิสต์ (ห้ามทำสัญญา)', 
        color: 'text-red-600', 
        bg: 'bg-red-100', 
        icon: Ban 
      }
    }
    
    const configs: Record<string, { label: string; color: string; bg: string; icon: any }> = {
      active: { label: 'พร้อมใช้งาน', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
      inactive: { label: 'ไม่ใช้งาน (เลิกกิจการ/ไม่ต่อสัญญา)', color: 'text-gray-600', bg: 'bg-gray-100', icon: XCircle },
      blacklisted: { label: 'แบล็คลิสต์ (ห้ามทำสัญญา)', color: 'text-red-600', bg: 'bg-red-100', icon: AlertTriangle },
      suspended: { label: 'ระงับชั่วคราว (สอบสวน/ปรับปรุง)', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: AlertTriangle },
      pending: { label: 'รอตรวจสอบเอกสาร', color: 'text-blue-600', bg: 'bg-blue-100', icon: Calendar }
    }
    return configs[status] || configs.inactive
  }

  const getVendorTypeLabel = (type: string) => {
    const types: Record<string, { label: string; icon: any }> = {
      individual: { label: 'บุคคลธรรมดา', icon: User },
      company: { label: 'นิติบุคคล', icon: Building2 },
      partnership: { label: 'ห้างหุ้นส่วน', icon: Building2 },
      cooperative: { label: 'สหกรณ์', icon: Building2 },
      state_enterprise: { label: 'รัฐวิสาหกิจ', icon: Building2 },
      other: { label: 'อื่นๆ', icon: Building2 }
    }
    return types[type] || { label: type, icon: Building2 }
  }

  const toggleSelectAll = () => {
    if (selectedVendors.length === vendors.length) {
      setSelectedVendors([])
    } else {
      setSelectedVendors(vendors.map(v => v.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedVendors(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

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
            <Plus className="w-5 h-5" />
            เพิ่มผู้รับจ้าง
          </button>
        )}
      />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard 
            title="ผู้รับจ้างทั้งหมด"
            value={stats.total_vendors}
            subtitle="ราย"
            icon={<Building2 className="w-6 h-6 text-blue-600" />}
            color="blue"
          />
          <StatCard 
            title="ใช้งาน"
            value={stats.active_vendors}
            subtitle="ราย"
            icon={<CheckCircle className="w-6 h-6 text-green-600" />}
            color="green"
          />
          <StatCard 
            title="แบล็คลิสต์"
            value={stats.blacklisted_vendors}
            subtitle="ราย"
            icon={<AlertTriangle className="w-6 h-6 text-red-600" />}
            color="red"
          />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อผู้รับจ้าง รหัส หรือเลขประจำตัวผู้เสียภาษี..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">สถานะทั้งหมด</option>
              <option value="active">พร้อมใช้งาน</option>
              <option value="inactive">ไม่ใช้งาน</option>
              <option value="pending">รอตรวจสอบเอกสาร</option>
              <option value="suspended">ระงับชั่วคราว</option>
              <option value="blacklisted">แบล็คลิสต์</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
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

        {/* Vendors Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                checked={selectedVendors.length === vendors.length && vendors.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-600">
                {selectedVendors.length > 0 
                  ? `เลือก ${selectedVendors.length} รายการ`
                  : `ทั้งหมด ${totalItems} รายการ`
                }
              </span>
            </div>
            
            {/* Bulk Actions */}
            {selectedVendors.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      await vendorService.bulkAction('activate', selectedVendors)
                      fetchVendors()
                      fetchStats()
                      setSelectedVendors([])
                    } catch (error) {
                      alert('ไม่สามารถเปิดใช้งานได้')
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
                >
                  <Power className="w-4 h-4" />
                  เปิดใช้งาน
                </button>
                <button
                  onClick={async () => {
                    try {
                      await vendorService.bulkAction('deactivate', selectedVendors)
                      fetchVendors()
                      fetchStats()
                      setSelectedVendors([])
                    } catch (error) {
                      alert('ไม่สามารถปิดใช้งานได้')
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition"
                >
                  <PowerOff className="w-4 h-4" />
                  ปิดใช้งาน
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`ลบผู้รับจ้าง ${selectedVendors.length} รายการ?`)) return
                    try {
                      await vendorService.bulkAction('delete', selectedVendors)
                      fetchVendors()
                      fetchStats()
                      setSelectedVendors([])
                    } catch (error) {
                      alert('ไม่สามารถลบได้')
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition"
                >
                  <Trash2 className="w-4 h-4" />
                  ลบ
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-10 px-6 py-3"></th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้รับจ้าง</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ประเภท/เลขผู้เสียภาษี</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ติดต่อ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-gray-500 mt-2">กำลังโหลด...</p>
                    </td>
                  </tr>
                ) : vendors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      ไม่พบข้อมูลผู้รับจ้าง
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
                          <input
                            type="checkbox"
                            checked={selectedVendors.includes(vendor.id)}
                            onChange={() => toggleSelect(vendor.id)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${vendor.is_blacklisted ? 'bg-red-100' : 'bg-blue-100'}`}>
                              <TypeIcon className={`w-5 h-5 ${vendor.is_blacklisted ? 'text-red-600' : 'text-blue-600'}`} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{vendor.name}</p>
                              {vendor.name_en && (
                                <p className="text-sm text-gray-500">{vendor.name_en}</p>
                              )}
                              {vendor.is_blacklisted && vendor.blacklist_reason && (
                                <p className="text-xs text-red-600 mt-1 bg-red-50 p-1 rounded">
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
                          <p className="text-sm text-gray-600 mt-1">{vendor.tax_id}</p>
                        </td>
                        <td className="px-6 py-4">
                          {vendor.phone && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Phone className="w-4 h-4" />
                              {vendor.phone}
                            </div>
                          )}
                          {vendor.email && (
                            <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                              <Mail className="w-4 h-4" />
                              {vendor.email}
                              {!vendor.email_verified && (
                                <span className="text-xs text-amber-600 ml-1" title="ยังไม่ยืนยันอีเมล">⚠️</span>
                              )}
                            </div>
                          )}
                          {vendor.province && (
                            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                              <MapPin className="w-4 h-4" />
                              {vendor.province}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => navigate(`/vendors/${vendor.id}`)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition"
                              title="ดูรายละเอียด"
                            >
                              <Eye className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                              onClick={() => navigate(`/vendors/${vendor.id}/edit`)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition"
                              title="แก้ไข"
                            >
                              <Edit className="w-4 h-4 text-gray-600" />
                            </button>
                            {!vendor.is_system && (
                              <button
                                onClick={() => handleDelete(vendor.id)}
                                className="p-2 hover:bg-red-50 rounded-lg transition"
                                title="ลบ"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
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
          {!loading && vendors.length > 0 && (
            <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                แสดง {vendors.length} จาก {totalItems} รายการ
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-600">
                  หน้า {currentPage} จาก {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function StatCard({ title, value, subtitle, icon, color }: {
  title: string
  value: string | number
  subtitle: string
  icon: React.ReactNode
  color: string
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200'
  }

  return (
    <div className={`${colors[color]} border rounded-xl p-4`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-lg shadow-sm">
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}
