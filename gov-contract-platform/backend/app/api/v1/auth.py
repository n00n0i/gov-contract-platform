"""
Authentication API Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.schemas.auth import (
    UserLogin, TokenResponse, UserRegister, UserResponse,
    RefreshTokenRequest, PasswordChange, UserProfileUpdate
)
from app.services.identity.auth_service import AuthService
from app.core.security import get_current_user_id, get_current_user_payload
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()


@router.post("/login", response_model=TokenResponse)
def login(
    login_data: UserLogin,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Login with username and password
    """
    auth_service = AuthService(db)
    
    # Get client info
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")
    
    user, tokens = auth_service.login(login_data, ip_address, user_agent)
    return tokens


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    register_data: UserRegister,
    db: Session = Depends(get_db)
):
    """
    Register new user account
    """
    auth_service = AuthService(db)
    user = auth_service.register(register_data)
    return user


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    refresh_request: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token
    """
    auth_service = AuthService(db)
    return auth_service.refresh_token(refresh_request.refresh_token)


@router.post("/logout")
def logout(
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Logout current user
    """
    auth_service = AuthService(db)
    
    # Get refresh token from header if provided
    refresh_token = request.headers.get("X-Refresh-Token")
    auth_service.logout(user_id, refresh_token)
    
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get current user profile
    """
    from app.models.identity import User
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


@router.put("/me", response_model=UserResponse)
def update_profile(
    profile_data: UserProfileUpdate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Update current user profile
    """
    from app.models.identity import User
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update fields
    for field, value in profile_data.dict(exclude_unset=True).items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    return user


@router.post("/change-password")
def change_password(
    password_data: PasswordChange,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Change current user password
    """
    # Validate passwords match
    if password_data.new_password != password_data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirm password do not match"
        )
    
    auth_service = AuthService(db)
    auth_service.change_password(
        user_id, 
        password_data.current_password, 
        password_data.new_password
    )
    
    return {"message": "Password changed successfully"}


@router.get("/verify")
def verify_token(
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Verify if token is valid
    """
    return {
        "valid": True,
        "user_id": user_payload.get("sub"),
        "username": user_payload.get("username"),
        "permissions": user_payload.get("permissions", [])
    }
