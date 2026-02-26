"""
Access Control Service - ระบบตรวจสอบสิทธิ์แบบเชื่อมโยงโครงสร้างองค์กร
"""
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.core.logging import get_logger
from app.models.identity import User, Role, Permission
from app.models.organization import OrganizationUnit, Position
from app.models.ai_models import KnowledgeBase
from app.models.access_control import (
    AccessPolicy, PermissionScope, ResourceType,
    KBOrgAccess, KBUserAccess, ContractVisibility, AccessLog
)

logger = get_logger(__name__)


class AccessControlService:
    """บริการตรวจสอบสิทธิ์การเข้าถึง"""
    
    def __init__(self, db: Session):
        self.db = db
    
    # ============== Knowledge Base Access ==============
    
    def can_access_knowledge_base(self, user_id: str, kb_id: str, action: str = "read") -> bool:
        """ตรวจสอบว่าผู้ใช้มีสิทธิ์เข้าถึง Knowledge Base หรือไม่"""
        user = self.db.query(User).filter(User.id == user_id).first()
        kb = self.db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
        
        if not user or not kb:
            return False
        
        # Super admin มีสิทธิ์ทั้งหมด
        if user.is_superuser:
            return True
        
        # ตรวจสอบสิทธิ์เจ้าของ
        if kb.owner_user_id == user_id:
            return True
        
        # ตรวจสอบ visibility
        if kb.visibility == "public":
            return True
        
        if kb.visibility == "private":
            return kb.owner_user_id == user_id
        
        # ตรวจสอบสิทธิ์รายบุคคล
        user_access = self.db.query(KBUserAccess).filter(
            KBUserAccess.knowledge_base_id == kb_id,
            KBUserAccess.user_id == user_id
        ).first()
        
        if user_access:
            if action == "read" and user_access.can_read:
                return True
            if action == "contribute" and user_access.can_contribute:
                return True
            if action == "manage" and user_access.can_manage:
                return True
        
        # ตรวจสอบสิทธิ์ตามหน่วยงาน
        if kb.visibility == "org" and user.org_unit_id:
            # เจ้าของเป็นหน่วยงานเดียวกัน
            if kb.owner_org_id == user.org_unit_id:
                return True
            
            # ตรวจสอบสิทธิ์ org_access
            org_access = self.db.query(KBOrgAccess).filter(
                KBOrgAccess.knowledge_base_id == kb_id,
                KBOrgAccess.org_unit_id == user.org_unit_id
            ).first()
            
            if org_access:
                if action == "read" and org_access.can_read:
                    return True
                if action == "contribute" and org_access.can_contribute:
                    return True
                if action == "manage" and org_access.can_manage:
                    return True
            
            # ตรวจสอบสิทธิ์สืบทอด (check parent organizations)
            if self._check_parent_org_access(kb_id, user.org_unit_id, action):
                return True
        
        return False
    
    def _check_parent_org_access(self, kb_id: str, org_unit_id: str, action: str) -> bool:
        """ตรวจสอบสิทธิ์จากหน่วยงานแม่ (inheritance)"""
        org = self.db.query(OrganizationUnit).filter(OrganizationUnit.id == org_unit_id).first()
        if not org or not org.parent_id:
            return False
        
        # ตรวจสอบที่หน่วยงานแม่
        parent_access = self.db.query(KBOrgAccess).filter(
            KBOrgAccess.knowledge_base_id == kb_id,
            KBOrgAccess.org_unit_id == org.parent_id,
            KBOrgAccess.inherit_to_children == True
        ).first()
        
        if parent_access:
            if action == "read" and parent_access.can_read:
                return True
            if action == "contribute" and parent_access.can_contribute:
                return True
            if action == "manage" and parent_access.can_manage:
                return True
        
        # ตรวจสอบต่อไปเรื่อยๆ จนถึง root
        return self._check_parent_org_access(kb_id, org.parent_id, action)
    
    def get_user_knowledge_bases(self, user_id: str, action: str = "read") -> List[KnowledgeBase]:
        """ดึงรายการ Knowledge Base ที่ผู้ใช้มีสิทธิ์เข้าถึง"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return []
        
        # Super admin เห็นทั้งหมด
        if user.is_superuser:
            return self.db.query(KnowledgeBase).all()
        
        kb_ids = set()
        
        # KB ที่เป็นเจ้าของ
        owned = self.db.query(KnowledgeBase).filter(KnowledgeBase.owner_user_id == user_id).all()
        kb_ids.update([kb.id for kb in owned])
        
        # Public KB
        public_kbs = self.db.query(KnowledgeBase).filter(KnowledgeBase.visibility == "public").all()
        kb_ids.update([kb.id for kb in public_kbs])
        
        # Org KB ที่อยู่ในหน่วยงานเดียวกัน
        if user.org_unit_id:
            org_kbs = self.db.query(KnowledgeBase).filter(
                KnowledgeBase.visibility == "org",
                KnowledgeBase.owner_org_id == user.org_unit_id
            ).all()
            kb_ids.update([kb.id for kb in org_kbs])
            
            # ตรวจสอบสิทธิ์ org_access
            org_access_kbs = self.db.query(KBOrgAccess).filter(
                KBOrgAccess.org_unit_id == user.org_unit_id
            ).all()
            kb_ids.update([access.knowledge_base_id for access in org_access_kbs])
        
        # สิทธิ์รายบุคคล
        user_access = self.db.query(KBUserAccess).filter(KBUserAccess.user_id == user_id).all()
        kb_ids.update([access.knowledge_base_id for access in user_access])
        
        return self.db.query(KnowledgeBase).filter(KnowledgeBase.id.in_(kb_ids)).all()
    
    # ============== Contract Access ==============
    
    def can_access_contract(self, user_id: str, contract_id: str, action: str = "view") -> bool:
        """ตรวจสอบสิทธิ์การเข้าถึงสัญญา"""
        from app.models.contract import Contract
        
        user = self.db.query(User).filter(User.id == user_id).first()
        contract = self.db.query(Contract).filter(Contract.id == contract_id).first()
        
        if not user or not contract:
            return False
        
        # Super admin
        if user.is_superuser:
            return True
        
        # เจ้าของสัญญา
        if contract.created_by == user_id:
            return True
        
        # ตรวจสอบ visibility
        visibility = self.db.query(ContractVisibility).filter(
            ContractVisibility.contract_id == contract_id
        ).first()
        
        if visibility:
            # แชร์ให้ user นี้โดยตรง
            if user_id in (visibility.shared_with_users or []):
                return True
            
            # แชร์ให้หน่วยงาน
            if user.org_unit_id and user.org_unit_id in (visibility.shared_with_orgs or []):
                return True
            
            # เจ้าของอยู่หน่วยงานเดียวกัน
            if visibility.owner_org_id == user.org_unit_id:
                return True
        
        # ตรวจสอบจากโครงสร้างองค์กร (hierarchical access)
        if user.org_unit_id and contract.org_unit_id:
            if self._is_same_org_branch(user.org_unit_id, contract.org_unit_id):
                return True
        
        return False
    
    def _is_same_org_branch(self, user_org_id: str, resource_org_id: str) -> bool:
        """ตรวจสอบว่าอยู่ในสายงานเดียวกันหรือไม่"""
        # ถ้าเป็นหน่วยงานเดียวกัน
        if user_org_id == resource_org_id:
            return True
        
        # ตรวจสอบว่า user_org เป็น parent ของ resource_org
        resource_org = self.db.query(OrganizationUnit).filter(
            OrganizationUnit.id == resource_org_id
        ).first()
        
        if resource_org:
            current = resource_org
            while current.parent_id:
                if current.parent_id == user_org_id:
                    return True
                current = self.db.query(OrganizationUnit).filter(
                    OrganizationUnit.id == current.parent_id
                ).first()
        
        return False
    
    # ============== Role & Permission Access ==============
    
    def has_permission(self, user_id: str, permission_code: str, resource_type: ResourceType = None, resource_id: str = None) -> bool:
        """ตรวจสอบว่าผู้ใช้มี permission หรือไม่"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return False
        
        if user.is_superuser:
            return True
        
        # ตรวจสอบจาก policies
        query = self.db.query(AccessPolicy).join(Role).filter(
            Role.id.in_([r.id for r in user.roles]),
            AccessPolicy.is_active == True
        )
        
        if resource_type:
            query = query.filter(AccessPolicy.resource_type == resource_type)
        
        policies = query.all()
        
        for policy in policies:
            # ตรวจสอบ scope
            if policy.scope == PermissionScope.GLOBAL:
                return True
            elif policy.scope == PermissionScope.OWN:
                if resource_id and self._is_owner(user_id, resource_type, resource_id):
                    return True
            elif policy.scope == PermissionScope.ORGANIZATION:
                if self._is_in_same_org(user_id, resource_type, resource_id):
                    return True
        
        return False
    
    def _is_owner(self, user_id: str, resource_type: ResourceType, resource_id: str) -> bool:
        """ตรวจสอบว่าเป็นเจ้าของ resource หรือไม่"""
        if resource_type == ResourceType.KNOWLEDGE_BASE:
            kb = self.db.query(KnowledgeBase).filter(KnowledgeBase.id == resource_id).first()
            return kb and kb.owner_user_id == user_id
        elif resource_type == ResourceType.CONTRACT:
            from app.models.contract import Contract
            contract = self.db.query(Contract).filter(Contract.id == resource_id).first()
            return contract and contract.created_by == user_id
        return False
    
    def _is_in_same_org(self, user_id: str, resource_type: ResourceType, resource_id: str) -> bool:
        """ตรวจสอบว่าอยู่ในหน่วยงานเดียวกันหรือไม่"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user or not user.org_unit_id:
            return False
        
        if resource_type == ResourceType.KNOWLEDGE_BASE:
            kb = self.db.query(KnowledgeBase).filter(KnowledgeBase.id == resource_id).first()
            return kb and kb.owner_org_id == user.org_unit_id
        elif resource_type == ResourceType.CONTRACT:
            from app.models.contract import Contract
            contract = self.db.query(Contract).filter(Contract.id == resource_id).first()
            return contract and contract.org_unit_id == user.org_unit_id
        
        return False
    
    # ============== Grant/Revoke Access ==============
    
    def grant_kb_access_to_org(self, kb_id: str, org_unit_id: str, 
                                can_read: bool = True, can_contribute: bool = False,
                                can_manage: bool = False, inherit: bool = True) -> bool:
        """ให้สิทธิ์หน่วยงานเข้าถึง Knowledge Base"""
        try:
            access = self.db.query(KBOrgAccess).filter(
                KBOrgAccess.knowledge_base_id == kb_id,
                KBOrgAccess.org_unit_id == org_unit_id
            ).first()
            
            if access:
                access.can_read = can_read
                access.can_contribute = can_contribute
                access.can_manage = can_manage
                access.inherit_to_children = inherit
            else:
                import uuid
                access = KBOrgAccess(
                    id=str(uuid.uuid4()),
                    knowledge_base_id=kb_id,
                    org_unit_id=org_unit_id,
                    can_read=can_read,
                    can_contribute=can_contribute,
                    can_manage=can_manage,
                    inherit_to_children=inherit
                )
                self.db.add(access)
            
            self.db.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to grant KB access: {e}")
            return False
    
    def revoke_kb_access(self, kb_id: str, org_unit_id: str = None, user_id: str = None) -> bool:
        """ถอนสิทธิ์การเข้าถึง Knowledge Base"""
        try:
            if org_unit_id:
                self.db.query(KBOrgAccess).filter(
                    KBOrgAccess.knowledge_base_id == kb_id,
                    KBOrgAccess.org_unit_id == org_unit_id
                ).delete()
            elif user_id:
                self.db.query(KBUserAccess).filter(
                    KBUserAccess.knowledge_base_id == kb_id,
                    KBUserAccess.user_id == user_id
                ).delete()
            
            self.db.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to revoke KB access: {e}")
            return False
    
    # ============== Audit Logging ==============
    
    def log_access(self, user_id: str, action: str, resource_type: str, 
                   resource_id: str, success: bool, **kwargs) -> None:
        """บันทึกการเข้าถึงข้อมูล"""
        try:
            import uuid
            log = AccessLog(
                id=str(uuid.uuid4()),
                user_id=user_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                success=success,
                ip_address=kwargs.get('ip_address'),
                user_agent=kwargs.get('user_agent'),
                org_unit_id=kwargs.get('org_unit_id'),
                before_data=kwargs.get('before_data'),
                after_data=kwargs.get('after_data')
            )
            self.db.add(log)
            self.db.commit()
        except Exception as e:
            logger.error(f"Failed to log access: {e}")


# Dependency
from fastapi import Depends
from app.db.database import get_db

def get_access_control_service(db: Session = Depends(get_db)) -> AccessControlService:
    return AccessControlService(db)
