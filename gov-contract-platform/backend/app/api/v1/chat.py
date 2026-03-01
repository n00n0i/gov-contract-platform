"""
Chat API - AI-powered chat interface for contract platform queries.
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import json
import re

from app.db.database import get_db
from app.core.security import get_current_user_id
from app.core.logging import get_logger

router = APIRouter(prefix="/chat", tags=["Chat"])
logger = get_logger(__name__)


# ============== Schemas ==============

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatQueryRequest(BaseModel):
    question: str
    history: List[ChatMessage] = []


class Citation(BaseModel):
    type: str   # "contract" | "vendor" | "page"
    id: Optional[str] = None
    title: str
    url: str


class ChatQueryResponse(BaseModel):
    success: bool
    data: Dict[str, Any]


# ============== Intent Detection ==============

def _detect_intents(question: str) -> List[str]:
    """Detect query intents from Thai/English keywords."""
    q = question.lower()
    intents = []

    # Contract intents
    contract_kws = ["สัญญา", "contract", "ข้อสัญญา", "งวด", "มูลค่า", "ว่าจ้าง"]
    if any(k in q for k in contract_kws):
        intents.append("contracts")

    # Vendor intents
    vendor_kws = ["ผู้รับจ้าง", "vendor", "บริษัท", "ผู้ค้า", "ผู้จัดหา", "supplier"]
    if any(k in q for k in vendor_kws):
        intents.append("vendors")

    # Expiring intents
    expiring_kws = ["หมดอายุ", "ใกล้หมด", "expir", "วันสิ้นสุด", "ต่อสัญญา"]
    if any(k in q for k in expiring_kws):
        intents.append("expiring")

    # Stats intents
    stats_kws = ["สรุป", "สถิติ", "รวม", "จำนวน", "total", "summary", "overview", "ทั้งหมด", "ภาพรวม"]
    if any(k in q for k in stats_kws):
        intents.append("stats")

    # Report intents
    report_kws = ["รายงาน", "report", "chart", "กราฟ", "แนวโน้ม", "trend", "เดือน"]
    if any(k in q for k in report_kws):
        intents.append("report")

    # Default: search contracts
    if not intents:
        intents.append("contracts")
        intents.append("vendors")

    return intents


def _extract_keywords(question: str) -> List[str]:
    """Extract meaningful keywords for DB search (LIKE-safe, ASCII-only for tsquery)."""
    stop_words = {"ใน", "ของ", "กับ", "ที่", "มี", "ไม่", "มา", "และ", "หรือ", "จาก", "ให้",
                  "เป็น", "ได้", "จะ", "ต้อง", "การ", "ความ", "นั้น", "นี้", "ๆ",
                  "is", "are", "the", "a", "an", "in", "of", "to", "for", "with"}
    words = re.split(r'[\s,?.!;:]+', question)
    keywords = [w.strip() for w in words if w.strip() and w.strip() not in stop_words and len(w.strip()) > 1]
    return keywords[:8]


def _ascii_keywords(keywords: List[str]) -> List[str]:
    """Return only ASCII keywords suitable for to_tsquery (Thai chars are not valid in 'simple' dict)."""
    return [k for k in keywords if k.isascii() and re.match(r'^[a-zA-Z0-9_-]+$', k)]


# ============== Neo4j Context Gathering ==============

def _gather_neo4j_context(keywords: List[str], intents: List[str], question: str) -> Dict[str, Any]:
    """
    Search Neo4j Contracts KB.

    Strategy (Thai-text safe — Thai has no word separators):
    1. Type-based fetch driven by intent (always works regardless of keywords)
    2. CONTAINS search using each keyword (bonus — matches contract numbers, vendor names, etc.)
    3. Full question CONTAINS search as fallback
    """
    try:
        from app.services.graph import get_contracts_graph_service
        graph_service = get_contracts_graph_service()
        if not graph_service or not graph_service.driver:
            return {}

        seen_ids: set = set()
        entities: List[Dict] = []

        def _fetch(cypher: str, params: Dict) -> None:
            try:
                with graph_service.driver.session() as session:
                    for rec in session.run(cypher, params):
                        eid = rec.get("id")
                        if eid and eid not in seen_ids:
                            seen_ids.add(eid)
                            entities.append({
                                "id": eid,
                                "type": rec.get("type"),
                                "name": rec.get("name"),
                                "source_doc": rec.get("src"),
                            })
            except Exception as e:
                logger.warning(f"[Neo4j] query error: {e}")

        # ── 1. Type-based fetch driven by intent ──────────────────────────
        if "contracts" in intents or "stats" in intents:
            _fetch(
                """
                MATCH (e:Entity:Contracts)
                WHERE e.type IN ['contract', 'contract_number']
                RETURN e.id AS id, e.type AS type, e.name AS name, e.source_doc AS src
                ORDER BY e.confidence DESC LIMIT 20
                """,
                {},
            )

        if "vendors" in intents:
            _fetch(
                """
                MATCH (e:Entity:Contracts)
                WHERE e.type IN ['org', 'organization', 'counterparty', 'party']
                RETURN e.id AS id, e.type AS type, e.name AS name, e.source_doc AS src
                ORDER BY e.confidence DESC LIMIT 10
                """,
                {},
            )

        if "expiring" in intents:
            _fetch(
                """
                MATCH (e:Entity:Contracts)
                WHERE e.type IN ['end_date']
                RETURN e.id AS id, e.type AS type, e.name AS name, e.source_doc AS src
                ORDER BY e.name ASC LIMIT 10
                """,
                {},
            )

        # ── 2. Keyword CONTAINS search ────────────────────────────────────
        for kw in keywords[:4]:
            if len(kw) < 2:
                continue
            _fetch(
                """
                MATCH (e:Entity:Contracts)
                WHERE toLower(e.name) CONTAINS toLower($kw)
                RETURN e.id AS id, e.type AS type, e.name AS name, e.source_doc AS src
                LIMIT 10
                """,
                {"kw": kw},
            )

        # ── 3. Full question CONTAINS as fallback (catches partial Thai) ──
        if len(entities) < 3:
            for sub in [question[i:i+4] for i in range(0, min(len(question), 20), 4) if len(question[i:i+4]) >= 2]:
                _fetch(
                    """
                    MATCH (e:Entity:Contracts)
                    WHERE toLower(e.name) CONTAINS toLower($kw)
                    RETURN e.id AS id, e.type AS type, e.name AS name, e.source_doc AS src
                    LIMIT 6
                    """,
                    {"kw": sub},
                )
                if len(entities) >= 5:
                    break

        if not entities:
            return {}

        # ── Get 1-hop relationships ───────────────────────────────────────
        relationships: List[Dict] = []
        entity_ids = [e["id"] for e in entities[:10]]
        try:
            with graph_service.driver.session() as session:
                result = session.run(
                    """
                    MATCH (a:Entity:Contracts)-[r:RELATES]->(b:Entity:Contracts)
                    WHERE a.id IN $ids OR b.id IN $ids
                    RETURN a.name AS frm, r.type AS rel, b.name AS to
                    LIMIT 30
                    """,
                    {"ids": entity_ids},
                )
                for record in result:
                    relationships.append({
                        "from": record["frm"],
                        "rel": record["rel"],
                        "to": record["to"],
                    })
        except Exception as e:
            logger.warning(f"[Neo4j] relationship query: {e}")

        return {"neo4j_entities": entities, "neo4j_relationships": relationships}

    except Exception as e:
        logger.warning(f"[Neo4j] context gathering failed: {e}")
        return {}


# ============== DB Context Gathering ==============

def _gather_context(db: Session, intents: List[str], keywords: List[str], user_id: str) -> Dict[str, Any]:
    """Gather relevant data from DB based on detected intents."""
    ctx: Dict[str, Any] = {}

    # Stats are cheap - include if stats intent or as baseline
    if "stats" in intents or "contracts" in intents or not intents:
        try:
            row = db.execute(text("""
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
                    SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
                    SUM(CASE WHEN status = 'terminated' THEN 1 ELSE 0 END) as terminated,
                    COALESCE(SUM(value), 0) as total_value
                FROM contracts WHERE is_deleted = FALSE
            """)).fetchone()
            if row:
                ctx["contract_stats"] = {
                    "total": row[0], "active": row[1], "draft": row[2],
                    "expired": row[3], "terminated": row[4], "total_value": float(row[5] or 0)
                }
        except Exception as e:
            db.rollback()
            logger.warning(f"Failed to fetch contract stats: {e}")

    # Expiring contracts
    if "expiring" in intents:
        try:
            rows = db.execute(text("""
                SELECT id, title, contract_number, value, end_date,
                       (end_date::date - CURRENT_DATE) as days_left,
                       status
                FROM contracts
                WHERE is_deleted = FALSE AND end_date IS NOT NULL
                  AND end_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 60
                ORDER BY end_date ASC LIMIT 10
            """)).fetchall()
            ctx["expiring_contracts"] = [
                {
                    "id": str(r[0]), "title": r[1], "number": r[2],
                    "value": float(r[3] or 0), "end_date": str(r[4]),
                    "days_left": r[5], "status": r[6]
                }
                for r in rows
            ]
        except Exception as e:
            db.rollback()
            logger.warning(f"Failed to fetch expiring contracts: {e}")

    # Search relevant contracts — use LIKE only (tsquery unsafe for Thai text)
    if "contracts" in intents and keywords:
        try:
            # Build LIKE conditions for each keyword (safe for any language)
            like_parts = " OR ".join(
                f"(LOWER(title) LIKE :kw{i} OR LOWER(COALESCE(contract_number,'')) LIKE :kw{i})"
                for i in range(min(len(keywords), 4))
            )
            params: Dict[str, Any] = {f"kw{i}": f"%{keywords[i].lower()}%" for i in range(min(len(keywords), 4))}

            # Also try tsquery with ASCII-only keywords as a bonus condition
            ascii_kws = _ascii_keywords(keywords)
            if ascii_kws and like_parts:
                ts_part = (
                    " OR to_tsvector('simple', COALESCE(title,'') || ' ' || COALESCE(contract_number,'')) "
                    f"@@ to_tsquery('simple', :ts_q)"
                )
                params["ts_q"] = " | ".join(ascii_kws[:3])
                where_clause = f"({like_parts}{ts_part})"
            else:
                where_clause = f"({like_parts})" if like_parts else "TRUE"

            rows = db.execute(text(f"""
                SELECT id, title, contract_number, value, status, start_date, end_date,
                       contract_type
                FROM contracts
                WHERE is_deleted = FALSE AND {where_clause}
                ORDER BY created_at DESC LIMIT 8
            """), params).fetchall()
            ctx["relevant_contracts"] = [
                {
                    "id": str(r[0]), "title": r[1], "number": r[2],
                    "value": float(r[3] or 0), "status": r[4],
                    "start_date": str(r[5]) if r[5] else None,
                    "end_date": str(r[6]) if r[6] else None,
                    "type": r[7]
                }
                for r in rows
            ]
        except Exception as e:
            db.rollback()
            logger.warning(f"Failed to search contracts: {e}")
            # Fallback: recent contracts
            try:
                rows = db.execute(text("""
                    SELECT id, title, contract_number, value, status, start_date, end_date, contract_type
                    FROM contracts WHERE is_deleted = FALSE
                    ORDER BY created_at DESC LIMIT 5
                """)).fetchall()
                ctx["relevant_contracts"] = [
                    {
                        "id": str(r[0]), "title": r[1], "number": r[2],
                        "value": float(r[3] or 0), "status": r[4],
                        "start_date": str(r[5]) if r[5] else None,
                        "end_date": str(r[6]) if r[6] else None,
                        "type": r[7]
                    }
                    for r in rows
                ]
            except Exception as e2:
                db.rollback()
                logger.warning(f"Fallback contract fetch failed: {e2}")

    # Always include recent contracts when no specific results found yet
    if "contracts" in intents and not ctx.get("relevant_contracts"):
        try:
            rows = db.execute(text("""
                SELECT id, title, contract_number, value, status, start_date, end_date, contract_type
                FROM contracts WHERE is_deleted = FALSE
                ORDER BY created_at DESC LIMIT 10
            """)).fetchall()
            if rows:
                ctx["relevant_contracts"] = [
                    {
                        "id": str(r[0]), "title": r[1], "number": r[2],
                        "value": float(r[3] or 0), "status": r[4],
                        "start_date": str(r[5]) if r[5] else None,
                        "end_date": str(r[6]) if r[6] else None,
                        "type": r[7]
                    }
                    for r in rows
                ]
        except Exception as e:
            db.rollback()
            logger.warning(f"Recent contracts fallback failed: {e}")

    # Search relevant vendors
    if "vendors" in intents:
        try:
            kw_like = f"%{keywords[0].lower()}%" if keywords else "%"
            vendor_rows = db.execute(text("""
                SELECT id, name, vendor_type, status, tax_id,
                       (SELECT COUNT(*) FROM contracts c WHERE c.vendor_id = v.id AND c.is_deleted = FALSE) as contract_count
                FROM vendors v
                WHERE v.is_deleted = FALSE
                  AND (LOWER(v.name) LIKE :like OR LOWER(COALESCE(v.tax_id,'')) LIKE :like)
                ORDER BY contract_count DESC LIMIT 6
            """), {"like": kw_like}).fetchall()
            ctx["relevant_vendors"] = [
                {
                    "id": str(r[0]), "name": r[1], "type": r[2],
                    "status": r[3], "tax_id": r[4], "contract_count": r[5]
                }
                for r in vendor_rows
            ]
        except Exception as e:
            db.rollback()
            logger.warning(f"Failed to search vendors: {e}")

    # Monthly report data
    if "report" in intents:
        try:
            months = db.execute(text("""
                SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as cnt, COALESCE(SUM(value), 0) as val
                FROM contracts WHERE is_deleted = FALSE AND created_at >= NOW() - INTERVAL '6 months'
                GROUP BY month ORDER BY month
            """)).fetchall()
            ctx["monthly_data"] = [
                {"month": r[0], "count": r[1], "value": float(r[2])}
                for r in months
            ]
        except Exception as e:
            db.rollback()
            logger.warning(f"Failed to fetch monthly data: {e}")

    # Always ensure we leave the transaction in a clean state before returning
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db.rollback()

    return ctx


# ============== LLM Call ==============

async def _call_llm(db: Session, user_id: str, messages: List[Dict[str, str]]) -> str:
    """Call user's active LLM provider."""
    import httpx as _httpx
    from app.models.ai_provider import AIProvider as _AIProvider
    from app.models.identity import User as _User

    user_obj = db.query(_User).filter(_User.id == user_id).first()
    provider = None
    if user_obj and getattr(user_obj, 'active_llm_provider_id', None):
        provider = db.query(_AIProvider).filter(
            _AIProvider.id == user_obj.active_llm_provider_id
        ).first()
    if not provider:
        provider = db.query(_AIProvider).filter(
            _AIProvider.user_id == user_id,
            _AIProvider.is_active == True,
            _AIProvider.capabilities.contains(['chat'])
        ).first()
    if not provider:
        raise HTTPException(
            status_code=400,
            detail="ไม่มี AI provider ที่ตั้งค่าไว้ กรุณาตั้งค่า AI ใน Settings > AI Models"
        )

    base_url = (provider.api_url or "").rstrip("/")
    if base_url.endswith("/v1"):
        base_url = base_url[:-3]
    headers = {"Content-Type": "application/json"}
    if provider.api_key:
        headers["Authorization"] = f"Bearer {provider.api_key}"

    try:
        if (provider.provider_type or "") == "ollama":
            full_prompt = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages)
            payload = {"model": provider.model, "prompt": full_prompt, "stream": False}
            async with _httpx.AsyncClient() as client:
                resp = await client.post(f"{base_url}/api/generate", json=payload, headers=headers, timeout=120.0)
                resp.raise_for_status()
                return resp.json().get("response", "")
        else:
            payload = {
                "model": provider.model,
                "messages": messages,
                "max_tokens": 2000,
                "temperature": 0.3,
            }
            async with _httpx.AsyncClient() as client:
                resp = await client.post(f"{base_url}/v1/chat/completions", json=payload, headers=headers, timeout=120.0)
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]

    except _httpx.ConnectError as e:
        hint = ""
        if "localhost" in base_url or "127.0.0.1" in base_url:
            hint = " (URL ใช้ localhost — ใน Docker ให้เปลี่ยนเป็น host.docker.internal แทน)"
        raise HTTPException(
            status_code=502,
            detail=f"เชื่อมต่อ AI provider ไม่ได้: {provider.api_url}{hint}"
        )
    except _httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI provider ตอบสนองช้าเกินไป กรุณาลองใหม่")
    except _httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"AI provider ตอบกลับ error {e.response.status_code}: {e.response.text[:200]}"
        )


