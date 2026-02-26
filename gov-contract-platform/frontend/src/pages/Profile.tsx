import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  User, Mail, Phone, Building2, 
  Calendar, Shield, Edit2, Save, X, Camera,
  FileText, CheckCircle, Award
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

export default function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    title: ''
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me')
      setUser(response.data)
      setFormData({
        first_name: response.data.first_name || '',
        last_name: response.data.last_name || '',
        phone: response.data.phone || '',
        title: response.data.title || ''
      })
    } catch (err) {
      console.error('Failed to fetch user:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await api.put('/auth/me', formData)
      setUser({ ...user, ...formData })
      setEditing(false)
      setMessage({ type: 'success', text: 'บันทึกข้อมูลสำเร็จ' })
    } catch (err) {
      setMessage({ type: 'error', text: 'ไม่สามารถบันทึกข้อมูลได้' })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
      title: user?.title || ''
    })
    setEditing(false)
    setMessage(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader
        title="โปรไฟล์ของฉัน"
        subtitle="My Profile"
        breadcrumbs={[{ label: 'โปรไฟล์' }]}
        actions={
          !editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Edit2 className="w-4 h-4" />
              แก้ไข
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                <X className="w-4 h-4" />
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          )
        }
      />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <X className="w-5 h-5" />}
              {message.text}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border p-6 text-center">
              <div className="relative inline-block">
                <div className="w-32 h-32 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-16 h-16 text-blue-600" />
                </div>
                <button className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition">
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {user?.first_name} {user?.last_name}
              </h2>
              <p className="text-gray-500">{user?.title || 'ไม่มีตำแหน่ง'}</p>
              <p className="text-sm text-gray-400 mt-1">@{user?.username}</p>
              
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                  <Shield className="w-4 h-4 text-green-500" />
                  <span>สถานะ: {user?.status === 'active' ? 'ใช้งาน' : user?.status}</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  สมัครสมาชิก: {new Date(user?.created_at).toLocaleDateString('th-TH')}
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl shadow-sm border p-6 mt-6">
              <h3 className="font-semibold text-gray-900 mb-4">สถิติ</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm">สัญญาที่รับผิดชอบ</span>
                  </div>
                  <span className="font-medium">12</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">อนุมัติแล้ว</span>
                  </div>
                  <span className="font-medium">8</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Award className="w-4 h-4" />
                    <span className="text-sm">บทบาท</span>
                  </div>
                  <span className="text-sm">{user?.roles?.length > 0 ? user.roles.join(', ') : 'ผู้ใช้ทั่วไป'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Details Form */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-semibold text-gray-900 mb-6">ข้อมูลส่วนตัว</h3>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ชื่อ
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        value={formData.first_name}
                        onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                        <User className="w-4 h-4 text-gray-400" />
                        <span>{user?.first_name || '-'}</span>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      นามสกุล
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        value={formData.last_name}
                        onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                        <User className="w-4 h-4 text-gray-400" />
                        <span>{user?.last_name || '-'}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ตำแหน่ง
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="เช่น นักวิชาการ, เจ้าหน้าที่"
                    />
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span>{user?.title || '-'}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    อีเมล
                  </label>
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span>{user?.email}</span>
                    <span className="ml-auto text-xs text-gray-400">ไม่สามารถแก้ไขได้</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    เบอร์โทรศัพท์
                  </label>
                  {editing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0xx-xxx-xxxx"
                    />
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{user?.phone || '-'}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    แผนก/กอง
                  </label>
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span>{user?.department_name || 'ไม่ระบุแผนก'}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    เข้าสู่ระบบล่าสุด
                  </label>
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>{user?.last_login_at ? new Date(user.last_login_at).toLocaleString('th-TH') : 'ไม่มีข้อมูล'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
