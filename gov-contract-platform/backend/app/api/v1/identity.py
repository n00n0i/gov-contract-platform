"""
Identity & Access Management API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import List, Optional
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

router = APIRouter(prefix="/identity", tags=["Identity"])

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/identity/login")

# Mock data for demo
MOCK_USERS = {
    "admin": {
        "id": "usr-001",
        "username": "admin",
        "password": pwd_context.hash("admin123"),
        "email": "admin@gov.th",
        "first_name": "System",
        "last_name": "Administrator",
        "role": "super_admin",
        "department": "สำนักงานปลัด",
        "tenant_id": "TENANT-001"
    },
    "officer1": {
        "id": "usr-002",
        "username": "officer1",
        "password": pwd_context.hash("officer123"),
        "email": "officer1@gov.go.th",
        "first_name": "สมชาย",
        "last_name": "ใจดี",
        "role": "contract_officer",
        "department": "กองพัสดุ",
        "tenant_id": "TENANT-001"
    }
}


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")


@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    User login
    
    Demo credentials:
    - admin / admin123
    - officer1 / officer123
    """
    user = MOCK_USERS.get(form_data.username)
    
    if not user or not pwd_context.verify(form_data.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(
        data={
            "sub": user["username"],
            "user_id": user["id"],
            "role": user["role"],
            "tenant_id": user["tenant_id"]
        }
    )
    
    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "first_name": user["first_name"],
            "last_name": user["last_name"],
            "full_name": f"{user['first_name']} {user['last_name']}",
            "role": user["role"],
            "department": user["department"]
        }
    }


@router.get("/me")
async def get_current_user_info(token: str = Depends(oauth2_scheme)):
    """Get current user information"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication")
    
    user = MOCK_USERS.get(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "success": True,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "first_name": user["first_name"],
            "last_name": user["last_name"],
            "full_name": f"{user['first_name']} {user['last_name']}",
            "role": user["role"],
            "department": user["department"],
            "tenant_id": user["tenant_id"],
            "permissions": [
                "contracts:read", "contracts:write",
                "vendors:read", "reports:read"
            ]
        }
    }


@router.get("/departments")
async def list_departments():
    """List all departments"""
    return {
        "success": True,
        "data": [
            {
                "id": "dept-001",
                "code": "PROCUREMENT",
                "name": "กองพัสดุ",
                "name_en": "Procurement Division",
                "description": " responsible for procurement activities"
            },
            {
                "id": "dept-002",
                "code": "FINANCE",
                "name": "กองการคลัง",
                "name_en": "Finance Division",
                "description": " responsible for financial management"
            },
            {
                "id": "dept-003",
                "code": "LEGAL",
                "name": "กองกฎหมาย",
                "name_en": "Legal Division",
                "description": " responsible for legal matters"
            }
        ],
        "meta": {
            "total": 3,
            "page": 1,
            "limit": 20
        }
    }


@router.get("/roles")
async def list_roles():
    """List all roles"""
    return {
        "success": True,
        "data": [
            {
                "id": "role-001",
                "code": "super_admin",
                "name": "ผู้ดูแลระบบ",
                "description": "Full system access",
                "permissions": ["*"]
            },
            {
                "id": "role-002",
                "code": "contract_officer",
                "name": "เจ้าหน้าที่สัญญา",
                "description": "Can manage contracts",
                "permissions": [
                    "contracts:read", "contracts:write",
                    "vendors:read", "reports:read"
                ]
            },
            {
                "id": "role-003",
                "code": "approver",
                "name": "ผู้อนุมัติ",
                "description": "Can approve contracts",
                "permissions": [
                    "contracts:read", "contracts:approve",
                    "reports:read"
                ]
            },
            {
                "id": "role-004",
                "code": "viewer",
                "name": "ผู้ดูข้อมูล",
                "description": "Read-only access",
                "permissions": [
                    "contracts:read", "reports:read"
                ]
            }
        ]
    }


@router.get("/users")
async def list_users(
    department_id: Optional[str] = None,
    role: Optional[str] = None,
    page: int = 1,
    limit: int = 20
):
    """List users with filters"""
    users = [
        {
            "id": "usr-001",
            "username": "admin",
            "email": "admin@gov.go.th",
            "full_name": "System Administrator",
            "role": "super_admin",
            "department": "สำนักงานปลัด",
            "status": "active",
            "last_login": "2024-01-15T10:30:00Z"
        },
        {
            "id": "usr-002",
            "username": "officer1",
            "email": "officer1@gov.go.th",
            "full_name": "สมชาย ใจดี",
            "role": "contract_officer",
            "department": "กองพัสดุ",
            "status": "active",
            "last_login": "2024-01-15T09:00:00Z"
        },
        {
            "id": "usr-003",
            "username": "officer2",
            "email": "officer2@gov.go.th",
            "full_name": "สมหญิง รักเรียน",
            "role": "contract_officer",
            "department": "กองกฎหมาย",
            "status": "active",
            "last_login": "2024-01-14T16:30:00Z"
        }
    ]
    
    # Apply filters
    if department_id:
        users = [u for u in users if u["department"] == department_id]
    if role:
        users = [u for u in users if u["role"] == role]
    
    return {
        "success": True,
        "data": users,
        "meta": {
            "total": len(users),
            "page": page,
            "limit": limit
        }
    }
