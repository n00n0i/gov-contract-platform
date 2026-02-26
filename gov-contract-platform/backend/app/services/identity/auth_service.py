"""
Authentication Service - Business Logic
"""
from datetime import datetime, timedelta
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import uuid

from app.models.identity import User, UserSession, UserStatus
from app.schemas.auth import UserLogin, UserRegister, TokenResponse
from app.core.security import (
    verify_password, hash_password, create_access_token, 
    create_refresh_token, decode_token
)
from app.core.config import settings


class AuthService:
    """Authentication service"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """Authenticate user with username and password"""
        user = self.db.query(User).filter(
            User.username == username,
            User.is_deleted == 0
        ).first()
        
        if not user:
            return None
        
        if not verify_password(password, user.password_hash):
            return None
        
        return user
    
    def login(self, login_data: UserLogin, ip_address: str = None, 
              user_agent: str = None) -> Tuple[User, TokenResponse]:
        """Login user and return tokens"""
        user = self.authenticate_user(login_data.username, login_data.password)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )
        
        # Check user status
        if user.status != UserStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is {user.status}"
            )
        
        # Update last login
        user.last_login_at = datetime.utcnow()
        self.db.commit()
        
        # Get user permissions
        permissions = self._get_user_permissions(user)
        
        # Create tokens
        token_data = {
            "sub": user.id,
            "username": user.username,
            "email": user.email,
            "tenant_id": user.tenant_id,
            "permissions": permissions
        }
        
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token({"sub": user.id})
        
        # Save session
        self._create_session(user.id, refresh_token, ip_address, user_agent)
        
        token_response = TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        
        return user, token_response
    
    def register(self, register_data: UserRegister) -> User:
        """Register new user"""
        # Check if username exists
        existing_user = self.db.query(User).filter(
            ((User.username == register_data.username) | (User.email == register_data.email)) &
            (User.is_deleted == 0)
        ).first()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username or email already exists"
            )
        
        # Create new user
        user = User(
            id=str(uuid.uuid4()),
            username=register_data.username,
            email=register_data.email,
            password_hash=hash_password(register_data.password),
            first_name=register_data.first_name,
            last_name=register_data.last_name,
            phone=register_data.phone,
            department_id=register_data.department_id,
            status=UserStatus.ACTIVE,
            tenant_id=None,  # Will be set during onboarding
            login_attempts=0,
            is_deleted=0
        )
        
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        
        return user
    
    def refresh_token(self, refresh_token: str) -> TokenResponse:
        """Refresh access token"""
        payload = decode_token(refresh_token)
        
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        user_id = payload.get("sub")
        user = self.db.query(User).filter(
            User.id == user_id,
            User.is_deleted == 0
        ).first()
        
        if not user or user.status != UserStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        # Get permissions
        permissions = self._get_user_permissions(user)
        
        # Create new tokens
        token_data = {
            "sub": user.id,
            "username": user.username,
            "email": user.email,
            "tenant_id": user.tenant_id,
            "permissions": permissions
        }
        
        new_access_token = create_access_token(token_data)
        new_refresh_token = create_refresh_token({"sub": user.id})
        
        # Revoke old session and create new one
        self._revoke_session(refresh_token)
        self._create_session(user.id, new_refresh_token)
        
        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    
    def logout(self, user_id: str, refresh_token: str = None):
        """Logout user"""
        if refresh_token:
            self._revoke_session(refresh_token)
        else:
            # Revoke all sessions for user
            self.db.query(UserSession).filter(
                UserSession.user_id == user_id,
                UserSession.is_active == True
            ).update({"is_active": False})
            self.db.commit()
    
    def change_password(self, user_id: str, current_password: str, 
                        new_password: str):
        """Change user password"""
        user = self.db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if not verify_password(current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        user.password_hash = hash_password(new_password)
        user.password_changed_at = datetime.utcnow()
        self.db.commit()
    
    def _get_user_permissions(self, user: User) -> list:
        """Get all permissions for user"""
        permissions = set()
        
        for role in user.roles:
            for perm in role.permissions:
                permissions.add(perm.code)
        
        return list(permissions)
    
    def _create_session(self, user_id: str, refresh_token: str, 
                        ip_address: str = None, user_agent: str = None):
        """Create user session"""
        session = UserSession(
            id=str(uuid.uuid4()),
            user_id=user_id,
            refresh_token=refresh_token,
            ip_address=ip_address,
            user_agent=user_agent,
            expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            is_active=True,
            tenant_id="default"
        )
        self.db.add(session)
        self.db.commit()
    
    def _revoke_session(self, refresh_token: str):
        """Revoke user session"""
        self.db.query(UserSession).filter(
            UserSession.refresh_token == refresh_token
        ).update({"is_active": False})
        self.db.commit()
