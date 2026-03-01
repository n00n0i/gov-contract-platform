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
    page_size: Optional[int] = Query(None, ge=1, le=100),
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """List contracts with filters - Real Database"""
    from app.models.contract import ContractAttachment
    from sqlalchemy import or_

    effective_limit = page_size or limit

    query = db.query(Contract).filter(
        or_(Contract.is_deleted == 0, Contract.is_deleted == None)
    )

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

    query = query.order_by(Contract.created_at.desc())

    total = query.count()
    contracts = query.offset((page - 1) * effective_limit).limit(effective_limit).all()

    # Batch-load document counts to avoid N+1 queries
    contract_ids = [c.id for c in contracts]
    doc_counts: dict = {}
    if contract_ids:
        from sqlalchemy import func as sqlfunc
        rows = db.query(
            ContractAttachment.contract_id,
            sqlfunc.count(ContractAttachment.id).label("cnt")
        ).filter(
            ContractAttachment.contract_id.in_(contract_ids),
            ContractAttachment.is_deleted == 0
        ).group_by(ContractAttachment.contract_id).all()
        doc_counts = {r.contract_id: r.cnt for r in rows}

    return {
        "success": True,
        "items": [
            {
                "id": c.id,
                "contract_number": c.contract_no,
                "title": c.title,
                "description": c.description,
                "contract_type": c.contract_type.value if c.contract_type else None,
                "status": c.status.value if c.status else None,
                "value": float(c.value_original) if c.value_original else 0,
                "currency": c.currency,
                "department_name": c.owner_department.name if c.owner_department else None,
                "vendor_name": c.vendor_name,
                "vendor_id": c.vendor_id,
                "start_date": c.start_date.isoformat() if c.start_date else None,
                "end_date": c.end_date.isoformat() if c.end_date else None,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "document_count": doc_counts.get(c.id, 0),
                "project_name": c.project_name,
                "budget_year": c.budget_year,
            }
            for c in contracts
        ],
        "pages": max(1, (total + effective_limit - 1) // effective_limit),
        "total": total
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


@router.get("/{contract_id}/graphrag")
async def get_contract_graphrag(
    contract_id: str,
    include_entities: bool = Query(True),
    include_relationships: bool = Query(True),
    include_documents: bool = Query(True),
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Get GraphRAG knowledge graph for a contract
    
    Returns entities, relationships, and documents extracted from
    all documents in this contract, with links to MinIO files.
    
    This provides a comprehensive view of:
    - Parties involved (companies, persons)
    - Key terms (dates, values, conditions)
    - Document connections
    - Links to original files in MinIO
    """
    from app.models.contract import ContractAttachment
    from app.services.storage.minio_service import get_storage_service
    
    # Get contract
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    # Get all documents for this contract
    documents = db.query(ContractAttachment).filter(
        ContractAttachment.contract_id == contract_id,
        ContractAttachment.is_deleted == 0,
        ContractAttachment.ocr_status == "completed"
    ).all()
    
    # Build knowledge graph
    storage = get_storage_service()
    entities = []
    relationships = []
    document_nodes = []
    
    # Contract node
    contract_node = {
        "id": f"CTR_{contract_id}",
        "type": "CONTRACT",
        "name": contract.title,
        "properties": {
            "contract_id": contract_id,
            "contract_no": contract.contract_no,
            "value": float(contract.value_original) if contract.value_original else None,
            "start_date": contract.start_date.isoformat() if contract.start_date else None,
            "end_date": contract.end_date.isoformat() if contract.end_date else None,
            "status": contract.status.value if contract.status else None
        }
    }
    
    # Extract entities from contract
    if contract.vendor_name:
        entities.append({
            "id": f"VND_{contract_id}",
            "type": "VENDOR",
            "name": contract.vendor_name,
            "properties": {
                "tax_id": contract.vendor_tax_id,
                "address": contract.vendor_address
            }
        })
        relationships.append({
            "id": f"REL_VND_{contract_id}",
            "type": "VENDOR_FOR",
            "source": f"VND_{contract_id}",
            "target": f"CTR_{contract_id}"
        })
    
    # Process each document
    for doc in documents:
        # Generate MinIO URL
        try:
            download_url = storage.get_presigned_url(doc.storage_path, expires=3600)
        except Exception as e:
            logger.error(f"Failed to generate URL for {doc.id}: {e}")
            download_url = None
        
        # Document node
        doc_node = {
            "id": f"DOC_{doc.id}",
            "type": "DOCUMENT",
            "name": doc.original_filename,
            "properties": {
                "document_id": doc.id,
                "document_type": doc.document_type,
                "minio_path": doc.storage_path,
                "minio_bucket": doc.storage_bucket,
                "download_url": download_url,
                "page_count": doc.page_count,
                "ocr_confidence": float(doc.ocr_confidence) if doc.ocr_confidence else None
            }
        }
        document_nodes.append(doc_node)
        
        # Document-Contract relationship
        relationships.append({
            "id": f"REL_DOC_CTR_{doc.id}",
            "type": "BELONGS_TO",
            "source": f"DOC_{doc.id}",
            "target": f"CTR_{contract_id}"
        })
        
        # Extract entities from document
        if doc.extracted_contract_number:
            entities.append({
                "id": f"CN_{doc.id}",
                "type": "CONTRACT_NUMBER",
                "name": doc.extracted_contract_number,
                "properties": {"value": doc.extracted_contract_number},
                "source_document": doc.id
            })
        
        if doc.extracted_contract_value:
            entities.append({
                "id": f"VAL_{doc.id}",
                "type": "MONETARY_VALUE",
                "name": f"{doc.extracted_contract_value} THB",
                "properties": {
                    "amount": float(doc.extracted_contract_value),
                    "currency": "THB"
                },
                "source_document": doc.id
            })
        
        if doc.extracted_parties:
            for i, party in enumerate(doc.extracted_parties):
                party_id = f"PTY_{doc.id}_{i}"
                party_type = "ORGANIZATION" if party.get("type") == "company" else "PERSON"
                
                # Check if entity already exists
                existing = next((e for e in entities if e.get("name") == party.get("name")), None)
                if not existing:
                    entities.append({
                        "id": party_id,
                        "type": party_type,
                        "name": party.get("name"),
                        "properties": party,
                        "source_document": doc.id
                    })
                    target_id = party_id
                else:
                    target_id = existing["id"]
                
                relationships.append({
                    "id": f"REL_PTY_{doc.id}_{i}",
                    "type": "PARTY_TO",
                    "source": target_id,
                    "target": f"DOC_{doc.id}",
                    "properties": {"role": party.get("role", "unknown")}
                })
    
    return {
        "success": True,
        "contract_id": contract_id,
        "contract": contract_node,
        "statistics": {
            "total_documents": len(document_nodes),
            "total_entities": len(entities),
            "total_relationships": len(relationships),
            "document_types": list(set(d["properties"].get("document_type") for d in document_nodes))
        },
        "graph": {
            "nodes": [contract_node] + document_nodes + (entities if include_entities else []),
            "relationships": relationships if include_relationships else [],
            "documents": document_nodes if include_documents else []
        },
        "minio_links": {
            "description": "All documents include presigned URLs valid for 1 hour",
            "document_count": len([d for d in document_nodes if d["properties"].get("download_url")])
        }
    }


@router.get("/{contract_id}/graphrag/search")
async def search_contract_graphrag(
    contract_id: str,
    q: str = Query(..., description="Search query for graph entities"),
    entity_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Search within contract's GraphRAG knowledge graph
    
    Performs semantic search across entities and relationships
    in the contract's knowledge graph.
    
    Example queries:
    - q="บริษัท" → Find all companies mentioned
    - q="มูลค่า" → Find monetary values
    - q="วันที่" → Find dates mentioned
    """
    from app.models.contract import ContractAttachment
    from app.services.storage.minio_service import get_storage_service
    
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Search query must be at least 2 characters")
    
    documents = db.query(ContractAttachment).filter(
        ContractAttachment.contract_id == contract_id,
        ContractAttachment.is_deleted == 0,
        ContractAttachment.ocr_status == "completed"
    ).all()
    
    storage = get_storage_service()
    search_lower = q.lower()
    matching_entities = []
    matching_documents = []
    
    for doc in documents:
        doc_matches = False
        
        # Check contract number
        if doc.extracted_contract_number and search_lower in doc.extracted_contract_number.lower():
            matching_entities.append({
                "type": "CONTRACT_NUMBER",
                "value": doc.extracted_contract_number,
                "document_id": doc.id,
                "match_field": "contract_number"
            })
            doc_matches = True
        
        # Check parties
        if doc.extracted_parties:
            for party in doc.extracted_parties:
                party_name = party.get("name", "")
                if search_lower in party_name.lower():
                    party_type = "ORGANIZATION" if party.get("type") == "company" else "PERSON"
                    if not entity_type or entity_type == party_type:
                        matching_entities.append({
                            "type": party_type,
                            "name": party_name,
                            "role": party.get("role"),
                            "document_id": doc.id,
                            "match_field": "party_name"
                        })
                        doc_matches = True
        
        # Check extracted text
        if doc.extracted_text and search_lower in doc.extracted_text.lower():
            if not doc_matches:
                doc_matches = True
        
        if doc_matches:
            try:
                download_url = storage.get_presigned_url(doc.storage_path, expires=3600)
            except:
                download_url = None
            
            matching_documents.append({
                "document_id": doc.id,
                "filename": doc.original_filename,
                "document_type": doc.document_type,
                "download_url": download_url,
                "storage_path": doc.storage_path,
                "ocr_confidence": float(doc.ocr_confidence) if doc.ocr_confidence else None
            })
    
    return {
        "success": True,
        "contract_id": contract_id,
        "contract_no": contract.contract_no,
        "contract_title": contract.title,
        "query": q,
        "entity_type_filter": entity_type,
        "matching_entities": matching_entities,
        "matching_documents": matching_documents,
        "total_entities": len(matching_entities),
        "total_documents": len(matching_documents)
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
            status=ContractStatus(contract_data.get("status", "draft")),
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
        
        # Update contract stats
        try:
            await update_contract_stats(db, contract, user_id)
        except Exception as e:
            logger.error(f"Failed to update contract stats: {e}")
        
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
        # Update simple string/number fields
        for field in ["title", "title_en", "description", "value_original",
                      "start_date", "end_date", "vendor_id", "vendor_name",
                      "vendor_tax_id", "vendor_address",
                      "project_code", "project_name", "budget_year", "tags"]:
            if field in contract_data and contract_data[field] is not None:
                setattr(contract, field, contract_data[field])

        # Update enum fields
        if "status" in contract_data and contract_data["status"]:
            try:
                contract.status = ContractStatus(contract_data["status"])
            except ValueError:
                pass
        if "contract_type" in contract_data and contract_data["contract_type"]:
            try:
                contract.contract_type = ContractType(contract_data["contract_type"])
            except ValueError:
                pass
        if "contract_no" in contract_data and contract_data["contract_no"]:
            contract.contract_no = contract_data["contract_no"]
        
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
        
        # Log activity for stats
        try:
            from app.models.user import UserActivity
            activity = UserActivity(
                id=str(uuid.uuid4()),
                user_id=user_id,
                action="contract_deleted",
                entity_type="contract",
                entity_id=contract.id,
                details={"contract_no": contract.contract_no, "title": contract.title}
            )
            db.add(activity)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to log delete activity: {e}")
        
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
        
        # Log activity for stats
        try:
            from app.models.user import UserActivity
            activity = UserActivity(
                id=str(uuid.uuid4()),
                user_id=user_id,
                action="contract_submitted",
                entity_type="contract",
                entity_id=contract.id,
                details={
                    "contract_no": contract.contract_no,
                    "title": contract.title,
                    "status": contract.status.value
                }
            )
            db.add(activity)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to log submit activity: {e}")
        
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

        # Auto-promote draft documents to main when contract becomes ACTIVE
        if contract.status in (ContractStatus.ACTIVE, ContractStatus.APPROVED):
            try:
                from app.models.contract import ContractAttachment
                db.query(ContractAttachment).filter(
                    ContractAttachment.contract_id == contract_id,
                    ContractAttachment.document_type == "contract",
                    ContractAttachment.is_draft == True,
                    ContractAttachment.is_deleted == 0,
                ).update({"is_main_document": True})
                db.commit()
                logger.info(f"Auto-promoted draft documents to main for contract {contract_id}")
            except Exception as e:
                logger.error(f"Failed to auto-promote documents: {e}")
        
        # Log activity for stats
        try:
            from app.models.user import UserActivity
            activity = UserActivity(
                id=str(uuid.uuid4()),
                user_id=user_id,
                action="contract_approved",
                entity_type="contract",
                entity_id=contract.id,
                details={
                    "contract_no": contract.contract_no,
                    "title": contract.title,
                    "status": contract.status.value,
                    "approval_level": contract.current_approval_level
                }
            )
            db.add(activity)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to log approve activity: {e}")
        
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
    from datetime import datetime, timedelta
    
    # Base query - exclude deleted
    base_query = db.query(Contract).filter(Contract.is_deleted == 0)
    
    total = base_query.count()
    active = base_query.filter(Contract.status == ContractStatus.ACTIVE).count()
    pending = base_query.filter(Contract.status == ContractStatus.PENDING_APPROVAL).count()
    draft = base_query.filter(Contract.status == ContractStatus.DRAFT).count()
    completed = base_query.filter(Contract.status == ContractStatus.COMPLETED).count()
    terminated = base_query.filter(Contract.status == ContractStatus.TERMINATED).count()
    
    # Expiring soon (within 60 days)
    sixty_days_later = datetime.utcnow() + timedelta(days=60)
    expiring_soon = base_query.filter(
        Contract.status == ContractStatus.ACTIVE,
        Contract.end_date <= sixty_days_later,
        Contract.end_date >= datetime.utcnow()
    ).count()
    
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
            "expiring_soon": expiring_soon,
            "total_value": float(total_value),
            "currency": "THB"
        }
    }


from sqlalchemy import func


async def update_contract_stats(db: Session, contract: Contract, user_id: str):
    """
    Update contract statistics after contract creation.
    This updates dashboard stats and other aggregated data.
    """
    from app.models.user import UserActivity
    
    # Log activity for stats tracking
    activity = UserActivity(
        id=str(uuid.uuid4()),
        user_id=user_id,
        action="contract_created",
        entity_type="contract",
        entity_id=contract.id,
        details={
            "contract_no": contract.contract_no,
            "title": contract.title,
            "value": float(contract.value_original) if contract.value_original else 0,
            "contract_type": contract.contract_type.value if contract.contract_type else None,
            "status": contract.status.value if contract.status else None,
        }
    )
    db.add(activity)
    db.commit()
    
    logger.info(f"Updated contract stats for new contract {contract.id}")
