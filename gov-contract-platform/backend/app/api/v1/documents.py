"""
Document API Routes

All document uploads are automatically processed with OCR using centralized settings
from Settings > OCR (OCRSettingsService).
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
import io

from app.db.database import get_db
from app.schemas.document import (
    DocumentCreate, DocumentUpdate, DocumentResponse, 
    DocumentListResponse, OCRResult, DocumentVerifyRequest,
    DocumentStatus, UploadProgress
)
from app.services.document.document_service import DocumentService
from app.services.document.ocr_settings_service import get_ocr_settings_service
from app.services.agent.trigger_service import on_document_upload
from app.core.security import get_current_user_id, get_current_user_payload
from app.core.logging import get_logger

router = APIRouter(prefix="/documents", tags=["Documents"])
logger = get_logger(__name__)


def get_doc_service(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
) -> DocumentService:
    """Dependency to get document service"""
    return DocumentService(
        db=db,
        user_id=user_payload.get("sub"),
        tenant_id=user_payload.get("tenant_id")
    )


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form("other"),
    description: Optional[str] = Form(None),
    contract_id: Optional[str] = Form(None),
    vendor_id: Optional[str] = Form(None),
    doc_service: DocumentService = Depends(get_doc_service),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Upload a document file
    
    Supported formats: PDF, JPG, PNG, TIFF, DOC, DOCX
    
    After upload, the document will be queued for OCR processing automatically
    using the centralized OCR Settings (Settings > OCR).
    
    The OCR mode (Tesseract/Typhoon/Custom) is determined by the user's OCR settings.
    """
    # Validate file type
    allowed_types = [
        "application/pdf",
        "image/jpeg", "image/png", "image/tiff",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]
    
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.content_type}. Allowed: PDF, JPG, PNG, TIFF, DOC, DOCX"
        )
    
    # Validate file size (100MB max)
    MAX_SIZE = 100 * 1024 * 1024
    file_content = await file.read()
    if len(file_content) > MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 100MB"
        )
    
    # Create document data
    doc_data = DocumentCreate(
        filename=file.filename,
        document_type=document_type,
        description=description,
        contract_id=contract_id,
        vendor_id=vendor_id
    )
    
    # Upload
    document = doc_service.upload_document(
        file=io.BytesIO(file_content),
        filename=file.filename,
        content_type=file.content_type,
        document_data=doc_data
    )
    
    # Trigger AI agents for document analysis
    try:
        import asyncio
        asyncio.create_task(on_document_upload(
            document_id=str(document.id),
            file_name=file.filename,
            file_type=file.content_type,
            file_size=len(file_content),
            user_id=doc_service.user_id,
            document_type=document_type
        ))
    except Exception as e:
        logger.error(f"Failed to trigger document analysis: {e}")
    
    return document


@router.get("/", response_model=DocumentListResponse)
def list_documents(
    contract_id: Optional[str] = Query(None),
    document_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search in extracted OCR text"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    doc_service: DocumentService = Depends(get_doc_service),
    db: Session = Depends(get_db)
):
    """
    List documents with filters
    
    If search parameter is provided, searches in:
    - Extracted OCR text (full-text search)
    - Original filename
    - Document description
    """
    from app.models.contract import ContractAttachment
    from sqlalchemy import or_
    
    query = db.query(ContractAttachment).filter(ContractAttachment.is_deleted == 0)
    
    # Apply filters
    if contract_id:
        query = query.filter(ContractAttachment.contract_id == contract_id)
    if document_type:
        query = query.filter(ContractAttachment.document_type == document_type)
    if status:
        query = query.filter(ContractAttachment.status == status)
    
    # Search in OCR text and metadata
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                ContractAttachment.extracted_text.ilike(search_term),
                ContractAttachment.original_filename.ilike(search_term),
                ContractAttachment.description.ilike(search_term),
                ContractAttachment.extracted_contract_number.ilike(search_term)
            )
        )
    
    # Count total
    total = query.count()
    
    # Pagination
    documents = query.order_by(ContractAttachment.uploaded_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    # Generate download URLs for each document
    storage = doc_service.storage
    for doc in documents:
        try:
            doc.download_url = storage.get_presigned_url(doc.storage_path, expires=3600)
        except Exception as e:
            logger.error(f"Failed to generate URL for {doc.id}: {e}")
            doc.download_url = None
    
    return {
        "items": documents,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    }


@router.get("/search/content", response_model=dict)
def search_document_content(
    q: str = Query(..., description="Search query for OCR text"),
    contract_id: Optional[str] = Query(None),
    highlight: bool = Query(True, description="Highlight matching text"),
    db: Session = Depends(get_db),
    doc_service: DocumentService = Depends(get_doc_service)
):
    """
    Advanced search in document OCR content
    
    Returns documents with matching OCR text and download links to MinIO files.
    
    Example:
        GET /documents/search/content?q=สัญญาก่อสร้าง&highlight=true
    
    Response includes:
    - document_id: ID of the document
    - filename: Original filename
    - download_url: Presigned URL to download from MinIO
    - storage_path: Path in MinIO storage
    - matching_text: Snippet of matching OCR text (if highlight=true)
    - ocr_confidence: OCR accuracy score
    """
    from app.models.contract import ContractAttachment
    from sqlalchemy import func
    
    if not q or len(q.strip()) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query must be at least 2 characters"
        )
    
    search_term = f"%{q}%"
    
    query = db.query(ContractAttachment).filter(
        ContractAttachment.is_deleted == 0,
        ContractAttachment.ocr_status == "completed",
        or_(
            ContractAttachment.extracted_text.ilike(search_term),
            ContractAttachment.original_filename.ilike(search_term),
            ContractAttachment.extracted_contract_number.ilike(search_term)
        )
    )
    
    if contract_id:
        query = query.filter(ContractAttachment.contract_id == contract_id)
    
    documents = query.order_by(
        ContractAttachment.ocr_confidence.desc()
    ).limit(50).all()
    
    results = []
    for doc in documents:
        # Generate presigned URL for MinIO download
        try:
            download_url = doc_service.storage.get_presigned_url(
                doc.storage_path, 
                expires=3600
            )
        except Exception as e:
            logger.error(f"Failed to generate URL for {doc.id}: {e}")
            download_url = None
        
        # Find matching text snippet
        matching_snippet = None
        if highlight and doc.extracted_text:
            import re
            # Find the search term in text (case insensitive)
            pattern = re.compile(re.escape(q), re.IGNORECASE)
            match = pattern.search(doc.extracted_text)
            if match:
                start = max(0, match.start() - 50)
                end = min(len(doc.extracted_text), match.end() + 50)
                matching_snippet = "..." + doc.extracted_text[start:end] + "..."
        
        results.append({
            "document_id": doc.id,
            "filename": doc.original_filename,
            "document_type": doc.document_type,
            "download_url": download_url,
            "storage_path": doc.storage_path,
            "storage_bucket": doc.storage_bucket,
            "matching_snippet": matching_snippet,
            "ocr_confidence": float(doc.ocr_confidence) if doc.ocr_confidence else None,
            "extracted_contract_number": doc.extracted_contract_number,
            "page_count": doc.page_count,
            "uploaded_at": doc.uploaded_at
        })
    
    return {
        "success": True,
        "query": q,
        "total_results": len(results),
        "results": results
    }


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: str,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """
    Get document details with download URL
    """
    return doc_service.get_document(document_id)


