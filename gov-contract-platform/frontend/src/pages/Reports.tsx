import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  TrendingUp, FileText, Users, DollarSign, 
  Calendar, Download, Filter, PieChart, BarChart3, 
  Activity, Clock, AlertTriangle, CheckCircle, 
  ChevronDown, Printer, Share2, RefreshCw
} from 'lucide-react'
import NavigationHeader from '../components/NavigationHeader'
import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1'
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Mock data for reports
const mockStats = {
  totalContracts: 156,
  totalValue: 1250000000,
  activeContracts: 89,
  completedContracts: 45,
  expiredContracts: 22,
  avgContractValue: 8012820,
  contractsThisMonth: 12,
  contractsGrowth: 15.5,
  valueGrowth: 23.8
}

const mockMonthlyData = [
  { month: 'ม.ค.', contracts: 8, value: 45000000 },
  { month: 'ก.พ.', contracts: 12, value: 78000000 },
  { month: 'มี.ค.', contracts: 15, value: 95000000 },
  { month: 'เม.ย.', contracts: 10, value: 62000000 },
  { month: 'พ.ค.', contracts: 18, value: 120000000 },
  { month: 'มิ.ย.', contracts: 14, value: 89000000 },
  { month: 'ก.ค.', contracts: 16, value: 105000000 },
  { month: 'ส.ค.', contracts: 20, value: 145000000 },
  { month: 'ก.ย.', contracts: 22, value: 168000000 },
  { month: 'ต.ค.', contracts: 19, value: 142000000 },
  { month: 'พ.ย.', contracts: 15, value: 98000000 },
  { month: 'ธ.ค.', contracts: 7, value: 56000000 },
]

const mockDepartmentData = [
  { name: 'กรมการค้าต่างประเทศ', contracts: 28, value: 320000000, color: 'bg-blue-500' },
  { name: 'กรมบัญชีกลาง', contracts: 35, value: 280000000, color: 'bg-green-500' },
  { name: 'กรมสรรพากร', contracts: 22, value: 195000000, color: 'bg-purple-500' },
  { name: 'กรมศุลกากร', contracts: 18, value: 165000000, color: 'bg-orange-500' },
  { name: 'กรมโยธาธิการ', contracts: 15, value: 125000000, color: 'bg-pink-500' },
  { name: 'อื่นๆ', contracts: 38, value: 165000000, color: 'bg-gray-400' },
]

const mockVendorData = [
  { name: 'บริษัท เอบีซี จำกัด', contracts: 12, value: 185000000, status: 'active' },
  { name: 'ห้างหุ้นส่วน ศิริวัฒน์', contracts: 8, value: 142000000, status: 'active' },
  { name: 'บริษัท การ์ดเดี่ยว จำกัด', contracts: 15, value: 98000000, status: 'active' },
  { name: 'บริษัท โตโยต้า มอเตอร์', contracts: 6, value: 89000000, status: 'active' },
  { name: 'บริษัท ไทย คอนสตรัคชั่น', contracts: 9, value: 76000000, status: 'warning' },
]

const mockExpiringContracts = [
  { id: 1, number: 'CNT-2024-015', title: 'จัดจ้างเหมาก่อสร้าง', daysLeft: 3, value: 8500000 },
  { id: 2, number: 'CNT-2024-023', title: 'จัดซื้ออุปกรณ์สำนักงาน', daysLeft: 12, value: 1250000 },
  { id: 3, number: 'CNT-2024-031', title: 'บริการรักษาความปลอดภัย', daysLeft: 18, value: 3200000 },
  { id: 4, number: 'CNT-2024-042', title: 'จัดทำซอฟต์แวร์', daysLeft: 25, value: 4500000 },
  { id: 5, number: 'CNT-2024-055', title: 'บริการทำความสะอาด', daysLeft: 28, value: 890000 },
]

