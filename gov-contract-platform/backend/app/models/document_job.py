"""
DocumentProcessingJob - tracks async document upload/OCR/extraction jobs
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB

from app.models.base import Base


class DocumentProcessingJob(Base):
    __tablename__ = "document_processing_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    contract_id = Column(String(36), ForeignKey("contracts.id"), nullable=True, index=True)

    filename = Column(String(255), nullable=False)
    storage_path = Column(String(500), nullable=False)
    storage_bucket = Column(String(100), default="govplatform", nullable=False)
    mime_type = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=True)

    document_type = Column(String(50), default="contract", nullable=False)
    is_draft = Column(Boolean, default=True)
    is_main_document = Column(Boolean, default=False)

    # LLM config chosen at upload time
    llm_provider_id = Column(String(36), nullable=True)   # AIProvider.id
    extraction_prompt = Column(Text, nullable=True)        # custom system prompt

    # MinIO path for cached OCR raw text (.txt)
    ocr_text_path = Column(String(500), nullable=True)

    # pending / processing / completed / failed
    status = Column(String(50), default="pending", nullable=False, index=True)
    celery_task_id = Column(String(255), nullable=True)

    extracted_text = Column(Text, nullable=True)
    extracted_data = Column(JSONB, nullable=True)
    page_count = Column(Integer, nullable=True)
    ocr_engine = Column(String(100), nullable=True)
    ocr_error = Column(Text, nullable=True)
    llm_error = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
