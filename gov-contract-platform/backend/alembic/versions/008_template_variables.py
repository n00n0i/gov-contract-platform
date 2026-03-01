"""Add variables and conditional_groups to contract_templates

Revision ID: 008
Revises: 007
Create Date: 2026-02-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade():
    # Add variable definitions and conditional groups to templates
    op.add_column('contract_templates',
        sa.Column('variables', JSONB, nullable=True, server_default='[]'))
    op.add_column('contract_templates',
        sa.Column('conditional_groups', JSONB, nullable=True, server_default='[]'))
    op.add_column('contract_templates',
        sa.Column('raw_content', sa.Text, nullable=True))

    # Add optional/condition support to clauses
    op.add_column('contract_template_clauses',
        sa.Column('optional', sa.Boolean, nullable=True, server_default='false'))
    op.add_column('contract_template_clauses',
        sa.Column('condition_key', sa.String(100), nullable=True))
    op.add_column('contract_template_clauses',
        sa.Column('condition_value', sa.String(100), nullable=True))
    op.add_column('contract_template_clauses',
        sa.Column('content_template', sa.Text, nullable=True))


def downgrade():
    op.drop_column('contract_templates', 'variables')
    op.drop_column('contract_templates', 'conditional_groups')
    op.drop_column('contract_templates', 'raw_content')
    op.drop_column('contract_template_clauses', 'optional')
    op.drop_column('contract_template_clauses', 'condition_key')
    op.drop_column('contract_template_clauses', 'condition_value')
    op.drop_column('contract_template_clauses', 'content_template')
