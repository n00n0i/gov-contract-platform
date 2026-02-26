"""
Email Service - SMTP Email Sending
"""
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List, Dict, Any
from datetime import datetime
from jinja2 import Template

from app.core.logging import get_logger
from app.db.database import SessionLocal
from app.models.notification_models import SMTPSettings, NotificationLog, NotificationStatus

logger = get_logger(__name__)


class EmailService:
    """Service for sending emails via SMTP"""
    
    def __init__(self):
        self.smtp_settings = None
        self._load_settings()
    
    def _load_settings(self):
        """Load active SMTP settings from database"""
        try:
            db = SessionLocal()
            self.smtp_settings = db.query(SMTPSettings).filter(
                SMTPSettings.is_active == True
            ).first()
            db.close()
        except Exception as e:
            logger.error(f"Failed to load SMTP settings: {e}")
            self.smtp_settings = None
    
    def reload_settings(self):
        """Reload SMTP settings (call after settings change)"""
        self._load_settings()
    
    def _get_smtp_connection(self):
        """Create SMTP connection based on settings"""
        if not self.smtp_settings:
            raise ValueError("SMTP settings not configured")
        
        host = self.smtp_settings.host
        port = int(self.smtp_settings.port)
        
        if self.smtp_settings.use_ssl:
            context = ssl.create_default_context()
            server = smtplib.SMTP_SSL(host, port, context=context, timeout=int(self.smtp_settings.timeout))
        else:
            server = smtplib.SMTP(host, port, timeout=int(self.smtp_settings.timeout))
            if self.smtp_settings.use_tls:
                context = ssl.create_default_context()
                server.starttls(context=context)
        
        # Login
        server.login(self.smtp_settings.username, self.smtp_settings.password)
        return server
    
    def test_connection(self, settings: Optional[SMTPSettings] = None) -> Dict[str, Any]:
        """Test SMTP connection"""
        try:
            test_settings = settings or self.smtp_settings
            if not test_settings:
                return {
                    "success": False,
                    "message": "No SMTP settings configured"
                }
            
            host = test_settings.host
            port = int(test_settings.port)
            
            # Try to connect
            if test_settings.use_ssl:
                context = ssl.create_default_context()
                server = smtplib.SMTP_SSL(host, port, context=context, timeout=10)
            else:
                server = smtplib.SMTP(host, port, timeout=10)
                if test_settings.use_tls:
                    context = ssl.create_default_context()
                    server.starttls(context=context)
            
            # Try to login
            server.login(test_settings.username, test_settings.password)
            server.quit()
            
            return {
                "success": True,
                "message": "SMTP connection successful"
            }
        except Exception as e:
            logger.error(f"SMTP test failed: {e}")
            return {
                "success": False,
                "message": f"SMTP connection failed: {str(e)}"
            }
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """Send a single email"""
        try:
            if not self.smtp_settings:
                raise ValueError("SMTP settings not configured")
            
            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.smtp_settings.from_name} <{self.smtp_settings.from_email}>"
            msg["To"] = to_email
            
            if cc:
                msg["Cc"] = ", ".join(cc)
            if bcc:
                msg["Bcc"] = ", ".join(bcc)
            
            # Add plain text part
            msg.attach(MIMEText(body, "plain", "utf-8"))
            
            # Add HTML part if provided
            if html_body:
                msg.attach(MIMEText(html_body, "html", "utf-8"))
            
            # Send email
            with self._get_smtp_connection() as server:
                all_recipients = [to_email]
                if cc:
                    all_recipients.extend(cc)
                if bcc:
                    all_recipients.extend(bcc)
                
                server.sendmail(
                    self.smtp_settings.from_email,
                    all_recipients,
                    msg.as_string()
                )
            
            logger.info(f"Email sent successfully to {to_email}")
            return {
                "success": True,
                "message": "Email sent successfully",
                "recipient": to_email
            }
        
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return {
                "success": False,
                "message": f"Failed to send email: {str(e)}",
                "recipient": to_email
            }
    
    def send_bulk_emails(
        self,
        recipients: List[str],
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        template_data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Send emails to multiple recipients"""
        results = {
            "success": True,
            "total": len(recipients),
            "sent": 0,
            "failed": 0,
            "errors": []
        }
        
        for recipient in recipients:
            # Apply template if data provided
            if template_data:
                rendered_subject = self._render_template(subject, template_data)
                rendered_body = self._render_template(body, template_data)
                rendered_html = self._render_template(html_body, template_data) if html_body else None
            else:
                rendered_subject = subject
                rendered_body = body
                rendered_html = html_body
            
            result = self.send_email(
                to_email=recipient,
                subject=rendered_subject,
                body=rendered_body,
                html_body=rendered_html
            )
            
            if result["success"]:
                results["sent"] += 1
            else:
                results["failed"] += 1
                results["errors"].append({
                    "recipient": recipient,
                    "error": result["message"]
                })
        
        results["success"] = results["failed"] == 0
        return results
    
    def _render_template(self, template_str: str, data: Dict) -> str:
        """Render Jinja2 template with data"""
        try:
            template = Template(template_str)
            return template.render(**data)
        except Exception as e:
            logger.error(f"Template rendering failed: {e}")
            return template_str
    
    def send_notification_email(
        self,
        to_email: str,
        notification_type: str,
        title: str,
        message: str,
        data: Optional[Dict] = None,
        action_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send a notification email with standard template"""
        # Build HTML body with standard template
        html_body = self._build_notification_html(
            title=title,
            message=message,
            notification_type=notification_type,
            data=data,
            action_url=action_url
        )
        
        # Add signature
        plain_body = f"{message}\n\n---\nGov Contract Platform\nระบบบริหารจัดการสัญญาภาครัฐ"
        
        return self.send_email(
            to_email=to_email,
            subject=title,
            body=plain_body,
            html_body=html_body
        )
    
    def _build_notification_html(
        self,
        title: str,
        message: str,
        notification_type: str,
        data: Optional[Dict] = None,
        action_url: Optional[str] = None
    ) -> str:
        """Build HTML notification email with standard template"""
        
        # Color scheme based on notification type
        colors = {
            "contract_expiry": "#f59e0b",  # Yellow
            "contract_approval": "#3b82f6",  # Blue
            "payment_due": "#ef4444",  # Red
            "payment_overdue": "#dc2626",  # Dark Red
            "task_assigned": "#8b5cf6",  # Purple
            "security_alert": "#ef4444",  # Red
            "default": "#3b82f6"  # Blue
        }
        accent_color = colors.get(notification_type, colors["default"])
        
        action_button = ""
        if action_url:
            action_button = f"""
            <div style="margin-top: 24px; text-align: center;">
                <a href="{action_url}" 
                   style="background-color: {accent_color}; color: white; padding: 12px 32px; 
                          text-decoration: none; border-radius: 6px; display: inline-block;">
                    ดำเนินการ
                </a>
            </div>
            """
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>{title}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                    <td align="center" style="padding: 24px 16px;">
                        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            <!-- Header -->
                            <tr>
                                <td style="padding: 24px; border-bottom: 4px solid {accent_color}; text-align: center;">
                                    <h1 style="margin: 0; color: #1f2937; font-size: 24px; font-weight: 600;">
                                        Gov Contract Platform
                                    </h1>
                                    <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">
                                        ระบบบริหารจัดการสัญญาภาครัฐ
                                    </p>
                                </td>
                            </tr>
                            
                            <!-- Content -->
                            <tr>
                                <td style="padding: 32px 24px;">
                                    <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 20px; font-weight: 600;">
                                        {title}
                                    </h2>
                                    <div style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                                        {message}
                                    </div>
                                    {action_button}
                                </td>
                            </tr>
                            
                            <!-- Footer -->
                            <tr>
                                <td style="padding: 24px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
                                    <p style="margin: 0;">
                                        อีเมลนี้ส่งจาก Gov Contract Platform<br>
                                        หากไม่ต้องการรับอีเมล กรุณาปรับการตั้งค่าการแจ้งเตือน
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
        return html


# Global email service instance
email_service = EmailService()


def get_email_service() -> EmailService:
    """Get email service instance"""
    return email_service
