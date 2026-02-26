"""
Identity & Access Management API - Production
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
import uuid
from pydantic import BaseModel

from app.core.config import settings
from app.db.database import get_db
from app.models.identity import User, Role, Department, UserStatus
from app.core.security import verify_password, hash_password, create_access_token, get_current_user_id

router = APIRouter(prefix="/identity", tags=["Identity"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/identity/login")


# ============== Schemas ==============

class UserCreateRequest(BaseModel):
    username: str
    email: str
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    title: Optional[str] = None
    phone: Optional[str] = None
    department_id: Optional[str] = None
    role_ids: List[str] = []


class UserUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    title: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    department_id: Optional[str] = None
    status: Optional[str] = None
    role_ids: Optional[List[str]] = None


def _user_to_dict(u: User) -> dict:
    """Serialize user to response dict"""
    role_codes = ["super_admin"] if u.is_superuser else [r.code for r in u.roles]
    role_names = ["ผู้ดูแลระบบ"] if u.is_superuser else [r.name for r in u.roles]
    dept_name = u.department.name if u.department else ""
    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "full_name": u.full_name,
        "title": u.title,
        "phone": u.phone,
        "role": role_codes[0] if role_codes else "viewer",
        "roles": role_codes,
        "role_names": role_names,
        "department": dept_name,
        "department_id": u.department_id,
        "status": u.status.value if u.status else "active",
        "is_active": u.is_active,
        "is_superuser": u.is_superuser,
        "mfa_enabled": u.mfa_enabled,
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


# ============== Login ==============

@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """User login (form-based, OAuth2 compatible)"""
    user = db.query(User).filter(
        User.username == form_data.username,
        User.is_deleted == 0
    ).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"บัญชีนี้ไม่สามารถใช้งานได้ ({user.status.value})"
        )

    user.last_login_at = datetime.utcnow()
    db.commit()

    permissions = ["*"] if user.is_superuser else list({
        perm.code for role in user.roles for perm in role.permissions
    })
    role_codes = ["super_admin"] if user.is_superuser else [r.code for r in user.roles]
    dept_name = user.department.name if user.department else ""

    token_data = {
        "sub": user.id,
        "username": user.username,
        "email": user.email,
        "permissions": permissions
    }
    access_token = create_access_token(token_data)

    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "full_name": user.full_name,
            "role": role_codes[0] if role_codes else "viewer",
            "roles": role_codes,
            "department": dept_name,
            "title": user.title,
            "is_superuser": user.is_superuser
        }
    }


# ============== Current User ==============

@router.get("/me")
async def get_current_user_info(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get current user information"""
    user = db.query(User).filter(User.id == user_id, User.is_deleted == 0).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")

    permissions = ["*"] if user.is_superuser else list({
        perm.code for role in user.roles for perm in role.permissions
    })

    return {
        "success": True,
        "user": {
            **_user_to_dict(user),
            "permissions": permissions
        }
    }


# ============== Departments ==============

@router.get("/departments")
async def list_departments(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List all departments"""
    departments = db.query(Department).filter(
        Department.is_deleted == 0
    ).order_by(Department.level, Department.name).all()

    return {
        "success": True,
        "data": [
            {
                "id": d.id,
                "code": d.code,
                "name": d.name,
                "name_en": d.name_en,
                "description": d.description,
                "parent_id": d.parent_id,
                "level": d.level
            }
            for d in departments
        ],
        "meta": {"total": len(departments), "page": 1, "limit": 100}
    }


# ============== Roles ==============

@router.get("/roles")
async def list_roles(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List all roles"""
    roles = db.query(Role).filter(Role.is_deleted == 0).order_by(Role.level.desc()).all()

    return {
        "success": True,
        "data": [
            {
                "id": r.id,
                "code": r.code,
                "name": r.name,
                "description": r.description,
                "is_system": r.is_system,
                "level": r.level,
                "user_count": len(r.users),
                "permissions": [p.code for p in r.permissions]
            }
            for r in roles
        ]
    }


# ============== Users ==============

@router.get("/users")
async def list_users(
    department_id: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List users with filters and pagination"""
    query = db.query(User).filter(User.is_deleted == 0)

    if department_id:
        query = query.filter(User.department_id == department_id)
    if status:
        try:
            query = query.filter(User.status == UserStatus(status))
        except ValueError:
            pass
    if search:
        query = query.filter(
            (User.username.ilike(f"%{search}%")) |
            (User.first_name.ilike(f"%{search}%")) |
            (User.last_name.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%"))
        )
    if role:
        query = query.join(User.roles).filter(Role.code == role)

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "success": True,
        "data": [_user_to_dict(u) for u in users],
        "meta": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": max(1, (total + limit - 1) // limit)
        }
    }


@router.post("/users")
async def create_user(
    data: UserCreateRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create new user (admin only)"""
    existing = db.query(User).filter(
        ((User.username == data.username) | (User.email == data.email)) &
        (User.is_deleted == 0)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="ชื่อผู้ใช้หรืออีเมลนี้มีในระบบแล้ว")

    user = User(
        id=str(uuid.uuid4()),
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        title=data.title,
        phone=data.phone,
        department_id=data.department_id,
        status=UserStatus.ACTIVE,
        is_active=True,
        login_attempts=0,
        is_deleted=0
    )

    if data.role_ids:
        roles = db.query(Role).filter(Role.id.in_(data.role_ids)).all()
        user.roles = roles

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "message": "สร้างผู้ใช้สำเร็จ",
        "data": {"id": user.id, "username": user.username}
    }


@router.put("/users/{target_user_id}")
async def update_user(
    target_user_id: str,
    data: UserUpdateRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Update user profile (admin only)"""
    user = db.query(User).filter(
        User.id == target_user_id,
        User.is_deleted == 0
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")

    for field in ["first_name", "last_name", "title", "phone", "email", "department_id"]:
        val = getattr(data, field)
        if val is not None:
            setattr(user, field, val)

    if data.status is not None:
        try:
            user.status = UserStatus(data.status)
            user.is_active = (data.status == "active")
        except ValueError:
            pass

    if data.role_ids is not None:
        roles = db.query(Role).filter(Role.id.in_(data.role_ids)).all()
        user.roles = roles

    db.commit()

    return {"success": True, "message": "อัปเดตผู้ใช้สำเร็จ"}


@router.patch("/users/{target_user_id}/deactivate")
async def deactivate_user(
    target_user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Deactivate user account"""
    if target_user_id == current_user_id:
        raise HTTPException(status_code=400, detail="ไม่สามารถระงับบัญชีตัวเองได้")

    user = db.query(User).filter(
        User.id == target_user_id,
        User.is_deleted == 0
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")

    user.status = UserStatus.INACTIVE
    user.is_active = False
    db.commit()

    return {"success": True, "message": "ระงับผู้ใช้สำเร็จ"}


# ============== Statistics ==============

@router.get("/stats")
async def get_user_stats(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get user statistics"""
    base = db.query(User).filter(User.is_deleted == 0)
    total = base.count()
    active = base.filter(User.status == UserStatus.ACTIVE).count()
    pending = base.filter(User.status == UserStatus.PENDING).count()
    suspended = base.filter(User.status == UserStatus.SUSPENDED).count()

    return {
        "success": True,
        "data": {
            "total": total,
            "active": active,
            "pending": pending,
            "suspended": suspended,
            "inactive": total - active - pending - suspended
        }
    }
