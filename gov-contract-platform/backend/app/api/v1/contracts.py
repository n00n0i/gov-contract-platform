"""
Contract Management API - Production Ready
Uses real database instead of mock data
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
import uuid
import os

from app.db.database import get_db
from app.core.security import get_current_user_id, get_current_user_payload
from app.core.logging import get_logger
from app.models.contract import Contract, ContractStatus, ContractType, ClassificationLevel
from app.models.vendor import Vendor
from app.services.agent.trigger_service import on_contract_created

router = APIRouter(tags=["Contracts"])
logger = get_logger(__name__)


@router.get("")
async def list_contracts(
    status: Optional[str] = None,
    contract_type: Optional[str] = None,
    department_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """List contracts with filters - Real Database"""
    
    query = db.query(Contract)
    
    # Apply filters
    if status:
        query = query.filter(Contract.status == status)
    if contract_type:
        query = query.filter(Contract.contract_type == contract_type)
    if department_id:
        query = query.filter(Contract.owner_department_id == department_id)
    if search:
        search_lower = f"%{search.lower()}%"
        query = query.filter(
            (Contract.title.ilike(search_lower)) |
            (Contract.contract_no.ilike(search_lower)) |
            (Contract.vendor_name.ilike(search_lower))
        )
    
    # Order by created_at desc
    query = query.order_by(Contract.created_at.desc())
    
    # Pagination
    total = query.count()
    contracts = query.offset((page - 1) * limit).limit(limit).all()
    
    return {
        "success": True,
        "data": [
            {
                "id": c.id,
                "contract_no": c.contract_no,
                "title": c.title,
                "contract_type": c.contract_type.value if c.contract_type else None,
                "status": c.status.value if c.status else None,
                "value": float(c.value_original) if c.value_original else None,
                "currency": c.currency,
                "department": c.owner_department.name if c.owner_department else None,
                "vendor_name": c.vendor_name,
                "vendor_id": c.vendor_id,
                "start_date": c.start_date.isoformat() if c.start_date else None,
                "end_date": c.end_date.isoformat() if c.end_date else None,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "created_by": c.created_by,
                "current_approval_level": c.current_approval_level,
                "required_approval_level": c.required_approval_level,
            }
            for c in contracts
        ],
        "meta": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }
    }


@router.get("/{contract_id}")
async def get_contract(
    contract_id: str,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """Get contract details"""
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    return {
        "success": True,
        "data": {
            "id": contract.id,
            "contract_no": contract.contract_no,
            "title": contract.title,
            "title_en": contract.title_en,
            "description": contract.description,
            "contract_type": contract.contract_type.value if contract.contract_type else None,
            "classification": contract.classification.value if contract.classification else None,
            "status": contract.status.value if contract.status else None,
            "value_original": float(contract.value_original) if contract.value_original else None,
            "value_adjusted": float(contract.value_adjusted) if contract.value_adjusted else None,
            "currency": contract.currency,
            "payment_terms": contract.payment_terms,
            "start_date": contract.start_date.isoformat() if contract.start_date else None,
            "end_date": contract.end_date.isoformat() if contract.end_date else None,
            "signed_date": contract.signed_date.isoformat() if contract.signed_date else None,
            "effective_date": contract.effective_date.isoformat() if contract.effective_date else None,
            "vendor_id": contract.vendor_id,
            "vendor_name": contract.vendor_name,
            "vendor_tax_id": contract.vendor_tax_id,
            "vendor_address": contract.vendor_address,
            "vendor_contact_name": contract.vendor_contact_name,
            "vendor_contact_email": contract.vendor_contact_email,
            "vendor_contact_phone": contract.vendor_contact_phone,
            "project_code": contract.project_code,
            "project_name": contract.project_name,
            "budget_year": contract.budget_year,
            "budget_source": contract.budget_source,
            "penalty_rate": float(contract.penalty_rate) if contract.penalty_rate else None,
            "warranty_period_months": contract.warranty_period_months,
            "retention_percent": float(contract.retention_percent) if contract.retention_percent else None,
            "tags": contract.tags,
            "custom_metadata": contract.custom_metadata,
            "parent_contract_id": contract.parent_contract_id,
            "amendment_no": contract.amendment_no,
            "is_amendment": contract.is_amendment,
            "current_approval_level": contract.current_approval_level,
            "required_approval_level": contract.required_approval_level,
            "created_at": contract.created_at.isoformat() if contract.created_at else None,
            "updated_at": contract.updated_at.isoformat() if contract.updated_at else None,
            "created_by": contract.created_by,
            "ocr_text": contract.ocr_text,
            "ocr_confidence": float(contract.ocr_confidence) if contract.ocr_confidence else None,
            "extracted_data": contract.extracted_data,
        }
    }


@router.get("/{contract_id}/documents/search")
async def search_contract_documents(
    contract_id: str,
    q: str = Query(..., description="Search query in OCR text"),
    document_type: Optional[str] = Query(None),
    highlight: bool = Query(True),
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Search within contract documents using OCR text
    
    This endpoint searches in the extracted OCR text of all documents
    belonging to a specific contract and returns results with
    download links to the MinIO files.
    
    Example:
        GET /contracts/123/documents/search?q=มูลค่า 500,000
    
    Returns:
    - document_id: Document UUID
    - filename: Original filename
    - download_url: Presigned MinIO URL (valid 1 hour)
    - matching_text: Text snippet around the match
    - page_count: Number of pages in document
    - ocr_confidence: OCR accuracy
    """
    from app.models.contract import ContractAttachment
    from app.services.storage.minio_service import get_storage_service
    from sqlalchemy import or_
    import re
    
    # Verify contract exists
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Search query must be at least 2 characters")
    
    search_term = f"%{q}%"
    
    # Build query
    query = db.query(ContractAttachment).filter(
        ContractAttachment.contract_id == contract_id,
        ContractAttachment.is_deleted == 0,
        ContractAttachment.ocr_status == "completed",
        or_(
            ContractAttachment.extracted_text.ilike(search_term),
            ContractAttachment.original_filename.ilike(search_term),
            ContractAttachment.extracted_contract_number.ilike(search_term)
        )
    )
    
    if document_type:
        query = query.filter(ContractAttachment.document_type == document_type)
    
    # Order by OCR confidence
    documents = query.order_by(ContractAttachment.ocr_confidence.desc()).all()
    
    # Generate download URLs
    storage = get_storage_service()
    results = []
    
    for doc in documents:
        # Generate presigned URL for MinIO
        try:
            download_url = storage.get_presigned_url(doc.storage_path, expires=3600)
        except Exception as e:
            logger.error(f"Failed to generate URL for {doc.id}: {e}")
            download_url = None
        
        # Find matching text snippet
        matching_snippet = None
        if highlight and doc.extracted_text:
            pattern = re.compile(re.escape(q), re.IGNORECASE)
            match = pattern.search(doc.extracted_text)
            if match:
                start = max(0, match.start() - 80)
                end = min(len(doc.extracted_text), match.end() + 80)
                snippet = doc.extracted_text[start:end]
                # Highlight the match
                highlighted = pattern.sub(lambda m: f"**{m.group()}**", snippet)
                matching_snippet = "..." + highlighted + "..."
        
        results.append({
            "document_id": doc.id,
            "filename": doc.original_filename,
            "document_type": doc.document_type,
            "description": doc.description,
            "download_url": download_url,
            "storage_path": doc.storage_path,
            "storage_bucket": doc.storage_bucket,
            "matching_snippet": matching_snippet,
            "extracted_text_length": len(doc.extracted_text) if doc.extracted_text else 0,
            "ocr_confidence": float(doc.ocr_confidence) if doc.ocr_confidence else None,
            "extracted_contract_number": doc.extracted_contract_number,
            "extracted_value": float(doc.extracted_contract_value) if doc.extracted_contract_value else None,
            "page_count": doc.page_count,
            "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None
        })
    
    return {
        "success": True,
        "contract_id": contract_id,
        "contract_no": contract.contract_no,
        "contract_title": contract.title,
        "query": q,
        "total_results": len(results),
        "results": results
    }


