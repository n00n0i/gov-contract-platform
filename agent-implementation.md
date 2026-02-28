# Agent Implementation Guide

> Gov Contract Platform - คู่มือการพัฒนา AI Agent System

**Version**: 2.0  
**Date**: กุมภาพันธ์ 2026  
**Author**: n00n0i

---

## สารบัญ

1. [Quick Start](#quick-start)
2. [Agent Service Implementation](#agent-service-implementation)
3. [Trigger Service Implementation](#trigger-service-implementation)
4. [Output Handler Implementation](#output-handler-implementation)
5. [API Endpoints](#api-endpoints)
6. [Frontend Integration](#frontend-integration)
7. [Testing](#testing)
8. [Deployment](#deployment)

---

## Quick Start

### 1.1 ติดตั้ง Dependencies

```bash
# Backend
pip install python-dotenv
pip install openai
pip install psycopg2-binary
pip install pydantic-settings

# Frontend
npm install axios
npm install @microsoft/fetch-event-source
```

### 1.2 Environment Variables

```env
# Agent Configuration
AGENT_ENABLED=true
AGENT_DEFAULT_PROVIDER=openai

# LLM Configuration
OPENAI_API_KEY=your_openai_api_key
OLLAMA_BASE_URL=http://localhost:11434
```

### 1.3 Database Setup

```sql
-- Enable pgvector extension
CREATE EXTENSION vector;

-- Create AI Providers table
CREATE TABLE ai_providers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    provider_type VARCHAR(50) NOT NULL,
    api_key TEXT,
    base_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create AI Agents table
CREATE TABLE ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active',
    user_id UUID NOT NULL REFERENCES users(id),
    is_system BOOLEAN DEFAULT false,
    provider_id VARCHAR(50) REFERENCES ai_providers(id),
    model_config JSONB DEFAULT '{}',
    system_prompt TEXT,
    knowledge_base_ids TEXT[],
    use_graphrag BOOLEAN DEFAULT false,
    trigger_events TEXT[],
    trigger_pages TEXT[],
    trigger_condition TEXT,
    enabled_presets TEXT[],
    input_schema JSONB DEFAULT '{}',
    output_action VARCHAR(50) DEFAULT 'show_popup',
    output_target VARCHAR(100),
    output_format VARCHAR(50) DEFAULT 'json',
    allowed_roles TEXT[],
    execution_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    avg_execution_time FLOAT DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Agent Executions table
CREATE TABLE agent_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES ai_agents(id),
    input_data JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending',
    execution_time FLOAT DEFAULT 0.0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Agent Service Implementation

### 2.1 Agent Model

```python
# backend/app/models/ai_models.py
"""
AI Agent & Knowledge Base Models
"""
from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text, ForeignKey, Enum, Float, Table
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from app.models.base import BaseModel, Base, TimestampMixin
import enum


class AgentStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"


class TriggerEvent(str, enum.Enum):
    """Events that can trigger an agent"""
    DOCUMENT_UPLOAD = "document_upload"
    CONTRACT_CREATE = "contract_create"
    CONTRACT_REVIEW = "contract_review"
    CONTRACT_APPROVE = "contract_approve"
    VENDOR_CHECK = "vendor_check"
    MANUAL = "manual"  # User triggers manually
    SCHEDULED = "scheduled"  # Cron job


class OutputAction(str, enum.Enum):
    """What to do with agent output"""
    SHOW_POPUP = "show_popup"           # Show result in modal/toast
    SAVE_TO_FIELD = "save_to_field"     # Save to specific contract/vendor field
    CREATE_TASK = "create_task"         # Create a task for user
    SEND_EMAIL = "send_email"           # Send email notification
    WEBHOOK = "webhook"                 # Call external webhook
    LOG_ONLY = "log_only"               # Just log the result


class AIAgent(BaseModel):
    """AI Agent configuration"""
    
    __tablename__ = 'ai_agents'
    
    # Basic Info
    name = Column(String(100), nullable=False)
    description = Column(Text)
    status = Column(Enum(AgentStatus), default=AgentStatus.ACTIVE)
    
    # Owner
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    is_system = Column(Boolean, default=False)  # System agents can't be deleted
    
    # Model Configuration
    provider_id = Column(String(50), ForeignKey('ai_providers.id'), nullable=True)
    model_config = Column(JSONB, default=dict)  # temperature, max_tokens, etc.
    
    # Prompt
    system_prompt = Column(Text, default="")
    
    # Knowledge (RAG)
    knowledge_base_ids = Column(ARRAY(String), default=list)
    use_graphrag = Column(Boolean, default=False)
    
    # Trigger Configuration
    trigger_events = Column(ARRAY(String), default=list)
    trigger_pages = Column(ARRAY(String), default=list)
    trigger_condition = Column(Text)  # Optional JS-like condition
    enabled_presets = Column(ARRAY(String), default=list)
    
    # Input/Output Schema
    input_schema = Column(JSONB, default=dict)
    output_action = Column(String(50), default=OutputAction.SHOW_POPUP)
    output_target = Column(String(100))
    output_format = Column(String(50), default="json")
    
    # Permission
    allowed_roles = Column(ARRAY(String), default=list)
    
    # Stats
    execution_count = Column(Integer, default=0)
    last_executed_at = Column(DateTime(timezone=True))
    avg_execution_time = Column(Float, default=0.0)
    
    # Relationships
    provider = relationship("AIProvider", back_populates="agents")
    executions = relationship("AgentExecution", back_populates="agent", cascade="all, delete-orphan")
    triggers = relationship("AgentTrigger", back_populates="agent", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "status": self.status.value,
            "is_system": self.is_system,
            "provider_id": self.provider_id,
            "model_config": self.model_config,
            "system_prompt": self.system_prompt,
            "knowledge_base_ids": self.knowledge_base_ids,
            "use_graphrag": self.use_graphrag,
            "trigger_events": self.trigger_events,
            "trigger_pages": self.trigger_pages,
            "trigger_condition": self.trigger_condition,
            "enabled_presets": self.enabled_presets,
            "input_schema": self.input_schema,
            "output_action": self.output_action,
            "output_target": self.output_target,
            "output_format": self.output_format,
            "allowed_roles": self.allowed_roles,
            "execution_count": self.execution_count,
            "last_executed_at": self.last_executed_at.isoformat() if self.last_executed_at else None,
            "avg_execution_time": self.avg_execution_time,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class AgentExecution(BaseModel):
    """Agent execution record"""
    
    __tablename__ = 'agent_executions'
    
    agent_id = Column(String(36), ForeignKey('ai_agents.id'), nullable=False)
    input_data = Column(JSONB, default=dict)
    output_data = Column(JSONB, default=dict)
    status = Column(Enum('pending', 'running', 'completed', 'failed'), default='pending')
    execution_time = Column(Float, default=0.0)
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # Relationships
    agent = relationship("AIAgent", back_populates="executions")
    
    def to_dict(self):
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "input_data": self.input_data,
            "output_data": self.output_data,
            "status": self.status,
            "execution_time": self.execution_time,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class AgentTrigger(BaseModel):
    """Agent trigger configuration"""
    
    __tablename__ = 'agent_triggers'
    
    agent_id = Column(String(36), ForeignKey('ai_agents.id'), nullable=False)
    event = Column(String(50), nullable=False)
    page = Column(String(50))
    condition = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # Relationships
    agent = relationship("AIAgent", back_populates="triggers")
```

### 2.2 Agent Service

```python
# backend/app/services/agent/trigger_service.py
"""
Agent Trigger Service
Handles agent execution based on triggers
"""
from typing import Dict, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.ai_models import AIAgent, AgentExecution, TriggerEvent, OutputAction
from app.db.database import get_db
from app.services.ai.llm_service import llm_service
from app.services.ai.rag_service import rag_service


class AgentTriggerService:
    def __init__(self, db: Session = None):
        self.db = db or get_db()
    
    def get_matching_agents(self, event: str, page: str = None) -> List[AIAgent]:
        """Get agents that match the trigger event"""
        query = self.db.query(AIAgent).filter(
            AIAgent.status == "active",
            AIAgent.trigger_events.contains([event])
        )
        
        if page:
            query = query.filter(
                AIAgent.trigger_pages.contains([page])
            )
        
        return query.all()
    
    def should_execute(self, agent: AIAgent, input_data: Dict) -> bool:
        """Check if agent should execute based on condition"""
        if not agent.trigger_condition:
            return True
        
        try:
            # Simple condition evaluation
            condition = agent.trigger_condition
            for key, value in input_data.items():
                condition = condition.replace(f"${key}", str(value))
            
            return eval(condition)
        except:
            return True
    
    def execute_agent(self, agent: AIAgent, input_data: Dict, context: Dict = None) -> AgentExecution:
        """Execute an agent"""
        execution = AgentExecution(
            agent_id=agent.id,
            input_data=input_data,
            context=context,
            status="running"
        )
        self.db.add(execution)
        self.db.commit()
        self.db.refresh(execution)
        
        try:
            # Step 1: Get knowledge
            knowledge = []
            if agent.knowledge_base_ids:
                knowledge = self._get_knowledge(agent.knowledge_base_ids, input_data)
            
            # Step 2: Build prompt
            prompt = self._build_prompt(agent, input_data, knowledge)
            
            # Step 3: Execute LLM
            output = llm_service.generate(prompt, agent.model_config)
            
            # Step 4: Process output
            processed_output = self._process_output(output, agent)
            
            # Step 5: Execute output action
            self._execute_output_action(processed_output, agent, execution)
            
            # Step 6: Update execution
            execution.output_data = processed_output
            execution.status = "completed"
            execution.execution_time = (datetime.utcnow() - execution.created_at).total_seconds()
            
            # Step 7: Update agent stats
            agent.execution_count += 1
            agent.last_executed_at = datetime.utcnow()
            
        except Exception as e:
            execution.status = "failed"
            execution.error_message = str(e)
        
        self.db.commit()
        self.db.refresh(execution)
        
        return execution
    
    def _get_knowledge(self, kb_ids: List[str], input_data: Dict) -> List[Dict]:
        """Get knowledge from knowledge bases"""
        knowledge = []
        
        for kb_id in kb_ids:
            results = rag_service.search_similar(
                input_data.get("query", ""),
                k=3
            )
            knowledge.extend(results)
        
        return knowledge
    
    def _build_prompt(self, agent: AIAgent, input_data: Dict, knowledge: List[Dict]) -> str:
        """Build prompt for agent"""
        prompt_parts = []
        
        # System prompt
        if agent.system_prompt:
            prompt_parts.append(agent.system_prompt)
        
        # Knowledge context
        if knowledge:
            prompt_parts.append("\n\nKnowledge Base:")
            for k in knowledge:
                prompt_parts.append(f"- {k['text']}")
        
        # Input data
        prompt_parts.append("\n\nInput Data:")
        prompt_parts.append(str(input_data))
        
        return "\n".join(prompt_parts)
    
    def _process_output(self, output: str, agent: AIAgent) -> Dict:
        """Process agent output"""
        if agent.output_format == "json":
            try:
                import json
                return json.loads(output)
            except:
                return {"text": output}
        else:
            return {"text": output}
    
    def _execute_output_action(self, output: Dict, agent: AIAgent, execution: AgentExecution):
        """Execute output action"""
        if agent.output_action == OutputAction.SHOW_POPUP:
            # Show in UI
            pass
        elif agent.output_action == OutputAction.SAVE_TO_FIELD:
            # Save to contract/vendor field
            pass
        elif agent.output_action == OutputAction.CREATE_TASK:
            # Create task
            pass
        elif agent.output_action == OutputAction.SEND_EMAIL:
            # Send email
            pass
        elif agent.output_action == OutputAction.WEBHOOK:
            # Call webhook
            pass


# Singleton instance
agent_trigger_service = AgentTriggerService()
```

---

## Trigger Service Implementation

### 3.1 Trigger Service

```python
# backend/app/services/agent/trigger_service.py
class AgentTriggerService:
    def execute_triggers(self, event: str, input_data: Dict, page: str = None):
        """Execute all matching agents for an event"""
        agents = self.get_matching_agents(event, page)
        
        for agent in agents:
            if self.should_execute(agent, input_data):
                self.execute_agent(agent, input_data)
    
    def create_trigger(self, agent_id: str, event: str, page: str = None, condition: str = None) -> AgentTrigger:
        """Create a new trigger"""
        from app.models.ai_models import AgentTrigger
        
        trigger = AgentTrigger(
            agent_id=agent_id,
            event=event,
            page=page,
            condition=condition,
            is_active=True
        )
        
        self.db.add(trigger)
        self.db.commit()
        self.db.refresh(trigger)
        
        return trigger
    
    def get_agent_triggers(self, agent_id: str) -> List[AgentTrigger]:
        """Get all triggers for an agent"""
        return self.db.query(AgentTrigger).filter(
            AgentTrigger.agent_id == agent_id,
            AgentTrigger.is_active == True
        ).all()
```

### 3.2 Trigger Presets

```python
# backend/app/services/agent/presets.py
"""
Predefined agent trigger presets
"""
from typing import Dict, List

TRIGGER_PRESETS = {
    "doc_analyze_upload": {
        "id": "doc_analyze_upload",
        "name": "Analyze Document on Upload",
        "description": "วิเคราะห์เอกสารที่อัปโหลดโดยอัตโนมัติ",
        "trigger_events": ["document_upload"],
        "trigger_pages": ["documents"],
        "agent_id": "agent-document-analyzer"
    },
    "contract_review_btn": {
        "id": "contract_review_btn",
        "name": "Contract Review Button",
        "description": "ปุ่มวิเคราะห์สัญญาในหน้ารายละเอียด",
        "trigger_events": ["manual"],
        "trigger_pages": ["contracts"],
        "agent_id": "agent-risk-detector"
    },
    "contract_approve_analyze": {
        "id": "contract_approve_analyze",
        "name": "Analyze on Contract Approval",
        "description": "วิเคราะห์ความเสี่ยงก่อนอนุมัติสัญญา",
        "trigger_events": ["contract_approve"],
        "trigger_pages": ["contracts"],
        "agent_id": "agent-risk-detector"
    },
    "vendor_check_auto": {
        "id": "vendor_check_auto",
        "name": "Check Vendor on Create",
        "description": "ตรวจสอบความน่าเชื่อถือของผู้รับจ้างอัตโนมัติ",
        "trigger_events": ["vendor_check"],
        "trigger_pages": ["vendors"],
        "agent_id": "agent-vendor-checker"
    }
}


def get_preset(preset_id: str) -> Dict:
    """Get a trigger preset by ID"""
    return TRIGGER_PRESETS.get(preset_id)


def get_all_presets() -> List[Dict]:
    """Get all trigger presets"""
    return list(TRIGGER_PRESETS.values())
```

---

## Output Handler Implementation

### 4.1 Output Handler

```python
# backend/app/services/agent/output_handler.py
"""
Output Handler Service
Handles agent output based on output_action
"""
from typing import Dict
from sqlalchemy.orm import Session
from app.models.ai_models import AIAgent, AgentExecution, OutputAction
from app.db.database import get_db


class OutputHandler:
    def __init__(self, db: Session = None):
        self.db = db or get_db()
    
    def handle_output(self, output: Dict, agent: AIAgent, execution: AgentExecution):
        """Handle agent output based on output_action"""
        action = agent.output_action
        
        if action == OutputAction.SHOW_POPUP:
            return self._show_popup(output, agent)
        elif action == OutputAction.SAVE_TO_FIELD:
            return self._save_to_field(output, agent)
        elif action == OutputAction.CREATE_TASK:
            return self._create_task(output, agent)
        elif action == OutputAction.SEND_EMAIL:
            return self._send_email(output, agent)
        elif action == OutputAction.WEBHOOK:
            return self._call_webhook(output, agent)
        elif action == OutputAction.LOG_ONLY:
            return self._log_only(output, agent)
    
    def _show_popup(self, output: Dict, agent: AIAgent) -> Dict:
        """Show output in popup/modal"""
        return {
            "action": "show_popup",
            "data": output,
            "message": f"Agent {agent.name} completed successfully"
        }
    
    def _save_to_field(self, output: Dict, agent: AIAgent) -> Dict:
        """Save output to contract/vendor field"""
        field = agent.output_target
        value = output.get("value", output)
        
        # Update contract/vendor
        if agent.output_target.startswith("contract."):
            contract_id = agent.output_target.replace("contract.", "")
            self._update_contract(contract_id, field, value)
        
        return {
            "action": "save_to_field",
            "field": field,
            "value": value,
            "message": f"Saved to {field}"
        }
    
    def _create_task(self, output: Dict, agent: AIAgent) -> Dict:
        """Create a task for user"""
        from app.models.trigger_models import Task
        
        task = Task(
            title=output.get("title", f"Task from {agent.name}"),
            description=output.get("description", ""),
            priority=output.get("priority", "medium"),
            assigned_to=agent.user_id,
            created_by=agent.user_id
        )
        
        self.db.add(task)
        self.db.commit()
        
        return {
            "action": "create_task",
            "task_id": str(task.id),
            "message": f"Task created: {task.title}"
        }
    
    def _send_email(self, output: Dict, agent: AIAgent) -> Dict:
        """Send email notification"""
        from app.services.notification.email_service import email_service
        
        email_service.send_email(
            to=agent.output_target,
            subject=f"Agent {agent.name} Result",
            body=str(output)
        )
        
        return {
            "action": "send_email",
            "to": agent.output_target,
            "message": "Email sent successfully"
        }
    
    def _call_webhook(self, output: Dict, agent: AIAgent) -> Dict:
        """Call external webhook"""
        import requests
        
        response = requests.post(
            agent.output_target,
            json=output,
            timeout=30
        )
        
        return {
            "action": "webhook",
            "status_code": response.status_code,
            "message": "Webhook called successfully"
        }
    
    def _log_only(self, output: Dict, agent: AIAgent) -> Dict:
        """Log output only"""
        return {
            "action": "log_only",
            "message": "Output logged"
        }
```

---

## API Endpoints

### 5.1 Agent API Endpoints

```python
# backend/app/api/v1/agents.py
"""
Agent API Endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.schemas.agent import AgentCreate, AgentUpdate, AgentExecute
from app.models.ai_models import AIAgent, AgentExecution, AgentStatus
from app.db.database import get_db
from app.services.agent.trigger_service import agent_trigger_service
from app.services.agent.output_handler import OutputHandler
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/v1/agents", tags=["Agents"])


@router.get("/")
def list_agents(
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None),
    is_system: Optional[bool] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """List all agents"""
    query = db.query(AIAgent)
    
    if status:
        query = query.filter(AIAgent.status == status)
    
    if is_system is not None:
        query = query.filter(AIAgent.is_system == is_system)
    
    # Filter by user's organization
    if not current_user.is_admin:
        query = query.filter(
            (AIAgent.user_id == current_user.id) |
            (AIAgent.allowed_roles.contains([current_user.role]))
        )
    
    agents = query.all()
    return {"items": [a.to_dict() for a in agents], "total": len(agents)}


@router.post("/")
def create_agent(
    agent: AgentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new agent"""
    db_agent = AIAgent(
        name=agent.name,
        description=agent.description,
        user_id=current_user.id,
        provider_id=agent.provider_id,
        model_config=agent.model_config,
        system_prompt=agent.system_prompt,
        knowledge_base_ids=agent.knowledge_base_ids,
        use_graphrag=agent.use_graphrag,
        trigger_events=agent.trigger_events,
        trigger_pages=agent.trigger_pages,
        trigger_condition=agent.trigger_condition,
        enabled_presets=agent.enabled_presets,
        input_schema=agent.input_schema,
        output_action=agent.output_action,
        output_target=agent.output_target,
        output_format=agent.output_format,
        allowed_roles=agent.allowed_roles,
        status=AgentStatus.ACTIVE
    )
    
    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)
    
    return db_agent.to_dict()


@router.get("/{agent_id}")
def get_agent(
    agent_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get agent details"""
    agent = db.query(AIAgent).filter(AIAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Check permissions
    if not current_user.is_admin and agent.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return agent.to_dict()


@router.put("/{agent_id}")
def update_agent(
    agent_id: str,
    agent: AgentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an agent"""
    db_agent = db.query(AIAgent).filter(AIAgent.id == agent_id).first()
    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Check permissions
    if not current_user.is_admin and db_agent.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update fields
    update_data = agent.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_agent, field, value)
    
    db.commit()
    db.refresh(db_agent)
    
    return db_agent.to_dict()


@router.delete("/{agent_id}")
def delete_agent(
    agent_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an agent"""
    agent = db.query(AIAgent).filter(AIAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Check permissions
    if not current_user.is_admin and agent.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Prevent deletion of system agents
    if agent.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete system agent")
    
    db.delete(agent)
    db.commit()
    
    return {"message": "Agent deleted successfully"}


@router.post("/{agent_id}/execute")
def execute_agent(
    agent_id: str,
    execution: AgentExecute,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Execute an agent"""
    agent = db.query(AIAgent).filter(AIAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Check permissions
    if not current_user.is_admin and agent.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = agent_trigger_service.execute_agent(
        agent, 
        execution.input, 
        execution.context
    )
    
    return result.to_dict()


@router.get("/{agent_id}/analytics")
def get_agent_analytics(
    agent_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get agent analytics"""
    from datetime import datetime, timedelta
    
    # Total executions
    total_executions = db.query(func.count(AgentExecution.id)).filter(
        AgentExecution.agent_id == agent_id
    ).scalar()
    
    # Success rate
    successful_executions = db.query(func.count(AgentExecution.id)).filter(
        AgentExecution.agent_id == agent_id,
        AgentExecution.status == "completed"
    ).scalar()
    
    success_rate = successful_executions / total_executions * 100 if total_executions > 0 else 0
    
    # Average execution time
    avg_execution_time = db.query(func.avg(AgentExecution.execution_time)).filter(
        AgentExecution.agent_id == agent_id
    ).scalar() or 0
    
    # Daily executions (last 7 days)
    daily_executions = []
    for i in range(7):
        date = datetime.utcnow() - timedelta(days=i)
        count = db.query(func.count(AgentExecution.id)).filter(
            AgentExecution.agent_id == agent_id,
            func.date(AgentExecution.created_at) == date.date()
        ).scalar()
        daily_executions.append({
            "date": date.strftime("%Y-%m-%d"),
            "count": count
        })
    
    return {
        "total_executions": total_executions,
        "successful_executions": successful_executions,
        "failed_executions": total_executions - successful_executions,
        "success_rate": round(success_rate, 2),
        "avg_execution_time": round(avg_execution_time, 2),
        "daily_executions": list(reversed(daily_executions))
    }
```

---

## Frontend Integration

### 6.1 Agent Service

```typescript
// frontend/src/services/agentService.ts
/**
 * Agent Service
 * Handles agent execution and configuration
 */
import axios from 'axios';

const API_BASE_URL = '/api/v1/agents';

export interface Agent {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'error';
  is_system: boolean;
  provider_id: string;
  model_config: Record<string, any>;
  system_prompt: string;
  knowledge_base_ids: string[];
  use_graphrag: boolean;
  trigger_events: string[];
  trigger_pages: string[];
  trigger_condition: string;
  enabled_presets: string[];
  input_schema: Record<string, any>;
  output_action: string;
  output_target: string;
  output_format: string;
  allowed_roles: string[];
  execution_count: number;
  last_executed_at: string | null;
  avg_execution_time: number;
  created_at: string;
}

export interface AgentExecute {
  input: Record<string, any>;
  context?: Record<string, any>;
}

export interface AgentExecuteResponse {
  id: string;
  agent_id: string;
  input_data: Record<string, any>;
  output_data: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  execution_time: number;
  error_message: string | null;
  created_at: string;
}

export async function listAgents(): Promise<{ items: Agent[]; total: number }> {
  const response = await axios.get(API_BASE_URL);
  return response.data;
}

export async function createAgent(agent: Partial<Agent>): Promise<Agent> {
  const response = await axios.post(API_BASE_URL, agent);
  return response.data;
}

export async function getAgent(agentId: string): Promise<Agent> {
  const response = await axios.get(`${API_BASE_URL}/${agentId}`);
  return response.data;
}

export async function updateAgent(agentId: string, agent: Partial<Agent>): Promise<Agent> {
  const response = await axios.put(`${API_BASE_URL}/${agentId}`, agent);
  return response.data;
}

export async function deleteAgent(agentId: string): Promise<{ message: string }> {
  const response = await axios.delete(`${API_BASE_URL}/${agentId}`);
  return response.data;
}

export async function executeAgent(
  agentId: string,
  input: Record<string, any>,
  context?: Record<string, any>
): Promise<AgentExecuteResponse> {
  const response = await axios.post(`${API_BASE_URL}/${agentId}/execute`, {
    input,
    context
  });
  return response.data;
}

export async function getAgentAnalytics(agentId: string): Promise<any> {
  const response = await axios.get(`${API_BASE_URL}/${agentId}/analytics`);
  return response.data;
}

// Hook for easy agent execution
export function useAIAgent(agentId: string) {
  const execute = async (input: Record<string, any>, context?: Record<string, any>) => {
    try {
      const result = await executeAgent(agentId, input, context);
      return result;
    } catch (error) {
      console.error('Agent execution failed:', error);
      throw error;
    }
  };

  return { execute };
}
```

### 6.2 Agent Configuration Form

```typescript
// frontend/src/components/AgentConfigForm.tsx
/**
 * Agent Configuration Form
 * Form for creating and editing AI agents
 */
import { useState } from 'react';
import { createAgent, updateAgent, Agent } from '../services/agentService';

interface AgentConfigFormProps {
  agent?: Agent;
  onSuccess?: () => void;
}

export function AgentConfigForm({ agent, onSuccess }: AgentConfigFormProps) {
  const [config, setConfig] = useState<Partial<Agent>>({
    name: agent?.name || '',
    description: agent?.description || '',
    provider_id: agent?.provider_id || 'openai-gpt4',
    model_config: agent?.model_config || { temperature: 0.7, max_tokens: 4000 },
    system_prompt: agent?.system_prompt || '',
    knowledge_base_ids: agent?.knowledge_base_ids || [],
    use_graphrag: agent?.use_graphrag || false,
    trigger_events: agent?.trigger_events || [],
    trigger_pages: agent?.trigger_pages || [],
    trigger_condition: agent?.trigger_condition || '',
    enabled_presets: agent?.enabled_presets || [],
    input_schema: agent?.input_schema || {},
    output_action: agent?.output_action || 'show_popup',
    output_target: agent?.output_target || '',
    output_format: agent?.output_format || 'json',
    allowed_roles: agent?.allowed_roles || []
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (agent) {
        await updateAgent(agent.id, config);
      } else {
        await createAgent(config);
      }
      
      onSuccess?.();
    } catch (error) {
      console.error('Failed to save agent:', error);
      alert('Failed to save agent');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="agent-config-form">
      <h2>{agent ? 'Edit Agent' : 'Create AI Agent'}</h2>
      
      <div className="form-group">
        <label>Name <span style={{ color: 'red' }}>*</span></label>
        <input
          type="text"
          required
          value={config.name}
          onChange={(e) => setConfig({ ...config, name: e.target.value })}
        />
      </div>
      
      <div className="form-group">
        <label>Description</label>
        <textarea
          value={config.description}
          onChange={(e) => setConfig({ ...config, description: e.target.value })}
          rows={2}
        />
      </div>
      
      <div className="form-section">
        <h3>Model Configuration</h3>
        
        <div className="form-group">
          <label>Provider</label>
          <select
            value={config.provider_id}
            onChange={(e) => setConfig({ ...config, provider_id: e.target.value })}
          >
            <option value="openai-gpt4">OpenAI GPT-4</option>
            <option value="openai-gpt3.5">OpenAI GPT-3.5</option>
            <option value="ollama-llama3.1">Ollama Llama3.1</option>
            <option value="anthropic-claude">Anthropic Claude</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Temperature</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={config.model_config?.temperature || 0.7}
            onChange={(e) => setConfig({
              ...config,
              model_config: {
                ...config.model_config,
                temperature: parseFloat(e.target.value)
              }
            })}
          />
          <span>0.7 - Balance between creativity and accuracy</span>
        </div>
        
        <div className="form-group">
          <label>Max Tokens</label>
          <input
            type="number"
            value={config.model_config?.max_tokens || 4000}
            onChange={(e) => setConfig({
              ...config,
              model_config: {
                ...config.model_config,
                max_tokens: parseInt(e.target.value)
              }
            })}
          />
        </div>
      </div>
      
      <div className="form-section">
        <h3>System Prompt</h3>
        <textarea
          rows={8}
          value={config.system_prompt}
          onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })}
          placeholder="คุณเป็นผู้เชี่ยวชาญด้าน..."
        />
      </div>
      
      <div className="form-section">
        <h3>Trigger Configuration</h3>
        
        <div className="form-group">
          <label>Trigger Events</label>
          <select
            multiple
            value={config.trigger_events}
            onChange={(e) => setConfig({
              ...config,
              trigger_events: Array.from(e.target.selectedOptions, option => option.value)
            })}
          >
            <option value="document_upload">Document Upload</option>
            <option value="contract_create">Contract Create</option>
            <option value="contract_review">Contract Review</option>
            <option value="contract_approve">Contract Approve</option>
            <option value="vendor_check">Vendor Check</option>
            <option value="manual">Manual</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Pages</label>
          <select
            multiple
            value={config.trigger_pages}
            onChange={(e) => setConfig({
              ...config,
              trigger_pages: Array.from(e.target.selectedOptions, option => option.value)
            })}
          >
            <option value="contracts">Contracts</option>
            <option value="documents">Documents</option>
            <option value="dashboard">Dashboard</option>
            <option value="agents">Agents</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Condition (Optional)</label>
          <input
            type="text"
            value={config.trigger_condition}
            onChange={(e) => setConfig({ ...config, trigger_condition: e.target.value })}
            placeholder="e.g. $value > 1000000"
          />
        </div>
      </div>
      
      <div className="form-section">
        <h3>Output Configuration</h3>
        
        <div className="form-group">
          <label>Output Action</label>
          <select
            value={config.output_action}
            onChange={(e) => setConfig({ ...config, output_action: e.target.value })}
          >
            <option value="show_popup">Show Popup</option>
            <option value="save_to_field">Save to Field</option>
            <option value="create_task">Create Task</option>
            <option value="send_email">Send Email</option>
            <option value="webhook">Webhook</option>
            <option value="log_only">Log Only</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Output Format</label>
          <select
            value={config.output_format}
            onChange={(e) => setConfig({ ...config, output_format: e.target.value })}
          >
            <option value="json">JSON</option>
            <option value="markdown">Markdown</option>
            <option value="text">Text</option>
          </select>
        </div>
      </div>
      
      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          {agent ? 'Update Agent' : 'Create Agent'}
        </button>
      </div>
    </form>
  );
}
```

### 6.3 Agent List Component

```typescript
// frontend/src/components/AgentList.tsx
/**
 * Agent List Component
 * Displays list of AI agents
 */
import { useState, useEffect } from 'react';
import { listAgents, deleteAgent, Agent } from '../services/agentService';
import { AgentConfigForm } from './AgentConfigForm';

export function AgentList() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const response = await listAgents();
      setAgents(response.items);
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (agentId: string) => {
    if (!window.confirm('Are you sure you want to delete this agent?')) {
      return;
    }

    try {
      await deleteAgent(agentId);
      loadAgents();
    } catch (error) {
      console.error('Failed to delete agent:', error);
      alert('Failed to delete agent');
    }
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingAgent(null);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingAgent(null);
    loadAgents();
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="agent-list">
      <div className="list-header">
        <h2>AI Agents</h2>
        <button className="btn btn-success" onClick={handleCreate}>
          + Create Agent
        </button>
      </div>

      {showForm && (
        <div className="agent-form-modal">
          <AgentConfigForm
            agent={editingAgent}
            onSuccess={handleFormSuccess}
          />
        </div>
      )}

      <div className="agents-grid">
        {agents.map(agent => (
          <div key={agent.id} className="agent-card">
            <div className="agent-header">
              <h3>{agent.name}</h3>
              <span className={`status-badge status-${agent.status}`}>
                {agent.status}
              </span>
            </div>
            
            <p className="agent-description">{agent.description}</p>
            
            <div className="agent-stats">
              <span>Executions: {agent.execution_count}</span>
              <span>Avg Time: {agent.avg_execution_time.toFixed(2)}s</span>
            </div>

            <div className="agent-actions">
              <button className="btn btn-primary" onClick={() => handleEdit(agent)}>
                Edit
              </button>
              <button 
                className="btn btn-danger" 
                onClick={() => handleDelete(agent.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Testing

### 7.1 Unit Tests

```python
# backend/tests/test_agent_service.py
"""
Tests for Agent Service
"""
import pytest
from app.services.agent.trigger_service import AgentTriggerService
from app.models.ai_models import AIAgent, AgentStatus, TriggerEvent, OutputAction


@pytest.fixture
def agent_service(db_session):
    return AgentTriggerService(db_session)


@pytest.fixture
def test_agent(db_session):
    agent = AIAgent(
        name="Test Agent",
        description="Test agent",
        user_id="test-user-id",
        status=AgentStatus.ACTIVE,
        trigger_events=["manual"],
        trigger_pages=["contracts"],
        output_action=OutputAction.SHOW_POPUP
    )
    db_session.add(agent)
    db_session.commit()
    return agent


def test_get_matching_agents(agent_service, test_agent):
    # Test matching agents
    agents = agent_service.get_matching_agents("manual")
    assert len(agents) == 1
    assert agents[0].id == test_agent.id


def test_should_execute_without_condition(agent_service, test_agent):
    # Should execute when no condition is set
    input_data = {"test": "data"}
    assert agent_service.should_execute(test_agent, input_data) is True


def test_should_execute_with_condition(agent_service, test_agent):
    # Test with condition
    test_agent.trigger_condition = "$value > 1000"
    input_data = {"value": 2000}
    assert agent_service.should_execute(test_agent, input_data) is True
    
    input_data = {"value": 500}
    assert agent_service.should_execute(test_agent, input_data) is False


def test_execute_agent(agent_service, test_agent):
    # Test agent execution
    input_data = {"test": "data"}
    execution = agent_service.execute_agent(test_agent, input_data)
    
    assert execution.status == "completed"
    assert execution.agent_id == test_agent.id
```

### 7.2 Integration Tests

```python
# backend/tests/test_agent_api.py
"""
Tests for Agent API
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import get_db
from app.models.ai_models import AIAgent, AgentStatus, OutputAction


client = TestClient(app)


def test_list_agents(client, auth_headers):
    response = client.get("/api/v1/agents", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data


def test_create_agent(client, auth_headers):
    agent_data = {
        "name": "Test Agent",
        "description": "Test agent",
        "provider_id": "openai-gpt4",
        "model_config": {"temperature": 0.7},
        "system_prompt": "You are a test agent",
        "trigger_events": ["manual"],
        "trigger_pages": ["contracts"],
        "output_action": "show_popup"
    }
    
    response = client.post(
        "/api/v1/agents",
        json=agent_data,
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Agent"


def test_execute_agent(client, auth_headers):
    # First create an agent
    agent_data = {
        "name": "Test Agent",
        "description": "Test agent",
        "provider_id": "openai-gpt4",
        "model_config": {"temperature": 0.7},
        "system_prompt": "You are a test agent",
        "trigger_events": ["manual"],
        "trigger_pages": ["contracts"],
        "output_action": "show_popup"
    }
    
    create_response = client.post(
        "/api/v1/agents",
        json=agent_data,
        headers=auth_headers
    )
    agent_id = create_response.json()["id"]
    
    # Execute the agent
    execute_data = {
        "input": {"test": "data"}
    }
    
    response = client.post(
        f"/api/v1/agents/{agent_id}/execute",
        json=execute_data,
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert "status" in data
```

---

## Deployment

### 8.1 Docker Configuration

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 5173

CMD ["npm", "run", "dev"]
```

### 8.2 Docker Compose

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/contractmgmt
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OLLAMA_BASE_URL=http://ollama:11434
    depends_on:
      - db
      - redis
      - ollama

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend

  db:
    image: postgres:14
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=contractmgmt
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6

  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_data:/root/.ollama

volumes:
  postgres_data:
  ollama_data:
```

### 8.3 Environment Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start development server
uvicorn main:app --reload

# Start frontend
cd frontend
npm install
npm run dev
```

---

## Appendix

### A. Agent Configuration Examples

```json
{
    "name": "Contract Risk Analyzer",
    "description": "วิเคราะห์ความเสี่ยงในสัญญาก่อนอนุมัติ",
    "provider_id": "openai-gpt4",
    "model_config": {
        "temperature": 0.3,
        "max_tokens": 4000
    },
    "system_prompt": "คุณเป็นผู้เชี่ยวชาญด้านความเสี่ยงในสัญญาภาครัฐ...",
    "knowledge_base_ids": ["kb-contract-law", "kb-templates"],
    "use_graphrag": true,
    "trigger_events": ["contract_approve_analyze"],
    "trigger_pages": ["contracts"],
    "input_schema": {
        "contract_data": true,
        "vendor_id": true
    },
    "output_action": "show_popup",
    "output_format": "json",
    "allowed_roles": ["admin", "approver"]
}
```

### B. API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/agents | List all agents |
| POST | /api/v1/agents | Create new agent |
| GET | /api/v1/agents/{id} | Get agent details |
| PUT | /api/v1/agents/{id} | Update agent |
| DELETE | /api/v1/agents/{id} | Delete agent |
| POST | /api/v1/agents/{id}/execute | Execute agent |
| GET | /api/v1/agents/{id}/analytics | Get agent analytics |

---

*Document Version: 2.0 | Last Updated: กุมภาพันธ์ 2026*
