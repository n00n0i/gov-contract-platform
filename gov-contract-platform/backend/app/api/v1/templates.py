"""
Contract Templates API Routes - Manage contract templates
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
import os
import json

from app.db.database import get_db
from app.core.security import get_current_user_id, get_current_user_payload
from app.core.logging import get_logger
from app.services.ai.llm_service import LLMService
from app.services.document.ocr_service import OCRService

router = APIRouter(prefix="/templates", tags=["Templates"])
logger = get_logger(__name__)


# ============== Schemas ==============

class TemplateClause(BaseModel):
    number: int
    title: str
    content: str


class ContractTemplate(BaseModel):
    id: str
    name: str
    type: str
    description: Optional[str] = ""
    clauses: int
    clauses_data: List[Dict[str, Any]] = []
    isDefault: bool = False
    lastUsed: Optional[str] = None
    createdAt: str
    updatedAt: str
    createdBy: str
    isSystem: bool = False  # System templates cannot be deleted


class TemplateCreate(BaseModel):
    name: str
    type: str
    description: Optional[str] = ""
    clauses_data: List[Dict[str, Any]] = []


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    clauses_data: Optional[List[Dict[str, Any]]] = None
    isDefault: Optional[bool] = None


# ============== Default Templates Data ==============

DEFAULT_TEMPLATES = [
    {
        "id": "tpl-procurement",
        "name": "สัญญาจัดซื้อจัดจ้างทั่วไป",
        "type": "procurement",
        "description": "แม่แบบสัญญาจัดซื้อจัดจ้างพัสดุทั่วไป",
        "clauses": 12,
        "isDefault": True,
        "isSystem": True,
        "clauses_data": [
            {"number": 1, "title": "คำนิยาม", "content": "สัญญาฉบับนี้ทำขึ้นระหว่างหน่วยงานราชการ ซึ่งต่อไปนี้ในสัญญานี้เรียกว่า 'ผู้ว่าจ้าง' กับผู้รับจ้าง"},
            {"number": 2, "title": "วัตถุประสงค์", "content": "ผู้รับจ้างตกลงจัดส่งสินค้าตามรายการที่ระบุในเอกสารแนบท้ายสัญญา ครบถ้วนถูกต้องตาม specifications"},
            {"number": 3, "title": "การรับประกัน", "content": "ผู้รับจ้างรับประกันคุณภาพสินค้าเป็นระยะเวลา 1 ปี นับจากวันส่งมอบ หากพบความเสียหายให้เปลี่ยนหรือซ่อมแซมฟรี"},
            {"number": 4, "title": "กำหนดเวลา", "content": "การส่งมอบสินค้าต้องแล้วเสร็จภายในวันที่ระบุในสัญญา หากล่าช้าผู้รับจ้างต้องเสียค่าปรับวันละ 0.1% ของมูลค่าสัญญา"},
            {"number": 5, "title": "การตรวจรับ", "content": "ผู้ว่าจ้างมีสิทธิตรวจรับสินค้าภายใน 7 วันทำการ นับจากวันส่งมอบ หากไม่แจ้งถือว่าตรวจรับแล้ว"},
            {"number": 6, "title": "การชำระเงิน", "content": "การชำระเงินจะแบ่งเป็น 2 งวด งวดที่ 1 (50%) จ่ายเมื่อลงนามสัญญา งวดที่ 2 (50%) จ่ายเมื่อส่งมอบครบถ้วน"},
            {"number": 7, "title": "เอกสารประกอบ", "content": "ผู้รับจ้างต้องจัดส่งคู่มือการใช้งานและเอกสารประกอบการใช้งานครบถ้วนพร้อมสินค้า"},
            {"number": 8, "title": "หนังสือค้ำประกัน", "content": "ผู้รับจ้างต้องมีหนังสือค้ำประกันการปฏิบัติตามสัญญา คิดเป็นร้อยละ 5 ของมูลค่าสัญญา"},
            {"number": 9, "title": "การผิดสัญญา", "content": "หากผู้รับจ้างผิดสัญญา ผู้ว่าจ้างมีสิทธิบอกเลิกสัญญาและเรียกค่าเสียหายได้"},
            {"number": 10, "title": "การโอนกรรมสิทธิ์", "content": "ผู้รับจ้างห้ามมิให้โอนหรือทำสัญญาช่วงแก่ผู้อื่น เว้นแต่จะได้รับความยินยอมเป็นลายลักษณ์อักษรจากผู้ว่าจ้างก่อน"},
            {"number": 11, "title": "การบอกเลิกสัญญา", "content": "ผู้ว่าจ้างมีสิทธิบอกเลิกสัญญาได้ทันที โดยไม่ต้องแจ้งให้ทราบล่วงหน้า เมื่อผู้รับจ้างผิดสัญญาข้อใดข้อหนึ่ง"},
            {"number": 12, "title": "ข้อพิพาท", "content": "ข้อพิพาทให้อยู่ในอำนาจศาลไทยและใช้กฎหมายไทยในการพิจารณา"}
        ]
    },
    {
        "id": "tpl-construction",
        "name": "สัญญาเหมาก่อสร้าง",
        "type": "construction",
        "description": "แม่แบบสัญญาจ้างเหมาก่อสร้างอาคารและสาธารณูปโภค",
        "clauses": 18,
        "isDefault": False,
        "isSystem": True,
        "clauses_data": [
            {"number": 1, "title": "คำนิยาม", "content": "สัญญาฉบับนี้ทำขึ้นระหว่างผู้ว่าจ้างกับผู้รับจ้าง สำหรับงานก่อสร้างตามแบบแปลนที่ผู้ว่าจ้างกำหนด"},
            {"number": 2, "title": "ขอบเขตงาน", "content": "ผู้รับจ้างตกลงดำเนินการก่อสร้างตามแบบแปลนและรายละเอียดที่ผู้ว่าจ้างกำหนดอย่างเคร่งครัด"},
            {"number": 3, "title": "ความปลอดภัย", "content": "ผู้รับจ้างต้องรับผิดชอบความปลอดภัยในการทำงานและทำประกันอุบัติเหตุสำหรับผู้ปฏิบัติงานทุกคน"},
            {"number": 4, "title": "รายงานความก้าวหน้า", "content": "ผู้รับจ้างต้องส่งรายงานความก้าวหน้างานทุกสัปดาห์ให้ผู้ว่าจ้างพิจารณา"},
            {"number": 5, "title": "การรับประกัน", "content": "ผู้รับจ้างรับประกันคุณภาพงานเป็นระยะเวลา 5 ปี นับจากวันส่งมอบ หากพบความเสียหายต้องซ่อมแซมฟรี"},
            {"number": 6, "title": "การชำระเงิน", "content": "การชำระเงินแบ่งเป็น 3 งวด งวดที่ 1 (30%) จ่ายเมื่อลงนาม งวดที่ 2 (40%) จ่ายเมื่องานเสร็จครึ่งทาง งวดที่ 3 (30%) จ่ายเมื่อตรวจรับเรียบร้อย"}
        ]
    },
    {
        "id": "tpl-service",
        "name": "สัญญาจ้างบริการทั่วไป",
        "type": "service",
        "description": "แม่แบบสัญญาจ้างบริการทั่วไป",
        "clauses": 8,
        "isDefault": False,
        "isSystem": True,
        "clauses_data": [
            {"number": 1, "title": "คำนิยาม", "content": "สัญญาฉบับนี้ทำขึ้นระหว่างผู้ว่าจ้างกับผู้รับจ้าง สำหรับการให้บริการตามขอบเขตที่ระบุ"},
            {"number": 2, "title": "ขอบเขตงาน", "content": "ผู้รับจ้างตกลงให้บริการตามขอบเขตที่ระบุในสัญญาและเอกสารแนบอย่างเต็มที่และต่อเนื่อง"},
            {"number": 3, "title": "บุคลากร", "content": "ผู้รับจ้างต้องแต่งตั้งบุคลากรที่มีคุณวุฒิเหมาะสมมาปฏิบัติงานและแจ้งชื่อให้ผู้ว่าจ้างทราบ"},
            {"number": 4, "title": "มาตรฐานการบริการ", "content": "การให้บริการต้องเป็นไปตามมาตรฐานที่กำหนดในเอกสารราชการและกฎหมายที่เกี่ยวข้อง"},
            {"number": 5, "title": "การประเมิน", "content": "ผู้ว่าจ้างมีสิทธิประเมินคุณภาพการบริการทุกเดือน หากไม่เป็นไปตามมาตรฐานให้แก้ไขภายใน 7 วัน"},
            {"number": 6, "title": "การแก้ไขข้อบกพร่อง", "content": "ผู้รับจ้างต้องแก้ไขข้อบกพร่องภายใน 24 ชั่วโมงเมื่อได้รับแจ้งจากผู้ว่าจ้าง"},
            {"number": 7, "title": "การชำระเงิน", "content": "การชำระเงินจะจ่ายเป็นรายเดือนภายใน 5 วันทำการของเดือนถัดไป"},
            {"number": 8, "title": "การรักษาความลับ", "content": "ผู้รับจ้างต้องรักษาความลับของข้อมูลที่ได้รู้ในระหว่างปฏิบัติงาน"}
        ]
    },
    {
        "id": "tpl-consultant",
        "name": "สัญญาจ้างที่ปรึกษา",
        "type": "consultant",
        "description": "แม่แบบสัญญาจ้างที่ปรึกษา",
        "clauses": 10,
        "isDefault": False,
        "isSystem": True
    },
    {
        "id": "tpl-rental",
        "name": "สัญญาเช่าทรัพย์สิน",
        "type": "rental",
        "description": "แม่แบบสัญญาเช่าอาคารสถานที่และทรัพย์สิน",
        "clauses": 6,
        "isDefault": False,
        "isSystem": True
    },
    {
        "id": "tpl-software",
        "name": "สัญญาพัฒนาซอฟต์แวร์",
        "type": "software",
        "description": "แม่แบบสัญญาจ้างพัฒนาระบบซอฟต์แวร์",
        "clauses": 11,
        "isDefault": False,
        "isSystem": True
    }
]

# In-memory storage for user-created templates (until database schema is updated)
user_templates: Dict[str, List[Dict]] = {}


# ============== API Endpoints ==============

@router.get("")
def list_templates(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List all templates (system + user created)"""
    # Get system templates
    templates = [t.copy() for t in DEFAULT_TEMPLATES]
    
    # Add user templates
    user_tpls = user_templates.get(user_id, [])
    for t in user_tpls:
        templates.append(t.copy())
    
    # Add metadata
    for t in templates:
        t["clauses"] = len(t.get("clauses_data", [])) if t.get("clauses_data") else t.get("clauses", 0)
        if "clauses_data" in t:
            del t["clauses_data"]  # Don't send full clause data in list view
    
    return {
        "success": True,
        "data": templates,
        "count": len(templates)
    }


