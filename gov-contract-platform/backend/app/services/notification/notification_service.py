"""
Notification Service - Main service for sending notifications
"""
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.notification_models import (
    NotificationLog, NotificationType, NotificationChannel,
    NotificationStatus, NotificationPriority,
    GlobalNotification, UserNotificationSetting
)
from app.models.identity import User
from app.services.notification.email_service import get_email_service

logger = get_logger(__name__)


class NotificationService:
    """Main service for handling notifications"""
    
    def __init__(self, db: Session):
        self.db = db
        self.email_service = get_email_service()
    
    def send_notification(
        self,
        notification_type: NotificationType,
        title: str,
        message: str,
        user_id: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
        action_url: Optional[str] = None,
        priority: NotificationPriority = NotificationPriority.MEDIUM
    ) -> Dict[str, Any]:
        """
        Send a notification to user(s)
        
        Args:
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            user_id: Specific user ID (None for global notifications)
            data: Additional data
            action_url: Action URL for the notification
            priority: Priority level
        """
        results = {
            "success": True,
            "in_app_sent": 0,
            "email_sent": 0,
            "failed": 0,
            "errors": []
        }
        
        # Get recipients
        if user_id:
            # Send to specific user
            user = self.db.query(User).filter(User.id == user_id).first()
            if user:
                result = self._send_to_user(
                    user=user,
                    notification_type=notification_type,
                    title=title,
                    message=message,
                    data=data,
                    action_url=action_url
                )
                results["in_app_sent"] += result.get("in_app", 0)
                results["email_sent"] += result.get("email", 0)
                if not result["success"]:
                    results["failed"] += 1
                    results["errors"].append(result.get("error"))
        else:
            # Send to all users based on global notification settings
            result = self._send_global(
                notification_type=notification_type,
                title=title,
                message=message,
                data=data,
                action_url=action_url
            )
            results["in_app_sent"] += result.get("in_app", 0)
            results["email_sent"] += result.get("email", 0)
            if result.get("errors"):
                results["errors"].extend(result["errors"])
        
        return results
    
    def _send_to_user(
        self,
        user: User,
        notification_type: NotificationType,
        title: str,
        message: str,
        data: Optional[Dict] = None,
        action_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send notification to a specific user"""
        result = {"success": True, "in_app": 0, "email": 0}
        
        # Get user notification settings
        setting = self.db.query(UserNotificationSetting).filter(
            UserNotificationSetting.user_id == user.id,
            UserNotificationSetting.notification_type == notification_type
        ).first()
        
        # Check if user has enabled this notification type
        if setting and not setting.enabled:
            logger.info(f"Notification {notification_type.value} disabled for user {user.id}")
            return result
        
        # Determine channel
        channel = NotificationChannel.BOTH
        if setting and setting.channel:
            channel = setting.channel
        
        # Get email address
        email = user.email
        if setting and setting.email:
            email = setting.email
        
        # Send in-app notification
        if channel in [NotificationChannel.IN_APP, NotificationChannel.BOTH]:
            log = NotificationLog(
                id=str(uuid.uuid4()),
                notification_type=notification_type,
                user_id=user.id,
                title=title,
                message=message,
                data=data or {},
                channel=NotificationChannel.IN_APP,
                status=NotificationStatus.SENT,
                sent_at=datetime.utcnow()
            )
            self.db.add(log)
            result["in_app"] = 1
        
        # Send email notification
        if channel in [NotificationChannel.EMAIL, NotificationChannel.BOTH]:
            email_result = self.email_service.send_notification_email(
                to_email=email,
                notification_type=notification_type.value,
                title=title,
                message=message,
                data=data,
                action_url=action_url
            )
            
            if email_result["success"]:
                # Log email notification
                log = NotificationLog(
                    id=str(uuid.uuid4()),
                    notification_type=notification_type,
                    user_id=user.id,
                    title=title,
                    message=message,
                    data=data or {},
                    channel=NotificationChannel.EMAIL,
                    email_to=email,
                    status=NotificationStatus.SENT,
                    sent_at=datetime.utcnow()
                )
                self.db.add(log)
                result["email"] = 1
            else:
                # Log failed email
                log = NotificationLog(
                    id=str(uuid.uuid4()),
                    notification_type=notification_type,
                    user_id=user.id,
                    title=title,
                    message=message,
                    data=data or {},
                    channel=NotificationChannel.EMAIL,
                    email_to=email,
                    status=NotificationStatus.FAILED,
                    error_message=email_result.get("message", "Unknown error")
                )
                self.db.add(log)
                result["success"] = False
                result["error"] = email_result.get("message")
        
        self.db.commit()
        return result
    
    def _send_global(
        self,
        notification_type: NotificationType,
        title: str,
        message: str,
        data: Optional[Dict] = None,
        action_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send global notification"""
        result = {"success": True, "in_app": 0, "email": 0, "errors": []}
        
        # Get global notification settings
        global_notif = self.db.query(GlobalNotification).filter(
            GlobalNotification.notification_type == notification_type,
            GlobalNotification.is_active == True
        ).first()
        
        if not global_notif:
            logger.info(f"No active global notification for type {notification_type.value}")
            return result
        
        # Get recipients
        recipients = []
        
        # Get users by roles
        if global_notif.recipient_roles:
            role_users = self.db.query(User).filter(
                User.role.in_(global_notif.recipient_roles)
            ).all()
            recipients.extend(role_users)
        
        # Get specific email addresses
        specific_emails = []
        if global_notif.recipient_emails:
            specific_emails = global_notif.recipient_emails
        
        # Send to role-based recipients
        for user in recipients:
            user_result = self._send_to_user(
                user=user,
                notification_type=notification_type,
                title=title,
                message=message,
                data=data,
                action_url=action_url
            )
            result["in_app"] += user_result.get("in_app", 0)
            result["email"] += user_result.get("email", 0)
            if not user_result["success"]:
                result["errors"].append(user_result.get("error"))
        
        # Send to specific email addresses
        for email in specific_emails:
            email_result = self.email_service.send_notification_email(
                to_email=email,
                notification_type=notification_type.value,
                title=title,
                message=message,
                data=data,
                action_url=action_url
            )
            
            if email_result["success"]:
                # Log notification
                log = NotificationLog(
                    id=str(uuid.uuid4()),
                    notification_type=notification_type,
                    title=title,
                    message=message,
                    data=data or {},
                    channel=NotificationChannel.EMAIL,
                    email_to=email,
                    status=NotificationStatus.SENT,
                    sent_at=datetime.utcnow()
                )
                self.db.add(log)
                result["email"] += 1
            else:
                result["errors"].append(email_result.get("message"))
        
        self.db.commit()
        return result
    
    def create_digest_notifications(self, frequency: str = "daily"):
        """Create digest notifications for users with digest preference"""
        # Find users with digest setting
        settings = self.db.query(UserNotificationSetting).filter(
            UserNotificationSetting.frequency == frequency,
            UserNotificationSetting.enabled == True
        ).all()
        
        for setting in settings:
            # Collect pending notifications
            pending = self.db.query(NotificationLog).filter(
                NotificationLog.user_id == setting.user_id,
                NotificationLog.status == NotificationStatus.SENT,
                NotificationLog.notification_type == setting.notification_type
            ).all()
            
            if pending:
                # Create digest
                # TODO: Implement digest creation logic
                pass
    
    def get_unread_count(self, user_id: str) -> int:
        """Get unread notification count for user"""
        return self.db.query(NotificationLog).filter(
            NotificationLog.user_id == user_id,
            NotificationLog.status == NotificationStatus.SENT
        ).count()
    
    def mark_all_read(self, user_id: str) -> int:
        """Mark all notifications as read for user"""
        logs = self.db.query(NotificationLog).filter(
            NotificationLog.user_id == user_id,
            NotificationLog.status == NotificationStatus.SENT
        ).all()
        
        for log in logs:
            log.status = NotificationStatus.READ
            log.read_at = datetime.utcnow()
        
        self.db.commit()
        return len(logs)


def get_notification_service(db: Session) -> NotificationService:
    """Get notification service instance"""
    return NotificationService(db)
