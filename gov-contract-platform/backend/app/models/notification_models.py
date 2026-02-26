"""
Notification Models - Global and User-specific notifications
"""
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.models.base import Base


class NotificationType(str, Enum):
    """Types of notifications"""
    CONTRACT_EXPIRY = "contract_expiry"
    CONTRACT_APPROVAL = "contract_approval"
    CONTRACT_CREATED = "contract_created"
    PAYMENT_DUE = "payment_due"
    PAYMENT_OVERDUE = "payment_overdue"
    DOCUMENT_UPLOADED = "document_uploaded"
    VENDOR_BLACKLIST = "vendor_blacklist"
    TASK_ASSIGNED = "task_assigned"
    TASK_DUE = "task_due"
    SYSTEM_MAINTENANCE = "system_maintenance"
    SECURITY_ALERT = "security_alert"
    AI_ANALYSIS_COMPLETE = "ai_analysis_complete"


class NotificationChannel(str, Enum):
    """Notification delivery channels"""
    IN_APP = "in_app"
    EMAIL = "email"
    BOTH = "both"


class NotificationPriority(str, Enum):
    """Notification priority levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class NotificationStatus(str, Enum):
    """Notification status"""
    PENDING = "pending"
    SENT = "sent"
    READ = "read"
    FAILED = "failed"


class SMTPSettings(Base):
    """SMTP Server Settings - Global configuration"""
    __tablename__ = "smtp_settings"
    
    id = Column(String, primary_key=True)
    host = Column(String, nullable=False)  # SMTP server host
    port = Column(String, nullable=False, default="587")  # SMTP port
    username = Column(String, nullable=False)  # SMTP username
    password = Column(String, nullable=False)  # SMTP password (encrypted)
    use_tls = Column(Boolean, default=True)  # Use TLS encryption
    use_ssl = Column(Boolean, default=False)  # Use SSL encryption
    from_email = Column(String, nullable=False)  # Sender email address
    from_name = Column(String, nullable=False, default="Gov Contract Platform")  # Sender name
    
    # Connection settings
    timeout = Column(String, default="30")  # Connection timeout in seconds
    max_retries = Column(String, default="3")  # Max retry attempts
    
    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)  # Whether settings have been tested
    last_tested = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)  # Last error message if any
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, ForeignKey("users.id"))
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary (hiding sensitive data)"""
        return {
            "id": self.id,
            "host": self.host,
            "port": self.port,
            "username": self.username,
            "password": "********" if self.password else "",  # Mask password
            "use_tls": self.use_tls,
            "use_ssl": self.use_ssl,
            "from_email": self.from_email,
            "from_name": self.from_name,
            "timeout": self.timeout,
            "max_retries": self.max_retries,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "last_tested": self.last_tested.isoformat() if self.last_tested else None,
            "last_error": self.last_error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class GlobalNotification(Base):
    """Global notification settings - applies to all users"""
    __tablename__ = "global_notifications"
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)  # Notification name
    description = Column(Text)  # Description of when this triggers
    
    # Notification type
    notification_type = Column(SQLEnum(NotificationType), nullable=False)
    
    # Channel settings
    channel = Column(SQLEnum(NotificationChannel), default=NotificationChannel.IN_APP)
    
    # Email settings (if channel is EMAIL or BOTH)
    email_subject_template = Column(String)  # Subject template with variables
    email_body_template = Column(Text)  # Body template with variables
    
    # Recipients for global notifications
    recipient_roles = Column(JSON, default=list)  # Roles that receive this notification
    recipient_emails = Column(JSON, default=list)  # Specific email addresses
    
    # Conditions for triggering
    conditions = Column(JSON, default=dict)  # {"days_before": 30, "status": "active"}
    
    # Schedule (for periodic notifications)
    is_scheduled = Column(Boolean, default=False)
    schedule_cron = Column(String)  # Cron expression for scheduled notifications
    
    # Status
    is_active = Column(Boolean, default=True)
    priority = Column(SQLEnum(NotificationPriority), default=NotificationPriority.MEDIUM)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, ForeignKey("users.id"))
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "notification_type": self.notification_type.value if self.notification_type else None,
            "channel": self.channel.value if self.channel else None,
            "email_subject_template": self.email_subject_template,
            "email_body_template": self.email_body_template,
            "recipient_roles": self.recipient_roles,
            "recipient_emails": self.recipient_emails,
            "conditions": self.conditions,
            "is_scheduled": self.is_scheduled,
            "schedule_cron": self.schedule_cron,
            "is_active": self.is_active,
            "priority": self.priority.value if self.priority else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class UserNotificationSetting(Base):
    """User-specific notification preferences"""
    __tablename__ = "user_notification_settings"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    
    # Notification type
    notification_type = Column(SQLEnum(NotificationType), nullable=False)
    
    # User preferences
    enabled = Column(Boolean, default=True)  # Whether this notification is enabled
    channel = Column(SQLEnum(NotificationChannel), default=NotificationChannel.IN_APP)
    
    # Email settings
    email = Column(String)  # Override email for this notification type
    
    # Frequency settings
    frequency = Column(String, default="immediate")  # immediate, daily_digest, weekly_digest
    digest_day = Column(String, nullable=True)  # For weekly: mon, tue, etc.
    digest_time = Column(String, nullable=True)  # HH:MM format
    
    # Quiet hours
    respect_quiet_hours = Column(Boolean, default=False)
    quiet_hours_start = Column(String, nullable=True)  # HH:MM
    quiet_hours_end = Column(String, nullable=True)  # HH:MM
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    user = relationship("User", back_populates="notification_settings")
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "notification_type": self.notification_type.value if self.notification_type else None,
            "enabled": self.enabled,
            "channel": self.channel.value if self.channel else None,
            "email": self.email,
            "frequency": self.frequency,
            "digest_day": self.digest_day,
            "digest_time": self.digest_time,
            "respect_quiet_hours": self.respect_quiet_hours,
            "quiet_hours_start": self.quiet_hours_start,
            "quiet_hours_end": self.quiet_hours_end,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class NotificationLog(Base):
    """Log of sent notifications"""
    __tablename__ = "notification_logs"
    
    id = Column(String, primary_key=True)
    
    # Reference
    notification_type = Column(SQLEnum(NotificationType), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)  # Null for global
    
    # Content
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    data = Column(JSON, default=dict)  # Additional data
    
    # Delivery
    channel = Column(SQLEnum(NotificationChannel), nullable=False)
    email_to = Column(String)  # Email address if sent via email
    
    # Status
    status = Column(SQLEnum(NotificationStatus), default=NotificationStatus.PENDING)
    error_message = Column(Text)
    sent_at = Column(DateTime)
    read_at = Column(DateTime)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "notification_type": self.notification_type.value if self.notification_type else None,
            "user_id": self.user_id,
            "title": self.title,
            "message": self.message,
            "data": self.data,
            "channel": self.channel.value if self.channel else None,
            "email_to": self.email_to,
            "status": self.status.value if self.status else None,
            "error_message": self.error_message,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class UserNotificationDigest(Base):
    """Stores digest notifications pending to be sent"""
    __tablename__ = "user_notification_digests"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    
    # Digest info
    frequency = Column(String, nullable=False)  # daily, weekly
    digest_date = Column(DateTime, nullable=False)  # When this digest should be sent
    
    # Collected notifications
    notifications = Column(JSON, default=list)  # List of notification data
    
    # Status
    is_sent = Column(Boolean, default=False)
    sent_at = Column(DateTime)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "frequency": self.frequency,
            "digest_date": self.digest_date.isoformat() if self.digest_date else None,
            "notifications": self.notifications,
            "is_sent": self.is_sent,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
