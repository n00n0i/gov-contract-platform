import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Bell, Check, Trash2, Filter, 
  FileText, AlertTriangle, Clock, CheckCircle, 
  DollarSign, User, Calendar, ChevronRight,
  Settings, Archive, X
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

// Mock notifications data
const mockNotifications = [
  {
    id: 1,
    type: 'contract_expiry',
    title: 'สัญญาใกล้หมดอายุ',
    message: 'สัญญา CNT-2024-015 จะหมดอายุในอีก 3 วัน',
    time: '5 นาทีที่แล้ว',
    read: false,
    link: '/contracts/CNT-2024-015',
    priority: 'high'
  },
  {
    id: 2,
    type: 'payment',
    title: 'การชำระเงิน',
    message: 'งวดที่ 2 ของสัญญา CNT-2024-042 ครบกำหนดชำระวันพรุ่งนี้',
    time: '30 นาทีที่แล้ว',
    read: false,
    link: '/contracts/CNT-2024-042',
    priority: 'high'
  },
  {
    id: 3,
    type: 'document',
    title: 'อัปโหลดเอกสาร',
    message: 'คุณสมชาย ได้อัปโหลดเอกสารใหม่ในสัญญา CNT-2024-058',
    time: '1 ชั่วโมงที่แล้ว',
    read: false,
    link: '/contracts/CNT-2024-058',
    priority: 'medium'
  },
  {
    id: 4,
    type: 'approval',
    title: 'รอการอนุมัติ',
    message: 'สัญญา CNT-2024-060 รอการอนุมัติจากคุณ',
    time: '2 ชั่วโมงที่แล้ว',
    read: true,
    link: '/contracts/CNT-2024-060',
    priority: 'medium'
  },
  {
    id: 5,
    type: 'system',
    title: 'อัปเดตระบบ',
    message: 'ระบบมีการอัปเดตเวอร์ชันใหม่ v2.1.0',
    time: '5 ชั่วโมงที่แล้ว',
    read: true,
    link: '/settings',
    priority: 'low'
  },
  {
    id: 6,
    type: 'contract_expiry',
    title: 'สัญญาหมดอายุแล้ว',
    message: 'สัญญา CNT-2023-089 หมดอายุแล้ว กรุณาดำเนินการต่ออายุ',
    time: '1 วันที่แล้ว',
    read: true,
    link: '/contracts/CNT-2023-089',
    priority: 'high'
  },
  {
    id: 7,
    type: 'vendor',
    title: 'ผู้รับจ้างใหม่',
    message: 'มีผู้รับจ้างรายใหม่ลงทะเบียน: บริษัท เทคโนโลยี จำกัด',
    time: '2 วันที่แล้ว',
    read: true,
    link: '/vendors',
    priority: 'low'
  },
  {
    id: 8,
    type: 'payment',
    title: 'ชำระเงินสำเร็จ',
    message: 'การชำระเงินงวดที่ 1 ของสัญญา CNT-2024-055 เสร็จสมบูรณ์',
    time: '3 วันที่แล้ว',
    read: true,
    link: '/contracts/CNT-2024-055',
    priority: 'low'
  },
]

const notificationIcons = {
  contract_expiry: <AlertTriangle className="w-5 h-5" />,
  payment: <DollarSign className="w-5 h-5" />,
  document: <FileText className="w-5 h-5" />,
  approval: <Clock className="w-5 h-5" />,
  system: <Settings className="w-5 h-5" />,
  vendor: <User className="w-5 h-5" />,
}

const notificationColors = {
  contract_expiry: 'bg-red-100 text-red-600',
  payment: 'bg-green-100 text-green-600',
  document: 'bg-blue-100 text-blue-600',
  approval: 'bg-yellow-100 text-yellow-600',
  system: 'bg-purple-100 text-purple-600',
  vendor: 'bg-orange-100 text-orange-600',
}

export default function Notifications() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState(mockNotifications)
  const [filter, setFilter] = useState<'all' | 'unread' | 'high'>('all')
  const [loading, setLoading] = useState(false)

  const unreadCount = notifications.filter(n => !n.read).length
  const highPriorityCount = notifications.filter(n => n.priority === 'high' && !n.read).length

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read
    if (filter === 'high') return n.priority === 'high'
    return true
  })

  const markAsRead = (id: number) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ))
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const deleteNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAll = () => {
    if (confirm('ต้องการลบการแจ้งเตือนทั้งหมด?')) {
      setNotifications([])
    }
  }

  const handleNotificationClick = (notification: typeof mockNotifications[0]) => {
    markAsRead(notification.id)
    navigate(notification.link)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader
        title="การแจ้งเตือน"
        subtitle="Notifications"
        breadcrumbs={[{ label: 'แจ้งเตือน' }]}
      />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bell className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{notifications.length}</p>
                <p className="text-sm text-gray-500">ทั้งหมด</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
                <p className="text-sm text-gray-500">ยังไม่อ่าน</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{highPriorityCount}</p>
                <p className="text-sm text-gray-500">ด่วน</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-xl shadow-sm border mb-6">
          <div className="flex border-b">
            {[
              { key: 'all', label: 'ทั้งหมด', count: notifications.length },
              { key: 'unread', label: 'ยังไม่อ่าน', count: unreadCount },
              { key: 'high', label: 'ด่วน', count: highPriorityCount },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition ${
                  filter === tab.key 
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  filter === tab.key ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">ไม่มีการแจ้งเตือน</h3>
              <p className="text-gray-500">คุณไม่มีการแจ้งเตือนในหมวดหมู่นี้</p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-xl shadow-sm border p-4 transition hover:shadow-md ${
                  !notification.read ? 'border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`p-3 rounded-lg ${notificationColors[notification.type as keyof typeof notificationColors] || 'bg-gray-100'}`}>
                    {notificationIcons[notification.type as keyof typeof notificationIcons] || <Bell className="w-5 h-5" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`font-semibold ${!notification.read ? 'text-gray-900' : 'text-gray-600'}`}>
                            {notification.title}
                          </h3>
                          {notification.priority === 'high' && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                              ด่วน
                            </span>
                          )}
                          {!notification.read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          )}
                        </div>
                        <p className="text-gray-600 mt-1">{notification.message}</p>
                        <p className="text-sm text-gray-400 mt-1">{notification.time}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {!notification.read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="ทำเครื่องหมายว่าอ่านแล้ว"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleNotificationClick(notification)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="ดูรายละเอียด"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="ลบ"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Load More */}
        {filteredNotifications.length > 0 && (
          <div className="text-center mt-6">
            <button className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
              โหลดเพิ่มเติม
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
