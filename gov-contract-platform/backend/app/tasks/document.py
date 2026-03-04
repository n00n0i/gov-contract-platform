"""
Document Processing Tasks - OCR and AI extraction
"""
import json
import logging
import re
from datetime import date
from typing import Dict, Any
from celery import shared_task
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.services.document.document_service import DocumentService
from app.services.document.ocr_service import get_ocr_service
from app.services.document.ocr_settings_service import get_ocr_settings_service
from app.services.storage.minio_service import get_storage_service
from app.services.graph import get_contracts_graph_service
from app.models.graph_models import GraphEntity, GraphRelationship, GraphDocument, EntityType, RelationType, GraphDomain, SecurityLevel
import uuid
import hashlib

logger = logging.getLogger(__name__)

# Fixed ID for the system-wide contracts knowledge base
SYSTEM_CONTRACTS_KB_ID = "system-contracts-kb"


def _normalize_base_url(url: str) -> str:
    """Normalize URL: strip trailing slash and /v1 suffix"""
    base = url.rstrip("/")
    if base.endswith("/v1"):
        base = base[:-3]
    return base


def _sync_llm_call(provider, prompt: str) -> str:
    """Call LLM synchronously and return the response text."""
    import httpx

    provider_type = provider.provider_type or ""
    api_url = provider.api_url or ""
    api_key = provider.api_key or ""
    model = provider.model or ""

    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    base_url = _normalize_base_url(api_url)

    try:
        if provider_type == "ollama":
            payload = {"model": model, "prompt": prompt, "stream": False}
            response = httpx.post(f"{base_url}/api/generate", json=payload, headers=headers, timeout=120.0)
            response.raise_for_status()
            return response.json().get("response", "")
        else:
            # openai-compatible / vllm
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 2048,
                "temperature": 0.1,
            }
            response = httpx.post(f"{base_url}/v1/chat/completions", json=payload, headers=headers, timeout=120.0)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        return ""


def _get_or_create_system_contracts_kb(db) -> str:
    """Lazily create the system-wide contracts knowledge base if it doesn't exist."""
    from app.models.ai_models import KnowledgeBase
    from app.models.identity import User

    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == SYSTEM_CONTRACTS_KB_ID).first()
    if not kb:
        admin = db.query(User).filter(User.username == "admin").first()
        kb = KnowledgeBase(
            id=SYSTEM_CONTRACTS_KB_ID,
            name="System Contracts KB",
            user_id=admin.id if admin else "system",
            is_system=True,
            is_indexed=True,
            kb_type="documents",
        )
        db.add(kb)
        db.commit()
    return SYSTEM_CONTRACTS_KB_ID


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_document_ocr(self, document_id: str, tenant_id: str = None) -> Dict[str, Any]:
    """
    Process document with OCR to extract text and data.
    After OCR, queues contract extraction, RAG indexing, and GraphRAG in parallel.
    """
    logger.info(f"[OCR Task] Starting OCR for document {document_id}")

    db = SessionLocal()
    try:
        from app.models.contract import ContractAttachment
        doc = db.query(ContractAttachment).filter(ContractAttachment.id == document_id).first()
        uploader_id = doc.uploaded_by if doc else None

        doc_service = DocumentService(db=db, user_id=uploader_id, tenant_id=tenant_id)
        result = doc_service.process_ocr(document_id)

        if result.success:
            # Queue downstream tasks in parallel
            process_contract_extraction.delay(document_id, tenant_id)
            process_contract_rag_indexing.delay(document_id, tenant_id)
            logger.info(f"[OCR Task] Completed for document {document_id}, queued extraction + RAG + GraphRAG")
        else:
            logger.error(f"[OCR Task] Failed for document {document_id}: {result.error}")

        # Always queue GraphRAG — even on OCR failure, we create a document entity
        process_graphrag_extraction.delay(document_id, tenant_id)

        return {
            "status": "success" if result.success else "failed",
            "document_id": document_id,
            "confidence": result.confidence,
            "text_length": len(result.text) if result.text else 0,
            "graphrag_queued": True,
            "extraction_queued": result.success,
            "rag_queued": result.success,
        }

    except Exception as exc:
        logger.error(f"[OCR Task] Exception for document {document_id}: {exc}")
        raise self.retry(exc=exc)
    finally:
        db.close()


