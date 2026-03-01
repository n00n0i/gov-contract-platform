"""
KB Document Processing Tasks
OCR → chunk → embed (vector_chunks) → entity extraction (KBGraphService / Neo4j)
"""
import json
import logging
import uuid
import hashlib
import re
from typing import Dict, Any, List

from celery import shared_task
from sqlalchemy.orm import Session

from app.db.database import SessionLocal

logger = logging.getLogger(__name__)

# ── Text extraction ────────────────────────────────────────────────────────────

def _sanitize(text: str) -> str:
    """Remove NUL bytes and other characters PostgreSQL TEXT rejects."""
    return text.replace("\x00", "").strip()


def _extract_text(content: bytes, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    try:
        if ext == "pdf":
            import io, pdfplumber
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                return _sanitize("\n".join(p.extract_text() or "" for p in pdf.pages))
        elif ext == "docx":
            import io, docx
            doc = docx.Document(io.BytesIO(content))
            return _sanitize("\n".join(p.text for p in doc.paragraphs))
        elif ext == "doc":
            # Old binary .doc — try antiword, fall back to empty (cannot safely decode binary)
            try:
                import subprocess
                result = subprocess.run(
                    ["antiword", "-"],
                    input=content, capture_output=True, timeout=30
                )
                if result.returncode == 0 and result.stdout:
                    return _sanitize(result.stdout.decode("utf-8", errors="replace"))
            except (FileNotFoundError, Exception):
                pass
            # No antiword — extract only printable ASCII/UTF-8, strip binary garbage
            decoded = content.decode("utf-8", errors="replace")
            printable = "".join(c for c in decoded if c.isprintable() or c in "\n\r\t")
            return _sanitize(printable)
        else:
            return _sanitize(content.decode("utf-8", errors="replace"))
    except Exception as e:
        logger.warning(f"Text extraction failed ({filename}): {e}")
        try:
            decoded = content.decode("utf-8", errors="replace")
            return _sanitize("".join(c for c in decoded if c.isprintable() or c in "\n\r\t"))
        except Exception:
            return ""


# ── Chunking ───────────────────────────────────────────────────────────────────

def _chunk_text(text: str, size: int = 800, overlap: int = 150) -> List[str]:
    chunks, i = [], 0
    while i < len(text):
        chunks.append(text[i: i + size])
        i += size - overlap
    return [c for c in chunks if len(c.strip()) > 30]


# ── LLM call (sync, reuses pattern from document.py) ──────────────────────────

def _normalize_url(url: str) -> str:
    base = url.rstrip("/")
    return base[:-3] if base.endswith("/v1") else base


def _llm_call(provider, prompt: str) -> str:
    import httpx
    headers = {"Content-Type": "application/json"}
    if provider.api_key:
        headers["Authorization"] = f"Bearer {provider.api_key}"
    base = _normalize_url(provider.api_url or "")
    try:
        if (provider.provider_type or "") == "ollama":
            r = httpx.post(f"{base}/api/generate",
                           json={"model": provider.model, "prompt": prompt, "stream": False},
                           headers=headers, timeout=120.0)
            r.raise_for_status()
            return r.json().get("response", "")
        else:
            r = httpx.post(f"{base}/v1/chat/completions",
                           json={"model": provider.model,
                                 "messages": [{"role": "user", "content": prompt}],
                                 "max_tokens": 2000, "temperature": 0.1},
                           headers=headers, timeout=120.0)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        return ""


# ── Embedding call ─────────────────────────────────────────────────────────────

def _embed(provider, texts: List[str]) -> List[List[float]]:
    import httpx
    headers = {"Content-Type": "application/json"}
    if provider.api_key:
        headers["Authorization"] = f"Bearer {provider.api_key}"
    base = _normalize_url(provider.api_url or "")
    embeddings = []
    try:
        if (provider.provider_type or "") == "ollama":
            for t in texts:
                r = httpx.post(f"{base}/api/embeddings",
                               json={"model": provider.model, "prompt": t},
                               headers=headers, timeout=60.0)
                r.raise_for_status()
                embeddings.append(r.json().get("embedding", []))
        else:
            r = httpx.post(f"{base}/v1/embeddings",
                           json={"model": provider.model, "input": texts},
                           headers=headers, timeout=60.0)
            r.raise_for_status()
            embeddings = [d["embedding"] for d in r.json()["data"]]
    except Exception as e:
        logger.error(f"Embedding failed: {e}")
        embeddings = [[] for _ in texts]
    return embeddings


# ── Providers helper ───────────────────────────────────────────────────────────

def _get_providers(db: Session, user_id: str):
    """Return (chat_provider, embed_provider) — either may be None."""
    from app.models.ai_provider import AIProvider
    from app.models.identity import User

    user = db.query(User).filter(User.id == user_id).first()
    active_id = getattr(user, "active_llm_provider_id", None) if user else None

    chat = None
    if active_id:
        chat = db.query(AIProvider).filter(AIProvider.id == active_id).first()
    if not chat:
        chat = (db.query(AIProvider)
                .filter(AIProvider.user_id == user_id,
                        AIProvider.is_active == True,
                        AIProvider.capabilities.contains(["chat"]))
                .first())

    embed = (db.query(AIProvider)
             .filter(AIProvider.user_id == user_id,
                     AIProvider.is_active == True,
                     AIProvider.capabilities.contains(["embedding"]))
             .first())
    # Fallback: use any user provider for embedding
    if not embed:
        embed = chat

    return chat, embed


# ── Entity extraction prompt ───────────────────────────────────────────────────

KB_ENTITY_PROMPT = """คุณเป็น AI ผู้เชี่ยวชาญด้านการสกัดข้อมูล วิเคราะห์เอกสารต่อไปนี้และระบุ entities หลัก

สกัด:
- topic: หัวข้อ/เรื่องหลักของเอกสาร
- org: ชื่อองค์กร บริษัท หรือหน่วยงาน
- person: ชื่อบุคคล
- concept: แนวคิด กระบวนการ หรือคำศัพท์สำคัญ
- date: วันที่หรือช่วงเวลาสำคัญ
- location: สถานที่หรือสถานที่

ตอบเฉพาะ JSON เท่านั้น:
{
  "entities": [
    {"type": "topic|org|person|concept|date|location", "name": "ชื่อ entity"},
    ...
  ],
  "relationships": [
    {"from": "ชื่อ entity A", "rel": "related_to|part_of|mentions|works_for", "to": "ชื่อ entity B"},
    ...
  ],
  "summary": "สรุปเอกสาร 1-2 ประโยค"
}

เอกสาร:
"""


# ── Main Celery task ───────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=3, default_retry_delay=60,
             name="process_kb_document")
