import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Upload, FileText, Users, ChevronDown, User, LogOut,
  AlertTriangle, Clock, CheckCircle, TrendingUp, Calendar,
  ArrowRight, Shield, Briefcase, Search, Wallet, MessageSquare, BookOpen,
  Loader2, Brain, XCircle,
} from 'lucide-react'
import NotificationDropdown from '../components/NotificationDropdown'
import ChatSidebar from '../components/ChatSidebar'
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

// Data will be fetched from API
const contracts: any[] = []

const stats = {
  totalContracts: 0,
  activeContracts: 0,
  expiringSoon: 0,
  totalValue: 0,
  pendingApproval: 0,
  pendingPayment: 0
}

const activities: any[] = []

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [stats, setStats] = useState({
    totalContracts: 0,
    activeContracts: 0,
    expiringSoon: 0,
    totalValue: 0,
    pendingApproval: 0,
    pendingPayment: 0
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [pendingQuestion, setPendingQuestion] = useState('')
  const [jobStats, setJobStats] = useState({ pending: 0, processing: 0, completed: 0, failed: 0, total: 0 })

  useEffect(() => {
    fetchUser()
    fetchStats()
    fetchJobStats()
  }, [])

  const fetchJobStats = async () => {
    try {
      const r = await api.get('/documents/jobs/stats')
      if (r.data.success) setJobStats(r.data.data)
    } catch { /* ignore */ }
  }

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

  const fetchStats = async () => {
    try {
      const response = await api.get('/contracts/stats/summary')
      if (response.data && response.data.success) {
        const data = response.data.data
        setStats({
          totalContracts: data.total_contracts || 0,
          activeContracts: data.active_contracts || 0,
          expiringSoon: data.expiring_soon || 0,
          totalValue: data.total_value || 0,
          pendingApproval: data.pending_approval || 0,
          pendingPayment: 0  // TODO: Implement payment tracking
        })
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  const getDisplayName = () => {
    if (!user) return ''
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    return user.username || user.email || 'ผู้ใช้'
  }

  const formatCurrency = (value: number) => {
    if (!value || value === 0) return '0 บาท'
    return new Intl.NumberFormat('th-TH').format(value) + ' บาท'
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
            ยินดีต้อนรับสู่ระบบจัดการสัญญาภาครัฐ
          </p>
        </div>

        {/* Chat-based Search Box */}
        <div className="mb-8">
          <div className="max-w-2xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (searchQuery.trim()) {
                  setPendingQuestion(searchQuery.trim())
                  setSearchQuery('')
                  setChatOpen(true)
                }
              }}
              className="relative group"
            >
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาหรือถามคำถาม... เช่น สัญญาใกล้หมดอายุ"
                className="w-full pl-12 pr-16 py-4 bg-white rounded-full shadow-lg border border-gray-200
                           text-lg text-gray-700 placeholder-gray-400
                           focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300
                           transition-all duration-200 hover:shadow-xl"
              />
              <div className="absolute inset-y-0 right-3 flex items-center">
                <button
                  type="submit"
                  disabled={!searchQuery.trim()}
                  className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300
                             text-white rounded-full transition-colors duration-150"
                  title="ถาม AI"
                >
                  <MessageSquare className="w-5 h-5" />
                </button>
              </div>
            </form>

            {/* Quick Prompts */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              <span className="text-sm text-gray-500">ถามเลย:</span>
              {[
                { label: 'สัญญาใกล้หมดอายุ' },
                { label: 'ภาพรวมสัญญาทั้งหมด' },
                { label: 'ผู้รับจ้างที่มีสัญญามากที่สุด' },
                { label: 'สัญญารออนุมัติ' },
              ].map((tag) => (
                <button
                  key={tag.label}
                  onClick={() => {
                    setPendingQuestion(tag.label)
                    setChatOpen(true)
                  }}
                  className="px-3 py-1.5 text-sm bg-white text-gray-600 rounded-full border border-gray-200
                             hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition"
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Link
            to="/upload"
            className="bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition border-2 border-transparent hover:border-blue-500"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 rounded-lg flex-shrink-0">
                <Upload className="w-7 h-7 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">อัปโหลดเอกสาร</h3>
                <p className="text-xs text-gray-500">OCR &amp; AI</p>
              </div>
            </div>
          </Link>

          <Link
            to="/contracts"
            className="bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition border-2 border-transparent hover:border-purple-500"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 rounded-lg flex-shrink-0">
                <FileText className="w-7 h-7 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">สัญญา</h3>
                <p className="text-xs text-gray-500">จัดการสัญญา</p>
              </div>
            </div>
          </Link>

          <Link
            to="/vendors"
            className="bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition border-2 border-transparent hover:border-green-500"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-100 rounded-lg flex-shrink-0">
                <Users className="w-7 h-7 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">ผู้รับจ้าง</h3>
                <p className="text-xs text-gray-500">ทะเบียน</p>
              </div>
            </div>
          </Link>

          <Link
            to="/knowledge-bases"
            className="bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition border-2 border-transparent hover:border-indigo-500"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-100 rounded-lg flex-shrink-0">
                <BookOpen className="w-7 h-7 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Knowledge</h3>
                <p className="text-xs text-gray-500">RAG &amp; Graph</p>
              </div>
            </div>
          </Link>

          {/* ── งานประมวลผล ── */}
          <Link
            to="/jobs"
            className="bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition border-2 border-transparent hover:border-violet-500 relative"
          >
            {(jobStats.pending + jobStats.processing) > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {jobStats.pending + jobStats.processing}
              </span>
            )}
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-violet-100 rounded-lg flex-shrink-0">
                <Brain className="w-7 h-7 text-violet-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">งานประมวลผล</h3>
                <p className="text-xs text-gray-500">OCR Jobs</p>
              </div>
            </div>
          </Link>

          <Link
            to="/reports"
            className="bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition border-2 border-transparent hover:border-orange-500"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-100 rounded-lg flex-shrink-0">
                <TrendingUp className="w-7 h-7 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">รายงาน</h3>
                <p className="text-xs text-gray-500">วิเคราะห์</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Stats Overview - Clean & Minimal */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Card 1: Contract Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-600">ภาพรวมสัญญา</span>
              </div>
              <Link to="/contracts" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                ดูทั้งหมด
              </Link>
            </div>
            <div className="flex items-end gap-4">
              <div>
                <p className="text-3xl font-bold text-gray-900">{stats.totalContracts}</p>
                <p className="text-xs text-gray-500 mt-0.5">สัญญาทั้งหมด</p>
              </div>
              <div className="flex gap-3 text-xs mb-1">
                <span className="text-green-600 font-medium">{stats.activeContracts} ใช้งาน</span>
                {stats.expiringSoon > 0 && (
                  <span className="text-orange-600 font-medium">{stats.expiringSoon} ใกล้หมด</span>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Total Value */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-50 rounded-lg">
                  <span className="text-lg font-bold text-purple-600">฿</span>
                </div>
                <span className="text-sm font-medium text-gray-600">มูลค่ารวม</span>
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.totalValue)}</p>
              <p className="text-xs text-gray-500 mt-0.5">บาท</p>
            </div>
          </div>

          {/* Card 3: Pending Tasks */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-sm font-medium text-gray-600">รอดำเนินการ</span>
              </div>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-3xl font-bold text-gray-900">{stats.pendingApproval}</p>
                <p className="text-xs text-gray-500 mt-0.5">รออนุมัติ</p>
              </div>
              <div className="w-px bg-gray-200"></div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{stats.pendingPayment}</p>
                <p className="text-xs text-gray-500 mt-0.5">รอชำระ</p>
              </div>
            </div>
          </div>

          {/* Card 4: Processing Jobs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 rounded-lg">
                  <Brain className="w-5 h-5 text-indigo-600" />
                </div>
                <span className="text-sm font-medium text-gray-600">Job Box</span>
              </div>
              <a href="/upload" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">ดูทั้งหมด</a>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-gray-600">กำลังประมวลผล</span>
                </div>
                <span className="font-bold text-blue-600">{jobStats.processing + jobStats.pending}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-gray-600">สำเร็จแล้ว</span>
                </div>
                <span className="font-bold text-green-600">{jobStats.completed}</span>
              </div>
              {jobStats.failed > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-gray-600">ล้มเหลว</span>
                  </div>
                  <span className="font-bold text-red-600">{jobStats.failed}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Expiring Contracts (2/3 width) */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">สัญญาใกล้หมดอายุ</h3>
                    <p className="text-xs text-gray-500">ภายใน 60 วัน</p>
                  </div>
                </div>
                <Link
                  to="/contracts?filter=expiring"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  ดูทั้งหมด <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Content */}
              <div className="divide-y divide-gray-50">
                {contracts.length > 0 ? contracts.map((contract) => (
                  <div key={contract.id} className="px-5 py-3.5 hover:bg-gray-50 transition cursor-pointer">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${contract.status === 'active' ? 'bg-green-100 text-green-700' :
                            contract.status === 'warning' ? 'bg-orange-100 text-orange-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                            {contract.status === 'active' ? 'ใช้งาน' :
                              contract.status === 'warning' ? 'ใกล้หมด' : 'หมดอายุ'}
                          </span>
                          <span className="text-xs text-gray-400">{contract.number}</span>
                        </div>
                        <h4 className="font-medium text-gray-900 text-sm truncate">{contract.title}</h4>
                        <p className="text-xs text-gray-500 truncate">{contract.vendor}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-gray-900 text-sm">{formatCurrency(contract.value)}</p>
                        <p className={`text-xs ${contract.daysLeft <= 0 ? 'text-red-600 font-medium' :
                          contract.daysLeft <= 7 ? 'text-orange-600' :
                            'text-gray-500'
                          }`}>
                          {contract.daysLeft <= 0 ? 'หมดอายุแล้ว' : `เหลือ ${contract.daysLeft} วัน`}
                        </p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="px-5 py-10 text-center text-gray-400">
                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <FileText className="w-6 h-6 text-gray-300" />
                    </div>
                    <p className="text-sm">ไม่มีสัญญาใกล้หมดอายุ</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Activities & Tasks (1/3 width) */}
          <div className="space-y-6">
            {/* Recent Activities */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <Clock className="w-4 h-4 text-gray-600" />
                </div>
                <h3 className="font-semibold text-gray-900">กิจกรรมล่าสุด</h3>
              </div>
              <div className="space-y-3">
                {activities.length > 0 ? activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3 py-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${activity.type === 'upload' ? 'bg-blue-50' :
                      activity.type === 'approve' ? 'bg-green-50' :
                        activity.type === 'expire' ? 'bg-red-50' :
                          'bg-purple-50'
                      }`}>
                      {activity.type === 'upload' ? <Upload className="w-4 h-4 text-blue-600" /> :
                        activity.type === 'approve' ? <CheckCircle className="w-4 h-4 text-green-600" /> :
                          activity.type === 'expire' ? <AlertTriangle className="w-4 h-4 text-red-600" /> :
                            <Wallet className="w-4 h-4 text-purple-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{activity.text}</p>
                      <p className="text-xs text-gray-400">{activity.user} • {activity.time}</p>
                    </div>
                  </div>
                )) : (
                  <div className="text-center text-gray-400 py-6">
                    <p className="text-sm">ยังไม่มีกิจกรรม</p>
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Tasks */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-50 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900">งานที่ต้องทำ</h3>
              </div>
              <div className="text-center text-gray-400 py-6">
                <p className="text-sm">ไม่มีงานที่ต้องทำ</p>
                <p className="text-xs text-gray-400 mt-1">ทุกอย่างเรียบร้อยดี!</p>
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

      {/* Floating chat button - visible when sidebar is closed */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 hover:bg-blue-700
                     text-white rounded-full shadow-xl flex items-center justify-center
                     transition-all duration-200 hover:scale-110"
          title="เปิด AI ผู้ช่วย"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* Chat Sidebar */}
      <ChatSidebar
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        pendingQuestion={pendingQuestion}
        onPendingConsumed={() => setPendingQuestion('')}
      />
    </div>
  )
}


