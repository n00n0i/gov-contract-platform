"""
Document API Routes

All document uploads are automatically processed with OCR using centralized settings
from Settings > OCR (OCRSettingsService).
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
import uuid
import io
import re
import json
import logging as _logging

from app.db.database import get_db
from app.schemas.document import (
    DocumentCreate, DocumentUpdate, DocumentResponse, 
    DocumentListResponse, OCRResult, DocumentVerifyRequest,
    DocumentStatus, UploadProgress, DocumentExtractedDataUpdate
)
from app.services.document.document_service import DocumentService
from app.services.document.ocr_settings_service import get_ocr_settings_service
from app.services.agent.trigger_service import on_document_upload
from app.core.security import get_current_user_id, get_current_user_payload
from app.core.logging import get_logger

router = APIRouter(prefix="/documents", tags=["Documents"])
logger = get_logger(__name__)


def get_doc_service(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
) -> DocumentService:
    """Dependency to get document service"""
    return DocumentService(
        db=db,
        user_id=user_payload.get("sub"),
        tenant_id=user_payload.get("tenant_id")
    )


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form("other"),
    description: Optional[str] = Form(None),
    contract_id: Optional[str] = Form(None),
    vendor_id: Optional[str] = Form(None),
    is_draft: bool = Form(True),
    is_main_document: bool = Form(False),
    doc_service: DocumentService = Depends(get_doc_service),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Upload document with automatic OCR processing
    
    The document will be:
    1. Uploaded to MinIO storage
    2. Saved to database with OCR status "pending"
    3. Queued for OCR processing (using centralized OCR settings)
    4. Processed asynchronously by Celery worker
    
    OCR settings are controlled from Settings > OCR menu (OCRSettingsService)
    """
    try:
        # Read file content
        content = await file.read()
        file_obj = io.BytesIO(content)
        
        # Create document data
        document_data = DocumentCreate(
            filename=file.filename,
            document_type=document_type,
            description=description,
            contract_id=contract_id,
            vendor_id=vendor_id,
            is_draft=is_draft,
            is_main_document=is_main_document,
        )
        
        # Upload document
        document = await doc_service.upload_document(
            file=file_obj,
            filename=file.filename,
            content_type=file.content_type,
            document_data=document_data
        )
        
        # Generate download URL
        if document.storage_path:
            from app.services.storage.minio_service import get_storage_service
            storage = get_storage_service()
            document.download_url = storage.get_presigned_url(
                document.storage_path,
                expires=604800  # 7 days
            )
        
        # Trigger agent workflows
        try:
            await on_document_upload(
                document_id=document.id,
                file_name=file.filename,
                file_type=document.file_type or file.content_type or 'unknown',
                file_size=document.file_size or 0,
                user_id=user_id,
                db=db
            )
        except Exception as e:
            logger.error(f"Agent trigger failed: {e}")
        
        return document
        
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )


DEFAULT_EXTRACTION_PROMPT = """\
You are a contract data extraction API. Extract structured data from the Thai government contract text below.

RULES:
- Respond with ONLY a single valid JSON object — no markdown, no explanation, no ```json fences.
- If a field cannot be found, use null (not empty string).
- contract_value must be a number (float), not a string. If not found use null.
- Dates must be YYYY-MM-DD format. Convert Thai Buddhist Era (BE) to CE by subtracting 543.
- contract_type must be one of: "procurement" | "construction" | "service" | "consulting" | "other"

OUTPUT FORMAT (copy exactly, fill values):
{"contract_number":null,"title":null,"counterparty":null,"contract_type":null,"contract_value":null,"project_name":null,"start_date":null,"end_date":null,"summary":null}

CONTRACT TEXT:
"""

SYSTEM_PROMPT = (
    "You are a JSON-only contract data extraction API for Thai government contracts. "
    "Always respond with a single valid JSON object and nothing else. No markdown. No explanation."
)


def _parse_llm_json(text: str) -> dict:
    """Try multiple strategies to extract a JSON object from LLM response text."""
    import re, json

    text = text.strip()

    # Strategy 1: full text is JSON
    try:
        return json.loads(text)
    except Exception:
        pass

    # Strategy 2: strip markdown fences
    stripped = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
    try:
        return json.loads(stripped)
    except Exception:
        pass

    # Strategy 3: find the LAST {...} block (greedy, handles preamble text)
    matches = list(re.finditer(r"\{[^{}]*\}", stripped, re.DOTALL))
    if not matches:
        matches = list(re.finditer(r"\{.*?\}", stripped, re.DOTALL))
    for m in reversed(matches):
        try:
            return json.loads(m.group())
        except Exception:
            pass

    # Strategy 4: extract key:value pairs manually as fallback
    fields = ["contract_number", "title", "counterparty", "contract_type",
              "contract_value", "project_name", "start_date", "end_date", "summary"]
    result: dict = {}
    for field in fields:
        pattern = rf'"{field}"\s*:\s*("(?:[^"\\]|\\.)*"|null|-?\d+(?:\.\d+)?)'
        m2 = re.search(pattern, text)
        if m2:
            try:
                result[field] = json.loads(m2.group(1))
            except Exception:
                result[field] = m2.group(1).strip('"')
    if result:
        return result

    return {}


