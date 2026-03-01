"""
Contract Templates API Routes - Manage contract templates
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import os
import json
import uuid

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


# ============== System Extraction Prompt ==============
# In-memory storage for system prompt (in production, use database)
system_extraction_prompt = {
    "prompt": """คุณเป็นระบบ AI สำหรับถอดความสัญญาและสร้าง Template

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
- ถ้าไม่แน่ใจ ให้ใช้ข้อความต้นฉบับ""",
    "updated_at": datetime.now().isoformat(),
    "updated_by": "system"
}

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

# ============== DB Helpers ==============

def _row_to_template(row) -> dict:
    return {
        "id": row[0],
        "name": row[1],
        "type": row[2] or "",
        "description": row[3] or "",
        "clauses": row[4] or 0,
        "isDefault": bool(row[5]),
        "isSystem": bool(row[6]),
        "lastUsed": row[7].strftime("%Y-%m-%d") if row[7] else None,
        "createdBy": row[8] or "",
        "createdAt": row[9].isoformat() if row[9] else "",
        "updatedAt": row[10].isoformat() if row[10] else "",
        "variables": row[11] or [],
        "conditionalGroups": row[12] or [],
        "hasRawContent": bool(row[13]),
    }


def _get_db_templates(db: Session, user_id: str) -> list:
    """Get user-created templates from DB"""
    rows = db.execute(text("""
        SELECT id, name, type, description, clauses_count, is_default, is_system,
               last_used_at, created_by, created_at, updated_at,
               variables, conditional_groups, raw_content
        FROM contract_templates
        WHERE is_deleted = 0 AND created_by = :user_id
        ORDER BY created_at DESC
    """), {"user_id": user_id}).fetchall()
    return [_row_to_template(r) for r in rows]


def _get_db_template_by_id(db: Session, template_id: str) -> Optional[dict]:
    row = db.execute(text("""
        SELECT id, name, type, description, clauses_count, is_default, is_system,
               last_used_at, created_by, created_at, updated_at,
               variables, conditional_groups, raw_content
        FROM contract_templates WHERE id = :id AND is_deleted = 0
    """), {"id": template_id}).fetchone()
    if not row:
        return None
    t = _row_to_template(row)
    # Load clauses (include new columns)
    clauses = db.execute(text("""
        SELECT clause_number, title, content, content_template,
               optional, condition_key, condition_value
        FROM contract_template_clauses
        WHERE template_id = :tid AND is_deleted = 0
        ORDER BY sort_order, clause_number
    """), {"tid": template_id}).fetchall()
    t["clauses_data"] = [
        {
            "number": c[0],
            "title": c[1],
            "content": c[2],
            "content_template": c[3] or c[2],  # fallback to content
            "optional": bool(c[4]) if c[4] is not None else False,
            "condition_key": c[5],
            "condition_value": c[6],
        }
        for c in clauses
    ]
    t["clauses"] = len(t["clauses_data"])
    return t


# ============== Smart Import Prompt ==============

SMART_IMPORT_PROMPT = """คุณเป็นผู้เชี่ยวชาญด้านสัญญาภาครัฐไทย วิเคราะห์แม่แบบสัญญาต่อไปนี้และสร้างโครงสร้าง JSON

กฎสำคัญ:
1. แทนที่ช่องว่าง "…………", "........." และ "(หมายเลข)" ด้วย {{variable_key}} ใน content_template
2. อ่านหมายเหตุท้ายสัญญา (ถ้ามี) เพื่อระบุความหมายของหมายเลขแต่ละตัว
3. ข้อที่ระบุ "อาจเลือกใช้หรือตัดออกได้" ให้ optional=true
4. ข้อที่มีทางเลือก ก/ข ให้ใช้ conditional_groups และกำหนด condition_key/condition_value
5. ชื่อ key ต้องเป็น snake_case ภาษาอังกฤษ เช่น contract_no, employer_name
6. ตอบเฉพาะ JSON เท่านั้น ห้ามมีข้อความอื่น

