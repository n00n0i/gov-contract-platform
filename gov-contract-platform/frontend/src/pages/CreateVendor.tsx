import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { 
  Save, X, Building2, User, Mail, Phone, MapPin, 
  CreditCard, Globe, FileText, AlertTriangle, ChevronLeft,
  Briefcase, Landmark, CheckCircle, Shield
} from 'lucide-react'
import NavigationHeader from '../components/NavigationHeader'
import vendorService from '../services/vendorService'
import type { Vendor } from '../services/vendorService'

export default function CreateVendor() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState<Partial<Vendor>>({
    name: '',
    name_en: '',
    tax_id: '',
    vendor_type: 'company',
    status: 'active',
    email: '',
    phone: '',
    address: '',
    province: '',
    district: '',
    postal_code: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    contact_position: '',
    website: '',
    registration_no: '',
    bank_name: '',
    bank_account_no: '',
    bank_account_name: '',
    bank_branch: '',
    notes: ''
  })

  useEffect(() => {
    if (isEdit && id) {
      fetchVendor(id)
    }
  }, [isEdit, id])

  const fetchVendor = async (vendorId: string) => {
    try {
      setLoading(true)
      const response = await vendorService.getVendor(vendorId)
      if (response.success) {
        setFormData(response.data)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลผู้รับจ้างได้')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof Vendor, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const validateForm = (): boolean => {
    if (!formData.name?.trim()) {
      setError('กรุณากรอกชื่อผู้รับจ้าง')
      return false
    }
    if (!formData.tax_id?.trim()) {
      setError('กรุณากรอกเลขประจำตัวผู้เสียภาษี')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setSaving(true)
    setError('')

    try {
      if (isEdit && id) {
        await vendorService.updateVendor(id, formData)
      } else {
        await vendorService.createVendor(formData)
      }
      navigate('/vendors')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'ไม่สามารถบันทึกข้อมูลได้')
    } finally {
      setSaving(false)
    }
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
        title={isEdit ? 'แก้ไขผู้รับจ้าง' : 'เพิ่มผู้รับจ้าง'}
        subtitle={isEdit ? 'Edit Vendor' : 'Create Vendor'}
        breadcrumbs={[
          { label: 'ผู้รับจ้าง', path: '/vendors' },
          { label: isEdit ? 'แก้ไข' : 'เพิ่มใหม่' }
        ]}
        actions={(
          <button
            onClick={() => navigate('/vendors')}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronLeft className="w-5 h-5" />
            กลับ
          </button>
        )}
      />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="w-6 h-6 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">ข้อมูลพื้นฐาน</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อผู้รับจ้าง (TH) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="เช่น บริษัท ก่อสร้างไทย จำกัด"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อผู้รับจ้าง (EN)
                </label>
                <input
                  type="text"
                  value={formData.name_en || ''}
                  onChange={(e) => handleChange('name_en', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Thai Construction Co., Ltd."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  เลขประจำตัวผู้เสียภาษี <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.tax_id}
                  onChange={(e) => handleChange('tax_id', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0105551001234"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ประเภทผู้รับจ้าง
                </label>
                <select
                  value={formData.vendor_type}
                  onChange={(e) => handleChange('vendor_type', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="company">นิติบุคคล</option>
                  <option value="individual">บุคคลธรรมดา</option>
                  <option value="partnership">ห้างหุ้นส่วน</option>
                  <option value="cooperative">สหกรณ์</option>
                  <option value="state_enterprise">รัฐวิสาหกิจ</option>
                  <option value="other">อื่นๆ</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  สถานะ
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="active">พร้อมใช้งาน</option>
                  <option value="inactive">ไม่ใช้งาน (เลิกกิจการ/ไม่ต่อสัญญา)</option>
                  <option value="pending">รอตรวจสอบเอกสาร</option>
                  <option value="suspended">ระงับชั่วคราว (สอบสวน/ปรับปรุง)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  เลขทะเบียนนิติบุคคล
                </label>
                <input
                  type="text"
                  value={formData.registration_no || ''}
                  onChange={(e) => handleChange('registration_no', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  เว็บไซต์
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="url"
                    value={formData.website || ''}
                    onChange={(e) => handleChange('website', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://example.com"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-6">
              <Mail className="w-6 h-6 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">ข้อมูลติดต่อ</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  อีเมล
                  {isEdit && formData.email_verified && (
                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                      <CheckCircle className="w-3 h-3" />
                      ยืนยันแล้ว
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        formData.email_verified ? 'border-green-500 bg-green-50' : ''
                      }`}
                      placeholder="email@example.com"
                    />
                  </div>
                  {isEdit && !formData.email_verified && formData.email && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await vendorService.verifyEmail(id!)
                          setFormData(prev => ({ ...prev, email_verified: true }))
                        } catch (err: any) {
                          setError(err.response?.data?.detail || 'ไม่สามารถยืนยันอีเมลได้')
                        }
                      }}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm whitespace-nowrap"
                    >
                      <Shield className="w-4 h-4 inline mr-1" />
                      ยืนยัน
                    </button>
                  )}
                </div>
                {isEdit && !formData.email_verified && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ อีเมลยังไม่ได้รับการยืนยัน
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  โทรศัพท์
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="02-123-4567"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ที่อยู่
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <textarea
                    value={formData.address || ''}
                    onChange={(e) => handleChange('address', e.target.value)}
                    rows={3}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  จังหวัด
                </label>
                <input
                  type="text"
                  value={formData.province || ''}
                  onChange={(e) => handleChange('province', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="กรุงเทพมหานคร"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  รหัสไปรษณีย์
                </label>
                <input
                  type="text"
                  value={formData.postal_code || ''}
                  onChange={(e) => handleChange('postal_code', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="10110"
                />
              </div>
            </div>
          </div>

          {/* Contact Person */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">ผู้ติดต่อ</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อผู้ติดต่อ
                </label>
                <input
                  type="text"
                  value={formData.contact_name || ''}
                  onChange={(e) => handleChange('contact_name', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="สมชาย ใจดี"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ตำแหน่ง
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.contact_position || ''}
                    onChange={(e) => handleChange('contact_position', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="ผู้จัดการฝ่ายขาย"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  อีเมลผู้ติดต่อ
                </label>
                <input
                  type="email"
                  value={formData.contact_email || ''}
                  onChange={(e) => handleChange('contact_email', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="contact@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  โทรศัพท์ผู้ติดต่อ
                </label>
                <input
                  type="tel"
                  value={formData.contact_phone || ''}
                  onChange={(e) => handleChange('contact_phone', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="081-234-5678"
                />
              </div>
            </div>
          </div>

          {/* Bank Information */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-6">
              <Landmark className="w-6 h-6 text-orange-600" />
              <h2 className="text-lg font-semibold text-gray-900">ข้อมูลธนาคาร</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อธนาคาร
                </label>
                <input
                  type="text"
                  value={formData.bank_name || ''}
                  onChange={(e) => handleChange('bank_name', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="ธนาคารกรุงเทพ"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  สาขา
                </label>
                <input
                  type="text"
                  value={formData.bank_branch || ''}
                  onChange={(e) => handleChange('bank_branch', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="สาขาสีลม"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  เลขบัญชี
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.bank_account_no || ''}
                    onChange={(e) => handleChange('bank_account_no', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="123-4-56789-0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อบัญชี
                </label>
                <input
                  type="text"
                  value={formData.bank_account_name || ''}
                  onChange={(e) => handleChange('bank_account_name', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="บริษัท ก่อสร้างไทย จำกัด"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-6">
              <FileText className="w-6 h-6 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">หมายเหตุ</h2>
            </div>

            <textarea
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="บันทึกเพิ่มเติมเกี่ยวกับผู้รับจ้าง..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/vendors')}
              className="flex items-center gap-2 px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {saving ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'สร้างผู้รับจ้าง'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
