"""
Notifications API Routes - Global and User-specific notifications
"""
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.core.security import get_current_user_id, require_permissions
from app.core.logging import get_logger
from app.models.notification_models import (
    SMTPSettings, GlobalNotification, UserNotificationSetting,
    NotificationLog, NotificationType, NotificationChannel,
    NotificationPriority, NotificationStatus
)
from app.services.notification.email_service import get_email_service
from app.models.identity import User

router = APIRouter(prefix="/notifications", tags=["Notifications"])
logger = get_logger(__name__)


# ============== Schemas ==============

class SMTPSettingsCreate(BaseModel):
    host: str = Field(..., description="SMTP server host")
    port: str = Field("587", description="SMTP port")
    username: str = Field(..., description="SMTP username")
    password: str = Field(..., description="SMTP password")
    use_tls: bool = Field(True, description="Use TLS encryption")
    use_ssl: bool = Field(False, description="Use SSL encryption")
    from_email: str = Field(..., description="Sender email address")
    from_name: str = Field("Gov Contract Platform", description="Sender name")
    timeout: str = Field("30", description="Connection timeout in seconds")
    max_retries: str = Field("3", description="Max retry attempts")


class SMTPSettingsResponse(BaseModel):
    id: str
    host: str
    port: str
    username: str
    password: str  # Masked
    use_tls: bool
    use_ssl: bool
    from_email: str
    from_name: str
    is_active: bool
    is_verified: bool


class GlobalNotificationCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    notification_type: str
    channel: str = "in_app"
    email_subject_template: Optional[str] = None
    email_body_template: Optional[str] = None
    recipient_roles: List[str] = []
    recipient_emails: List[str] = []
    conditions: Dict[str, Any] = {}
    is_scheduled: bool = False
    schedule_cron: Optional[str] = None
    priority: str = "medium"


class UserNotificationSettingUpdate(BaseModel):
    enabled: Optional[bool] = None
    channel: Optional[str] = None
    email: Optional[str] = None
    frequency: Optional[str] = None
    digest_day: Optional[str] = None
    digest_time: Optional[str] = None
    respect_quiet_hours: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None


class TestEmailRequest(BaseModel):
    to_email: str
    subject: str = "Test Email"
    message: str = "This is a test email from Gov Contract Platform"


# ============== SMTP Settings Endpoints ==============

