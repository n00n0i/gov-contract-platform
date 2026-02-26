"""Add execution statistics columns to agent_triggers

Revision ID: 006
Revises: 005
Create Date: 2026-02-26 00:00:00

"""
from alembic import op
import sqlalchemy as sa

revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade():
    # Add execution statistics columns to agent_triggers table
    op.add_column('agent_triggers', sa.Column('execution_count', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('agent_triggers', sa.Column('last_executed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('agent_triggers', sa.Column('last_error', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('agent_triggers', 'last_error')
    op.drop_column('agent_triggers', 'last_executed_at')
    op.drop_column('agent_triggers', 'execution_count')
