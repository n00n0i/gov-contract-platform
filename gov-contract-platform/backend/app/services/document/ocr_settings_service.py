"""
OCR Settings Service - Centralized OCR configuration management

This service provides a single source of truth for all OCR-related settings.
Any function that needs to perform OCR should use this service to get settings.
"""
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.identity import User
from app.core.logging import get_logger

logger = get_logger(__name__)


class OCRSettingsService:
    """
    Centralized OCR Settings Service
    
    All document processing functions must use this service to get OCR settings.
    This ensures consistent OCR behavior across the entire application.
    """
    
    # Default OCR settings
    DEFAULT_SETTINGS = {
        "mode": "default",  # default | typhoon | custom
        "engine": "tesseract",
        "language": "tha+eng",
        "dpi": 300,
        "auto_rotate": True,
        "deskew": True,
        "enhance_contrast": True,
        "extract_tables": True,
        "confidence_threshold": 80,
        # Typhoon OCR settings
        "typhoon_url": "https://api.opentyphoon.ai/v1/ocr",
        "typhoon_key": "sk-N0BWvEJ7sMUxQrE9k4JIRL9ehdGZZRy7fP3gPtnie8QkZ8Kg",
        "typhoon_model": "typhoon-ocr",
        "typhoon_task_type": "default",
        "typhoon_max_tokens": 16384,
        "typhoon_temperature": 0.1,
        "typhoon_top_p": 0.6,
        "typhoon_repetition_penalty": 1.2,
        "typhoon_pages": "",
        # Custom API settings
        "custom_api_url": "",
        "custom_api_key": "",
        "custom_api_model": "",
        # OCR Template/Prompt
        "ocr_template": """คุณเป็นระบบ OCR สำหรับเอกสารสัญญาภาครัฐ

กรุณาอ่านเอกสารที่ให้มาและสกัดข้อมูลตามโครงสร้างนี้:

1. เลขที่สัญญา: [contract_number]
2. ชื่อสัญญา: [title]
3. ผู้ว่าจ้าง: [employer]
4. ผู้รับจ้าง: [contractor]
5. มูลค่าสัญญา: [value] บาท
6. วันเริ่มต้น: [start_date]
7. วันสิ้นสุด: [end_date]
8. รายละเอียดงาน: [description]

หมายเหตุ: 
- ถ้าไม่พบข้อมูลให้ใส่ "-"
- วันที่ให้ใช้รูปแบบ YYYY-MM-DD
- มูลค่าให้ระบุเฉพาะตัวเลข ไม่ต้องใส่คำว่า "บาท"""
    }
    
    def __init__(self, db: Session, user_id: Optional[str] = None):
        """
        Initialize OCR Settings Service
        
        Args:
            db: Database session
            user_id: User ID to get user-specific settings (optional)
        """
        self.db = db
        self.user_id = user_id
        self._settings: Optional[Dict[str, Any]] = None
    
    def get_settings(self, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Get OCR settings - this is the main method to use
        
        Returns user settings if available, otherwise returns defaults.
        All OCR operations should call this method.
        
        Args:
            force_refresh: Force reload from database
            
        Returns:
            Dict containing OCR settings
        """
        if self._settings is not None and not force_refresh:
            return self._settings
        
        # If user_id is provided, get user-specific settings
        if self.user_id:
            try:
                user = self.db.query(User).filter(User.id == self.user_id).first()
                if user and user.preferences:
                    user_ocr_settings = user.preferences.get("ocr_settings", {})
                    if user_ocr_settings:
                        # Merge with defaults to ensure all keys exist
                        self._settings = {**self.DEFAULT_SETTINGS, **user_ocr_settings}
                        logger.debug(f"Loaded OCR settings for user {self.user_id}")
                        return self._settings
            except Exception as e:
                logger.error(f"Error loading OCR settings for user {self.user_id}: {e}")
        
        # Return default settings
        self._settings = self.DEFAULT_SETTINGS.copy()
        return self._settings
    
    def get_setting(self, key: str, default: Any = None) -> Any:
        """
        Get a specific OCR setting
        
        Args:
            key: Setting key
            default: Default value if key not found
            
        Returns:
            Setting value
        """
        settings = self.get_settings()
        return settings.get(key, default)
    
    def get_language(self) -> str:
        """Get OCR language setting"""
        return self.get_setting("language", "tha+eng")
    
    def get_mode(self) -> str:
        """Get OCR mode (default, typhoon, custom)"""
        return self.get_setting("mode", "default")
    
    def get_dpi(self) -> int:
        """Get OCR DPI setting"""
        return self.get_setting("dpi", 300)
    
    def get_engine(self) -> str:
        """Get OCR engine"""
        return self.get_setting("engine", "tesseract")
    
    def get_confidence_threshold(self) -> int:
        """Get confidence threshold"""
        return self.get_setting("confidence_threshold", 80)
    
    def should_auto_rotate(self) -> bool:
        """Check if auto-rotate is enabled"""
        return self.get_setting("auto_rotate", True)
    
    def should_deskew(self) -> bool:
        """Check if deskew is enabled"""
        return self.get_setting("deskew", True)
    
    def should_enhance_contrast(self) -> bool:
        """Check if contrast enhancement is enabled"""
        return self.get_setting("enhance_contrast", True)
    
    def should_extract_tables(self) -> bool:
        """Check if table extraction is enabled"""
        return self.get_setting("extract_tables", True)
    
    def get_typhoon_settings(self) -> Dict[str, Any]:
        """Get Typhoon OCR specific settings"""
        settings = self.get_settings()
        return {
            "url": settings.get("typhoon_url", "https://api.opentyphoon.ai/v1/ocr"),
            "api_key": settings.get("typhoon_key", ""),
            "model": settings.get("typhoon_model", "typhoon-ocr"),
            "task_type": settings.get("typhoon_task_type", "default"),
            "max_tokens": settings.get("typhoon_max_tokens", 16384),
            "temperature": settings.get("typhoon_temperature", 0.1),
            "top_p": settings.get("typhoon_top_p", 0.6),
            "repetition_penalty": settings.get("typhoon_repetition_penalty", 1.2),
            "pages": settings.get("typhoon_pages", ""),
        }
    
    def get_custom_api_settings(self) -> Dict[str, Any]:
        """Get Custom API OCR specific settings"""
        settings = self.get_settings()
        return {
            "url": settings.get("custom_api_url", ""),
            "api_key": settings.get("custom_api_key", ""),
            "model": settings.get("custom_api_model", ""),
        }
    
    def get_ocr_template(self) -> str:
        """Get OCR template/prompt"""
        return self.get_setting("ocr_template", self.DEFAULT_SETTINGS["ocr_template"])
    
    def is_typhoon_configured(self) -> bool:
        """Check if Typhoon OCR is properly configured"""
        typhoon_settings = self.get_typhoon_settings()
        return bool(typhoon_settings.get("api_key"))
    
    def is_custom_api_configured(self) -> bool:
        """Check if Custom API OCR is properly configured"""
        custom_settings = self.get_custom_api_settings()
        return bool(custom_settings.get("url"))
    
    def validate_settings(self) -> Dict[str, Any]:
        """
        Validate current OCR settings
        
        Returns:
            Dict with validation results
        """
        mode = self.get_mode()
        errors = []
        warnings = []
        
        if mode == "typhoon":
            if not self.is_typhoon_configured():
                errors.append("Typhoon API key is required but not configured")
        elif mode == "custom":
            if not self.is_custom_api_configured():
                errors.append("Custom API URL is required but not configured")
        
        # Check language setting
        language = self.get_language()
        if not language:
            warnings.append("OCR language not set, using default")
        
        return {
            "valid": len(errors) == 0,
            "mode": mode,
            "errors": errors,
            "warnings": warnings
        }


# Convenience function for getting OCR settings
def get_ocr_settings_service(db: Session, user_id: Optional[str] = None) -> OCRSettingsService:
    """
    Get OCR Settings Service instance
    
    This is the recommended way to access OCR settings.
    All document processing should use this function.
    
    Example:
        ocr_service = get_ocr_settings_service(db, user_id)
        settings = ocr_service.get_settings()
        language = ocr_service.get_language()
    """
    return OCRSettingsService(db=db, user_id=user_id)