def process_kb_document(self, doc_id: str) -> Dict[str, Any]:
    """
    Full pipeline for a KB document:
    1. Download from MinIO
    2. Extract text
    3. Chunk + embed → vector_chunks (for RAG)
    4. LLM entity extraction → KBGraphService (for GraphRAG)
    5. Update KBDocument status
    """
    logger.info(f"[KB Task] Starting processing for kb_document {doc_id}")
    db = SessionLocal()
    try:
        from app.models.ai_models import KBDocument, KnowledgeBase
        from app.services.storage.minio_service import get_storage_service
        from app.services.graph import get_kb_graph_service
        from app.models.graph_models import (
            GraphDocument, GraphEntity, GraphRelationship,
            EntityType, RelationType, GraphDomain, SecurityLevel,
        )
        from sqlalchemy import text

        doc = db.query(KBDocument).filter(KBDocument.id == doc_id).first()
        if not doc:
            logger.error(f"[KB Task] KBDocument {doc_id} not found")
            return {"status": "error", "reason": "document not found"}

        # ── Mark as processing ─────────────────────────────────────────────
        doc.status = "processing"
        db.commit()

        uploader_id = doc.uploaded_by or "system"

        # ── 1. Download file from MinIO ────────────────────────────────────
        storage = get_storage_service()
        try:
            file_bytes = storage.download_file(doc.storage_path)
        except Exception as e:
            _fail(db, doc, f"Failed to download from MinIO: {e}")
            return {"status": "error", "reason": str(e)}

        # ── 2. Extract text ────────────────────────────────────────────────
        text_content = _extract_text(file_bytes, doc.filename)
        if not text_content:
            _fail(db, doc, "No text could be extracted from file")
            return {"status": "error", "reason": "empty text"}

        doc.extracted_text = _sanitize(text_content)[:50000]  # cap at 50k chars
        db.commit()

        # ── 3. Chunk + embed → vector_chunks ──────────────────────────────
        chunks = _chunk_text(text_content)
        chunk_count = 0

        _, embed_provider = _get_providers(db, uploader_id)
        if embed_provider and chunks:
            # Embed in batches of 32
            batch_size = 32
            for batch_start in range(0, len(chunks), batch_size):
                batch = chunks[batch_start: batch_start + batch_size]
                vectors = _embed(embed_provider, batch)
                for idx, (chunk, vec) in enumerate(zip(batch, vectors)):
                    chunk_idx = batch_start + idx
                    if not vec:
                        continue
                    try:
                        db.execute(text("""
                            INSERT INTO vector_chunks
                                (kb_id, document_id, chunk_index, content, embedding, source_doc, metadata)
                            VALUES (:kb_id, :doc_id, :idx, :content, CAST(:emb AS vector), :src, :meta)
                            ON CONFLICT (kb_id, document_id, chunk_index)
                            DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding
                        """), {
                            "kb_id": doc.kb_id,
                            "doc_id": doc_id,
                            "idx": chunk_idx,
                            "content": chunk,
                            "emb": str(vec),
                            "src": doc.filename,
                            "meta": json.dumps({"filename": doc.filename, "chunk": chunk_idx}),
                        })
                        chunk_count += 1
                    except Exception as e:
                        logger.warning(f"[KB Task] chunk insert failed idx={chunk_idx}: {e}")
                        db.rollback()

            db.commit()
            logger.info(f"[KB Task] {chunk_count} chunks embedded for doc {doc_id}")
        else:
            logger.warning(f"[KB Task] No embedding provider — skipping vector indexing for {doc_id}")

        # ── 4. LLM entity extraction → KBGraphService ─────────────────────
        entity_count = 0
        chat_provider, _ = _get_providers(db, uploader_id)

        if chat_provider:
            sample_text = text_content[:6000]
            raw = _llm_call(chat_provider, KB_ENTITY_PROMPT + sample_text)

            parsed_entities, parsed_rels, summary = _parse_entity_response(raw)
            logger.info(f"[KB Task] Extracted {len(parsed_entities)} entities, {len(parsed_rels)} rels")

            if parsed_entities:
                kb_graph = get_kb_graph_service()
                if kb_graph and kb_graph.driver:
                    graph_doc = _build_graph_doc(
                        doc_id=doc_id,
                        kb_id=doc.kb_id,
                        filename=doc.filename,
                        summary=summary,
                        raw_entities=parsed_entities,
                        raw_rels=parsed_rels,
                    )
                    ok = kb_graph.save_graph_document(graph_doc)
                    entity_count = len(parsed_entities)
                    logger.info(f"[KB Task] Graph saved ok={ok}, entities={entity_count}")
                else:
                    logger.warning("[KB Task] KBGraphService not available — skipping GraphRAG")

        # ── 5. Update KB counters ──────────────────────────────────────────
        try:
            kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == doc.kb_id).first()
            if kb:
                kb.total_chunks = (kb.total_chunks or 0) + chunk_count
                kb.document_count = db.execute(
                    text("SELECT COUNT(*) FROM kb_documents WHERE kb_id=:kid"),
                    {"kid": doc.kb_id}
                ).scalar() or 0
                kb.is_indexed = True
                kb.last_synced_at = __import__("datetime").datetime.utcnow()
                db.commit()
        except Exception as e:
            logger.warning(f"[KB Task] KB counter update failed: {e}")
            db.rollback()

        # ── Mark as indexed ────────────────────────────────────────────────
        doc.status = "indexed"
        doc.chunk_count = chunk_count
        doc.entity_count = entity_count
        db.commit()

        logger.info(f"[KB Task] Done doc={doc_id} chunks={chunk_count} entities={entity_count}")
        return {"status": "indexed", "chunks": chunk_count, "entities": entity_count}

    except Exception as exc:
        logger.error(f"[KB Task] Unhandled exception for {doc_id}: {exc}", exc_info=True)
        try:
            from app.models.ai_models import KBDocument
            doc_err = db.query(KBDocument).filter(KBDocument.id == doc_id).first()
            if doc_err:
                _fail(db, doc_err, str(exc))
        except Exception:
            pass
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc)
        # Max retries exhausted — leave status as "error" (already set above)
    finally:
        db.close()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fail(db, doc, msg: str):
    try:
        doc.status = "error"
        doc.error_message = msg[:500]
        db.commit()
    except Exception:
        db.rollback()


