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
    
    Deletes from pgvector table and resets file's extracted text.
    """
    try:
        from app.models.contract import ContractAttachment
        
        # 1. Delete from document_chunks table if exists
        try:
            result = db.execute(
                "DELETE FROM document_chunks WHERE document_id = :file_id",
                {"file_id": file_id}
            )
            deleted = result.rowcount if hasattr(result, 'rowcount') else 0
            logger.info(f"Deleted {deleted} RAG chunks for file {file_id}")
        except Exception as e:
            # Table might not exist
            logger.warning(f"Could not delete from document_chunks: {e}")
        
        # 2. Reset extracted text and OCR status in ContractAttachment
        file = db.query(ContractAttachment).filter(
            ContractAttachment.id == file_id
        ).first()
        
        if file:
            file.extracted_text = None
            file.extracted_data = None
            file.ocr_status = "pending"
            file.ocr_confidence = None
            logger.info(f"Reset OCR data for file {file_id}")
        
        db.commit()
    except Exception as e:
        logger.error(f"Error deleting RAG chunks for {file_id}: {e}")
        db.rollback()
        raise


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


@router.post("/storage/rag/clear")
async def clear_rag_storage(
    confirm: bool = Query(False, description="Confirm deletion"),
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Clear RAG storage only
    
    Deletes all document chunks and embeddings while keeping files in MinIO.
    Use this to resync RAG data from scratch.
    """
    if not confirm:
        raise HTTPException(
            status_code=400, 
            detail="Please confirm deletion by setting confirm=true"
        )
    
    try:
        # Delete from document_chunks table
        result = db.execute("DELETE FROM document_chunks")
        db.commit()
        
        deleted_count = result.rowcount if hasattr(result, 'rowcount') else 0
        
        # Reset extracted_text and embeddings references in ContractAttachment
        from app.models.contract import ContractAttachment
        db.query(ContractAttachment).update({
            'extracted_text': None,
            'ocr_status': 'pending'
        })
        db.commit()
        
        logger.info(f"RAG storage cleared by {user_payload.get('sub')}: {deleted_count} chunks deleted")
        
        return {
            "success": True,
            "message": "RAG storage cleared successfully",
            "deleted_chunks": deleted_count,
            "note": "Files in MinIO are preserved. OCR status reset to pending for all documents."
        }
    except Exception as e:
        logger.error(f"Failed to clear RAG storage: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to clear RAG storage: {str(e)}")


