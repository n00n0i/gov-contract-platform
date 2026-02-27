import { useState, useCallback } from 'react'
import { Upload, File, X, Loader2, CheckCircle, AlertCircle, FileText, Image, FileSpreadsheet } from 'lucide-react'
import axios from 'axios'

interface UploadFile {
  id: string
  file: File
  name: string
  size: number
  progress: number
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  documentId?: string
  extractedData?: any
  error?: string
}

interface FileUploadProps {
  onUploadComplete?: (documentId: string, extractedData?: any) => void
  onRemove?: () => void
  documentType?: string
  contractId?: string
  vendorId?: string
}

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
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

export function FileUpload({ onUploadComplete, onRemove, documentType = 'other', contractId, vendorId }: FileUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [showExtractedData, setShowExtractedData] = useState<string | null>(null)

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />
    if (type.includes('image')) return <Image className="w-8 h-8 text-blue-500" />
    if (type.includes('word')) return <FileText className="w-8 h-8 text-blue-700" />
    if (type.includes('excel') || type.includes('sheet')) return <FileSpreadsheet className="w-8 h-8 text-green-600" />
    return <File className="w-8 h-8 text-gray-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'ไฟล์ไม่รองรับ รองรับเฉพาะ PDF, JPG, PNG, TIFF, DOC, DOCX'
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'ไฟล์ใหญ่เกินไป (สูงสุด 100MB)'
    }
    return null
  }

  const addFiles = useCallback((newFiles: FileList) => {
    const uploadFiles: UploadFile[] = []
    
    Array.from(newFiles).forEach((file) => {
      const error = validateFile(file)
      uploadFiles.push({
        id: Math.random().toString(36).substring(7),
        file,
        name: file.name,
        size: file.size,
        progress: 0,
        status: error ? 'error' : 'pending',
        error: error || undefined
      })
    })
    
    setFiles((prev) => [...prev, ...uploadFiles])
    
    // Auto upload valid files
    uploadFiles.filter(f => f.status === 'pending').forEach(uploadFile)
  }, [])

  const uploadFile = async (uploadFile: UploadFile) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadFile.id ? { ...f, status: 'uploading' } : f
      )
    )

    try {
      const formData = new FormData()
      formData.append('file', uploadFile.file)
      formData.append('document_type', documentType)
      if (contractId) formData.append('contract_id', contractId)
      if (vendorId) formData.append('vendor_id', vendorId)

      const response = await api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          )
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id ? { ...f, progress } : f
            )
          )
        }
      })

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: 'processing', documentId: response.data.id }
            : f
        )
      )

      // Start polling for OCR status
      pollOcrStatus(uploadFile.id, response.data.id)

    } catch (error: any) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: 'error', error: error.response?.data?.detail || 'Upload failed' }
            : f
        )
      )
    }
  }

  const pollOcrStatus = async (fileId: string, documentId: string) => {
    const maxAttempts = 60 // 3 minutes max
    let attempts = 0

    const checkStatus = async () => {
      try {
        attempts++
        if (attempts > maxAttempts) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId ? { ...f, status: 'completed' } : f
            )
          )
          return
        }

        const response = await api.get(`/documents/${documentId}/ocr-result`)
        const { ocr_status, extracted_data } = response.data

        if (ocr_status === 'completed') {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId 
                ? { ...f, status: 'completed', extractedData: extracted_data } 
                : f
            )
          )
          onUploadComplete?.(documentId, extracted_data)
        } else if (ocr_status === 'failed') {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId 
                ? { ...f, status: 'error', error: 'OCR processing failed' } 
                : f
            )
          )
        } else {
          // Still processing, check again in 3 seconds
          setTimeout(checkStatus, 3000)
        }
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: 'error', error: 'Failed to check status' } : f
          )
        )
      }
    }

    // Start checking after 2 seconds
    setTimeout(checkStatus, 2000)
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
    // Call onRemove callback to go back to step 1
    if (onRemove) {
      onRemove()
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const formatExtractedData = (data: any) => {
    if (!data) return null
    
    const items = []
    if (data.contract_number) items.push({ label: 'เลขที่สัญญา', value: data.contract_number })
    if (data.contract_value) items.push({ label: 'มูลค่าสัญญา', value: `฿${data.contract_value.toLocaleString()}` })
    if (data.start_date) items.push({ label: 'วันเริ่มสัญญา', value: data.start_date })
    if (data.end_date) items.push({ label: 'วันสิ้นสุด', value: data.end_date })
    if (data.project_name) items.push({ label: 'ชื่อโครงการ', value: data.project_name })
    
    return items
  }

  return (
    <div className="w-full">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
          ${isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          }`}
      >
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.tiff,.doc,.docx"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer block">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
          </p>
          <p className="text-sm text-gray-500">
            รองรับ PDF, JPG, PNG, TIFF, DOC, DOCX (สูงสุด 100MB)
          </p>
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6 space-y-3">
          {files.map((file) => (
            <div
              key={file.id}
              className={`flex flex-col p-4 bg-white border rounded-lg shadow-sm transition
                ${file.status === 'error' ? 'border-red-300 bg-red-50' : ''}
                ${file.status === 'completed' ? 'border-green-300 bg-green-50' : ''}
              `}
            >
              <div className="flex items-center gap-4">
                {getFileIcon(file.file.type)}
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                  
                  {/* Progress Bar */}
                  {file.status === 'uploading' && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>กำลังอัปโหลด...</span>
                        <span>{file.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {file.status === 'processing' && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังประมวลผล OCR...</span>
                    </div>
                  )}
                  
                  {file.status === 'completed' && (
                    <div className="mt-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600">อัปโหลดและประมวลผลเสร็จสิ้น</span>
                    </div>
                  )}
                  
                  {file.status === 'error' && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>{file.error}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {file.extractedData && (
                    <button
                      onClick={() => setShowExtractedData(
                        showExtractedData === file.id ? null : file.id
                      )}
                      className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-100 rounded-lg transition"
                    >
                      {showExtractedData === file.id ? 'ซ่อนข้อมูล' : 'ดูข้อมูล'}
                    </button>
                  )}
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-2 hover:bg-gray-100 rounded-full transition"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Extracted Data */}
              {showExtractedData === file.id && file.extractedData && (
                <div className="mt-4 p-4 bg-white rounded-lg border border-green-200">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    ข้อมูลที่ดึงออกจากเอกสาร
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {formatExtractedData(file.extractedData)?.map((item, idx) => (
                      <div key={idx} className="p-2 bg-gray-50 rounded">
                        <p className="text-xs text-gray-500">{item.label}</p>
                        <p className="font-medium text-gray-900">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
