"""
Vendor Management Models
"""
from sqlalchemy import Column, String, Text, Numeric, Date, Boolean, Integer, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from app.models.base import BaseModel
import enum


class VendorStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    BLACKLISTED = "blacklisted"
    SUSPENDED = "suspended"
    PENDING = "pending"


class VendorType(str, enum.Enum):
    INDIVIDUAL = "individual"
    COMPANY = "company"
    PARTNERSHIP = "partnership"
    COOPERATIVE = "cooperative"
    STATE_ENTERPRISE = "state_enterprise"


class Vendor(BaseModel):
    """Vendor/Contractor registry"""
    
    __tablename__ = 'vendors'
    
    # Basic Info
    vendor_code = Column(String(20), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    name_en = Column(String(200))
    
    # Type
    vendor_type = Column(Enum(VendorType), default=VendorType.COMPANY)
    status = Column(Enum(VendorStatus), default=VendorStatus.PENDING)
    
    # Registration
    tax_id = Column(String(20), index=True)
    registration_no = Column(String(50))
    registration_date = Column(Date)
    
    # Contact
    address = Column(Text)
    province = Column(String(100))
    district = Column(String(100))
    postal_code = Column(String(10))
    
    phone = Column(String(20))
    email = Column(String(255))
    website = Column(String(255))
    
    # Representative
    contact_name = Column(String(100))
    contact_position = Column(String(100))
    contact_phone = Column(String(20))
    contact_email = Column(String(255))
    
    # Business info
    business_type = Column(String(100))
    business_category = Column(ARRAY(String))
    employee_count = Column(Integer)
    registered_capital = Column(Numeric(15, 2))
    
    # Documents
    registration_cert_path = Column(String(500))
    vat_cert_path = Column(String(500))
    id_card_path = Column(String(500))
    
    # Bank info
    bank_name = Column(String(100))
    bank_branch = Column(String(100))
    bank_account_no = Column(String(50))
    bank_account_name = Column(String(100))
    
    # Scoring
    overall_score = Column(Numeric(3, 2))  # 0.00 - 5.00
    delivery_score = Column(Numeric(3, 2))
    quality_score = Column(Numeric(3, 2))
    service_score = Column(Numeric(3, 2))
    
    # Risk
    risk_level = Column(String(20), default="low")  # low, medium, high, critical
    risk_notes = Column(Text)
    
    # Blacklist
    is_blacklisted = Column(Boolean, default=False)
    blacklist_reason = Column(Text)
    blacklisted_at = Column(Date)
    blacklisted_by = Column(String(36))
    
    # Metadata
    tags = Column(ARRAY(String))
    custom_metadata = Column(JSONB, default=dict)
    
    # Relationships
    contracts = relationship("Contract", back_populates="vendor")
    evaluations = relationship("VendorEvaluation", back_populates="vendor", cascade="all, delete-orphan")
    documents = relationship("ContractAttachment", back_populates="vendor")


class VendorEvaluation(BaseModel):
    """Vendor performance evaluations"""
    
    __tablename__ = 'vendor_evaluations'
    
    vendor_id = Column(String(36), ForeignKey('vendors.id'), nullable=False)
    contract_id = Column(String(36), ForeignKey('contracts.id'))
    
    # Evaluation period
    evaluation_date = Column(Date)
    period_start = Column(Date)
    period_end = Column(Date)
    
    # Scores (1-5)
    quality_score = Column(Numeric(3, 2))
    delivery_score = Column(Numeric(3, 2))
    price_score = Column(Numeric(3, 2))
    service_score = Column(Numeric(3, 2))
    documentation_score = Column(Numeric(3, 2))
    overall_score = Column(Numeric(3, 2))
    
    # Details
    strengths = Column(Text)
    weaknesses = Column(Text)
    recommendations = Column(Text)
    
    # Evaluator
    evaluated_by = Column(String(36), ForeignKey('users.id'))
    
    # Relationships
    vendor = relationship("Vendor", back_populates="evaluations")
