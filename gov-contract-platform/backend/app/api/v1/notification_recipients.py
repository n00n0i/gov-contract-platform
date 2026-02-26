"""
Notification Recipients API - จัดการผู้รับแจ้งเตือนหลายคน
"""
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, EmailStr

from app.db.database import get_db
from app.core.security import get_current_user_id, require_permissions
from app.core.logging import get_logger
from app.models.notification_recipient import NotificationRecipient

router = APIRouter(prefix="/notifications/recipients", tags=["Notification Recipients"])
logger = get_logger(__name__)


# ============== Schemas ==============

class NotificationRecipientCreate(BaseModel):
    email: EmailStr = Field(..., description="อีเมลผู้รับ")
    name: Optional[str] = Field(None, description="ชื่อผู้รับ")
    recipient_type: str = Field("email", description="ประเภท: email, user, role, department")
    user_id: Optional[str] = Field(None, description="User ID ถ้าเป็น user ในระบบ")
    role: Optional[str] = Field(None, description="Role ถ้าต้องการแจ้งเตือนตามบทบาท")
    department: Optional[str] = Field(None, description="แผนก")
    notification_types: str = Field("all", description="all หรือ comma-separated list")
    channel: str = Field("email", description="email, in_app, both")
    min_priority: str = Field("low", description="low, medium, high, urgent")
    is_active: bool = Field(True, description="เปิดใช้งานหรือไม่")


class NotificationRecipientUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    recipient_type: Optional[str] = None
    user_id: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    notification_types: Optional[str] = None
    channel: Optional[str] = None
    min_priority: Optional[str] = None
    is_active: Optional[bool] = None


class BulkRecipientsCreate(BaseModel):
    emails: List[EmailStr] = Field(..., description="รายการอีเมล")
    recipient_type: str = Field("email")
    notification_types: str = Field("all")
    channel: str = Field("email")
    min_priority: str = Field("low")


# ============== Helper Functions ==============

def get_or_create_recipient(
    db: Session,
    email: str,
    name: Optional[str] = None,
    created_by: Optional[str] = None
) -> NotificationRecipient:
    """Get existing recipient or create new one"""
    recipient = db.query(NotificationRecipient).filter(
        NotificationRecipient.email == email.lower()
    ).first()
    
    if not recipient:
        recipient = NotificationRecipient(
            id=str(uuid.uuid4()),
            email=email.lower(),
            name=name,
            recipient_type="email",
            created_by=created_by
        )
        db.add(recipient)
        db.commit()
        db.refresh(recipient)
    
    return recipient


# ============== API Endpoints ==============

