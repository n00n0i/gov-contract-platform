"""
Vendor Management API - Production Ready
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid

from app.db.database import get_db
from app.core.security import get_current_user_payload
from app.core.logging import get_logger
from app.models.vendor import Vendor, VendorStatus, VendorType

router = APIRouter(tags=["Vendors"])
logger = get_logger(__name__)


@router.get("/vendors")
async def list_vendors(
    status: Optional[str] = None,
    vendor_type: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """List vendors with filters"""
    
    query = db.query(Vendor).filter(Vendor.is_deleted == 0)
    
    if status:
        query = query.filter(Vendor.status == status)
    if vendor_type:
        query = query.filter(Vendor.vendor_type == vendor_type)
    if search:
        search_lower = f"%{search.lower()}%"
        query = query.filter(
            (Vendor.name.ilike(search_lower)) |
            (Vendor.tax_id.ilike(search_lower)) |
            (Vendor.email.ilike(search_lower))
        )
    
    query = query.order_by(Vendor.created_at.desc())
    
    total = query.count()
    vendors = query.offset((page - 1) * limit).limit(limit).all()
    
    return {
        "success": True,
        "data": [
            {
                "id": v.id,
                "name": v.name,
                "name_en": v.name_en,
                "tax_id": v.tax_id,
                "vendor_type": v.vendor_type.value if v.vendor_type else None,
                "status": v.status.value if v.status else None,
                "email": v.email,
                "phone": v.phone,
                "address": v.address,
                "contact_name": v.contact_name,
                "contact_email": v.contact_email,
                "contact_phone": v.contact_phone,
                "registration_date": v.registration_date.isoformat() if v.registration_date else None,
                "website": v.website,
                "is_blacklisted": v.is_blacklisted,
                "blacklist_reason": v.blacklist_reason,
                "email_verified": v.email_verified,
                "is_system": v.is_system,
                "created_at": v.created_at.isoformat() if v.created_at else None,
            }
            for v in vendors
        ],
        "meta": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }
    }


@router.get("/vendors/{vendor_id}")
async def get_vendor(
    vendor_id: str,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """Get vendor details"""
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.is_deleted == 0).first()
    
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    return {
        "success": True,
        "data": {
            "id": vendor.id,
            "name": vendor.name,
            "name_en": vendor.name_en,
            "tax_id": vendor.tax_id,
            "vendor_type": vendor.vendor_type.value if vendor.vendor_type else None,
            "status": vendor.status.value if vendor.status else None,
            "email": vendor.email,
            "phone": vendor.phone,
            "address": vendor.address,
            "province": vendor.province,
            "postal_code": vendor.postal_code,
            "country": vendor.country,
            "contact_name": vendor.contact_name,
            "contact_email": vendor.contact_email,
            "contact_phone": vendor.contact_phone,
            "contact_position": vendor.contact_position,
            "website": vendor.website,
            "registration_no": vendor.registration_no,
            "registration_date": vendor.registration_date.isoformat() if vendor.registration_date else None,
            "credit_rating": vendor.credit_rating,
            "credit_limit": float(vendor.credit_limit) if vendor.credit_limit else None,
            "payment_terms": vendor.payment_terms,
            "bank_name": vendor.bank_name,
            "bank_account": vendor.bank_account,
            "bank_branch": vendor.bank_branch,
            "is_blacklisted": vendor.is_blacklisted,
            "blacklist_reason": vendor.blacklist_reason,
            "blacklisted_at": vendor.blacklisted_at.isoformat() if vendor.blacklisted_at else None,
            "email_verified": vendor.email_verified,
            "email_verified_at": vendor.email_verified_at.isoformat() if vendor.email_verified_at else None,
            "is_system": vendor.is_system,
            "notes": vendor.notes,
            "custom_fields": vendor.custom_fields,
            "created_at": vendor.created_at.isoformat() if vendor.created_at else None,
            "updated_at": vendor.updated_at.isoformat() if vendor.updated_at else None,
        }
    }


@router.post("/vendors")
async def create_vendor(
    vendor_data: dict,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """Create new vendor"""
    user_id = user_payload.get("sub")
    
    try:
        # Check for duplicate tax_id
        if vendor_data.get("tax_id"):
            existing = db.query(Vendor).filter(
                Vendor.tax_id == vendor_data["tax_id"],
                Vendor.is_deleted == False
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail="Vendor with this tax ID already exists")
        
        vendor = Vendor(
            id=str(uuid.uuid4()),
            name=vendor_data.get("name"),
            name_en=vendor_data.get("name_en"),
            tax_id=vendor_data.get("tax_id"),
            vendor_type=VendorType(vendor_data.get("vendor_type", "company")),
            status=VendorStatus.ACTIVE,
            email=vendor_data.get("email"),
            phone=vendor_data.get("phone"),
            address=vendor_data.get("address"),
            province=vendor_data.get("province"),
            postal_code=vendor_data.get("postal_code"),
            country=vendor_data.get("country", "Thailand"),
            contact_name=vendor_data.get("contact_name"),
            contact_email=vendor_data.get("contact_email"),
            contact_phone=vendor_data.get("contact_phone"),
            contact_position=vendor_data.get("contact_position"),
            website=vendor_data.get("website"),
            registration_no=vendor_data.get("registration_no"),
            bank_name=vendor_data.get("bank_name"),
            bank_account=vendor_data.get("bank_account"),
            bank_branch=vendor_data.get("bank_branch"),
            notes=vendor_data.get("notes"),
            custom_fields=vendor_data.get("custom_fields", {}),
            created_by=user_id,
            updated_by=user_id,
        )
        
        db.add(vendor)
        db.commit()
        db.refresh(vendor)
        
        logger.info(f"Created vendor {vendor.id} by {user_id}")
        
        return {
            "success": True,
            "message": "Vendor created successfully",
            "data": {
                "id": vendor.id,
                "name": vendor.name,
                "tax_id": vendor.tax_id,
                "status": vendor.status.value,
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create vendor: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create vendor: {str(e)}")


@router.put("/vendors/{vendor_id}")
async def update_vendor(
    vendor_id: str,
    vendor_data: dict,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """Update vendor"""
    user_id = user_payload.get("sub")
    
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.is_deleted == 0).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    try:
        for field in ["name", "name_en", "email", "phone", "address", "province", 
                      "postal_code", "website", "contact_name", "contact_email", 
                      "contact_phone", "bank_name", "bank_account", "notes", "custom_fields"]:
            if field in vendor_data:
                setattr(vendor, field, vendor_data[field])
        
        vendor.updated_by = user_id
        vendor.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(vendor)
        
        return {
            "success": True,
            "message": "Vendor updated successfully",
            "data": {
                "id": vendor.id,
                "name": vendor.name,
                "status": vendor.status.value,
            }
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update vendor: {str(e)}")


@router.delete("/vendors/{vendor_id}")
async def delete_vendor(
    vendor_id: str,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """Delete vendor (soft delete)"""
    user_id = user_payload.get("sub")
    
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.is_deleted == 0).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Prevent deletion of system vendors
    if vendor.is_system:
        raise HTTPException(status_code=403, detail="ไม่สามารถลบข้อมูลตัวอย่างของระบบได้")
    
    try:
        vendor.is_deleted = True
        vendor.deleted_at = datetime.utcnow()
        vendor.deleted_by = user_id
        
        db.commit()
        
        return {
            "success": True,
            "message": "Vendor deleted successfully"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete vendor: {str(e)}")


@router.post("/vendors/{vendor_id}/blacklist")
async def blacklist_vendor(
    vendor_id: str,
    data: dict,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """Blacklist a vendor"""
    user_id = user_payload.get("sub")
    
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.is_deleted == 0).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    try:
        vendor.is_blacklisted = True
        vendor.blacklist_reason = data.get("reason")
        vendor.blacklisted_at = datetime.utcnow()
        vendor.blacklisted_by = user_id
        vendor.status = VendorStatus.BLACKLISTED
        vendor.updated_by = user_id
        
        db.commit()
        
        return {
            "success": True,
            "message": "Vendor blacklisted successfully",
            "data": {
                "id": vendor.id,
                "is_blacklisted": vendor.is_blacklisted,
                "blacklist_reason": vendor.blacklist_reason,
            }
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to blacklist vendor: {str(e)}")


@router.get("/vendors/stats/summary")
async def get_vendor_stats(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """Get vendor statistics"""
    
    base_query = db.query(Vendor).filter(Vendor.is_deleted == False)
    
    total = base_query.count()
    active = base_query.filter(Vendor.status == VendorStatus.ACTIVE).count()
    blacklisted = base_query.filter(Vendor.is_blacklisted == True).count()
    
    return {
        "success": True,
        "data": {
            "total_vendors": total,
            "active_vendors": active,
            "blacklisted_vendors": blacklisted,
        }
    }


@router.post("/vendors/{vendor_id}/verify-email")
async def verify_vendor_email(
    vendor_id: str,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """Verify vendor email (manual verification by admin)"""
    user_id = user_payload.get("sub")
    
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id, Vendor.is_deleted == 0).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    try:
        vendor.email_verified = True
        vendor.email_verified_at = datetime.utcnow()
        vendor.updated_by = user_id
        vendor.updated_at = datetime.utcnow()
        
        db.commit()
        
        return {
            "success": True,
            "message": "Email verified successfully",
            "data": {
                "id": vendor.id,
                "email": vendor.email,
                "email_verified": vendor.email_verified,
                "email_verified_at": vendor.email_verified_at.isoformat() if vendor.email_verified_at else None,
            }
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to verify email: {str(e)}")


@router.post("/vendors/bulk-action")
async def bulk_vendor_action(
    data: dict,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """Bulk actions on vendors"""
    user_id = user_payload.get("sub")
    action = data.get("action")
    vendor_ids = data.get("vendor_ids", [])
    
    if not vendor_ids:
        raise HTTPException(status_code=400, detail="No vendors selected")
    
    if action not in ["activate", "deactivate", "delete"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    vendors = db.query(Vendor).filter(
        Vendor.id.in_(vendor_ids),
        Vendor.is_deleted == 0
    ).all()
    
    if not vendors:
        raise HTTPException(status_code=404, detail="No vendors found")
    
    try:
        updated_count = 0
        skipped_count = 0
        
        for vendor in vendors:
            # Skip system vendors for delete action
            if action == "delete" and vendor.is_system:
                skipped_count += 1
                continue
                
            if action == "activate":
                vendor.status = VendorStatus.ACTIVE
            elif action == "deactivate":
                vendor.status = VendorStatus.INACTIVE
            elif action == "delete":
                vendor.is_deleted = True
                vendor.deleted_at = datetime.utcnow()
                vendor.deleted_by = user_id
            
            vendor.updated_by = user_id
            vendor.updated_at = datetime.utcnow()
            updated_count += 1
        
        db.commit()
        
        action_labels = {
            "activate": "เปิดใช้งาน",
            "deactivate": "ปิดใช้งาน",
            "delete": "ลบ"
        }
        
        message = f"{action_labels[action]} {updated_count} รายการสำเร็จ"
        if skipped_count > 0:
            message += f" (ข้าม {skipped_count} รายการที่เป็นข้อมูลระบบ)"
        
        return {
            "success": True,
            "message": message,
            "data": {
                "action": action,
                "updated": updated_count,
                "skipped": skipped_count
            }
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to perform bulk action: {str(e)}")
