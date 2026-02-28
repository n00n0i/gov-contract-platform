import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Search, Plus, Filter, MoreVertical, FileText,
  Calendar, DollarSign, Building2, User, AlertCircle,
  CheckCircle, Clock, XCircle, ChevronLeft, ChevronRight,
  Download, Eye, Edit, Trash2, Paperclip, RefreshCw
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
  status: 'draft' | 'active' | 'completed' | 'terminated' | 'expired'
  value: number
  start_date: string
  end_date: string
  vendor_name?: string
  vendor_id?: string
  department_name?: string
  document_count: number
  payment_percentage: number
  created_at: string
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  draft: { label: 'ร่าง', color: 'text-gray-600', bg: 'bg-gray-100', icon: FileText },
  active: { label: 'ดำเนินการ', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
  completed: { label: 'เสร็จสิ้น', color: 'text-blue-600', bg: 'bg-blue-100', icon: CheckCircle },
  terminated: { label: 'ยกเลิก', color: 'text-red-600', bg: 'bg-red-100', icon: XCircle },
  expired: { label: 'หมดอายุ', color: 'text-orange-600', bg: 'bg-orange-100', icon: Clock },
}

// ประเภทสัญญาภาครัฐครบถ้วน
const contractTypeLabels: Record<string, string> = {
  procurement: 'จัดซื้อจัดจ้าง',
  construction: 'เหมาก่อสร้าง',
  service: 'จ้างบริการ',
  consultant: 'จ้างที่ปรึกษา',
  rental: 'เช่าทรัพย์สิน',
  concession: 'สัมปทาน',
  maintenance: 'ซ่อมบำรุง',
  training: 'ฝึกอบรม',
  research: 'วิจัยและพัฒนา',
  software: 'พัฒนาซอฟต์แวร์',
  land_sale: 'ซื้อขายที่ดิน',
  insurance: 'ประกันภัย',
  advertising: 'โฆษณา',
  medical: 'สาธารณสุข',
  agriculture: 'เกษตรกรรม',
}

const contractTypeColors: Record<string, string> = {
  procurement: 'bg-blue-100 text-blue-700',
  construction: 'bg-green-100 text-green-700',
  service: 'bg-purple-100 text-purple-700',
  consultant: 'bg-indigo-100 text-indigo-700',
  rental: 'bg-yellow-100 text-yellow-700',
  concession: 'bg-red-100 text-red-700',
  maintenance: 'bg-gray-100 text-gray-700',
  training: 'bg-pink-100 text-pink-700',
  research: 'bg-teal-100 text-teal-700',
  software: 'bg-cyan-100 text-cyan-700',
  land_sale: 'bg-orange-100 text-orange-700',
  insurance: 'bg-amber-100 text-amber-700',
  advertising: 'bg-lime-100 text-lime-700',
  medical: 'bg-rose-100 text-rose-700',
  agriculture: 'bg-emerald-100 text-emerald-700',
}