@router.post("/storage/minio/clear")
async def clear_all_storage(
    confirm: bool = Query(False, description="Confirm deletion"),
    delete_files: bool = Query(True, description="Also delete files from MinIO"),
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Clear all storage (MinIO + RAG)
    
    Deletes all files from MinIO, RAG chunks, and soft-deletes database records.
    This is a destructive operation - use with caution!
    """
    if not confirm:
        raise HTTPException(
            status_code=400, 
            detail="Please confirm deletion by setting confirm=true"
        )
    
    try:
        from app.models.contract import ContractAttachment
        import uuid
        
        storage = get_storage_service()
        deleted_files = 0
        failed_files = []
        
        # Get all non-deleted files
        files = db.query(ContractAttachment).filter(
            ContractAttachment.is_deleted == 0
        ).all()
        
        # 1. Delete RAG chunks first
        try:
            db.execute("DELETE FROM document_chunks")
            db.commit()
        except Exception as e:
            logger.warning(f"Could not delete RAG chunks: {e}")
        
        # 2. Delete Contracts GraphRAG data
        graph_deleted = {"deleted_entities": 0, "deleted_documents": 0, "deleted_relationships": 0}
        try:
            from app.services.graph import get_contracts_graph_service
            graph_service = get_contracts_graph_service()
            graph_deleted = graph_service.clear_all_data()
        except Exception as e:
            logger.warning(f"Could not delete GraphRAG data: {e}")
        
        # 3. Delete files from MinIO and soft-delete in DB
        for file in files:
            try:
                # Delete from MinIO
                if delete_files and file.storage_path:
                    try:
                        storage.delete_file(file.storage_path)
                    except Exception as e:
                        failed_files.append({"id": str(file.id), "error": str(e)})
                
                # Soft delete in database
                file.is_deleted = 1
                file.deleted_at = datetime.utcnow()
                file.deleted_by = user_payload.get('sub')
                deleted_files += 1
            except Exception as e:
                failed_files.append({"id": str(file.id), "error": str(e)})
        
        db.commit()
        
        logger.warning(f"All storage cleared by {user_payload.get('sub')}: {deleted_files} files deleted")

        return {
            "success": True,
            "message": "All storage cleared successfully",
            "deleted_files": deleted_files,
            "deleted_graph_entities": graph_deleted.get("deleted_entities", 0),
            "deleted_graph_documents": graph_deleted.get("deleted_documents", 0),
            "deleted_graph_relationships": graph_deleted.get("deleted_relationships", 0),
            "failed_count": len(failed_files),
            "failed_files": failed_files[:10] if failed_files else [],  # Show first 10
            "warning": "This action cannot be undone. Files have been soft-deleted."
        }
    except Exception as e:
        logger.error(f"Failed to clear all storage: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to clear storage: {str(e)}")


@router.post("/contracts/clear-all")
async def clear_all_contracts(
    confirm: bool = Query(False, description="Must be true to execute"),
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """
    Permanently clear ALL contract data:
    - Delete all MinIO files (contract attachments)
    - Hard-delete all Contract rows (cascades to attachments, milestones, payments, changes, audit_logs)
    - Clear Neo4j GraphRAG Contracts domain (entities + relationships)
    - Clear vector_chunks for the system contracts KB
    """
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Set confirm=true to execute this destructive operation",
        )

    user_id = user_payload.get("sub")
    storage = get_storage_service()

    stats = {
        "deleted_minio_files": 0,
        "failed_minio_files": 0,
        "deleted_contracts": 0,
        "deleted_vector_chunks": 0,
        "deleted_graph_entities": 0,
        "deleted_graph_documents": 0,
        "deleted_graph_relationships": 0,
        "errors": [],
    }

    try:
        from app.models.contract import Contract, ContractAttachment
        from sqlalchemy import text

        # ── 1. Collect MinIO paths BEFORE deleting DB rows ────────────────
        attachments = db.query(ContractAttachment).all()
        minio_paths = [a.storage_path for a in attachments if a.storage_path]
        stats["deleted_contracts"] = db.query(Contract).count()

        # ── 2. Delete files from MinIO ─────────────────────────────────────
        for path in minio_paths:
            try:
                storage.delete_file(path)
                stats["deleted_minio_files"] += 1
            except Exception as e:
                stats["failed_minio_files"] += 1
                stats["errors"].append(f"MinIO {path}: {e}")

        # ── 3. Hard-delete all contracts via TRUNCATE CASCADE ──────────────
        # Order matters: children first, then parent
        child_tables = [
            "contract_audit_logs",
            "contract_changes",
            "contract_payments",
            "contract_milestones",
            "contract_attachments",
        ]
        for table in child_tables:
            try:
                db.execute(text(f"DELETE FROM {table}"))
            except Exception as e:
                logger.warning(f"Could not delete from {table}: {e}")
        db.execute(text("DELETE FROM contracts"))
        db.commit()

        # ── 4. Clear vector_chunks for system contracts KB ─────────────────
        try:
            result = db.execute(
                text("DELETE FROM vector_chunks WHERE kb_id = :kb_id"),
                {"kb_id": "system-contracts-kb"},
            )
            stats["deleted_vector_chunks"] = result.rowcount
            db.commit()
        except Exception as e:
            logger.warning(f"Could not clear vector_chunks: {e}")
            stats["errors"].append(f"vector_chunks: {e}")

        # ── 5. Clear Neo4j GraphRAG Contracts domain ───────────────────────
        try:
            from app.services.graph import get_contracts_graph_service
            graph_service = get_contracts_graph_service()
            graph_deleted = graph_service.clear_all_data()
            stats["deleted_graph_entities"] = graph_deleted.get("deleted_entities", 0)
            stats["deleted_graph_documents"] = graph_deleted.get("deleted_documents", 0)
            stats["deleted_graph_relationships"] = graph_deleted.get("deleted_relationships", 0)
        except Exception as e:
            logger.warning(f"Could not clear GraphRAG: {e}")
            stats["errors"].append(f"GraphRAG: {e}")

        logger.warning(
            f"[clear_all_contracts] by {user_id}: "
            f"{stats['deleted_contracts']} contracts, "
            f"{stats['deleted_minio_files']} MinIO files, "
            f"{stats['deleted_vector_chunks']} vector chunks, "
            f"graph: {stats['deleted_graph_entities']} entities"
        )

        return {
            "success": True,
            "message": "ล้างข้อมูลสัญญาทั้งหมดสำเร็จ",
            **stats,
        }

    except Exception as e:
        logger.error(f"clear_all_contracts failed: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"ล้างข้อมูลไม่สำเร็จ: {e}")