@shared_task(bind=True, max_retries=2)
def process_contract_extraction(self, document_id: str, tenant_id: str = None) -> Dict[str, Any]:
    """
    Extract structured contract data from OCR text using an LLM.
    Updates the parent Contract row with extracted fields.
    """
    logger.info(f"[AI Task] Starting contract extraction for document {document_id}")

    db = SessionLocal()
    try:
        from app.models.contract import ContractAttachment, Contract
        from app.models.identity import User
        from app.models.ai_provider import AIProvider

        document = db.query(ContractAttachment).filter(ContractAttachment.id == document_id).first()

        if not document or not document.extracted_text:
            return {"status": "skipped", "reason": "No OCR text available"}

        # 1. Find an active LLM provider (prefer uploader's, then any with chat capability)
        provider = None
        uploader = db.query(User).filter(User.id == document.uploaded_by).first() if document.uploaded_by else None
        if uploader and getattr(uploader, "active_llm_provider_id", None):
            provider = db.query(AIProvider).filter(
                AIProvider.id == uploader.active_llm_provider_id
            ).first()
        if not provider:
            # Any active provider with chat capability
            for p in db.query(AIProvider).filter(AIProvider.is_active == True).all():
                caps = p.capabilities or []
                if "chat" in caps:
                    provider = p
                    break

        if not provider:
            logger.warning(f"[AI Task] No LLM provider configured — skipping extraction for {document_id}")
            return {"status": "skipped", "reason": "No LLM provider configured"}

        # 2. Build extraction prompt
        prompt = (
            "สกัดข้อมูลสัญญาจากข้อความ OCR ต่อไปนี้ ตอบในรูปแบบ JSON เท่านั้น ห้ามมีข้อความอื่น:\n"
            "{\n"
            '  "contract_no": "เลขที่สัญญา หรือ null",\n'
            '  "title": "ชื่อสัญญา หรือ null",\n'
            '  "vendor_name": "ชื่อผู้รับจ้าง/คู่สัญญา หรือ null",\n'
            '  "contract_value": 0.0,\n'
            '  "start_date": "YYYY-MM-DD หรือ null",\n'
            '  "end_date": "YYYY-MM-DD หรือ null",\n'
            '  "project_name": "ชื่อโครงการ หรือ null",\n'
            '  "contract_type": "service|construction|procurement|consulting|other"\n'
            "}\n\n"
            f"ข้อความ OCR:\n{document.extracted_text[:4000]}"
        )

        # 3. Call LLM synchronously
        llm_response = _sync_llm_call(provider, prompt)

        if not llm_response:
            return {"status": "failed", "reason": "Empty LLM response"}

        # 4. Parse JSON and update Contract
        json_match = re.search(r"\{.*\}", llm_response, re.DOTALL)
        if not json_match:
            logger.warning(f"[AI Task] No JSON found in LLM response for {document_id}")
            return {"status": "failed", "reason": "No JSON in LLM response"}

        try:
            extracted = json.loads(json_match.group())
        except json.JSONDecodeError as e:
            logger.warning(f"[AI Task] JSON parse error for {document_id}: {e}")
            return {"status": "failed", "reason": f"JSON parse error: {e}"}

        if document.contract_id:
            contract = db.query(Contract).filter(Contract.id == document.contract_id).first()
            if contract:
                if extracted.get("title"):
                    contract.title = extracted["title"]
                if extracted.get("contract_no"):
                    contract.contract_no = extracted["contract_no"]
                if extracted.get("vendor_name"):
                    contract.vendor_name = extracted["vendor_name"]
                if extracted.get("contract_value"):
                    try:
                        contract.value_original = float(extracted["contract_value"])
                    except (TypeError, ValueError):
                        pass
                if extracted.get("start_date"):
                    try:
                        contract.start_date = date.fromisoformat(extracted["start_date"])
                    except (TypeError, ValueError):
                        pass
                if extracted.get("end_date"):
                    try:
                        contract.end_date = date.fromisoformat(extracted["end_date"])
                    except (TypeError, ValueError):
                        pass
                if extracted.get("project_name"):
                    contract.project_name = extracted["project_name"]
                db.commit()
                logger.info(f"[AI Task] Updated contract {contract.id} with extracted fields")

        logger.info(f"[AI Task] Extraction complete for document {document_id}")
        return {"status": "success", "document_id": document_id, "extracted_fields": extracted}

    except Exception as exc:
        logger.error(f"[AI Task] Exception: {exc}")
        raise self.retry(exc=exc)
    finally:
        db.close()


