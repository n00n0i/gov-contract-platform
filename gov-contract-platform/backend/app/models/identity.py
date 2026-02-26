"""
Identity & Access Management Models
"""
from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text, ForeignKey, Table, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from app.models.base import BaseModel, Base, TenantMixin, TimestampMixin
import enum


# Association tables
user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', String(36), ForeignKey('users.id')),
    Column('role_id', String(36), ForeignKey('roles.id'))
)

role_permissions = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', String(36), ForeignKey('roles.id')),
    Column('permission_id', String(36), ForeignKey('permissions.id'))
)


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING = "pending"


class User(BaseModel):
    """User account model"""
    
    __tablename__ = 'users'
    
    # Basic Info
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    
    # Profile
    first_name = Column(String(100))
    last_name = Column(String(100))
    title = Column(String(100))  # ตำแหน่ง
    phone = Column(String(20))
    
    # Status
    status = Column(Enum(UserStatus), default=UserStatus.PENDING)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    
    # Organization (New Structure)
    org_unit_id = Column(String(36), ForeignKey('organization_units.id'), nullable=True)
    position_id = Column(String(36), ForeignKey('positions.id'), nullable=True)
    
    # Legacy fields (for backward compatibility)
    department_id = Column(String(36), ForeignKey('departments.id'))
    division_id = Column(String(36), ForeignKey('divisions.id'))
    
    # Security
    last_login_at = Column(DateTime(timezone=True))
    last_login_ip = Column(String(50))
    login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True))
    password_changed_at = Column(DateTime(timezone=True))
    
    # MFA
    mfa_enabled = Column(Boolean, default=False)
    mfa_secret = Column(String(255))
    
    # Preferences
    preferences = Column(JSONB, default=dict)
    notification_prefs = Column(JSONB, default=dict)  # Renamed to avoid conflict with relationship
    
    
    # Relationships
    roles = relationship("Role", secondary=user_roles, back_populates="users")
    department = relationship("Department", back_populates="users")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    ai_providers = relationship("AIProvider", foreign_keys="AIProvider.user_id", back_populates="user", cascade="all, delete-orphan")
    
    # Organization relationships
    org_unit = relationship("OrganizationUnit", back_populates="users")
    position = relationship("Position", back_populates="users")
    
    # Notification relationships
    notification_settings = relationship("UserNotificationSetting", back_populates="user", cascade="all, delete-orphan")
    
    @property
    def full_name(self):
        return f"{self.first_name or ''} {self.last_name or ''}".strip()
    
    def has_permission(self, permission_code: str) -> bool:
        """Check if user has specific permission"""
        if self.is_superuser:
            return True
        for role in self.roles:
            for perm in role.permissions:
                if perm.code == permission_code:
                    return True
        return False
    
    def has_role(self, role_code: str) -> bool:
        """Check if user has specific role"""
        return any(role.code == role_code for role in self.roles)


class Role(BaseModel):
    """Role-based access control"""
    
    __tablename__ = 'roles'
    
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    is_system = Column(Boolean, default=False)  # ไม่สามารถลบได้
    
    # Hierarchy
    level = Column(Integer, default=0)  # ระดับสิทธิ์ (สูง = มาก)
    parent_id = Column(String(36), ForeignKey('roles.id'))
    
    # Relationships
    users = relationship("User", secondary=user_roles, back_populates="roles")
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")
    parent = relationship("Role", remote_side="Role.id", backref="children")
    access_policies = relationship("AccessPolicy", back_populates="role", cascade="all, delete-orphan")


class Permission(BaseModel):
    """Permission definitions"""
    
    __tablename__ = 'permissions'
    
    code = Column(String(100), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    module = Column(String(50), nullable=False)  # contracts, users, reports, etc.
    action = Column(String(50), nullable=False)  # read, write, delete, approve
    
    # Relationships
    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")


class UserSession(Base, TimestampMixin):
    """User session tracking"""
    
    __tablename__ = 'user_sessions'
    
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    tenant_id = Column(String(50), nullable=False, index=True)
    
    # Token info
    access_token = Column(Text)
    refresh_token = Column(Text)
    expires_at = Column(DateTime(timezone=True))
    
    # Session info
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    device_info = Column(JSONB)
    
    # Status
    is_active = Column(Boolean, default=True)
    revoked_at = Column(DateTime(timezone=True))
    
    # Relationships
    user = relationship("User", back_populates="sessions")


class Department(BaseModel):
    """Department/กอง"""
    
    __tablename__ = 'departments'
    
    code = Column(String(20), nullable=False)
    name = Column(String(200), nullable=False)
    name_en = Column(String(200))
    description = Column(Text)
    
    # Hierarchy
    parent_id = Column(String(36), ForeignKey('departments.id'))
    level = Column(Integer, default=1)
    order = Column(Integer, default=0)
    
    # Contact
    email = Column(String(255))
    phone = Column(String(20))
    
    # Relationships
    users = relationship("User", back_populates="department")
    divisions = relationship("Division", back_populates="department")
    parent = relationship("Department", remote_side="Department.id", backref="children")
    
    # Unique constraint per tenant
    __table_args__ = (
        # tenant_id + code must be unique
    )


class Division(BaseModel):
    """Division/งาน"""
    
    __tablename__ = 'divisions'
    
    code = Column(String(20), nullable=False)
    name = Column(String(200), nullable=False)
    name_en = Column(String(200))
    description = Column(Text)
    
    department_id = Column(String(36), ForeignKey('departments.id'), nullable=False)
    
    # Contact
    email = Column(String(255))
    phone = Column(String(20))
    
    # Relationships
    department = relationship("Department", back_populates="divisions")
    users = relationship("User", backref="division")


class Tenant(Base, TimestampMixin):
    """Multi-tenant organization"""
    
    __tablename__ = 'tenants'
    
    id = Column(String(36), primary_key=True)
    code = Column(String(50), unique=True, nullable=False)  # รหัสหน่วยงาน
    name = Column(String(200), nullable=False)
    name_en = Column(String(200))
    
    # Type
    type = Column(String(50), default="government")  # government, state_enterprise, etc.
    
    # Status
    status = Column(String(20), default="active")  # active, suspended, inactive
    
    # Configuration
    config = Column(JSONB, default=dict)
    features = Column(ARRAY(String), default=list)  # Enabled features
    limits = Column(JSONB, default=dict)  # Resource limits
    
    # Branding
    logo_url = Column(String(500))
    primary_color = Column(String(7), default="#1a237e")
    
    # Contact
    admin_email = Column(String(255))
    admin_phone = Column(String(20))
    
    # Billing (for SaaS mode)
    plan = Column(String(50), default="free")
    subscription_expires_at = Column(DateTime(timezone=True))
    
    # Database (for dedicated DB per tenant)
    database_url = Column(String(500))