def _parse_entity_response(raw: str):
    """Parse LLM JSON response → (entities, relationships, summary)."""
    # Strip markdown code fence if present
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()
    try:
        data = json.loads(cleaned)
        return (
            data.get("entities", []),
            data.get("relationships", []),
            data.get("summary", ""),
        )
    except Exception:
        # Try to find JSON block inside text
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                data = json.loads(m.group())
                return data.get("entities", []), data.get("relationships", []), data.get("summary", "")
            except Exception:
                pass
    return [], [], ""


_ENTITY_TYPE_MAP = {
    "topic": "document",
    "org": "org",
    "organization": "org",
    "person": "person",
    "concept": "unknown",
    "date": "start_date",
    "location": "location",
    "project": "project",
}

_REL_TYPE_MAP = {
    "related_to": "mentions",
    "part_of": "part_of",
    "mentions": "mentions",
    "works_for": "works_for",
    "contracts_with": "contracts_with",
}


def _build_graph_doc(doc_id, kb_id, filename, summary, raw_entities, raw_rels):
    from app.models.graph_models import (
        GraphDocument, GraphEntity, GraphRelationship,
        EntityType, RelationType, GraphDomain, SecurityLevel,
    )

    def make_id(etype: str, name: str) -> str:
        return hashlib.md5(f"kb:{kb_id}:{etype}:{name}".lower().encode()).hexdigest()

    entity_name_to_id: Dict[str, str] = {}
    entities = []

    for e in raw_entities:
        raw_type = (e.get("type") or "unknown").lower()
        etype_str = _ENTITY_TYPE_MAP.get(raw_type, "unknown")
        try:
            etype = EntityType(etype_str)
        except ValueError:
            etype = EntityType.UNKNOWN

        name = (e.get("name") or "").strip()
        if not name:
            continue

        eid = make_id(etype_str, name)
        entity_name_to_id[name] = eid

        entities.append(GraphEntity(
            id=eid,
            type=etype,
            name=name,
            domain=GraphDomain.KNOWLEDGE_BASE,
            source_doc=f"kb_doc:{doc_id}",
            confidence=0.9,
            properties={"kb_id": kb_id, "source_file": filename},
        ))

    relationships = []
    for r in raw_rels:
        frm = (r.get("from") or "").strip()
        to = (r.get("to") or "").strip()
        rel_str = _REL_TYPE_MAP.get((r.get("rel") or "related_to").lower(), "mentions")

        src_id = entity_name_to_id.get(frm)
        tgt_id = entity_name_to_id.get(to)
        if not src_id or not tgt_id or src_id == tgt_id:
            continue

        try:
            rtype = RelationType(rel_str)
        except ValueError:
            rtype = RelationType.MENTIONS

        relationships.append(GraphRelationship(
            id=str(uuid.uuid4()),
            type=rtype,
            source_id=src_id,
            target_id=tgt_id,
            domain=GraphDomain.KNOWLEDGE_BASE,
            source_doc=f"kb_doc:{doc_id}",
            confidence=0.9,
            properties={"kb_id": kb_id},
        ))

    return GraphDocument(
        doc_id=f"kb_doc:{doc_id}",
        doc_type="kb_document",
        title=summary or filename,
        domain=GraphDomain.KNOWLEDGE_BASE,
        entities=entities,
        relationships=relationships,
    )