โครงสร้าง JSON ที่ต้องการ:
{
  "template_name": "ชื่อแม่แบบสัญญา",
  "template_type": "construction|procurement|service|consultant|rental|other",
  "description": "คำอธิบาย 1-2 ประโยค",
  "variables": [
    {
      "key": "contract_no",
      "label": "เลขที่สัญญา",
      "type": "text|number|date|select|textarea|address",
      "required": true,
      "description": "คำอธิบาย field นี้",
      "placeholder": "ตัวอย่างค่า",
      "options": []
    }
  ],
  "conditional_groups": [
    {
      "key": "price_type",
      "label": "ประเภทราคา",
      "default": "lump_sum",
      "options": [
        {"value": "unit_price", "label": "ราคาต่อหน่วย (ข้อ ก)"},
        {"value": "lump_sum",   "label": "ราคาเหมารวม (ข้อ ข)"}
      ]
    }
  ],
  "clauses": [
    {
      "number": 1,
      "title": "ชื่อข้อ",
      "content_template": "เนื้อหาข้อ ใส่ {{variable_key}} แทนช่องว่าง",
      "optional": false,
      "condition_key": null,
      "condition_value": null
    }
  ]
}

แม่แบบสัญญา:
"""


# ============== API Endpoints ==============

@router.get("")
def list_templates(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List all templates (system + user created)"""
    templates = []
    # System templates (hardcoded)
    for t in DEFAULT_TEMPLATES:
        tc = t.copy()
        tc["clauses"] = len(tc.pop("clauses_data", [])) if "clauses_data" in tc else tc.get("clauses", 0)
        templates.append(tc)
    # DB templates
    for t in _get_db_templates(db, user_id):
        templates.append(t)
    return {"success": True, "data": templates, "count": len(templates)}


