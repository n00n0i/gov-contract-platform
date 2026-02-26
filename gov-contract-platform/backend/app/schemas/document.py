"""
Document Schemas
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class DocumentType(str, Enum):
    CONTRACT = "contract"
    AMENDMENT = "amendment"
    GUARANTEE = "guarantee"
    INVOICE = "invoice"
    RECEIPT = "receipt"
    DELIVERY = "delivery"
    OTHER = "other"


class DocumentStatus(str, Enum):
    UPLOADING = "uploading"
    PROCESSING = "processing"
    OCR_PENDING = "ocr_pending"
    OCR_PROCESSING = "ocr_processing"
    OCR_COMPLETED = "ocr_completed"
    OCR_FAILED = "ocr_failed"
    VERIFIED = "verified"
    REJECTED = "rejected"


class FileType(str, Enum):
    PDF = "pdf"
    IMAGE = "image"
    WORD = "word"
    EXCEL = "excel"


class DocumentBase(BaseModel):
    """Base document schema"""
    filename: str
    document_type: DocumentType = DocumentType.OTHER
    description: Optional[str] = None
    contract_id: Optional[str] = None
    vendor_id: Optional[str] = None
    tags: List[str] = []


class DocumentCreate(DocumentBase):
    pass


class DocumentUploadResponse(BaseModel):
    """Response after upload init"""
    document_id: str
    upload_url: Optional[str] = None  # For direct upload if needed
    upload_fields: Optional[Dict[str, str]] = None  # Form fields for direct upload
    status: str
    message: str


class DocumentResponse(DocumentBase):
    """Document response"""
    id: str
    tenant_id: Optional[str]
    
    # File info
    original_filename: str
    file_size: int
    file_type: FileType
    mime_type: str
    extension: str
    
    # Storage
    storage_path: str
    storage_bucket: str
    download_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    
    # Status
    status: DocumentStatus
    ocr_status: Optional[str] = None
    ocr_confidence: Optional[float] = None
    
    # OCR Results
    extracted_text: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None
    extracted_contract_value: Optional[float] = None
    extracted_contract_number: Optional[str] = None
    extracted_start_date: Optional[datetime] = None
    extracted_end_date: Optional[datetime] = None
    extracted_parties: Optional[List[Dict[str, str]]] = None
    
    # Metadata
    page_count: Optional[int] = None
    language: Optional[str] = None
    
    # Audit
    uploaded_by: str
    uploaded_at: datetime
    processed_at: Optional[datetime] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    """Document list response"""
    items: List[DocumentResponse]
    total: int
    page: int
    page_size: int


class DocumentUpdate(BaseModel):
    """Update document metadata"""
    document_type: Optional[DocumentType] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    contract_id: Optional[str] = None
    vendor_id: Optional[str] = None


class OCRResult(BaseModel):
    """OCR processing result"""
    success: bool
    text: Optional[str] = None
    confidence: Optional[float] = None
    pages: Optional[int] = None
    language: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


class DocumentVerifyRequest(BaseModel):
    """Verify extracted document data"""
    extracted_data: Dict[str, Any]
    corrections: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class UploadProgress(BaseModel):
    """Upload progress"""
    document_id: str
    status: DocumentStatus
    progress_percent: int
    message: Optional[str] = None
    ocr_progress: Optional[int] = None
    ocr_status: Optional[str] = None
