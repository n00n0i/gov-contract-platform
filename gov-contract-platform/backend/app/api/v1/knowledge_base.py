"""
Knowledge Base API — user-managed KB with document upload, RAG & GraphRAG.
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import uuid
import os

from app.db.database import get_db
from app.core.security import get_current_user_id, get_current_user_payload
from app.core.logging import get_logger

router = APIRouter(prefix="/knowledge-bases", tags=["Knowledge Bases"])
logger = get_logger(__name__)

BUCKET = os.getenv("MINIO_BUCKET", "govplatform")


# ── Schemas ────────────────────────────────────────────────────────────────────

class KBCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    kb_type: str = "documents"        # documents | regulations | templates
    visibility: str = "private"       # private | org | shared


class KBUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_kb_or_404(db: Session, kb_id: str, user_id: str):
    from app.models.ai_models import KnowledgeBase
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    if kb.user_id != user_id and not kb.is_system:
        raise HTTPException(status_code=403, detail="Access denied")
    return kb


# ── KB CRUD ────────────────────────────────────────────────────────────────────

@router.get("")
async def list_knowledge_bases(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """List all knowledge bases owned by the current user."""
    from app.models.ai_models import KnowledgeBase
    kbs = (db.query(KnowledgeBase)
           .filter((KnowledgeBase.user_id == user_id) | (KnowledgeBase.is_system == True))
           .order_by(KnowledgeBase.created_at.desc())
           .all())
    return {"success": True, "data": [kb.to_dict() for kb in kbs]}


@router.post("")
async def create_knowledge_base(
    body: KBCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Create a new knowledge base."""
    from app.models.ai_models import KnowledgeBase
    kb = KnowledgeBase(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        kb_type=body.kb_type,
        visibility=body.visibility,
        user_id=user_id,
        owner_user_id=user_id,
        is_system=False,
        document_count=0,
        total_chunks=0,
        is_indexed=False,
    )
    db.add(kb)
    db.commit()
    db.refresh(kb)
    logger.info(f"KB created {kb.id} by {user_id}")
    return {"success": True, "data": kb.to_dict()}