@router.get("/{template_id}")
def get_template(
    template_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get a specific template with full content"""
    for t in DEFAULT_TEMPLATES:
        if t["id"] == template_id:
            return {"success": True, "data": t}
    t = _get_db_template_by_id(db, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"success": True, "data": t}


@router.post("")
def create_template(
    template: TemplateCreate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create a new template"""
    tpl_id = str(uuid.uuid4())
    now = datetime.utcnow()
    db.execute(text("""
        INSERT INTO contract_templates
            (id, name, type, description, clauses_count, is_default, is_system,
             created_by, updated_by, created_at, updated_at, is_deleted)
        VALUES
            (:id, :name, :type, :description, :clauses_count, false, false,
             :created_by, :created_by, :now, :now, 0)
    """), {
        "id": tpl_id, "name": template.name, "type": template.type,
        "description": template.description or "",
        "clauses_count": len(template.clauses_data),
        "created_by": user_id, "now": now
    })
    for i, clause in enumerate(template.clauses_data):
        db.execute(text("""
            INSERT INTO contract_template_clauses
                (id, template_id, clause_number, title, content, sort_order,
                 created_by, updated_by, created_at, updated_at, is_deleted)
            VALUES
                (:id, :template_id, :num, :title, :content, :sort,
                 :user_id, :user_id, :now, :now, 0)
        """), {
            "id": str(uuid.uuid4()), "template_id": tpl_id,
            "num": clause.get("number", i + 1),
            "title": clause.get("title", ""),
            "content": clause.get("content", ""),
            "sort": i, "user_id": user_id, "now": now
        })
    db.commit()
    logger.info(f"Template created: {tpl_id} by user {user_id}")
    t = _get_db_template_by_id(db, tpl_id)
    return {"success": True, "message": "Template created successfully", "data": t}


@router.put("/{template_id}")
def update_template(
    template_id: str,
    update: TemplateUpdate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Update a template"""
    for t in DEFAULT_TEMPLATES:
        if t["id"] == template_id:
            raise HTTPException(status_code=403, detail="Cannot modify system templates")
    t = _get_db_template_by_id(db, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    # Build update
    sets = ["updated_at = :now", "updated_by = :user_id"]
    params: dict = {"id": template_id, "now": datetime.utcnow(), "user_id": user_id}
    if update.name is not None:
        sets.append("name = :name"); params["name"] = update.name
    if update.type is not None:
        sets.append("type = :type"); params["type"] = update.type
    if update.description is not None:
        sets.append("description = :desc"); params["desc"] = update.description
    if update.isDefault is not None:
        sets.append("is_default = :is_default"); params["is_default"] = update.isDefault
    if update.clauses_data is not None:
        sets.append("clauses_count = :cc"); params["cc"] = len(update.clauses_data)
        # Replace clauses
        db.execute(text("UPDATE contract_template_clauses SET is_deleted = 1 WHERE template_id = :id"), {"id": template_id})
        for i, clause in enumerate(update.clauses_data):
            db.execute(text("""
                INSERT INTO contract_template_clauses
                    (id, template_id, clause_number, title, content, sort_order,
                     created_by, updated_by, created_at, updated_at, is_deleted)
                VALUES
                    (:id, :tid, :num, :title, :content, :sort,
                     :uid, :uid, :now, :now, 0)
            """), {
                "id": str(uuid.uuid4()), "tid": template_id,
                "num": clause.get("number", i + 1),
                "title": clause.get("title", ""), "content": clause.get("content", ""),
                "sort": i, "uid": user_id, "now": datetime.utcnow()
            })
    db.execute(text(f"UPDATE contract_templates SET {', '.join(sets)} WHERE id = :id"), params)
    db.commit()
    logger.info(f"Template updated: {template_id} by user {user_id}")
    return {"success": True, "message": "Template updated successfully", "data": _get_db_template_by_id(db, template_id)}


@router.delete("/{template_id}")
def delete_template(
    template_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Delete a template"""
    for t in DEFAULT_TEMPLATES:
        if t["id"] == template_id:
            raise HTTPException(status_code=403, detail="Cannot delete system templates")
    t = _get_db_template_by_id(db, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    db.execute(text("UPDATE contract_templates SET is_deleted = 1 WHERE id = :id"), {"id": template_id})
    db.commit()
    logger.info(f"Template deleted: {template_id} by user {user_id}")
    return {"success": True, "message": "Template deleted successfully"}


@router.post("/{template_id}/set-default")
def set_default_template(
    template_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Set a template as default"""
    # Find template (system or DB)
    tpl_type = None
    for t in DEFAULT_TEMPLATES:
        if t["id"] == template_id:
            tpl_type = t["type"]; break
    if not tpl_type:
        t = _get_db_template_by_id(db, template_id)
        if not t:
            raise HTTPException(status_code=404, detail="Template not found")
        tpl_type = t["type"]
    # Clear default for same type in DB
    db.execute(text("""
        UPDATE contract_templates SET is_default = false
        WHERE type = :type AND is_deleted = 0
    """), {"type": tpl_type})
    # If DB template, set it as default
    db.execute(text("""
        UPDATE contract_templates SET is_default = true, last_used_at = :now
        WHERE id = :id
    """), {"id": template_id, "now": datetime.utcnow()})
    db.commit()
    return {"success": True, "message": "Default template set successfully", "data": {"id": template_id, "isDefault": True}}


@router.post("/{template_id}/use")
def use_template(
    template_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Record template usage"""
    db.execute(text("UPDATE contract_templates SET last_used_at = :now WHERE id = :id"),
               {"now": datetime.utcnow(), "id": template_id})
    db.commit()
    return {"success": True, "message": "Template usage recorded"}


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



# ============== Smart Template Import ==============

class SmartImportRequest(BaseModel):
    raw_text: str
    save: bool = True  # save to DB after extraction


class DraftContractRequest(BaseModel):
    variable_values: Dict[str, Any]
    conditional_selections: Dict[str, str] = {}  # group_key -> selected_value
    include_optional: Dict[str, bool] = {}  # clause_number -> include?
    output_format: str = "text"  # text | html


async def _call_llm_for_template(db, user_id: str, prompt: str) -> str:
    """Call user's active LLM provider to extract template structure."""
    import httpx as _httpx
    from app.models.ai_provider import AIProvider as _AIProvider
    from app.models.identity import User as _User

    user_obj = db.query(_User).filter(_User.id == user_id).first()
    provider = None
    if user_obj and getattr(user_obj, 'active_llm_provider_id', None):
        provider = db.query(_AIProvider).filter(
            _AIProvider.id == user_obj.active_llm_provider_id
        ).first()
    if not provider:
        provider = db.query(_AIProvider).filter(
            _AIProvider.user_id == user_id,
            _AIProvider.is_active == True,
            _AIProvider.capabilities.contains(['chat'])
        ).first()
    if not provider:
        raise HTTPException(status_code=400,
            detail="ไม่มี AI provider ที่ตั้งค่าไว้ กรุณาตั้งค่า AI ใน Settings > AI Models")

    base_url = (provider.api_url or "").rstrip("/")
    if base_url.endswith("/v1"):
        base_url = base_url[:-3]
    headers = {"Content-Type": "application/json"}
    if provider.api_key:
        headers["Authorization"] = f"Bearer {provider.api_key}"

    if (provider.provider_type or "") == "ollama":
        payload = {"model": provider.model, "prompt": prompt, "stream": False}
        async with _httpx.AsyncClient() as client:
            resp = await client.post(f"{base_url}/api/generate", json=payload, headers=headers, timeout=240.0)
            resp.raise_for_status()
            return resp.json().get("response", "")
    else:
        payload = {
            "model": provider.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 8000,
            "temperature": 0.1,
        }
        async with _httpx.AsyncClient() as client:
            resp = await client.post(f"{base_url}/v1/chat/completions", json=payload, headers=headers, timeout=240.0)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]


@router.post("/import-smart")
async def smart_import_template(
    request: SmartImportRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Smart template import: LLM reads raw contract text and extracts structured template
    with variables ({{placeholders}}), optional clauses, and conditional ก/ข groups.
    """
    if len(request.raw_text.strip()) < 100:
        raise HTTPException(status_code=400, detail="ข้อความสัญญาสั้นเกินไป")

    full_prompt = SMART_IMPORT_PROMPT + request.raw_text[:12000]

    try:
        ai_text = await _call_llm_for_template(db, user_id, full_prompt)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM call failed: {e}")

    # Extract JSON from response
    try:
        json_start = ai_text.find('{')
        json_end = ai_text.rfind('}') + 1
        if json_start < 0 or json_end <= json_start:
            raise ValueError("No JSON found")
        extracted = json.loads(ai_text[json_start:json_end])
    except Exception as e:
        raise HTTPException(status_code=422,
            detail=f"LLM returned invalid JSON: {e}. Raw: {ai_text[:500]}")

    if not request.save:
        return {"success": True, "data": extracted}

    # Save to DB
    template_id = str(uuid.uuid4())
    clauses = extracted.get("clauses", [])
    variables = extracted.get("variables", [])
    conditional_groups = extracted.get("conditional_groups", [])

    db.execute(text("""
        INSERT INTO contract_templates
          (id, name, type, description, clauses_count, is_default, is_system,
           variables, conditional_groups, raw_content, created_by, created_at, updated_at, is_deleted)
        VALUES
          (:id, :name, :type, :desc, :cnt, false, false,
           :vars, :cgroups, :raw, :uid, NOW(), NOW(), 0)
    """), {
        "id": template_id,
        "name": extracted.get("template_name", "แม่แบบสัญญาใหม่"),
        "type": extracted.get("template_type", "other"),
        "desc": extracted.get("description", ""),
        "cnt": len(clauses),
        "vars": json.dumps(variables, ensure_ascii=False),
        "cgroups": json.dumps(conditional_groups, ensure_ascii=False),
        "raw": request.raw_text[:50000],
        "uid": user_id,
    })

    for i, clause in enumerate(clauses):
        db.execute(text("""
            INSERT INTO contract_template_clauses
              (id, template_id, clause_number, title, content, content_template,
               optional, condition_key, condition_value, sort_order,
               created_at, updated_at, is_deleted)
            VALUES
              (:id, :tid, :num, :title, :content, :tmpl,
               :opt, :ckey, :cval, :sort,
               NOW(), NOW(), 0)
        """), {
            "id": str(uuid.uuid4()),
            "tid": template_id,
            "num": clause.get("number", i + 1),
            "title": clause.get("title", f"ข้อ {i+1}"),
            "content": clause.get("content_template", clause.get("content", "")),
            "tmpl": clause.get("content_template", clause.get("content", "")),
            "opt": clause.get("optional", False),
            "ckey": clause.get("condition_key"),
            "cval": clause.get("condition_value"),
            "sort": i,
        })

    db.commit()

    return {
        "success": True,
        "message": f"นำเข้า template สำเร็จ พบ {len(clauses)} ข้อ, {len(variables)} field",
        "data": {
            "template_id": template_id,
            "template_name": extracted.get("template_name"),
            "clauses_count": len(clauses),
            "variables_count": len(variables),
            "conditional_groups_count": len(conditional_groups),
            "extracted": extracted,
        }
    }


@router.post("/{template_id}/draft")
def draft_contract(
    template_id: str,
    request: DraftContractRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Generate a filled contract from a template by substituting variable values.
    Returns the complete contract text with all placeholders filled in.
    """
    # Get template with clauses
    t = _get_db_template_by_id(db, template_id)

    # Also check system templates
    if not t:
        for sys_tpl in DEFAULT_TEMPLATES:
            if sys_tpl["id"] == template_id:
                t = sys_tpl
                break

    if not t:
        raise HTTPException(status_code=404, detail="Template not found")

    vals = request.variable_values
    cond_sel = request.conditional_selections
    inc_opt = request.include_optional

    lines = []
    lines.append(f"# {t['name']}\n")

    clauses = t.get("clauses_data", [])
    if not clauses:
        # Fallback: use clauses list for system templates
        clauses = [{"number": c.get("number", i+1), "title": c.get("title", ""),
                    "content_template": c.get("content", ""),
                    "optional": False, "condition_key": None, "condition_value": None}
                   for i, c in enumerate(t.get("clauses_data") or [])]

    for clause in clauses:
        num = clause.get("number")
        title = clause.get("title", "")
        tmpl = clause.get("content_template") or clause.get("content", "")
        optional = clause.get("optional", False)
        ckey = clause.get("condition_key")
        cval = clause.get("condition_value")

        # Skip optional clauses not included
        if optional:
            clause_key = str(num)
            if not inc_opt.get(clause_key, True):
                continue

        # Skip conditional clauses that don't match selection
        if ckey and cval:
            selected = cond_sel.get(ckey)
            if selected and selected != cval:
                continue

        # Fill in variables
        filled = tmpl
        for var_key, var_val in vals.items():
            filled = filled.replace("{{" + var_key + "}}", str(var_val) if var_val is not None else "")

        # Replace any remaining unfilled placeholders with underline
        import re as _re
        filled = _re.sub(r'\{\{[^}]+\}\}', '___________', filled)

        lines.append(f"ข้อ {num}  {title}")
        lines.append(filled)
        lines.append("")

    contract_text = "\n".join(lines)

    # Update last_used_at
    db.execute(text("UPDATE contract_templates SET last_used_at = NOW() WHERE id = :id"),
               {"id": template_id})
    db.commit()

    return {
        "success": True,
        "data": {
            "contract_text": contract_text,
            "template_name": t["name"],
            "variables_filled": len(vals),
        }
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
        mime_map = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
            '.png': 'image/png', '.tiff': 'image/tiff',
        }
        if file_ext in mime_map:
            from app.services.document.ocr_settings_service import get_ocr_settings_service
            ocr_settings_svc = get_ocr_settings_service(db=db, user_id=user_id)
            ocr_svc = OCRService(ocr_settings_service=ocr_settings_svc)
            ocr_result = ocr_svc.process_document(content, mime_map[file_ext])
            if not ocr_result.success:
                raise HTTPException(status_code=400, detail=f"OCR failed: {ocr_result.error}")
            extracted_text = ocr_result.text or ""
        elif file_ext in {'.docx', '.doc'}:
            try:
                import io
                from docx import Document as DocxDocument
                doc = DocxDocument(io.BytesIO(content))
                extracted_text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
            except Exception:
                extracted_text = content.decode('utf-8', errors='ignore')
        else:
            extracted_text = content.decode('utf-8', errors='ignore')

        if not extracted_text or len(extracted_text.strip()) < 50:
            raise HTTPException(
                status_code=400,
                detail="Could not extract sufficient text from file. Please ensure the file is readable."
            )

        # Prepare prompt
        global system_extraction_prompt
        prompt = custom_prompt or system_extraction_prompt.get("prompt", "")
        full_prompt = f"{prompt}\n\nเอกสารสัญญา:\n{extracted_text[:8000]}"

        # Use user's configured active LLM provider
        import httpx as _httpx
        from app.models.ai_provider import AIProvider as _AIProvider
        from app.models.identity import User as _User

        user_obj = db.query(_User).filter(_User.id == user_id).first()
        provider = None
        if user_obj and getattr(user_obj, 'active_llm_provider_id', None):
            provider = db.query(_AIProvider).filter(
                _AIProvider.id == user_obj.active_llm_provider_id
            ).first()
        if not provider:
            provider = db.query(_AIProvider).filter(
                _AIProvider.user_id == user_id,
                _AIProvider.is_active == True,
                _AIProvider.capabilities.contains(['chat'])
            ).first()
        if not provider:
            raise HTTPException(
                status_code=400,
                detail="ไม่มี AI provider ที่ตั้งค่าไว้ กรุณาตั้งค่า AI ใน Settings > AI Models"
            )

        base_url = (provider.api_url or "").rstrip("/")
        if base_url.endswith("/v1"):
            base_url = base_url[:-3]
        headers = {"Content-Type": "application/json"}
        if provider.api_key:
            headers["Authorization"] = f"Bearer {provider.api_key}"

        if (provider.provider_type or "") == "ollama":
            payload = {"model": provider.model, "prompt": full_prompt, "stream": False}
            async with _httpx.AsyncClient() as client:
                resp = await client.post(f"{base_url}/api/generate", json=payload, headers=headers, timeout=180.0)
                resp.raise_for_status()
                ai_text = resp.json().get("response", "")
        else:
            payload = {
                "model": provider.model,
                "messages": [{"role": "user", "content": full_prompt}],
                "max_tokens": 4000,
                "temperature": 0.3,
            }
            async with _httpx.AsyncClient() as client:
                resp = await client.post(f"{base_url}/v1/chat/completions", json=payload, headers=headers, timeout=180.0)
                resp.raise_for_status()
                ai_text = resp.json()["choices"][0]["message"]["content"]

        ai_response = {"text": ai_text}
        
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

        import httpx as _httpx
        from app.models.ai_provider import AIProvider as _AIProvider
        from app.models.identity import User as _User

        user_obj = db.query(_User).filter(_User.id == user_id).first()
        provider = None
        if user_obj and getattr(user_obj, 'active_llm_provider_id', None):
            provider = db.query(_AIProvider).filter(
                _AIProvider.id == user_obj.active_llm_provider_id
            ).first()
        if not provider:
            provider = db.query(_AIProvider).filter(
                _AIProvider.user_id == user_id,
                _AIProvider.is_active == True,
                _AIProvider.capabilities.contains(['chat'])
            ).first()
        if not provider:
            raise HTTPException(status_code=400, detail="ไม่มี AI provider ที่ตั้งค่าไว้ กรุณาตั้งค่า AI ใน Settings > AI Models")

        base_url = (provider.api_url or "").rstrip("/")
        if base_url.endswith("/v1"):
            base_url = base_url[:-3]
        headers = {"Content-Type": "application/json"}
        if provider.api_key:
            headers["Authorization"] = f"Bearer {provider.api_key}"

        if (provider.provider_type or "") == "ollama":
            payload = {"model": provider.model, "prompt": full_prompt, "stream": False}
            async with _httpx.AsyncClient() as client:
                resp = await client.post(f"{base_url}/api/generate", json=payload, headers=headers, timeout=120.0)
                resp.raise_for_status()
                ai_text = resp.json().get("response", "")
        else:
            payload = {
                "model": provider.model,
                "messages": [{"role": "user", "content": full_prompt}],
                "max_tokens": 2000,
                "temperature": 0.3,
            }
            async with _httpx.AsyncClient() as client:
                resp = await client.post(f"{base_url}/v1/chat/completions", json=payload, headers=headers, timeout=120.0)
                resp.raise_for_status()
                ai_text = resp.json()["choices"][0]["message"]["content"]

        return {
            "success": True,
            "data": {
                "prompt_used": prompt,
                "ai_response": ai_text,
                "note": "นี่คือตัวอย่างผลลัพธ์จาก prompt ของคุณ"
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prompt test failed: {str(e)}")



# ============== System Prompt Management ==============

class SystemPromptUpdate(BaseModel):
    prompt: str


@router.get("/settings/extraction-prompt")
def get_system_extraction_prompt(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get the current system extraction prompt (admin only)"""
    global system_extraction_prompt
    
    return {
        "success": True,
        "data": {
            "prompt": system_extraction_prompt.get("prompt", ""),
            "updated_at": system_extraction_prompt.get("updated_at"),
            "updated_by": system_extraction_prompt.get("updated_by")
        }
    }


@router.put("/settings/extraction-prompt")
def update_system_extraction_prompt(
    update: SystemPromptUpdate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Update the system extraction prompt (admin only)"""
    global system_extraction_prompt
    
    if not update.prompt or len(update.prompt.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail="Prompt must be at least 50 characters"
        )
    
    system_extraction_prompt = {
        "prompt": update.prompt.strip(),
        "updated_at": datetime.now().isoformat(),
        "updated_by": user_id
    }
    
    logger.info(f"System extraction prompt updated by user {user_id}")
    
    return {
        "success": True,
        "message": "System extraction prompt updated successfully",
        "data": {
            "updated_at": system_extraction_prompt["updated_at"],
            "updated_by": user_id
        }
    }


@router.post("/settings/extraction-prompt/reset")
def reset_system_extraction_prompt(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Reset system extraction prompt to default"""
    global system_extraction_prompt
    
    default_prompt = """คุณเป็นระบบ AI สำหรับถอดความสัญญาและสร้าง Template

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
    
    system_extraction_prompt = {
        "prompt": default_prompt,
        "updated_at": datetime.now().isoformat(),
        "updated_by": user_id
    }
    
    logger.info(f"System extraction prompt reset to default by user {user_id}")
    
    return {
        "success": True,
        "message": "System extraction prompt reset to default",
        "data": {
            "updated_at": system_extraction_prompt["updated_at"]
        }
    }