@shared_task(bind=True, max_retries=2)
def process_contract_rag_indexing(self, document_id: str, tenant_id: str = None) -> Dict[str, Any]:
    """
    Index OCR text into vector_chunks for semantic search.
    Chunks the extracted text, generates embeddings, and upserts into vector_chunks.
    """
    logger.info(f"[RAG Task] Starting RAG indexing for document {document_id}")

    db = SessionLocal()
    try:
        import httpx
        from app.models.contract import ContractAttachment
        from app.models.ai_provider import AIProvider

        document = db.query(ContractAttachment).filter(ContractAttachment.id == document_id).first()
        if not document:
            return {"status": "skipped", "reason": "Document not found"}
        if not document.extracted_text:
            return {"status": "skipped", "reason": "No OCR text to index"}

        # 1. Get / create system contracts KB
        kb_id = _get_or_create_system_contracts_kb(db)

        # 2. Chunk text (1000 chars, 200 overlap)
        ocr_text = document.extracted_text
        chunk_size = 1000
        overlap = 200
        chunks = []
        start = 0
        while start < len(ocr_text):
            end = start + chunk_size
            chunks.append(ocr_text[start:end])
            start += chunk_size - overlap

        if not chunks:
            return {"status": "skipped", "reason": "Empty text after chunking"}

        # 3. Find active embedding provider
        embedding_provider = None
        for p in db.query(AIProvider).filter(AIProvider.is_active == True).all():
            caps = p.capabilities or []
            if "embedding" in caps:
                embedding_provider = p
                break

        if not embedding_provider:
            logger.warning(f"[RAG Task] No embedding provider configured — skipping RAG for {document_id}")
            return {"status": "skipped", "reason": "No embedding provider configured"}

        base_url = _normalize_base_url(embedding_provider.api_url or "")
        model = embedding_provider.model or ""
        api_key = embedding_provider.api_key or ""
        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        provider_type = embedding_provider.provider_type or ""

        # 4. Generate embeddings and upsert into vector_chunks
        inserted = 0
        for idx, chunk_text in enumerate(chunks):
            try:
                if provider_type == "ollama":
                    payload = {"model": model, "prompt": chunk_text}
                    resp = httpx.post(f"{base_url}/api/embeddings", json=payload, headers=headers, timeout=60.0)
                    resp.raise_for_status()
                    embedding = resp.json().get("embedding", [])
                else:
                    payload = {"model": model, "input": chunk_text}
                    resp = httpx.post(f"{base_url}/v1/embeddings", json=payload, headers=headers, timeout=60.0)
                    resp.raise_for_status()
                    embedding = resp.json()["data"][0]["embedding"]

                if not embedding:
                    continue

                # Upsert into vector_chunks
                vector_str = "[" + ",".join(str(v) for v in embedding) + "]"
                db.execute(
                    text("""
                    INSERT INTO vector_chunks (kb_id, document_id, chunk_index, content, embedding, source_doc, metadata)
                    VALUES (:kb_id, :document_id, :chunk_index, :content, CAST(:embedding AS vector), :source_doc, CAST(:metadata AS jsonb))
                    ON CONFLICT (kb_id, document_id, chunk_index)
                    DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding
                    """),
                    {
                        "kb_id": kb_id,
                        "document_id": document_id,
                        "chunk_index": idx,
                        "content": chunk_text,
                        "embedding": vector_str,
                        "source_doc": document.original_filename,
                        "metadata": json.dumps({
                            "contract_id": document.contract_id,
                            "document_type": document.document_type,
                        }),
                    },
                )
                inserted += 1
            except Exception as chunk_err:
                logger.warning(f"[RAG Task] Failed to embed chunk {idx} for {document_id}: {chunk_err}")
                db.rollback()

        db.commit()
        logger.info(f"[RAG Task] Indexed {inserted}/{len(chunks)} chunks for document {document_id}")

        # Update KB stats (document_count, total_chunks) from vector_chunks
        try:
            from app.models.ai_models import KnowledgeBase, KBDocument
            from datetime import datetime
            stats = db.execute(
                text("SELECT COUNT(DISTINCT document_id), COUNT(*) FROM vector_chunks WHERE kb_id = :kid"),
                {"kid": kb_id},
            ).fetchone()
            if stats:
                kb_obj = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
                if kb_obj:
                    kb_obj.document_count = stats[0]
                    kb_obj.total_chunks = stats[1]
                    kb_obj.last_synced_at = datetime.utcnow()
                    db.commit()
                    logger.info(f"[RAG Task] Updated KB stats: {stats[0]} docs, {stats[1]} chunks")
        except Exception as stats_err:
            logger.warning(f"[RAG Task] Failed to update KB stats: {stats_err}")
            db.rollback()

        # Create/update KBDocument record so the document appears in KB document list
        try:
            from app.models.ai_models import KBDocument
            kb_doc = db.query(KBDocument).filter(
                KBDocument.id == document_id,
                KBDocument.kb_id == kb_id,
            ).first()
            if not kb_doc:
                kb_doc = KBDocument(
                    id=document_id,
                    kb_id=kb_id,
                    filename=document.original_filename or document.filename,
                    storage_path=document.storage_path,
                    storage_bucket=document.storage_bucket or "govplatform",
                    mime_type=document.mime_type,
                    file_size=document.file_size,
                    status="indexed",
                    chunk_count=inserted,
                    uploaded_by=document.uploaded_by,
                )
                db.add(kb_doc)
            else:
                kb_doc.status = "indexed"
                kb_doc.chunk_count = inserted
            db.commit()
            logger.info(f"[RAG Task] KBDocument record saved for {document_id}")
        except Exception as kbdoc_err:
            logger.warning(f"[RAG Task] Failed to create KBDocument record: {kbdoc_err}")
            db.rollback()

        return {
            "status": "success",
            "document_id": document_id,
            "chunks_total": len(chunks),
            "chunks_indexed": inserted,
            "kb_id": kb_id,
        }

    except Exception as exc:
        logger.error(f"[RAG Task] Exception for document {document_id}: {exc}")
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
            normalized = f"{entity_type}:{name}".lower().strip()
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

        # Update KBDocument entity_count for system-contracts-kb
        try:
            from app.models.ai_models import KBDocument
            SYSTEM_KB_ID = "system-contracts-kb"
            kb_doc = db.query(KBDocument).filter(
                KBDocument.id == document_id,
                KBDocument.kb_id == SYSTEM_KB_ID,
            ).first()
            if kb_doc:
                kb_doc.entity_count = len(entities)
                db.commit()
                logger.info(f"[GraphRAG Task] Updated KBDocument entity_count={len(entities)} for {document_id}")
        except Exception as kbdoc_err:
            logger.warning(f"[GraphRAG Task] Failed to update KBDocument entity_count: {kbdoc_err}")
            db.rollback()

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


