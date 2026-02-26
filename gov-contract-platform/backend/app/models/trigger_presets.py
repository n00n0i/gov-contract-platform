"""
Trigger Presets - Pre-defined triggers for common use cases
Users just select which presets to enable for each agent
"""
from enum import Enum
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field


class TriggerCategory(str, Enum):
    DOCUMENT = "document"
    CONTRACT = "contract"
    VENDOR = "vendor"
    SYSTEM = "system"
    COMPLIANCE = "compliance"


@dataclass
class TriggerPreset:
    """Pre-defined trigger configuration"""
    id: str
    name: str
    name_en: str
    description: str
    category: TriggerCategory
    trigger_type: str
    icon: str
    color: str
    
    # Default configuration
    conditions: Dict[str, Any] = field(default_factory=dict)
    applicable_pages: List[str] = field(default_factory=list)
    button_config: Optional[Dict[str, Any]] = None
    schedule_config: Optional[Dict[str, Any]] = None
    
    # Metadata
    requires_kb: bool = False  # Requires knowledge base
    requires_graphrag: bool = False
    suggested_models: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "name_en": self.name_en,
            "description": self.description,
            "category": self.category.value,
            "trigger_type": self.trigger_type,
            "icon": self.icon,
            "color": self.color,
            "conditions": self.conditions,
            "applicable_pages": self.applicable_pages,
            "button_config": self.button_config,
            "schedule_config": self.schedule_config,
            "requires_kb": self.requires_kb,
            "requires_graphrag": self.requires_graphrag,
            "suggested_models": self.suggested_models,
        }


# ============================================
# SYSTEM TRIGGER PRESETS
# ============================================