export default function Reports() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('year')
  const [department, setDepartment] = useState('all')
  const [activeTab, setActiveTab] = useState<'overview' | 'contracts' | 'vendors' | 'financial'>('overview')

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 500)
  }, [])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('th-TH').format(value)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavigationHeader
        title="รายงานและสถิติ"
        subtitle="Reports & Analytics"
        breadcrumbs={[{ label: 'รายงาน' }]}
        actions={(
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 transition">
              <Printer className="w-4 h-4" />
              <span className="hidden md:inline">พิมพ์</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">ดาวน์โหลด</span>
            </button>
          </div>
        )}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="month">เดือนนี้</option>
                <option value="quarter">ไตรมาสนี้</option>
                <option value="year">ปีนี้</option>
                <option value="custom">กำหนดเอง</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">ทุกหน่วยงาน</option>
                <option value="commerce">กรมการค้าต่างประเทศ</option>
                <option value="account">กรมบัญชีกลาง</option>
                <option value="revenue">กรมสรรพากร</option>
                <option value="customs">กรมศุลกากร</option>
              </select>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition ml-auto"
            >
              <RefreshCw className="w-4 h-4" />
              รีเฟรช
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border mb-6">
          <div className="flex border-b">
            {[
              { key: 'overview', label: 'ภาพรวม', icon: PieChart },
              { key: 'contracts', label: 'สัญญา', icon: FileText },
              { key: 'vendors', label: 'ผู้รับจ้าง', icon: Users },
              { key: 'financial', label: 'การเงิน', icon: DollarSign },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition ${
                  activeTab === tab.key 
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <MetricCard
                icon={<FileText className="w-6 h-6 text-blue-600" />}
                title="สัญญาทั้งหมด"
                value={formatNumber(mockStats.totalContracts)}
                change={`+${mockStats.contractsGrowth}%`}
                changeType="positive"
              />
              <MetricCard
                icon={<DollarSign className="w-6 h-6 text-green-600" />}
                title="มูลค่ารวม"
                value={formatCurrency(mockStats.totalValue)}
                change={`+${mockStats.valueGrowth}%`}
                changeType="positive"
              />
              <MetricCard
                icon={<CheckCircle className="w-6 h-6 text-purple-600" />}
                title="สัญญาที่ใช้งาน"
                value={formatNumber(mockStats.activeContracts)}
                subtitle={`จาก ${mockStats.totalContracts} สัญญา`}
              />
              <MetricCard
                icon={<Clock className="w-6 h-6 text-orange-600" />}
                title="สัญญาใหม่เดือนนี้"
                value={formatNumber(mockStats.contractsThisMonth)}
                change="+3 จากเดือนที่แล้ว"
                changeType="positive"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Chart */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">สัญญารายเดือน</h3>
                  <BarChart3 className="w-5 h-5 text-gray-400" />
                </div>
                <div className="h-64 flex items-end justify-between gap-2">
                  {mockMonthlyData.map((data, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                      <div 
                        className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition cursor-pointer relative group"
                        style={{ height: `${(data.value / 200000000) * 100}%` }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                          {formatCurrency(data.value)}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">{data.month}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Department Distribution */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">สัญญาตามหน่วยงาน</h3>
                  <PieChart className="w-5 h-5 text-gray-400" />
                </div>
                <div className="space-y-4">
                  {mockDepartmentData.map((dept, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700">{dept.name}</span>
                        <span className="text-sm font-medium text-gray-900">
                          {dept.contracts} สัญญา ({formatCurrency(dept.value)})
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`${dept.color} h-2 rounded-full transition-all duration-500`}
                          style={{ width: `${(dept.contracts / 35) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Expiring Contracts */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">สัญญาใกล้หมดอายุ</h3>
                  <p className="text-sm text-gray-500">สัญญาที่จะหมดอายุภายใน 30 วัน</p>
                </div>
                <AlertTriangle className="w-6 h-6 text-orange-500" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">เลขที่สัญญา</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">ชื่อสัญญา</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">มูลค่า</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">เหลือเวลา</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockExpiringContracts.map((contract) => (
                      <tr key={contract.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900">{contract.number}</td>
                        <td className="py-3 px-4 text-sm text-gray-700">{contract.title}</td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right">{formatCurrency(contract.value)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            contract.daysLeft <= 7 ? 'bg-red-100 text-red-700' :
                            contract.daysLeft <= 14 ? 'bg-orange-100 text-orange-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {contract.daysLeft} วัน
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                            ดำเนินการ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Contracts Tab */}
        {activeTab === 'contracts' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">สัญญาที่ดำเนินการ</p>
                    <p className="text-2xl font-bold text-gray-900">89</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Activity className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">สัญญาเสร็จสิ้น</p>
                    <p className="text-2xl font-bold text-gray-900">45</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">สัญญาหมดอายุ</p>
                    <p className="text-2xl font-bold text-gray-900">22</p>
                  </div>
                  <div className="p-3 bg-red-100 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">ประเภทสัญญา</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[
                  { type: 'จัดซื้อจัดจ้าง', count: 85, value: 890000000, color: 'bg-blue-500' },
                  { type: 'เหมาก่อสร้าง', count: 32, value: 245000000, color: 'bg-green-500' },
                  { type: 'จ้างบริการ', count: 28, value: 95000000, color: 'bg-purple-500' },
                  { type: 'จ้างที่ปรึกษา', count: 15, value: 65000000, color: 'bg-indigo-500' },
                  { type: 'เช่าทรัพย์สิน', count: 18, value: 42000000, color: 'bg-yellow-500' },
                  { type: 'สัมปทาน', count: 8, value: 85000000, color: 'bg-red-500' },
                  { type: 'ซ่อมบำรุง', count: 22, value: 28000000, color: 'bg-gray-500' },
                  { type: 'ฝึกอบรม', count: 12, value: 15000000, color: 'bg-pink-500' },
                  { type: 'วิจัยและพัฒนา', count: 6, value: 120000000, color: 'bg-teal-500' },
                  { type: 'พัฒนาซอฟต์แวร์', count: 14, value: 55000000, color: 'bg-cyan-500' },
                  { type: 'ประกันภัย', count: 9, value: 18000000, color: 'bg-orange-500' },
                  { type: 'จัดหาพลังงาน', count: 7, value: 95000000, color: 'bg-amber-500' },
                  { type: 'ขนส่ง/โลจิสติกส์', count: 11, value: 35000000, color: 'bg-lime-500' },
                  { type: 'จัดการขยะ', count: 5, value: 22000000, color: 'bg-emerald-500' },
                  { type: 'จัดการน้ำ', count: 6, value: 28000000, color: 'bg-sky-500' },
                  { type: 'อื่นๆ', count: 8, value: 15000000, color: 'bg-slate-500' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className={`w-12 h-12 ${item.color} rounded-lg flex items-center justify-center`}>
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.type}</p>
                      <p className="text-sm text-gray-500">{item.count} สัญญา</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{formatCurrency(item.value)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Vendors Tab */}
        {activeTab === 'vendors' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">ผู้รับจ้าง TOP 5</h3>
              <div className="space-y-4">
                {mockVendorData.map((vendor, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{vendor.name}</p>
                      <p className="text-sm text-gray-500">{vendor.contracts} สัญญา</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{formatCurrency(vendor.value)}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        vendor.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {vendor.status === 'active' ? 'ใช้งาน' : 'ตรวจสอบ'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">สถานะผู้รับจ้าง</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">ใช้งานอยู่</span>
                    <span className="font-medium">42 ราย</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600"> blacklist</span>
                    <span className="font-medium text-red-600">3 ราย</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">รอตรวจสอบ</span>
                    <span className="font-medium text-yellow-600">5 ราย</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">การประเมินผู้รับจ้าง</h3>
                <div className="text-center">
                  <p className="text-4xl font-bold text-blue-600">4.2</p>
                  <p className="text-sm text-gray-500">คะแนนเฉลี่ย</p>
                  <p className="text-xs text-gray-400 mt-1">จาก 5 คะแนน</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Financial Tab */}
        {activeTab === 'financial' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <p className="text-sm text-gray-500 mb-1">งบประมาณรวม</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(1500000000)}</p>
                <p className="text-sm text-green-600 mt-1">+5% จากปีที่แล้ว</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <p className="text-sm text-gray-500 mb-1">ใช้จ่ายไปแล้ว</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(890000000)}</p>
                <p className="text-sm text-gray-500 mt-1">59% ของงบประมาณ</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <p className="text-sm text-gray-500 mb-1">คงเหลือ</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(610000000)}</p>
                <p className="text-sm text-gray-500 mt-1">41% ของงบประมาณ</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">การจ่ายเงินรายเดือน</h3>
              <div className="h-64 flex items-end justify-between gap-2">
                {mockMonthlyData.map((data, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <div 
                      className="w-full bg-green-500 rounded-t hover:bg-green-600 transition cursor-pointer relative group"
                      style={{ height: `${(data.value / 200000000) * 60}%` }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                        {formatCurrency(data.value * 0.6)}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{data.month}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">สรุปการเงิน</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">รายการ</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">จำนวน</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">มูลค่า</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-3 px-4 text-sm text-gray-700">รอการอนุมัติ</td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right">5 รายการ</td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right">{formatCurrency(45000000)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4 text-sm text-gray-700">รอการจ่ายเงิน</td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right">8 รายการ</td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right">{formatCurrency(125000000)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4 text-sm text-gray-700">จ่ายเงินแล้ว</td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right">142 รายการ</td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right">{formatCurrency(890000000)}</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">รวม</td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900 text-right">155 รายการ</td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900 text-right">{formatCurrency(1060000000)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function MetricCard({ 
  icon, 
  title, 
  value, 
  change, 
  changeType,
  subtitle 
}: { 
  icon: React.ReactNode
  title: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative'
  subtitle?: string
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className={`text-sm mt-1 ${
              changeType === 'positive' ? 'text-green-600' : 'text-red-600'
            }`}>
              {change}
            </p>
          )}
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className="p-3 bg-gray-100 rounded-lg">
          {icon}
        </div>
      </div>
    </div>
  )
}
