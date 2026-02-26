import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  Upload, FileText, Users, ChevronDown, User, LogOut, 
  AlertTriangle, Clock, CheckCircle, TrendingUp, Calendar,
  ArrowRight, Shield, Briefcase, DollarSign, Search, Mic, Camera
} from 'lucide-react'
import NotificationDropdown from '../components/NotificationDropdown'
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

// Mock data for contracts - replace with real API call
const mockContracts = [
  { id: 1, number: 'CNT-2024-001', title: 'จัดซื้ออุปกรณ์คอมพิวเตอร์', vendor: 'บริษัท เอบีซี จำกัด', value: 2500000, endDate: '2025-03-15', status: 'active', daysLeft: 18 },
  { id: 2, number: 'CNT-2024-015', title: 'จัดจ้างเหมาก่อสร้าง', vendor: 'ห้างหุ้นส่วน ศิริวัฒน์', value: 8500000, endDate: '2025-02-28', status: 'warning', daysLeft: 3 },
  { id: 3, number: 'CNT-2024-042', title: 'บริการรักษาความปลอดภัย', vendor: 'บริษัท การ์ดเดี่ยว จำกัด', value: 1200000, endDate: '2025-04-20', status: 'active', daysLeft: 54 },
  { id: 4, number: 'CNT-2023-089', title: 'จัดซื้อรถยนต์ราชการ', vendor: 'บริษัท โตโยต้า มอเตอร์', value: 1500000, endDate: '2025-01-30', status: 'expired', daysLeft: -26 },
]

const mockStats = {
  totalContracts: 156,
  activeContracts: 89,
  expiringSoon: 12,
  totalValue: 125000000,
  pendingApproval: 5,
  pendingPayment: 8
}

