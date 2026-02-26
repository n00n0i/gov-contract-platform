import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Search, Plus, Filter, MoreVertical, FileText, 
  Calendar, DollarSign, Building2, User, AlertCircle,
  CheckCircle, Clock, XCircle, ChevronLeft, ChevronRight,
  Download, Eye, Edit, Trash2, Paperclip
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
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
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

  useEffect(() => {
    fetchContracts()
    fetchStats()
  }, [currentPage, statusFilter, searchQuery])

  const fetchContracts = async () => {
    try {
      setLoading(true)
      // TODO: Replace with actual API
      // const response = await api.get('/contracts', {
      //   params: { page: currentPage, status: statusFilter !== 'all' ? statusFilter : undefined, search: searchQuery }
      // })
      // setContracts(response.data.items)
      // setTotalPages(response.data.pages)

      // Mock data
      const mockContracts: Contract[] = [
        {
          id: 'CON-2024-001',
          contract_number: '65/2567',
          title: 'สัญญาก่อสร้างอาคารสำนักงาน',
          description: 'งานก่อสร้างอาคารสำนักงาน 3 ชั้น พร้อมติดตั้งระบบไฟฟ้าและประปา',
          contract_type: 'construction',
          status: 'active',
          value: 5500000,
          start_date: '2024-01-15',
          end_date: '2024-12-31',
          vendor_name: 'บริษัท ก่อสร้างไทย จำกัด',
          department_name: 'กองช่าง',
          document_count: 8,
          payment_percentage: 45,
          created_at: '2024-01-10'
        },
        {
          id: 'CON-2024-002',
          contract_number: '78/2567',
          title: 'สัญญาจัดซื้อคอมพิวเตอร์',
          description: 'จัดซื้อคอมพิวเตอร์สำหรับงานราชการ จำนวน 50 เครื่อง',
          contract_type: 'procurement',
          status: 'completed',
          value: 850000,
          start_date: '2024-02-01',
          end_date: '2024-06-30',
          vendor_name: 'บริษัท ไอที โซลูชั่น จำกัด',
          department_name: 'กองคลัง',
          document_count: 12,
          payment_percentage: 100,
          created_at: '2024-01-25'
        },
        {
          id: 'CON-2024-003',
          contract_number: '92/2567',
          title: 'สัญญาบำรุงรักษารถยนต์',
          description: 'งานบำรุงรักษารถยนต์ราชการ ประจำปี 2567',
          contract_type: 'service',
          status: 'active',
          value: 320000,
          start_date: '2024-03-01',
          end_date: '2025-02-28',
          vendor_name: 'บริษัท ซ่อมรถกลาง จำกัด',
          department_name: 'กองการเจ้าหน้าที่',
          document_count: 5,
          payment_percentage: 25,
          created_at: '2024-02-20'
        },
        {
          id: 'CON-2024-004',
          contract_number: '105/2567',
          title: 'สัญญาจัดซื้อเฟอร์นิเจอร์',
          description: 'จัดซื้อเฟอร์นิเจอร์สำนักงาน',
          contract_type: 'procurement',
          status: 'draft',
          value: 450000,
          start_date: '2024-04-01',
          end_date: '2024-08-31',
          vendor_name: 'บริษัท เฟอร์นิเจอร์ไทย จำกัด',
          department_name: 'กองคลัง',
          document_count: 2,
          payment_percentage: 0,
          created_at: '2024-03-15'
        },
        {
          id: 'CON-2023-045',
          contract_number: '128/2566',
          title: 'สัญญาก่อสร้างถนน',
          description: 'งานก่อสร้างถนนคอนกรีตเสริมเหล็ก',
          contract_type: 'construction',
          status: 'expired',
          value: 2800000,
          start_date: '2023-05-01',
          end_date: '2024-02-29',
          vendor_name: 'บริษัท ก่อสร้างถนน จำกัด',
          department_name: 'กองช่าง',
          document_count: 15,
          payment_percentage: 100,
          created_at: '2023-04-15'
        },
        {
          id: 'CON-2024-005',
          contract_number: '156/2567',
          title: 'สัญญาพัฒนาระบบซอฟต์แวร์',
          description: 'พัฒนาระบบบริหารจัดการสัญญาออนไลน์',
          contract_type: 'software',
          status: 'active',
          value: 3500000,
          start_date: '2024-05-01',
          end_date: '2024-12-31',
          vendor_name: 'บริษัท เทคโนโลยี เอไอ จำกัด',
          department_name: 'กองเทคโนโลยีสารสนเทศ',
          document_count: 10,
          payment_percentage: 30,
          created_at: '2024-04-20'
        },
        {
          id: 'CON-2024-006',
          contract_number: '189/2567',
          title: 'สัญญาเช่าอาคารสำนักงาน',
          description: 'เช่าอาคารสำนักงาน 5 ชั้น ใจกลางเมือง',
          contract_type: 'rental',
          status: 'active',
          value: 1200000,
          start_date: '2024-01-01',
          end_date: '2026-12-31',
          vendor_name: 'บริษัท อสังหาริมทรัพย์ กรุงเทพฯ',
          department_name: 'กองการเจ้าหน้าที่',
          document_count: 8,
          payment_percentage: 50,
          created_at: '2023-12-15'
        },
        {
          id: 'CON-2024-007',
          contract_number: '203/2567',
          title: 'สัญญาฝึกอบรมบุคลากร',
          description: 'ฝึกอบรมการใช้ระบบงานใหม่ จำนวน 100 คน',
          contract_type: 'training',
          status: 'draft',
          value: 450000,
          start_date: '2024-07-01',
          end_date: '2024-09-30',
          vendor_name: 'บริษัท เทรนนิ่ง เซ็นเตอร์',
          department_name: 'กองการเจ้าหน้าที่',
          document_count: 3,
          payment_percentage: 0,
          created_at: '2024-06-10'
        },
        {
          id: 'CON-2024-008',
          contract_number: '215/2567',
          title: 'สัญญาซ่อมบำรุงเครื่องปรับอากาศ',
          description: 'ซ่อมบำรุงระบบแอร์อาคารสำนักงานทั้งหมด',
          contract_type: 'maintenance',
          status: 'active',
          value: 280000,
          start_date: '2024-03-01',
          end_date: '2025-02-28',
          vendor_name: 'บริษัท แอร์เซอร์วิส',
          department_name: 'กองช่าง',
          document_count: 6,
          payment_percentage: 60,
          created_at: '2024-02-25'
        },
        {
          id: 'CON-2024-009',
          contract_number: '231/2567',
          title: 'สัญญาประกันภัยทรัพย์สิน',
          description: 'ประกันอัคคีภัยและภัยธรรมชาติ',
          contract_type: 'insurance',
          status: 'completed',
          value: 580000,
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          vendor_name: 'บริษัท ประกันภัย ไทย',
          department_name: 'กองคลัง',
          document_count: 4,
          payment_percentage: 100,
          created_at: '2023-12-20'
        },
        {
          id: 'CON-2024-010',
          contract_number: '245/2567',
          title: 'สัญญาวิจัยพัฒนาระบบ AI',
          description: 'งานวิจัยและพัฒนาระบบ AI วิเคราะห์เอกสาร',
          contract_type: 'research',
          status: 'active',
          value: 8500000,
          start_date: '2024-06-01',
          end_date: '2025-12-31',
          vendor_name: 'สถาบันวิจัยเทคโนโลยี',
          department_name: 'กองนโยบายและแผน',
          document_count: 12,
          payment_percentage: 20,
          created_at: '2024-05-15'
        }
      ]
      setContracts(mockContracts)
      setTotalPages(5)
    } catch (error) {
      console.error('Failed to fetch contracts:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    // Mock stats
    setStats({
      total: 45,
      active: 12,
      completed: 28,
      expiringSoon: 3,
      totalValue: 45000000
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(value)
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
      return c.title.toLowerCase().includes(query) ||
             c.contract_number.includes(query) ||
             c.vendor_name?.toLowerCase().includes(query)
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
          <button
            onClick={() => navigate('/contracts/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            สร้างสัญญาใหม่
          </button>
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
          />
          <StatCard 
            title="กำลังดำเนินการ"
            value={stats.active}
            subtitle="สัญญา"
            icon={<CheckCircle className="w-6 h-6 text-green-600" />}
            color="green"
          />
          <StatCard 
            title="ใกล้หมดอายุ"
            value={stats.expiringSoon}
            subtitle="สัญญา"
            icon={<AlertCircle className="w-6 h-6 text-orange-600" />}
            color="orange"
          />
          <StatCard 
            title="มูลค่ารวม"
            value={formatCurrency(stats.totalValue)}
            subtitle="บาท"
            icon={<DollarSign className="w-6 h-6 text-purple-600" />}
            color="purple"
          />
        </div>

        {/* Filters & Search */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาสัญญา เลขที่ หรือผู้รับจ้าง..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
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
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          contractTypeColors[contract.contract_type] || 'bg-gray-100 text-gray-700'
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
                              className={`h-2 rounded-full transition-all ${
                                contract.payment_percentage === 100 ? 'bg-green-500' : 'bg-blue-500'
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
    orange: 'bg-orange-50 border-orange-200',
    purple: 'bg-purple-50 border-purple-200'
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
