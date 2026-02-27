import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  FileText, Upload, CheckCircle, Eye, 
  Search, Plus, Building2, Calendar, DollarSign, 
  AlertCircle, ChevronRight, ChevronDown, X
} from 'lucide-react'
import NavigationHeader from '../components/NavigationHeader'
import { FileUpload } from '../components/upload/FileUpload'
import axios from 'axios'

interface Contract {
  id: string
  title: string
  contract_number: string
  value: number
  status: string
  start_date: string
  end_date: string
  vendor_name?: string
}

interface DocumentType {
  value: string
  label: string
  icon: typeof FileText
  description: string
  requiresContract: boolean
  color: string
}

const documentTypes: DocumentType[] = [
  { 
    value: 'contract', 
    label: 'สัญญาหลัก', 
    icon: FileText,
    description: 'สัญญาฉบับหลักที่ทำกับผู้รับจ้าง',
    requiresContract: false,
    color: 'blue'
  },
  { 
    value: 'amendment', 
    label: 'สัญญาแก้ไข', 
    icon: FileText,
    description: 'บันทึกข้อตกลงแก้ไขเพิ่มเติม',
    requiresContract: true,
    color: 'purple'
  },
  { 
    value: 'guarantee', 
    label: 'หนังสือค้ำประกัน', 
    icon: FileText,
    description: 'หนังสือค้ำประกันการปฏิบัติงาน',
    requiresContract: true,
    color: 'green'
  },
  { 
    value: 'invoice', 
    label: 'ใบแจ้งหนี้', 
    icon: FileText,
    description: 'ใบแจ้งหนี้/ใบเสนอราคา',
    requiresContract: true,
    color: 'orange'
  },
  { 
    value: 'receipt', 
    label: 'ใบเสร็จ', 
    icon: FileText,
    description: 'ใบเสร็จรับเงิน',
    requiresContract: true,
    color: 'teal'
  },
  { 
    value: 'delivery', 
    label: 'ใบส่งมอบ', 
    icon: FileText,
    description: 'ใบส่งมอบงาน/ใบตรวจรับ',
    requiresContract: true,
    color: 'indigo'
  },
  { 
    value: 'other', 
    label: 'เอกสารอื่นๆ', 
    icon: FileText,
    description: 'เอกสารที่ไม่เข้าหมวดหมู่',
    requiresContract: true,
    color: 'gray'
  },
]

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