@router.get("/{template_id}")
def get_template(
    template_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get a specific template with full content"""
    # Check system templates
    for t in DEFAULT_TEMPLATES:
        if t["id"] == template_id:
            return {
                "success": True,
                "data": t
            }
    
    # Check user templates
    user_tpls = user_templates.get(user_id, [])
    for t in user_tpls:
        if t["id"] == template_id:
            return {
                "success": True,
                "data": t
            }
    
    raise HTTPException(status_code=404, detail="Template not found")


@router.post("")
def create_template(
    template: TemplateCreate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create a new template"""
    now = datetime.now().isoformat()
    
    new_template = {
        "id": f"tpl-{user_id}-{int(datetime.now().timestamp())}",
        "name": template.name,
        "type": template.type,
        "description": template.description or "",
        "clauses": len(template.clauses_data),
        "clauses_data": template.clauses_data,
        "isDefault": False,
        "lastUsed": None,
        "createdAt": now,
        "updatedAt": now,
        "createdBy": user_id,
        "isSystem": False
    }
    
    if user_id not in user_templates:
        user_templates[user_id] = []
    user_templates[user_id].append(new_template)
    
    logger.info(f"Template created: {new_template['id']} by user {user_id}")
    
    return {
        "success": True,
        "message": "Template created successfully",
        "data": new_template
    }


@router.put("/{template_id}")
def update_template(
    template_id: str,
    update: TemplateUpdate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Update a template"""
    # Cannot update system templates
    if template_id.startswith("tpl-") and not template_id.startswith(f"tpl-{user_id}"):
        raise HTTPException(status_code=403, detail="Cannot modify system templates")
    
    # Find template
    user_tpls = user_templates.get(user_id, [])
    for i, t in enumerate(user_tpls):
        if t["id"] == template_id:
            # Update fields
            if update.name is not None:
                t["name"] = update.name
            if update.type is not None:
                t["type"] = update.type
            if update.description is not None:
                t["description"] = update.description
            if update.clauses_data is not None:
                t["clauses_data"] = update.clauses_data
                t["clauses"] = len(update.clauses_data)
            if update.isDefault is not None:
                t["isDefault"] = update.isDefault
            
            t["updatedAt"] = datetime.now().isoformat()
            
            logger.info(f"Template updated: {template_id} by user {user_id}")
            
            return {
                "success": True,
                "message": "Template updated successfully",
                "data": t
            }
    
    raise HTTPException(status_code=404, detail="Template not found")


@router.delete("/{template_id}")
def delete_template(
    template_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Delete a template"""
    # Cannot delete system templates
    for t in DEFAULT_TEMPLATES:
        if t["id"] == template_id:
            raise HTTPException(status_code=403, detail="Cannot delete system templates")
    
    # Find and delete user template
    user_tpls = user_templates.get(user_id, [])
    for i, t in enumerate(user_tpls):
        if t["id"] == template_id:
            user_tpls.pop(i)
            logger.info(f"Template deleted: {template_id} by user {user_id}")
            return {
                "success": True,
                "message": "Template deleted successfully"
            }
    
    raise HTTPException(status_code=404, detail="Template not found")


@router.post("/{template_id}/set-default")
def set_default_template(
    template_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Set a template as default"""
    # Clear default from all system templates of same type
    template = None
    for t in DEFAULT_TEMPLATES:
        if t["id"] == template_id:
            template = t
            break
    
    # Check user templates
    user_tpls = user_templates.get(user_id, [])
    if not template:
        for t in user_tpls:
            if t["id"] == template_id:
                template = t
                break
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Clear default from all templates of same type
    template_type = template["type"]
    for t in DEFAULT_TEMPLATES:
        if t["type"] == template_type:
            t["isDefault"] = False
    for t in user_tpls:
        if t["type"] == template_type:
            t["isDefault"] = False
    
    # Set new default
    template["isDefault"] = True
    template["lastUsed"] = datetime.now().strftime("%Y-%m-%d")
    
    return {
        "success": True,
        "message": "Default template set successfully",
        "data": {"id": template_id, "isDefault": True}
    }


@router.post("/{template_id}/use")
def use_template(
    template_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Record template usage"""
    now = datetime.now().strftime("%Y-%m-%d")
    
    # Update in system templates
    for t in DEFAULT_TEMPLATES:
        if t["id"] == template_id:
            t["lastUsed"] = now
            return {"success": True, "message": "Template usage recorded"}
    
    # Update in user templates
    user_tpls = user_templates.get(user_id, [])
    for t in user_tpls:
        if t["id"] == template_id:
            t["lastUsed"] = now
            return {"success": True, "message": "Template usage recorded"}
    
    raise HTTPException(status_code=404, detail="Template not found")


# ============== Template Types ==============

@router.get("/types/list")
def list_template_types(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List all template types/categories"""
    types = [
        {"value": "procurement", "label": "จัดซื้อ", "label_th": "จัดซื้อ"},
        {"value": "construction", "label": "ก่อสร้าง", "label_th": "ก่อสร้าง"},
        {"value": "service", "label": "บริการ", "label_th": "บริการ"},
        {"value": "consultant", "label": "ที่ปรึกษา", "label_th": "ที่ปรึกษา"},
        {"value": "rental", "label": "เช่า", "label_th": "เช่า"},
        {"value": "concession", "label": "สัมปทาน", "label_th": "สัมปทาน"},
        {"value": "maintenance", "label": "ซ่อม", "label_th": "ซ่อม"},
        {"value": "training", "label": "อบรม", "label_th": "อบรม"},
        {"value": "research", "label": "วิจัย", "label_th": "วิจัย"},
        {"value": "software", "label": "ไอที", "label_th": "ไอที"},
        {"value": "land_sale", "label": "ที่ดิน", "label_th": "ที่ดิน"},
        {"value": "insurance", "label": "ประกัน", "label_th": "ประกัน"},
        {"value": "advertising", "label": "โฆษณา", "label_th": "โฆษณา"},
        {"value": "medical", "label": "สาธารณสุข", "label_th": "สาธารณสุข"},
        {"value": "agriculture", "label": "เกษตร", "label_th": "เกษตร"},
        {"value": "energy", "label": "พลังงาน", "label_th": "พลังงาน"},
        {"value": "logistics", "label": "ขนส่ง", "label_th": "ขนส่ง"},
        {"value": "waste_management", "label": "ขยะ", "label_th": "ขยะ"},
        {"value": "water_management", "label": "น้ำ", "label_th": "น้ำ"},
        {"value": "catering", "label": "อาหาร", "label_th": "อาหาร"},
        {"value": "security", "label": "รปภ.", "label_th": "รปภ."},
        {"value": "cleaning", "label": "ทำความสะอาด", "label_th": "ทำความสะอาด"},
        {"value": "printing", "label": "พิมพ์", "label_th": "พิมพ์"},
        {"value": "telecom", "label": "โทรคมฯ", "label_th": "โทรคมฯ"},
        {"value": "survey", "label": "สำรวจ", "label_th": "สำรวจ"}
    ]
    
    return {
        "success": True,
        "data": types
    }



# ============== AI Extraction ==============

class AIExtractRequest(BaseModel):
    custom_prompt: Optional[str] = None


class AIExtractResponse(BaseModel):
    success: bool
    data: Dict[str, Any]
    message: Optional[str] = None


# Default prompt for contract extraction
DEFAULT_TEMPLATE_EXTRACTION_PROMPT = """คุณเป็นระบบ AI สำหรับถอดความสัญญาและสร้าง Template

จากเอกสารสัญญาที่ให้มา กรุณา:
1. วิเคราะห์และแยกข้อกำหนด (Clauses) ออกเป็นข้อๆ
2. สร้างชื่อข้อ (title) ที่กระชับและเข้าใจง่าย
3. สรุปเนื้อหา (content) ของแต่ละข้อให้ชัดเจน

รูปแบบการตอบกลับ JSON:
{
    "template_name": "ชื่อ Template",
    "template_type": "ประเภทสัญญา (เช่น จัดซื้อ, ก่อสร้าง, บริการ)",
    "description": "คำอธิบายสั้นๆ",
    "clauses": [
        {"number": 1, "title": "ชื่อข้อ", "content": "เนื้อหา"},
        {"number": 2, "title": "ชื่อข้อ", "content": "เนื้อหา"}
    ]
}

กฎ:
- แยกข้อให้มีโครงสร้างชัดเจน
- ใช้ภาษาที่เป็นทางการแต่เข้าใจง่าย
- รักษาความหมายตามต้นฉบับ
- ถ้าไม่แน่ใจ ให้ใช้ข้อความต้นฉบับ"""


@router.post("/ai-extract", response_model=AIExtractResponse)
async def ai_extract_template(
    file: UploadFile = File(...),
    custom_prompt: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Extract template clauses from uploaded contract file using AI
    Supports PDF, DOCX, and image files
    """
    try:
        # Validate file type
        allowed_extensions = {'.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png', '.tiff'}
        file_ext = os.path.splitext(file.filename.lower())[1]
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Read file content
        content = await file.read()
        
        # Extract text using OCR or document parsing
        if file_ext in {'.pdf', '.jpg', '.jpeg', '.png', '.tiff'}:
            # Use OCR for PDFs and images
            ocr_service = OCRService()
            extracted_text = await ocr_service.extract_text(content, file_ext)
        elif file_ext in {'.docx', '.doc'}:
            # For DOCX, we'd need a document parser
            # For now, use OCR as fallback
            ocr_service = OCRService()
            extracted_text = await ocr_service.extract_text(content, file_ext)
        else:
            extracted_text = content.decode('utf-8', errors='ignore')
        
        if not extracted_text or len(extracted_text.strip()) < 50:
            raise HTTPException(
                status_code=400,
                detail="Could not extract sufficient text from file. Please ensure the file is readable."
            )
        
        # Prepare prompt
        prompt = custom_prompt or DEFAULT_TEMPLATE_EXTRACTION_PROMPT
        full_prompt = f"{prompt}\n\nเอกสารสัญญา:\n{extracted_text[:8000]}"  # Limit to 8000 chars
        
        # Call AI service
        llm_service = LLMService()
        ai_response = await llm_service.generate(
            prompt=full_prompt,
            model="typhoon",  # Use default model
            temperature=0.3,
            max_tokens=4000
        )
        
        # Parse JSON response
        try:
            # Try to extract JSON from response
            response_text = ai_response.get("text", "{}")
            
            # Find JSON in response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                parsed_data = json.loads(json_str)
            else:
                parsed_data = json.loads(response_text)
            
            # Validate structure
            if "clauses" not in parsed_data:
                raise ValueError("Missing 'clauses' in response")
            
            # Ensure clauses have proper structure
            clauses = []
            for i, clause in enumerate(parsed_data.get("clauses", [])):
                clauses.append({
                    "number": clause.get("number", i + 1),
                    "title": clause.get("title", f"ข้อ {i + 1}"),
                    "content": clause.get("content", "")
                })
            
            parsed_data["clauses"] = clauses
            
            return {
                "success": True,
                "data": parsed_data,
                "message": f"Successfully extracted {len(clauses)} clauses from contract"
            }
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response: {e}")
            return {
                "success": False,
                "data": {},
                "message": "AI returned invalid format. Please try again or adjust the prompt."
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI extraction failed: {str(e)}")


@router.get("/ai-extraction/prompt")
def get_default_extraction_prompt(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get the default AI extraction prompt for reference"""
    return {
        "success": True,
        "data": {
            "default_prompt": DEFAULT_TEMPLATE_EXTRACTION_PROMPT,
            "description": "คุณสามารถปรับแต่ง prompt นี้ได้ตามต้องการ เพื่อให้ AI ถอดความตามรูปแบบที่คุณต้องการ"
        }
    }


@router.post("/ai-extraction/test-prompt")
async def test_extraction_prompt(
    request: AIExtractRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Test a custom extraction prompt with sample data"""
    try:
        sample_contract = """
        สัญญาจัดซื้ออุปกรณ์คอมพิวเตอร์
        
        ข้อ 1 คำนิยาม
        สัญญาฉบับนี้ทำขึ้นระหว่างหน่วยงานราชการกับผู้ขาย
        
        ข้อ 2 วัตถุประสงค์
        ผู้ขายตกลงจัดส่งอุปกรณ์ตามรายการที่ระบุ
        
        ข้อ 3 การรับประกัน
        รับประกัน 1 ปี นับจากวันส่งมอบ
        """
        
        prompt = request.custom_prompt or DEFAULT_TEMPLATE_EXTRACTION_PROMPT
        full_prompt = f"{prompt}\n\nตัวอย่างเอกสาร:\n{sample_contract}"
        
        llm_service = LLMService()
        ai_response = await llm_service.generate(
            prompt=full_prompt,
            model="typhoon",
            temperature=0.3,
            max_tokens=2000
        )
        
        return {
            "success": True,
            "data": {
                "prompt_used": prompt,
                "ai_response": ai_response.get("text", ""),
                "note": "นี่คือตัวอย่างผลลัพธ์จาก prompt ของคุณ"
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prompt test failed: {str(e)}")
