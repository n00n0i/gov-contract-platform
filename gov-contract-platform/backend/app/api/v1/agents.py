"""
AI Agents API Routes - Manage AI agents with full configuration
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.core.security import get_current_user_id, get_current_user_payload
from app.core.logging import get_logger
from app.models.ai_models import AIAgent, AgentExecution, KnowledgeBase, AgentStatus, TriggerEvent, OutputAction
from app.models.ai_provider import AIProvider
from app.models.trigger_models import AgentTrigger, TriggerExecution, TriggerTemplate, TriggerType, TriggerStatus, ExecutionStatus

router = APIRouter(prefix="/agents", tags=["AI Agents"])
logger = get_logger(__name__)


# ============== Schemas ==============

class ModelConfig(BaseModel):
    temperature: float = Field(0.7, ge=0.0, le=1.0)
    max_tokens: int = Field(2000, ge=100, le=32000)
    top_p: Optional[float] = Field(0.9, ge=0.0, le=1.0)


class InputSchema(BaseModel):
    text: Optional[bool] = True
    document_content: Optional[bool] = False
    contract_data: Optional[bool] = False
    vendor_id: Optional[bool] = False


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = ""
    provider_id: Optional[str] = None
    model_config: Optional[ModelConfig] = None
    system_prompt: str = ""
    
    # Knowledge
    knowledge_base_ids: List[str] = []
    use_graphrag: bool = False
    
    # Triggers
    trigger_events: List[str] = []
    trigger_pages: List[str] = []
    trigger_condition: Optional[str] = ""
    
    # Input/Output
    input_schema: Optional[InputSchema] = None
    output_action: str = "show_popup"
    output_target: Optional[str] = ""
    output_format: str = "json"
    
    # Permission
    allowed_roles: List[str] = []


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    provider_id: Optional[str] = None
    model_config: Optional[ModelConfig] = None
    system_prompt: Optional[str] = None
    knowledge_base_ids: Optional[List[str]] = None
    use_graphrag: Optional[bool] = None
    trigger_events: Optional[List[str]] = None
    trigger_pages: Optional[List[str]] = None
    trigger_condition: Optional[str] = None
    input_schema: Optional[InputSchema] = None
    output_action: Optional[str] = None
    output_target: Optional[str] = None
    output_format: Optional[str] = None
    allowed_roles: Optional[List[str]] = None


class AgentExecuteRequest(BaseModel):
    input: Dict[str, Any]
    context: Optional[Dict[str, Any]] = {}
    trigger_event: Optional[str] = "manual"
    trigger_page: Optional[str] = None


class KnowledgeBaseCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    kb_type: str = "documents"  # documents, regulations, templates
    document_ids: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)


# ============== System Default Agents ==============
# Note: These will use the first available LLM provider

SYSTEM_AGENTS = [
    {
        "id": "agent-contract-drafter",
        "name": "Contract Drafter",
        "description": "AI ช่วยร่างสัญญาตามแม่แบบและข้อกำหนด",
        "provider_id": None,  # Will use first available LLM provider
        "system_prompt": """คุณเป็นผู้ช่วยร่างสัญญาภาครัฐ มีหน้าที่:
1. ร่างสัญญาตามแม่แบบที่กำหนด
2. แนะนำเงื่อนไขสัญญาที่เหมาะสม
3. ตรวจสอบความสมบูรณ์ของสัญญา

กรุณาตอบในรูปแบบ JSON ที่มี structure:
{
  "title": "ชื่อสัญญา",
  "clauses": [{"number": 1, "title": "...", "content": "..."}],
  "recommendations": ["..."]
}""",
        "trigger_events": ["contract_create"],
        "trigger_pages": ["contracts"],
        "input_schema": {"template_id": True, "requirements": True},
        "output_action": "save_to_field",
        "output_target": "draft_content",
        "output_format": "json"
    },
    {
        "id": "agent-document-analyzer",
        "name": "Document Analyzer",
        "description": "วิเคราะห์เอกสารและสกัดข้อมูลสำคัญ",
        "provider_id": None,
        "system_prompt": """คุณเป็นผู้ช่วยวิเคราะห์เอกสารสัญญา มีหน้าที่:
1. สกัดข้อมูลสำคัญ (เลขที่สัญญา, วันที่, มูลค่า, คู่สัญญา)
2. สรุปเนื้อหาเอกสาร
3. จำแนกประเภทเอกสาร

