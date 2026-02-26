import { useState, useEffect } from 'react'
import { 
  Mail, Server, Bell, CheckCircle, AlertCircle, 
  RefreshCw, Send, Save, Plus, Trash2, Edit3, 
  ChevronDown, ChevronUp, ChevronRight, Settings as SettingsIcon,
  Users, User, Crown, Info
} from 'lucide-react'
import NotificationRecipients from './NotificationRecipients'
import {
  getSMTPSettings,
  createSMTPSettings,
  testSMTPConnection,
  sendTestEmail,
  deleteSMTPSettings,
  getGlobalNotifications,
  getUserNotificationSettings,
  updateUserNotificationSetting,
  updateBulkUserSettings,
  getNotificationTypes,
  getUserNotificationEmail,
  setUserNotificationEmail,
  type SMTPSettings,
  type GlobalNotification,
  type UserNotificationSetting,
  type NotificationType
} from '../services/notificationService'

interface NotificationSettingsProps {
  userRole?: string
}

export default function NotificationSettings({ userRole = 'user' }: NotificationSettingsProps) {
  const [activeTab, setActiveTab] = useState<'personal' | 'smtp' | 'global' | 'recipients'>('personal')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Personal notification settings
  const [userSettings, setUserSettings] = useState<UserNotificationSetting[]>([])
  const [notificationTypes, setNotificationTypes] = useState<NotificationType[]>([])
  const [notificationEmail, setNotificationEmail] = useState('')
  const [useDifferentEmail, setUseDifferentEmail] = useState(false)
  
  // SMTP Settings (admin only)
  const [smtpSettings, setSmtpSettings] = useState<SMTPSettings>({
    host: '',
    port: '587',
    username: '',
    password: '',
    use_tls: true,
    use_ssl: false,
    from_email: '',
    from_name: 'Gov Contract Platform',
    timeout: '30',
    max_retries: '3'
  })
  const [smtpTestEmail, setSmtpTestEmail] = useState('')
  const [smtpStatus, setSmtpStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  
  // Global notifications (admin only)
  const [globalNotifications, setGlobalNotifications] = useState<GlobalNotification[]>([])
  const [showGlobalForm, setShowGlobalForm] = useState(false)
  
  const isAdmin = userRole?.toLowerCase() === 'admin' || userRole?.toLowerCase() === 'super_admin' || userRole?.toLowerCase() === 'administrator'
  
  console.log('NotificationSettings - userRole:', userRole, 'isAdmin:', isAdmin)
  
  useEffect(() => {
    loadData()
  }, [])
  
  const loadData = async () => {
    setLoading(true)
    try {
      // Load personal settings
      const [settingsRes, typesRes, emailRes] = await Promise.all([
        getUserNotificationSettings(),
        getNotificationTypes(),
        getUserNotificationEmail()
      ])
      
      setUserSettings(settingsRes.data.data || [])
      setNotificationTypes(typesRes.data.data || [])
      setNotificationEmail(emailRes.data.data?.notification_email || '')
      setUseDifferentEmail(emailRes.data.data?.use_different_email || false)
      
      // Load admin data if admin
      if (isAdmin) {
        const [smtpRes, globalRes] = await Promise.all([
          getSMTPSettings(),
          getGlobalNotifications()
        ])
        
        if (smtpRes.data.data) {
          setSmtpSettings(smtpRes.data.data)
        }
        setGlobalNotifications(globalRes.data.data || [])
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // Personal Settings Handlers
  const handleToggleSetting = async (settingId: string, field: string, value: any) => {
    try {
      await updateUserNotificationSetting(settingId, { [field]: value })
      setUserSettings(prev => prev.map(s => 
        s.id === settingId ? { ...s, [field]: value } : s
      ))
    } catch (error) {
      console.error('Failed to update setting:', error)
    }
  }
  
  const handleSaveNotificationEmail = async () => {
    try {
      await setUserNotificationEmail(notificationEmail)
      alert('อีเมลสำหรับการแจ้งเตือนถูกบันทึกแล้ว')
    } catch (error) {
      console.error('Failed to save notification email:', error)
      alert('ไม่สามารถบันทึกอีเมลได้')
    }
  }
  
  // SMTP Handlers (admin only)
  const handleSaveSMTP = async () => {
    setSaving(true)
    try {
      const res = await createSMTPSettings(smtpSettings)
      if (res.data.connection_test?.success) {
        alert('บันทึกการตั้งค่า SMTP สำเร็จ')
      } else {
        alert('บันทึกการตั้งค่าแล้ว แต่การทดสอบการเชื่อมต่อล้มเหลว: ' + res.data.connection_test?.message)
      }
    } catch (error) {
      console.error('Failed to save SMTP settings:', error)
      alert('ไม่สามารถบันทึกการตั้งค่า SMTP ได้')
    } finally {
      setSaving(false)
    }
  }
  
  const handleTestSMTP = async () => {
    setSmtpStatus('testing')
    try {
      const res = await testSMTPConnection()
      setSmtpStatus(res.data.success ? 'success' : 'error')
      alert(res.data.message)
    } catch (error) {
      setSmtpStatus('error')
      alert('การทดสอบการเชื่อมต่อล้มเหลว')
    }
  }
  
  const handleSendTestEmail = async () => {
    if (!smtpTestEmail) {
      alert('กรุณาระบุอีเมลผู้รับ')
      return
    }
    try {
      await sendTestEmail({ to_email: smtpTestEmail })
      alert('ส่งอีเมลทดสอบสำเร็จ')
    } catch (error) {
      console.error('Failed to send test email:', error)
      alert('ไม่สามารถส่งอีเมลทดสอบได้')
    }
  }
  
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Section: Personal Settings */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900">การตั้งค่าส่วนบุคคล</h3>
          <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">ของฉัน</span>
        </div>
        
        <div className="bg-white rounded-lg border overflow-hidden">
          <button
            onClick={() => setActiveTab('personal')}
            className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
              activeTab === 'personal' 
                ? 'bg-blue-50 border-l-4 border-blue-600' 
                : 'hover:bg-gray-50 border-l-4 border-transparent'
            }`}
          >
            <Bell className={`w-5 h-5 ${activeTab === 'personal' ? 'text-blue-600' : 'text-gray-400'}`} />
            <div className="flex-1">
              <p className={`font-medium ${activeTab === 'personal' ? 'text-blue-900' : 'text-gray-700'}`}>
                การแจ้งเตือนของฉัน
              </p>
              <p className="text-sm text-gray-500">ตั้งค่าการแจ้งเตือนส่วนตัว เลือกประเภทและช่องทางที่ต้องการรับ</p>
            </div>
            {activeTab === 'personal' && <ChevronRight className="w-5 h-5 text-blue-600" />}
          </button>
        </div>
      </div>
      
      {/* Section: Admin Settings (Admin Only) */}
      {isAdmin && (
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-purple-900">การตั้งค่าสำหรับผู้ดูแลระบบ</h3>
            <span className="text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full">องค์กร</span>
          </div>
          
          <div className="bg-white rounded-lg border overflow-hidden space-y-1">
            {/* SMTP Settings */}
            <button
              onClick={() => setActiveTab('smtp')}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                activeTab === 'smtp' 
                  ? 'bg-purple-50 border-l-4 border-purple-600' 
                  : 'hover:bg-gray-50 border-l-4 border-transparent'
              }`}
            >
              <Server className={`w-5 h-5 ${activeTab === 'smtp' ? 'text-purple-600' : 'text-gray-400'}`} />
              <div className="flex-1">
                <p className={`font-medium ${activeTab === 'smtp' ? 'text-purple-900' : 'text-gray-700'}`}>
                  ตั้งค่าเซิร์ฟเวอร์อีเมล (SMTP)
                </p>
                <p className="text-sm text-gray-500">กำหนดค่าการเชื่อมต่อ SMTP สำหรับส่งอีเมลแจ้งเตือน</p>
              </div>
              {activeTab === 'smtp' && <ChevronRight className="w-5 h-5 text-purple-600" />}
            </button>
            
            {/* Global Notifications */}
            <button
              onClick={() => setActiveTab('global')}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                activeTab === 'global' 
                  ? 'bg-purple-50 border-l-4 border-purple-600' 
                  : 'hover:bg-gray-50 border-l-4 border-transparent'
              }`}
            >
              <SettingsIcon className={`w-5 h-5 ${activeTab === 'global' ? 'text-purple-600' : 'text-gray-400'}`} />
              <div className="flex-1">
                <p className={`font-medium ${activeTab === 'global' ? 'text-purple-900' : 'text-gray-700'}`}>
                  กฎการแจ้งเตือนระดับองค์กร
                </p>
                <p className="text-sm text-gray-500">สร้างกฎการแจ้งเตือนที่ใช้กับทุกคนในองค์กร</p>
              </div>
              {activeTab === 'global' && <ChevronRight className="w-5 h-5 text-purple-600" />}
            </button>
            
            {/* Notification Recipients */}
            <button
              onClick={() => setActiveTab('recipients')}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                activeTab === 'recipients' 
                  ? 'bg-purple-50 border-l-4 border-purple-600' 
                  : 'hover:bg-gray-50 border-l-4 border-transparent'
              }`}
            >
              <Users className={`w-5 h-5 ${activeTab === 'recipients' ? 'text-purple-600' : 'text-gray-400'}`} />
              <div className="flex-1">
                <p className={`font-medium ${activeTab === 'recipients' ? 'text-purple-900' : 'text-gray-700'}`}>
                  จัดการผู้รับแจ้งเตือน
                </p>
                <p className="text-sm text-gray-500">เพิ่ม/ลบ รายชื่อผู้รับการแจ้งเตือน กำหนดสิทธิ์แต่ละคน</p>
              </div>
              {activeTab === 'recipients' && <ChevronRight className="w-5 h-5 text-purple-600" />}
            </button>
          </div>
        </div>
      )}
      
      {/* Content Area */}
      <div className="bg-white rounded-lg border p-6">
        {/* Personal Notification Settings */}
        {activeTab === 'personal' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b">
              <User className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold">การแจ้งเตือนส่วนบุคคล</h3>
            </div>
            
            {/* Notification Email */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                อีเมลสำหรับรับการแจ้งเตือน
              </h4>
              
              <div className="flex gap-2">
                <input
                  type="email"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSaveNotificationEmail}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  บันทึก
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                คุณสามารถใช้อีเมลอื่นที่ไม่ใช่อีเมลเข้าสู่ระบบสำหรับรับการแจ้งเตือน
              </p>
            </div>
            
            {/* Notification Types */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Bell className="w-4 h-4" />
                เลือกประเภทการแจ้งเตือนที่ต้องการรับ
              </h4>
              
              <div className="space-y-3">
                {userSettings.map((setting) => {
                  const typeInfo = notificationTypes.find(t => t.value === setting.notification_type)
                  return (
                    <div key={setting.id} className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h5 className="font-medium">{typeInfo?.label || setting.notification_type}</h5>
                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                              {typeInfo?.category}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {typeInfo?.description}
                          </p>
                        </div>
                        
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={setting.enabled}
                            onChange={(e) => handleToggleSetting(setting.id, 'enabled', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      
                      {setting.enabled && (
                        <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              ช่องทาง
                            </label>
                            <select
                              value={setting.channel}
                              onChange={(e) => handleToggleSetting(setting.id, 'channel', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                            >
                              <option value="in_app">เฉพาะในแอป</option>
                              <option value="email">เฉพาะอีเมล</option>
                              <option value="both">ทั้งในแอปและอีเมล</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              ความถี่
                            </label>
                            <select
                              value={setting.frequency}
                              onChange={(e) => handleToggleSetting(setting.id, 'frequency', e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                            >
                              <option value="immediate">แจ้งเตือนทันที</option>
                              <option value="daily_digest">สรุปรายวัน</option>
                              <option value="weekly_digest">สรุปรายสัปดาห์</option>
                            </select>
                          </div>
                          
                          {setting.frequency !== 'immediate' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                เวลาส่ง
                              </label>
                              <input
                                type="time"
                                value={setting.digest_time || '08:00'}
                                onChange={(e) => handleToggleSetting(setting.id, 'digest_time', e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
        
        {/* SMTP Settings (Admin Only) */}
        {activeTab === 'smtp' && isAdmin && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b">
              <Server className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="text-lg font-semibold">ตั้งค่าเซิร์ฟเวอร์อีเมล (SMTP)</h3>
                <p className="text-sm text-gray-500">กำหนดค่าการเชื่อมต่อเซิร์ฟเวอร์ส่งอีเมลสำหรับระบบ</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SMTP Host *
                </label>
                <input
                  type="text"
                  value={smtpSettings.host}
                  onChange={(e) => setSmtpSettings({...smtpSettings, host: e.target.value})}
                  placeholder="smtp.gmail.com"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SMTP Port *
                </label>
                <input
                  type="text"
                  value={smtpSettings.port}
                  onChange={(e) => setSmtpSettings({...smtpSettings, port: e.target.value})}
                  placeholder="587"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={smtpSettings.username}
                  onChange={(e) => setSmtpSettings({...smtpSettings, username: e.target.value})}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  value={smtpSettings.password}
                  onChange={(e) => setSmtpSettings({...smtpSettings, password: e.target.value})}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Email *
                </label>
                <input
                  type="email"
                  value={smtpSettings.from_email}
                  onChange={(e) => setSmtpSettings({...smtpSettings, from_email: e.target.value})}
                  placeholder="noreply@yourdomain.com"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Name
                </label>
                <input
                  type="text"
                  value={smtpSettings.from_name}
                  onChange={(e) => setSmtpSettings({...smtpSettings, from_name: e.target.value})}
                  placeholder="Gov Contract Platform"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={smtpSettings.use_tls}
                    onChange={(e) => setSmtpSettings({...smtpSettings, use_tls: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Use TLS</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={smtpSettings.use_ssl}
                    onChange={(e) => setSmtpSettings({...smtpSettings, use_ssl: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Use SSL</span>
                </label>
              </div>
            </div>
            
            {/* Actions */}
            <div className="pt-4 border-t flex flex-wrap gap-2">
              <button
                onClick={handleSaveSMTP}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
              </button>
              
              <button
                onClick={handleTestSMTP}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                ทดสอบการเชื่อมต่อ
              </button>
              
              <div className="flex items-center gap-2 ml-auto">
                <input
                  type="email"
                  value={smtpTestEmail}
                  onChange={(e) => setSmtpTestEmail(e.target.value)}
                  placeholder="อีเมลสำหรับทดสอบ"
                  className="px-3 py-2 border rounded-lg"
                />
                <button
                  onClick={handleSendTestEmail}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  ส่งอีเมลทดสอบ
                </button>
              </div>
            </div>
            
            {smtpStatus === 'success' && (
              <div className="p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                การเชื่อมต่อ SMTP สำเร็จ
              </div>
            )}
            
            {smtpStatus === 'error' && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                การเชื่อมต่อ SMTP ล้มเหลว
              </div>
            )}
          </div>
        )}
        
        {/* Global Notifications (Admin Only) */}
        {activeTab === 'global' && isAdmin && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b">
              <SettingsIcon className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="text-lg font-semibold">กฎการแจ้งเตือนระดับองค์กร</h3>
                <p className="text-sm text-gray-500">สร้างกฎการแจ้งเตือนที่จะส่งให้ทุกคนในองค์กรอัตโนมัติ</p>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">รายการกฎการแจ้งเตือนที่กำหนดไว้</p>
              <button
                onClick={() => setShowGlobalForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                เพิ่มกฎใหม่
              </button>
            </div>
            
            <div className="space-y-3">
              {globalNotifications.map((notif) => (
                <div key={notif.id} className="border rounded-lg p-4 hover:border-purple-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{notif.name}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          notif.is_active 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {notif.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{notif.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span>ประเภท: {notif.notification_type}</span>
                        <span>ช่องทาง: {notif.channel}</span>
                        <span>ความสำคัญ: {notif.priority}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {globalNotifications.length === 0 && (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  <SettingsIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>ยังไม่มีกฎการแจ้งเตือนระดับองค์กร</p>
                  <p className="text-sm">คลิก "เพิ่มกฎใหม่" เพื่อสร้างกฎการแจ้งเตือน</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Notification Recipients (Admin Only) */}
        {activeTab === 'recipients' && isAdmin && (
          <div>
            <div className="flex items-center gap-2 pb-4 border-b mb-6">
              <Users className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="text-lg font-semibold">จัดการผู้รับแจ้งเตือน</h3>
                <p className="text-sm text-gray-500">เพิ่ม ลบ หรือแก้ไขรายชื่อผู้รับการแจ้งเตือนในองค์กร</p>
              </div>
            </div>
            <NotificationRecipients userRole={userRole} />
          </div>
        )}
      </div>
    </div>
  )
}
