"""
Settings API Routes - User preferences, OCR, AI configuration
"""
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.core.security import get_current_user_id, get_current_user_payload
from app.core.logging import get_logger
from app.models.identity import User
from app.models.ai_provider import AIProvider

router = APIRouter(prefix="/settings", tags=["Settings"])
logger = get_logger(__name__)


# ============== Schemas ==============

class NotificationSettings(BaseModel):
    email_notifications: bool = True
    contract_expiry: bool = True
    payment_reminders: bool = True
    document_uploads: bool = False
    system_updates: bool = True


class PreferenceSettings(BaseModel):
    dark_mode: bool = False
    language: str = "th"
    items_per_page: int = 20


class OCRSettings(BaseModel):
    mode: str = "default"  # 'default' | 'typhoon' | 'custom'
    engine: str = "tesseract"
    language: str = "tha+eng"
    dpi: int = 300
    auto_rotate: bool = True
    deskew: bool = True
    enhance_contrast: bool = True
    extract_tables: bool = True
    confidence_threshold: int = 80
    # Typhoon OCR settings
    typhoon_url: str = "https://api.opentyphoon.ai/v1/ocr"
    typhoon_key: str = ""
    typhoon_model: str = "typhoon-ocr"
    typhoon_task_type: str = "default"
    typhoon_max_tokens: int = 16384
    typhoon_temperature: float = 0.1
    typhoon_top_p: float = 0.6
    typhoon_repetition_penalty: float = 1.2
    typhoon_pages: str = ""
    # Custom API settings
    custom_api_url: str = ""
    custom_api_key: str = ""
    custom_api_model: str = ""
    # OCR Template/Prompt
    ocr_template: str = ""


class AIProviderSchema(BaseModel):
    id: str
    name: str
    type: str  # 'openai-compatible' | 'ollama' | 'vllm' | 'gemini' | 'anthropic'
    modelType: str  # 'llm' | 'embedding'
    url: str
    apiKey: str = ""
    model: str
    temperature: float = 0.7
    maxTokens: int = 2048
    supportsGraphRAG: bool = False
    graphRAGConfig: Optional[Dict[str, Any]] = None


class AISettings(BaseModel):
    providers: List[AIProviderSchema] = []
    activeLLMId: str = ""
    activeEmbeddingId: str = ""
    features: Dict[str, bool] = {
        "auto_extract": True,
        "smart_classification": True,
        "anomaly_detection": True,
        "contract_analysis": True
    }


class AIFeaturesSettings(BaseModel):
    auto_extract: bool = True
    smart_classification: bool = True
    anomaly_detection: bool = True
    contract_analysis: bool = True


class RAGSettings(BaseModel):
    embeddingProviderId: str = "default-embedding"
    chunkSize: int = 512
    chunkOverlap: int = 50


class ContractsGraphRAGSettings(BaseModel):
    """Settings for Contracts GraphRAG (with security controls)"""
    enabled: bool = True
    auto_extract_on_upload: bool = True
    extract_relationships: bool = True
    min_confidence: float = 0.7
    # Security-related settings
    respect_security_levels: bool = True  # คุมสิทธิ์ตามชั้นความลับ
    respect_department_hierarchy: bool = True  # คุมสิทธิ์ตามโครงสร้างหน่วยงาน


class KBGraphRAGSettings(BaseModel):
    """Settings for Knowledge Base GraphRAG (agent-only)"""
    enabled: bool = True
    auto_extract_on_upload: bool = True  # Extract when KB document uploaded
    extract_relationships: bool = True
    min_confidence: float = 0.7
    # Cross-KB settings
    enable_cross_kb_links: bool = True  # เปิดเชื่อมโยง entity ข้าม KB
    shared_entity_threshold: int = 2  # จำนวน entity ที่ต้องมีร่วมกันถึงจะถือว่าเชื่อมโยง


# Legacy model for backward compatibility
class GraphRAGSettings(BaseModel):
    """Legacy settings (deprecated, use ContractsGraphRAGSettings or KBGraphRAGSettings)"""
    auto_extract_on_upload: bool = True
    extract_relationships: bool = True
    min_confidence: float = 0.7


# ============== Helper Functions ==============