export default function DocumentUpload() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedContractId = searchParams.get('contract_id')

  // State
  const [step, setStep] = useState<'select-contract' | 'select-type' | 'upload'>('select-contract')
  const [contracts, setContracts] = useState<Contract[]>([])
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [selectedDocType, setSelectedDocType] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [recentDocuments, setRecentDocuments] = useState<any[]>([])
  const [showContractSelector, setShowContractSelector] = useState(!preselectedContractId)

  // Fetch contracts on mount
  useEffect(() => {
    fetchContracts()
    if (preselectedContractId) {
      fetchContractDetail(preselectedContractId)
    }
  }, [preselectedContractId])

  const fetchContracts = async () => {
    try {
      setLoading(true)
      // TODO: Replace with actual API when contracts endpoint is ready
      // const response = await api.get('/contracts?page_size=100')
      // setContracts(response.data.items)
      
      // Mock data for now
      setContracts([
        {
          id: 'CON-2024-001',
          title: 'สัญญาก่อสร้างอาคารสำนักงาน',
          contract_number: '65/2567',
          value: 5500000,
          status: 'active',
          start_date: '2024-01-15',
          end_date: '2024-12-31',
          vendor_name: 'บริษัท ก่อสร้างไทย จำกัด'
        },
        {
          id: 'CON-2024-002',
          title: 'สัญญาจัดซื้อคอมพิวเตอร์',
          contract_number: '78/2567',
          value: 850000,
          status: 'active',
          start_date: '2024-02-01',
          end_date: '2024-06-30',
          vendor_name: 'บริษัท ไอที โซลูชั่น จำกัด'
        }
      ])
    } catch (error) {
      console.error('Failed to fetch contracts:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchContractDetail = async (id: string) => {
    // TODO: Implement when API ready
    setSelectedContract({
      id: id,
      title: 'สัญญาตัวอย่าง',
      contract_number: 'XX/2567',
      value: 0,
      status: 'active',
      start_date: '',
      end_date: ''
    })
    setStep('select-type')
  }

  const handleSelectContract = (contract: Contract) => {
    setSelectedContract(contract)
    setShowContractSelector(false)
    setStep('select-type')
  }

  const handleSelectDocType = (type: string) => {
    setSelectedDocType(type)
    setStep('upload')
  }

  const handleUploadComplete = async (documentId: string) => {
    // Refresh recent documents
    try {
      const response = await api.get('/documents?page_size=5')
      setRecentDocuments(response.data.items)
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(value)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('th-TH')
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'active': 'bg-green-100 text-green-700',
      'draft': 'bg-gray-100 text-gray-700',
      'expired': 'bg-red-100 text-red-700',
      'terminated': 'bg-orange-100 text-orange-700'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
        {status}
      </span>
    )
  }

  const filteredContracts = contracts.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contract_number.includes(searchQuery) ||
    c.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Check if contract is selected and we can show other doc types
  const hasContract = selectedContract !== null
  const availableDocTypes = documentTypes.filter(dt => 
    dt.value === 'contract' || hasContract
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader
        title="อัปโหลดเอกสาร"
        subtitle="Document Upload & OCR Processing"
        breadcrumbs={[{ label: 'อัปโหลด' }]}
      />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            <div className="flex items-center">
              {/* Step 1 */}
              <div className={`flex items-center ${step === 'select-contract' ? 'text-blue-600' : hasContract ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold
                  ${step === 'select-contract' ? 'bg-blue-100' : hasContract ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {hasContract ? <CheckCircle className="w-5 h-5" /> : '1'}
                </div>
                <span className="ml-2 font-medium">เลือกสัญญา</span>
              </div>
              
              <ChevronRight className="w-5 h-5 mx-4 text-gray-400" />
              
              {/* Step 2 */}
              <div className={`flex items-center ${step === 'select-type' ? 'text-blue-600' : selectedDocType ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold
                  ${step === 'select-type' ? 'bg-blue-100' : selectedDocType ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {selectedDocType ? <CheckCircle className="w-5 h-5" /> : '2'}
                </div>
                <span className="ml-2 font-medium">เลือกประเภท</span>
              </div>
              
              <ChevronRight className="w-5 h-5 mx-4 text-gray-400" />
              
              {/* Step 3 */}
              <div className={`flex items-center ${step === 'upload' ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold
                  ${step === 'upload' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  3
                </div>
                <span className="ml-2 font-medium">อัปโหลด</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Contract Card */}
        {selectedContract && (
          <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-blue-600 font-medium">สัญญาที่เลือก</span>
                  {getStatusBadge(selectedContract.status)}
                </div>
                <h2 className="text-xl font-bold text-gray-900">{selectedContract.title}</h2>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    เลขที่ {selectedContract.contract_number}
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    {formatCurrency(selectedContract.value)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(selectedContract.start_date)} - {formatDate(selectedContract.end_date)}
                  </span>
                  {selectedContract.vendor_name && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      {selectedContract.vendor_name}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedContract(null)
                  setSelectedDocType('')
                  setStep('select-contract')
                  setShowContractSelector(true)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Select Contract */}
        {step === 'select-contract' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">เลือกสัญญา</h2>
              <p className="text-gray-600">เลือกสัญญาหลักที่ต้องการอัปโหลดเอกสาร หรืออัปโหลดสัญญาหลักใหม่</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Option 1: Upload New Contract */}
              <button
                onClick={() => {
                  setSelectedContract(null)
                  setStep('select-type')
                }}
                className="p-8 border-2 border-dashed border-blue-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition text-center group"
              >
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 transition">
                  <Plus className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">สัญญาใหม่</h3>
                <p className="text-sm text-gray-600">อัปโหลดสัญญาหลักฉบับใหม่</p>
                <span className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
                  อัปโหลดสัญญาหลัก
                </span>
              </button>

              {/* Option 2: Select Existing */}
              <button
                onClick={() => setShowContractSelector(true)}
                className="p-8 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-gray-50 transition text-center"
              >
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">สัญญาที่มีอยู่</h3>
                <p className="text-sm text-gray-600">เลือกจากสัญญาที่มีในระบบ</p>
                <span className="inline-block mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg text-sm">
                  เลือกสัญญา
                </span>
              </button>
            </div>

            {/* Contract Selector Modal */}
            {showContractSelector && (
              <div className="border rounded-xl p-6 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">รายการสัญญา</h3>
                  <button
                    onClick={() => setShowContractSelector(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาสัญญา ชื่อโครงการ หรือเลขที่สัญญา..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Contract List */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredContracts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>ไม่พบสัญญา</p>
                    </div>
                  ) : (
                    filteredContracts.map((contract) => (
                      <button
                        key={contract.id}
                        onClick={() => handleSelectContract(contract)}
                        className="w-full text-left p-4 bg-white rounded-lg border hover:border-blue-500 hover:shadow-sm transition"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{contract.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">
                              เลขที่ {contract.contract_number} • {contract.vendor_name}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                              <span>{formatCurrency(contract.value)}</span>
                              <span>{formatDate(contract.start_date)} - {formatDate(contract.end_date)}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Document Type */}
        {step === 'select-type' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">เลือกประเภทเอกสาร</h2>
              <p className="text-gray-600">
                {selectedContract 
                  ? 'เลือกประเภทเอกสารที่ต้องการอัปโหลดสำหรับสัญญานี้'
                  : 'เลือกประเภทเอกสารที่ต้องการอัปโหลด'
                }
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableDocTypes.map((type) => {
                const Icon = type.icon
                const isContract = type.value === 'contract'
                const isDisabled = !isContract && !selectedContract

                return (
                  <button
                    key={type.value}
                    onClick={() => !isDisabled && handleSelectDocType(type.value)}
                    disabled={isDisabled}
                    className={`p-6 rounded-xl border-2 text-left transition relative
                      ${selectedDocType === type.value
                        ? `border-${type.color}-500 bg-${type.color}-50`
                        : isDisabled
                        ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      }`}
                  >
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4
                      ${selectedDocType === type.value 
                        ? `bg-${type.color}-100` 
                        : 'bg-gray-100'}`}>
                      <Icon className={`w-6 h-6 ${selectedDocType === type.value 
                        ? `text-${type.color}-600` 
                        : 'text-gray-600'}`} />
                    </div>
                    
                    <h3 className={`font-semibold mb-1 ${selectedDocType === type.value 
                      ? `text-${type.color}-900` 
                      : 'text-gray-900'}`}>
                      {type.label}
                    </h3>
                    <p className={`text-sm ${selectedDocType === type.value 
                      ? `text-${type.color}-700` 
                      : 'text-gray-600'}`}>
                      {type.description}
                    </p>

                    {isContract && !selectedContract && (
                      <span className="absolute top-4 right-4 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        แนะนำ
                      </span>
                    )}

                    {isDisabled && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 rounded-xl">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <AlertCircle className="w-4 h-4" />
                          ต้องเลือกสัญญาก่อน
                        </span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">คำแนะนำ</p>
                  <p>
                    {selectedContract 
                      ? 'เอกสารทั้งหมดจะถูกผูกกับสัญญาหลักที่เลือก สามารถดูเอกสารทั้งหมดได้จากหน้ารายละเอียดสัญญา'
                      : 'หากยังไม่มีสัญญาในระบบ ให้อัปโหลดสัญญาหลักก่อน จากนั้นจึงสามารถอัปโหลดเอกสารอื่นๆ ที่เกี่ยวข้องได้'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Upload */}
        {step === 'upload' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upload Section */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center gap-3 mb-6">
                  {(() => {
                    const dt = documentTypes.find(t => t.value === selectedDocType)
                    if (!dt) return null
                    const Icon = dt.icon
                    return (
                      <>
                        <div className={`p-3 bg-${dt.color}-100 rounded-lg`}>
                          <Icon className={`w-6 h-6 text-${dt.color}-600`} />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900">อัปโหลด{dt.label}</h2>
                          <p className="text-sm text-gray-500">{dt.description}</p>
                        </div>
                      </>
                    )
                  })()}
                </div>

                <FileUpload
                  documentType={selectedDocType}
                  contractId={selectedContract?.id}
                  onUploadComplete={handleUploadComplete}
                  onRemove={() => {
                    // Go back to step 1 when file is removed
                    setStep('select-contract')
                    setSelectedDocType('')
                    setShowContractSelector(true)
                  }}
                />
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold text-gray-900 mb-4">คำแนะนำ</h3>
                <div className="space-y-4 text-sm text-gray-600">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 font-medium text-xs">1</span>
                    </div>
                    <p>ไฟล์ความละเอียดสูงจะช่วยให้ OCR แม่นยำขึ้น</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 font-medium text-xs">2</span>
                    </div>
                    <p>ระบบจะประมวลผล OCR อัตโนมัติหลังอัปโหลดเสร็จ</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 font-medium text-xs">3</span>
                    </div>
                    <p>ตรวจสอบข้อมูลที่ดึงออกมาและแก้ไขหากจำเป็น</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-6">
                <h4 className="font-medium text-yellow-800 mb-2">รองรับไฟล์:</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• PDF (แนะนำ)</li>
                  <li>• JPG, PNG, TIFF</li>
                  <li>• Word (DOC, DOCX)</li>
                </ul>
                <p className="text-xs text-yellow-600 mt-3">
                  ขนาดสูงสุด 100MB ต่อไฟล์
                </p>
              </div>

              {selectedContract && (
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">เอกสารจะถูกผูกกับ:</span>
                    <br />
                    {selectedContract.title}
                    <br />
                    <span className="text-blue-600">เลขที่ {selectedContract.contract_number}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