export default function Contracts() {
  const navigate = useNavigate()
  const location = useLocation()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [apiSearchQuery, setApiSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedContracts, setSelectedContracts] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    expiringSoon: 0,
    totalValue: 0
  })
  const [statFilter, setStatFilter] = useState<string>('all')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const initialSearchQuery = params.get('search')
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery)
      setApiSearchQuery(initialSearchQuery)
    }
  }, [location.search])

  useEffect(() => {
    fetchContracts()
    fetchStats()
  }, [currentPage, statusFilter, apiSearchQuery])

  const fetchContracts = async () => {
    try {
      setLoading(true)
      const params: any = {
        page: currentPage,
        page_size: 20
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }
      if (apiSearchQuery) {
        params.search = apiSearchQuery
      }

      const response = await api.get('/contracts', { params })
      setContracts(response.data.items || [])
      setTotalPages(response.data.pages || 1)
    } catch (error) {
      console.error('Failed to fetch contracts:', error)
      setContracts([])
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await api.get('/contracts/stats/summary')
      if (response.data && response.data.success) {
        const data = response.data.data
        setStats({
          total: data.total_contracts || 0,
          active: data.active_contracts || 0,
          completed: 0, // TODO: Add completed count to API
          expiringSoon: data.expiring_soon || 0,
          totalValue: data.total_value || 0
        })
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const formatCurrency = (value: number) => {
    if (!value || value === 0) return '0'
    return new Intl.NumberFormat('th-TH').format(value)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getDaysRemaining = (endDate: string) => {
    const days = Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return days
  }

  const filteredContracts = contracts.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (c.title || '').toLowerCase().includes(query) ||
        (c.contract_number || '').includes(query) ||
        (c.vendor_name || '').toLowerCase().includes(query)
    }
    return true
  })

  const toggleSelectAll = () => {
    if (selectedContracts.length === filteredContracts.length) {
      setSelectedContracts([])
    } else {
      setSelectedContracts(filteredContracts.map(c => c.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedContracts(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
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
            <button
              onClick={() => { fetchContracts(); fetchStats(); }}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              รีเฟรชข้อมูล
            </button>
            <button
              onClick={() => navigate('/contracts/new')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              สร้างสัญญาใหม่
            </button>
          </div>
        )}
      />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="สัญญาทั้งหมด"
            value={stats.total}
            subtitle="รายการ"
            icon={<FileText className="w-6 h-6 text-blue-600" />}
            color="blue"
            isActive={statFilter === 'all'}
            onClick={() => { setStatFilter('all'); setStatusFilter('all'); }}
          />
          <StatCard
            title="กำลังดำเนินการ"
            value={stats.active}
            subtitle="สัญญา"
            icon={<CheckCircle className="w-6 h-6 text-green-600" />}
            color="green"
            isActive={statFilter === 'active'}
            onClick={() => { setStatFilter('active'); setStatusFilter('active'); }}
          />
          <StatCard
            title="ใกล้หมดอายุ"
            value={stats.expiringSoon}
            subtitle="สัญญา"
            icon={<AlertCircle className="w-6 h-6 text-orange-600" />}
            color="orange"
            isActive={statFilter === 'expiring'}
            onClick={() => { setStatFilter('expiring'); setStatusFilter('expired'); }}
          />
          <StatCard
            title="มูลค่ารวม"
            value={formatCurrency(stats.totalValue)}
            subtitle="บาท"
            icon={<span className="text-xl font-bold text-purple-600">฿</span>}
            color="purple"
            isActive={false}
          />
        </div>

        {/* Filters & Search */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[300px]">
              <form onSubmit={(e) => {
                e.preventDefault()
                setApiSearchQuery(searchQuery)
              }} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาสัญญา เลขที่ หรือผู้รับจ้าง... (กด Enter เพื่อค้นหา)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </form>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">สถานะทั้งหมด</option>
              <option value="draft">ร่าง</option>
              <option value="active">ดำเนินการ</option>
              <option value="completed">เสร็จสิ้น</option>
              <option value="expired">หมดอายุ</option>
              <option value="terminated">ยกเลิก</option>
            </select>

            {/* View Mode Toggle */}
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

        {/* Contracts List */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                checked={selectedContracts.length === filteredContracts.length && filteredContracts.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-600">
                เลือกทั้งหมด {filteredContracts.length} รายการ
              </span>
            </div>
            {selectedContracts.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">เลือก {selectedContracts.length} รายการ</span>
                <button className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition">
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สัญญา</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ประเภท</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้รับจ้าง</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">มูลค่า</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ระยะเวลา</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ความคืบหน้า</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredContracts.map((contract) => {
                  const status = statusConfig[contract.status]
                  const StatusIcon = status.icon
                  const daysRemaining = getDaysRemaining(contract.end_date)

                  return (
                    <tr key={contract.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedContracts.includes(contract.id)}
                          onChange={() => toggleSelect(contract.id)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{contract.title}</p>
                          <p className="text-sm text-gray-500">เลขที่ {contract.contract_number}</p>
                          {contract.document_count > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600 mt-1">
                              <Paperclip className="w-3 h-3" />
                              {contract.document_count} เอกสาร
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${contractTypeColors[contract.contract_type] || 'bg-gray-100 text-gray-700'
                          }`}>
                          {contractTypeLabels[contract.contract_type] || contract.contract_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-700">{contract.vendor_name}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{contract.department_name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{formatCurrency(contract.value)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="text-gray-700">{formatDate(contract.start_date)}</p>
                          <p className="text-gray-500">ถึง {formatDate(contract.end_date)}</p>
                          {contract.status === 'active' && daysRemaining <= 30 && (
                            <p className="text-xs text-orange-600 mt-1">
                              เหลือ {daysRemaining} วัน
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-full max-w-[100px]">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">{contract.payment_percentage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${contract.payment_percentage === 100 ? 'bg-green-500' : 'bg-blue-500'
                                }`}
                              style={{ width: `${contract.payment_percentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => navigate(`/contracts/${contract.id}`)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                            title="ดูรายละเอียด"
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => navigate(`/upload?contract_id=${contract.id}`)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                            title="อัปโหลดเอกสาร"
                          >
                            <Paperclip className="w-4 h-4 text-gray-600" />
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
              แสดง {filteredContracts.length} จาก {stats.total} รายการ
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-600">
                หน้า {currentPage} จาก {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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

function StatCard({ title, value, subtitle, icon, color, isActive, onClick }: {
  title: string
  value: string | number
  subtitle: string
  icon: React.ReactNode
  color: string
  isActive?: boolean
  onClick?: () => void
}) {
  const colors: Record<string, { bg: string; border: string; active: string }> = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', active: 'ring-2 ring-blue-500 border-blue-500' },
    green: { bg: 'bg-green-50', border: 'border-green-200', active: 'ring-2 ring-green-500 border-green-500' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', active: 'ring-2 ring-orange-500 border-orange-500' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', active: 'ring-2 ring-purple-500 border-purple-500' }
  }

  const colorStyle = colors[color]
  const clickableClass = onClick ? 'cursor-pointer hover:shadow-md transition-all' : ''
  const activeClass = isActive ? colorStyle.active : ''

  return (
    <div
      onClick={onClick}
      className={`${colorStyle.bg} ${colorStyle.border} border rounded-xl p-4 ${clickableClass} ${activeClass}`}
    >
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