กรุณาตอบในรูปแบบ JSON""",
        "trigger_events": ["document_upload"],
        "trigger_pages": ["documents"],
        "input_schema": {"document_content": True},
        "output_action": "show_popup",
        "output_format": "json"
    },
    {
        "id": "agent-risk-detector",
        "name": "Risk Detector",
        "description": "ตรวจจับความเสี่ยงและข้อผิดปกติในสัญญา",
        "provider_id": None,
        "system_prompt": """คุณเป็นผู้เชี่ยวชาญด้านความเสี่ยงในสัญญา มีหน้าที่:
1. ตรวจสอบเงื่อนไขที่เสี่ยง (ค่าปรับสูง, ระยะเวลาสั้น, ข้อยกเว้น)
2. ระบุจุดที่ขัดต่อกฎหมาย
3. เสนอแนวทางลดความเสี่ยง

ระดับความเสี่ยง: low, medium, high, critical

ตอบในรูปแบบ JSON""",
        "trigger_events": ["contract_review"],
        "trigger_pages": ["contracts"],
        "input_schema": {"contract_data": True},
        "output_action": "create_task",
        "output_format": "json"
    },
    {
        "id": "agent-ocr-assistant",
        "name": "OCR Assistant",
        "description": "อ่านและประมวลผลเอกสารด้วย OCR",
        "provider_id": None,
        "system_prompt": """คุณเป็นผู้ช่วย OCR สำหรับเอกสารสัญญา มีหน้าที่:
1. แปลงข้อความจากรูปภาพให้อ่านง่าย
2. จัดโครงสร้างข้อมูล
3. ตรวจสอบความถูกต้อง

ตอบในรูปแบบ JSON""",
        "trigger_events": ["document_upload"],
        "trigger_pages": ["documents"],
        "input_schema": {"document_content": True},
        "output_action": "save_to_field",
        "output_target": "extracted_text",
        "output_format": "json"
    },
    {
        "id": "agent-compliance-checker",
        "name": "Compliance Checker",
        "description": "ตรวจสอบการปฏิบัติตามกฎระเบียบ",
        "provider_id": None,
        "system_prompt": """คุณเป็นผู้ตรวจสอบ compliance มีหน้าที่:
1. ตรวจสอบว่าสัญญาถูกต้องตาม พรบ. จัดซื้อจัดจ้าง
2. ตรวจสอบวงเงิน ระยะเวลา เงื่อนไข
3. ระบุข้อที่อาจมีปัญหาทางกฎหมาย

ตอบในรูปแบบ JSON""",
        "trigger_events": ["contract_review"],
        "trigger_pages": ["contracts"],
        "input_schema": {"contract_data": True},
        "output_action": "show_popup",
        "output_format": "json"
    }
]


# ============== Helper Functions ==============

def get_or_create_system_agents(db: Session, user_id: str):
    """Initialize system agents if not exist"""
    for agent_data in SYSTEM_AGENTS:
        existing = db.query(AIAgent).filter(AIAgent.id == agent_data["id"]).first()
        if not existing:
            agent = AIAgent(
                id=agent_data["id"],
                name=agent_data["name"],
                description=agent_data["description"],
                status=AgentStatus.ACTIVE,
                is_system=True,
                user_id=user_id,
                provider_id=agent_data.get("provider_id"),
                system_prompt=agent_data["system_prompt"],
                trigger_events=agent_data.get("trigger_events", []),
                trigger_pages=agent_data.get("trigger_pages", []),
                input_schema=agent_data.get("input_schema", {}),
                output_action=agent_data.get("output_action", "show_popup"),
                output_target=agent_data.get("output_target"),
                output_format=agent_data.get("output_format", "json"),
            )
            db.add(agent)
    
    db.commit()


# ============== API Endpoints ==============

# Global agent config - can be overridden via environment variables
# In production, use database or Redis for persistence
import os

def get_global_agent_config() -> Dict[str, Any]:
    """Get global agent configuration from environment or defaults"""
    return {
        "auto_execute": os.getenv("AGENT_AUTO_EXECUTE", "false").lower() == "true",
        "parallel_processing": os.getenv("AGENT_PARALLEL_PROCESSING", "false").lower() == "true",
        "notification_on_complete": os.getenv("AGENT_NOTIFICATION_ON_COMPLETE", "true").lower() == "true"
    }


@router.get("/config/global")
def get_global_config(
    user_id: str = Depends(get_current_user_id)
):
    """Get global agent configuration"""
    return {"success": True, "data": get_global_agent_config()}


@router.post("/config/global")
def save_global_config(
    config: Dict[str, Any],
    user_id: str = Depends(get_current_user_id)
):
    """Save global agent configuration (note: changes require server restart for persistence)"""
    # Update environment variables for persistence across restarts
    for key, value in config.items():
        if key in ["auto_execute", "parallel_processing", "notification_on_complete"]:
            os.environ[f"AGENT_{key.upper()}"] = str(value).lower()
    
    return {"success": True, "data": get_global_agent_config()}


@router.get("")
def list_agents(
    include_system: bool = True,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List all agents (system + user created)"""
    # Ensure system agents exist
    get_or_create_system_agents(db, user_id)
    
    query = db.query(AIAgent)
    
    if not include_system:
        query = query.filter(AIAgent.is_system == False)
    
    agents = query.order_by(AIAgent.is_system.desc(), AIAgent.name).all()
    
    return {
        "success": True,
        "data": [agent.to_dict() for agent in agents],
        "count": len(agents)
    }


