"""
Organization API Routes - จัดการโครงสร้างองค์กร
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.core.security import get_current_user_id, get_current_user_payload
from app.core.logging import get_logger
from app.models.organization import OrganizationUnit, Position, OrgLevel
from app.models.identity import User

router = APIRouter(prefix="/organization", tags=["Organization"])
logger = get_logger(__name__)


# ============== Schemas ==============

class OrgUnitCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name_th: str = Field(..., min_length=1, max_length=200)
    name_en: Optional[str] = None
    short_name: Optional[str] = None
    level: OrgLevel = OrgLevel.DEPARTMENT
    unit_type: str = "government"
    parent_id: Optional[str] = None
    ministry_id: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    director_name: Optional[str] = None
    director_position: Optional[str] = None
    order_index: int = 0


class OrgUnitUpdate(BaseModel):
    name_th: Optional[str] = None
    name_en: Optional[str] = None
    short_name: Optional[str] = None
    level: Optional[OrgLevel] = None
    parent_id: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    director_name: Optional[str] = None
    director_position: Optional[str] = None
    is_active: Optional[bool] = None
    order_index: Optional[int] = None


class PositionCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name_th: str = Field(..., min_length=1, max_length=200)
    name_en: Optional[str] = None
    level: int = 0
    position_type: str = "permanent"
    org_unit_id: Optional[str] = None
    career_track: Optional[str] = None
    is_management: bool = False


class PositionUpdate(BaseModel):
    name_th: Optional[str] = None
    name_en: Optional[str] = None
    level: Optional[int] = None
    org_unit_id: Optional[str] = None
    career_track: Optional[str] = None
    is_active: Optional[bool] = None
    is_management: Optional[bool] = None


class AssignUserOrg(BaseModel):
    user_id: str
    org_unit_id: Optional[str] = None
    position_id: Optional[str] = None


# ============== Organization Unit Endpoints ==============

@router.get("/units")
def list_org_units(
    level: Optional[OrgLevel] = None,
    parent_id: Optional[str] = None,
    ministry_id: Optional[str] = None,
    include_inactive: bool = False,
    tree_view: bool = False,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List organization units with optional filters"""
    query = db.query(OrganizationUnit)
    
    if level:
        query = query.filter(OrganizationUnit.level == level)
    if parent_id:
        query = query.filter(OrganizationUnit.parent_id == parent_id)
    if ministry_id:
        query = query.filter(OrganizationUnit.ministry_id == ministry_id)
    if not include_inactive:
        query = query.filter(OrganizationUnit.is_active == True)
    
    units = query.order_by(OrganizationUnit.order_index, OrganizationUnit.name_th).all()
    
    if tree_view:
        # Build tree structure
        root_units = [u for u in units if u.parent_id is None]
        return {
            "success": True,
            "data": [u.to_dict(include_children=True) for u in root_units],
            "count": len(units)
        }
    
    return {
        "success": True,
        "data": [u.to_dict() for u in units],
        "count": len(units)
    }