async def _llm_extract_for_document(
    db,
    user_id: str,
    llm_provider_id: Optional[str],
    ocr_text: str,
    custom_prompt: Optional[str],
) -> dict:
    """Extract structured contract data from OCR text using LLM."""
    import httpx
    from app.models.identity import User
    from app.models.ai_provider import AIProvider

    provider = None
    if llm_provider_id:
        provider = db.query(AIProvider).filter(
            AIProvider.id == llm_provider_id,
            AIProvider.user_id == user_id,
        ).first()
    if not provider:
        user = db.query(User).filter(User.id == user_id).first()
        if user and getattr(user, "active_llm_provider_id", None):
            provider = db.query(AIProvider).filter(
                AIProvider.id == user.active_llm_provider_id
            ).first()
    if not provider:
        provider = db.query(AIProvider).filter(
            AIProvider.user_id == user_id,
            AIProvider.is_active == True,
        ).first()
    if not provider:
        logger.warning("_llm_extract: no AI provider found for user")
        return {}

    prompt_text = custom_prompt if custom_prompt else DEFAULT_EXTRACTION_PROMPT
    ocr_snippet = ocr_text[:5000]        # allow slightly more text per window
    user_message = f"{prompt_text}\n{ocr_snippet}"

    base_url = (provider.api_url or "").rstrip("/")
    if base_url.endswith("/v1"):
        base_url = base_url[:-3]
    headers: dict = {"Content-Type": "application/json"}
    if provider.api_key:
        headers["Authorization"] = f"Bearer {provider.api_key}"
    model = getattr(provider, "model", None) or getattr(provider, "model_name", None) or ""
    provider_type = (getattr(provider, "provider_type", "") or "").lower()

    raw_text = ""
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            if "ollama" in provider_type or "ollama" in base_url:
                # Ollama: combine system + user into one prompt
                combined = f"{SYSTEM_PROMPT}\n\n{user_message}"
                r = await client.post(
                    f"{base_url}/api/generate",
                    json={"model": model, "prompt": combined, "stream": False},
                    headers=headers,
                )
                r.raise_for_status()
                raw_text = r.json().get("response", "")
            else:
                # OpenAI-compatible: use system message
                r = await client.post(
                    f"{base_url}/v1/chat/completions",
                    json={
                        "model": model or "gpt-3.5-turbo",
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user",   "content": user_message},
                        ],
                        "temperature": 0.0,   # deterministic
                        "response_format": {"type": "json_object"},   # if supported
                    },
                    headers=headers,
                )
                # response_format may not be supported — fall back gracefully
                if r.status_code == 400:
                    r = await client.post(
                        f"{base_url}/v1/chat/completions",
                        json={
                            "model": model or "gpt-3.5-turbo",
                            "messages": [
                                {"role": "system", "content": SYSTEM_PROMPT},
                                {"role": "user",   "content": user_message},
                            ],
                            "temperature": 0.0,
                        },
                        headers=headers,
                    )
                r.raise_for_status()
                raw_text = r.json()["choices"][0]["message"]["content"]

        logger.debug(f"LLM raw response (first 300): {raw_text[:300]}")
        result = _parse_llm_json(raw_text)
        if not result:
            logger.warning(f"LLM extraction produced no parseable JSON. raw={raw_text[:200]}")
        return result

    except Exception as e:
        logger.warning(f"LLM extraction failed: {e}")
        return {}


