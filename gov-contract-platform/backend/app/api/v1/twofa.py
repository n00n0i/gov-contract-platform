"""
Two-Factor Authentication (2FA) API Routes
"""
import io
import base64
import logging
from typing import Optional

import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.security import get_current_user_id, get_current_user_payload
from app.core.logging import get_logger
from app.models.identity import User

router = APIRouter(prefix="/auth/2fa", tags=["2FA"])
logger = get_logger(__name__)


class TwoFAResponse:
    """2FA response model"""
    def __init__(self, success: bool, message: str, data: Optional[dict] = None):
        self.success = success
        self.message = message
        self.data = data


@router.get("/status")
def get_2fa_status(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get current user's 2FA status
    """
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {
                "success": True,
                "enabled": False,
                "has_secret": False
            }
        
        return {
            "success": True,
            "enabled": user.mfa_enabled,
            "has_secret": bool(user.mfa_secret)
        }
    except Exception as e:
        logger.error(f"Error fetching 2FA status: {e}")
        return {
            "success": True,
            "enabled": False,
            "has_secret": False
        }


@router.post("/setup")
def setup_2fa(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Setup 2FA for current user
    Returns: QR code URL, secret key, and provisioning URI
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.mfa_enabled:
        raise HTTPException(
            status_code=400, 
            detail="2FA is already enabled. Please disable it first."
        )
    
    # Generate new secret
    secret = pyotp.random_base32()
    
    # Generate provisioning URI for QR code
    totp = pyotp.TOTP(secret)
    issuer_name = "Gov Contract Platform"
    provisioning_uri = totp.provisioning_uri(
        name=user.email,
        issuer_name=issuer_name
    )
    
    # Generate QR code image
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    
    # Create QR code image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    qr_code_base64 = base64.b64encode(buffered.getvalue()).decode()
    
    # Save secret temporarily (not enabled yet, need verification)
    user.mfa_secret = secret
    db.commit()
    
    logger.info(f"2FA setup initiated for user {user_id}")
    
    return {
        "success": True,
        "message": "Scan the QR code with your authenticator app",
        "data": {
            "secret": secret,
            "qr_code": f"data:image/png;base64,{qr_code_base64}",
            "provisioning_uri": provisioning_uri,
            "manual_entry_key": secret,
            "instructions": [
                "1. ดาวน์โหลด Authenticator App (Google Authenticator, Microsoft Authenticator, หรือ Authy)",
                "2. สแกน QR Code หรือป้อนรหัสด้วยตนเอง",
                "3. ป้อนรหัส 6 หลักที่แสดงในแอพเพื่อยืนยัน"
            ]
        }
    }


@router.post("/verify")
def verify_and_enable_2fa(
    code: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Verify TOTP code and enable 2FA
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.mfa_secret:
        raise HTTPException(
            status_code=400, 
            detail="2FA setup not initiated. Please call /setup first."
        )
    
    if user.mfa_enabled:
        raise HTTPException(
            status_code=400, 
            detail="2FA is already enabled."
        )
    
    # Verify TOTP code
    totp = pyotp.TOTP(user.mfa_secret)
    
    if not totp.verify(code, valid_window=1):  # Allow 1 time step window
        raise HTTPException(
            status_code=400,
            detail="Invalid verification code. Please try again."
        )
    
    # Enable 2FA
    user.mfa_enabled = True
    db.commit()
    
    logger.info(f"2FA enabled for user {user_id}")
    
    return {
        "success": True,
        "message": "2FA has been successfully enabled",
        "data": {
            "enabled": True,
            "backup_codes": generate_backup_codes()  # Generate backup codes
        }
    }


@router.post("/disable")
def disable_2fa(
    code: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Disable 2FA (requires current TOTP code for security)
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.mfa_enabled:
        raise HTTPException(
            status_code=400,
            detail="2FA is not enabled."
        )
    
    # Verify TOTP code before disabling
    totp = pyotp.TOTP(user.mfa_secret)
    
    if not totp.verify(code, valid_window=1):
        raise HTTPException(
            status_code=400,
            detail="Invalid verification code. Cannot disable 2FA."
        )
    
    # Disable 2FA
    user.mfa_enabled = False
    user.mfa_secret = None
    db.commit()
    
    logger.info(f"2FA disabled for user {user_id}")
    
    return {
        "success": True,
        "message": "2FA has been disabled"
    }


@router.post("/validate")
def validate_2fa_code(
    code: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Validate a TOTP code (for login verification)
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.mfa_enabled:
        return {
            "success": True,
            "valid": True,
            "message": "2FA is not enabled for this user"
        }
    
    totp = pyotp.TOTP(user.mfa_secret)
    is_valid = totp.verify(code, valid_window=1)
    
    return {
        "success": True,
        "valid": is_valid,
        "message": "Code is valid" if is_valid else "Invalid code"
    }


def generate_backup_codes(count: int = 8) -> list:
    """Generate backup codes for 2FA recovery"""
    import secrets
    codes = []
    for _ in range(count):
        code = secrets.token_hex(4).upper()  # 8 characters
        codes.append(f"{code[:4]}-{code[4:]}")
    return codes
