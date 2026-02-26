"""
Notification Recipient Model - จัดการผู้รับแจ้งเตือนหลายคน
"""
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.models.base import Base


class NotificationRecipient(Base):
    """ผู้รับแจ้งเตือน - รองรับหลายคน"""
    __tablename__ = "notification_recipients"
    
    id = Column(String, primary_key=True)
    
    # ข้อมูลผู้รับ
    email = Column(String, nullable=False, index=True)  # อีเมลผู้รับ
    name = Column(String, nullable=True)  # ชื่อผู้รับ (optional)
    
    # ประเภทผู้รับ
    recipient_type = Column(String, default="email")  # email, user, role, department
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)  # ถ้าเป็น user ในระบบ
    role = Column(String, nullable=True)  # ถ้าเป็น role (admin, manager, etc.)
    department = Column(String, nullable=True)  # แผนก
    
    # การตั้งค่าการแจ้งเตือน
    notification_types = Column(Text, default="all")  # all หรือ comma-separated list
    channel = Column(String, default="email")  # email, in_app, both
    
    # ตัวกรองเพิ่มเติม
    min_priority = Column(String, default="low")  # low, medium, high, urgent
    
    # สถานะ
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)  # อีเมลยืนยันแล้วหรือไม่
    verification_token = Column(String, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    
    # สถิติ
    last_sent_at = Column(DateTime, nullable=True)
    send_count = Column(Integer, default=0)  # จำนวนการส่งสะสม
    fail_count = Column(Integer, default=0)  # จำนวนการส่งล้มเหลว
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, ForeignKey("users.id"))
    
    # Relationships (using string references to avoid circular imports)
    creator = relationship("User", foreign_keys=[created_by])
    user = relationship("User", foreign_keys=[user_id])
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "recipient_type": self.recipient_type,
            "user_id": self.user_id,
            "role": self.role,
            "department": self.department,
            "notification_types": self.notification_types,
            "channel": self.channel,
            "min_priority": self.min_priority,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "last_sent_at": self.last_sent_at.isoformat() if self.last_sent_at else None,
            "send_count": self.send_count,
            "fail_count": self.fail_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    def can_receive(self, notification_type: str, priority: str = "medium") -> bool:
        """ตรวจสอบว่าผู้รับนี้ควรได้รับการแจ้งเตือนประเภทนี้หรือไม่"""
        if not self.is_active:
            return False
        
        # ตรวจสอบประเภทการแจ้งเตือน
        if self.notification_types != "all":
            allowed_types = [t.strip() for t in self.notification_types.split(",")]
            if notification_type not in allowed_types:
                return False
        
        # ตรวจสอบ priority
        priority_levels = {"low": 1, "medium": 2, "high": 3, "urgent": 4}
        if priority_levels.get(priority, 2) < priority_levels.get(self.min_priority, 1):
            return False
        
        return True
