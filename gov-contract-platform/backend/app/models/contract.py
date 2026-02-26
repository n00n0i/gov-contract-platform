"""
Contract Management Models
"""
from sqlalchemy import Column, String, Text, Numeric, DateTime, Date, Enum, ForeignKey, Integer, Boolean, Table
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from app.models.base import BaseModel, Base, TenantMixin, TimestampMixin
import enum


class ContractStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    TERMINATED = "terminated"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class ContractType(str, enum.Enum):
    CONSTRUCTION = "construction"
    CONSULTING = "consulting"
    PROCUREMENT = "procurement"
    SERVICE = "service"
    SUPPLY = "supply"
    RESEARCH = "research"
    MAINTENANCE = "maintenance"
    SOFTWARE = "software"
    OTHER = "other"


class ClassificationLevel(str, enum.Enum):
    PUBLIC = "S5"
    RESTRICTED = "S4"
    CONFIDENTIAL = "S3"
    SECRET = "S2"
    TOP_SECRET = "S1"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PARTIAL = "partial"
    COMPLETED = "completed"
    OVERDUE = "overdue"


class Contract(BaseModel):
    """Main contract entity"""
    
    __tablename__ = 'contracts'
    
    # Basic Info
    contract_no = Column(String(50), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    title_en = Column(String(500))
    description = Column(Text)
    
    # Classification
    contract_type = Column(Enum(ContractType), nullable=False)
    classification = Column(Enum(ClassificationLevel), default=ClassificationLevel.RESTRICTED)
    status = Column(Enum(ContractStatus), default=ContractStatus.DRAFT)
    
    # Financial
    value_original = Column(Numeric(15, 2))  # มูลค่าตามสัญญา
    value_adjusted = Column(Numeric(15, 2))  # มูลค่าที่ปรับแล้ว (addendum)
    currency = Column(String(3), default="THB")
    payment_terms = Column(Text)
    
    # Dates
    start_date = Column(Date)
    end_date = Column(Date)
    signed_date = Column(Date)
    effective_date = Column(Date)
    termination_date = Column(Date)
    warranty_end_date = Column(Date)
    
    # Parties
    owner_department_id = Column(String(36), ForeignKey('departments.id'))
    owner_division_id = Column(String(36), ForeignKey('divisions.id'))
    owner_user_id = Column(String(36), ForeignKey('users.id'))
    
    vendor_id = Column(String(36), ForeignKey('vendors.id'))
    vendor_name = Column(String(200))
    vendor_tax_id = Column(String(20))
    vendor_address = Column(Text)
    vendor_contact_name = Column(String(100))
    vendor_contact_email = Column(String(255))
    vendor_contact_phone = Column(String(20))
    
    # Project Info
    project_code = Column(String(50))
    project_name = Column(String(500))
    budget_year = Column(Integer)
    budget_source = Column(String(200))
    
    # Document
    file_main_path = Column(String(500))
    file_main_name = Column(String(200))
    file_main_size = Column(Integer)
    file_main_type = Column(String(50))
    page_count = Column(Integer)
    
    # OCR & AI
    ocr_text = Column(Text)
    ocr_confidence = Column(Numeric(5, 2))
    ocr_engine = Column(String(50))
    extracted_data = Column(JSONB)
    keywords = Column(ARRAY(String))
    content_vector = Column(ARRAY(Numeric))
    
    # Terms
    penalty_rate = Column(Numeric(5, 2))  # อัตราค่าปรับ %
    warranty_period_months = Column(Integer)
    retention_percent = Column(Numeric(5, 2))
    
    # Metadata
    tags = Column(ARRAY(String))
    custom_metadata = Column(JSONB, default=dict)
    
    # Parent/Amendment
    parent_contract_id = Column(String(36), ForeignKey('contracts.id'))
    amendment_no = Column(Integer, default=0)
    is_amendment = Column(Boolean, default=False)
    
    # Approval
    current_approval_level = Column(Integer, default=0)
    required_approval_level = Column(Integer, default=1)
    
    # Relationships
    owner_department = relationship("Department", foreign_keys=[owner_department_id])
    owner_user = relationship("User", foreign_keys=[owner_user_id])
    vendor = relationship("Vendor", back_populates="contracts")
    parent_contract = relationship("Contract", remote_side="Contract.id", backref="amendments")
    
    attachments = relationship("ContractAttachment", back_populates="contract", cascade="all, delete-orphan")
    milestones = relationship("ContractMilestone", back_populates="contract", cascade="all, delete-orphan")
    payments = relationship("ContractPayment", back_populates="contract", cascade="all, delete-orphan")
    changes = relationship("ContractChange", back_populates="contract", cascade="all, delete-orphan")
    audit_logs = relationship("ContractAuditLog", back_populates="contract", cascade="all, delete-orphan")
    
    __table_args__ = (
        # Unique constraint: tenant + contract_no
    )


class ContractAttachment(BaseModel):
    """Contract documents and attachments"""
    
    __tablename__ = 'contract_attachments'
    
    # Links
    contract_id = Column(String(36), ForeignKey('contracts.id'), nullable=True)
    vendor_id = Column(String(36), ForeignKey('vendors.id'), nullable=True)
    
    # File info - รองรับทั้งชื่อที่ผู้ใช้ตั้งและชื่อไฟล์จริง
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_size = Column(Integer, default=0)
    file_type = Column(String(50))  # pdf, image, word, excel
    mime_type = Column(String(100))
    extension = Column(String(10))
    
    # Storage
    storage_path = Column(String(500), nullable=False)
    storage_bucket = Column(String(100), default='govplatform')
    
    # Classification
    document_type = Column(String(50), default='other')  # contract, amendment, guarantee, invoice, receipt, delivery, other
    description = Column(Text)
    tags = Column(ARRAY(String))
    
    # Status
    status = Column(String(50), default='uploading')  # uploading, processing, ocr_pending, ocr_processing, ocr_completed, ocr_failed, verified, rejected
    ocr_status = Column(String(50))  # pending, processing, completed, failed
    ocr_confidence = Column(Numeric(5, 2))
    ocr_error = Column(Text)
    
    # OCR Results - ข้อมูลที่ดึงออกจากเอกสาร
    extracted_text = Column(Text)
    extracted_data = Column(JSONB)
    extracted_contract_number = Column(String(100))
    extracted_contract_value = Column(Numeric(15, 2))
    extracted_start_date = Column(DateTime)
    extracted_end_date = Column(DateTime)
    extracted_parties = Column(JSONB)
    
    # Metadata
    page_count = Column(Integer)
    language = Column(String(10))
    
    # Audit
    uploaded_by = Column(String(36), ForeignKey('users.id'))
    uploaded_at = Column(DateTime, nullable=False)
    processed_at = Column(DateTime)
    verified_by = Column(String(36), ForeignKey('users.id'))
    verified_at = Column(DateTime)
    verified_data = Column(JSONB)
    
    # Relationships
    contract = relationship("Contract", back_populates="attachments")
    vendor = relationship("Vendor", back_populates="documents")
    uploader = relationship("User", foreign_keys=[uploaded_by])


class ContractMilestone(BaseModel):
    """Contract milestones/deliverables"""
    
    __tablename__ = 'contract_milestones'
    
    contract_id = Column(String(36), ForeignKey('contracts.id'), nullable=False)
    
    # Milestone info
    milestone_no = Column(Integer, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    
    # Schedule
    planned_date = Column(Date)
    actual_date = Column(Date)
    
    # Financial
    percentage = Column(Numeric(5, 2))  # % ของงวดเงิน
    amount = Column(Numeric(15, 2))
    
    # Status
    status = Column(String(20), default="pending")  # pending, completed, delayed, cancelled
    deliverables = Column(Text)
    completion_notes = Column(Text)
    
    # Relationships
    contract = relationship("Contract", back_populates="milestones")


class ContractPayment(BaseModel):
    """Payment records"""
    
    __tablename__ = 'contract_payments'
    
    contract_id = Column(String(36), ForeignKey('contracts.id'), nullable=False)
    milestone_id = Column(String(36), ForeignKey('contract_milestones.id'))
    
    # Payment info
    payment_no = Column(Integer, nullable=False)
    invoice_no = Column(String(50))
    invoice_date = Column(Date)
    
    # Amounts
    amount_requested = Column(Numeric(15, 2))
    amount_approved = Column(Numeric(15, 2))
    amount_paid = Column(Numeric(15, 2))
    withholding_tax = Column(Numeric(15, 2))
    vat = Column(Numeric(15, 2))
    
    # Status
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    paid_date = Column(Date)
    payment_method = Column(String(50))
    reference_no = Column(String(100))
    
    # Documents
    invoice_file_path = Column(String(500))
    receipt_file_path = Column(String(500))
    
    # Notes
    notes = Column(Text)
    
    # Relationships
    contract = relationship("Contract", back_populates="payments")
    milestone = relationship("ContractMilestone")


class ContractChange(BaseModel):
    """Contract amendments and changes"""
    
    __tablename__ = 'contract_changes'
    
    contract_id = Column(String(36), ForeignKey('contracts.id'), nullable=False)
    
    # Change info
    change_type = Column(String(50), nullable=False)  # extension, value_change, scope_change, etc.
    change_no = Column(Integer, nullable=False)
    title = Column(String(200))
    description = Column(Text)
    
    # Financial impact
    value_before = Column(Numeric(15, 2))
    value_after = Column(Numeric(15, 2))
    value_difference = Column(Numeric(15, 2))
    
    # Schedule impact
    end_date_before = Column(Date)
    end_date_after = Column(Date)
    
    # Approval
    requested_by = Column(String(36), ForeignKey('users.id'))
    requested_at = Column(DateTime(timezone=True))
    approved_by = Column(String(36), ForeignKey('users.id'))
    approved_at = Column(DateTime(timezone=True))
    approval_notes = Column(Text)
    
    # Document
    document_path = Column(String(500))
    
    # Status
    status = Column(String(20), default="pending")  # pending, approved, rejected
    
    # Relationships
    contract = relationship("Contract", back_populates="changes")


class ContractAuditLog(Base, TimestampMixin):
    """Detailed audit log for contract activities"""
    
    __tablename__ = 'contract_audit_logs'
    
    id = Column(String(36), primary_key=True)
    tenant_id = Column(String(50), nullable=False, index=True)
    contract_id = Column(String(36), ForeignKey('contracts.id'), nullable=False)
    user_id = Column(String(36), ForeignKey('users.id'))
    
    # Action info
    action = Column(String(50), nullable=False)  # create, update, delete, view, approve, etc.
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    
    # Context
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    request_id = Column(String(100))
    
    # Additional data
    custom_metadata = Column(JSONB)
    
    # Relationships
    contract = relationship("Contract", back_populates="audit_logs")
