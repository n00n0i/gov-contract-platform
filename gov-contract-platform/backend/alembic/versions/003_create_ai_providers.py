"""Create AI providers and update agent tables

Revision ID: 003
Revises: 002
Create Date: 2025-02-25 14:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade():
    # Create ai_providers table
    op.create_table(
        'ai_providers',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('provider_type', sa.String(50), nullable=False),  # ollama, openai, gemini, etc.
        sa.Column('model', sa.String(100), nullable=False),
        sa.Column('api_url', sa.String(500)),
        sa.Column('api_key', sa.String(500)),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_default', sa.Boolean(), default=False),
        sa.Column('capabilities', postgresql.JSONB(), default=list),  # ["chat", "embedding"]
        sa.Column('config', postgresql.JSONB(), default=dict),  # extra config
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Create index for faster lookups
    op.create_index('idx_ai_providers_user_id', 'ai_providers', ['user_id'])
    op.create_index('idx_ai_providers_user_default', 'ai_providers', ['user_id', 'is_default'])
    
    # Add active_provider_id to users table for default provider
    op.add_column('users', sa.Column('active_llm_provider_id', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('active_embedding_provider_id', sa.String(50), nullable=True))
    
    # Create foreign key (optional - can be null)
    op.create_foreign_key(
        'fk_users_active_llm_provider',
        'users', 'ai_providers',
        ['active_llm_provider_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_foreign_key(
        'fk_users_active_embedding_provider',
        'users', 'ai_providers',
        ['active_embedding_provider_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Update ai_agents table - rename model to provider_id
    op.add_column('ai_agents', sa.Column('provider_id', sa.String(50), nullable=True))
    op.create_foreign_key(
        'fk_ai_agents_provider',
        'ai_agents', 'ai_providers',
        ['provider_id'], ['id'],
        ondelete='SET NULL'
    )
    # Drop old model column (data will be lost - migration note)
    op.drop_column('ai_agents', 'model')


def downgrade():
    # Reverse changes
    op.add_column('ai_agents', sa.Column('model', sa.String(100), default='local'))
    op.drop_constraint('fk_ai_agents_provider', 'ai_agents', type_='foreignkey')
    op.drop_column('ai_agents', 'provider_id')
    
    op.drop_constraint('fk_users_active_embedding_provider', 'users', type_='foreignkey')
    op.drop_constraint('fk_users_active_llm_provider', 'users', type_='foreignkey')
    op.drop_column('users', 'active_embedding_provider_id')
    op.drop_column('users', 'active_llm_provider_id')
    op.drop_index('idx_ai_providers_user_default', table_name='ai_providers')
    op.drop_index('idx_ai_providers_user_id', table_name='ai_providers')
    op.drop_table('ai_providers')