@router.get("/units/tree")
def get_org_tree(
    root_id: Optional[str] = None,
    max_depth: int = Query(5, ge=1, le=10),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get organization structure as tree"""
    if root_id:
        root = db.query(OrganizationUnit).filter(OrganizationUnit.id == root_id).first()
        if not root:
            raise HTTPException(status_code=404, detail="Root unit not found")
        return {
            "success": True,
            "data": root.to_dict(include_children=True)
        }
    
    # Get all root units
    roots = db.query(OrganizationUnit).filter(
        OrganizationUnit.parent_id == None,
        OrganizationUnit.is_active == True
    ).order_by(OrganizationUnit.order_index).all()
    
    return {
        "success": True,
        "data": [r.to_dict(include_children=True) for r in roots]
    }


@router.get("/units/{unit_id}")
def get_org_unit(
    unit_id: str,
    include_children: bool = False,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get organization unit details"""
    unit = db.query(OrganizationUnit).filter(OrganizationUnit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Organization unit not found")
    
    return {
        "success": True,
        "data": unit.to_dict(include_children=include_children)
    }


@router.post("/units")
def create_org_unit(
    data: OrgUnitCreate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create new organization unit"""
    import uuid
    
    # Check if code exists
    existing = db.query(OrganizationUnit).filter(OrganizationUnit.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Organization code already exists")
    
    unit = OrganizationUnit(
        id=str(uuid.uuid4()),
        **data.model_dump()
    )
    
    db.add(unit)
    db.commit()
    
    logger.info(f"Created org unit: {unit.code} - {unit.name_th}")
    
    return {
        "success": True,
        "message": "Organization unit created",
        "data": unit.to_dict()
    }


@router.put("/units/{unit_id}")
def update_org_unit(
    unit_id: str,
    data: OrgUnitUpdate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Update organization unit"""
    unit = db.query(OrganizationUnit).filter(OrganizationUnit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Organization unit not found")
    
    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        if value is not None:
            setattr(unit, field, value)
    
    db.commit()
    
    logger.info(f"Updated org unit: {unit_id}")
    
    return {
        "success": True,
        "message": "Organization unit updated",
        "data": unit.to_dict()
    }


@router.delete("/units/{unit_id}")
def delete_org_unit(
    unit_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Delete organization unit (soft delete by deactivating)"""
    unit = db.query(OrganizationUnit).filter(OrganizationUnit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Organization unit not found")
    
    # Check if has children
    if unit.children:
        raise HTTPException(status_code=400, detail="Cannot delete unit with sub-units")
    
    # Check if has users
    if unit.users:
        raise HTTPException(status_code=400, detail="Cannot delete unit with assigned users")
    
    db.delete(unit)
    db.commit()
    
    logger.info(f"Deleted org unit: {unit_id}")
    
    return {
        "success": True,
        "message": "Organization unit deleted"
    }


# ============== Position Endpoints ==============

@router.get("/positions")
def list_positions(
    org_unit_id: Optional[str] = None,
    career_track: Optional[str] = None,
    is_management: Optional[bool] = None,
    include_inactive: bool = False,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List positions"""
    query = db.query(Position)
    
    if org_unit_id:
        query = query.filter(Position.org_unit_id == org_unit_id)
    if career_track:
        query = query.filter(Position.career_track == career_track)
    if is_management is not None:
        query = query.filter(Position.is_management == is_management)
    if not include_inactive:
        query = query.filter(Position.is_active == True)
    
    positions = query.order_by(Position.level.desc(), Position.name_th).all()
    
    return {
        "success": True,
        "data": [p.to_dict() for p in positions],
        "count": len(positions)
    }


@router.post("/positions")
def create_position(
    data: PositionCreate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create new position"""
    import uuid
    
    # Check if code exists
    existing = db.query(Position).filter(Position.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Position code already exists")
    
    position = Position(
        id=str(uuid.uuid4()),
        **data.model_dump()
    )
    
    db.add(position)
    db.commit()
    
    logger.info(f"Created position: {position.code} - {position.name_th}")
    
    return {
        "success": True,
        "message": "Position created",
        "data": position.to_dict()
    }


@router.put("/positions/{position_id}")
def update_position(
    position_id: str,
    data: PositionUpdate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Update position"""
    position = db.query(Position).filter(Position.id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    
    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        if value is not None:
            setattr(position, field, value)
    
    db.commit()
    
    return {
        "success": True,
        "message": "Position updated",
        "data": position.to_dict()
    }


# ============== User Assignment Endpoints ==============

@router.post("/assign-user")
def assign_user_to_org(
    data: AssignUserOrg,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Assign user to organization unit and/or position"""
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if data.org_unit_id:
        unit = db.query(OrganizationUnit).filter(OrganizationUnit.id == data.org_unit_id).first()
        if not unit:
            raise HTTPException(status_code=404, detail="Organization unit not found")
        user.org_unit_id = data.org_unit_id
    
    if data.position_id:
        position = db.query(Position).filter(Position.id == data.position_id).first()
        if not position:
            raise HTTPException(status_code=404, detail="Position not found")
        user.position_id = data.position_id
    
    db.commit()
    
    logger.info(f"Assigned user {data.user_id} to org unit {data.org_unit_id}, position {data.position_id}")
    
    return {
        "success": True,
        "message": "User assigned successfully"
    }


@router.get("/users/{user_id}/org-info")
def get_user_org_info(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get user's organization information"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "success": True,
        "data": {
            "user_id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "org_unit": user.org_unit.to_dict() if user.org_unit else None,
            "position": user.position.to_dict() if user.position else None,
            "org_path": user.org_unit.get_full_path() if user.org_unit else None
        }
    }


# ============== Statistics Endpoints ==============

@router.get("/stats")
def get_org_stats(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get organization statistics"""
    from sqlalchemy import func
    
    # Count by level
    level_counts = db.query(
        OrganizationUnit.level,
        func.count(OrganizationUnit.id)
    ).filter(OrganizationUnit.is_active == True).group_by(OrganizationUnit.level).all()
    
    # Total units
    total_units = db.query(OrganizationUnit).filter(OrganizationUnit.is_active == True).count()
    total_positions = db.query(Position).filter(Position.is_active == True).count()
    users_with_org = db.query(User).filter(User.org_unit_id != None).count()
    
    return {
        "success": True,
        "data": {
            "total_units": total_units,
            "total_positions": total_positions,
            "users_with_org_assignment": users_with_org,
            "units_by_level": {level.value: count for level, count in level_counts}
        }
    }
