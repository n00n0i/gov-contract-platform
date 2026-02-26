"""
Access Control API Routes - จัดการสิทธิ์การเข้าถึง
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.core.security import get_current_user_id
from app.core.logging import get_logger
from app.services.access_control_service import AccessControlService, get_access_control_service
from app.models.access_control import PermissionScope, ResourceType

router = APIRouter(prefix="/access", tags=["Access Control"])
logger = get_logger(__name__)


# ============== Schemas ==============

class KBAccessGrant(BaseModel):
    kb_id: str
    org_unit_id: Optional[str] = None
    user_id: Optional[str] = None
    can_read: bool = True
    can_contribute: bool = False
    can_manage: bool = False
    inherit_to_children: bool = True


class KBAccessRevoke(BaseModel):
    kb_id: str
    org_unit_id: Optional[str] = None
    user_id: Optional[str] = None


class AccessCheckRequest(BaseModel):
    resource_type: ResourceType
    resource_id: str
    action: str = "read"


class AccessPolicyCreate(BaseModel):
    role_id: str
    resource_type: ResourceType
    resource_id: Optional[str] = None
    can_view: bool = True
    can_create: bool = False
    can_edit: bool = False
    can_delete: bool = False
    can_approve: bool = False
    can_manage: bool = False
    scope: PermissionScope = PermissionScope.OWN


# ============== Knowledge Base Access Endpoints ==============

@router.post("/kb/grant")
def grant_kb_access(
    data: KBAccessGrant,
    current_user_id: str = Depends(get_current_user_id),
    access_service: AccessControlService = Depends(get_access_control_service)
):
    """ให้สิทธิ์เข้าถึง Knowledge Base"""
    # ตรวจสอบสิทธิ์ผู้ให้
    if not access_service.can_access_knowledge_base(current_user_id, data.kb_id, "manage"):
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์จัดการ Knowledge Base นี้")
    
    if data.org_unit_id:
        success = access_service.grant_kb_access_to_org(
            data.kb_id, data.org_unit_id,
            data.can_read, data.can_contribute, data.can_manage, data.inherit_to_children
        )
    elif data.user_id:
        # Grant to user
        import uuid
        from app.models.access_control import KBUserAccess
        from app.db.database import get_db
        db = next(get_db())
        
        access = KBUserAccess(
            id=str(uuid.uuid4()),
            knowledge_base_id=data.kb_id,
            user_id=data.user_id,
            can_read=data.can_read,
            can_contribute=data.can_contribute,
            can_manage=data.can_manage,
            granted_by=current_user_id
        )
        db.add(access)
        db.commit()
        success = True
    else:
        raise HTTPException(status_code=400, detail="ต้องระบุ org_unit_id หรือ user_id")
    
    if success:
        # Log
        access_service.log_access(
            current_user_id, "grant_access", "knowledge_base", data.kb_id, True,
            org_unit_id=data.org_unit_id, user_id=data.user_id
        )
        return {"success": True, "message": "ให้สิทธิ์สำเร็จ"}
    
    raise HTTPException(status_code=500, detail="ไม่สามารถให้สิทธิ์ได้")


@router.post("/kb/revoke")
def revoke_kb_access(
    data: KBAccessRevoke,
    current_user_id: str = Depends(get_current_user_id),
    access_service: AccessControlService = Depends(get_access_control_service)
):
    """ถอนสิทธิ์เข้าถึง Knowledge Base"""
    if not access_service.can_access_knowledge_base(current_user_id, data.kb_id, "manage"):
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์จัดการ Knowledge Base นี้")
    
    success = access_service.revoke_kb_access(
        data.kb_id, data.org_unit_id, data.user_id
    )
    
    if success:
        access_service.log_access(
            current_user_id, "revoke_access", "knowledge_base", data.kb_id, True
        )
        return {"success": True, "message": "ถอนสิทธิ์สำเร็จ"}
    
    raise HTTPException(status_code=500, detail="ไม่สามารถถอนสิทธิ์ได้")


@router.get("/kb/{kb_id}/permissions")
def get_kb_permissions(
    kb_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """ดูสิทธิ์การเข้าถึง Knowledge Base"""
    from app.models.access_control import KBOrgAccess, KBUserAccess
    from app.models.identity import User
    from app.models.organization import OrganizationUnit
    
    # Org access
    org_access = db.query(KBOrgAccess).filter(
        KBOrgAccess.knowledge_base_id == kb_id
    ).all()
    
    org_permissions = []
    for access in org_access:
        org = db.query(OrganizationUnit).filter(OrganizationUnit.id == access.org_unit_id).first()
        org_permissions.append({
            "type": "organization",
            "org_id": access.org_unit_id,
            "org_name": org.name_th if org else None,
            "can_read": access.can_read,
            "can_contribute": access.can_contribute,
            "can_manage": access.can_manage,
            "inherit": access.inherit_to_children
        })
    
    # User access
    user_access = db.query(KBUserAccess).filter(
        KBUserAccess.knowledge_base_id == kb_id
    ).all()
    
    user_permissions = []
    for access in user_access:
        user = db.query(User).filter(User.id == access.user_id).first()
        user_permissions.append({
            "type": "user",
            "user_id": access.user_id,
            "username": user.username if user else None,
            "can_read": access.can_read,
            "can_contribute": access.can_contribute,
            "can_manage": access.can_manage
        })
    
    return {
        "success": True,
        "data": org_permissions + user_permissions
    }


# ============== Access Check Endpoints ==============

@router.post("/check")
def check_access(
    data: AccessCheckRequest,
    request: Request,
    current_user_id: str = Depends(get_current_user_id),
    access_service: AccessControlService = Depends(get_access_control_service)
):
    """ตรวจสอบสิทธิ์การเข้าถึง"""
    has_access = False
    
    if data.resource_type == ResourceType.KNOWLEDGE_BASE:
        has_access = access_service.can_access_knowledge_base(
            current_user_id, data.resource_id, data.action
        )
    elif data.resource_type == ResourceType.CONTRACT:
        has_access = access_service.can_access_contract(
            current_user_id, data.resource_id, data.action
        )
    else:
        # Generic permission check
        has_access = access_service.has_permission(
            current_user_id, f"{data.action}_{data.resource_type}",
            data.resource_type, data.resource_id
        )
    
    # Log access check
    access_service.log_access(
        current_user_id, f"check_{data.action}",
        data.resource_type.value, data.resource_id, has_access,
        ip_address=request.client.host
    )
    
    return {
        "success": True,
        "has_access": has_access,
        "resource_type": data.resource_type,
        "resource_id": data.resource_id,
        "action": data.action
    }


# ============== My Access Endpoints ==============

@router.get("/my/knowledge-bases")
def get_my_knowledge_bases(
    action: str = "read",
    current_user_id: str = Depends(get_current_user_id),
    access_service: AccessControlService = Depends(get_access_control_service)
):
    """ดู Knowledge Base ที่ฉันมีสิทธิ์เข้าถึง"""
    kbs = access_service.get_user_knowledge_bases(current_user_id, action)
    
    return {
        "success": True,
        "data": [kb.to_dict() for kb in kbs],
        "count": len(kbs)
    }


@router.get("/my/permissions")
def get_my_permissions(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """ดูสิทธิ์ของฉัน"""
    from app.models.identity import User
    
    user = db.query(User).filter(User.id == current_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    permissions = []
    for role in user.roles:
        for perm in role.permissions:
            permissions.append({
                "code": perm.code,
                "name": perm.name,
                "module": perm.module,
                "action": perm.action
            })
    
    return {
        "success": True,
        "roles": [r.name for r in user.roles],
        "permissions": permissions,
        "org_unit": user.org_unit.to_dict() if user.org_unit else None,
        "position": user.position.to_dict() if user.position else None
    }


# ============== Audit Log Endpoints ==============

@router.get("/audit-logs")
def get_audit_logs(
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 50,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """ดูบันทึกการเข้าถึง (Admin only)"""
    from app.models.identity import User
    from app.models.access_control import AccessLog
    
    user = db.query(User).filter(User.id == current_user_id).first()
    if not user or not user.is_superuser:
        raise HTTPException(status_code=403, detail="ต้องเป็น Super Admin")
    
    query = db.query(AccessLog)
    
    if user_id:
        query = query.filter(AccessLog.user_id == user_id)
    if resource_type:
        query = query.filter(AccessLog.resource_type == resource_type)
    if action:
        query = query.filter(AccessLog.action == action)
    
    logs = query.order_by(AccessLog.timestamp.desc()).limit(limit).all()
    
    return {
        "success": True,
        "data": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "success": log.success,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "ip_address": log.ip_address
            }
            for log in logs
        ]
    }
