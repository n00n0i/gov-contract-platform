"""
Organization Structure Models - โครงสร้างองค์กรภาครัฐ
"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.models.base import BaseModel, Base
import enum


class OrgLevel(str, enum.Enum):
    """ระดับโครงสร้างองค์กร"""
    MINISTRY = "ministry"           # กระทรวง
    DEPARTMENT = "department"       # กรม/สำนักงาน
    BUREAU = "bureau"               # สำนัก/กอง
    DIVISION = "division"           # งาน/ฝ่าย
    SECTION = "section"             # กลุ่ม/หมวด
    UNIT = "unit"                   # หน่วยย่อย


class OrganizationUnit(BaseModel):
    """หน่วยงานในโครงสร้างองค์กร"""
    
    __tablename__ = 'organization_units'
    
    # รหัสและชื่อ
    code = Column(String(20), unique=True, nullable=False, index=True)
    name_th = Column(String(200), nullable=False)
    name_en = Column(String(200))
    short_name = Column(String(50))
    
    # ระดับและประเภท
    level = Column(Enum(OrgLevel), default=OrgLevel.DEPARTMENT)
    unit_type = Column(String(50), default="government")  # government, state_enterprise, etc.
    
    # โครงสร้างระดับบน
    parent_id = Column(String(36), ForeignKey('organization_units.id'), nullable=True)
    ministry_id = Column(String(36), ForeignKey('organization_units.id'), nullable=True)
    
    # ข้อมูลติดต่อ
    address = Column(Text)
    phone = Column(String(50))
    email = Column(String(255))
    website = Column(String(255))
    
    # ผู้บริหาร
    director_name = Column(String(200))
    director_position = Column(String(200))
    
    # สถานะ
    is_active = Column(Boolean, default=True)
    is_head_office = Column(Boolean, default=False)  # เป็นสำนักงานใหญ่
    order_index = Column(Integer, default=0)  # ลำดับการแสดงผล
    
    # ข้อมูลเพิ่มเติม
    extra_data = Column(JSONB, default=dict)
    
    # ความสัมพันธ์
    parent = relationship("OrganizationUnit", remote_side="OrganizationUnit.id", 
                         backref="children", foreign_keys=[parent_id])
    ministry = relationship("OrganizationUnit", remote_side="OrganizationUnit.id",
                           backref="ministry_departments", foreign_keys=[ministry_id])
    users = relationship("User", back_populates="org_unit")
    
    def get_full_path(self) -> str:
        """ได้เส้นทางเต็มของหน่วยงาน"""
        path = [self.name_th]
        current = self
        while current.parent:
            path.insert(0, current.parent.name_th)
            current = current.parent
        return " / ".join(path)
    
    def to_dict(self, include_children: bool = False):
        result = {
            "id": self.id,
            "code": self.code,
            "name_th": self.name_th,
            "name_en": self.name_en,
            "short_name": self.short_name,
            "level": self.level.value if self.level else None,
            "unit_type": self.unit_type,
            "parent_id": self.parent_id,
            "ministry_id": self.ministry_id,
            "address": self.address,
            "phone": self.phone,
            "email": self.email,
            "website": self.website,
            "director_name": self.director_name,
            "director_position": self.director_position,
            "is_active": self.is_active,
            "is_head_office": self.is_head_office,
            "order_index": self.order_index,
            "full_path": self.get_full_path(),
            "user_count": len(self.users) if self.users else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_children and self.children:
            result["children"] = [child.to_dict(include_children=True) for child in self.children]
        
        return result


class Position(BaseModel):
    """ตำแหน่งในองค์กร"""
    
    __tablename__ = 'positions'
    
    code = Column(String(20), unique=True, nullable=False)
    name_th = Column(String(200), nullable=False)
    name_en = Column(String(200))
    short_name = Column(String(50))
    
    # ระดับตำแหน่ง
    level = Column(Integer, default=0)  # ระดับสูง = ตัวเลขมาก
    position_type = Column(String(50), default="permanent")  # permanent, temporary, contract
    
    # โครงสร้างที่สังกัด
    org_unit_id = Column(String(36), ForeignKey('organization_units.id'), nullable=True)
    
    # สายงาน
    career_track = Column(String(100))  # สายงาน เช่น บริหาร, วิชาการ, อำนวยการ
    
    # สถานะ
    is_active = Column(Boolean, default=True)
    is_management = Column(Boolean, default=False)  # เป็นตำแหน่งบริหาร
    
    # ความสัมพันธ์
    org_unit = relationship("OrganizationUnit", backref="positions")
    users = relationship("User", back_populates="position")
    
    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "name_th": self.name_th,
            "name_en": self.name_en,
            "short_name": self.short_name,
            "level": self.level,
            "position_type": self.position_type,
            "org_unit_id": self.org_unit_id,
            "org_unit_name": self.org_unit.name_th if self.org_unit else None,
            "career_track": self.career_track,
            "is_active": self.is_active,
            "is_management": self.is_management,
            "user_count": len(self.users) if self.users else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