const mockActivities = [
  { id: 1, type: 'upload', text: 'อัปโหลดสัญญา CNT-2024-055', time: '5 นาทีที่แล้ว', user: 'สมชาย ใจดี' },
  { id: 2, type: 'approve', text: 'อนุมัติสัญญา CNT-2024-052', time: '1 ชั่วโมงที่แล้ว', user: 'วิทยา รักษ์ไทย' },
  { id: 3, type: 'expire', text: 'สัญญา CNT-2023-089 หมดอายุ', time: '2 ชั่วโมงที่แล้ว', user: 'ระบบ' },
  { id: 4, type: 'payment', text: 'ชำระเงินงวดที่ 2 CNT-2024-015', time: '3 ชั่วโมงที่แล้ว', user: 'นงนุช รัตน์มงคล' },
  { id: 5, type: 'upload', text: 'อัปโหลดใบเสนอราคา', time: '5 ชั่วโมงที่แล้ว', user: 'ประเสริฐ เกิดมงคล' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
      return
    }
    try {
      const response = await api.get('/auth/me')
      setUser(response.data)
    } catch (err) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      navigate('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    navigate('/login')
  }

  const getDisplayName = () => {
    if (!user) return ''
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    return user.username || user.email || 'ผู้ใช้'
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(value)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
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
      {/* Header */}
      <header className="bg-blue-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <Shield className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold">Gov Contract Platform</h1>
              <p className="text-blue-200 text-sm">ระบบบริหารจัดการสัญญาภาครัฐ</p>
            </div>
          </Link>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <NotificationDropdown />
                
                <div className="relative">
                  <button 
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-blue-800 rounded-lg transition"
                  >
                    <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                    <span className="text-sm hidden md:block">{getDisplayName()}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 text-gray-800 z-50">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="font-medium text-sm">{getDisplayName()}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                      <Link 
                        to="/profile"
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 transition"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <User className="w-4 h-4" />
                        <span className="text-sm">โปรไฟล์</span>
                      </Link>
                      <Link 
                        to="/settings"
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 transition"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <Briefcase className="w-4 h-4" />
                        <span className="text-sm">ตั้งค่า</span>
                      </Link>
                      <div className="border-t border-gray-100 mt-2 pt-2">
                        <button 
                          onClick={handleLogout}
                          className="flex items-center gap-2 px-4 py-2 w-full hover:bg-red-50 text-red-600 transition"
                        >
                          <LogOut className="w-4 h-4" />
                          <span className="text-sm">ออกจากระบบ</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Link to="/login" className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg transition">
                เข้าสู่ระบบ
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            สวัสดี, {getDisplayName()}
          </h2>
          <p className="text-gray-600 mt-1">
            วันนี้คุณมี {mockStats.expiringSoon} สัญญาที่ใกล้หมดอายุ และ {mockStats.pendingApproval} รายการรออนุมัติ
          </p>
        </div>

        {/* Google-Style Search Box */}
        <div className="mb-8">
          <div className="max-w-2xl mx-auto">
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition" />
              </div>
              <input
                type="text"
                placeholder="ค้นหาสัญญา เอกสาร หรือผู้รับจ้าง..."
                className="w-full pl-12 pr-24 py-4 bg-white rounded-full shadow-lg border border-gray-200 
                         text-lg text-gray-700 placeholder-gray-400
                         focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300
                         transition-all duration-200 hover:shadow-xl"
              />
              <div className="absolute inset-y-0 right-4 flex items-center gap-2">
                <button 
                  className="p-2 hover:bg-gray-100 rounded-full transition"
                  title="ค้นหาด้วยเสียง"
                >
                  <Mic className="w-5 h-5 text-gray-400 hover:text-blue-500" />
                </button>
                <button 
                  className="p-2 hover:bg-gray-100 rounded-full transition"
                  title="ค้นหาด้วยรูปภาพ"
                >
                  <Camera className="w-5 h-5 text-gray-400 hover:text-blue-500" />
                </button>
              </div>
            </div>
            
            {/* Quick Search Tags */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              <span className="text-sm text-gray-500">ค้นหายอดนิยม:</span>
              {[
                { label: 'สัญญาใกล้หมดอายุ', query: 'expiring' },
                { label: 'รออนุมัติ', query: 'pending' },
                { label: 'สัญญาก่อสร้าง', query: 'construction' },
                { label: 'ผู้รับจ้างใหม่', query: 'new_vendor' },
              ].map((tag) => (
                <button
                  key={tag.query}
                  className="px-3 py-1.5 text-sm bg-white text-gray-600 rounded-full border border-gray-200 
                           hover:bg-gray-50 hover:border-gray-300 transition"
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Link 
            to="/upload"
            className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition border-2 border-transparent hover:border-blue-500"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">อัปโหลดเอกสาร</h3>
                <p className="text-sm text-gray-500">OCR & AI Extraction</p>
              </div>
            </div>
          </Link>

          <Link 
            to="/contracts"
            className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition border-2 border-transparent hover:border-purple-500"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <FileText className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">สัญญา</h3>
                <p className="text-sm text-gray-500">จัดการสัญญาทั้งหมด</p>
              </div>
            </div>
          </Link>

          <Link 
            to="/vendors"
            className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition border-2 border-transparent hover:border-green-500"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">ผู้รับจ้าง</h3>
                <p className="text-sm text-gray-500">ทะเบียนผู้รับจ้าง</p>
              </div>
            </div>
          </Link>

          <Link 
            to="/reports"
            className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition border-2 border-transparent hover:border-orange-500"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <TrendingUp className="w-8 h-8 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">รายงาน</h3>
                <p className="text-sm text-gray-500">วิเคราะห์และสถิติ</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <StatCard 
            icon={<FileText className="w-5 h-5 text-blue-600" />}
            title="สัญญาทั้งหมด"
            value={mockStats.totalContracts}
            color="blue"
          />
          <StatCard 
            icon={<CheckCircle className="w-5 h-5 text-green-600" />}
            title="สัญญาที่ใช้งาน"
            value={mockStats.activeContracts}
            color="green"
          />
          <StatCard 
            icon={<AlertTriangle className="w-5 h-5 text-orange-600" />}
            title="ใกล้หมดอายุ"
            value={mockStats.expiringSoon}
            color="orange"
          />
          <StatCard 
            icon={<DollarSign className="w-5 h-5 text-purple-600" />}
            title="มูลค่ารวม"
            value={formatCurrency(mockStats.totalValue)}
            color="purple"
          />
          <StatCard 
            icon={<Clock className="w-5 h-5 text-yellow-600" />}
            title="รออนุมัติ"
            value={mockStats.pendingApproval}
            color="yellow"
          />
          <StatCard 
            icon={<Calendar className="w-5 h-5 text-red-600" />}
            title="รอชำระเงิน"
            value={mockStats.pendingPayment}
            color="red"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Expiring Contracts */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">สัญญาใกล้หมดอายุ</h3>
                  <p className="text-sm text-gray-500">สัญญาที่จะหมดอายุภายใน 60 วัน</p>
                </div>
                <Link 
                  to="/contracts?filter=expiring"
                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                >
                  ดูทั้งหมด <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              
              <div className="divide-y divide-gray-100">
                {mockContracts.map((contract) => (
                  <div key={contract.id} className="px-6 py-4 hover:bg-gray-50 transition">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            contract.status === 'active' ? 'bg-green-100 text-green-700' :
                            contract.status === 'warning' ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {contract.status === 'active' ? 'ใช้งาน' :
                             contract.status === 'warning' ? 'ใกล้หมด' : 'หมดอายุ'}
                          </span>
                          <span className="text-sm text-gray-500">{contract.number}</span>
                        </div>
                        <h4 className="font-medium text-gray-900 mt-1">{contract.title}</h4>
                        <p className="text-sm text-gray-500">{contract.vendor}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">{formatCurrency(contract.value)}</p>
                        <p className="text-sm text-gray-500">หมดอายุ: {formatDate(contract.endDate)}</p>
                        <p className={`text-xs ${
                          contract.daysLeft <= 0 ? 'text-red-600' :
                          contract.daysLeft <= 7 ? 'text-orange-600' :
                          'text-green-600'
                        }`}>
                          {contract.daysLeft <= 0 ? 'หมดอายุแล้ว' : 
                           `เหลือ ${contract.daysLeft} วัน`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Activities */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">กิจกรรมล่าสุด</h3>
              <div className="space-y-4">
                {mockActivities.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className={`p-2 rounded-lg ${
                      activity.type === 'upload' ? 'bg-blue-100' :
                      activity.type === 'approve' ? 'bg-green-100' :
                      activity.type === 'expire' ? 'bg-red-100' :
                      'bg-purple-100'
                    }`}>
                      {activity.type === 'upload' ? <Upload className="w-4 h-4 text-blue-600" /> :
                       activity.type === 'approve' ? <CheckCircle className="w-4 h-4 text-green-600" /> :
                       activity.type === 'expire' ? <AlertTriangle className="w-4 h-4 text-red-600" /> :
                       <DollarSign className="w-4 h-4 text-purple-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{activity.text}</p>
                      <p className="text-xs text-gray-500">{activity.user} • {activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Tasks */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">งานที่ต้องทำ</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">ต่ออายุสัญญา CNT-2024-015</p>
                    <p className="text-xs text-gray-500">ครบกำหนดในอีก 3 วัน</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">อนุมัติสัญญา CNT-2024-058</p>
                    <p className="text-xs text-gray-500">รอการอนุมัติ</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">ตรวจสอบเอกสาร CNT-2024-060</p>
                    <p className="text-xs text-gray-500">เอกสารไม่ครบถ้วน</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-400 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          <p>Gov Contract Platform v2.0.0 - Built for Thailand Government</p>
        </div>
      </footer>
    </div>
  )
}

function StatCard({ icon, title, value, color }: { 
  icon: React.ReactNode
  title: string
  value: string | number
  color: 'blue' | 'green' | 'orange' | 'purple' | 'yellow' | 'red'
}) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    orange: 'bg-orange-50 border-orange-200',
    purple: 'bg-purple-50 border-purple-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    red: 'bg-red-50 border-red-200'
  }

  return (
    <div className={`${colors[color]} border rounded-xl p-4`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-lg shadow-sm">
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-600">{title}</p>
          <p className="text-lg font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}
