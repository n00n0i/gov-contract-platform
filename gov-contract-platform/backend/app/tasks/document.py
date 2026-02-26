"""
Document Processing Tasks - OCR and AI extraction
"""
import logging
from typing import Dict, Any
from celery import shared_task
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.services.document.document_service import DocumentService
from app.services.document.ocr_service import get_ocr_service
from app.services.storage.minio_service import get_storage_service

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_document_ocr(self, document_id: str, tenant_id: str = None) -> Dict[str, Any]:
    """
    Process document with OCR to extract text and data
    
    This is an async task that runs in Celery worker.
    """
    logger.info(f"[OCR Task] Starting OCR for document {document_id}")
    
    db = SessionLocal()
    try:
        # Create service instance
        doc_service = DocumentService(db=db, tenant_id=tenant_id)
        
        # Process OCR
        result = doc_service.process_ocr(document_id)
        
        if result.success:
            logger.info(f"[OCR Task] Completed for document {document_id}")
            return {
                "status": "success",
                "document_id": document_id,
                "confidence": result.confidence,
                "pages": result.pages,
                "text_length": len(result.text) if result.text else 0
            }
        else:
            logger.error(f"[OCR Task] Failed for document {document_id}: {result.error_message}")
            # Don't retry on OCR failure, it's usually a content issue
            return {
                "status": "failed",
                "document_id": document_id,
                "error": result.error_message
            }
            
    except Exception as exc:
        logger.error(f"[OCR Task] Exception for document {document_id}: {exc}")
        # Retry on exception
        raise self.retry(exc=exc)
    finally:
        db.close()


@shared_task(bind=True, max_retries=2)
def process_contract_extraction(self, document_id: str, tenant_id: str = None) -> Dict[str, Any]:
    """
    Extract structured contract data using AI/LLM
    
    This runs after OCR is complete.
    """
    logger.info(f"[AI Task] Starting contract extraction for document {document_id}")
    
    db = SessionLocal()
    try:
        from app.models.contract import ContractAttachment
        
        document = db.query(ContractAttachment).filter(
            ContractAttachment.id == document_id
        ).first()
        
        if not document or not document.extracted_text:
            return {
                "status": "skipped",
                "reason": "No OCR text available"
            }
        
        # TODO: Implement LLM-based extraction using Typhoon/OpenAI
        # For now, return the regex-extracted data
        extracted_data = {
            "contract_number": document.extracted_contract_number,
            "contract_value": document.extracted_contract_value,
            "start_date": document.extracted_start_date,
            "end_date": document.extracted_end_date,
            "parties": document.extracted_parties
        }
        
        logger.info(f"[AI Task] Extraction complete for document {document_id}")
        
        return {
            "status": "success",
            "document_id": document_id,
            "extracted_fields": extracted_data
        }
        
    except Exception as exc:
        logger.error(f"[AI Task] Exception: {exc}")
        raise self.retry(exc=exc)
    finally:
        db.close()


@shared_task
def generate_document_thumbnail(document_id: str, tenant_id: str = None) -> str:
    """
    Generate thumbnail for document preview
    """
    logger.info(f"[Thumbnail Task] Generating thumbnail for document {document_id}")
    
    db = SessionLocal()
    try:
        from app.models.contract import ContractAttachment
        from PIL import Image
        import io
        
        document = db.query(ContractAttachment).filter(
            ContractAttachment.id == document_id
        ).first()
        
        if not document:
            return "Document not found"
        
        storage = get_storage_service()
        
        # Download file
        file_data = storage.download_file(document.storage_path)
        
        # Generate thumbnail based on file type
        if document.mime_type.startswith("image/"):
            image = Image.open(io.BytesIO(file_data))
            image.thumbnail((300, 400))
            
            thumb_buffer = io.BytesIO()
            image.save(thumb_buffer, format='JPEG', quality=85)
            thumb_buffer.seek(0)
            
            # Upload thumbnail
            thumb_path = f"thumbnails/{document_id}.jpg"
            storage.client.put_object(
                bucket_name=storage.bucket,
                object_name=thumb_path,
                data=thumb_buffer,
                length=len(thumb_buffer.getvalue()),
                content_type="image/jpeg"
            )
            
            logger.info(f"[Thumbnail Task] Thumbnail created: {thumb_path}")
            return thumb_path
            
        elif document.mime_type == "application/pdf":
            # Convert first page to thumbnail
            from pdf2image import convert_from_bytes
            
            images = convert_from_bytes(file_data, first_page=1, last_page=1, dpi=100)
            if images:
                image = images[0]
                image.thumbnail((300, 400))
                
                thumb_buffer = io.BytesIO()
                image.save(thumb_buffer, format='JPEG', quality=85)
                thumb_buffer.seek(0)
                
                thumb_path = f"thumbnails/{document_id}.jpg"
                storage.client.put_object(
                    bucket_name=storage.bucket,
                    object_name=thumb_path,
                    data=thumb_buffer,
                    length=len(thumb_buffer.getvalue()),
                    content_type="image/jpeg"
                )
                
                logger.info(f"[Thumbnail Task] PDF thumbnail created: {thumb_path}")
                return thumb_path
        
        return "Thumbnail not generated - unsupported file type"
        
    except Exception as e:
        logger.error(f"[Thumbnail Task] Error: {e}")
        return f"Error: {str(e)}"
    finally:
        db.close()


@shared_task
def cleanup_temp_files():
    """
    Clean up temporary uploaded files
    """
    logger.info("[Cleanup Task] Cleaning up temporary files")
    return {"cleaned": 0}