@router.post("/ocr-preview")
async def ocr_preview(
    file: UploadFile = File(...),
    llm_provider_id: Optional[str] = Form(None),
    extraction_prompt: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """
    Preview OCR + LLM extraction WITHOUT creating a DB record.
    Uploads file to MinIO (under documents/preview/), runs OCR,
    runs LLM extraction, returns all data for user review.
    """
    from app.services.storage.minio_service import get_storage_service
    from app.services.document.ocr_service import OCRService
    from app.services.document.ocr_settings_service import get_ocr_settings_service

    content = await file.read()
    tenant_id = user_payload.get("tenant_id", "default")

    storage = get_storage_service()
    upload_result = storage.upload_file(
        file_data=io.BytesIO(content),
        filename=file.filename,
        content_type=file.content_type or "application/octet-stream",
        folder=f"tenant_{tenant_id}/documents/preview",
        metadata={"preview": "true", "uploaded_by": user_id},
    )

    ocr_text = ""
    page_count = 1
    ocr_engine = "unknown"
    ocr_error = None
    try:
        ocr_settings = get_ocr_settings_service(db=db, user_id=user_id)
        ocr_svc = OCRService(ocr_settings_service=ocr_settings)
        result = ocr_svc.process_document(content, file.content_type or "application/octet-stream")
        if result.success:
            ocr_text = result.text or ""
            page_count = result.pages or 1
            ocr_engine = result.ocr_engine or "tesseract/pdfplumber"
        else:
            ocr_error = result.error
            logger.warning(f"OCR failed in preview: {result.error}")
    except Exception as e:
        ocr_error = str(e)
        logger.warning(f"OCR exception in preview: {e}")

    extracted_data: dict = {}
    llm_error = None
    if ocr_text:
        try:
            extracted_data = await _llm_extract_for_document(
                db, user_id, llm_provider_id, ocr_text, extraction_prompt
            )
        except Exception as e:
            llm_error = str(e)
            logger.warning(f"LLM extraction failed: {e}")
    else:
        llm_error = "ไม่มีข้อความ OCR — ข้ามการถอดข้อมูล LLM"

    return {
        "success": True,
        "data": {
            "storage_path": upload_result["storage_path"],
            "storage_bucket": upload_result["storage_bucket"],
            "filename": file.filename,
            "file_size": len(content),
            "mime_type": file.content_type or "application/octet-stream",
            "extracted_text": ocr_text,
            "extracted_data": extracted_data,
            "page_count": page_count,
            "ocr_engine": ocr_engine,
            "ocr_error": ocr_error,
            "llm_error": llm_error,
        },
    }


class ConfirmUploadRequest(BaseModel):
    storage_path: str
    storage_bucket: str = "govplatform"
    filename: str
    file_size: int = 0
    mime_type: str = "application/octet-stream"
    contract_id: Optional[str] = None
    document_type: str = "contract"
    is_draft: bool = True
    is_main_document: bool = False
    extracted_text: str = ""
    extracted_data: Optional[dict] = None


@router.post("/confirm")
async def confirm_upload(
    request: ConfirmUploadRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
):
    """
    Confirm and permanently save a previewed document.
    Creates the ContractAttachment DB record, updates the linked contract
    with extracted data, and queues RAG + GraphRAG background tasks.
    """
    from app.models.contract import ContractAttachment, Contract

    tenant_id = user_payload.get("tenant_id", "default")
    ext = request.filename.split(".")[-1].lower() if "." in request.filename else ""
    mime = request.mime_type
    if "pdf" in mime:
        file_type = "pdf"
    elif "image" in mime:
        file_type = "image"
    elif "word" in mime or ext in ("doc", "docx"):
        file_type = "word"
    else:
        file_type = "other"

    doc_id = str(uuid.uuid4())
    doc = ContractAttachment(
        id=doc_id,
        tenant_id=tenant_id,
        contract_id=request.contract_id,
        filename=request.filename,
        original_filename=request.filename,
        file_size=request.file_size,
        file_type=file_type,
        mime_type=request.mime_type,
        extension=ext,
        storage_path=request.storage_path,
        storage_bucket=request.storage_bucket,
        document_type=request.document_type,
        status="ocr_completed",
        ocr_status="completed",
        extracted_text=request.extracted_text,
        extracted_data=request.extracted_data or {},
        is_draft=request.is_draft,
        is_main_document=request.is_main_document,
        uploaded_by=user_id,
        uploaded_at=datetime.utcnow(),
        is_deleted=0,
    )

    # Populate structured extraction fields for GraphRAG
    if request.extracted_data:
        d = request.extracted_data
        if d.get("contract_number"):
            doc.extracted_contract_number = d["contract_number"]
        if d.get("contract_value"):
            try:
                doc.extracted_contract_value = float(d["contract_value"])
            except (TypeError, ValueError):
                pass
        if d.get("start_date"):
            try:
                from datetime import date as _date
                doc.extracted_start_date = _date.fromisoformat(str(d["start_date"]))
            except (TypeError, ValueError):
                pass
        if d.get("end_date"):
            try:
                from datetime import date as _date
                doc.extracted_end_date = _date.fromisoformat(str(d["end_date"]))
            except (TypeError, ValueError):
                pass

    db.add(doc)

    # Update linked contract with extracted data (only fill empty / auto-generated fields)
    if request.contract_id and request.extracted_data:
        contract = db.query(Contract).filter(Contract.id == request.contract_id).first()
        if contract:
            d = request.extracted_data
            if d.get("contract_number") and (
                not contract.contract_no or contract.contract_no.startswith("CON-")
            ):
                contract.contract_no = d["contract_number"]
            if d.get("title") and (
                not contract.title or "สัญญาใหม่" in (contract.title or "")
            ):
                contract.title = d["title"]
            if d.get("counterparty") and not contract.vendor_name:
                contract.vendor_name = d["counterparty"]
            if d.get("contract_value"):
                try:
                    contract.value_original = float(d["contract_value"])
                except (TypeError, ValueError):
                    pass
            if d.get("start_date"):
                try:
                    from datetime import date as _date
                    contract.start_date = _date.fromisoformat(str(d["start_date"]))
                except (TypeError, ValueError):
                    pass
            if d.get("end_date"):
                try:
                    from datetime import date as _date
                    contract.end_date = _date.fromisoformat(str(d["end_date"]))
                except (TypeError, ValueError):
                    pass
            if d.get("project_name") and not contract.project_name:
                contract.project_name = d["project_name"]

    db.commit()
    db.refresh(doc)

    # Queue background tasks
    try:
        from app.tasks.document import process_contract_rag_indexing, process_graphrag_extraction
        process_contract_rag_indexing.delay(doc_id, tenant_id)
        process_graphrag_extraction.delay(doc_id, tenant_id)
        logger.info(f"Queued RAG + GraphRAG for document {doc_id}")
    except Exception as e:
        logger.warning(f"Failed to queue background tasks: {e}")

    return {
        "success": True,
        "message": "บันทึกเอกสารสำเร็จ",
        "data": {
            "id": doc_id,
            "filename": doc.filename,
            "document_type": doc.document_type,
            "contract_id": doc.contract_id,
            "ocr_status": "completed",
            "is_draft": doc.is_draft,
            "is_main_document": doc.is_main_document,
        },
    }


# ──────────────────────────────────────────────────────────────────────────────
# ASYNC JOB ENDPOINTS
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/jobs")
async def create_document_job(
    file: UploadFile = File(...),
    contract_id: Optional[str] = Form(None),
    document_type: str = Form("contract"),
    is_draft: bool = Form(True),
    is_main_document: bool = Form(False),
    llm_provider_id: Optional[str] = Form(None),
    extraction_prompt: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user_id),
    user_payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """
    Upload a file and create a background processing job.
    Returns immediately with job_id. Poll GET /documents/jobs/{job_id} for status.
    """
    from app.models.document_job import DocumentProcessingJob
    from app.services.storage.minio_service import get_storage_service
    from app.tasks.document import process_document_upload_job

    content = await file.read()
    tenant_id = user_payload.get("tenant_id", "default")

    storage = get_storage_service()
    job_id = str(uuid.uuid4())
    upload_result = storage.upload_file(
        file_data=io.BytesIO(content),
        filename=file.filename,
        content_type=file.content_type or "application/octet-stream",
        folder=f"tenant_{tenant_id}/documents/jobs",
        metadata={"job_id": job_id, "uploaded_by": user_id},
    )

    job = DocumentProcessingJob(
        id=job_id,
        user_id=user_id,
        contract_id=contract_id or None,
        filename=file.filename,
        storage_path=upload_result["storage_path"],
        storage_bucket=upload_result.get("storage_bucket", "govplatform"),
        mime_type=file.content_type or "application/octet-stream",
        file_size=len(content),
        document_type=document_type,
        is_draft=is_draft,
        is_main_document=is_main_document,
        llm_provider_id=llm_provider_id or None,
        extraction_prompt=extraction_prompt or None,
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    task = process_document_upload_job.delay(job_id)
    job.celery_task_id = task.id
    db.commit()

    return {
        "success": True,
        "data": {
            "job_id": job_id,
            "status": "pending",
            "filename": file.filename,
            "created_at": job.created_at.isoformat() if job.created_at else None,
        },
    }


@router.get("/jobs/stats")
def get_document_job_stats(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Return job counts by status for the current user (used in dashboard)."""
    from app.models.document_job import DocumentProcessingJob
    from sqlalchemy import func

    rows = (
        db.query(DocumentProcessingJob.status, func.count(DocumentProcessingJob.id))
        .filter(DocumentProcessingJob.user_id == user_id)
        .group_by(DocumentProcessingJob.status)
        .all()
    )
    counts = {r[0]: r[1] for r in rows}
    return {
        "success": True,
        "data": {
            "pending": counts.get("pending", 0),
            "processing": counts.get("processing", 0),
            "completed": counts.get("completed", 0),
            "failed": counts.get("failed", 0),
            "total": sum(counts.values()),
        },
    }


@router.get("/jobs")
def list_document_jobs(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    limit: int = 100,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    """Return jobs for the current user with optional filters."""
    from app.models.document_job import DocumentProcessingJob
    from app.models.contract import Contract

    q = (
        db.query(DocumentProcessingJob)
        .filter(DocumentProcessingJob.user_id == user_id)
    )
    if status:
        q = q.filter(DocumentProcessingJob.status == status)
    if date_from:
        try:
            from datetime import datetime as _dt
            q = q.filter(DocumentProcessingJob.created_at >= _dt.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            from datetime import datetime as _dt
            q = q.filter(DocumentProcessingJob.created_at <= _dt.fromisoformat(date_to))
        except ValueError:
            pass

    jobs = q.order_by(DocumentProcessingJob.created_at.desc()).limit(limit).all()

    result = []
    for j in jobs:
        contract_title = None
        if j.contract_id:
            c = db.query(Contract).filter(Contract.id == j.contract_id).first()
            if c:
                contract_title = c.title

        result.append({
            "id": j.id,
            "filename": j.filename,
            "status": j.status,
            "contract_id": j.contract_id,
            "contract_title": contract_title,
            "document_type": j.document_type,
            "is_draft": j.is_draft,
            "is_main_document": j.is_main_document,
            "page_count": j.page_count,
            "ocr_engine": j.ocr_engine,
            "ocr_error": j.ocr_error,
            "llm_error": j.llm_error,
            "has_ocr_text": bool(j.extracted_text),   # lightweight flag for frontend
            "extracted_text": j.extracted_text,        # full text for modal pre-fill
            "extracted_data": j.extracted_data,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "completed_at": j.completed_at.isoformat() if j.completed_at else None,
        })

    return {"success": True, "data": result, "total": len(result)}


@router.get("/jobs/{job_id}")
def get_document_job(
    job_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get full job details including extracted_data (for polling)."""
    from app.models.document_job import DocumentProcessingJob
    from app.models.contract import Contract
    from fastapi import HTTPException

    job = db.query(DocumentProcessingJob).filter(DocumentProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    contract_title = None
    if job.contract_id:
        c = db.query(Contract).filter(Contract.id == job.contract_id).first()
        if c:
            contract_title = c.title

    return {
        "success": True,
        "data": {
            "id": job.id,
            "filename": job.filename,
            "status": job.status,
            "contract_id": job.contract_id,
            "contract_title": contract_title,
            "document_type": job.document_type,
            "is_draft": job.is_draft,
            "is_main_document": job.is_main_document,
            "page_count": job.page_count,
            "ocr_engine": job.ocr_engine,
            "ocr_error": job.ocr_error,
            "llm_error": job.llm_error,
            "extracted_text": job.extracted_text,
            "extracted_data": job.extracted_data,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        },
    }


@router.post("/jobs/{job_id}/rerun")
def rerun_document_job(
    job_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Requeue a failed job. Only allowed when status=failed."""
    from app.models.document_job import DocumentProcessingJob
    from app.tasks.document import process_document_upload_job
    from fastapi import HTTPException

    job = db.query(DocumentProcessingJob).filter(DocumentProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if job.status != "failed":
        raise HTTPException(status_code=400, detail=f"Job is not failed (status={job.status})")

    job.status = "pending"
    job.ocr_error = None
    job.llm_error = None
    job.completed_at = None
    db.commit()

    task = process_document_upload_job.delay(job_id)
    job.celery_task_id = task.id
    db.commit()

    return {"success": True, "data": {"job_id": job_id, "status": "pending"}}


@router.get("/jobs/{job_id}/raw-text")
def get_job_raw_text(
    job_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Return the stored OCR extracted_text for a job."""
    from app.models.document_job import DocumentProcessingJob
    from fastapi import HTTPException

    job = db.query(DocumentProcessingJob).filter(DocumentProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    return {
        "success": True,
        "data": {
            "job_id": job_id,
            "extracted_text": job.extracted_text or "",
            "char_count": len(job.extracted_text or ""),
            "ocr_engine": job.ocr_engine,
        },
    }


class ReExtractRequest(BaseModel):
    custom_prompt: Optional[str] = None
    llm_provider_id: Optional[str] = None


@router.post("/jobs/{job_id}/re-extract")
async def re_extract_job(
    job_id: str,
    request: ReExtractRequest = ReExtractRequest(),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Re-run LLM extraction using SLIDING WINDOW on stored OCR text.
    Splits text into pages, processes pairs (p1+p2, p2+p3, ...) and merges results.
    Does NOT rerun OCR.
    """
    from app.models.document_job import DocumentProcessingJob
    from fastapi import HTTPException

    job = db.query(DocumentProcessingJob).filter(DocumentProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not job.extracted_text:
        raise HTTPException(status_code=400, detail="ไม่มีข้อความ OCR ที่เก็บไว้ กรุณา rerun OCR ก่อน")

    text = job.extracted_text

    # ── Split into pages ──────────────────────────────────────
    # Try form-feed character first (PDF page break), then ~800-char chunks
    if '\f' in text:
        raw_pages = [p for p in text.split('\f') if p.strip()]
    else:
        chunk_size = 800
        raw_pages = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]

    # Deduplicate tiny trailing chunks
    pages = [p for p in raw_pages if len(p.strip()) > 30] or [text]

    logger.info(f"re-extract sliding window: job={job_id}, pages={len(pages)}")

    # ── Sliding window: pairs (0-1), (1-2), (2-3) … ─────────
    merged: dict = {}
    for i in range(max(1, len(pages))):
        # Window = page i-1 + page i  (first window is just page 0)
        if i == 0:
            chunk = pages[0]
        else:
            chunk = pages[i - 1] + "\n" + pages[i]

        try:
            result = await _llm_extract_for_document(
                db=db,
                user_id=user_id,
                llm_provider_id=request.llm_provider_id,
                ocr_text=chunk[:4000],     # guard: _llm already truncates but be explicit
                custom_prompt=request.custom_prompt,
            )
            # Merge: later windows fill in any field still empty
            for k, v in result.items():
                if v and not merged.get(k):
                    merged[k] = v
            logger.info(f"  window {i}: extracted {list(result.keys())}")
        except Exception as win_err:
            logger.warning(f"  window {i} failed: {win_err}")
            continue  # skip bad windows, keep going

    try:
        job.extracted_data = merged
        job.llm_error = None
        db.commit()
    except Exception as db_err:
        logger.error(f"re-extract DB commit failed: {db_err}")

    return {
        "success": True,
        "data": {
            "extracted_data": merged,
            "windows_processed": len(pages),
            "fields_extracted": list(merged.keys()),
        },
    }



@router.delete("/jobs/{job_id}")
def delete_document_job(
    job_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Delete a job record. Not allowed while status=processing.
    Does NOT delete the file from MinIO (it may still be needed).
    """
    from app.models.document_job import DocumentProcessingJob
    from fastapi import HTTPException

    job = db.query(DocumentProcessingJob).filter(DocumentProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if job.status == "processing":
        raise HTTPException(
            status_code=400,
            detail="ไม่สามารถลบงานที่กำลังประมวลผลอยู่ได้"
        )

    db.delete(job)
    db.commit()

    return {"success": True, "message": "ลบงานสำเร็จ", "data": {"job_id": job_id}}


class JobConfirmRequest(BaseModel):
    extracted_data: Optional[dict] = None
    contract_id: Optional[str] = None
    document_type: str = "contract"
    is_draft: bool = True
    is_main_document: bool = False


@router.post("/jobs/{job_id}/confirm")
async def confirm_document_job(
    job_id: str,
    request: JobConfirmRequest,
    user_id: str = Depends(get_current_user_id),
    user_payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """
    Confirm a completed job: creates ContractAttachment, updates contract,
    queues RAG + GraphRAG.
    """
    from app.models.document_job import DocumentProcessingJob
    from app.models.contract import ContractAttachment, Contract
    from fastapi import HTTPException

    job = db.query(DocumentProcessingJob).filter(DocumentProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if job.status != "completed":
        raise HTTPException(status_code=400, detail=f"Job is not completed (status={job.status})")

    tenant_id = user_payload.get("tenant_id", "default")
    filename = job.filename
    mime = job.mime_type or "application/octet-stream"
    ext = filename.split(".")[-1].lower() if "." in filename else ""

    if "pdf" in mime:
        file_type = "pdf"
    elif "image" in mime:
        file_type = "image"
    elif "word" in mime or ext in ("doc", "docx"):
        file_type = "word"
    else:
        file_type = "other"

    extracted_data = request.extracted_data or job.extracted_data or {}
    contract_id = request.contract_id or job.contract_id

    doc_id = str(uuid.uuid4())
    doc = ContractAttachment(
        id=doc_id,
        tenant_id=tenant_id,
        contract_id=contract_id,
        filename=filename,
        original_filename=filename,
        file_size=job.file_size or 0,
        file_type=file_type,
        mime_type=mime,
        extension=ext,
        storage_path=job.storage_path,
        storage_bucket=job.storage_bucket,
        document_type=request.document_type,
        status="ocr_completed",
        ocr_status="completed",
        extracted_text=job.extracted_text or "",
        extracted_data=extracted_data,
        is_draft=request.is_draft,
        is_main_document=request.is_main_document,
        uploaded_by=user_id,
        uploaded_at=datetime.utcnow(),
        is_deleted=0,
    )

    # Populate structured extraction fields for GraphRAG
    if extracted_data:
        d = extracted_data
        if d.get("contract_number"):
            doc.extracted_contract_number = d["contract_number"]
        if d.get("contract_value"):
            try:
                doc.extracted_contract_value = float(d["contract_value"])
            except (TypeError, ValueError):
                pass
        if d.get("start_date"):
            try:
                from datetime import date as _date
                doc.extracted_start_date = _date.fromisoformat(str(d["start_date"]))
            except (TypeError, ValueError):
                pass
        if d.get("end_date"):
            try:
                from datetime import date as _date
                doc.extracted_end_date = _date.fromisoformat(str(d["end_date"]))
            except (TypeError, ValueError):
                pass

    db.add(doc)

    # Update linked contract with extracted data
    if contract_id and extracted_data:
        contract = db.query(Contract).filter(Contract.id == contract_id).first()
        if contract:
            d = extracted_data
            if d.get("contract_number") and (
                not contract.contract_no or contract.contract_no.startswith("CON-")
            ):
                contract.contract_no = d["contract_number"]
            if d.get("title") and (
                not contract.title or "สัญญาใหม่" in (contract.title or "")
            ):
                contract.title = d["title"]
            if d.get("counterparty") and not contract.vendor_name:
                contract.vendor_name = d["counterparty"]
            if d.get("contract_value"):
                try:
                    contract.value_original = float(d["contract_value"])
                except (TypeError, ValueError):
                    pass
            if d.get("start_date"):
                try:
                    from datetime import date as _date
                    contract.start_date = _date.fromisoformat(str(d["start_date"]))
                except (TypeError, ValueError):
                    pass
            if d.get("end_date"):
                try:
                    from datetime import date as _date
                    contract.end_date = _date.fromisoformat(str(d["end_date"]))
                except (TypeError, ValueError):
                    pass
            if d.get("project_name") and not contract.project_name:
                contract.project_name = d["project_name"]

    db.commit()
    db.refresh(doc)

    # Queue background tasks
    try:
        from app.tasks.document import process_contract_rag_indexing, process_graphrag_extraction
        process_contract_rag_indexing.delay(doc_id, tenant_id)
        process_graphrag_extraction.delay(doc_id, tenant_id)
        logger.info(f"Queued RAG + GraphRAG for document {doc_id} from job {job_id}")
    except Exception as e:
        logger.warning(f"Failed to queue background tasks: {e}")

    return {
        "success": True,
        "message": "บันทึกเอกสารสำเร็จ",
        "data": {
            "id": doc_id,
            "filename": doc.filename,
            "document_type": doc.document_type,
            "contract_id": doc.contract_id,
            "ocr_status": "completed",
            "is_draft": doc.is_draft,
            "is_main_document": doc.is_main_document,
        },
    }


@router.get("/search/content")
async def search_documents_content(
    q: str = Query(..., description="Search query"),
    highlight: bool = Query(True, description="Highlight matching text"),
    limit: int = Query(10, ge=1, le=50),
    doc_service: DocumentService = Depends(get_doc_service)
):
    """
    Search in document content (OCR text)
    
    Searches through extracted text from OCR processing.
    Returns matching document snippets with presigned URLs.
    """
    try:
        results = doc_service.search_content(
            query=q,
            highlight=highlight,
            limit=limit
        )
        return {
            "success": True,
            "query": q,
            "results": results,
            "total": len(results)
        }
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: str,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """Get document by ID with download URL"""
    document = doc_service.get_document(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Generate presigned URL for download
    if document.storage_path:
        from app.services.storage.minio_service import get_storage_service
        storage = get_storage_service()
        document.download_url = storage.get_presigned_url(
            document.storage_path,
            expires=604800  # 7 days
        )
    
    return document


@router.get("/contract/{contract_id}", response_model=List[DocumentResponse])
def get_contract_documents(
    contract_id: str,
    doc_type: Optional[str] = None,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """Get all documents for a contract"""
    documents = doc_service.get_contract_documents(contract_id, doc_type)
    
    # Generate presigned URLs
    from app.services.storage.minio_service import get_storage_service
    storage = get_storage_service()
    
    for doc in documents:
        if doc.storage_path:
            doc.download_url = storage.get_presigned_url(
                doc.storage_path,
                expires=604800  # 7 days
            )
    
    return documents


@router.get("/vendor/{vendor_id}", response_model=List[DocumentResponse])
def get_vendor_documents(
    vendor_id: str,
    doc_type: Optional[str] = None,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """Get all documents for a vendor"""
    documents = doc_service.get_vendor_documents(vendor_id, doc_type)
    
    # Generate presigned URLs
    from app.services.storage.minio_service import get_storage_service
    storage = get_storage_service()
    
    for doc in documents:
        if doc.storage_path:
            doc.download_url = storage.get_presigned_url(
                doc.storage_path,
                expires=604800  # 7 days
            )
    
    return documents


@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """Get download URL for document"""
    document = doc_service.get_document(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if not document.storage_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document has no file"
        )
    
    # Generate presigned URL
    from app.services.storage.minio_service import get_storage_service
    storage = get_storage_service()
    download_url = storage.get_presigned_url(
        document.storage_path,
        expires=604800  # 7 days
    )
    
    return {
        "success": True,
        "download_url": download_url,
        "filename": document.filename,
        "expires_in": 604800
    }


@router.get("/{document_id}/view")
def view_document(
    document_id: str,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """
    Stream document content for viewing (PDF viewer)
    
    This endpoint proxies the file from MinIO through the backend,
    avoiding signature mismatch issues with presigned URLs.
    Supports PDF and other document types.
    """
    document = doc_service.get_document(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if not document.storage_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document has no file"
        )
    
    # Stream file from MinIO
    from app.services.storage.minio_service import get_storage_service
    storage = get_storage_service()
    
    try:
        response = storage.get_file_stream(document.storage_path)
        
        # Determine content type
        content_type = document.mime_type or "application/octet-stream"
        
        # Build Content-Disposition header with RFC 5987 encoding for UTF-8 filenames
        # Use both filename (ASCII fallback) and filename* (UTF-8) for compatibility
        from urllib.parse import quote
        encoded_filename = quote(document.filename.encode('utf-8'), safe='')
        # Use simple ASCII filename for the filename parameter (browsers will use filename* if available)
        ascii_filename = document.filename.encode('ascii', 'ignore').decode() or 'document'
        content_disposition = f"inline; filename=\"{ascii_filename}\"; filename*=UTF-8''{encoded_filename}"
        
        # For PDF files, set inline disposition for browser viewing
        if document.extension and document.extension.lower() == "pdf":
            return StreamingResponse(
                response,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": content_disposition
                }
            )
        else:
            # For other files, detect from extension
            return StreamingResponse(
                response,
                media_type=content_type,
                headers={
                    "Content-Disposition": content_disposition
                }
            )
            
    except Exception as e:
        logger.error(f"Failed to stream document: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve document: {str(e)}"
        )


@router.patch("/{document_id}", response_model=DocumentResponse)
def update_document(
    document_id: str,
    update_data: DocumentUpdate,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """Update document metadata"""
    document = doc_service.update_document(document_id, update_data)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    return document


@router.patch("/{document_id}/extracted-data", response_model=DocumentResponse)
def update_document_extracted_data(
    document_id: str,
    data: DocumentExtractedDataUpdate,
    doc_service: DocumentService = Depends(get_doc_service),
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Update extracted data from OCR
    
    Allows manual correction of OCR-extracted fields:
    - contract_number: เลขที่สัญญา
    - counterparty: คู่สัญญา
    - contract_type: ประเภทสัญญา
    - contract_value: มูลค่า
    - project_name: ชื่อโครงการ
    - start_date: วันที่เริ่มต้น
    - end_date: วันที่สิ้นสุด
    - duration_months: ระยะเวลา (เดือน)
    """
    from app.models.contract import ContractAttachment
    
    document = db.query(ContractAttachment).filter(
        ContractAttachment.id == document_id,
        ContractAttachment.is_deleted == 0
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Update extracted_data field with new values
    if document.extracted_data is None:
        document.extracted_data = {}
    
    # Update only provided fields
    update_dict = data.model_dump(exclude_unset=True, exclude_none=True)
    document.extracted_data.update(update_dict)
    
    # Also update the individual columns for easier querying
    if data.contract_number:
        document.extracted_contract_number = data.contract_number
    if data.contract_value:
        document.extracted_contract_value = data.contract_value
    if data.start_date:
        document.extracted_start_date = data.start_date
    if data.end_date:
        document.extracted_end_date = data.end_date
    if data.counterparty:
        # Store in extracted_data only, no dedicated column
        pass
    if data.contract_type:
        # Store in extracted_data only, no dedicated column
        pass
    if data.project_name:
        # Store in extracted_data only, no dedicated column
        pass
    if data.duration_months:
        # Store in extracted_data only, no dedicated column
        pass
    
    db.commit()
    db.refresh(document)
    
    logger.info(f"Updated extracted data for document {document_id} by {user_payload.get('sub')}")
    
    return document


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    doc_service: DocumentService = Depends(get_doc_service),
    db: Session = Depends(get_db),
):
    """Delete document — removes from DB, RAG vector store, and MinIO storage."""
    from app.services.ai.rag_service import RAGService

    # 1. Fetch document before deleting (need storage_path)
    document = doc_service.get_document(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    storage_path = getattr(document, "storage_path", None)

    # 2. Remove from RAG vector store (all KBs)
    try:
        rag = RAGService(db)
        removed = await rag.remove_document(document_id)
        logger.info(f"RAG cleanup for doc {document_id}: removed={removed}")
    except Exception as rag_err:
        logger.warning(f"RAG cleanup failed for doc {document_id}: {rag_err}")

    # 3. Delete from MinIO (best-effort, non-blocking)
    if storage_path:
        try:
            from app.services.storage.minio_service import get_storage_service
            storage = get_storage_service()
            storage.delete_file(storage_path)
            logger.info(f"MinIO file deleted: {storage_path}")
        except Exception as minio_err:
            logger.warning(f"MinIO delete failed for {storage_path}: {minio_err}")

    # 4. Delete from DB
    success = doc_service.delete_document(document_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    return {"success": True, "message": "Document deleted (DB + RAG + storage)"}


@router.get("/{document_id}/ocr-status")
def get_ocr_status(
    document_id: str,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """Get OCR processing status"""
    document = doc_service.get_document(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Build human-readable label for the currently configured OCR engine
    try:
        ocr_svc = get_ocr_settings_service(doc_service.db, doc_service.user_id)
        s = ocr_svc.get_settings()
        mode = s.get("mode", "default")
        if mode == "typhoon":
            model = s.get("typhoon_model", "typhoon-ocr")
            active_ocr_engine = f"Typhoon OCR ({model})"
        elif mode == "custom":
            model = s.get("custom_api_model", "")
            active_ocr_engine = f"Custom API ({model})" if model else "Custom API"
        else:
            active_ocr_engine = "Tesseract / pdfplumber"
    except Exception:
        active_ocr_engine = "Tesseract / pdfplumber"

    response = {
        "document_id": document_id,
        "ocr_status": document.ocr_status,
        "ocr_confidence": document.ocr_confidence,
        "ocr_error": document.ocr_error,
        "ocr_engine": document.ocr_engine or active_ocr_engine,
        "active_ocr_engine": active_ocr_engine,
        "extracted_text_length": len(document.extracted_text) if document.extracted_text else 0,
        "has_extracted_data": document.extracted_data is not None
    }

    # Include extracted_data when OCR is completed
    if document.ocr_status == "completed":
        if document.extracted_data:
            response["extracted_data"] = document.extracted_data
        if document.extracted_text:
            response["extracted_text"] = document.extracted_text

    return response


@router.post("/{document_id}/reprocess-ocr")
def reprocess_ocr(
    document_id: str,
    background_tasks: BackgroundTasks,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """Re-run OCR on document"""
    from app.tasks.document import process_document_ocr
    
    document = doc_service.get_document(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Reset OCR status
    document.ocr_status = "pending"
    document.ocr_error = None
    doc_service.db.commit()
    
    # Queue OCR task
    task = process_document_ocr.delay(document_id, doc_service.tenant_id)
    
    return {
        "success": True,
        "message": "OCR reprocessing queued",
        "task_id": task.id
    }


@router.post("/{document_id}/verify")
def verify_document(
    document_id: str,
    verify_data: DocumentVerifyRequest,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """Verify extracted OCR data"""
    document = doc_service.verify_document(document_id, verify_data)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    return document


@router.post("/{document_id}/rebuild-graph")
def rebuild_document_graph(
    document_id: str,
    doc_service: DocumentService = Depends(get_doc_service),
    db: Session = Depends(get_db)
):
    """
    Rebuild GraphRAG for a document
    
    Re-extracts entities and relationships from document's OCR text.
    Useful when auto-graph creation was disabled during upload.
    """
    from app.tasks.document import process_graphrag_extraction
    from app.models.contract import ContractAttachment
    
    document = db.query(ContractAttachment).filter(
        ContractAttachment.id == document_id,
        ContractAttachment.is_deleted == 0
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if document.ocr_status != "completed":
        raise HTTPException(
            status_code=400, 
            detail="Document OCR not completed. Please wait for OCR to finish."
        )
    
    # Queue GraphRAG rebuild
    process_graphrag_extraction.delay(document_id, doc_service.tenant_id)
    
    return {
        "success": True,
        "message": "GraphRAG rebuild queued",
        "document_id": document_id
    }


@router.get("", response_model=DocumentListResponse)
def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    document_type: Optional[str] = None,
    ocr_status: Optional[str] = None,
    doc_service: DocumentService = Depends(get_doc_service)
):
    """List documents with pagination"""
    result = doc_service.list_documents(
        page=page,
        page_size=page_size,
        document_type=document_type,
        status=ocr_status
    )

    return {
        "items": result["items"],
        "total": result["total"],
        "page": result["page"],
        "pages": result["pages"]
    }
