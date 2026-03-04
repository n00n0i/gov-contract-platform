#!/usr/bin/env python3
"""
Migration 009 — Create document_ocr_pages table + add OCR concurrency cols.
Run inside container: docker exec gcp-backend python /app/migrations/009_document_ocr_pages.py
"""
import sys
sys.path.insert(0, '/app')

from app.db.database import engine
from sqlalchemy import text, inspect

def column_exists(conn, table, column):
    try:
        result = conn.execute(text(
            f"SELECT column_name FROM information_schema.columns "
            f"WHERE table_name='{table}' AND column_name='{column}'"
        ))
        return result.fetchone() is not None
    except Exception:
        return False

print("=== Migration 009: document_ocr_pages ===")

with engine.connect() as conn:
    # ── 1. Create document_ocr_pages ────────────────────────────────────────
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS document_ocr_pages (
            id                  VARCHAR(36) PRIMARY KEY,
            job_id              VARCHAR(36) NOT NULL
                                REFERENCES document_processing_jobs(id)
                                ON DELETE CASCADE,
            page_number         INTEGER NOT NULL,

            status              VARCHAR(20) NOT NULL DEFAULT 'pending',

            raw_text            TEXT,
            confidence          FLOAT,
            word_count          INTEGER,
            char_count          INTEGER,
            ocr_engine          VARCHAR(100),

            error               TEXT,
            attempts            INTEGER NOT NULL DEFAULT 0,

            has_selectable_text BOOLEAN DEFAULT FALSE,
            image_hash          VARCHAR(64),

            created_at          TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
            updated_at          TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
            completed_at        TIMESTAMP WITHOUT TIME ZONE,

            UNIQUE (job_id, page_number)
        )
    """))
    print("  ✓ table document_ocr_pages created (or already exists)")

    # Indexes
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_ocr_pages_job_id
        ON document_ocr_pages (job_id)
    """))
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_ocr_pages_status
        ON document_ocr_pages (status)
    """))
    print("  ✓ indexes created")

    # ── 2. Add columns to document_processing_jobs ───────────────────────────
    if not column_exists(conn, "document_processing_jobs", "ocr_concurrent"):
        conn.execute(text("""
            ALTER TABLE document_processing_jobs
            ADD COLUMN ocr_concurrent INTEGER NOT NULL DEFAULT 2
        """))
        print("  ✓ column ocr_concurrent added")
    else:
        print("  ⊘ column ocr_concurrent already exists")

    if not column_exists(conn, "document_processing_jobs", "ocr_max_pages_per_worker"):
        conn.execute(text("""
            ALTER TABLE document_processing_jobs
            ADD COLUMN ocr_max_pages_per_worker INTEGER NOT NULL DEFAULT 5
        """))
        print("  ✓ column ocr_max_pages_per_worker added")
    else:
        print("  ⊘ column ocr_max_pages_per_worker already exists")

    conn.commit()

print("=== Migration 009 complete ✓ ===")
