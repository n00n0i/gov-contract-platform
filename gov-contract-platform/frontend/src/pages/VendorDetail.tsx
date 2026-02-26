import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { 
  Building2, User, Mail, Phone, MapPin, CreditCard, Globe,
  FileText, AlertTriangle, ChevronLeft, Edit, Trash2, 
  Briefcase, Landmark, CheckCircle, XCircle, Calendar,
  Star, Package, TrendingUp, Ban, Shield
} from 'lucide-react'
import NavigationHeader from '../components/NavigationHeader'
import vendorService from '../services/vendorService'
import type { Vendor } from '../services/vendorService'

export default function VendorDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showBlacklistModal, setShowBlacklistModal] = useState(false)
  const [blacklistReason, setBlacklistReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (id) {
      fetchVendor(id)
    }
  }, [id])

  const fetchVendor = async (vendorId: string) => {
    try {
      setLoading(true)
      const response = await vendorService.getVendor(vendorId)
      if (response.success) {
        setVendor(response.data)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลผู้รับจ้างได้')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    try {
      setActionLoading(true)
      await vendorService.deleteVendor(id)
      setShowDeleteModal(false)
      navigate('/vendors')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'ไม่สามารถลบผู้รับจ้างได้')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBlacklist = async () => {
    if (!id || !blacklistReason.trim()) return
    try {
      setActionLoading(true)
      await vendorService.blacklistVendor(id, blacklistReason)
      setShowBlacklistModal(false)
      setBlacklistReason('')
      fetchVendor(id)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'ไม่สามารถแบล็คลิสต์ผู้รับจ้างได้')
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; color: string; bg: string; icon: any }> = {
      active: { label: 'พร้อมใช้งาน', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
      inactive: { label: 'ไม่ใช้งาน (เลิกกิจการ/ไม่ต่อสัญญา)', color: 'text-gray-600', bg: 'bg-gray-100', icon: XCircle },
      blacklisted: { label: 'แบล็คลิสต์ (ห้ามทำสัญญา)', color: 'text-red-600', bg: 'bg-red-100', icon: Ban },
      suspended: { label: 'ระงับชั่วคราว (สอบสวน/ปรับปรุง)', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: AlertTriangle },
      pending: { label: 'รอตรวจสอบเอกสาร', color: 'text-blue-600', bg: 'bg-blue-100', icon: Calendar }
    }
    return configs[status] || configs.inactive
  }

  const getVendorTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      company: 'นิติบุคคล',
      individual: 'บุคคลธรรมดา',
      partnership: 'ห้างหุ้นส่วน',
      cooperative: 'สหกรณ์',
      state_enterprise: 'รัฐวิสาหกิจ',
      other: 'อื่นๆ'
    }
    return types[type] || type
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !vendor) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationHeader
          title="รายละเอียดผู้รับจ้าง"
          subtitle="Vendor Detail"
          breadcrumbs={[
            { label: 'ผู้รับจ้าง', path: '/vendors' },
            { label: 'ไม่พบข้อมูล' }
          ]}
        />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
            <p className="text-lg">{error || 'ไม่พบข้อมูลผู้รับจ้าง'}</p>
            <button
              onClick={() => navigate('/vendors')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              กลับไปหน้ารายการ
            </button>
          </div>
        </main>
      </div>
    )
  }

  const status = getStatusBadge(vendor.status)
  const StatusIcon = status.icon

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader
        title="รายละเอียดผู้รับจ้าง"
        subtitle="Vendor Detail"
        breadcrumbs={[
          { label: 'ผู้รับจ้าง', path: '/vendors' },
          { label: vendor.name }
        ]}
        actions={(
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/vendors')}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronLeft className="w-5 h-5" />
              กลับ
            </button>
          </div>
        )}
      />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Header Card */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`p-4 rounded-xl ${vendor.is_blacklisted ? 'bg-red-100' : 'bg-blue-100'}`}>
                <Building2 className={`w-8 h-8 ${vendor.is_blacklisted ? 'text-red-600' : 'text-blue-600'}`} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{vendor.name}</h1>
                {vendor.name_en && (
                  <p className="text-gray-500">{vendor.name_en}</p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${status.bg} ${status.color}`}>
                    <StatusIcon className="w-4 h-4" />
                    {status.label}
                  </span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                    {getVendorTypeLabel(vendor.vendor_type)}
                  </span>
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                    เลขผู้เสียภาษี: {vendor.tax_id}
                  </span>
                  {vendor.is_system && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      ข้อมูลตัวอย่าง
                    </span>
                  )}
                </div>
                {vendor.is_blacklisted && vendor.blacklist_reason && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700 text-sm">
                      <Ban className="w-4 h-4 inline mr-1" />
                      เหตุผลแบล็คลิสต์: {vendor.blacklist_reason}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/vendors/${id}/edit`)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Edit className="w-4 h-4" />
                แก้ไข
              </button>
              {vendor.email && !vendor.email_verified && (
                <button
                  onClick={async () => {
                    try {
                      await vendorService.verifyEmail(id!)
                      fetchVendor(id!)
                    } catch (err: any) {
                      setError(err.response?.data?.detail || 'ไม่สามารถยืนยันอีเมลได้')
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <Shield className="w-4 h-4" />
                  ยืนยันอีเมล
                </button>
              )}
              {!vendor.is_blacklisted && (
                <button
                  onClick={() => setShowBlacklistModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
                >
                  <Ban className="w-4 h-4" />
                  แบล็คลิสต์
                </button>
              )}
              {!vendor.is_system && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  <Trash2 className="w-4 h-4" />
                  ลบ
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Information */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                ข้อมูลติดต่อ
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vendor.email && (
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${vendor.email_verified ? 'bg-green-50' : 'bg-amber-50'}`}>
                      <Mail className={`w-5 h-5 ${vendor.email_verified ? 'text-green-600' : 'text-amber-600'}`} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">
                        อีเมล
                        {vendor.email_verified ? (
                          <span className="ml-2 text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            ยืนยันแล้ว
                          </span>
                        ) : (
                          <span className="ml-2 text-xs text-amber-600">ยังไม่ยืนยัน</span>
                        )}
                      </p>
                      <p className="font-medium">{vendor.email}</p>
                    </div>
                  </div>
                )}
                {vendor.phone && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                      <Phone className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">โทรศัพท์</p>
                      <p className="font-medium">{vendor.phone}</p>
                    </div>
                  </div>
                )}
                {vendor.website && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                      <Globe className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">เว็บไซต์</p>
                      <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
                        {vendor.website}
                      </a>
                    </div>
                  </div>
                )}
                {vendor.registration_no && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">เลขทะเบียนนิติบุคคล</p>
                      <p className="font-medium">{vendor.registration_no}</p>
                    </div>
                  </div>
                )}
              </div>

              {vendor.address && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">ที่อยู่</p>
                      <p className="font-medium">{vendor.address}</p>
                      {(vendor.province || vendor.postal_code) && (
                        <p className="text-sm text-gray-600">
                          {vendor.province} {vendor.postal_code}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Contact Person */}
            {(vendor.contact_name || vendor.contact_email || vendor.contact_phone) && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-600" />
                  ผู้ติดต่อ
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vendor.contact_name && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                        <User className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">ชื่อผู้ติดต่อ</p>
                        <p className="font-medium">{vendor.contact_name}</p>
                        {vendor.contact_position && (
                          <p className="text-xs text-gray-500">{vendor.contact_position}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {vendor.contact_email && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                        <Mail className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">อีเมลผู้ติดต่อ</p>
                        <p className="font-medium">{vendor.contact_email}</p>
                      </div>
                    </div>
                  )}
                  {vendor.contact_phone && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                        <Phone className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">โทรศัพท์ผู้ติดต่อ</p>
                        <p className="font-medium">{vendor.contact_phone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bank Information */}
            {(vendor.bank_name || vendor.bank_account_no) && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-orange-600" />
                  ข้อมูลธนาคาร
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vendor.bank_name && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                        <Landmark className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">ธนาคาร</p>
                        <p className="font-medium">{vendor.bank_name}</p>
                        {vendor.bank_branch && (
                          <p className="text-xs text-gray-500">สาขา {vendor.bank_branch}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {vendor.bank_account_no && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">เลขบัญชี</p>
                        <p className="font-medium">{vendor.bank_account_no}</p>
                        {vendor.bank_account_name && (
                          <p className="text-xs text-gray-500">{vendor.bank_account_name}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {vendor.notes && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-600" />
                  หมายเหตุ
                </h2>
                <p className="text-gray-700 whitespace-pre-wrap">{vendor.notes}</p>
              </div>
            )}
          </div>

          {/* Right Column - Stats */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">สถิติ</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-blue-600" />
                    <span className="text-gray-700">จำนวนสัญญา</span>
                  </div>
                  <span className="font-bold text-blue-600">0</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">มูลค่ารวม</span>
                  </div>
                  <span className="font-bold text-green-600">฿0</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Star className="w-5 h-5 text-yellow-600" />
                    <span className="text-gray-700">คะแนนเฉลี่ย</span>
                  </div>
                  <span className="font-bold text-yellow-600">-</span>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">ข้อมูลระบบ</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">สร้างเมื่อ</span>
                  <span className="font-medium">
                    {vendor.created_at 
                      ? new Date(vendor.created_at).toLocaleDateString('th-TH') 
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">อัปเดตล่าสุด</span>
                  <span className="font-medium">
                    {vendor.updated_at 
                      ? new Date(vendor.updated_at).toLocaleDateString('th-TH') 
                      : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="text-xl font-semibold">ยืนยันการลบ</h3>
            </div>
            <p className="text-gray-600 mb-6">
              คุณแน่ใจหรือไม่ที่จะลบผู้รับจ้าง <strong>{vendor.name}</strong>? 
              การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {actionLoading ? 'กำลังลบ...' : 'ยืนยันการลบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blacklist Modal */}
      {showBlacklistModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 text-yellow-600 mb-4">
              <Ban className="w-8 h-8" />
              <h3 className="text-xl font-semibold">แบล็คลิสต์ผู้รับจ้าง</h3>
            </div>
            <p className="text-gray-600 mb-4">
              คุณกำลังจะแบล็คลิสต์ <strong>{vendor.name}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                เหตุผล <span className="text-red-500">*</span>
              </label>
              <textarea
                value={blacklistReason}
                onChange={(e) => setBlacklistReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
                placeholder="ระบุเหตุผลการแบล็คลิสต์..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBlacklistModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleBlacklist}
                disabled={actionLoading || !blacklistReason.trim()}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition disabled:opacity-50"
              >
                {actionLoading ? 'กำลังดำเนินการ...' : 'ยืนยันแบล็คลิสต์'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
