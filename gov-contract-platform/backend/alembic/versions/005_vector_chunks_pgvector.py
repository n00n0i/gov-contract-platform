"""Add vector_chunks table for RAG with pgvector

Revision ID: 005
Revises: 004
Create Date: 2026-02-26 00:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Create vector_chunks table
    op.execute("""
        CREATE TABLE IF NOT EXISTS vector_chunks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            kb_id VARCHAR(36) NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
            document_id VARCHAR(255) NOT NULL,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            embedding vector(768),
            source_doc VARCHAR(255),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            UNIQUE (kb_id, document_id, chunk_index)
        )
    """)

    # Index for fast vector similarity search
    op.execute("""
        CREATE INDEX IF NOT EXISTS vector_chunks_embedding_idx
        ON vector_chunks USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
    """)

    # Index for filtering by kb_id
    op.execute("""
        CREATE INDEX IF NOT EXISTS vector_chunks_kb_id_idx
        ON vector_chunks (kb_id)
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS vector_chunks")
