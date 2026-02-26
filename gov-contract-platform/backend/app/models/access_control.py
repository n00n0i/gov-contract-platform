"""
Access Control Models - ระบบสิทธิ์การเข้าถึงแบบเชื่อมโยงโครงสร้างองค์กร
"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey, Enum, Table
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.sql import func
from app.models.base import BaseModel, Base
import enum


class PermissionScope(str, enum.Enum):
    """ขอบเขตการให้สิทธิ์"""
    GLOBAL = "global"           # ทั้งระบบ
    ORGANIZATION = "org"        # หน่วยงานและสังกัด
    DEPARTMENT = "dept"         # กรม/สำนัก
    DIVISION = "div"            # งาน/ฝ่าย
    UNIT = "unit"               # หน่วยย่อย
    OWN = "own"                 # ของตัวเองเท่านั้น


class ResourceType(str, enum.Enum):
    """ประเภททรัพยากรที่ควบคุมสิทธิ์"""
    CONTRACT = "contract"
    DOCUMENT = "document"
    KNOWLEDGE_BASE = "knowledge_base"
    AGENT = "agent"
    TEMPLATE = "template"
    USER = "user"
    ORGANIZATION = "organization"
    REPORT = "report"
    SYSTEM = "system"


class AccessPolicy(BaseModel):
    """นโยบายการเข้าถึง (เชื่อมโยง Role กับสิทธิ์)"""
    
    __tablename__ = 'access_policies'
    
    name = Column(String(100), nullable=False)
    description = Column(Text)
    
    # เชื่อมกับ Role
    role_id = Column(String(36), ForeignKey('roles.id'), nullable=False)
    
    # ทรัพยากรที่ควบคุม
    resource_type = Column(Enum(ResourceType), nullable=False)
    resource_id = Column(String(36), nullable=True)  # None = ทุก resource ในประเภทนั้น
    
    # สิทธิ์การเข้าถึง
    can_view = Column(Boolean, default=False)
    can_create = Column(Boolean, default=False)
    can_edit = Column(Boolean, default=False)
    can_delete = Column(Boolean, default=False)
    can_approve = Column(Boolean, default=False)  # อนุมัติ
    can_share = Column(Boolean, default=False)    # แชร์ให้ผู้อื่น
    can_manage = Column(Boolean, default=False)   # จัดการสิทธิ์
    
    # ขอบเขตการให้สิทธิ์
    scope = Column(Enum(PermissionScope), default=PermissionScope.OWN)
    
    # เงื่อนไขเพิ่มเติม (JSON)
    conditions = Column(JSONB, default=dict)  # เช่น {"contract_value_max": 1000000}
    
    # ระยะเวลา
    valid_from = Column(DateTime(timezone=True))
    valid_until = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    
    # ความสัมพันธ์
    role = relationship("Role", back_populates="access_policies")


class KBOrgAccess(BaseModel):
    """สิทธิ์การเข้าถึง Knowledge Base ตามหน่วยงาน"""
    
    __tablename__ = 'kb_org_access'
    
    knowledge_base_id = Column(String(36), ForeignKey('knowledge_bases.id'), nullable=False)
    org_unit_id = Column(String(36), ForeignKey('organization_units.id'), nullable=False)
    
    # ระดับการเข้าถึง
    can_read = Column(Boolean, default=True)
    can_contribute = Column(Boolean, default=False)  # เพิ่มเอกสาร
    can_manage = Column(Boolean, default=False)      # จัดการ KB
    
    # สืบทอดสิทธิ์ไปยังหน่วยงานลูก
    inherit_to_children = Column(Boolean, default=True)
    
    # ความสัมพันธ์
    knowledge_base = relationship("KnowledgeBase", back_populates="org_access")
    org_unit = relationship("OrganizationUnit", backref="kb_access")


class KBUserAccess(BaseModel):
    """สิทธิ์การเข้าถึง Knowledge Base รายบุคคล"""
    
    __tablename__ = 'kb_user_access'
    
    knowledge_base_id = Column(String(36), ForeignKey('knowledge_bases.id'), nullable=False)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    
    can_read = Column(Boolean, default=True)
    can_contribute = Column(Boolean, default=False)
    can_manage = Column(Boolean, default=False)
    
    granted_by = Column(String(36), ForeignKey('users.id'))
    granted_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # ความสัมพันธ์
    knowledge_base = relationship("KnowledgeBase", back_populates="user_access")
    user = relationship("User", foreign_keys=[user_id], backref="kb_access")


class ContractVisibility(BaseModel):
    """การมองเห็นสัญญาตามโครงสร้างองค์กร"""
    
    __tablename__ = 'contract_visibility'
    
    contract_id = Column(String(36), ForeignKey('contracts.id'), nullable=False)
    
    # ใครเป็นผู้สร้าง/เจ้าของ
    owner_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    owner_org_id = Column(String(36), ForeignKey('organization_units.id'))
    
    # การแชร์ให้หน่วยงานอื่น
    shared_with_orgs = Column(ARRAY(String), default=list)  # List of org_unit_ids
    shared_with_users = Column(ARRAY(String), default=list)  # List of user_ids
    
    # ระดับความลับ
    confidentiality = Column(String(20), default="internal")  # public, internal, confidential, secret
    
    # ความสัมพันธ์
    # contract = relationship("Contract", back_populates="visibility")  # Comment out until Contract model exists
    owner = relationship("User", foreign_keys=[owner_id], backref="owned_contracts")
    owner_org = relationship("OrganizationUnit", foreign_keys=[owner_org_id])


class OrgDelegation(BaseModel):
    """การมอบอำนาจตามโครงสร้างองค์กร"""
    
    __tablename__ = 'org_delegations'
    
    # ผู้มอบอำนาจ
    delegator_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    delegator_position_id = Column(String(36), ForeignKey('positions.id'))
    
    # ผู้รับมอบอำนาจ
    delegatee_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    delegatee_position_id = Column(String(36), ForeignKey('positions.id'))
    
    # หน่วยงานที่มีผล
    org_unit_id = Column(String(36), ForeignKey('organization_units.id'))
    
    # สิทธิ์ที่มอบ
    delegated_permissions = Column(ARRAY(String), default=list)
    
    # ระยะเวลา
    valid_from = Column(DateTime(timezone=True), server_default=func.now())
    valid_until = Column(DateTime(timezone=True))
    
    # สถานะ
    is_active = Column(Boolean, default=True)
    revoked_at = Column(DateTime(timezone=True))
    revoked_by = Column(String(36), ForeignKey('users.id'))
    
    # ความสัมพันธ์
    delegator = relationship("User", foreign_keys=[delegator_id], backref="delegations_given")
    delegatee = relationship("User", foreign_keys=[delegatee_id], backref="delegations_received")


class AccessLog(Base):
    """บันทึกการเข้าถึงข้อมูล (Audit Trail)"""
    
    __tablename__ = 'access_logs'
    
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    
    # การกระทำ
    action = Column(String(50), nullable=False)  # view, create, edit, delete, approve, share
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(36))
    
    # ผลลัพธ์
    success = Column(Boolean, default=True)
    denial_reason = Column(Text)  # เหตุผลถ้าถูกปฏิเสธ
    
    # ข้อมูลเพิ่มเติม
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    org_unit_id = Column(String(36))  # หน่วยงานตอนนั้น
    
    # เวลา
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    # ข้อมูลก่อน/หลัง (สำหรับ edit)
    before_data = Column(JSONB)
    after_data = Column(JSONB)