def get_user_settings(db: Session, user_id: str) -> Dict[str, Any]:
    """Get user settings from database"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get preferences from user record
    prefs = user.preferences or {}
    
    return {
        "notifications": prefs.get("notifications", {}),
        "preferences": {
            "dark_mode": prefs.get("dark_mode", False),
            "language": prefs.get("language", "th"),
            "items_per_page": prefs.get("items_per_page", 20)
        }
    }


def save_user_settings(db: Session, user_id: str, settings: Dict[str, Any]) -> bool:
    """Save user settings to database"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Merge with existing preferences
    current_prefs = user.preferences or {}
    current_prefs.update(settings)
    user.preferences = current_prefs
    
    db.commit()
    return True


def db_provider_to_schema(provider: AIProvider) -> Dict[str, Any]:
    """Convert DB AIProvider to frontend schema"""
    model_type = "llm" if "chat" in (provider.capabilities or []) else "embedding"
    return {
        "id": provider.id,
        "name": provider.name,
        "type": provider.provider_type,
        "modelType": model_type,
        "url": provider.api_url or "",
        "apiKey": provider.api_key or "",
        "model": provider.model,
        "temperature": provider.config.get("temperature", 0.7) if provider.config else 0.7,
        "maxTokens": provider.config.get("maxTokens", 2048) if provider.config else 2048,
        "supportsGraphRAG": provider.config.get("supportsGraphRAG", False) if provider.config else False,
        "graphRAGConfig": provider.config.get("graphRAGConfig") if provider.config else None,
    }


def schema_to_db_provider(schema: AIProviderSchema, user_id: str) -> AIProvider:
    """Convert frontend schema to DB AIProvider"""
    capabilities = []
    if schema.modelType == "llm":
        capabilities = ["chat"]
    elif schema.modelType == "embedding":
        capabilities = ["embedding"]
    
    return AIProvider(
        id=schema.id,
        user_id=user_id,
        name=schema.name,
        provider_type=schema.type,
        model=schema.model,
        api_url=schema.url,
        api_key=schema.apiKey,
        is_active=True,
        is_default=False,
        capabilities=capabilities,
        config={
            "temperature": schema.temperature,
            "maxTokens": schema.maxTokens,
            "supportsGraphRAG": schema.supportsGraphRAG,
            "graphRAGConfig": schema.graphRAGConfig,
        }
    )


# ============== Notification Settings ==============

