"""
DocumentOCRPage — per-page OCR result record
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Boolean, Float, DateTime, Text, ForeignKey
)
from app.models.base import Base


class DocumentOCRPage(Base):
    """Stores OCR result for a single page of a document.

    Lifecycle:
        pending   → processing → completed
                              ↘ failed (retried up to max_attempts)
    """
    __tablename__ = "document_ocr_pages"

    id          = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id      = Column(String(36), ForeignKey("document_processing_jobs.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    page_number = Column(Integer, nullable=False)          # 1-based

    # ── Status ────────────────────────────────────────────────────────────────
    # pending | processing | completed | failed | skipped
    status      = Column(String(20), nullable=False, default="pending", index=True)

    # ── OCR output ────────────────────────────────────────────────────────────
    raw_text    = Column(Text, nullable=True)
    confidence  = Column(Float, nullable=True)             # 0.0 – 1.0
    word_count  = Column(Integer, nullable=True)
    char_count  = Column(Integer, nullable=True)
    ocr_engine  = Column(String(100), nullable=True)       # pdfplumber | typhoon | ollama | tesseract

    # ── Error / Retry ─────────────────────────────────────────────────────────
    error       = Column(Text, nullable=True)
    attempts    = Column(Integer, nullable=False, default=0)

    # ── Page metadata ─────────────────────────────────────────────────────────
    has_selectable_text = Column(Boolean, default=False)   # PDF native text layer exists
    image_hash  = Column(String(64), nullable=True)        # SHA-256 of page image for dedup

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