@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """
    Download document file
    """
    document = doc_service.get_document(document_id)
    
    from app.services.storage.minio_service import get_storage_service
    storage = get_storage_service()
    
    try:
        file_data = storage.download_file(document.storage_path)
        
        return StreamingResponse(
            io.BytesIO(file_data),
            media_type=document.mime_type,
            headers={
                "Content-Disposition": f'attachment; filename="{document.original_filename}"'
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Download failed: {str(e)}"
        )


@router.put("/{document_id}", response_model=DocumentResponse)
def update_document(
    document_id: str,
    update_data: DocumentUpdate,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """
    Update document metadata
    """
    return doc_service.update_document(document_id, update_data)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """
    Delete document (soft delete)
    """
    doc_service.delete_document(document_id)
    return {"message": "Document deleted successfully"}


@router.post("/{document_id}/verify", response_model=DocumentResponse)
def verify_document(
    document_id: str,
    verify_data: DocumentVerifyRequest,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """
    Verify document with extracted data corrections
    """
    return doc_service.verify_document(
        document_id,
        verify_data.extracted_data
    )


@router.post("/{document_id}/reprocess")
def reprocess_ocr(
    document_id: str,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """
    Re-trigger OCR processing for document using centralized OCR Settings
    
    The document will be re-processed with the current OCR settings from Settings > OCR.
    """
    from app.tasks.document import process_document_ocr
    
    process_document_ocr.delay(document_id, doc_service.tenant_id)
    
    return {
        "message": "OCR processing queued with centralized settings",
        "document_id": document_id
    }


@router.get("/settings/ocr-status")
def get_document_ocr_settings(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get current OCR settings status for document processing
    
    Returns the OCR configuration that will be used when processing uploaded documents.
    """
    ocr_settings_service = get_ocr_settings_service(db, user_id)
    settings = ocr_settings_service.get_settings()
    validation = ocr_settings_service.validate_settings()
    
    return {
        "success": True,
        "data": {
            "mode": settings.get("mode", "default"),
            "engine": settings.get("engine", "tesseract"),
            "language": settings.get("language", "tha+eng"),
            "dpi": settings.get("dpi", 300),
            "auto_rotate": settings.get("auto_rotate", True),
            "deskew": settings.get("deskew", True),
            "is_typhoon_configured": ocr_settings_service.is_typhoon_configured(),
            "is_custom_api_configured": ocr_settings_service.is_custom_api_configured(),
            "validation": validation
        }
    }


@router.get("/{document_id}/ocr-result")
def get_ocr_result(
    document_id: str,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """
    Get OCR processing result
    """
    document = doc_service.get_document(document_id)
    
    return {
        "document_id": document_id,
        "ocr_status": document.ocr_status,
        "confidence": document.ocr_confidence,
        "extracted_text": document.extracted_text,
        "extracted_data": {
            "contract_number": document.extracted_contract_number,
            "contract_value": document.extracted_contract_value,
            "start_date": document.extracted_start_date,
            "end_date": document.extracted_end_date,
            "parties": document.extracted_parties
        },
        "processed_at": document.processed_at
    }