@router.get("/{agent_id}")
def get_agent(
    agent_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get a specific agent configuration"""
    agent = db.query(AIAgent).filter(AIAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return {
        "success": True,
        "data": agent.to_dict()
    }


@router.post("")
def create_agent(
    agent_data: AgentCreate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create a new agent"""
    import uuid
    
    agent = AIAgent(
        id=str(uuid.uuid4()),
        name=agent_data.name,
        description=agent_data.description,
        status=AgentStatus.ACTIVE,
        is_system=False,
        user_id=user_id,
        provider_id=agent_data.provider_id,
        model_config=agent_data.model_config.model_dump() if agent_data.model_config else {},
        system_prompt=agent_data.system_prompt,
        knowledge_base_ids=agent_data.knowledge_base_ids,
        use_graphrag=agent_data.use_graphrag,
        trigger_events=agent_data.trigger_events,
        trigger_pages=agent_data.trigger_pages,
        trigger_condition=agent_data.trigger_condition,
        input_schema=agent_data.input_schema.model_dump() if agent_data.input_schema else {},
        output_action=agent_data.output_action,
        output_target=agent_data.output_target,
        output_format=agent_data.output_format,
        allowed_roles=agent_data.allowed_roles,
    )
    
    db.add(agent)
    db.commit()
    
    logger.info(f"Agent created: {agent.id} by user {user_id}")
    
    return {
        "success": True,
        "message": "Agent created successfully",
        "data": agent.to_dict()
    }


@router.put("/{agent_id}")
def update_agent(
    agent_id: str,
    update: AgentUpdate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Update an agent"""
    agent = db.query(AIAgent).filter(AIAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Cannot modify system agents (except status)
    if agent.is_system:
        if update.status:
            agent.status = AgentStatus(update.status)
            db.commit()
            return {
                "success": True,
                "message": "Agent status updated",
                "data": agent.to_dict()
            }
        raise HTTPException(status_code=403, detail="Cannot modify system agents")
    
    # Update fields
    update_dict = update.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        if hasattr(agent, field) and value is not None:
            if field == "status":
                value = AgentStatus(value)
            setattr(agent, field, value)
    
    db.commit()
    
    logger.info(f"Agent updated: {agent_id} by user {user_id}")
    
    return {
        "success": True,
        "message": "Agent updated successfully",
        "data": agent.to_dict()
    }


@router.delete("/{agent_id}")
def delete_agent(
    agent_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Delete an agent"""
    agent = db.query(AIAgent).filter(AIAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if agent.is_system:
        raise HTTPException(status_code=403, detail="Cannot delete system agents")
    
    db.delete(agent)
    db.commit()
    
    logger.info(f"Agent deleted: {agent_id} by user {user_id}")
    
    return {
        "success": True,
        "message": "Agent deleted successfully"
    }


@router.post("/{agent_id}/execute")
async def execute_agent(
    agent_id: str,
    request: AgentExecuteRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Execute an agent manually (mock for now)"""
    agent = db.query(AIAgent).filter(AIAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Mock execution - in production, call actual LLM service
    return {
        "success": True,
        "data": {
            "execution_id": "mock-exec-id",
            "agent_name": agent.name,
            "output": {
                "type": "json",
                "content": {"message": f"Agent {agent.name} executed successfully", "input_received": request.input}
            },
            "execution_time_ms": 1500
        }
    }


@router.post("/{agent_id}/toggle")
def toggle_agent(
    agent_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Toggle agent status (active/paused)"""
    agent = db.query(AIAgent).filter(AIAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if agent.status == AgentStatus.ACTIVE:
        agent.status = AgentStatus.PAUSED
    else:
        agent.status = AgentStatus.ACTIVE
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Agent {'activated' if agent.status == AgentStatus.ACTIVE else 'paused'}",
        "data": {"id": agent_id, "status": agent.status.value}
    }


@router.get("/{agent_id}/executions")
def get_agent_executions(
    agent_id: str,
    limit: int = 20,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get execution history for an agent"""
    executions = db.query(AgentExecution).filter(
        AgentExecution.agent_id == agent_id
    ).order_by(AgentExecution.started_at.desc()).limit(limit).all()
    
    return {
        "success": True,
        "data": [
            {
                "id": e.id,
                "status": e.status,
                "started_at": e.started_at.isoformat() if e.started_at else None,
                "completed_at": e.completed_at.isoformat() if e.completed_at else None,
                "execution_time_ms": e.execution_time_ms,
                "error_message": e.error_message,
            }
            for e in executions
        ]
    }


# ============== Knowledge Base Endpoints ==============

@router.get("/knowledge-bases/list")
def list_knowledge_bases(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List all knowledge bases"""
    kbs = db.query(KnowledgeBase).filter(
        (KnowledgeBase.user_id == user_id) | (KnowledgeBase.is_system == True)
    ).all()
    
    return {
        "success": True,
        "data": [kb.to_dict() for kb in kbs]
    }


@router.post("/knowledge-bases")
def create_knowledge_base(
    kb_data: KnowledgeBaseCreate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create a new knowledge base"""
    import uuid

    kb = KnowledgeBase(
        id=str(uuid.uuid4()),
        name=kb_data.name,
        description=kb_data.description,
        kb_type=kb_data.kb_type,
        document_ids=kb_data.document_ids,
        user_id=user_id,
        is_system=False,
        tags=kb_data.tags
    )

    db.add(kb)
    db.commit()

    return {
        "success": True,
        "message": "Knowledge base created",
        "data": kb.to_dict()
    }


@router.delete("/knowledge-bases/{kb_id}")
def delete_knowledge_base(
    kb_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Delete a knowledge base"""
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.user_id == user_id,
        KnowledgeBase.is_system == False
    ).first()

    if not kb:
        raise HTTPException(
            status_code=404,
            detail="Knowledge base not found or cannot be deleted"
        )

    db.delete(kb)
    db.commit()

    return {
        "success": True,
        "message": "Knowledge base deleted"
    }


# ============== Metadata Endpoints ==============

@router.get("/metadata/trigger-events")
def list_trigger_events(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List available trigger events"""
    events = [
        {"value": "document_upload", "label": "เมื่ออัพโหลดเอกสาร", "description": "ทำงานเมื่อมีการอัพโหลดเอกสารใหม่"},
        {"value": "contract_create", "label": "เมื่อสร้างสัญญา", "description": "ทำงานเมื่อสร้างสัญญาใหม่"},
        {"value": "contract_review", "label": "เมื่อตรวจสอบสัญญา", "description": "ทำงานเมื่อเปิดหน้าตรวจสอบสัญญา"},
        {"value": "contract_approve", "label": "เมื่ออนุมัติสัญญา", "description": "ทำงานเมื่อสัญญาได้รับการอนุมัติ"},
        {"value": "vendor_check", "label": "เมื่อตรวจสอบผู้รับจ้าง", "description": "ทำงานเมื่อเปิดหน้าผู้รับจ้าง"},
        {"value": "manual", "label": "กดปุ่มเองเท่านั้น", "description": "ทำงานเมื่อผู้ใช้กดปุ่มเรียกใช้"},
        {"value": "scheduled", "label": "ตามตารางเวลา", "description": "ทำงานตามตารางที่กำหนด (cron)"},
    ]
    return {"success": True, "data": events}


@router.get("/metadata/output-actions")
def list_output_actions(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List available output actions"""
    actions = [
        {"value": "show_popup", "label": "แสดงผลในหน้าจอ", "description": "แสดงผลลัพธ์ใน popup หรือ toast"},
        {"value": "save_to_field", "label": "บันทึกลงฟิลด์", "description": "บันทึกผลลัพธ์ลง field ที่กำหนด"},
        {"value": "create_task", "label": "สร้าง Task", "description": "สร้าง Task ให้ผู้ใช้ดำเนินการ"},
        {"value": "send_email", "label": "ส่งอีเมล", "description": "ส่งอีเมลแจ้งเตือน"},
        {"value": "webhook", "label": "เรียก Webhook", "description": "ส่งข้อมูลไปยังระบบภายนอก"},
        {"value": "log_only", "label": "บันทึก Log อย่างเดียว", "description": "บันทึกผลลัพธ์แต่ไม่แสดงผล"},
    ]
    return {"success": True, "data": actions}


@router.get("/metadata/pages")
def list_pages(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List available pages for trigger"""
    pages = [
        {"value": "contracts", "label": "หน้าสัญญา"},
        {"value": "documents", "label": "หน้าเอกสาร"},
        {"value": "vendors", "label": "หน้าผู้รับจ้าง"},
        {"value": "dashboard", "label": "หน้า Dashboard"},
        {"value": "settings", "label": "หน้าตั้งค่า"},
    ]
    return {"success": True, "data": pages}


@router.get("/metadata/models")
def list_models(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List available AI models from user's AI Providers in database"""
    
    # Get providers from database
    providers = db.query(AIProvider).filter(
        AIProvider.user_id == user_id,
        AIProvider.is_active == True
    ).all()
    
    models = []
    
    # Add models from user's AI Providers (only LLM/chat models)
    for provider in providers:
        capabilities = provider.capabilities or []
        if "chat" not in capabilities:  # Only LLM models for agents
            continue
            
        provider_name = provider.name
        model_name = provider.model
        
        # Create display label
        label = f"{provider_name}"
        if model_name:
            label += f" ({model_name})"
        
        models.append({
            "value": provider.id,
            "label": label,
            "description": f"{provider.provider_type} - {model_name}",
            "model": model_name,
            "provider_type": provider.provider_type,
            "url": provider.api_url or "",
            "requires_key": bool(provider.api_key)
        })
    
    # If no LLM providers configured, add default options
    if not models:
        models = [
            {
                "value": "default-llm",
                "label": "Local Ollama (llama3.1)",
                "description": "โมเดลในเครื่อง - ollama",
                "model": "llama3.1",
                "provider_type": "ollama",
                "url": "http://ollama:11434",
                "requires_key": False
            },
            {
                "value": "default-gpt4",
                "label": "OpenAI GPT-4",
                "description": "ต้องใช้ API Key",
                "model": "gpt-4",
                "provider_type": "openai-compatible",
                "url": "https://api.openai.com/v1",
                "requires_key": True
            }
        ]
    
    return {"success": True, "data": models}


# ============== Trigger Management Endpoints ==============

@router.get("/{agent_id}/triggers")
def list_agent_triggers(
    agent_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List all triggers for an agent"""
    agent = db.query(AIAgent).filter(AIAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    triggers = db.query(AgentTrigger).filter(AgentTrigger.agent_id == agent_id).all()
    
    return {
        "success": True,
        "data": [t.to_dict() for t in triggers],
        "count": len(triggers)
    }


@router.post("/{agent_id}/triggers")
def create_agent_trigger(
    agent_id: str,
    trigger_data: dict,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create new trigger for an agent"""
    agent = db.query(AIAgent).filter(AIAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    import uuid
    trigger = AgentTrigger(
        id=str(uuid.uuid4()),
        agent_id=agent_id,
        trigger_type=TriggerType(trigger_data.get('trigger_type', 'manual')),
        name=trigger_data.get('name', 'New Trigger'),
        description=trigger_data.get('description'),
        conditions=trigger_data.get('conditions', {}),
        schedule_config=trigger_data.get('schedule_config', {}),
        periodic_config=trigger_data.get('periodic_config', {}),
        applicable_pages=trigger_data.get('applicable_pages', []),
        button_config=trigger_data.get('button_config', {}),
        priority=trigger_data.get('priority', 0),
        max_executions_per_day=trigger_data.get('max_executions_per_day', 1000),
        cooldown_seconds=trigger_data.get('cooldown_seconds', 0),
        notification_config=trigger_data.get('notification_config', {}),
        status=TriggerStatus.ACTIVE
    )
    
    db.add(trigger)
    db.commit()
    
    logger.info(f"Created trigger {trigger.id} for agent {agent_id}")
    
    return {
        "success": True,
        "message": "Trigger created",
        "data": trigger.to_dict()
    }


@router.put("/{agent_id}/triggers/{trigger_id}")
def update_agent_trigger(
    agent_id: str,
    trigger_id: str,
    trigger_data: dict,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Update trigger"""
    trigger = db.query(AgentTrigger).filter(
        AgentTrigger.id == trigger_id,
        AgentTrigger.agent_id == agent_id
    ).first()
    
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found")
    
    # Update fields
    for field in ['name', 'description', 'conditions', 'schedule_config', 
                  'periodic_config', 'applicable_pages', 'button_config',
                  'priority', 'max_executions_per_day', 'cooldown_seconds',
                  'notification_config', 'status']:
        if field in trigger_data:
            setattr(trigger, field, trigger_data[field])
    
    db.commit()
    
    return {
        "success": True,
        "message": "Trigger updated",
        "data": trigger.to_dict()
    }


@router.delete("/{agent_id}/triggers/{trigger_id}")
def delete_agent_trigger(
    agent_id: str,
    trigger_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Delete trigger"""
    trigger = db.query(AgentTrigger).filter(
        AgentTrigger.id == trigger_id,
        AgentTrigger.agent_id == agent_id
    ).first()
    
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found")
    
    db.delete(trigger)
    db.commit()
    
    return {
        "success": True,
        "message": "Trigger deleted"
    }


@router.post("/{agent_id}/triggers/{trigger_id}/test")
def test_agent_trigger(
    agent_id: str,
    trigger_id: str,
    test_data: dict = {},
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Test trigger manually"""
    trigger = db.query(AgentTrigger).filter(
        AgentTrigger.id == trigger_id,
        AgentTrigger.agent_id == agent_id
    ).first()
    
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found")
    
    # Create test execution
    import uuid
    execution = TriggerExecution(
        id=str(uuid.uuid4()),
        trigger_id=trigger_id,
        agent_id=agent_id,
        triggered_by=user_id,
        source_event="manual_test",
        input_data=test_data.get('input', {}),
        context_data={"test": True, "timestamp": datetime.utcnow().isoformat()}
    )
    
    db.add(execution)
    db.commit()
    
    return {
        "success": True,
        "message": "Test execution queued",
        "execution_id": execution.id
    }


# ============== Trigger Templates Endpoints ==============

@router.get("/trigger-templates/list")
def list_trigger_templates(
    category: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List available trigger templates"""
    from app.models.trigger_models import SYSTEM_TRIGGER_TEMPLATES
    
    templates = SYSTEM_TRIGGER_TEMPLATES
    
    if category:
        templates = [t for t in templates if t.get('category') == category]
    
    return {
        "success": True,
        "data": templates
    }


@router.get("/trigger-templates/categories")
def list_trigger_categories(
    user_id: str = Depends(get_current_user_id)
):
    """List trigger categories"""
    return {
        "success": True,
        "data": [
            {"value": "document", "label": "เอกสาร", "icon": "file-text"},
            {"value": "contract", "label": "สัญญา", "icon": "file-signature"},
            {"value": "vendor", "label": "ผู้รับจ้าง", "icon": "users"},
            {"value": "system", "label": "ระบบ", "icon": "settings"},
        ]
    }


# ============== Trigger Presets API ==============

@router.get("/metadata/presets")
def list_trigger_presets(
    category: Optional[str] = None,
    user_id: str = Depends(get_current_user_id)
):
    """Get all available trigger presets (pre-defined triggers)"""
    from app.models.trigger_presets import get_trigger_presets, get_preset_categories
    
    presets = get_trigger_presets(category)
    
    return {
        "success": True,
        "data": presets,
        "categories": get_preset_categories(),
        "count": len(presets)
    }


@router.post("/{agent_id}/presets/enable")
def enable_trigger_preset(
    agent_id: str,
    preset_data: dict,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Enable a trigger preset for an agent - creates trigger from preset"""
    from app.models.trigger_presets import get_trigger_preset_by_id
    
    agent = db.query(AIAgent).filter(AIAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    preset_id = preset_data.get("preset_id")
    preset = get_trigger_preset_by_id(preset_id)
    
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    # Check if already enabled
    existing = db.query(AgentTrigger).filter(
        AgentTrigger.agent_id == agent_id,
        AgentTrigger.name == preset.name
    ).first()
    
    if existing:
        return {
            "success": False,
            "message": "Preset already enabled for this agent",
            "trigger_id": existing.id
        }
    
    # Create trigger from preset
    trigger = AgentTrigger(
        id=str(uuid.uuid4()),
        agent_id=agent_id,
        name=preset.name,
        description=preset.description,
        trigger_type=TriggerType(preset.trigger_type),
        status=TriggerStatus.ACTIVE,
        priority=preset_data.get("priority", 0),
        conditions={**preset.conditions, **preset_data.get("custom_conditions", {})},
        schedule_config=preset.schedule_config or {},
        applicable_pages=preset.applicable_pages,
        button_config=preset.button_config,
        created_by=user_id
    )
    
    db.add(trigger)
    db.commit()
    
    # Update agent's enabled_presets
    if not agent.enabled_presets:
        agent.enabled_presets = []
    if preset_id not in agent.enabled_presets:
        agent.enabled_presets.append(preset_id)
        db.commit()
    
    logger.info(f"Enabled preset {preset_id} for agent {agent_id}")
    
    return {
        "success": True,
        "message": f"Enabled preset: {preset.name}",
        "trigger_id": trigger.id,
        "preset": preset.to_dict()
    }


@router.post("/{agent_id}/presets/disable")
def disable_trigger_preset(
    agent_id: str,
    preset_data: dict,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Disable a trigger preset for an agent"""
    from app.models.trigger_presets import get_trigger_preset_by_id
    
    agent = db.query(AIAgent).filter(AIAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    preset_id = preset_data.get("preset_id")
    preset = get_trigger_preset_by_id(preset_id)
    
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    # Find and delete the trigger
    trigger = db.query(AgentTrigger).filter(
        AgentTrigger.agent_id == agent_id,
        AgentTrigger.name == preset.name
    ).first()
    
    if trigger:
        db.delete(trigger)
    
    # Update agent's enabled_presets
    if agent.enabled_presets and preset_id in agent.enabled_presets:
        agent.enabled_presets.remove(preset_id)
    
    db.commit()
    
    logger.info(f"Disabled preset {preset_id} for agent {agent_id}")
    
    return {
        "success": True,
        "message": f"Disabled preset: {preset.name}"
    }


@router.get("/{agent_id}/presets")
def get_agent_preset_status(
    agent_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get which presets are enabled for this agent"""
    from app.models.trigger_presets import get_trigger_presets
    
    agent = db.query(AIAgent).filter(AIAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    all_presets = get_trigger_presets()
    enabled = agent.enabled_presets or []
    
    # Group by category
    by_category = {}
    for preset in all_presets:
        cat = preset["category"]
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append({
            **preset,
            "enabled": preset["id"] in enabled
        })
    
    return {
        "success": True,
        "data": by_category,
        "enabled_count": len(enabled),
        "total_count": len(all_presets)
    }


# ============== Trigger Types Metadata ==============

@router.get("/metadata/trigger-types")
def get_trigger_types(
    user_id: str = Depends(get_current_user_id)
):
    """Get all available trigger types with descriptions"""
    return {
        "success": True,
        "data": [
            # Event-based
            {"value": "document_upload", "label": "อัพโหลดเอกสาร", "category": "event", "icon": "upload"},
            {"value": "document_update", "label": "แก้ไขเอกสาร", "category": "event", "icon": "edit"},
            {"value": "contract_created", "label": "สร้างสัญญา", "category": "event", "icon": "file-plus"},
            {"value": "contract_updated", "label": "อัพเดตสัญญา", "category": "event", "icon": "file-edit"},
            {"value": "contract_status_changed", "label": "เปลี่ยนสถานะสัญญา", "category": "event", "icon": "refresh"},
            {"value": "contract_approval_requested", "label": "ขออนุมัติสัญญา", "category": "event", "icon": "check-circle"},
            {"value": "contract_approved", "label": "อนุมัติสัญญา", "category": "event", "icon": "check"},
            {"value": "contract_rejected", "label": "ปฏิเสธสัญญา", "category": "event", "icon": "x"},
            {"value": "vendor_created", "label": "สร้างผู้รับจ้าง", "category": "event", "icon": "user-plus"},
            {"value": "vendor_updated", "label": "อัพเดตผู้รับจ้าง", "category": "event", "icon": "user-edit"},
            {"value": "payment_due", "label": "ใกล้วันจ่ายเงิน", "category": "event", "icon": "dollar-sign"},
            {"value": "contract_expiring", "label": "สัญญาใกล้หมดอายุ", "category": "event", "icon": "clock"},
            
            # Schedule-based
            {"value": "scheduled", "label": "ตามตารางเวลา (Cron)", "category": "schedule", "icon": "calendar"},
            {"value": "periodic", "label": "ทำซ้ำตามช่วงเวลา", "category": "schedule", "icon": "repeat"},
            
            # Manual
            {"value": "manual", "label": "เรียกใช้เอง", "category": "manual", "icon": "mouse-pointer"},
            {"value": "button_click", "label": "กดปุ่ม", "category": "manual", "icon": "button"},
            
            # Data-driven
            {"value": "condition_met", "label": "เงื่อนไขเป็นจริง", "category": "data", "icon": "code"},
            {"value": "threshold_exceeded", "label": "เกินค่าที่กำหนด", "category": "data", "icon": "trending-up"},
            {"value": "anomaly_detected", "label": "พบความผิดปกติ", "category": "data", "icon": "alert-triangle"},
        ]
    }


# ============== Trigger Execution History ==============

@router.get("/{agent_id}/executions")
def list_trigger_executions(
    agent_id: str,
    trigger_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List trigger execution history"""
    agent = db.query(AIAgent).filter(AIAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    query = db.query(TriggerExecution).filter(TriggerExecution.agent_id == agent_id)
    
    if trigger_id:
        query = query.filter(TriggerExecution.trigger_id == trigger_id)
    
    if status:
        query = query.filter(TriggerExecution.status == status)
    
    total = query.count()
    executions = query.order_by(TriggerExecution.triggered_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "success": True,
        "data": [e.to_dict() for e in executions],
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/{agent_id}/executions/{execution_id}")
def get_execution_detail(
    agent_id: str,
    execution_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get execution detail"""
    execution = db.query(TriggerExecution).filter(
        TriggerExecution.id == execution_id,
        TriggerExecution.agent_id == agent_id
    ).first()
    
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    return {
        "success": True,
        "data": execution.to_dict()
    }


# ============== Pages Metadata ==============

@router.get("/metadata/pages")
def get_available_pages(
    user_id: str = Depends(get_current_user_id)
):
    """Get all available page locations where triggers can be active"""
    return {
        "success": True,
        "data": [
            # Contract pages
            {"value": "/contracts", "label": "รายการสัญญา", "category": "contract", "icon": "file-text"},
            {"value": "/contracts/new", "label": "สร้างสัญญา", "category": "contract", "icon": "file-plus"},
            {"value": "/contracts/:id", "label": "รายละเอียดสัญญา", "category": "contract", "icon": "file"},
            {"value": "/contracts/:id/edit", "label": "แก้ไขสัญญา", "category": "contract", "icon": "file-edit"},
            {"value": "/contracts/:id/approve", "label": "อนุมัติสัญญา", "category": "contract", "icon": "check-circle"},
            
            # Document pages
            {"value": "/documents", "label": "เอกสาร", "category": "document", "icon": "folder"},
            {"value": "/documents/upload", "label": "อัพโหลดเอกสาร", "category": "document", "icon": "upload"},
            {"value": "/documents/:id", "label": "รายละเอียดเอกสาร", "category": "document", "icon": "file"},
            
            # Vendor pages
            {"value": "/vendors", "label": "ผู้รับจ้าง", "category": "vendor", "icon": "users"},
            {"value": "/vendors/new", "label": "สร้างผู้รับจ้าง", "category": "vendor", "icon": "user-plus"},
            {"value": "/vendors/:id", "label": "รายละเอียดผู้รับจ้าง", "category": "vendor", "icon": "user"},
            
            # Dashboard pages
            {"value": "/dashboard", "label": "แดชบอร์ด", "category": "dashboard", "icon": "layout-dashboard"},
            {"value": "/dashboard/contracts", "label": "แดชบอร์ดสัญญา", "category": "dashboard", "icon": "pie-chart"},
            {"value": "/dashboard/compliance", "label": "แดชบอร์ดการปฏิบัติตาม", "category": "dashboard", "icon": "shield"},
            
            # Reports pages
            {"value": "/reports", "label": "รายงาน", "category": "report", "icon": "bar-chart"},
            {"value": "/reports/contracts", "label": "รายงานสัญญา", "category": "report", "icon": "file-text"},
            {"value": "/reports/vendors", "label": "รายงานผู้รับจ้าง", "category": "report", "icon": "users"},
            {"value": "/reports/financial", "label": "รายงานการเงิน", "category": "report", "icon": "dollar-sign"},
            
            # Settings pages
            {"value": "/settings", "label": "ตั้งค่า", "category": "settings", "icon": "settings"},
            {"value": "/settings/agents", "label": "จัดการ Agent", "category": "settings", "icon": "bot"},
            {"value": "/settings/knowledge", "label": "ฐานความรู้", "category": "settings", "icon": "book"},
        ]
    }
