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
    tags: Optional[List[str]] = None  # Fixed validation error


class DocumentCreate(DocumentBase):
    is_draft: bool = True
    is_main_document: bool = False


class DocumentUpdate(BaseModel):
    """Update document schema"""
    document_type: Optional[DocumentType] = None
    description: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None


class OCRResult(BaseModel):
    """OCR result schema"""
    success: bool
    text: Optional[str] = None
    confidence: Optional[float] = None
    error: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None
    pages: Optional[int] = None
    language: Optional[str] = None
    ocr_engine: Optional[str] = None


class DocumentVerifyRequest(BaseModel):
    """Document verification request"""
    verified_data: Dict[str, Any]
    notes: Optional[str] = None


class DocumentResponse(DocumentBase):
    """Document response schema"""
    id: str
    status: DocumentStatus
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    mime_type: Optional[str] = None
    storage_path: Optional[str] = None
    storage_bucket: Optional[str] = None
    download_url: Optional[str] = None
    ocr_status: Optional[str] = None
    ocr_confidence: Optional[float] = None
    ocr_engine: Optional[str] = None
    extracted_text: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None
    page_count: Optional[int] = None
    language: Optional[str] = None
    uploaded_by: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    is_draft: Optional[bool] = True
    is_main_document: Optional[bool] = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    """Document list response"""
    items: List[DocumentResponse]
    total: int
    page: int
    pages: int


class ExtractedDocumentData(BaseModel):
    """Schema for extracted/edited document data"""
    contract_number: Optional[str] = Field(None, description="เลขที่สัญญา เช่น CN-2025-001")
    counterparty: Optional[str] = Field(None, description="คู่สัญญา/ชื่อบริษัท/หน่วยงาน")
    contract_type: Optional[str] = Field(None, description="ประเภทสัญญา เช่น จ้างเหมา, ซื้อขาย")
    contract_value: Optional[float] = Field(None, description="มูลค่าสัญญา (บาท)")
    project_name: Optional[str] = Field(None, description="ชื่อโครงการ")
    start_date: Optional[str] = Field(None, description="วันที่เริ่มต้น (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="วันที่สิ้นสุด (YYYY-MM-DD)")
    duration_months: Optional[int] = Field(None, description="ระยะเวลา (เดือน)")


class DocumentExtractedDataUpdate(BaseModel):
    """Request schema for updating extracted document data"""
    contract_number: Optional[str] = None
    counterparty: Optional[str] = None
    contract_type: Optional[str] = None
    contract_value: Optional[float] = None
    project_name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    duration_months: Optional[int] = None


class UploadProgress(BaseModel):
    """Upload progress"""
    document_id: str
    status: DocumentStatus
    progress_percent: int
    message: Optional[str] = None
    ocr_progress: Optional[int] = None
    ocr_status: Optional[str] = None