# ============== Build System Prompt ==============

def _build_system_prompt(ctx: Dict[str, Any]) -> str:
    parts = [
        "คุณเป็น AI ผู้ช่วยสำหรับระบบบริหารจัดการสัญญาภาครัฐ (Gov Contract Platform)",
        "ตอบคำถามโดยอ้างอิงจากข้อมูลที่ให้มาเท่านั้น ห้ามสร้างข้อมูลที่ไม่มีในระบบ",
        "ตอบเป็นภาษาไทยที่เป็นทางการ กระชับ และเข้าใจง่าย",
        "ใช้ Markdown ในการจัดรูปแบบ เช่น **ตัวหนา**, - รายการ, ## หัวข้อ",
        "",
        "ท้ายคำตอบ ให้ระบุ citations ในรูปแบบ JSON block เท่านั้น:",
        '```json',
        '{"citations": [{"type": "contract|vendor|page", "id": "...", "title": "...", "url": "..."}]}',
        '```',
        "- type=contract: ลิงก์ไปหน้าสัญญา url=/contracts/{id}",
        "- type=vendor: ลิงก์ไปหน้าผู้รับจ้าง url=/vendors?search={name}",
        "- type=page: ลิงก์ไปหน้าระบบ url=/reports หรือ /contracts เป็นต้น",
        "- ถ้าไม่มีข้อมูลที่เกี่ยวข้อง citations=[]",
        "",
        "=== ข้อมูลปัจจุบันในระบบ ===",
    ]

    stats = ctx.get("contract_stats")
    if stats:
        parts.append(
            f"\nสถิติสัญญา: ทั้งหมด {stats['total']} รายการ | ใช้งานอยู่ {stats['active']} | "
            f"ร่าง {stats['draft']} | หมดอายุ {stats['expired']} | "
            f"มูลค่ารวม {stats['total_value']:,.0f} บาท"
        )

    expiring = ctx.get("expiring_contracts", [])
    if expiring:
        parts.append(f"\nสัญญาใกล้หมดอายุ ({len(expiring)} รายการ ใน 60 วัน):")
        for c in expiring[:5]:
            parts.append(f"  - [{c['number'] or c['id']}] {c['title']} | เหลือ {c['days_left']} วัน | {c['value']:,.0f} บาท")

    contracts = ctx.get("relevant_contracts", [])
    if contracts:
        parts.append(f"\nสัญญาที่เกี่ยวข้อง ({len(contracts)} รายการ):")
        for c in contracts:
            parts.append(
                f"  - ID:{c['id']} [{c['number'] or '-'}] {c['title']} | {c['status']} | "
                f"{c['value']:,.0f} บาท | ประเภท: {c['type'] or '-'}"
            )

    vendors = ctx.get("relevant_vendors", [])
    if vendors:
        parts.append(f"\nผู้รับจ้างที่เกี่ยวข้อง ({len(vendors)} รายการ):")
        for v in vendors:
            parts.append(
                f"  - ID:{v['id']} {v['name']} | {v['type'] or '-'} | "
                f"สัญญา {v['contract_count']} รายการ"
            )

    monthly = ctx.get("monthly_data", [])
    if monthly:
        parts.append("\nข้อมูลรายเดือน (6 เดือนล่าสุด):")
        for m in monthly:
            parts.append(f"  - {m['month']}: {m['count']} สัญญา | {m['value']:,.0f} บาท")

    # Neo4j Knowledge Graph context
    neo4j_entities = ctx.get("neo4j_entities", [])
    neo4j_rels = ctx.get("neo4j_relationships", [])
    if neo4j_entities:
        parts.append(f"\n=== ข้อมูลจาก Knowledge Graph (Neo4j) — {len(neo4j_entities)} entities ===")
        # Group entities by type for readability
        by_type: Dict[str, List] = {}
        for e in neo4j_entities:
            t = e.get("type", "unknown")
            by_type.setdefault(t, []).append(e["name"])
        for etype, names in by_type.items():
            parts.append(f"  [{etype}]: {', '.join(names[:8])}")
        if neo4j_rels:
            parts.append(f"\n  ความสัมพันธ์ ({len(neo4j_rels)} รายการ):")
            for r in neo4j_rels[:15]:
                parts.append(f"  - {r['from']} --[{r['rel']}]--> {r['to']}")

    return "\n".join(parts)


