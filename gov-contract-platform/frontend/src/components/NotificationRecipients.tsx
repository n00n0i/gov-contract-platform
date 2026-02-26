import { useState, useEffect } from 'react'
import { 
  Users, Plus, Trash2, Edit3, Search, RefreshCw, 
  CheckCircle, XCircle, Mail, Filter, Download, Upload,
  UserCheck, UserX, MoreVertical, ChevronDown, ChevronUp
} from 'lucide-react'
import {
  getRecipients,
  createRecipient,
  createBulkRecipients,
  updateRecipient,
  deleteRecipient,
  toggleRecipient,
  verifyRecipient,
  getRecipientStats,
  type NotificationRecipient
} from '../services/notificationRecipientService'
import {
  getNotificationTypes,
  type NotificationType
} from '../services/notificationService'

interface NotificationRecipientsProps {
  userRole?: string
}

export default function NotificationRecipients({ userRole = 'user' }: NotificationRecipientsProps) {
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [stats, setStats] = useState<any>(null)
  const [notificationTypes, setNotificationTypes] = useState<NotificationType[]>([])
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingRecipient, setEditingRecipient] = useState<NotificationRecipient | null>(null)
  
  // Form states
  const [newRecipient, setNewRecipient] = useState<Partial<NotificationRecipient>>({
    email: '',
    name: '',
    recipient_type: 'email',
    notification_types: 'all',
    channel: 'email',
    min_priority: 'low',
    is_active: true
  })
  const [bulkEmails, setBulkEmails] = useState('')
  
  const isAdmin = userRole === 'admin' || userRole === 'super_admin'
  
  useEffect(() => {
    loadData()
  }, [filterType, filterStatus])
  
  const loadData = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (filterType !== 'all') params.recipient_type = filterType
      if (filterStatus === 'active') params.is_active = true
      if (filterStatus === 'inactive') params.is_active = false
      if (searchQuery) params.search = searchQuery
      
      const [recipientsRes, statsRes, typesRes] = await Promise.all([
        getRecipients(params),
        getRecipientStats(),
        getNotificationTypes()
      ])
      
      setRecipients(recipientsRes.data.data || [])
      setStats(statsRes.data.data)
      setNotificationTypes(typesRes.data.data || [])
    } catch (error) {
      console.error('Failed to load recipients:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const handleSearch = () => {
    loadData()
  }
  
  const handleCreateRecipient = async () => {
    try {
      await createRecipient(newRecipient)
      setShowAddModal(false)
      setNewRecipient({
        email: '',
        name: '',
        recipient_type: 'email',
        notification_types: 'all',
        channel: 'email',
        min_priority: 'low',
        is_active: true
      })
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to create recipient')
    }
  }
  
  const handleCreateBulk = async () => {
    try {
      const emails = bulkEmails.split('\n').map(e => e.trim()).filter(e => e)
      await createBulkRecipients({
        emails,
        recipient_type: 'email',
        notification_types: 'all',
        channel: 'email',
        min_priority: 'low'
      })
      setShowBulkModal(false)
      setBulkEmails('')
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to create bulk recipients')
    }
  }
  
  const handleUpdateRecipient = async () => {
    if (!editingRecipient) return
    try {
      await updateRecipient(editingRecipient.id, editingRecipient)
      setShowEditModal(false)
      setEditingRecipient(null)
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to update recipient')
    }
  }
  
  const handleDeleteRecipient = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recipient?')) return
    try {
      await deleteRecipient(id)
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to delete recipient')
    }
  }
  
  const handleToggleRecipient = async (id: string) => {
    try {
      await toggleRecipient(id)
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to toggle recipient')
    }
  }
  
  const handleVerifyRecipient = async (id: string) => {
    try {
      await verifyRecipient(id)
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to verify recipient')
    }
  }
  
  const openEditModal = (recipient: NotificationRecipient) => {
    setEditingRecipient({ ...recipient })
    setShowEditModal(true)
  }
  
  // Stats cards
  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white rounded-lg border p-4 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  )
  
  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            title="ผู้รับทั้งหมด" 
            value={stats.total} 
            icon={Users} 
            color="bg-blue-500" 
          />
          <StatCard 
            title="กำลังใช้งาน" 
            value={stats.active} 
            icon={UserCheck} 
            color="bg-green-500" 
          />
          <StatCard 
            title="ยืนยันแล้ว" 
            value={stats.verified} 
            icon={CheckCircle} 
            color="bg-purple-500" 
          />
          <StatCard 
            title="รอการยืนยัน" 
            value={stats.unverified} 
            icon={Mail} 
            color="bg-orange-500" 
          />
        </div>
      )}
      
      {/* Filters & Actions */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 items-center flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="ค้นหาอีเมลหรือชื่อ..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
            
            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="all">ทุกประเภท</option>
              <option value="email">อีเมล</option>
              <option value="user">ผู้ใช้ระบบ</option>
              <option value="role">ตามบทบาท</option>
              <option value="department">ตามแผนก</option>
            </select>
            
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="active">เปิดใช้งาน</option>
              <option value="inactive">ปิดใช้งาน</option>
            </select>
            
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              รีเฟรช
            </button>
          </div>
          
          {/* Actions */}
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowBulkModal(true)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                เพิ่มหลายคน
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                เพิ่มผู้รับ
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Recipients List */}
      <div className="bg-white rounded-lg border">
        {loading ? (
          <div className="flex justify-center items-center p-8">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : recipients.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>ยังไม่มีผู้รับแจ้งเตือน</p>
            <p className="text-sm">คลิก "เพิ่มผู้รับ" เพื่อเพิ่มรายชื่อ</p>
          </div>
        ) : (
          <div className="divide-y">
            {recipients.map((recipient) => (
              <div 
                key={recipient.id} 
                className={`p-4 hover:bg-gray-50 transition-colors ${!recipient.is_active ? 'bg-gray-50 opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Avatar/Status */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      recipient.is_active 
                        ? recipient.is_verified ? 'bg-green-100' : 'bg-yellow-100'
                        : 'bg-gray-100'
                    }`}>
                      {recipient.is_active ? (
                        recipient.is_verified ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <Mail className="w-5 h-5 text-yellow-600" />
                        )
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    
                    {/* Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{recipient.name || recipient.email}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          recipient.recipient_type === 'email' ? 'bg-blue-100 text-blue-700' :
                          recipient.recipient_type === 'user' ? 'bg-green-100 text-green-700' :
                          recipient.recipient_type === 'role' ? 'bg-purple-100 text-purple-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {recipient.recipient_type}
                        </span>
                        {recipient.is_active ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            เปิดใช้งาน
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            ปิดใช้งาน
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{recipient.email}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>ช่องทาง: {recipient.channel}</span>
                        <span>ความสำคัญขั้นต่ำ: {recipient.min_priority}</span>
                        <span>ส่งแล้ว: {recipient.send_count} ครั้ง</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {!recipient.is_verified && isAdmin && (
                      <button
                        onClick={() => handleVerifyRecipient(recipient.id)}
                        className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                        title="ยืนยันอีเมล"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleRecipient(recipient.id)}
                      className={`p-2 rounded-lg ${
                        recipient.is_active 
                          ? 'text-green-600 hover:bg-green-50' 
                          : 'text-gray-400 hover:bg-gray-100'
                      }`}
                      title={recipient.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                    >
                      {recipient.is_active ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEditModal(recipient)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="แก้ไข"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRecipient(recipient.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="ลบ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">เพิ่มผู้รับแจ้งเตือน</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  อีเมล *
                </label>
                <input
                  type="email"
                  value={newRecipient.email}
                  onChange={(e) => setNewRecipient({...newRecipient, email: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="email@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อ (ไม่บังคับ)
                </label>
                <input
                  type="text"
                  value={newRecipient.name}
                  onChange={(e) => setNewRecipient({...newRecipient, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="ชื่อผู้รับ"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ประเภทผู้รับ
                </label>
                <select
                  value={newRecipient.recipient_type}
                  onChange={(e) => setNewRecipient({...newRecipient, recipient_type: e.target.value as any})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="email">อีเมล (External)</option>
                  <option value="user">ผู้ใช้ระบบ</option>
                  <option value="role">ตามบทบาท</option>
                  <option value="department">ตามแผนก</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ช่องทางการแจ้งเตือน
                </label>
                <select
                  value={newRecipient.channel}
                  onChange={(e) => setNewRecipient({...newRecipient, channel: e.target.value as any})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="email">อีเมล</option>
                  <option value="in_app">ในแอป</option>
                  <option value="both">ทั้งสองช่องทาง</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ความสำคัญขั้นต่ำ
                </label>
                <select
                  value={newRecipient.min_priority}
                  onChange={(e) => setNewRecipient({...newRecipient, min_priority: e.target.value as any})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="low">ทุกระดับ</option>
                  <option value="medium">ปานกลางขึ้นไป</option>
                  <option value="high">สูงขึ้นไป</option>
                  <option value="urgent">ฉุกเฉินเท่านั้น</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ประเภทการแจ้งเตือนที่รับ
                </label>
                <select
                  value={newRecipient.notification_types}
                  onChange={(e) => setNewRecipient({...newRecipient, notification_types: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="all">ทั้งหมด</option>
                  {notificationTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCreateRecipient}
                disabled={!newRecipient.email}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Bulk Add Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold mb-4">เพิ่มผู้รับหลายคน</h3>
            <p className="text-sm text-gray-500 mb-4">
              ใส่อีเมลหลายบรรทัด (แยกแต่ละอีเมลด้วยการขึ้นบรรทัดใหม่)
            </p>
            
            <textarea
              value={bulkEmails}
              onChange={(e) => setBulkEmails(e.target.value)}
              className="w-full h-48 px-3 py-2 border rounded-lg font-mono text-sm"
              placeholder="admin@example.com&#10;manager@example.com&#10;user@example.com"
            />
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowBulkModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCreateBulk}
                disabled={!bulkEmails.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                เพิ่ม {bulkEmails.split('\n').filter(e => e.trim()).length} คน
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Modal */}
      {showEditModal && editingRecipient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">แก้ไขผู้รับแจ้งเตือน</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  อีเมล
                </label>
                <input
                  type="email"
                  value={editingRecipient.email}
                  onChange={(e) => setEditingRecipient({...editingRecipient, email: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อ
                </label>
                <input
                  type="text"
                  value={editingRecipient.name || ''}
                  onChange={(e) => setEditingRecipient({...editingRecipient, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ช่องทางการแจ้งเตือน
                </label>
                <select
                  value={editingRecipient.channel}
                  onChange={(e) => setEditingRecipient({...editingRecipient, channel: e.target.value as any})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="email">อีเมล</option>
                  <option value="in_app">ในแอป</option>
                  <option value="both">ทั้งสองช่องทาง</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ความสำคัญขั้นต่ำ
                </label>
                <select
                  value={editingRecipient.min_priority}
                  onChange={(e) => setEditingRecipient({...editingRecipient, min_priority: e.target.value as any})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="low">ทุกระดับ</option>
                  <option value="medium">ปานกลางขึ้นไป</option>
                  <option value="high">สูงขึ้นไป</option>
                  <option value="urgent">ฉุกเฉินเท่านั้น</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleUpdateRecipient}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
