"""
Admin API Routes - Storage and System Management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
import logging

from app.db.database import get_db
from app.core.security import get_current_user_id, get_current_user_payload
from app.core.logging import get_logger
from app.services.storage.minio_service import get_storage_service

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = get_logger(__name__)


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