# ============== Parse LLM Response ==============

def _parse_llm_response(raw: str) -> Dict[str, Any]:
    """Extract answer text and citations from LLM response."""
    citations = []

    # Try to extract JSON citations block
    json_match = re.search(r'```json\s*(\{.*?\})\s*```', raw, re.DOTALL)
    answer = raw

    if json_match:
        json_str = json_match.group(1)
        answer = raw[:json_match.start()].strip()
        try:
            parsed = json.loads(json_str)
            raw_citations = parsed.get("citations", [])
            for c in raw_citations:
                if isinstance(c, dict) and c.get("title") and c.get("url"):
                    citations.append({
                        "type": c.get("type", "page"),
                        "id": c.get("id"),
                        "title": c["title"],
                        "url": c["url"],
                    })
        except json.JSONDecodeError:
            pass

    return {"answer": answer.strip(), "citations": citations}


# ============== Endpoint ==============

@router.post("/query", response_model=ChatQueryResponse)
async def chat_query(
    request: ChatQueryRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Answer a chat question with DB context and return citations."""
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="กรุณาระบุคำถาม")

    # 1. Detect intents & extract keywords
    intents = _detect_intents(question)
    keywords = _extract_keywords(question)
    logger.info(f"Chat query: intents={intents} keywords={keywords}")

    # 2. Gather DB context (PostgreSQL)
    ctx = _gather_context(db, intents, keywords, user_id)

    # 3. Gather Neo4j Knowledge Graph context (always — enriches every answer)
    neo4j_ctx = _gather_neo4j_context(keywords, intents, question)
    ctx.update(neo4j_ctx)

    # 4. Build messages for LLM
    system_prompt = _build_system_prompt(ctx)

    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]

    # Include recent history (last 4 turns = 8 messages)
    for msg in request.history[-8:]:
        messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": question})

    # 5. Call LLM
    try:
        raw_response = await _call_llm(db, user_id, messages)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LLM call failed: {e}", exc_info=True)
        raise HTTPException(status_code=502, detail=f"AI ไม่สามารถตอบได้ในขณะนี้: {e}")

    # 5. Parse response
    parsed = _parse_llm_response(raw_response)

    return {
        "success": True,
        "data": {
            "answer": parsed["answer"],
            "citations": parsed["citations"],
            "intents": intents,
        }
    }
