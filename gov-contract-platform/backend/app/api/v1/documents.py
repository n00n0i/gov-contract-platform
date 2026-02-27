"""
Document API Routes

All document uploads are automatically processed with OCR using centralized settings
from Settings > OCR (OCRSettingsService).
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
import io

from app.db.database import get_db
from app.schemas.document import (
    DocumentCreate, DocumentUpdate, DocumentResponse, 
    DocumentListResponse, OCRResult, DocumentVerifyRequest,
    DocumentStatus, UploadProgress, DocumentExtractedDataUpdate
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
    Upload document with automatic OCR processing
    
    The document will be:
    1. Uploaded to MinIO storage
    2. Saved to database with OCR status "pending"
    3. Queued for OCR processing (using centralized OCR settings)
    4. Processed asynchronously by Celery worker
    
    OCR settings are controlled from Settings > OCR menu (OCRSettingsService)
    """
    try:
        # Read file content
        content = await file.read()
        file_obj = io.BytesIO(content)
        
        # Create document data
        document_data = DocumentCreate(
            filename=file.filename,
            document_type=document_type,
            description=description,
            contract_id=contract_id,
            vendor_id=vendor_id
        )
        
        # Upload document
        document = doc_service.upload_document(
            file=file_obj,
            filename=file.filename,
            content_type=file.content_type,
            document_data=document_data
        )
        
        # Trigger agent workflows
        try:
            await on_document_upload(
                document_id=document.id,
                file_name=file.filename,
                file_type=document.file_type or file.content_type or 'unknown',
                file_size=document.file_size or 0,
                user_id=user_id,
                db=db
            )
        except Exception as e:
            logger.error(f"Agent trigger failed: {e}")
        
        return document
        
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )


@router.get("/search/content")
async def search_documents_content(
    q: str = Query(..., description="Search query"),
    highlight: bool = Query(True, description="Highlight matching text"),
    limit: int = Query(10, ge=1, le=50),
    doc_service: DocumentService = Depends(get_doc_service)
):
    """
    Search in document content (OCR text)
    
    Searches through extracted text from OCR processing.
    Returns matching document snippets with presigned URLs.
    """
    try:
        results = doc_service.search_content(
            query=q,
            highlight=highlight,
            limit=limit
        )
        return {
            "success": True,
            "query": q,
            "results": results,
            "total": len(results)
        }
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: str,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """Get document by ID with download URL"""
    document = doc_service.get_document(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Generate presigned URL for download
    if document.storage_path:
        from app.services.storage.minio_service import get_storage_service
        storage = get_storage_service()
        document.download_url = storage.get_presigned_url(
            document.storage_path,
            expires=604800  # 7 days
        )
    
    return document


@router.get("/contract/{contract_id}", response_model=List[DocumentResponse])
def get_contract_documents(
    contract_id: str,
    doc_type: Optional[str] = None,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """Get all documents for a contract"""
    documents = doc_service.get_contract_documents(contract_id, doc_type)
    
    # Generate presigned URLs
    from app.services.storage.minio_service import get_storage_service
    storage = get_storage_service()
    
    for doc in documents:
        if doc.storage_path:
            doc.download_url = storage.get_presigned_url(
                doc.storage_path,
                expires=604800  # 7 days
            )
    
    return documents


@router.get("/vendor/{vendor_id}", response_model=List[DocumentResponse])
def get_vendor_documents(
    vendor_id: str,
    doc_type: Optional[str] = None,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """Get all documents for a vendor"""
    documents = doc_service.get_vendor_documents(vendor_id, doc_type)
    
    # Generate presigned URLs
    from app.services.storage.minio_service import get_storage_service
    storage = get_storage_service()
    
    for doc in documents:
        if doc.storage_path:
            doc.download_url = storage.get_presigned_url(
                doc.storage_path,
                expires=604800  # 7 days
            )
    
    return documents


@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """Get download URL for document"""
    document = doc_service.get_document(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if not document.storage_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document has no file"
        )
    
    # Generate presigned URL
    from app.services.storage.minio_service import get_storage_service
    storage = get_storage_service()
    download_url = storage.get_presigned_url(
        document.storage_path,
        expires=604800  # 7 days
    )
    
    return {
        "success": True,
        "download_url": download_url,
        "filename": document.filename,
        "expires_in": 604800
    }


@router.patch("/{document_id}", response_model=DocumentResponse)
def update_document(
    document_id: str,
    update_data: DocumentUpdate,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """Update document metadata"""
    document = doc_service.update_document(document_id, update_data)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    return document


@router.patch("/{document_id}/extracted-data", response_model=DocumentResponse)
def update_document_extracted_data(
    document_id: str,
    data: DocumentExtractedDataUpdate,
    doc_service: DocumentService = Depends(get_doc_service),
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Update extracted data from OCR
    
    Allows manual correction of OCR-extracted fields:
    - contract_number: เลขที่สัญญา
    - counterparty: คู่สัญญา
    - contract_type: ประเภทสัญญา
    - contract_value: มูลค่า
    - project_name: ชื่อโครงการ
    - start_date: วันที่เริ่มต้น
    - end_date: วันที่สิ้นสุด
    - duration_months: ระยะเวลา (เดือน)
    """
    from app.models.contract import ContractAttachment
    
    document = db.query(ContractAttachment).filter(
        ContractAttachment.id == document_id,
        ContractAttachment.is_deleted == 0
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Update extracted_data field with new values
    if document.extracted_data is None:
        document.extracted_data = {}
    
    # Update only provided fields
    update_dict = data.model_dump(exclude_unset=True, exclude_none=True)
    document.extracted_data.update(update_dict)
    
    # Also update the individual columns for easier querying
    if data.contract_number:
        document.extracted_contract_number = data.contract_number
    if data.contract_value:
        document.extracted_contract_value = data.contract_value
    if data.start_date:
        document.extracted_start_date = data.start_date
    if data.end_date:
        document.extracted_end_date = data.end_date
    if data.counterparty:
        # Store in extracted_data only, no dedicated column
        pass
    if data.contract_type:
        # Store in extracted_data only, no dedicated column
        pass
    if data.project_name:
        # Store in extracted_data only, no dedicated column
        pass
    if data.duration_months:
        # Store in extracted_data only, no dedicated column
        pass
    
    db.commit()
    db.refresh(document)
    
    logger.info(f"Updated extracted data for document {document_id} by {user_payload.get('sub')}")
    
    return document


@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """Delete document (soft delete)"""
    success = doc_service.delete_document(document_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    return {"success": True, "message": "Document deleted"}


@router.get("/{document_id}/ocr-status")
def get_ocr_status(
    document_id: str,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """Get OCR processing status"""
    document = doc_service.get_document(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    response = {
        "document_id": document_id,
        "ocr_status": document.ocr_status,
        "ocr_confidence": document.ocr_confidence,
        "ocr_error": document.ocr_error,
        "extracted_text_length": len(document.extracted_text) if document.extracted_text else 0,
        "has_extracted_data": document.extracted_data is not None
    }
    
    # Include extracted_data when OCR is completed
    if document.ocr_status == "completed" and document.extracted_data:
        response["extracted_data"] = document.extracted_data
    
    return response


@router.post("/{document_id}/reprocess-ocr")
def reprocess_ocr(
    document_id: str,
    background_tasks: BackgroundTasks,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """Re-run OCR on document"""
    from app.tasks.document import process_document_ocr
    
    document = doc_service.get_document(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Reset OCR status
    document.ocr_status = "pending"
    document.ocr_error = None
    doc_service.db.commit()
    
    # Queue OCR task
    task = process_document_ocr.delay(document_id, doc_service.tenant_id)
    
    return {
        "success": True,
        "message": "OCR reprocessing queued",
        "task_id": task.id
    }


@router.post("/{document_id}/verify")
def verify_document(
    document_id: str,
    verify_data: DocumentVerifyRequest,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """Verify extracted OCR data"""
    document = doc_service.verify_document(document_id, verify_data)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    return document


@router.post("/{document_id}/rebuild-graph")
def rebuild_document_graph(
    document_id: str,
    doc_service: DocumentService = Depends(get_doc_service),
    db: Session = Depends(get_db)
):
    """
    Rebuild GraphRAG for a document
    
    Re-extracts entities and relationships from document's OCR text.
    Useful when auto-graph creation was disabled during upload.
    """
    from app.tasks.document import process_graphrag_extraction
    from app.models.contract import ContractAttachment
    
    document = db.query(ContractAttachment).filter(
        ContractAttachment.id == document_id,
        ContractAttachment.is_deleted == 0
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if document.ocr_status != "completed":
        raise HTTPException(
            status_code=400, 
            detail="Document OCR not completed. Please wait for OCR to finish."
        )
    
    # Queue GraphRAG rebuild
    process_graphrag_extraction.delay(document_id, doc_service.tenant_id)
    
    return {
        "success": True,
        "message": "GraphRAG rebuild queued",
        "document_id": document_id
    }


@router.get("", response_model=DocumentListResponse)
def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    document_type: Optional[str] = None,
    ocr_status: Optional[str] = None,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """List documents with pagination"""
    documents, total = doc_service.list_documents(
        page=page,
        page_size=page_size,
        document_type=document_type,
        ocr_status=ocr_status
    )
    
    pages = (total + page_size - 1) // page_size
    
    return {
        "items": documents,
        "total": total,
        "page": page,
        "pages": pages
    }
