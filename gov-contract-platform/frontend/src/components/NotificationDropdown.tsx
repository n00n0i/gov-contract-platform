import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Bell, Check, Trash2, FileText, AlertTriangle, 
  Clock, CheckCircle, DollarSign, User, X,
  ChevronRight
} from 'lucide-react'

interface Notification {
  id: number
  type: string
  title: string
  message: string
  time: string
  read: boolean
  link: string
  priority: 'high' | 'medium' | 'low'
}

const mockNotifications: Notification[] = [
  {
    id: 1,
    type: 'contract_expiry',
    title: 'สัญญาใกล้หมดอายุ',
    message: 'สัญญา CNT-2024-015 จะหมดอายุในอีก 3 วัน',
    time: '5 นาทีที่แล้ว',
    read: false,
    link: '/contracts',
    priority: 'high'
  },
  {
    id: 2,
    type: 'payment',
    title: 'การชำระเงิน',
    message: 'งวดที่ 2 ของสัญญา CNT-2024-042 ครบกำหนดชำระวันพรุ่งนี้',
    time: '30 นาทีที่แล้ว',
    read: false,
    link: '/contracts',
    priority: 'high'
  },
  {
    id: 3,
    type: 'document',
    title: 'อัปโหลดเอกสาร',
    message: 'คุณสมชาย ได้อัปโหลดเอกสารใหม่ในสัญญา CNT-2024-058',
    time: '1 ชั่วโมงที่แล้ว',
    read: false,
    link: '/contracts',
    priority: 'medium'
  },
  {
    id: 4,
    type: 'approval',
    title: 'รอการอนุมัติ',
    message: 'สัญญา CNT-2024-060 รอการอนุมัติจากคุณ',
    time: '2 ชั่วโมงที่แล้ว',
    read: true,
    link: '/contracts',
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
]

const notificationIcons: Record<string, React.ReactNode> = {
  contract_expiry: <AlertTriangle className="w-4 h-4" />,
  payment: <DollarSign className="w-4 h-4" />,
  document: <FileText className="w-4 h-4" />,
  approval: <Clock className="w-4 h-4" />,
  system: <CheckCircle className="w-4 h-4" />,
}

const notificationColors: Record<string, string> = {
  contract_expiry: 'bg-red-100 text-red-600',
  payment: 'bg-green-100 text-green-600',
  document: 'bg-blue-100 text-blue-600',
  approval: 'bg-yellow-100 text-yellow-600',
  system: 'bg-purple-100 text-purple-600',
}

export default function NotificationDropdown() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter(n => !n.read).length
  const highPriorityCount = notifications.filter(n => n.priority === 'high' && !n.read).length

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id)
    setIsOpen(false)
    navigate(notification.link)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-blue-800 rounded-lg transition relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">การแจ้งเตือน</h3>
                <p className="text-xs text-gray-500">
                  {unreadCount > 0 ? `มี ${unreadCount} รายการยังไม่อ่าน` : 'อ่านทั้งหมดแล้ว'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="อ่านทั้งหมด"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>ไม่มีการแจ้งเตือน</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`px-4 py-3 border-b hover:bg-gray-50 cursor-pointer transition ${
                    !notification.read ? 'bg-blue-50/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`p-2 rounded-lg flex-shrink-0 ${
                      notificationColors[notification.type] || 'bg-gray-100'
                    }`}>
                      {notificationIcons[notification.type] || <Bell className="w-4 h-4" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className={`font-medium text-sm ${!notification.read ? 'text-gray-900' : 'text-gray-600'}`}>
                              {notification.title}
                            </p>
                            {notification.priority === 'high' && (
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                                ด่วน
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{notification.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{notification.time}</p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1">
                      {!notification.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            markAsRead(notification.id)
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="อ่านแล้ว"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteNotification(notification.id)
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="ลบ"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t bg-gray-50">
              <button
                onClick={() => {
                  setIsOpen(false)
                  navigate('/notifications')
                }}
                className="w-full flex items-center justify-center gap-1 text-sm text-blue-600 hover:text-blue-800 py-1"
              >
                ดูทั้งหมด
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