@shared_task(bind=True, max_retries=0)
def process_document_upload_job(self, job_id: str) -> Dict[str, Any]:
    """
    Async handler for DocumentProcessingJob.
    Runs OCR + LLM extraction in background; user polls for completion.

    Enhancement:
    - Uses job.llm_provider_id and job.extraction_prompt if set.
    - Caches OCR raw text as a .txt file in MinIO (job.ocr_text_path).
      On re-run, if the .txt already exists it is reused (skipping OCR).
    """
    import re
    from datetime import datetime as _dt
    from app.models.document_job import DocumentProcessingJob

    logger.info(f"[JobTask] Starting job {job_id}")
    db = SessionLocal()
    try:
        job = db.query(DocumentProcessingJob).filter(DocumentProcessingJob.id == job_id).first()
        if not job:
            logger.error(f"[JobTask] Job {job_id} not found")
            return {"status": "error", "reason": "job not found"}

        # Mark as processing
        job.status = "processing"
        job.celery_task_id = self.request.id
        db.commit()

        storage = get_storage_service()

        # ── 1. OCR  ───────────────────────────────────────────────────────
        ocr_text = ""
        page_count = 1
        ocr_engine_name = "tesseract"
        ocr_error_msg = None
        ocr_text_minio_path = job.ocr_text_path  # may be None or a cached path

        # Check if OCR cache already exists in MinIO
        cache_loaded = False
        if ocr_text_minio_path:
            try:
                cached_bytes = storage.download_file(ocr_text_minio_path)
                ocr_text = cached_bytes.decode("utf-8")
                cache_loaded = True
                logger.info(f"[JobTask] OCR cache hit for job {job_id}: {ocr_text_minio_path}")
            except Exception as cache_err:
                logger.warning(f"[JobTask] OCR cache miss / error ({cache_err}) — will re-run OCR")
                ocr_text_minio_path = None

        if not cache_loaded:
            # Download original file from MinIO and run OCR
            try:
                file_bytes = storage.download_file(job.storage_path)
            except Exception as e:
                raise RuntimeError(f"MinIO download failed: {e}")

            try:
                ocr_settings = get_ocr_settings_service(db=db, user_id=job.user_id)
                from app.services.document.ocr_service import OCRService as _OCRService
                ocr_svc = _OCRService(ocr_settings_service=ocr_settings)
                result = ocr_svc.process_document(file_bytes, job.mime_type or "application/octet-stream")
                if result.success:
                    ocr_text = result.text or ""
                    page_count = result.pages or 1
                    ocr_engine_name = result.ocr_engine or "tesseract"
                else:
                    ocr_error_msg = result.error
                    logger.warning(f"[JobTask] OCR failed for job {job_id}: {result.error}")
            except Exception as e:
                ocr_error_msg = str(e)
                logger.warning(f"[JobTask] OCR exception for job {job_id}: {e}")

            # Save OCR text to MinIO as .txt cache
            if ocr_text:
                try:
                    import io as _io
                    txt_bytes = ocr_text.encode("utf-8")
                    # Derive storage folder from original file path
                    base_folder = "/".join(job.storage_path.split("/")[:-1])
                    txt_path = f"{base_folder}/{job_id}_ocr.txt"
                    storage.upload_file(
                        file_data=_io.BytesIO(txt_bytes),
                        filename=f"{job_id}_ocr.txt",
                        content_type="text/plain; charset=utf-8",
                        folder=base_folder,
                        metadata={"job_id": job_id, "type": "ocr_cache"},
                    )
                    ocr_text_minio_path = txt_path
                    logger.info(f"[JobTask] OCR text saved to MinIO: {txt_path}")
                except Exception as save_err:
                    logger.warning(f"[JobTask] Could not save OCR text to MinIO: {save_err}")

        # ── 2. LLM extraction  ────────────────────────────────────────────
        from app.models.identity import User
        from app.models.ai_provider import AIProvider

        extracted_data: dict = {}
        llm_error_msg = None

        if ocr_text:
            try:
                provider = None

                # Priority 1: provider explicitly chosen in upload wizard
                if job.llm_provider_id:
                    provider = db.query(AIProvider).filter(
                        AIProvider.id == job.llm_provider_id,
                    ).first()

                # Priority 2: user's active default LLM provider
                if not provider:
                    user = db.query(User).filter(User.id == job.user_id).first()
                    if user and getattr(user, "active_llm_provider_id", None):
                        provider = db.query(AIProvider).filter(
                            AIProvider.id == user.active_llm_provider_id
                        ).first()

                # Priority 3: any active LLM provider for this user
                if not provider:
                    provider = db.query(AIProvider).filter(
                        AIProvider.user_id == job.user_id,
                        AIProvider.is_active == True,
                    ).first()

                if provider:
                    # Use job's custom prompt or default
                    DEFAULT_PROMPT = (
                        "สกัดข้อมูลสัญญาจากข้อความ OCR ต่อไปนี้ ตอบในรูปแบบ JSON เท่านั้น ห้ามมีข้อความอื่น:\n"
                        "{\n"
                        '  "contract_number": "เลขที่สัญญา (ถ้าไม่พบ ใส่ null)",\n'
                        '  "title": "ชื่อโครงการ/สัญญา",\n'
                        '  "counterparty": "ชื่อผู้รับจ้าง/คู่สัญญา",\n'
                        '  "contract_type": "service|construction|procurement|consulting|other",\n'
                        '  "contract_value": 0.0,\n'
                        '  "project_name": "ชื่อโครงการ",\n'
                        '  "start_date": "YYYY-MM-DD หรือ null",\n'
                        '  "end_date": "YYYY-MM-DD หรือ null",\n'
                        '  "summary": "สรุปเนื้อหาสำคัญของสัญญา 3-5 ประโยค"\n'
                        "}\n\nข้อความ OCR:\n"
                    )
                    chosen_prompt = job.extraction_prompt if job.extraction_prompt else DEFAULT_PROMPT
                    full_prompt = f"{chosen_prompt}\n{ocr_text[:4000]}"
                    llm_response = _sync_llm_call(provider, full_prompt)
                    if llm_response:
                        m = re.search(r"\{.*\}", llm_response, re.DOTALL)
                        if m:
                            try:
                                extracted_data = json.loads(m.group())
                            except json.JSONDecodeError as e:
                                llm_error_msg = f"JSON parse error: {e}"
                        else:
                            llm_error_msg = "No JSON in LLM response"
                    else:
                        llm_error_msg = "Empty LLM response"
                else:
                    llm_error_msg = "No LLM provider configured"
            except Exception as e:
                llm_error_msg = str(e)
                logger.warning(f"[JobTask] LLM extraction failed for job {job_id}: {e}")
        else:
            llm_error_msg = "No OCR text available — skipping LLM"

        # ── 3. Update job to completed  ───────────────────────────────────
        job.status = "completed"
        job.extracted_text = ocr_text
        job.extracted_data = extracted_data
        job.page_count = page_count
        job.ocr_engine = ocr_engine_name
        job.ocr_error = ocr_error_msg
        job.llm_error = llm_error_msg
        job.ocr_text_path = ocr_text_minio_path
        job.completed_at = _dt.utcnow()
        db.commit()
        logger.info(f"[JobTask] Completed job {job_id}")
        return {"status": "completed", "job_id": job_id}

    except Exception as exc:
        logger.error(f"[JobTask] Exception for job {job_id}: {exc}")
        try:
            from app.models.document_job import DocumentProcessingJob as _Job
            job = db.query(_Job).filter(_Job.id == job_id).first()
            if job:
                job.status = "failed"
                job.ocr_error = str(exc)
                db.commit()
        except Exception:
            pass
        return {"status": "failed", "job_id": job_id, "error": str(exc)}
    finally:
        db.close()