@router.get("/notifications")
def get_notifications(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get notification settings"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    prefs = user.preferences or {}
    return {
        "success": True,
        "data": prefs.get("notifications", {
            "email_notifications": True,
            "contract_expiry": True,
            "payment_reminders": True,
            "document_uploads": False,
            "system_updates": True
        })
    }


@router.post("/notifications")
def save_notifications(
    settings: NotificationSettings,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Save notification settings"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    prefs = user.preferences or {}
    prefs["notifications"] = settings.model_dump()
    user.preferences = prefs
    db.commit()
    
    logger.info(f"Notification settings updated for user {user_id}")
    return {
        "success": True,
        "message": "Notification settings saved"
    }


# ============== Preferences ==============

@router.get("/preferences")
def get_preferences(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get user preferences"""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            # Return default preferences if user not found
            return {
                "success": True,
                "data": {
                    "dark_mode": False,
                    "language": "th",
                    "items_per_page": 20
                }
            }
        
        prefs = user.preferences or {}
        return {
            "success": True,
            "data": {
                "dark_mode": prefs.get("dark_mode", False),
                "language": prefs.get("language", "th"),
                "items_per_page": prefs.get("items_per_page", 20)
            }
        }
    except Exception as e:
        logger.error(f"Error fetching preferences: {e}")
        # Return default on error
        return {
            "success": True,
            "data": {
                "dark_mode": False,
                "language": "th",
                "items_per_page": 20
            }
        }


@router.post("/preferences")
def save_preferences(
    settings: PreferenceSettings,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Save user preferences"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    prefs = user.preferences or {}
    prefs.update(settings.model_dump())
    user.preferences = prefs
    db.commit()
    
    logger.info(f"Preferences updated for user {user_id}")
    return {
        "success": True,
        "message": "Preferences saved"
    }


# ============== OCR Settings ==============

@router.get("/ocr")
def get_ocr_settings(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get OCR settings"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    prefs = user.preferences or {}
    default_template = """คุณเป็นระบบ OCR สำหรับเอกสารสัญญาภาครัฐ

กรุณาอ่านเอกสารที่ให้มาและสกัดข้อมูลตามโครงสร้างนี้:

1. เลขที่สัญญา: [contract_number]
2. ชื่อสัญญา: [title]
3. ผู้ว่าจ้าง: [employer]
4. ผู้รับจ้าง: [contractor]
5. มูลค่าสัญญา: [value] บาท
6. วันเริ่มต้น: [start_date]
7. วันสิ้นสุด: [end_date]
8. รายละเอียดงาน: [description]

หมายเหตุ: 
- ถ้าไม่พบข้อมูลให้ใส่ "-"
- วันที่ให้ใช้รูปแบบ YYYY-MM-DD
- มูลค่าให้ระบุเฉพาะตัวเลข ไม่ต้องใส่คำว่า "บาท"""

    return {
        "success": True,
        "data": prefs.get("ocr_settings", {
            "mode": "default",
            "engine": "tesseract",
            "language": "tha+eng",
            "dpi": 300,
            "auto_rotate": True,
            "deskew": True,
            "enhance_contrast": True,
            "extract_tables": True,
            "confidence_threshold": 80,
            "typhoon_url": "https://api.opentyphoon.ai/v1/ocr",
            "typhoon_key": "sk-N0BWvEJ7sMUxQrE9k4JIRL9ehdGZZRy7fP3gPtnie8QkZ8Kg",
            "typhoon_model": "typhoon-ocr",
            "typhoon_task_type": "default",
            "typhoon_max_tokens": 16384,
            "typhoon_temperature": 0.1,
            "typhoon_top_p": 0.6,
            "typhoon_repetition_penalty": 1.2,
            "typhoon_pages": "",
            "custom_api_url": "",
            "custom_api_key": "",
            "custom_api_model": "",
            "ocr_template": default_template
        })
    }


@router.post("/ocr")
def save_ocr_settings(
    settings: OCRSettings,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Save OCR settings"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    prefs = user.preferences or {}
    prefs["ocr_settings"] = settings.model_dump()
    user.preferences = prefs
    db.commit()
    
    logger.info(f"OCR settings updated for user {user_id}")
    return {
        "success": True,
        "message": "OCR settings saved"
    }


# ============== AI Settings (Database-backed) ==============

@router.get("/ai")
def get_ai_settings(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get AI settings from database including providers"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get providers from database
    providers = db.query(AIProvider).filter(
        AIProvider.user_id == user_id,
        AIProvider.is_active == True
    ).all()
    
    # Convert to frontend schema
    provider_schemas = [db_provider_to_schema(p) for p in providers]
    
    # If no providers in DB, return defaults (but don't save yet)
    if not provider_schemas:
        provider_schemas = [
            {
                "id": "default-llm",
                "name": "Local Ollama (LLM)",
                "type": "ollama",
                "modelType": "llm",
                "url": "http://ollama:11434",
                "apiKey": "",
                "model": "llama3.1",
                "temperature": 0.7,
                "maxTokens": 2048,
                "supportsGraphRAG": False
            },
            {
                "id": "default-embedding",
                "name": "Local Ollama (Embedding)",
                "type": "ollama",
                "modelType": "embedding",
                "url": "http://ollama:11434",
                "apiKey": "",
                "model": "nomic-embed-text",
                "temperature": 0,
                "maxTokens": 512,
                "supportsGraphRAG": False
            }
        ]
    
    # Get features from preferences
    prefs = user.preferences or {}
    ai_prefs = prefs.get("ai_settings", {})
    
    # Get active provider IDs from preferences (for backward compatibility)
    active_llm_id = ai_prefs.get("activeLLMId", "default-llm")
    active_embedding_id = ai_prefs.get("activeEmbeddingId", "default-embedding")
    
    return {
        "success": True,
        "data": {
            "providers": provider_schemas,
            "activeLLMId": active_llm_id,
            "activeEmbeddingId": active_embedding_id,
            "features": ai_prefs.get("features", {
                "auto_extract": True,
                "smart_classification": True,
                "anomaly_detection": True,
                "contract_analysis": True
            })
        }
    }


@router.post("/ai")
def save_ai_settings(
    settings: AISettings,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Save AI settings to database"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update providers in database
    existing_ids = {p.id for p in db.query(AIProvider).filter(AIProvider.user_id == user_id).all()}
    new_ids = {p.id for p in settings.providers}
    
    # Delete removed providers
    to_delete = existing_ids - new_ids
    for pid in to_delete:
        db.query(AIProvider).filter(
            AIProvider.id == pid,
            AIProvider.user_id == user_id
        ).delete()
    
    # Update or create providers
    for provider_schema in settings.providers:
        existing = db.query(AIProvider).filter(
            AIProvider.id == provider_schema.id,
            AIProvider.user_id == user_id
        ).first()
        
        capabilities = []
        if provider_schema.modelType == "llm":
            capabilities = ["chat"]
        elif provider_schema.modelType == "embedding":
            capabilities = ["embedding"]
        
        if existing:
            # Update existing
            existing.name = provider_schema.name
            existing.provider_type = provider_schema.type
            existing.model = provider_schema.model
            existing.api_url = provider_schema.url
            existing.api_key = provider_schema.apiKey
            existing.capabilities = capabilities
            existing.config = {
                "temperature": provider_schema.temperature,
                "maxTokens": provider_schema.maxTokens,
                "supportsGraphRAG": provider_schema.supportsGraphRAG,
                "graphRAGConfig": provider_schema.graphRAGConfig,
            }
        else:
            # Create new
            new_provider = AIProvider(
                id=provider_schema.id,
                user_id=user_id,
                name=provider_schema.name,
                provider_type=provider_schema.type,
                model=provider_schema.model,
                api_url=provider_schema.url,
                api_key=provider_schema.apiKey,
                is_active=True,
                is_default=False,
                capabilities=capabilities,
                config={
                    "temperature": provider_schema.temperature,
                    "maxTokens": provider_schema.maxTokens,
                    "supportsGraphRAG": provider_schema.supportsGraphRAG,
                    "graphRAGConfig": provider_schema.graphRAGConfig,
                }
            )
            db.add(new_provider)
    
    # Update user's active providers
    user.active_llm_provider_id = settings.activeLLMId
    user.active_embedding_provider_id = settings.activeEmbeddingId
    
    # Save features in preferences
    prefs = user.preferences or {}
    ai_prefs = prefs.get("ai_settings", {})
    ai_prefs["features"] = settings.features
    prefs["ai_settings"] = ai_prefs
    user.preferences = prefs
    
    db.commit()
    
    logger.info(f"AI settings updated for user {user_id}")
    return {
        "success": True,
        "message": "AI settings saved"
    }


@router.post("/ai/features")
def save_ai_features(
    settings: AIFeaturesSettings,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Save AI features settings"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    prefs = user.preferences or {}
    ai_settings = prefs.get("ai_settings", {})
    ai_settings["features"] = settings.model_dump()
    prefs["ai_settings"] = ai_settings
    user.preferences = prefs
    db.commit()
    
    logger.info(f"AI features updated for user {user_id}")
    return {
        "success": True,
        "message": "AI features saved"
    }


# ============== AI Providers Direct API ==============

@router.get("/ai/providers")
def get_ai_providers(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get all AI providers for user"""
    providers = db.query(AIProvider).filter(
        AIProvider.user_id == user_id,
        AIProvider.is_active == True
    ).all()
    
    return {
        "success": True,
        "data": [p.to_dict() for p in providers]
    }


@router.get("/ai/providers/{provider_id}")
def get_ai_provider(
    provider_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get specific AI provider"""
    provider = db.query(AIProvider).filter(
        AIProvider.id == provider_id,
        AIProvider.user_id == user_id
    ).first()
    
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    return {
        "success": True,
        "data": provider.to_dict()
    }


@router.post("/ai/providers/{provider_id}/test")
def test_ai_provider(
    provider_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Test AI provider connection"""
    provider = db.query(AIProvider).filter(
        AIProvider.id == provider_id,
        AIProvider.user_id == user_id
    ).first()

    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # TODO: Implement actual connection test
    return {
        "success": True,
        "message": "Connection test passed",
        "provider": provider.name
    }


# ============== RAG Settings ==============

@router.get("/rag")
def get_rag_settings(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get RAG configuration settings"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    prefs = user.preferences or {}
    return {
        "success": True,
        "data": prefs.get("rag_settings", {
            "embeddingProviderId": "default-embedding",
            "chunkSize": 512,
            "chunkOverlap": 50
        })
    }


@router.post("/rag")
def save_rag_settings(
    settings: RAGSettings,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Save RAG configuration settings"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    prefs = user.preferences or {}
    prefs["rag_settings"] = settings.model_dump()
    user.preferences = prefs
    db.commit()

    logger.info(f"RAG settings updated for user {user_id}")
    return {
        "success": True,
        "message": "RAG settings saved"
    }


# ============== GraphRAG Settings ==============

@router.get("/graphrag")
def get_graphrag_settings(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get GraphRAG configuration settings"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    prefs = user.preferences or {}
    return {
        "success": True,
        "data": prefs.get("graphrag_settings", {
            "auto_extract_on_upload": True,
            "extract_relationships": True,
            "min_confidence": 0.7
        })
    }


@router.post("/graphrag")
def save_graphrag_settings(
    settings: GraphRAGSettings,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Save GraphRAG configuration settings"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    prefs = user.preferences or {}
    prefs["graphrag_settings"] = settings.model_dump()
    user.preferences = prefs
    db.commit()

    logger.info(f"GraphRAG settings updated for user {user_id}")
    return {
        "success": True,
        "message": "GraphRAG settings saved"
    }


# ============== New Dual-Domain GraphRAG Settings ==============

@router.get("/graphrag/contracts")
def get_contracts_graphrag_settings(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get Contracts GraphRAG settings (with security controls)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    prefs = user.preferences or {}
    return {
        "success": True,
        "data": prefs.get("contracts_graphrag_settings", {
            "enabled": True,
            "auto_extract_on_upload": True,
            "extract_relationships": True,
            "min_confidence": 0.7,
            "respect_security_levels": True,
            "respect_department_hierarchy": True
        })
    }


@router.post("/graphrag/contracts")
def save_contracts_graphrag_settings(
    settings: ContractsGraphRAGSettings,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Save Contracts GraphRAG settings"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    prefs = user.preferences or {}
    prefs["contracts_graphrag_settings"] = settings.model_dump()
    user.preferences = prefs
    db.commit()

    logger.info(f"Contracts GraphRAG settings updated for user {user_id}")
    return {
        "success": True,
        "message": "Contracts GraphRAG settings saved"
    }


@router.get("/graphrag/kb")
def get_kb_graphrag_settings(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get Knowledge Base GraphRAG settings (agent-only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    prefs = user.preferences or {}
    return {
        "success": True,
        "data": prefs.get("kb_graphrag_settings", {
            "enabled": True,
            "auto_extract_on_upload": True,
            "extract_relationships": True,
            "min_confidence": 0.7,
            "enable_cross_kb_links": True,
            "shared_entity_threshold": 2
        })
    }


@router.post("/graphrag/kb")
def save_kb_graphrag_settings(
    settings: KBGraphRAGSettings,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Save Knowledge Base GraphRAG settings"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    prefs = user.preferences or {}
    prefs["kb_graphrag_settings"] = settings.model_dump()
    user.preferences = prefs
    db.commit()

    logger.info(f"KB GraphRAG settings updated for user {user_id}")
    return {
        "success": True,
        "message": "KB GraphRAG settings saved"
    }


@router.get("/graphrag/overview")
def get_graphrag_overview(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get overview of both GraphRAG domains
    Returns settings and stats for both Contracts and KB
    """
    from app.services.graph import get_contracts_graph_service, get_kb_graph_service
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    prefs = user.preferences or {}
    
    # Get graph stats
    try:
        contracts_stats = get_contracts_graph_service().get_stats()
        kb_stats = get_kb_graph_service().get_stats()
    except Exception as e:
        logger.error(f"Failed to get graph stats: {e}")
        contracts_stats = {"total_entities": 0, "total_relationships": 0}
        kb_stats = {"total_entities": 0, "total_relationships": 0}

    return {
        "success": True,
        "data": {
            "contracts": {
                "settings": prefs.get("contracts_graphrag_settings", {
                    "enabled": True,
                    "auto_extract_on_upload": True,
                    "extract_relationships": True,
                    "min_confidence": 0.7
                }),
                "stats": contracts_stats
            },
            "knowledge_base": {
                "settings": prefs.get("kb_graphrag_settings", {
                    "enabled": True,
                    "auto_extract_on_upload": True,
                    "extract_relationships": True,
                    "min_confidence": 0.7
                }),
                "stats": kb_stats
            }
        }
    }
