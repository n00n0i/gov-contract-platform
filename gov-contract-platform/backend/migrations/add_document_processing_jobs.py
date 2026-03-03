#!/usr/bin/env python3
"""
Migration: Create document_processing_jobs table for async upload job tracking
"""
import sys
sys.path.insert(0, '/app')

from sqlalchemy import create_engine, text
from app.core.config import settings


def migrate():
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        exists = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'document_processing_jobs'
            )
        """)).scalar()

        if exists:
            print("document_processing_jobs table already exists — skipping")
            return

        print("Creating document_processing_jobs table...")
        conn.execute(text("""
            CREATE TABLE document_processing_jobs (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id),
                contract_id VARCHAR(36) REFERENCES contracts(id) ON DELETE SET NULL,
                filename VARCHAR(255) NOT NULL,
                storage_path VARCHAR(500) NOT NULL,
                storage_bucket VARCHAR(100) NOT NULL DEFAULT 'govplatform',
                mime_type VARCHAR(100),
                file_size INTEGER,
                document_type VARCHAR(50) NOT NULL DEFAULT 'contract',
                is_draft BOOLEAN NOT NULL DEFAULT TRUE,
                is_main_document BOOLEAN NOT NULL DEFAULT FALSE,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                celery_task_id VARCHAR(255),
                extracted_text TEXT,
                extracted_data JSONB,
                page_count INTEGER,
                ocr_engine VARCHAR(100),
                ocr_error TEXT,
                llm_error TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP,
                completed_at TIMESTAMP
            )
        """))

        conn.execute(text("CREATE INDEX idx_dpj_user_id ON document_processing_jobs(user_id)"))
        conn.execute(text("CREATE INDEX idx_dpj_status ON document_processing_jobs(status)"))
        conn.execute(text("CREATE INDEX idx_dpj_contract_id ON document_processing_jobs(contract_id)"))
        conn.execute(text("CREATE INDEX idx_dpj_created_at ON document_processing_jobs(created_at DESC)"))
        conn.commit()
        print("document_processing_jobs table created successfully")


if __name__ == "__main__":
    migrate()
