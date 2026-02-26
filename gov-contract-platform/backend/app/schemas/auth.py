"""
Authentication Schemas - Pydantic Models
"""
from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional, List
from datetime import datetime


class UserLogin(BaseModel):
    """User login request"""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)


class TokenResponse(BaseModel):
    """Token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class TokenPayload(BaseModel):
    """JWT token payload"""
    sub: str  # user_id
    username: str
    email: str
    tenant_id: Optional[str] = None
    permissions: List[str] = []
    exp: datetime
    type: str


class UserRegister(BaseModel):
    """User registration request"""
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    department_id: Optional[str] = None


class UserResponse(BaseModel):
    """User response data"""
    id: str
    username: str
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    title: Optional[str]
    phone: Optional[str]
    status: str
    tenant_id: Optional[str]
    department_id: Optional[str]
    org_unit_id: Optional[str] = None
    position_id: Optional[str] = None
    roles: List[str] = []
    permissions: List[str] = []
    is_superuser: bool = False
    created_at: datetime
    last_login_at: Optional[datetime] = None
    
    # Computed field for role (first role or 'user')
    role: str = 'user'
    
    class Config:
        from_attributes = True
    
    @validator('roles', pre=True, always=True)
    def extract_roles(cls, v):
        """Extract role codes from SQLAlchemy relationship"""
        if v is None:
            return []
        # If already a list of strings, return as is
        if isinstance(v, list) and len(v) > 0 and isinstance(v[0], str):
            return v
        # If SQLAlchemy relationship, extract role.code
        try:
            return [role.code for role in v if hasattr(role, 'code')]
        except:
            return []
    
    @validator('role', pre=True, always=True)
    def compute_role(cls, v, values):
        """Compute role from roles list or is_superuser"""
        roles = values.get('roles', [])
        is_superuser = values.get('is_superuser', False)
        
        # If superuser, always return super_admin
        if is_superuser:
            return 'super_admin'
        
        # Return first role or default to 'user'
        if roles and len(roles) > 0:
            return roles[0]
        return 'user'


class UserProfileUpdate(BaseModel):
    """User profile update request"""
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    title: Optional[str] = Field(None, max_length=100)


class PasswordChange(BaseModel):
    """Password change request"""
    current_password: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str
    
    def validate_passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("New password and confirm password do not match")
        return self


class RefreshTokenRequest(BaseModel):
    """Refresh token request"""
    refresh_token: str


class PasswordResetRequest(BaseModel):
    """Password reset request"""
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Password reset confirmation"""
    token: str
    new_password: str = Field(..., min_length=8)


class LoginHistoryResponse(BaseModel):
    """Login history entry"""
    id: str
    ip_address: Optional[str]
    user_agent: Optional[str]
    login_at: datetime
    success: bool
    failure_reason: Optional[str]
