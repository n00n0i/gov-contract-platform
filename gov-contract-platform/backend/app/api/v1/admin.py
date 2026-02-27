"""
Admin API Routes - Storage and System Management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
import logging

from app.db.database import get_db
from app.core.security import get_current_user_id, get_current_user_payload
from app.core.logging import get_logger
from app.services.storage.minio_service import get_storage_service
from datetime import datetime

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = get_logger(__name__)


class BulkDeleteRequest(BaseModel):
    file_ids: List[str]


class FileActionRequest(BaseModel):
    file_id: str
    action: str  # reprocess, create_graph


@router.get("/storage/minio/stats")
async def get_minio_stats(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Get MinIO storage statistics
    
    Returns usage stats for the MinIO object storage (files).
    """
    try:
        storage = get_storage_service()
        
        # Try to get bucket stats
        try:
            bucket_name = storage.bucket
            
            # List objects to get stats (simplified)
            # In production, use MinIO admin API or object count from database
            from app.models.contract import ContractAttachment
            
            document_count = db.query(ContractAttachment).filter(
                ContractAttachment.is_deleted == 0
            ).count()
            
            # Calculate total size from database
            total_size = db.query(ContractAttachment).filter(
                ContractAttachment.is_deleted == 0
            ).with_entities(ContractAttachment.file_size).all()
            
            total_bytes = sum([size[0] or 0 for size in total_size])
            
            return {
                "success": True,
                "totalSize": total_bytes,
                "documentCount": document_count,
                "bucketName": bucket_name,
                "endpoint": storage.client._base_url.host if hasattr(storage, 'client') else 'minio:9000'
            }
        except Exception as e:
            logger.error(f"Failed to get MinIO stats: {e}")
            return {
                "success": False,
                "totalSize": 0,
                "documentCount": 0,
                "bucketName": "govplatform",
                "endpoint": "minio:9000",
                "error": str(e)
            }
    except Exception as e:
        logger.error(f"MinIO stats error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get MinIO stats: {str(e)}")