@router.put("/{kb_id}")
async def update_knowledge_base(
    kb_id: str,
    body: KBUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    kb = _get_kb_or_404(db, kb_id, user_id)
    if kb.is_system:
        raise HTTPException(status_code=403, detail="System KBs cannot be modified")
    if body.name is not None:
        kb.name = body.name
    if body.description is not None:
        kb.description = body.description
    if body.visibility is not None:
        kb.visibility = body.visibility
    db.commit()
    db.refresh(kb)
    return {"success": True, "data": kb.to_dict()}


@router.delete("/{kb_id}")
async def delete_knowledge_base(
    kb_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    from app.models.ai_models import KBDocument
    kb = _get_kb_or_404(db, kb_id, user_id)
    if kb.is_system:
        raise HTTPException(status_code=403, detail="System KBs cannot be deleted")

    # Remove vector chunks
    try:
        db.execute(text("DELETE FROM vector_chunks WHERE kb_id = :kid"), {"kid": kb_id})
    except Exception:
        db.rollback()

    # Remove KB Neo4j entities
    try:
        from app.services.graph import get_kb_graph_service
        gs = get_kb_graph_service()
        if gs and gs.driver:
            with gs.driver.session() as s:
                s.run("MATCH (e:Entity:Kb {properties: $p}) DETACH DELETE e",
                      {"p": f'"kb_id": "{kb_id}"'})
    except Exception as e:
        logger.warning(f"KB Neo4j cleanup failed: {e}")

    db.delete(kb)
    db.commit()
    return {"success": True, "message": "Knowledge Base deleted"}


# ── Document Upload ────────────────────────────────────────────────────────────

@router.post("/{kb_id}/documents")
async def upload_kb_document(
    kb_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """Upload a document to a KB. Triggers async RAG + GraphRAG processing."""
    user_id = user_payload.get("sub")
    kb = _get_kb_or_404(db, kb_id, user_id)

    allowed_ext = {"pdf", "docx", "doc", "txt", "md"}
    filename = file.filename or "document"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in allowed_ext:
        raise HTTPException(status_code=400,
                            detail=f"รองรับเฉพาะ {', '.join(sorted(allowed_ext))}")

    content = await file.read()
    file_size = len(content)

    # Upload to MinIO
    from app.services.storage.minio_service import get_storage_service
    storage = get_storage_service()
    doc_id = str(uuid.uuid4())
    storage_path = f"kb/{kb_id}/{doc_id}/{filename}"

    try:
        import io
        storage.client.put_object(
            bucket_name=BUCKET,
            object_name=storage_path,
            data=io.BytesIO(content),
            length=file_size,
            content_type=file.content_type or "application/octet-stream",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload to storage failed: {e}")

    # Create KBDocument record
    from app.models.ai_models import KBDocument
    kb_doc = KBDocument(
        id=doc_id,
        kb_id=kb_id,
        filename=filename,
        storage_path=storage_path,
        storage_bucket=BUCKET,
        mime_type=file.content_type or "",
        file_size=file_size,
        status="pending",
        uploaded_by=user_id,
    )
    db.add(kb_doc)
    db.commit()

    # Queue Celery task
    from app.tasks.kb_document import process_kb_document
    process_kb_document.delay(doc_id)

    logger.info(f"KB doc uploaded {doc_id} → kb={kb_id}, queued processing")
    return {"success": True, "data": kb_doc.to_dict()}


# ── Document List ──────────────────────────────────────────────────────────────

@router.get("/{kb_id}/documents")
async def list_kb_documents(
    kb_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    _get_kb_or_404(db, kb_id, user_id)
    from app.models.ai_models import KBDocument
    docs = (db.query(KBDocument)
            .filter(KBDocument.kb_id == kb_id)
            .order_by(KBDocument.created_at.desc())
            .all())
    return {"success": True, "data": [d.to_dict() for d in docs]}


# ── Document Delete ────────────────────────────────────────────────────────────

@router.delete("/{kb_id}/documents/{doc_id}")
async def delete_kb_document(
    kb_id: str,
    doc_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    _get_kb_or_404(db, kb_id, user_id)
    from app.models.ai_models import KBDocument
    doc = db.query(KBDocument).filter(
        KBDocument.id == doc_id, KBDocument.kb_id == kb_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove vector chunks for this doc
    try:
        db.execute(text("DELETE FROM vector_chunks WHERE kb_id=:kid AND document_id=:did"),
                   {"kid": kb_id, "did": doc_id})
    except Exception:
        db.rollback()

    # Remove Neo4j entities sourced from this doc
    try:
        from app.services.graph import get_kb_graph_service
        gs = get_kb_graph_service()
        if gs and gs.driver:
            with gs.driver.session() as s:
                s.run("MATCH (e:Entity:Kb {source_doc: $src}) DETACH DELETE e",
                      {"src": f"kb_doc:{doc_id}"})
    except Exception as e:
        logger.warning(f"KB Neo4j doc cleanup failed: {e}")

    db.delete(doc)
    db.commit()
    return {"success": True, "message": "Document removed from Knowledge Base"}


# ── Document Reprocess ─────────────────────────────────────────────────────────

@router.post("/{kb_id}/documents/{doc_id}/reprocess")
async def reprocess_kb_document(
    kb_id: str,
    doc_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Reset a stuck/errored document back to pending and re-queue processing."""
    _get_kb_or_404(db, kb_id, user_id)
    from app.models.ai_models import KBDocument
    doc = db.query(KBDocument).filter(
        KBDocument.id == doc_id, KBDocument.kb_id == kb_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status == "indexed":
        raise HTTPException(status_code=400, detail="Document is already indexed")

    # Clean up previous vector chunks so we start fresh
    try:
        db.execute(text("DELETE FROM vector_chunks WHERE kb_id=:kid AND document_id=:did"),
                   {"kid": kb_id, "did": doc_id})
        db.commit()
    except Exception:
        db.rollback()

    doc.status = "pending"
    doc.error_message = None
    doc.chunk_count = 0
    doc.entity_count = 0
    db.commit()

    from app.tasks.kb_document import process_kb_document
    process_kb_document.delay(doc_id)
    logger.info(f"Re-queued KB document {doc_id} for processing")
    return {"success": True, "message": "Re-queued for processing"}


# ── KB Stats ───────────────────────────────────────────────────────────────────

@router.get("/{kb_id}/stats")
async def kb_stats(
    kb_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    kb = _get_kb_or_404(db, kb_id, user_id)
    from app.models.ai_models import KBDocument

    docs = db.query(KBDocument).filter(KBDocument.kb_id == kb_id).all()
    status_counts = {}
    for d in docs:
        status_counts[d.status] = status_counts.get(d.status, 0) + 1

    # Count Neo4j entities
    neo4j_count = 0
    try:
        from app.services.graph import get_kb_graph_service
        gs = get_kb_graph_service()
        if gs and gs.driver:
            with gs.driver.session() as s:
                rec = s.run(
                    "MATCH (e:Entity:Kb) WHERE e.properties CONTAINS $kid RETURN COUNT(e) as cnt",
                    {"kid": kb_id}
                ).single()
                neo4j_count = rec["cnt"] if rec else 0
    except Exception:
        pass

    return {
        "success": True,
        "data": {
            "kb": kb.to_dict(),
            "document_count": len(docs),
            "status_counts": status_counts,
            "total_chunks": kb.total_chunks or 0,
            "neo4j_entities": neo4j_count,
        }
    }


# ── RAG Query ──────────────────────────────────────────────────────────────────

class KBQueryRequest(BaseModel):
    query: str
    top_k: int = 5


@router.post("/{kb_id}/query")
async def query_kb(
    kb_id: str,
    body: KBQueryRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Semantic search over a KB:
    - Vector similarity search in vector_chunks (pgvector)
    - Entity/relationship lookup in KBGraphService
    Returns ranked chunks + graph context for the caller to feed into an LLM.
    """
    _get_kb_or_404(db, kb_id, user_id)

    chunks: List[dict] = []
    graph_ctx: dict = {}

    # ── Vector search ──────────────────────────────────────────────────────
    from app.models.ai_provider import AIProvider
    from app.models.identity import User

    user = db.query(User).filter(User.id == user_id).first()
    active_id = getattr(user, "active_llm_provider_id", None) if user else None
    embed_prov = None
    if active_id:
        embed_prov = (db.query(AIProvider)
                      .filter(AIProvider.id == active_id,
                              AIProvider.capabilities.contains(["embedding"]))
                      .first())
    if not embed_prov:
        embed_prov = (db.query(AIProvider)
                      .filter(AIProvider.user_id == user_id,
                               AIProvider.is_active == True,
                               AIProvider.capabilities.contains(["embedding"]))
                      .first())

    if embed_prov:
        try:
            vecs = _embed_single(embed_prov, body.query)
            if vecs:
                rows = db.execute(text("""
                    SELECT content, source_doc, metadata,
                           1 - (embedding <=> CAST(:emb AS vector)) as score
                    FROM vector_chunks
                    WHERE kb_id = :kid
                    ORDER BY embedding <=> CAST(:emb AS vector)
                    LIMIT :k
                """), {"kid": kb_id, "emb": str(vecs), "k": body.top_k}).fetchall()
                chunks = [
                    {"content": r[0], "source": r[1], "score": float(r[3])}
                    for r in rows
                ]
        except Exception as e:
            logger.warning(f"KB vector search failed: {e}")
            db.rollback()

    # ── Graph context ──────────────────────────────────────────────────────
    try:
        from app.services.graph import get_kb_graph_service
        gs = get_kb_graph_service()
        if gs and gs.driver:
            graph_ctx = gs.get_context_for_agent(
                query=body.query,
                kb_id=kb_id,
                max_entities=10,
                max_relationships=20,
            ) or {}
    except Exception as e:
        logger.warning(f"KB graph context failed: {e}")

    return {
        "success": True,
        "data": {
            "chunks": chunks,
            "graph_context": graph_ctx,
            "query": body.query,
        }
    }


def _embed_single(provider, text_str: str) -> List[float]:
    import httpx
    headers = {"Content-Type": "application/json"}
    if provider.api_key:
        headers["Authorization"] = f"Bearer {provider.api_key}"
    base = provider.api_url.rstrip("/")
    if base.endswith("/v1"):
        base = base[:-3]
    try:
        if (provider.provider_type or "") == "ollama":
            r = httpx.post(f"{base}/api/embeddings",
                           json={"model": provider.model, "prompt": text_str},
                           headers=headers, timeout=30.0)
            r.raise_for_status()
            return r.json().get("embedding", [])
        else:
            r = httpx.post(f"{base}/v1/embeddings",
                           json={"model": provider.model, "input": [text_str]},
                           headers=headers, timeout=30.0)
            r.raise_for_status()
            return r.json()["data"][0]["embedding"]
    except Exception as e:
        logger.warning(f"Embed single failed: {e}")
        return []
