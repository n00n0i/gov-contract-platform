"""
Trigger Models for AI Agent System
Production-ready trigger management with templates, conditions, and executions
"""
import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON, Enum, Integer, Float, Boolean, Index
from sqlalchemy.orm import relationship

from app.models.base import Base


class TriggerType(str, enum.Enum):
    """Types of trigger events"""
    # Event-based
    DOCUMENT_UPLOAD = "document_upload"
    DOCUMENT_UPDATE = "document_update"
    CONTRACT_CREATED = "contract_created"
    CONTRACT_UPDATED = "contract_updated"
    CONTRACT_STATUS_CHANGED = "contract_status_changed"
    CONTRACT_APPROVAL_REQUESTED = "contract_approval_requested"
    CONTRACT_APPROVED = "contract_approved"
    CONTRACT_REJECTED = "contract_rejected"
    VENDOR_CREATED = "vendor_created"
    VENDOR_UPDATED = "vendor_updated"
    PAYMENT_DUE = "payment_due"
    CONTRACT_EXPIRING = "contract_expiring"
    
    # Schedule-based
    SCHEDULED = "scheduled"
    PERIODIC = "periodic"
    
    # Manual
    MANUAL = "manual"
    BUTTON_CLICK = "button_click"
    
    # Data-driven
    CONDITION_MET = "condition_met"
    THRESHOLD_EXCEEDED = "threshold_exceeded"
    ANOMALY_DETECTED = "anomaly_detected"


class TriggerStatus(str, enum.Enum):
    """Trigger status"""
    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"
    DISABLED = "disabled"


