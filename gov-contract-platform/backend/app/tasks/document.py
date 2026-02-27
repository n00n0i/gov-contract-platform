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
            
            # Queue GraphRAG extraction after OCR completes
            logger.info(f"[OCR Task] Queueing GraphRAG extraction for document {document_id}")
            process_graphrag_extraction.delay(document_id, tenant_id)
            
            return {
                "status": "success",
                "document_id": document_id,
                "confidence": result.confidence,
                "text_length": len(result.text) if result.text else 0,
                "graphrag_queued": True
            }
        else:
            logger.error(f"[OCR Task] Failed for document {document_id}: {result.error}")
            # Don't retry on OCR failure, it's usually a content issue
            return {
                "status": "failed",
                "document_id": document_id,
                "error": result.error
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


@shared_task(bind=True, max_retries=2)
def process_graphrag_extraction(self, document_id: str, tenant_id: str = None) -> Dict[str, Any]:
    """
    Extract entities and relationships from document using GraphRAG
    
    This runs after OCR is complete and creates:
    - Entities: persons, organizations, dates, values, terms
    - Relationships: connections between entities
    - Document node linking to MinIO file
    
    Flow:
    1. Get document with extracted_text from DB
    2. Download file from MinIO (for additional context)
    3. Extract entities using LLM
    4. Create relationships
    5. Link document node to MinIO storage_path
    """
    logger.info(f"[GraphRAG Task] Starting extraction for document {document_id}")
    
    db = SessionLocal()
    try:
        from app.models.contract import ContractAttachment
        
        document = db.query(ContractAttachment).filter(
            ContractAttachment.id == document_id
        ).first()
        
        if not document or not document.extracted_text:
            return {
                "status": "skipped",
                "reason": "No OCR text available for GraphRAG"
            }
        
        # Get MinIO file info for linking
        storage = get_storage_service()
        minio_path = document.storage_path
        minio_bucket = document.storage_bucket
        
        # Generate presigned URL for LLM reference (optional)
        try:
            file_url = storage.get_presigned_url(minio_path, expires=3600)
        except Exception as e:
            logger.warning(f"Could not generate presigned URL: {e}")
            file_url = None
        
        # TODO: Implement GraphRAG extraction
        # This should:
        # 1. Use LLM to extract entities from extracted_text
        # 2. Create nodes in Neo4j: Document, Person, Organization, Date, Value, etc.
        # 3. Create relationships: MENTIONS, SIGNS, CONTAINS, etc.
        # 4. Link Document node to MinIO storage_path for retrieval
        
        entities = []
        relationships = []
        
        # Example entity extraction (to be implemented with LLM)
        if document.extracted_contract_number:
            entities.append({
                "type": "CONTRACT_NUMBER",
                "value": document.extracted_contract_number,
                "source": "ocr"
            })
        
        if document.extracted_contract_value:
            entities.append({
                "type": "MONETARY_VALUE",
                "value": str(document.extracted_contract_value),
                "currency": "THB",
                "source": "ocr"
            })
        
        # Store parties as entities
        if document.extracted_parties:
            for party in document.extracted_parties:
                entities.append({
                    "type": "ORGANIZATION" if party.get("type") == "company" else "PERSON",
                    "name": party.get("name"),
                    "role": party.get("role", "unknown"),
                    "source": "ocr"
                })
                relationships.append({
                    "from": party.get("name"),
                    "to": document.extracted_contract_number or document_id,
                    "type": "PARTY_TO"
                })
        
        # Create document node with MinIO link
        document_node = {
            "id": f"DOC_{document_id}",
            "type": "DOCUMENT",
            "labels": ["ContractDocument", document.document_type or "unknown"],
            "properties": {
                "document_id": document_id,
                "filename": document.original_filename,
                "mime_type": document.mime_type,
                "minio_path": minio_path,
                "minio_bucket": minio_bucket,
                "minio_url": file_url,
                "contract_id": document.contract_id,
                "page_count": document.page_count,
                "uploaded_at": document.uploaded_at.isoformat() if document.uploaded_at else None,
                "ocr_confidence": float(document.ocr_confidence) if document.ocr_confidence else None
            }
        }
        
        logger.info(f"[GraphRAG Task] Extracted {len(entities)} entities, {len(relationships)} relationships for document {document_id}")
        
        # TODO: Save to Neo4j
        # await save_to_graph(document_node, entities, relationships)
        
        return {
            "status": "success",
            "document_id": document_id,
            "entities_extracted": len(entities),
            "relationships_extracted": len(relationships),
            "document_node": document_node,
            "minio_path": minio_path,
            "entities": entities,
            "relationships": relationships
        }
        
    except Exception as exc:
        logger.error(f"[GraphRAG Task] Exception for document {document_id}: {exc}")
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
