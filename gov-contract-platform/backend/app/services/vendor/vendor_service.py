"""
Vendor Service - Business Logic
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from fastapi import HTTPException, status
import uuid

from app.models.vendor import Vendor, VendorStatus, VendorContact, VendorEvaluation
from app.schemas.vendor import (
    VendorCreate, VendorUpdate, VendorSearchFilters,
    VendorContactCreate, VendorEvaluationCreate
)


class VendorService:
    """Vendor management service"""
    
    def __init__(self, db: Session, user_id: str = None, tenant_id: str = None):
        self.db = db
        self.user_id = user_id
        self.tenant_id = tenant_id
    
    def create_vendor(self, vendor_data: VendorCreate) -> Vendor:
        """Create new vendor"""
        # Check if code or tax_id exists
        existing = self.db.query(Vendor).filter(
            and_(
                Vendor.is_deleted == 0,
                or_(
                    Vendor.code == vendor_data.code,
                    Vendor.tax_id == vendor_data.tax_id
                )
            )
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vendor code or tax ID already exists"
            )
        
        vendor = Vendor(
            id=str(uuid.uuid4()),
            tenant_id=self.tenant_id,
            created_by=self.user_id,
            **vendor_data.dict()
        )
        
        self.db.add(vendor)
        self.db.commit()
        self.db.refresh(vendor)
        
        return vendor
    
    def get_vendor(self, vendor_id: str) -> Vendor:
        """Get vendor by ID"""
        vendor = self.db.query(Vendor).filter(
            Vendor.id == vendor_id,
            Vendor.is_deleted == 0
        ).first()
        
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found"
            )
        
        return vendor
    
    def list_vendors(
        self,
        filters: VendorSearchFilters,
        page: int = 1,
        page_size: int = 20
    ) -> dict:
        """List vendors with filters"""
        query = self.db.query(Vendor).filter(Vendor.is_deleted == 0)
        
        # Apply filters
        if filters.query:
            search = f"%{filters.query}%"
            query = query.filter(
                or_(
                    Vendor.name_th.ilike(search),
                    Vendor.name_en.ilike(search),
                    Vendor.code.ilike(search),
                    Vendor.tax_id.ilike(search)
                )
            )
        
        if filters.status:
            query = query.filter(Vendor.status == filters.status)
        
        if filters.vendor_type:
            query = query.filter(Vendor.vendor_type == filters.vendor_type)
        
        if filters.province:
            query = query.filter(Vendor.province == filters.province)
        
        if filters.is_blacklisted is not None:
            query = query.filter(Vendor.is_blacklisted == filters.is_blacklisted)
        
        # Count total
        total = query.count()
        
        # Pagination
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        items = query.all()
        pages = (total + page_size - 1) // page_size
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": pages
        }
    
    def update_vendor(self, vendor_id: str, vendor_data: VendorUpdate) -> Vendor:
        """Update vendor"""
        vendor = self.get_vendor(vendor_id)
        
        # Update fields
        for field, value in vendor_data.dict(exclude_unset=True).items():
            setattr(vendor, field, value)
        
        vendor.updated_by = self.user_id
        self.db.commit()
        self.db.refresh(vendor)
        
        return vendor
    
    def delete_vendor(self, vendor_id: str):
        """Soft delete vendor"""
        vendor = self.get_vendor(vendor_id)
        
        vendor.is_deleted = 1
        vendor.deleted_by = self.user_id
        self.db.commit()
    
    def add_contact(self, vendor_id: str, contact_data: VendorContactCreate) -> VendorContact:
        """Add contact to vendor"""
        vendor = self.get_vendor(vendor_id)
        
        contact = VendorContact(
            id=str(uuid.uuid4()),
            vendor_id=vendor_id,
            **contact_data.dict()
        )
        
        self.db.add(contact)
        self.db.commit()
        self.db.refresh(contact)
        
        return contact
    
    def add_evaluation(
        self,
        vendor_id: str,
        evaluation_data: VendorEvaluationCreate
    ) -> VendorEvaluation:
        """Add evaluation to vendor"""
        vendor = self.get_vendor(vendor_id)
        
        evaluation = VendorEvaluation(
            id=str(uuid.uuid4()),
            vendor_id=vendor_id,
            evaluated_by=self.user_id,
            **evaluation_data.dict()
        )
        
        self.db.add(evaluation)
        
        # Update vendor average score
        self._update_vendor_score(vendor_id)
        
        self.db.commit()
        self.db.refresh(evaluation)
        
        return evaluation
    
    def _update_vendor_score(self, vendor_id: str):
        """Update vendor average score"""
        avg_score = self.db.query(func.avg(VendorEvaluation.overall_score)).filter(
            VendorEvaluation.vendor_id == vendor_id
        ).scalar()
        
        vendor = self.db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if vendor:
            vendor.average_score = avg_score
    
    def blacklist_vendor(self, vendor_id: str, reason: str):
        """Blacklist vendor"""
        vendor = self.get_vendor(vendor_id)
        
        vendor.is_blacklisted = True
        vendor.blacklist_reason = reason
        vendor.status = VendorStatus.BLACKLISTED
        
        self.db.commit()
    
    def get_vendor_stats(self, vendor_id: str) -> dict:
        """Get vendor statistics"""
        vendor = self.get_vendor(vendor_id)
        
        # Count contracts
        from app.models.contract import Contract
        contract_count = self.db.query(func.count(Contract.id)).filter(
            Contract.vendor_id == vendor_id
        ).scalar()
        
        # Total contract value
        total_value = self.db.query(func.sum(Contract.value)).filter(
            Contract.vendor_id == vendor_id
        ).scalar() or 0
        
        # Average evaluation
        avg_evaluation = self.db.query(func.avg(VendorEvaluation.overall_score)).filter(
            VendorEvaluation.vendor_id == vendor_id
        ).scalar()
        
        return {
            "vendor_id": vendor_id,
            "total_contracts": contract_count,
            "total_contract_value": float(total_value),
            "average_evaluation_score": float(avg_evaluation) if avg_evaluation else None,
            "contact_count": len(vendor.contacts),
            "evaluation_count": len(vendor.evaluations)
        }
