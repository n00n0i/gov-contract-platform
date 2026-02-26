"""Create access control tables

Revision ID: 004
Revises: 003
Create Date: 2025-02-26 01:30:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    # Access policies
    op.create_table(
        'access_policies',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('role_id', sa.String(36), sa.ForeignKey('roles.id'), nullable=False),
        sa.Column('resource_type', sa.Enum('contract', 'document', 'knowledge_base', 'agent', 
                                           'template', 'user', 'organization', 'report', 'system',
                                           name='resourcetype'), nullable=False),
        sa.Column('resource_id', sa.String(36), nullable=True),
        sa.Column('can_view', sa.Boolean(), default=False),
        sa.Column('can_create', sa.Boolean(), default=False),
        sa.Column('can_edit', sa.Boolean(), default=False),
        sa.Column('can_delete', sa.Boolean(), default=False),
        sa.Column('can_approve', sa.Boolean(), default=False),
        sa.Column('can_share', sa.Boolean(), default=False),
        sa.Column('can_manage', sa.Boolean(), default=False),
        sa.Column('scope', sa.Enum('global', 'org', 'dept', 'div', 'unit', 'own',
                                    name='permissionscope'), default='own'),
        sa.Column('conditions', postgresql.JSONB(), default=dict),
        sa.Column('valid_from', sa.DateTime(timezone=True)),
        sa.Column('valid_until', sa.DateTime(timezone=True)),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # KB Organization Access
    op.create_table(
        'kb_org_access',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('knowledge_base_id', sa.String(36), sa.ForeignKey('knowledge_bases.id'), nullable=False),
        sa.Column('org_unit_id', sa.String(36), sa.ForeignKey('organization_units.id'), nullable=False),
        sa.Column('can_read', sa.Boolean(), default=True),
        sa.Column('can_contribute', sa.Boolean(), default=False),
        sa.Column('can_manage', sa.Boolean(), default=False),
        sa.Column('inherit_to_children', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # KB User Access
    op.create_table(
        'kb_user_access',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('knowledge_base_id', sa.String(36), sa.ForeignKey('knowledge_bases.id'), nullable=False),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('can_read', sa.Boolean(), default=True),
        sa.Column('can_contribute', sa.Boolean(), default=False),
        sa.Column('can_manage', sa.Boolean(), default=False),
        sa.Column('granted_by', sa.String(36), sa.ForeignKey('users.id')),
        sa.Column('granted_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    # Contract Visibility
    op.create_table(
        'contract_visibility',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('contract_id', sa.String(36), sa.ForeignKey('contracts.id'), nullable=False),
        sa.Column('owner_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('owner_org_id', sa.String(36), sa.ForeignKey('organization_units.id')),
        sa.Column('shared_with_orgs', postgresql.ARRAY(sa.String())),
        sa.Column('shared_with_users', postgresql.ARRAY(sa.String())),
        sa.Column('confidentiality', sa.String(20), default='internal'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Organization Delegation
    op.create_table(
        'org_delegations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('delegator_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('delegator_position_id', sa.String(36), sa.ForeignKey('positions.id')),
        sa.Column('delegatee_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('delegatee_position_id', sa.String(36), sa.ForeignKey('positions.id')),
        sa.Column('org_unit_id', sa.String(36), sa.ForeignKey('organization_units.id')),
        sa.Column('delegated_permissions', postgresql.ARRAY(sa.String())),
        sa.Column('valid_from', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('valid_until', sa.DateTime(timezone=True)),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True)),
        sa.Column('revoked_by', sa.String(36), sa.ForeignKey('users.id')),
    )
    
    # Access Logs
    op.create_table(
        'access_logs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('resource_type', sa.String(50), nullable=False),
        sa.Column('resource_id', sa.String(36)),
        sa.Column('success', sa.Boolean(), default=True),
        sa.Column('denial_reason', sa.Text()),
        sa.Column('ip_address', sa.String(50)),
        sa.Column('user_agent', sa.String(500)),
        sa.Column('org_unit_id', sa.String(36)),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('before_data', postgresql.JSONB()),
        sa.Column('after_data', postgresql.JSONB()),
    )


def downgrade():
    op.drop_table('access_logs')
    op.drop_table('org_delegations')
    op.drop_table('contract_visibility')
    op.drop_table('kb_user_access')
    op.drop_table('kb_org_access')
    op.drop_table('access_policies')
