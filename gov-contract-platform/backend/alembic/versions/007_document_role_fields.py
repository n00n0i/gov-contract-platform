"""Add is_draft and is_main_document to contract_attachments

Revision ID: 007
Revises: 006
Create Date: 2026-02-28 00:00:00

"""
from alembic import op
import sqlalchemy as sa

revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('contract_attachments',
        sa.Column('is_draft', sa.Boolean(), nullable=True, server_default='true'))
    op.add_column('contract_attachments',
        sa.Column('is_main_document', sa.Boolean(), nullable=True, server_default='false'))


def downgrade():
    op.drop_column('contract_attachments', 'is_main_document')
    op.drop_column('contract_attachments', 'is_draft')