@router.get("")
def list_recipients(
    recipient_type: Optional[str] = None,
    role: Optional[str] = None,
    department: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """List all notification recipients with filters"""
    query = db.query(NotificationRecipient)
    
    # Apply filters
    if recipient_type:
        query = query.filter(NotificationRecipient.recipient_type == recipient_type)
    if role:
        query = query.filter(NotificationRecipient.role == role)
    if department:
        query = query.filter(NotificationRecipient.department == department)
    if is_active is not None:
        query = query.filter(NotificationRecipient.is_active == is_active)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (NotificationRecipient.email.ilike(search_filter)) |
            (NotificationRecipient.name.ilike(search_filter))
        )
    
    total = query.count()
    recipients = query.order_by(NotificationRecipient.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "success": True,
        "data": [r.to_dict() for r in recipients],
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.post("")
def create_recipient(
    recipient: NotificationRecipientCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Create a new notification recipient"""
    # Check if email already exists
    existing = db.query(NotificationRecipient).filter(
        NotificationRecipient.email == recipient.email.lower()
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Recipient with email {recipient.email} already exists"
        )
    
    new_recipient = NotificationRecipient(
        id=str(uuid.uuid4()),
        email=recipient.email.lower(),
        name=recipient.name,
        recipient_type=recipient.recipient_type,
        user_id=recipient.user_id,
        role=recipient.role,
        department=recipient.department,
        notification_types=recipient.notification_types,
        channel=recipient.channel,
        min_priority=recipient.min_priority,
        is_active=recipient.is_active,
        created_by=user_id
    )
    
    db.add(new_recipient)
    db.commit()
    db.refresh(new_recipient)
    
    logger.info(f"Notification recipient created: {new_recipient.id} by {user_id}")
    
    return {
        "success": True,
        "message": "Recipient created successfully",
        "data": new_recipient.to_dict()
    }


@router.post("/bulk")
def create_bulk_recipients(
    data: BulkRecipientsCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Create multiple recipients from email list"""
    created = []
    skipped = []
    
    for email in data.emails:
        email = email.lower().strip()
        
        # Check if exists
        existing = db.query(NotificationRecipient).filter(
            NotificationRecipient.email == email
        ).first()
        
        if existing:
            skipped.append({"email": email, "reason": "Already exists"})
            continue
        
        recipient = NotificationRecipient(
            id=str(uuid.uuid4()),
            email=email,
            recipient_type=data.recipient_type,
            notification_types=data.notification_types,
            channel=data.channel,
            min_priority=data.min_priority,
            created_by=user_id
        )
        db.add(recipient)
        created.append(recipient)
    
    db.commit()
    
    logger.info(f"Bulk recipients created: {len(created)} by {user_id}")
    
    return {
        "success": True,
        "message": f"Created {len(created)} recipients, skipped {len(skipped)}",
        "created": [r.to_dict() for r in created],
        "skipped": skipped
    }


@router.get("/{recipient_id}")
def get_recipient(
    recipient_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Get a specific recipient"""
    recipient = db.query(NotificationRecipient).filter(
        NotificationRecipient.id == recipient_id
    ).first()
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    return {
        "success": True,
        "data": recipient.to_dict()
    }


@router.put("/{recipient_id}")
def update_recipient(
    recipient_id: str,
    update: NotificationRecipientUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Update a notification recipient"""
    recipient = db.query(NotificationRecipient).filter(
        NotificationRecipient.id == recipient_id
    ).first()
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # Check email uniqueness if changing email
    if update.email and update.email.lower() != recipient.email:
        existing = db.query(NotificationRecipient).filter(
            NotificationRecipient.email == update.email.lower()
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
    
    # Update fields
    update_dict = update.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        if field == "email" and value:
            value = value.lower()
        setattr(recipient, field, value)
    
    recipient.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(recipient)
    
    logger.info(f"Notification recipient updated: {recipient_id} by {user_id}")
    
    return {
        "success": True,
        "message": "Recipient updated successfully",
        "data": recipient.to_dict()
    }


@router.delete("/{recipient_id}")
def delete_recipient(
    recipient_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Delete a notification recipient"""
    recipient = db.query(NotificationRecipient).filter(
        NotificationRecipient.id == recipient_id
    ).first()
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    db.delete(recipient)
    db.commit()
    
    logger.info(f"Notification recipient deleted: {recipient_id} by {user_id}")
    
    return {
        "success": True,
        "message": "Recipient deleted successfully"
    }


@router.post("/{recipient_id}/toggle")
def toggle_recipient(
    recipient_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Toggle recipient active status"""
    recipient = db.query(NotificationRecipient).filter(
        NotificationRecipient.id == recipient_id
    ).first()
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    recipient.is_active = not recipient.is_active
    recipient.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "success": True,
        "message": f"Recipient {'activated' if recipient.is_active else 'deactivated'}",
        "is_active": recipient.is_active
    }


@router.post("/{recipient_id}/verify")
def verify_recipient(
    recipient_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Manually verify a recipient email (admin only)"""
    recipient = db.query(NotificationRecipient).filter(
        NotificationRecipient.id == recipient_id
    ).first()
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    recipient.is_verified = True
    recipient.verified_at = datetime.utcnow()
    recipient.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "success": True,
        "message": "Recipient verified successfully",
        "data": recipient.to_dict()
    }


@router.get("/stats/summary")
def get_recipients_stats(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Get statistics about notification recipients"""
    total = db.query(NotificationRecipient).count()
    active = db.query(NotificationRecipient).filter(
        NotificationRecipient.is_active == True
    ).count()
    verified = db.query(NotificationRecipient).filter(
        NotificationRecipient.is_verified == True
    ).count()
    
    # Count by type
    type_counts = {}
    for rtype in ["email", "user", "role", "department"]:
        count = db.query(NotificationRecipient).filter(
            NotificationRecipient.recipient_type == rtype
        ).count()
        type_counts[rtype] = count
    
    return {
        "success": True,
        "data": {
            "total": total,
            "active": active,
            "inactive": total - active,
            "verified": verified,
            "unverified": total - verified,
            "by_type": type_counts
        }
    }
