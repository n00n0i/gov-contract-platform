"""
AI Agent & Knowledge Base Models
"""
from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text, ForeignKey, Enum, Float, Table
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from app.models.base import BaseModel, Base, TimestampMixin
import enum


class AgentStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"


class TriggerEvent(str, enum.Enum):
    """Events that can trigger an agent"""
    DOCUMENT_UPLOAD = "document_upload"
    CONTRACT_CREATE = "contract_create"
    CONTRACT_REVIEW = "contract_review"
    CONTRACT_APPROVE = "contract_approve"
    VENDOR_CHECK = "vendor_check"
    MANUAL = "manual"  # User triggers manually
    SCHEDULED = "scheduled"  # Cron job


class OutputAction(str, enum.Enum):
    """What to do with agent output"""
    SHOW_POPUP = "show_popup"           # Show result in modal/toast
    SAVE_TO_FIELD = "save_to_field"     # Save to specific contract/vendor field
    CREATE_TASK = "create_task"         # Create a task for user
    SEND_EMAIL = "send_email"           # Send email notification
    WEBHOOK = "webhook"                 # Call external webhook
    LOG_ONLY = "log_only"               # Just log the result


class AIAgent(BaseModel):
    """AI Agent configuration"""
    
    __tablename__ = 'ai_agents'
    
    # Basic Info
    name = Column(String(100), nullable=False)
    description = Column(Text)
    status = Column(Enum(AgentStatus), default=AgentStatus.ACTIVE)
    
    # Owner
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    is_system = Column(Boolean, default=False)  # System agents can't be deleted
    
    # Model Configuration - Link to AIProvider
    provider_id = Column(String(50), ForeignKey('ai_providers.id'), nullable=True)
    model_config = Column(JSONB, default=dict)  # temperature, max_tokens, etc.
    
    # Prompt
    system_prompt = Column(Text, default="")
    
    # Knowledge (RAG)
    knowledge_base_ids = Column(ARRAY(String), default=list)  # References to KnowledgeBase
    use_graphrag = Column(Boolean, default=False)
    
    # Trigger Configuration
    trigger_events = Column(ARRAY(String), default=list)  # Legacy: ['document_upload', 'manual']
    trigger_pages = Column(ARRAY(String), default=list)   # Legacy: ['contracts', 'documents']
    trigger_condition = Column(Text)  # Optional JS-like condition
    enabled_presets = Column(ARRAY(String), default=list)  # New: ['doc_analyze_upload', 'contract_review_btn']
    
    # Input/Output Schema
    input_schema = Column(JSONB, default=dict)  # What data agent expects
    output_action = Column(String(50), default=OutputAction.SHOW_POPUP)
    output_target = Column(String(100))  # field name, webhook URL, etc.
    output_format = Column(String(50), default="json")  # json, markdown, text
    
    # Permission
    allowed_roles = Column(ARRAY(String), default=list)
    
    # Stats
    execution_count = Column(Integer, default=0)
    last_executed_at = Column(DateTime(timezone=True))
    avg_execution_time = Column(Float, default=0.0)
    
    # Relationships
    provider = relationship("AIProvider", back_populates="agents")
    executions = relationship("AgentExecution", back_populates="agent", cascade="all, delete-orphan")
    triggers = relationship("AgentTrigger", back_populates="agent", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "status": self.status.value,
            "is_system": self.is_system,
            "provider_id": self.provider_id,
            "model_config": self.model_config,
            "system_prompt": self.system_prompt,
            "knowledge_base_ids": self.knowledge_base_ids,
            "use_graphrag": self.use_graphrag,
            "trigger_events": self.trigger_events,
            "trigger_pages": self.trigger_pages,
            "trigger_condition": self.trigger_condition,
            "enabled_presets": self.enabled_presets,
            "input_schema": self.input_schema,
            "output_action": self.output_action,
            "output_target": self.output_target,
            "output_format": self.output_format,
            "allowed_roles": self.allowed_roles,
            "execution_count": self.execution_count,
            "last_executed_at": self.last_executed_at.isoformat() if self.last_executed_at else None,
            "avg_execution_time": self.avg_execution_time,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class KnowledgeBase(BaseModel):
    """Knowledge Base for RAG"""
    
    __tablename__ = 'knowledge_bases'
    
    name = Column(String(100), nullable=False)
    description = Column(Text)
    
    # Owner
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    is_system = Column(Boolean, default=False)
    
    # Type
    kb_type = Column(String(50), default="documents")  # documents, regulations, templates
    
    # Documents in this KB
    document_ids = Column(ARRAY(String), default=list)  # References to documents
    
    # Vector Store Config
    vector_store_id = Column(String(100))  # External vector store ID (Pinecone, etc.)
    embedding_model = Column(String(100), default="nomic-embed-text")
    
    # Status
    document_count = Column(Integer, default=0)
    total_chunks = Column(Integer, default=0)
    last_synced_at = Column(DateTime(timezone=True))
    is_indexed = Column(Boolean, default=False)
    
    # Metadata
    tags = Column(ARRAY(String), default=list)
    
    # Organization ownership
    owner_org_id = Column(String(36), ForeignKey('organization_units.id'), nullable=True)
    owner_user_id = Column(String(36), ForeignKey('users.id'), nullable=True)
    
    # Access control
    visibility = Column(String(20), default="org")  # private, org, shared, public
    
    # Relationships
    owner_org = relationship("OrganizationUnit", foreign_keys=[owner_org_id])
    owner_user = relationship("User", foreign_keys=[owner_user_id])
    org_access = relationship("KBOrgAccess", back_populates="knowledge_base", cascade="all, delete-orphan")
    user_access = relationship("KBUserAccess", back_populates="knowledge_base", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "is_system": self.is_system,
            "kb_type": self.kb_type,
            "document_count": self.document_count,
            "total_chunks": self.total_chunks,
            "is_indexed": self.is_indexed,
            "visibility": self.visibility,
            "owner_org_id": self.owner_org_id,
            "owner_user_id": self.owner_user_id,
            "last_synced_at": self.last_synced_at.isoformat() if self.last_synced_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AgentExecution(Base, TimestampMixin):
    """Log of agent executions"""
    
    __tablename__ = 'agent_executions'
    
    id = Column(String(36), primary_key=True)
    agent_id = Column(String(36), ForeignKey('ai_agents.id'), nullable=False)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    
    # Trigger Info
    trigger_event = Column(String(50))  # What triggered this execution
    trigger_page = Column(String(50))   # Which page
    
    # Input
    input_data = Column(JSONB)          # What was sent to agent
    context_data = Column(JSONB)        # Additional context (contract data, etc.)
    
    # Output
    output_data = Column(JSONB)         # Agent response
    output_action_taken = Column(String(50))  # What action was performed
    
    # Performance
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    execution_time_ms = Column(Integer)
    token_usage = Column(JSONB, default=dict)  # {input_tokens, output_tokens}
    
    # Status
    status = Column(String(20), default="running")  # running, completed, failed
    error_message = Column(Text)
    
    # Relationships
    agent = relationship("AIAgent", back_populates="executions")


class AgentWebhook(BaseModel):
    """Webhook endpoints for agent integrations"""
    
    __tablename__ = 'agent_webhooks'
    
    name = Column(String(100), nullable=False)
    url = Column(String(500), nullable=False)
    method = Column(String(10), default="POST")
    headers = Column(JSONB, default=dict)
    
    # Owner
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    
    # Security
    secret_key = Column(String(255))  # For HMAC signature
    is_active = Column(Boolean, default=True)
    
    # Stats
    last_triggered_at = Column(DateTime(timezone=True))
    trigger_count = Column(Integer, default=0)


# Association table: Agent <-> KnowledgeBase
agent_knowledge_bases = Table(
    'agent_knowledge_bases',
    Base.metadata,
    Column('agent_id', String(36), ForeignKey('ai_agents.id')),
    Column('kb_id', String(36), ForeignKey('knowledge_bases.id'))
)
