import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Search, Plus, Filter, MoreVertical, Building2, 
  Star, Phone, Mail, MapPin, FileText, CheckCircle,
  XCircle, AlertTriangle, ChevronLeft, ChevronRight,
  Download, Eye, Edit, Trash2, Award, TrendingUp,
  Calendar, DollarSign, User
} from 'lucide-react'
import NavigationHeader from '../components/NavigationHeader'
import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1' })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

interface Vendor {
  id: string
  code: string
  name_th: string
  name_en?: string
  vendor_type: 'individual' | 'company' | 'partnership'
  tax_id: string
  status: 'active' | 'inactive' | 'blacklisted'
  
  // Contact
  address?: string
  province?: string
  phone?: string
  email?: string
  
  // Stats
  total_contracts: number
  total_value: number
  average_score?: number
  last_evaluation_date?: string
  
  // Banking
  bank_name?: string
  bank_account?: string
  
  // Flags
  is_blacklisted: boolean
  blacklist_reason?: string
  
  created_at: string
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  active: { label: 'ใช้งาน', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
  inactive: { label: 'ไม่ใช้งาน', color: 'text-gray-600', bg: 'bg-gray-100', icon: XCircle },
  blacklisted: { label: 'แบล็คลิสต์', color: 'text-red-600', bg: 'bg-red-100', icon: AlertTriangle },
}

const vendorTypeConfig: Record<string, { label: string; icon: any }> = {
  individual: { label: 'บุคคลธรรมดา', icon: User },
  company: { label: 'นิติบุคคล', icon: Building2 },
  partnership: { label: 'ห้างหุ้นส่วน', icon: Building2 },
}

const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

const getScoreBg = (score: number) => {
  if (score >= 80) return 'bg-green-100'
  if (score >= 60) return 'bg-yellow-100'
  return 'bg-red-100'
}

export default function Vendors() {
  const navigate = useNavigate()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    blacklisted: 0,
    companies: 0,
    individuals: 0
  })

  useEffect(() => {
    fetchVendors()
    fetchStats()
  }, [currentPage, statusFilter, typeFilter, searchQuery])

  const fetchVendors = async () => {
    try {
      setLoading(true)
      // TODO: Replace with actual API
      // const response = await api.get('/vendors', {
      //   params: { page: currentPage, status: statusFilter !== 'all' ? statusFilter : undefined, type: typeFilter !== 'all' ? typeFilter : undefined, search: searchQuery }
      // })

      // Mock data
      const mockVendors: Vendor[] = [
        {
          id: 'VEN-001',
          code: 'SUP-2024-001',
          name_th: 'บริษัท ก่อสร้างไทย จำกัด',
          name_en: 'Thai Construction Co., Ltd.',
          vendor_type: 'company',
          tax_id: '0105551001234',
          status: 'active',
          address: '123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
          province: 'กรุงเทพมหานคร',
          phone: '02-123-4567',
          email: 'contact@thaiconstruction.co.th',
          total_contracts: 15,
          total_value: 85000000,
          average_score: 85,
          last_evaluation_date: '2024-01-15',
          bank_name: 'ธนาคารกรุงเทพ',
          bank_account: '123-4-56789-0',
          is_blacklisted: false,
          created_at: '2020-03-15'
        },
        {
          id: 'VEN-002',
          code: 'SUP-2024-002',
          name_th: 'บริษัท ไอที โซลูชั่น จำกัด',
          name_en: 'IT Solution Co., Ltd.',
          vendor_type: 'company',
          tax_id: '0105552005678',
          status: 'active',
          address: '456 ถนนพระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ 10310',
          province: 'กรุงเทพมหานคร',
          phone: '02-987-6543',
          email: 'info@itsolution.co.th',
          total_contracts: 8,
          total_value: 12000000,
          average_score: 92,
          last_evaluation_date: '2024-02-20',
          bank_name: 'ธนาคารไทยพาณิชย์',
          bank_account: '987-6-54321-0',
          is_blacklisted: false,
          created_at: '2021-06-20'
        },
        {
          id: 'VEN-003',
          code: 'SUP-2024-003',
          name_th: 'สมชาย ใจดี',
          name_en: 'Somchai Jaidee',
          vendor_type: 'individual',
          tax_id: '1234567890123',
          status: 'active',
          address: '789 หมู่ 5 ตำบลบางพลี อำเภอบางพลี สมุทรปราการ 10540',
          province: 'สมุทรปราการ',
          phone: '081-234-5678',
          email: 'somchai.j@email.com',
          total_contracts: 5,
          total_value: 2500000,
          average_score: 78,
          last_evaluation_date: '2023-12-10',
          bank_name: 'ธนาคารกสิกรไทย',
          bank_account: '789-0-12345-6',
          is_blacklisted: false,
          created_at: '2022-01-10'
        },
        {
          id: 'VEN-004',
          code: 'SUP-2024-004',
          name_th: 'ห้างหุ้นส่วนจำกัด ซ่อมรถกลาง',
          name_en: 'Central Garage Ltd. Part.',
          vendor_type: 'partnership',
          tax_id: '0123456001234',
          status: 'active',
          address: '321 ถนนเพชรบุรี แขวงถนนเพชรบุรี เขตราชเทวี กรุงเทพฯ 10400',
          province: 'กรุงเทพมหานคร',
          phone: '02-456-7890',
          email: 'service@centralgarage.co.th',
          total_contracts: 12,
          total_value: 3500000,
          average_score: 88,
          last_evaluation_date: '2024-01-30',
          bank_name: 'ธนาคารกรุงไทย',
          bank_account: '321-4-56789-0',
          is_blacklisted: false,
          created_at: '2019-08-05'
        },
        {
          id: 'VEN-005',
          code: 'SUP-2024-005',
          name_th: 'บริษัท งานไม่เสร็จ จำกัด',
          name_en: 'Incomplete Work Co., Ltd.',
          vendor_type: 'company',
          tax_id: '0105553009999',
          status: 'blacklisted',
          address: '999 ถนนลาดพร้าว กรุงเทพฯ 10310',
          province: 'กรุงเทพมหานคร',
          phone: '02-111-2222',
          email: 'bad@company.com',
          total_contracts: 3,
          total_value: 5000000,
          average_score: 35,
          last_evaluation_date: '2023-06-15',
          is_blacklisted: true,
          blacklist_reason: 'ทำงานไม่ตรงตามสัญญา ส่งมอบล่าช้าเกินกำหนด 3 ครั้ง',
          created_at: '2021-03-20'
        },
        {
          id: 'VEN-006',
          code: 'SUP-2024-006',
          name_th: 'มานี มีนา',
          name_en: 'Manee Mina',
          vendor_type: 'individual',
          tax_id: '9876543210123',
          status: 'inactive',
          address: '111 หมู่ 2 ตำบลแม่เหียะ อำเภอเมือง เชียงใหม่ 50100',
          province: 'เชียงใหม่',
          phone: '089-876-5432',
          email: 'manee.m@gmail.com',
          total_contracts: 2,
          total_value: 800000,
          is_blacklisted: false,
          created_at: '2022-09-15'
        }
      ]
      setVendors(mockVendors)
      setTotalPages(3)
    } catch (error) {
      console.error('Failed to fetch vendors:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    setStats({
      total: 156,
      active: 142,
      blacklisted: 4,
      companies: 89,
      individuals: 67
    })
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`
    }
    return value.toString()
  }

  const filteredVendors = vendors.filter(v => {
    if (statusFilter !== 'all' && v.status !== statusFilter) return false
    if (typeFilter !== 'all' && v.vendor_type !== typeFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return v.name_th.toLowerCase().includes(query) ||
             v.name_en?.toLowerCase().includes(query) ||
             v.code.toLowerCase().includes(query) ||
             v.tax_id.includes(query)
    }
    return true
  })

  const toggleSelectAll = () => {
    if (selectedVendors.length === filteredVendors.length) {
      setSelectedVendors([])
    } else {
      setSelectedVendors(filteredVendors.map(v => v.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedVendors(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const renderStars = (score?: number) => {
    if (!score) return <span className="text-gray-400 text-sm">ไม่มีคะแนน</span>
    const stars = Math.round(score / 20)
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star 
            key={i} 
            className={`w-4 h-4 ${i < stars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} 
          />
        ))}
        <span className="ml-2 text-sm font-medium">{score}</span>
      </div>
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <StatCard 
            title="ผู้รับจ้างทั้งหมด"
            value={stats.total}
            subtitle="ราย"
            icon={<Building2 className="w-6 h-6 text-blue-600" />}
            color="blue"
          />
          <StatCard 
            title="ใช้งาน"
            value={stats.active}
            subtitle="ราย"
            icon={<CheckCircle className="w-6 h-6 text-green-600" />}
            color="green"
          />
          <StatCard 
            title="แบล็คลิสต์"
            value={stats.blacklisted}
            subtitle="ราย"
            icon={<AlertTriangle className="w-6 h-6 text-red-600" />}
            color="red"
          />
          <StatCard 
            title="นิติบุคคล"
            value={stats.companies}
            subtitle="ราย"
            icon={<Building2 className="w-6 h-6 text-purple-600" />}
            color="purple"
          />
          <StatCard 
            title="บุคคลธรรมดา"
            value={stats.individuals}
            subtitle="ราย"
            icon={<User className="w-6 h-6 text-orange-600" />}
            color="orange"
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
              <option value="active">ใช้งาน</option>
              <option value="inactive">ไม่ใช้งาน</option>
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
            </select>

            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                รายการ
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                กริด
              </button>
            </div>
          </div>
        </div>

        {/* Vendors Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                checked={selectedVendors.length === filteredVendors.length && filteredVendors.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-600">
                เลือกทั้งหมด {filteredVendors.length} รายการ
              </span>
            </div>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สัญญา/มูลค่า</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">คะแนน</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredVendors.map((vendor) => {
                  const status = statusConfig[vendor.status]
                  const StatusIcon = status.icon
                  const type = vendorTypeConfig[vendor.vendor_type]
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
                            <p className="font-medium text-gray-900">{vendor.name_th}</p>
                            {vendor.name_en && (
                              <p className="text-sm text-gray-500">{vendor.name_en}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">รหัส: {vendor.code}</p>
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
                        <p className="text-sm text-gray-600 mt-1">เลขผู้เสียภาษี: {vendor.tax_id}</p>
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
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">{vendor.total_contracts} สัญญา</p>
                          <p className="text-gray-600">฿{formatCurrency(vendor.total_value)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {renderStars(vendor.average_score)}
                        {vendor.last_evaluation_date && (
                          <p className="text-xs text-gray-400 mt-1">
                            ประเมินล่าสุด: {new Date(vendor.last_evaluation_date).toLocaleDateString('th-TH')}
                          </p>
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
                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                            title="แก้ไข"
                          >
                            <Edit className="w-4 h-4 text-gray-600" />
                          </button>
                          <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                            <MoreVertical className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              แสดง {filteredVendors.length} จาก {stats.total} รายการ
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