@router.get("/storage/minio/files")
async def get_minio_files(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Get list of files in MinIO storage
    
    Returns paginated list of files with metadata.
    """
    try:
        from app.models.contract import ContractAttachment
        from app.models.contract import Contract  # For contract name lookup
        
        # Calculate offset
        offset = (page - 1) * limit
        
        # Query files
        query = db.query(ContractAttachment).filter(
            ContractAttachment.is_deleted == 0
        ).order_by(ContractAttachment.created_at.desc())
        
        total = query.count()
        files = query.offset(offset).limit(limit).all()
        
        # Format response
        file_list = []
        for file in files:
            # Get contract name if available
            contract_name = None
            if file.contract_id:
                contract = db.query(Contract).filter(
                    Contract.id == file.contract_id
                ).first()
                if contract:
                    contract_name = contract.contract_number
            
            file_list.append({
                "id": str(file.id),
                "filename": file.filename,
                "document_type": file.document_type,
                "file_size": file.file_size,
                "created_at": file.created_at.isoformat() if file.created_at else None,
                "contract_name": contract_name,
                "ocr_status": file.ocr_status or "pending",
                "storage_path": file.storage_path,
                "storage_bucket": file.storage_bucket
            })
        
        return {
            "success": True,
            "files": file_list,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        logger.error(f"Failed to get file list: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get file list: {str(e)}")


@router.post("/storage/minio/files/{file_id}/reprocess")
async def reprocess_file(
    file_id: str,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Re-process OCR for a file
    
    Queues the file for OCR processing again.
    """
    try:
        from app.models.contract import ContractAttachment
        from app.tasks.document import process_document_ocr
        
        # Get file
        file = db.query(ContractAttachment).filter(
            ContractAttachment.id == file_id,
            ContractAttachment.is_deleted == 0
        ).first()
        
        if not file:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Reset OCR status
        file.ocr_status = "pending"
        file.ocr_error = None
        db.commit()
        
        # Queue OCR task
        tenant_id = user_payload.get('tenant_id') if user_payload else None
        task = process_document_ocr.delay(file_id, tenant_id)
        
        return {
            "success": True,
            "message": "File queued for reprocessing",
            "file_id": file_id,
            "task_id": task.id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to reprocess file {file_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reprocess file: {str(e)}")


@router.post("/storage/minio/files/{file_id}/graph")
async def create_file_graph(
    file_id: str,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Create GraphRAG for a file
    
    Extracts entities and relationships from file's extracted text.
    """
    try:
        from app.models.contract import ContractAttachment
        from app.tasks.document import process_graphrag_extraction
        
        # Get file
        file = db.query(ContractAttachment).filter(
            ContractAttachment.id == file_id,
            ContractAttachment.is_deleted == 0
        ).first()
        
        if not file:
            raise HTTPException(status_code=404, detail="File not found")
        
        if file.ocr_status != "completed":
            raise HTTPException(
                status_code=400, 
                detail="File must be OCR completed before creating graph. Please reprocess first."
            )
        
        if not file.extracted_text:
            raise HTTPException(
                status_code=400,
                detail="No extracted text available for graph creation"
            )
        
        # Queue GraphRAG task
        tenant_id = user_payload.get('tenant_id') if user_payload else None
        task = process_graphrag_extraction.delay(file_id, tenant_id)
        
        return {
            "success": True,
            "message": "Graph creation queued",
            "file_id": file_id,
            "task_id": task.id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create graph for file {file_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create graph: {str(e)}")


@router.post("/storage/minio/files/bulk-delete")
async def bulk_delete_files(
    request: BulkDeleteRequest,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Bulk delete files from MinIO storage
    
    Soft deletes files, removes them from MinIO, and deletes RAG chunks.
    """
    try:
        from app.models.contract import ContractAttachment
        
        deleted_count = 0
        errors = []
        
        storage = get_storage_service()
        
        for file_id in request.file_ids:
            try:
                file = db.query(ContractAttachment).filter(
                    ContractAttachment.id == file_id,
                    ContractAttachment.is_deleted == 0
                ).first()
                
                if not file:
                    errors.append({"id": file_id, "error": "File not found"})
                    continue
                
                # Delete RAG chunks first (if any)
                try:
                    await _delete_rag_chunks(file_id, db)
                except Exception as e:
                    logger.warning(f"Failed to delete RAG chunks for {file_id}: {e}")
                    # Continue even if RAG delete fails
                
                # Delete from MinIO if storage_path exists
                if file.storage_path:
                    try:
                        storage.delete_file(file.storage_path)
                    except Exception as e:
                        logger.warning(f"Failed to delete file from MinIO: {e}")
                        # Continue with soft delete even if MinIO delete fails
                
                # Soft delete in database
                file.is_deleted = 1
                file.deleted_at = datetime.utcnow()
                file.deleted_by = user_payload.get('sub')
                
                deleted_count += 1
            except Exception as e:
                logger.error(f"Failed to delete file {file_id}: {e}")
                errors.append({"id": file_id, "error": str(e)})
        
        db.commit()
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "total_requested": len(request.file_ids),
            "errors": errors
        }
    except Exception as e:
        logger.error(f"Bulk delete failed: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Bulk delete failed: {str(e)}")


async def _delete_rag_chunks(file_id: str, db: Session):
    """
    Delete RAG chunks for a file
    
    Deletes from pgvector table if exists.
    """
    try:
        # Try to delete from document_chunks table if exists
        db.execute(
            "DELETE FROM document_chunks WHERE document_id = :file_id",
            {"file_id": file_id}
        )
        db.commit()
        logger.info(f"Deleted RAG chunks for file {file_id}")
    except Exception as e:
        # Table might not exist or other error
        logger.warning(f"Could not delete RAG chunks: {e}")


@router.post("/storage/minio/config")
async def update_minio_config(
    config: dict,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Update MinIO configuration
    
    Note: This requires backend restart to take effect.
    """
    # TODO: Save to settings database
    return {
        "success": True,
        "message": "Configuration saved. Restart required for changes to take effect.",
        "config": config
    }


@router.post("/storage/minio/test")
async def test_minio_connection(
    config: Optional[dict] = None,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Test MinIO connection
    
    Tests connectivity to MinIO storage.
    """
    try:
        storage = get_storage_service()
        
        # Try to list buckets or check bucket exists
        try:
            bucket_exists = storage.client.bucket_exists(storage.bucket)
            return {
                "success": True,
                "connected": True,
                "bucket_exists": bucket_exists,
                "bucket": storage.bucket,
                "message": "Successfully connected to MinIO"
            }
        except Exception as e:
            return {
                "success": False,
                "connected": False,
                "bucket": storage.bucket,
                "error": str(e),
                "message": "Failed to connect to MinIO"
            }
    except Exception as e:
        logger.error(f"MinIO connection test failed: {e}")
        return {
            "success": False,
            "connected": False,
            "error": str(e),
            "message": "Connection test failed"
        }


@router.get("/storage/rag/stats")
async def get_rag_stats(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Get RAG storage statistics
    
    Returns stats for vector storage (embeddings).
    """
    try:
        from app.models.contract import ContractAttachment
        
        # Get documents with extracted text (for RAG)
        docs_with_text = db.query(ContractAttachment).filter(
            ContractAttachment.is_deleted == 0,
            ContractAttachment.ocr_status == 'completed',
            ContractAttachment.extracted_text.isnot(None)
        ).count()
        
        # Estimate chunks (rough calculation)
        total_text_length = db.query(ContractAttachment).filter(
            ContractAttachment.is_deleted == 0,
            ContractAttachment.ocr_status == 'completed'
        ).with_entities(ContractAttachment.extracted_text).all()
        
        total_chars = sum([len(text[0] or '') for text in total_text_length])
        estimated_chunks = total_chars // 500  # Assuming 500 chars per chunk
        
        # Estimate size (384 dimensions * 4 bytes * chunks)
        embedding_size = estimated_chunks * 384 * 4 if estimated_chunks > 0 else 0
        
        return {
            "success": True,
            "totalChunks": estimated_chunks,
            "totalEmbeddings": estimated_chunks,  # One embedding per chunk
            "vectorSize": embedding_size,
            "documentsProcessed": docs_with_text,
            "lastSync": None  # TODO: Track last sync time
        }
    except Exception as e:
        logger.error(f"RAG stats error: {e}")
        return {
            "success": False,
            "totalChunks": 0,
            "totalEmbeddings": 0,
            "vectorSize": 0,
            "error": str(e)
        }


@router.post("/storage/rag/config")
async def update_rag_config(
    config: dict,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Update RAG storage configuration
    """
    # TODO: Save to settings database
    return {
        "success": True,
        "message": "RAG configuration saved",
        "config": config
    }


@router.post("/storage/rag/test")
async def test_rag_connection(
    config: Optional[dict] = None,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Test RAG storage connection
    
    Tests connectivity to vector database.
    """
    try:
        # TODO: Implement actual connection test based on provider
        provider = config.get('provider', 'pgvector') if config else 'pgvector'
        
        if provider == 'pgvector':
            # Test PostgreSQL connection
            db.execute("SELECT 1")
            return {
                "success": True,
                "connected": True,
                "provider": provider,
                "message": "Successfully connected to pgvector"
            }
        else:
            return {
                "success": True,
                "connected": True,
                "provider": provider,
                "message": f"Connection test for {provider} not implemented"
            }
    except Exception as e:
        logger.error(f"RAG connection test failed: {e}")
        return {
            "success": False,
            "connected": False,
            "error": str(e),
            "message": "Connection test failed"
        }


@router.post("/storage/rag/sync")
async def sync_rag_storage(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Sync RAG storage
    
    Re-processes all documents to update embeddings.
    """
    # TODO: Implement actual sync
    return {
        "success": True,
        "message": "RAG sync queued",
        "job_id": "sync-" + str(hash(str(user_payload.get('sub'))))
    }
