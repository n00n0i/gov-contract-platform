"""
Vendor Schemas - Pydantic Models
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class VendorBase(BaseModel):
    """Base vendor schema"""
    code: str = Field(..., min_length=3, max_length=50)
    name_th: str = Field(..., min_length=2, max_length=255)
    name_en: Optional[str] = Field(None, max_length=255)
    vendor_type: str = Field(..., description="individual, company, partnership")
    tax_id: str = Field(..., min_length=10, max_length=13)
    
    # Contact
    address: Optional[str] = None
    province: Optional[str] = None
    district: Optional[str] = None
    subdistrict: Optional[str] = None
    postcode: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    
    # Banking
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_branch: Optional[str] = None
    
    # Status
    status: str = "active"
    is_blacklisted: bool = False
    blacklist_reason: Optional[str] = None


class VendorCreate(VendorBase):
    """Create vendor request"""
    pass


class VendorUpdate(BaseModel):
    """Update vendor request"""
    name_th: Optional[str] = Field(None, min_length=2, max_length=255)
    name_en: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    status: Optional[str] = None


class VendorContactBase(BaseModel):
    """Vendor contact base"""
    name: str
    position: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_primary: bool = False


class VendorContactCreate(VendorContactBase):
    pass


class VendorContactResponse(VendorContactBase):
    id: str
    vendor_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class VendorEvaluationBase(BaseModel):
    """Vendor evaluation base"""
    contract_id: str
    quality_score: int = Field(..., ge=0, le=100)
    timeliness_score: int = Field(..., ge=0, le=100)
    service_score: int = Field(..., ge=0, le=100)
    overall_score: int = Field(..., ge=0, le=100)
    comments: Optional[str] = None


class VendorEvaluationCreate(VendorEvaluationBase):
    pass


class VendorEvaluationResponse(VendorEvaluationBase):
    id: str
    vendor_id: str
    evaluated_by: str
    evaluated_at: datetime
    
    class Config:
        from_attributes = True


class VendorResponse(VendorBase):
    """Vendor response"""
    id: str
    tenant_id: Optional[str]
    
    # Metadata
    total_contracts: int = 0
    total_value: float = 0.0
    average_score: Optional[float] = None
    last_evaluation_date: Optional[datetime] = None
    
    # Audit
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: Optional[str]
    
    # Related
    contacts: List[VendorContactResponse] = []
    evaluations: List[VendorEvaluationResponse] = []
    
    class Config:
        from_attributes = True


class VendorListResponse(BaseModel):
    """Vendor list response"""
    items: List[VendorResponse]
    total: int
    page: int
    page_size: int
    pages: int


class VendorSearchFilters(BaseModel):
    """Vendor search filters"""
    query: Optional[str] = None
    status: Optional[str] = None
    vendor_type: Optional[str] = None
    province: Optional[str] = None
    is_blacklisted: Optional[bool] = None
    min_score: Optional[float] = None
