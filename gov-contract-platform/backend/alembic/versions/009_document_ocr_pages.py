"""009_document_ocr_pages — add per-page OCR tracking table and job OCR config columns"""
from alembic import op
import sqlalchemy as sa


revision  = "009"
down_revision = "008"
branch_labels = None
depends_on    = None


def upgrade():
    # ── New table: document_ocr_pages ────────────────────────────────────────
    op.create_table(
        "document_ocr_pages",
        sa.Column("id",           sa.String(36),  primary_key=True),
        sa.Column("job_id",       sa.String(36),  sa.ForeignKey("document_processing_jobs.id",
                                                  ondelete="CASCADE"), nullable=False),
        sa.Column("page_number",  sa.Integer(),   nullable=False),

        # status
        sa.Column("status",       sa.String(20),  nullable=False, server_default="pending"),

        # OCR output
        sa.Column("raw_text",     sa.Text(),      nullable=True),
        sa.Column("confidence",   sa.Float(),     nullable=True),
        sa.Column("word_count",   sa.Integer(),   nullable=True),
        sa.Column("char_count",   sa.Integer(),   nullable=True),
        sa.Column("ocr_engine",   sa.String(100), nullable=True),

        # error / retry
        sa.Column("error",        sa.Text(),      nullable=True),
        sa.Column("attempts",     sa.Integer(),   nullable=False, server_default="0"),

        # page metadata
        sa.Column("has_selectable_text", sa.Boolean(), server_default="false"),
        sa.Column("image_hash",   sa.String(64),  nullable=True),

        # timestamps
        sa.Column("created_at",   sa.DateTime(),  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",   sa.DateTime(),  server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(),  nullable=True),
    )

    # Indexes
    op.create_index("ix_ocr_pages_job_id", "document_ocr_pages", ["job_id"])
    op.create_index("ix_ocr_pages_status",  "document_ocr_pages", ["status"])
    op.create_unique_constraint("uq_ocr_pages_job_page",
                                "document_ocr_pages", ["job_id", "page_number"])

    # ── Extend document_processing_jobs ──────────────────────────────────────
    op.add_column("document_processing_jobs",
        sa.Column("ocr_concurrent", sa.Integer(), server_default="2", nullable=False))
    op.add_column("document_processing_jobs",
        sa.Column("ocr_max_pages_per_worker", sa.Integer(), server_default="5", nullable=False))


def downgrade():
    op.drop_column("document_processing_jobs", "ocr_max_pages_per_worker")
    op.drop_column("document_processing_jobs", "ocr_concurrent")
    op.drop_constraint("uq_ocr_pages_job_page", "document_ocr_pages", type_="unique")
    op.drop_index("ix_ocr_pages_status",  "document_ocr_pages")
    op.drop_index("ix_ocr_pages_job_id",  "document_ocr_pages")
    op.drop_table("document_ocr_pages")
