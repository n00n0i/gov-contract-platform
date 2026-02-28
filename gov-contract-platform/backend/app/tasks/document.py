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
from app.services.graph import get_contracts_graph_service
from app.models.graph_models import GraphEntity, GraphRelationship, GraphDocument, EntityType, RelationType, GraphDomain, SecurityLevel
import uuid
import hashlib

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
        
        # Always queue GraphRAG - even if OCR failed, we create a document entity
        logger.info(f"[OCR Task] Queueing GraphRAG extraction for document {document_id}")
        process_graphrag_extraction.delay(document_id, tenant_id)

        if result.success:
            logger.info(f"[OCR Task] Completed for document {document_id}")
            return {
                "status": "success",
                "document_id": document_id,
                "confidence": result.confidence,
                "text_length": len(result.text) if result.text else 0,
                "graphrag_queued": True
            }
        else:
            logger.error(f"[OCR Task] Failed for document {document_id}: {result.error}")
            return {
                "status": "failed",
                "document_id": document_id,
                "error": result.error,
                "graphrag_queued": True
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
        
        if not document:
            return {
                "status": "skipped",
                "reason": "Document not found"
            }

        if not document.extracted_text:
            logger.warning(f"[GraphRAG Task] No OCR text for {document_id} - will still create document entity")
        
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

        # --- Document entity (always created) ---
        doc_entity_id = f"DOC_ENTITY_{document_id}"
        entities.append({
            "id": doc_entity_id,
            "type": EntityType.DOCUMENT.value,
            "name": document.original_filename or document_id,
            "properties": {
                "document_type": document.document_type or "contract",
                "storage_path": minio_path,
                "ocr_confidence": float(document.ocr_confidence) if document.ocr_confidence else None,
            },
            "source": "system",
            "confidence": 1.0
        })

        # Track entity IDs for cross-referencing in relationships
        contract_num_entity_id = None
        
        def get_entity_id(entity_type: str, name: str) -> str:
            """Generate deterministic entity ID based on name to avoid duplicates"""
            # Normalize name: lowercase, strip spaces
            normalized = f"{entity_type}:{name}".lower().strip()
            # Create hash for ID
            return hashlib.md5(normalized.encode('utf-8')).hexdigest()

        # Contract number
        if document.extracted_contract_number:
            contract_num = document.extracted_contract_number
            contract_num_entity_id = get_entity_id("contract_number", contract_num)
            entities.append({
                "id": contract_num_entity_id,
                "type": EntityType.CONTRACT_NUMBER.value,
                "name": document.extracted_contract_number,
                "source": "ocr"
            })
            relationships.append({
                "source_id": doc_entity_id,
                "target_id": contract_num_entity_id,
                "type": RelationType.MENTIONS.value
            })

        # Contract value
        if document.extracted_contract_value:
            value_str = str(document.extracted_contract_value)
            value_entity_id = get_entity_id("money", value_str)
            entities.append({
                "id": value_entity_id,
                "type": EntityType.MONEY.value,
                "name": value_str,
                "properties": {"currency": "THB"},
                "source": "ocr"
            })
            relationships.append({
                "source_id": doc_entity_id,
                "target_id": value_entity_id,
                "type": RelationType.HAS_VALUE.value
            })

        # Start date
        start_date_val = (document.extracted_start_date or
                          (document.extracted_data.get("start_date") if document.extracted_data else None))
        if start_date_val:
            sd_str = str(start_date_val)
            sd_entity_id = get_entity_id("start_date", sd_str)
            entities.append({
                "id": sd_entity_id,
                "type": EntityType.START_DATE.value,
                "name": sd_str,
                "properties": {"date_type": "start"},
                "source": "ocr"
            })
            relationships.append({
                "source_id": doc_entity_id,
                "target_id": sd_entity_id,
                "type": RelationType.HAS_START_DATE.value
            })

        # End date
        end_date_val = (document.extracted_end_date or
                        (document.extracted_data.get("end_date") if document.extracted_data else None))
        if end_date_val:
            ed_str = str(end_date_val)
            ed_entity_id = get_entity_id("end_date", ed_str)
            entities.append({
                "id": ed_entity_id,
                "type": EntityType.END_DATE.value,
                "name": ed_str,
                "properties": {"date_type": "end"},
                "source": "ocr"
            })
            relationships.append({
                "source_id": doc_entity_id,
                "target_id": ed_entity_id,
                "type": RelationType.HAS_END_DATE.value
            })

        # Project name
        project_name = document.extracted_data.get("project_name") if document.extracted_data else None
        if project_name:
            proj_entity_id = get_entity_id("project", project_name)
            entities.append({
                "id": proj_entity_id,
                "type": EntityType.PROJECT.value,
                "name": project_name,
                "source": "ocr"
            })
            relationships.append({
                "source_id": doc_entity_id,
                "target_id": proj_entity_id,
                "type": RelationType.MENTIONS.value
            })

        # Parties
        if document.extracted_parties:
            for party in document.extracted_parties:
                party_name = party.get("name", "Unknown")
                if not party_name or party_name == "Unknown":
                    continue
                party_type = party.get("type", "")
                if party_type in ("company", "government"):
                    etype = EntityType.ORGANIZATION.value
                else:
                    etype = EntityType.PERSON.value
                # Use name + type for ID to avoid duplicates
                party_entity_id = get_entity_id(etype, party_name)
                entities.append({
                    "id": party_entity_id,
                    "type": etype,
                    "name": party_name,
                    "properties": {"role": party.get("role", party_type)},
                    "source": "ocr"
                })
                relationships.append({
                    "source_id": doc_entity_id,
                    "target_id": party_entity_id,
                    "type": RelationType.MENTIONS.value
                })
                if contract_num_entity_id:
                    relationships.append({
                        "source_id": party_entity_id,
                        "target_id": contract_num_entity_id,
                        "type": RelationType.CONTRACTS_WITH.value
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
        
        # Save to Neo4j using ContractsGraphService
        try:
            graph_service = get_contracts_graph_service()
            
            # Get security level from extracted_data or default to PUBLIC
            doc_security_level = SecurityLevel.PUBLIC
            if document.extracted_data:
                level = document.extracted_data.get("security_level")
                if level:
                    try:
                        doc_security_level = SecurityLevel(level)
                    except ValueError:
                        pass
            
            # Convert to GraphDocument
            graph_doc = GraphDocument(
                doc_id=document_id,
                doc_type=document.document_type or "contract",
                title=document.original_filename or "Untitled",
                domain=GraphDomain.CONTRACTS,
                tenant_id=tenant_id,
                department_id=document.extracted_data.get("department_id") if document.extracted_data else None,
                security_level=doc_security_level,
                entities=[
                    GraphEntity(
                        id=entity.get("id", str(uuid.uuid4())),
                        type=EntityType(entity.get("type", "document")),
                        name=entity.get("name", "Unknown"),
                        domain=GraphDomain.CONTRACTS,
                        properties=entity.get("properties", {}),
                        source_doc=document_id,
                        confidence=entity.get("confidence", 0.7),
                        tenant_id=tenant_id,
                        department_id=document.extracted_data.get("department_id") if document.extracted_data else None,
                        security_level=doc_security_level
                    )
                    for entity in entities
                ],
                relationships=[
                    GraphRelationship(
                        id=rel.get("id", str(uuid.uuid4())),
                        type=RelationType(rel.get("type", RelationType.MENTIONS.value)),
                        source_id=rel.get("source_id", ""),
                        target_id=rel.get("target_id", ""),
                        domain=GraphDomain.CONTRACTS,
                        properties=rel.get("properties", {}),
                        source_doc=document_id,
                        confidence=rel.get("confidence", 0.7),
                        tenant_id=tenant_id,
                        department_id=document.extracted_data.get("department_id") if document.extracted_data else None,
                        security_level=doc_security_level
                    )
                    for rel in relationships
                ]
            )
            
            # Save to graph
            success = graph_service.save_graph_document(graph_doc)
            if success:
                logger.info(f"[GraphRAG Task] Saved document {document_id} to Neo4j with {len(entities)} entities")
            else:
                logger.error(f"[GraphRAG Task] Failed to save document {document_id} to Neo4j - marking as failed")
                return {
                    "status": "failed",
                    "document_id": document_id,
                    "error": "Failed to save to Neo4j graph",
                    "entities_extracted": len(entities),
                    "relationships_extracted": len(relationships)
                }
                
        except Exception as graph_err:
            logger.error(f"[GraphRAG Task] Error saving to Neo4j: {graph_err}")
            return {
                "status": "failed",
                "document_id": document_id,
                "error": str(graph_err),
                "entities_extracted": len(entities),
                "relationships_extracted": len(relationships)
            }
        
        return {
            "status": "success",
            "document_id": document_id,
            "entities_extracted": len(entities),
            "relationships_extracted": len(relationships),
            "document_node": document_node,
            "minio_path": minio_path,
            "entities": entities,
            "relationships": relationships,
            "saved_to_graph": success if 'success' in locals() else False
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