class ExecutionStatus(str, enum.Enum):
    """Trigger execution status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


class AgentTrigger(Base):
    """
    Individual trigger configuration for an agent
    Multiple triggers per agent supported
    """
    __tablename__ = 'agent_triggers'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id = Column(String(36), ForeignKey('ai_agents.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Basic info
    name = Column(String(100), nullable=False)
    description = Column(Text)
    trigger_type = Column(Enum(TriggerType), nullable=False, index=True)
    status = Column(Enum(TriggerStatus), default=TriggerStatus.ACTIVE, index=True)
    priority = Column(Integer, default=0)  # Higher = executed first
    
    # Conditions (JSON for flexible conditions)
    # Example: {"field": "contract.status", "operator": "eq", "value": "pending"}
    conditions = Column(JSON, default=dict)
    
    # Schedule configuration (for scheduled/periodic triggers)
    # Example: {"cron": "0 9 * * 1-5", "timezone": "Asia/Bangkok"}
    schedule_config = Column(JSON, default=dict)
    
    # Periodic configuration
    # Example: {"interval": 3600, "unit": "seconds"}
    periodic_config = Column(JSON, default=dict)
    
    # Page locations (for manual/button triggers)
    applicable_pages = Column(JSON, default=list)
    
    # Button configuration (for button_click triggers)
    # Example: {"label": "วิเคราะห์สัญญา", "icon": "bot", "position": "top-right"}
    button_config = Column(JSON, default=dict)
    
    # Execution limits
    max_executions_per_day = Column(Integer, default=1000)
    cooldown_seconds = Column(Integer, default=0)  # Minimum time between executions
    
    # Notification settings
    notification_config = Column(JSON, default=dict)
    
    # Statistics
    execution_count = Column(Integer, default=0)
    last_executed_at = Column(DateTime(timezone=True))
    last_error = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(36), ForeignKey('users.id'))
    
    # Relationships
    agent = relationship("AIAgent", back_populates="triggers")
    executions = relationship("TriggerExecution", back_populates="trigger", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "name": self.name,
            "description": self.description,
            "trigger_type": self.trigger_type.value if self.trigger_type else None,
            "status": self.status.value if self.status else None,
            "priority": self.priority,
            "conditions": self.conditions,
            "schedule_config": self.schedule_config,
            "periodic_config": self.periodic_config,
            "applicable_pages": self.applicable_pages,
            "button_config": self.button_config,
            "max_executions_per_day": self.max_executions_per_day,
            "cooldown_seconds": self.cooldown_seconds,
            "notification_config": self.notification_config,
            "execution_count": self.execution_count,
            "last_executed_at": self.last_executed_at.isoformat() if self.last_executed_at else None,
            "last_error": self.last_error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class TriggerExecution(Base):
    """
    Record of each trigger execution
    """
    __tablename__ = 'trigger_executions'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    trigger_id = Column(String(36), ForeignKey('agent_triggers.id', ondelete='SET NULL'), nullable=True, index=True)
    agent_id = Column(String(36), ForeignKey('ai_agents.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Execution status
    status = Column(Enum(ExecutionStatus), default=ExecutionStatus.PENDING, index=True)
    
    # Who/what triggered it
    triggered_by = Column(String(36), ForeignKey('users.id'), nullable=True)  # User ID or null for system
    source_event = Column(String(100))  # Event type that triggered it
    source_page = Column(String(100))  # Page where triggered
    
    # Input/Output
    input_data = Column(JSON, default=dict)
    output_data = Column(JSON, default=dict)
    context_data = Column(JSON, default=dict)  # Additional context
    
    # Execution details
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    execution_time_ms = Column(Float)
    
    # Results
    result_summary = Column(Text)
    error_message = Column(Text)
    error_details = Column(JSON, default=dict)
    
    # Timestamps
    triggered_at = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    
    # Relationships
    trigger = relationship("AgentTrigger", back_populates="executions")
    
    def to_dict(self):
        return {
            "id": self.id,
            "trigger_id": self.trigger_id,
            "agent_id": self.agent_id,
            "status": self.status.value if self.status else None,
            "triggered_by": self.triggered_by,
            "source_event": self.source_event,
            "source_page": self.source_page,
            "input_data": self.input_data,
            "output_data": self.output_data,
            "context_data": self.context_data,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "execution_time_ms": self.execution_time_ms,
            "result_summary": self.result_summary,
            "error_message": self.error_message,
            "error_details": self.error_details,
            "triggered_at": self.triggered_at.isoformat() if self.triggered_at else None,
        }


class TriggerTemplate(Base):
    """
    Pre-defined trigger templates for common use cases
    """
    __tablename__ = 'trigger_templates'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    name = Column(String(100), nullable=False)
    description = Column(Text)
    category = Column(String(50), index=True)  # document, contract, vendor, system
    
    # Template configuration
    trigger_type = Column(Enum(TriggerType), nullable=False)
    default_conditions = Column(JSON, default=dict)
    default_schedule_config = Column(JSON, default=dict)
    default_periodic_config = Column(JSON, default=dict)
    default_button_config = Column(JSON, default=dict)
    applicable_pages = Column(JSON, default=list)
    
    # Template settings
    is_system = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "trigger_type": self.trigger_type.value if self.trigger_type else None,
            "default_conditions": self.default_conditions,
            "default_schedule_config": self.default_schedule_config,
            "default_periodic_config": self.default_periodic_config,
            "default_button_config": self.default_button_config,
            "applicable_pages": self.applicable_pages,
            "is_system": self.is_system,
            "is_active": self.is_active,
        }


# System trigger templates (pre-defined)
SYSTEM_TRIGGER_TEMPLATES = [
    # Document templates
    {
        "id": "tpl-doc-upload",
        "name": "วิเคราะห์เอกสารอัตโนมัติ",
        "description": "วิเคราะห์เอกสารทันทีเมื่อมีการอัพโหลด",
        "category": "document",
        "trigger_type": "document_upload",
        "default_conditions": {
            "file_types": [".pdf", ".doc", ".docx"],
            "min_file_size": 1024,
            "max_file_size": 52428800
        },
        "applicable_pages": ["/documents", "/documents/upload"],
        "icon": "upload"
    },
    {
        "id": "tpl-doc-ocr",
        "name": "OCR เอกสารสแกน",
        "description": "ทำ OCR เอกสารที่เป็นรูปภาพหรือ PDF สแกน",
        "category": "document",
        "trigger_type": "document_upload",
        "default_conditions": {
            "requires_ocr": True,
            "file_types": [".pdf", ".png", ".jpg", ".tiff"]
        },
        "applicable_pages": ["/documents/upload"],
        "icon": "scan"
    },
    
    # Contract templates
    {
        "id": "tpl-contract-create",
        "name": "ตรวจสอบสัญญาใหม่",
        "description": "ตรวจสอบความถูกต้องของสัญญาเมื่อสร้างใหม่",
        "category": "contract",
        "trigger_type": "contract_created",
        "default_conditions": {
            "check_compliance": True,
            "check_risk": True,
            "check_template": True
        },
        "applicable_pages": ["/contracts/new"],
        "icon": "file-plus"
    },
    {
        "id": "tpl-contract-approve",
        "name": "วิเคราะห์ก่อนอนุมัติ",
        "description": "วิเคราะห์ความเสี่ยงและความสอดคล้องก่อนอนุมัติ",
        "category": "contract",
        "trigger_type": "contract_approval_requested",
        "default_conditions": {
            "check_risk": True,
            "check_budget": True,
            "check_vendor": True
        },
        "applicable_pages": ["/contracts/:id/approve"],
        "icon": "check-circle"
    },
    {
        "id": "tpl-contract-review",
        "name": "ตรวจสอบรายละเอียดสัญญา",
        "description": "ตรวจสอบรายละเอียดและเงื่อนไขสัญญา",
        "category": "contract",
        "trigger_type": "button_click",
        "default_button_config": {
            "label": "วิเคราะห์สัญญาด้วย AI",
            "icon": "bot",
            "position": "top-right",
            "style": "primary"
        },
        "applicable_pages": ["/contracts/:id"],
        "icon": "file-search"
    },
    {
        "id": "tpl-contract-expiry",
        "name": "แจ้งเตือนสัญญาใกล้หมดอายุ",
        "description": "ตรวจสอบและแจ้งเตือนสัญญาที่ใกล้หมดอายุ",
        "category": "contract",
        "trigger_type": "scheduled",
        "default_schedule_config": {
            "cron": "0 9 * * 1-5",
            "timezone": "Asia/Bangkok"
        },
        "default_conditions": {
            "days_before_expiry": 30
        },
        "icon": "clock"
    },
    
    # Vendor templates
    {
        "id": "tpl-vendor-create",
        "name": "ตรวจสอบผู้รับจ้างใหม่",
        "description": "ตรวจสอบข้อมูลและประวัติผู้รับจ้างใหม่",
        "category": "vendor",
        "trigger_type": "vendor_created",
        "default_conditions": {
            "check_blacklist": True,
            "check_duplicates": True,
            "verify_documents": True
        },
        "applicable_pages": ["/vendors/new"],
        "icon": "user-plus"
    },
    {
        "id": "tpl-vendor-check",
        "name": "ตรวจสอบผู้รับจ้าง",
        "description": "ตรวจสอบความน่าเชื่อถือของผู้รับจ้าง",
        "category": "vendor",
        "trigger_type": "button_click",
        "default_button_config": {
            "label": "ตรวจสอบผู้รับจ้าง",
            "icon": "shield-check",
            "position": "actions",
            "style": "secondary"
        },
        "applicable_pages": ["/vendors/:id"],
        "icon": "user-check"
    },
    
    # System templates
    {
        "id": "tpl-payment-due",
        "name": "แจ้งเตือนการจ่ายเงิน",
        "description": "แจ้งเตือนกำหนดการจ่ายเงินใกล้ถึง",
        "category": "system",
        "trigger_type": "payment_due",
        "default_conditions": {
            "days_before_due": 7
        },
        "icon": "dollar-sign"
    },
    {
        "id": "tpl-anomaly",
        "name": "ตรวจจับความผิดปกติ",
        "description": "ตรวจจับความผิดปกติในข้อมูลสัญญา",
        "category": "system",
        "trigger_type": "anomaly_detected",
        "default_conditions": {
            "sensitivity": "medium",
            "check_patterns": ["unusual_amount", "duplicate_contracts", "blacklist_vendor"]
        },
        "icon": "alert-triangle"
    },
    {
        "id": "tpl-periodic-report",
        "name": "สรุปรายงานประจำสัปดาห์",
        "description": "สร้างสรุปรายงานสัญญาประจำสัปดาห์",
        "category": "system",
        "trigger_type": "scheduled",
        "default_schedule_config": {
            "cron": "0 8 * * 1",
            "timezone": "Asia/Bangkok"
        },
        "icon": "bar-chart"
    }
]