@shared_task(bind=True, max_retries=0)
def process_document_upload_job_v2(self, job_id: str) -> Dict[str, Any]:
    """
    v2 page-level concurrent OCR task.

    Flow:
      1. Download file from MinIO
      2. Split PDF into per-page images (pdfplumber text-layer detection)
      3. Create DocumentOCRPage records (pending)
      4. asyncio.Semaphore concurrent OCR:
         - hybrid: text-layer pages skip vision OCR
         - SHA-256 hash dedup: identical pages reuse cache
         - per-page retry up to 3x with backoff
      5. Aggregate pages with \\f separator
      6. LLM extraction sliding window (2 pages at a time)
      7. Finalize job
    """
    import asyncio
    from datetime import datetime as _dt
    from app.models.document_job import DocumentProcessingJob
    from app.services.document.page_ocr_service import PageOCRService
    from app.services.document.ocr_settings_service import get_ocr_settings_service
    from app.api.v1.documents import _parse_llm_json, DEFAULT_EXTRACTION_PROMPT, SYSTEM_PROMPT
    import httpx

    logger.info(f"[JobV2] Starting page-level OCR for job {job_id}")
    db = SessionLocal()
    try:
        job = db.query(DocumentProcessingJob).filter(DocumentProcessingJob.id == job_id).first()
        if not job:
            return {"status": "error", "reason": "job not found"}

        job.status = "processing"
        job.celery_task_id = self.request.id
        db.commit()

        storage = get_storage_service()

        # 1. Download
        try:
            file_bytes = storage.download_file(job.storage_path)
        except Exception as e:
            raise RuntimeError(f"MinIO download failed: {e}")

        # 2-4. Page-level OCR
        concurrent = getattr(job, "ocr_concurrent", 2) or 2
        max_pages  = getattr(job, "ocr_max_pages_per_worker", 5) or 5

        ocr_settings = get_ocr_settings_service(db=db, user_id=job.user_id)
        page_svc = PageOCRService(ocr_settings_service=ocr_settings)

        page_results = asyncio.run(
            page_svc.process_job_pages(
                job_id=job_id,
                file_bytes=file_bytes,
                mime_type=job.mime_type or "application/pdf",
                db=db,
                concurrent=concurrent,
                max_per_job=max_pages,
                retry_failed_only=False,
            )
        )

        # 5. Aggregate with \f separator
        successful_pages = [r for r in page_results if r.success and r.text]
        failed_pages     = [r for r in page_results if not r.success]

        ocr_text = "\f".join(r.text for r in successful_pages)
        page_count = len(page_results)
        ocr_engine_name = successful_pages[0].ocr_engine if successful_pages else "unknown"
        ocr_error_msg = (
            f"{len(failed_pages)} page(s) failed: " +
            ", ".join(f"p{r.page_number}={r.error}" for r in failed_pages[:3])
        ) if failed_pages else None

        logger.info(f"[JobV2] OCR done: {len(successful_pages)}/{page_count} OK")

        # Cache to MinIO
        if ocr_text:
            try:
                import io as _io
                base_folder = "/".join(job.storage_path.split("/")[:-1])
                txt_path = f"{base_folder}/{job_id}_ocr.txt"
                storage.upload_file(
                    file_data=_io.BytesIO(ocr_text.encode("utf-8")),
                    filename=f"{job_id}_ocr.txt",
                    content_type="text/plain; charset=utf-8",
                    folder=base_folder,
                    metadata={"job_id": job_id, "type": "ocr_cache_v2"},
                )
                job.ocr_text_path = txt_path
            except Exception as save_err:
                logger.warning(f"[JobV2] MinIO cache save failed: {save_err}")

        # 6. LLM sliding window extraction
        from app.models.identity import User
        from app.models.ai_provider import AIProvider

        extracted_data: dict = {}
        llm_error_msg = None

        if ocr_text:
            try:
                provider = None
                if job.llm_provider_id:
                    provider = db.query(AIProvider).filter(
                        AIProvider.id == job.llm_provider_id).first()
                if not provider:
                    user = db.query(User).filter(User.id == job.user_id).first()
                    if user and getattr(user, "active_llm_provider_id", None):
                        provider = db.query(AIProvider).filter(
                            AIProvider.id == user.active_llm_provider_id).first()
                if not provider:
                    provider = db.query(AIProvider).filter(
                        AIProvider.user_id == job.user_id,
                        AIProvider.is_active == True,
                    ).first()

                if provider:
                    prompt_text = job.extraction_prompt or DEFAULT_EXTRACTION_PROMPT
                    pages_text = ocr_text.split("\f")
                    merged: dict = {}

                    base_url = (provider.api_url or "").rstrip("/")
                    if base_url.endswith("/v1"):
                        base_url = base_url[:-3]
                    headers_llm: dict = {"Content-Type": "application/json"}
                    if provider.api_key:
                        headers_llm["Authorization"] = f"Bearer {provider.api_key}"
                    model = (getattr(provider, "model", None)
                             or getattr(provider, "model_name", None)
                             or "gpt-3.5-turbo")
                    ptype = (getattr(provider, "provider_type", "") or "").lower()

                    for i in range(0, max(1, len(pages_text)), 2):
                        window = "\n\n".join(pages_text[i:i + 2])[:5000]
                        user_msg = f"{prompt_text}\n{window}"
                        try:
                            with httpx.Client(timeout=90) as client:
                                if "ollama" in ptype or "ollama" in base_url:
                                    r = client.post(
                                        f"{base_url}/api/generate",
                                        json={"model": model,
                                              "prompt": f"{SYSTEM_PROMPT}\n\n{user_msg}",
                                              "stream": False},
                                        headers=headers_llm,
                                    )
                                    raw = r.json().get("response", "") if r.status_code == 200 else ""
                                else:
                                    r = client.post(
                                        f"{base_url}/v1/chat/completions",
                                        json={
                                            "model": model,
                                            "messages": [
                                                {"role": "system", "content": SYSTEM_PROMPT},
                                                {"role": "user",   "content": user_msg},
                                            ],
                                            "temperature": 0.0,
                                        },
                                        headers=headers_llm,
                                    )
                                    raw = (r.json()["choices"][0]["message"]["content"]
                                           if r.status_code == 200 else "")
                            if raw:
                                window_data = _parse_llm_json(raw)
                                for k, v in window_data.items():
                                    if v is not None and merged.get(k) is None:
                                        merged[k] = v
                        except Exception as we:
                            logger.warning(f"[JobV2] LLM window {i} failed: {we}")

                    extracted_data = merged
                    logger.info(f"[JobV2] LLM extracted {len(extracted_data)} fields")
                else:
                    llm_error_msg = "No LLM provider configured"
            except Exception as e:
                llm_error_msg = str(e)
                logger.warning(f"[JobV2] LLM extraction failed: {e}")

        # 7. Finalize
        all_failed = len(failed_pages) == page_count and page_count > 0
        job.status = "failed" if all_failed else "completed"
        job.extracted_text = ocr_text
        job.extracted_data = extracted_data
        job.page_count = page_count
        job.ocr_engine = ocr_engine_name
        job.ocr_error = ocr_error_msg
        job.llm_error = llm_error_msg
        job.completed_at = _dt.utcnow()
        db.commit()

        logger.info(f"[JobV2] Job {job_id} → {job.status}")
        return {
            "status": job.status,
            "job_id": job_id,
            "pages_total": page_count,
            "pages_ok": len(successful_pages),
            "pages_failed": len(failed_pages),
        }

    except Exception as exc:
        logger.error(f"[JobV2] Fatal exception for job {job_id}: {exc}")
        try:
            from app.models.document_job import DocumentProcessingJob as _Job
            j2 = db.query(_Job).filter(_Job.id == job_id).first()
            if j2:
                j2.status = "failed"
                j2.ocr_error = str(exc)
                db.commit()
        except Exception:
            pass
        return {"status": "failed", "job_id": job_id, "error": str(exc)}
    finally:
        db.close()


@shared_task
def cleanup_temp_files():

    """
    Clean up temporary uploaded files
    """
    logger.info("[Cleanup Task] Cleaning up temporary files")
    return {"cleaned": 0}