@router.get("/{contract_id}/documents")
async def list_contract_documents(
    contract_id: str,
    document_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search in OCR text"),
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    List all documents for a contract with optional OCR text search
    
    Returns documents with download URLs from MinIO
    """
    from app.models.contract import ContractAttachment
    from app.services.storage.minio_service import get_storage_service
    from sqlalchemy import or_
    
    # Verify contract exists
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    # Build query
    query = db.query(ContractAttachment).filter(
        ContractAttachment.contract_id == contract_id,
        ContractAttachment.is_deleted == 0
    )
    
    if document_type:
        query = query.filter(ContractAttachment.document_type == document_type)
    
    # Search in OCR text
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                ContractAttachment.extracted_text.ilike(search_term),
                ContractAttachment.original_filename.ilike(search_term),
                ContractAttachment.description.ilike(search_term)
            )
        )
    
    documents = query.order_by(ContractAttachment.uploaded_at.desc()).all()
    
    # Generate download URLs
    storage = get_storage_service()
    results = []
    
    for doc in documents:
        try:
            download_url = storage.get_presigned_url(doc.storage_path, expires=3600)
        except Exception as e:
            logger.error(f"Failed to generate URL for {doc.id}: {e}")
            download_url = None
        
        results.append({
            "id": doc.id,
            "filename": doc.original_filename,
            "document_type": doc.document_type,
            "description": doc.description,
            "file_size": doc.file_size,
            "mime_type": doc.mime_type,
            "download_url": download_url,
            "storage_path": doc.storage_path,
            "storage_bucket": doc.storage_bucket,
            "status": doc.status,
            "ocr_status": doc.ocr_status,
            "ocr_confidence": float(doc.ocr_confidence) if doc.ocr_confidence else None,
            "has_extracted_text": bool(doc.extracted_text),
            "extracted_text_length": len(doc.extracted_text) if doc.extracted_text else 0,
            "page_count": doc.page_count,
            "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
            "processed_at": doc.processed_at.isoformat() if doc.processed_at else None
        })
    
    return {
        "success": True,
        "contract_id": contract_id,
        "total": len(results),
        "documents": results
    }


@router.post("")
async def create_contract(
    background_tasks: BackgroundTasks,
    contract_data: dict,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """Create new contract and trigger AI analysis"""
    user_id = user_payload.get("sub")
    
    try:
        # Create contract
        contract = Contract(
            id=str(uuid.uuid4()),
            contract_no=contract_data.get("contract_no"),
            title=contract_data.get("title"),
            title_en=contract_data.get("title_en"),
            description=contract_data.get("description"),
            contract_type=ContractType(contract_data.get("contract_type", "procurement")),
            classification=ClassificationLevel(contract_data.get("classification", "S4")),
            status=ContractStatus.DRAFT,
            value_original=contract_data.get("value"),
            currency=contract_data.get("currency", "THB"),
            start_date=contract_data.get("start_date"),
            end_date=contract_data.get("end_date"),
            vendor_id=contract_data.get("vendor_id"),
            vendor_name=contract_data.get("vendor_name"),
            vendor_tax_id=contract_data.get("vendor_tax_id"),
            project_code=contract_data.get("project_code"),
            project_name=contract_data.get("project_name"),
            budget_year=contract_data.get("budget_year"),
            budget_source=contract_data.get("budget_source"),
            owner_department_id=contract_data.get("department_id"),
            owner_user_id=user_id,
            created_by=user_id,
            updated_by=user_id,
        )
        
        db.add(contract)
        db.commit()
        db.refresh(contract)
        
        logger.info(f"Created contract {contract.id} by {user_id}")
        
        # Trigger AI agents
        try:
            await on_contract_created(
                contract_id=contract.id,
                contract_data={
                    "title": contract.title,
                    "value": float(contract.value_original) if contract.value_original else 0,
                    "contract_type": contract.contract_type.value if contract.contract_type else None,
                    "vendor_name": contract.vendor_name,
                },
                user_id=user_id
            )
        except Exception as e:
            logger.error(f"Failed to trigger contract analysis: {e}")
        
        return {
            "success": True,
            "message": "Contract created successfully",
            "data": {
                "id": contract.id,
                "contract_no": contract.contract_no,
                "title": contract.title,
                "status": contract.status.value,
            }
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create contract: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create contract: {str(e)}")


@router.put("/{contract_id}")
async def update_contract(
    contract_id: str,
    contract_data: dict,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """Update contract"""
    user_id = user_payload.get("sub")
    
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    try:
        # Update fields
        for field in ["title", "title_en", "description", "value_original", 
                      "start_date", "end_date", "vendor_id", "vendor_name",
                      "project_code", "project_name", "budget_year", "tags"]:
            if field in contract_data:
                setattr(contract, field, contract_data[field])
        
        contract.updated_by = user_id
        contract.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(contract)
        
        return {
            "success": True,
            "message": "Contract updated successfully",
            "data": {
                "id": contract.id,
                "title": contract.title,
                "status": contract.status.value,
            }
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update contract: {str(e)}")


@router.delete("/{contract_id}")
async def delete_contract(
    contract_id: str,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """Delete contract (soft delete)"""
    user_id = user_payload.get("sub")
    
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    try:
        contract.is_deleted = True
        contract.deleted_at = datetime.utcnow()
        contract.deleted_by = user_id
        
        db.commit()
        
        return {
            "success": True,
            "message": "Contract deleted successfully"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete contract: {str(e)}")


@router.post("/{contract_id}/submit-for-approval")
async def submit_for_approval(
    contract_id: str,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """Submit contract for approval"""
    user_id = user_payload.get("sub")
    
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    if contract.status != ContractStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft contracts can be submitted")
    
    try:
        contract.status = ContractStatus.PENDING_APPROVAL
        contract.current_approval_level = 1
        contract.updated_by = user_id
        contract.updated_at = datetime.utcnow()
        
        db.commit()
        
        # Trigger approval analysis
        try:
            from app.services.agent.trigger_service import trigger_service
            await trigger_service.process_event(
                event_type="contract_approval_requested",
                event_data={
                    "contract_id": contract.id,
                    "title": contract.title,
                    "value": float(contract.value_original) if contract.value_original else 0,
                },
                user_id=user_id
            )
        except Exception as e:
            logger.error(f"Failed to trigger approval analysis: {e}")
        
        return {
            "success": True,
            "message": "Contract submitted for approval",
            "data": {
                "id": contract.id,
                "status": contract.status.value,
                "approval_level": contract.current_approval_level
            }
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to submit: {str(e)}")


@router.post("/{contract_id}/approve")
async def approve_contract(
    contract_id: str,
    approval_data: dict,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """Approve contract at current level"""
    user_id = user_payload.get("sub")
    
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    if contract.status != ContractStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=400, detail="Contract is not pending approval")
    
    try:
        contract.current_approval_level += 1
        
        # Check if fully approved
        if contract.current_approval_level > contract.required_approval_level:
            contract.status = ContractStatus.ACTIVE
            contract.signed_date = date.today()
        
        contract.updated_by = user_id
        contract.updated_at = datetime.utcnow()
        
        db.commit()
        
        return {
            "success": True,
            "message": "Contract approved",
            "data": {
                "id": contract.id,
                "status": contract.status.value,
                "approval_level": contract.current_approval_level
            }
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to approve: {str(e)}")


@router.get("/stats/summary")
async def get_contract_stats(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """Get contract statistics"""
    
    # Base query - exclude deleted
    base_query = db.query(Contract).filter(Contract.is_deleted == 0)
    
    total = base_query.count()
    active = base_query.filter(Contract.status == ContractStatus.ACTIVE).count()
    pending = base_query.filter(Contract.status == ContractStatus.PENDING_APPROVAL).count()
    draft = base_query.filter(Contract.status == ContractStatus.DRAFT).count()
    completed = base_query.filter(Contract.status == ContractStatus.COMPLETED).count()
    terminated = base_query.filter(Contract.status == ContractStatus.TERMINATED).count()
    
    # Total value
    total_value = db.query(func.sum(Contract.value_original)).filter(
        Contract.is_deleted == 0
    ).scalar() or 0
    
    return {
        "success": True,
        "data": {
            "total_contracts": total,
            "active_contracts": active,
            "pending_approval": pending,
            "draft": draft,
            "completed": completed,
            "terminated": terminated,
            "total_value": float(total_value),
            "currency": "THB"
        }
    }


from sqlalchemy import func