@router.get("/smtp")
def get_smtp_settings(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Get SMTP settings (admin only)"""
    settings = db.query(SMTPSettings).first()
    
    if not settings:
        return {
            "success": True,
            "data": None,
            "message": "SMTP settings not configured"
        }
    
    return {
        "success": True,
        "data": settings.to_dict()
    }


@router.post("/smtp")
def create_smtp_settings(
    settings: SMTPSettingsCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Create or update SMTP settings"""
    # Test connection first
    email_service = get_email_service()
    test_result = email_service.test_connection(
        SMTPSettings(**settings.model_dump())
    )
    
    # Check if settings already exist
    existing = db.query(SMTPSettings).first()
    
    if existing:
        # Update existing
        existing.host = settings.host
        existing.port = settings.port
        existing.username = settings.username
        existing.password = settings.password
        existing.use_tls = settings.use_tls
        existing.use_ssl = settings.use_ssl
        existing.from_email = settings.from_email
        existing.from_name = settings.from_name
        existing.timeout = settings.timeout
        existing.max_retries = settings.max_retries
        existing.is_verified = test_result["success"]
        existing.last_tested = datetime.utcnow()
        existing.last_error = None if test_result["success"] else test_result["message"]
        existing.updated_at = datetime.utcnow()
        
        db.commit()
        
        # Reload email service
        email_service.reload_settings()
        
        return {
            "success": True,
            "message": "SMTP settings updated",
            "data": existing.to_dict(),
            "connection_test": test_result
        }
    else:
        # Create new
        new_settings = SMTPSettings(
            id=str(uuid.uuid4()),
            **settings.model_dump(),
            is_verified=test_result["success"],
            last_tested=datetime.utcnow(),
            last_error=None if test_result["success"] else test_result["message"],
            created_by=user_id
        )
        
        db.add(new_settings)
        db.commit()
        
        # Reload email service
        email_service.reload_settings()
        
        return {
            "success": True,
            "message": "SMTP settings created",
            "data": new_settings.to_dict(),
            "connection_test": test_result
        }


@router.post("/smtp/test")
def test_smtp_connection(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Test current SMTP connection"""
    email_service = get_email_service()
    result = email_service.test_connection()
    
    # Update verification status
    settings = db.query(SMTPSettings).first()
    if settings:
        settings.is_verified = result["success"]
        settings.last_tested = datetime.utcnow()
        settings.last_error = None if result["success"] else result["message"]
        db.commit()
    
    return result


@router.post("/smtp/test-email")
def send_test_email(
    request: TestEmailRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Send a test email"""
    email_service = get_email_service()
    
    result = email_service.send_notification_email(
        to_email=request.to_email,
        notification_type="system",
        title=request.subject,
        message=request.message,
        action_url="http://localhost:3000"
    )
    
    return result


@router.delete("/smtp")
def delete_smtp_settings(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Delete SMTP settings"""
    settings = db.query(SMTPSettings).first()
    if not settings:
        raise HTTPException(status_code=404, detail="SMTP settings not found")
    
    db.delete(settings)
    db.commit()
    
    # Reload email service
    email_service = get_email_service()
    email_service.reload_settings()
    
    return {
        "success": True,
        "message": "SMTP settings deleted"
    }


# ============== Global Notifications Endpoints ==============

@router.get("/global")
def list_global_notifications(
    active_only: bool = False,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """List all global notifications"""
    query = db.query(GlobalNotification)
    
    if active_only:
        query = query.filter(GlobalNotification.is_active == True)
    
    notifications = query.order_by(GlobalNotification.created_at.desc()).all()
    
    return {
        "success": True,
        "data": [n.to_dict() for n in notifications],
        "count": len(notifications)
    }


@router.post("/global")
def create_global_notification(
    notification: GlobalNotificationCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Create a global notification"""
    new_notification = GlobalNotification(
        id=str(uuid.uuid4()),
        **notification.model_dump(),
        is_active=True,
        created_by=user_id
    )
    
    db.add(new_notification)
    db.commit()
    
    logger.info(f"Global notification created: {new_notification.id} by {user_id}")
    
    return {
        "success": True,
        "message": "Global notification created",
        "data": new_notification.to_dict()
    }


@router.put("/global/{notification_id}")
def update_global_notification(
    notification_id: str,
    update: GlobalNotificationCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Update a global notification"""
    notification = db.query(GlobalNotification).filter(
        GlobalNotification.id == notification_id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    for field, value in update.model_dump().items():
        setattr(notification, field, value)
    
    notification.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "success": True,
        "message": "Global notification updated",
        "data": notification.to_dict()
    }


@router.delete("/global/{notification_id}")
def delete_global_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Delete a global notification"""
    notification = db.query(GlobalNotification).filter(
        GlobalNotification.id == notification_id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    db.delete(notification)
    db.commit()
    
    return {
        "success": True,
        "message": "Global notification deleted"
    }


# ============== User Notification Settings Endpoints ==============

@router.get("/user/settings")
def get_user_notification_settings(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Get current user's notification settings"""
    settings = db.query(UserNotificationSetting).filter(
        UserNotificationSetting.user_id == user_id
    ).all()
    
    # If no settings exist, create defaults
    if not settings:
        default_types = [
            NotificationType.CONTRACT_EXPIRY,
            NotificationType.PAYMENT_DUE,
            NotificationType.TASK_ASSIGNED,
            NotificationType.AI_ANALYSIS_COMPLETE
        ]
        
        for notif_type in default_types:
            default_setting = UserNotificationSetting(
                id=str(uuid.uuid4()),
                user_id=user_id,
                notification_type=notif_type,
                enabled=True,
                channel=NotificationChannel.BOTH,
                frequency="immediate"
            )
            db.add(default_setting)
        
        db.commit()
        settings = db.query(UserNotificationSetting).filter(
            UserNotificationSetting.user_id == user_id
        ).all()
    
    return {
        "success": True,
        "data": [s.to_dict() for s in settings]
    }


@router.put("/user/settings/{setting_id}")
def update_user_notification_setting(
    setting_id: str,
    update: UserNotificationSettingUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Update a user notification setting"""
    setting = db.query(UserNotificationSetting).filter(
        UserNotificationSetting.id == setting_id,
        UserNotificationSetting.user_id == user_id
    ).first()
    
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    
    update_dict = update.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(setting, field, value)
    
    setting.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "success": True,
        "message": "Notification setting updated",
        "data": setting.to_dict()
    }


@router.post("/user/settings/bulk")
def update_bulk_user_settings(
    settings: List[Dict[str, Any]],
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Update multiple user notification settings at once"""
    updated = []
    
    for setting_data in settings:
        setting_id = setting_data.get("id")
        if not setting_id:
            continue
        
        setting = db.query(UserNotificationSetting).filter(
            UserNotificationSetting.id == setting_id,
            UserNotificationSetting.user_id == user_id
        ).first()
        
        if setting:
            for field, value in setting_data.items():
                if field != "id" and hasattr(setting, field):
                    setattr(setting, field, value)
            setting.updated_at = datetime.utcnow()
            updated.append(setting_id)
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Updated {len(updated)} settings",
        "updated_count": len(updated)
    }


@router.get("/user/email")
def get_user_notification_email(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Get user's notification email (can be different from login email)"""
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get notification email from preferences
    prefs = user.preferences or {}
    notification_email = prefs.get("notification_email", user.email)
    
    return {
        "success": True,
        "data": {
            "notification_email": notification_email,
            "login_email": user.email,
            "use_different_email": notification_email != user.email
        }
    }


@router.post("/user/email")
def set_user_notification_email(
    email: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Set user's notification email"""
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    prefs = user.preferences or {}
    prefs["notification_email"] = email
    user.preferences = prefs
    db.commit()
    
    return {
        "success": True,
        "message": "Notification email updated",
        "data": {"notification_email": email}
    }


# ============== Notification Logs Endpoints ==============

@router.get("/logs")
def get_notification_logs(
    limit: int = 50,
    offset: int = 0,
    notification_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Get notification logs (admin only)"""
    query = db.query(NotificationLog)
    
    if notification_type:
        query = query.filter(NotificationLog.notification_type == notification_type)
    
    if status:
        query = query.filter(NotificationLog.status == status)
    
    total = query.count()
    logs = query.order_by(NotificationLog.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "success": True,
        "data": [log.to_dict() for log in logs],
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/logs/my")
def get_my_notification_logs(
    limit: int = 50,
    offset: int = 0,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Get current user's notification logs"""
    query = db.query(NotificationLog).filter(
        NotificationLog.user_id == user_id
    )
    
    if unread_only:
        query = query.filter(NotificationLog.status == NotificationStatus.SENT)
    
    total = query.count()
    logs = query.order_by(NotificationLog.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "success": True,
        "data": [log.to_dict() for log in logs],
        "total": total,
        "unread_count": query.filter(NotificationLog.status == NotificationStatus.SENT).count()
    }


@router.post("/logs/{log_id}/read")
def mark_notification_read(
    log_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Mark a notification as read"""
    log = db.query(NotificationLog).filter(
        NotificationLog.id == log_id,
        NotificationLog.user_id == user_id
    ).first()
    
    if not log:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    log.status = NotificationStatus.READ
    log.read_at = datetime.utcnow()
    db.commit()
    
    return {
        "success": True,
        "message": "Notification marked as read"
    }


# ============== Notification Types Metadata ==============

@router.get("/types")
def get_notification_types(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Get all available notification types with descriptions"""
    types = [
        {
            "value": "contract_expiry",
            "label": "สัญญาใกล้หมดอายุ",
            "description": "แจ้งเตือนเมื่อสัญญาใกล้หมดอายุ",
            "category": "contract"
        },
        {
            "value": "contract_approval",
            "label": "สัญญารออนุมัติ",
            "description": "แจ้งเตือนเมื่อมีสัญญารอการอนุมัติ",
            "category": "contract"
        },
        {
            "value": "contract_created",
            "label": "สัญญาใหม่",
            "description": "แจ้งเตือนเมื่อมีสัญญาใหม่",
            "category": "contract"
        },
        {
            "value": "payment_due",
            "label": "กำหนดการจ่ายเงิน",
            "description": "แจ้งเตือนกำหนดการจ่ายเงิน",
            "category": "payment"
        },
        {
            "value": "payment_overdue",
            "label": "การจ่ายเงินเลยกำหนด",
            "description": "แจ้งเตือนเมื่อการจ่ายเงินเลยกำหนด",
            "category": "payment"
        },
        {
            "value": "document_uploaded",
            "label": "เอกสารใหม่",
            "description": "แจ้งเตือนเมื่อมีการอัปโหลดเอกสาร",
            "category": "document"
        },
        {
            "value": "vendor_blacklist",
            "label": "ผู้รับจ้างใน Blacklist",
            "description": "แจ้งเตือนเมื่อพบผู้รับจ้างใน Blacklist",
            "category": "vendor"
        },
        {
            "value": "task_assigned",
            "label": "งานที่ได้รับมอบหมาย",
            "description": "แจ้งเตือนเมื่อมีงานมอบหมาย",
            "category": "task"
        },
        {
            "value": "task_due",
            "label": "งานใกล้ครบกำหนด",
            "description": "แจ้งเตือนเมื่องานใกล้ครบกำหนด",
            "category": "task"
        },
        {
            "value": "ai_analysis_complete",
            "label": "AI วิเคราะห์เสร็จสิ้น",
            "description": "แจ้งเตือนเมื่อ AI วิเคราะห์เสร็จสิ้น",
            "category": "ai"
        },
        {
            "value": "system_maintenance",
            "label": "การบำรุงรักษาระบบ",
            "description": "แจ้งเตือนการบำรุงรักษาระบบ",
            "category": "system"
        },
        {
            "value": "security_alert",
            "label": "แจ้งเตือนความปลอดภัย",
            "description": "แจ้งเตือนเมื่อพบกิจกรรมที่น่าสงสัย",
            "category": "security"
        }
    ]
    
    return {
        "success": True,
        "data": types
    }