TRIGGER_PRESETS: List[TriggerPreset] = [
    # ===== DOCUMENT TRIGGERS =====
    TriggerPreset(
        id="doc_analyze_upload",
        name="วิเคราะห์เอกสารอัตโนมัติ",
        name_en="Auto Analyze Document",
        description="วิเคราะห์เอกสารทันทีเมื่อมีการอัพโหลด (สัญญา, TOR, เอกสารประกวดราคา)",
        category=TriggerCategory.DOCUMENT,
        trigger_type="document_upload",
        icon="file-text",
        color="blue",
        conditions={
            "file_types": [".pdf", ".doc", ".docx", ".txt"],
            "max_file_size": 52428800,  # 50MB
            "auto_analyze": True
        },
        applicable_pages=["/documents", "/documents/upload"],
        requires_kb=True,
        suggested_models=["gpt-4", "typhoon", "llama3.1"]
    ),
    
    TriggerPreset(
        id="doc_ocr_scan",
        name="OCR เอกสารสแกน",
        name_en="OCR Scanned Documents",
        description="แปลงเอกสารสแกน (PDF, รูปภาพ) เป็นข้อความอัตโนมัติ",
        category=TriggerCategory.DOCUMENT,
        trigger_type="document_upload",
        icon="scan",
        color="indigo",
        conditions={
            "file_types": [".pdf", ".png", ".jpg", ".jpeg", ".tiff"],
            "requires_ocr": True,
            "ocr_language": "tha+eng"
        },
        applicable_pages=["/documents/upload"],
        suggested_models=["gpt-4-vision"]
    ),
    
    TriggerPreset(
        id="doc_classify",
        name="จำแนกประเภทเอกสาร",
        name_en="Auto Classify Document",
        description="จำแนกประเภทเอกสารอัตโนมัติ (สัญญา, TOR, ใบเสนอราคา, etc.)",
        category=TriggerCategory.DOCUMENT,
        trigger_type="document_upload",
        icon="folder-tree",
        color="cyan",
        conditions={
            "classify_document_type": True,
            "extract_metadata": True
        },
        applicable_pages=["/documents"],
        requires_kb=True,
        suggested_models=["gpt-4", "llama3.1"]
    ),
    
    # ===== CONTRACT TRIGGERS =====
    TriggerPreset(
        id="contract_review_btn",
        name="วิเคราะห์สัญญา (กดปุ่ม)",
        name_en="Contract Analysis Button",
        description="เพิ่มปุ่ม 'วิเคราะห์ด้วย AI' ในหน้ารายละเอียดสัญญา",
        category=TriggerCategory.CONTRACT,
        trigger_type="button_click",
        icon="file-search",
        color="purple",
        conditions={
            "analysis_type": "comprehensive",
            "check_risk": True,
            "check_compliance": True,
            "check_terms": True
        },
        applicable_pages=["/contracts/:id"],
        button_config={
            "label": "วิเคราะห์สัญญาด้วย AI",
            "icon": "bot",
            "position": "top-right",
            "style": "primary",
            "confirm_before_run": False
        },
        requires_kb=True,
        suggested_models=["gpt-4", "typhoon"]
    ),
    
    TriggerPreset(
        id="contract_create_check",
        name="ตรวจสอบตอนสร้างสัญญา",
        name_en="Check on Contract Create",
        description="ตรวจสอบความถูกต้องและความเสี่ยงเมื่อสร้างสัญญาใหม่",
        category=TriggerCategory.CONTRACT,
        trigger_type="contract_created",
        icon="file-plus",
        color="emerald",
        conditions={
            "check_template_compliance": True,
            "check_required_clauses": True,
            "check_risk_level": True,
            "validate_budget": True
        },
        applicable_pages=["/contracts/new"],
        requires_kb=True,
        suggested_models=["gpt-4", "llama3.1"]
    ),
    
    TriggerPreset(
        id="contract_approve_analysis",
        name="วิเคราะห์ก่อนอนุมัติ",
        name_en="Pre-Approval Analysis",
        description="วิเคราะห์ความเสี่ยงและความสอดคล้องก่อนอนุมัติสัญญา",
        category=TriggerCategory.CONTRACT,
        trigger_type="contract_approval_requested",
        icon="check-circle",
        color="amber",
        conditions={
            "generate_summary": True,
            "check_risk_factors": True,
            "check_vendor_history": True,
            "verify_budget_available": True,
            "suggest_approval_decision": True
        },
        applicable_pages=["/contracts/:id/approve"],
        requires_kb=True,
        requires_graphrag=True,
        suggested_models=["gpt-4"]
    ),
    
    TriggerPreset(
        id="contract_expiry_alert",
        name="แจ้งเตือนสัญญาใกล้หมดอายุ",
        name_en="Contract Expiry Alert",
        description="แจ้งเตือนเมื่อสัญญาใกล้หมดอายุ (30, 60, 90 วัน)",
        category=TriggerCategory.CONTRACT,
        trigger_type="scheduled",
        icon="clock",
        color="orange",
        conditions={
            "alert_days": [30, 60, 90],
            "include_renewal_suggestion": True
        },
        applicable_pages=["/dashboard"],
        schedule_config={
            "cron": "0 9 * * 1-5",  # 9 AM ทุกวันทำการ
            "timezone": "Asia/Bangkok"
        },
        suggested_models=["gpt-4"]
    ),
    
    TriggerPreset(
        id="contract_draft_assist",
        name="ช่วยเขียนร่างสัญญา",
        name_en="Contract Draft Assistant",
        description="ช่วยเขียนร่างสัญญาจาก TOR หรือ requirements",
        category=TriggerCategory.CONTRACT,
        trigger_type="button_click",
        icon="pen-tool",
        color="violet",
        conditions={
            "draft_from_tor": True,
            "include_standard_clauses": True,
            "comply_with_regulations": ["พ.ร.บ. การจัดซื้อจัดจ้าง"]
        },
        applicable_pages=["/contracts/new"],
        button_config={
            "label": "สร้างร่างสัญญาด้วย AI",
            "icon": "sparkles",
            "position": "form-actions",
            "style": "secondary"
        },
        requires_kb=True,
        suggested_models=["gpt-4", "typhoon"]
    ),
    
    # ===== VENDOR TRIGGERS =====
    TriggerPreset(
        id="vendor_check_new",
        name="ตรวจสอบผู้รับจ้างใหม่",
        name_en="Check New Vendor",
        description="ตรวจสอบ blacklist, ประวัติ, เอกสารครบถ้วน เมื่อสร้างผู้รับจ้างใหม่",
        category=TriggerCategory.VENDOR,
        trigger_type="vendor_created",
        icon="user-check",
        color="teal",
        conditions={
            "check_blacklist": True,
            "check_duplicate": True,
            "verify_documents": ["ทะเบียนพาณิชย์", "ภ.พ.20", "สำเนาบัตรประชาชน"],
            "check_financial_status": True
        },
        applicable_pages=["/vendors/new", "/vendors/:id"],
        requires_graphrag=True,
        suggested_models=["gpt-4"]
    ),
    
    TriggerPreset(
        id="vendor_analyze_btn",
        name="วิเคราะห์ผู้รับจ้าง (กดปุ่ม)",
        name_en="Analyze Vendor Button",
        description="เพิ่มปุ่มวิเคราะห์ความน่าเชื่อถือในหน้าผู้รับจ้าง",
        category=TriggerCategory.VENDOR,
        trigger_type="button_click",
        icon="shield-check",
        color="sky",
        conditions={
            "analyze_risk": True,
            "check_past_performance": True,
            "suggest_credit_limit": True
        },
        applicable_pages=["/vendors/:id"],
        button_config={
            "label": "วิเคราะห์ความเสี่ยง",
            "icon": "shield",
            "position": "actions",
            "style": "primary"
        },
        requires_graphrag=True,
        suggested_models=["gpt-4"]
    ),
    
    # ===== COMPLIANCE TRIGGERS =====
    TriggerPreset(
        id="compliance_auto_check",
        name="ตรวจสอบความสอดคล้องอัตโนมัติ",
        name_en="Auto Compliance Check",
        description="ตรวจสอบความสอดคล้อง พ.ร.บ. การจัดซื้อจัดจ้าง อัตโนมัติ",
        category=TriggerCategory.COMPLIANCE,
        trigger_type="contract_updated",
        icon="shield",
        color="rose",
        conditions={
            "check_procurement_law": True,
            "check_required_clauses": True,
            "validate_signing_authority": True,
            "check_budget_approval": True
        },
        applicable_pages=["/contracts/:id/edit"],
        requires_kb=True,
        suggested_models=["gpt-4"]
    ),
    
    TriggerPreset(
        id="risk_assessment_report",
        name="ประเมินความเสี่ยงอัตโนมัติ",
        name_en="Auto Risk Assessment",
        description="ประเมินความเสี่ยงสัญญาอัตโนมัติและแจ้งเตือน",
        category=TriggerCategory.COMPLIANCE,
        trigger_type="contract_status_changed",
        icon="alert-triangle",
        color="red",
        conditions={
            "assess_financial_risk": True,
            "assess_delivery_risk": True,
            "assess_legal_risk": True,
            "alert_high_risk": True
        },
        applicable_pages=["/contracts"],
        requires_kb=True,
        requires_graphrag=True,
        suggested_models=["gpt-4"]
    ),
    
    # ===== SYSTEM TRIGGERS =====
    TriggerPreset(
        id="weekly_summary",
        name="สรุปรายงานประจำสัปดาห์",
        name_en="Weekly Summary Report",
        description="สร้างสรุปรายงานสัญญาและสถิติประจำสัปดาห์ส่งอีเมล",
        category=TriggerCategory.SYSTEM,
        trigger_type="scheduled",
        icon="bar-chart",
        color="slate",
        conditions={
            "include_new_contracts": True,
            "include_expiring": True,
            "include_pending_approvals": True,
            "format": "email"
        },
        applicable_pages=["/dashboard"],
        schedule_config={
            "cron": "0 8 * * 1",  # 8 AM วันจันทร์
            "timezone": "Asia/Bangkok"
        },
        suggested_models=["gpt-4"]
    ),
    
    TriggerPreset(
        id="payment_due_alert",
        name="แจ้งเตือนการจ่ายเงิน",
        name_en="Payment Due Alert",
        description="แจ้งเตือนกำหนดการจ่ายเงินใกล้ถึง",
        category=TriggerCategory.SYSTEM,
        trigger_type="payment_due",
        icon="dollar-sign",
        color="green",
        conditions={
            "alert_days_before": 7,
            "check_budget_available": True
        },
        applicable_pages=["/dashboard"],
        suggested_models=["gpt-4"]
    ),
    
    TriggerPreset(
        id="anomaly_detection",
        name="ตรวจจับความผิดปกติ",
        name_en="Anomaly Detection",
        description="ตรวจจับสัญญาที่ผิดปกติ (ราคาสูงผิด, เงื่อนไขแปลก, etc.)",
        category=TriggerCategory.SYSTEM,
        trigger_type="anomaly_detected",
        icon="radar",
        color="fuchsia",
        conditions={
            "detect_unusual_amount": True,
            "detect_duplicate_contracts": True,
            "detect_blacklist_vendor": True,
            "detect_missing_clauses": True,
            "sensitivity": "medium"
        },
        applicable_pages=["/contracts", "/dashboard"],
        requires_graphrag=True,
        suggested_models=["gpt-4"]
    ),
]


def get_trigger_presets(category: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get trigger presets, optionally filtered by category"""
    presets = TRIGGER_PRESETS
    if category:
        presets = [p for p in presets if p.category.value == category]
    return [p.to_dict() for p in presets]


def get_trigger_preset_by_id(preset_id: str) -> Optional[TriggerPreset]:
    """Get a specific trigger preset by ID"""
    for preset in TRIGGER_PRESETS:
        if preset.id == preset_id:
            return preset
    return None


def get_preset_categories() -> List[Dict[str, str]]:
    """Get available trigger categories"""
    return [
        {"value": "document", "label": "เอกสาร", "icon": "file-text", "color": "blue"},
        {"value": "contract", "label": "สัญญา", "icon": "file-signature", "color": "purple"},
        {"value": "vendor", "label": "ผู้รับจ้าง", "icon": "users", "color": "teal"},
        {"value": "compliance", "label": "กฎระเบียบ", "icon": "shield", "color": "rose"},
        {"value": "system", "label": "ระบบ", "icon": "settings", "color": "slate"},
    ]
