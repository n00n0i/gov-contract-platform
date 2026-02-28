# Agent Design Document

> Gov Contract Platform - ระบบบริหารจัดการ AI Agents

**Version**: 2.0  
**Date**: กุมภาพันธ์ 2026  
**Author**: n00n0i

---

## สารบัญ

1. [บทนำ](#บทนำ)
2. [Agent Architecture Overview](#agent-architecture-overview)
3. [Agent Components](#agent-components)
4. [Trigger System](#trigger-system)
5. [Output Actions](#output-actions)
6. [Knowledge Integration](#knowledge-integration)
7. [Agent Workflow](#agent-workflow)
8. [Security & Permissions](#security--permissions)
9. [Monitoring & Analytics](#monitoring--analytics)

---

## บทนำ

### 1.1 วัตถุประสงค์

เอกสารนี้อธิบายการออกแบบ AI Agent System สำหรับ Gov Contract Platform ซึ่งเป็นระบบที่ช่วยให้:

- สร้าง AI Agents แบบกำหนดเองได้ง่าย
- ตั้งค่า Trigger Events สำหรับการทำงานอัตโนมัติ
- ผสานความรู้จาก Knowledge Base
- ประมวลผลและแสดงผลลัพธ์ตาม Output Actions

### 1.2 ขอบเขต

ระบบ Agent ครอบคลุม:

- Agent Configuration และ Management
- Trigger Event Handling
- Output Action Execution
- Knowledge Base Integration
- Execution Tracking และ Analytics

---

## Agent Architecture Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Agent Engine                                     │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │   Trigger    │  │   Prompt     │  │   Knowledge  │  │   Output   │  │
│  │   Handler    │  │   Manager    │  │   Integrator │  │   Handler  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
│                                    │                                     │
│                                    ▼                                     │
│                         ┌──────────────────┐                            │
│                         │   LLM Execution  │                            │
│                         └──────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Data Layer                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  PostgreSQL  │  │  pgvector    │  │   MinIO      │  │ Elasticsearch││
│  │  (Agents)    │  │   (Vectors)  │  │  (Docs)      │  │  (Search)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │   Agent      │  │   Trigger    │  │   Knowledge  │  │    Config  │  │
│  │   List       │  │   Config     │  │   Base       │  │    UI      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Application Layer (FastAPI)                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Agent API Endpoints                           │   │
│  │  • /api/v1/agents/...                                            │   │
│  │  • /api/v1/agents/{id}/execute                                   │   │
│  │  • /api/v1/agent-triggers/...                                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Service Layer                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │   Agent      │  │   Trigger    │  │   Knowledge  │  │   Output   │  │
│  │   Service    │  │   Service    │  │   Integrator │  │   Handler  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Components

### 3.1 Agent Configuration

```python
# backend/app/models/ai_models.py
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
```

### 3.2 Agent Status

```python
class AgentStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"
```

### 3.3 Agent Types

| Type | Description | Use Case |
|------|-------------|----------|
| Document Analyzer | วิเคราะห์เอกสารและแยกข้อมูล | OCR, Document Processing |
| Contract Reviewer | ตรวจสอบสัญญาและหาความเสี่ยง | Contract Management |
| Vendor Checker | ตรวจสอบความน่าเชื่อถือของผู้รับจ้าง | Vendor Management |
| Report Generator | สร้างรายงานจากข้อมูล | Reporting |
| Chat Assistant | ตอบคำถามเกี่ยวกับสัญญา | Q&A Assistant |

---

## Trigger System

### 4.1 Trigger Events

```python
class TriggerEvent(str, enum.Enum):
    """Events that can trigger an agent"""
    DOCUMENT_UPLOAD = "document_upload"
    CONTRACT_CREATE = "contract_create"
    CONTRACT_REVIEW = "contract_review"
    CONTRACT_APPROVE = "contract_approve"
    VENDOR_CHECK = "vendor_check"
    MANUAL = "manual"  # User triggers manually
    SCHEDULED = "scheduled"  # Cron job
```

### 4.2 Trigger Configuration

```json
{
    "trigger_events": ["document_upload", "contract_create"],
    "trigger_pages": ["contracts", "documents"],
    "trigger_condition": "contract.value > 1000000"
}
```

### 4.3 Trigger Handler

```python
# backend/app/services/agent/trigger_service.py
class AgentTriggerService:
    def __init__(self):
        self.db = get_db()
    
    def get_matching_agents(self, event: str, page: str = None) -> List[Agent]:
        """Get agents that match the trigger event"""
        query = self.db.query(Agent).filter(
            Agent.status == "active",
            Agent.trigger_events.contains([event])
        )
        
        if page:
            query = query.filter(
                Agent.trigger_pages.contains([page])
            )
        
        return query.all()
    
    def should_execute(self, agent: Agent, input_data: Dict) -> bool:
        """Check if agent should execute based on condition"""
        if not agent.trigger_condition:
            return True
        
        # Evaluate condition
        try:
            # Simple condition evaluation
            condition = agent.trigger_condition
            # Replace variables with actual values
            for key, value in input_data.items():
                condition = condition.replace(f"${key}", str(value))
            
            # Evaluate the condition
            return eval(condition)
        except:
            return True
    
    def execute_triggers(self, event: str, input_data: Dict, page: str = None):
        """Execute all matching agents for an event"""
        agents = self.get_matching_agents(event, page)
        
        for agent in agents:
            if self.should_execute(agent, input_data):
                self.execute_agent(agent, input_data)
```

### 4.4 Trigger Presets

```json
{
    "presets": [
        {
            "id": "doc_analyze_upload",
            "name": "Analyze Document on Upload",
            "description": "วิเคราะห์เอกสารที่อัปโหลดโดยอัตโนมัติ",
            "trigger_events": ["document_upload"],
            "trigger_pages": ["documents"],
            "agent_id": "agent-document-analyzer"
        },
        {
            "id": "contract_review_btn",
            "name": "Contract Review Button",
            "description": "ปุ่มวิเคราะห์สัญญาในหน้ารายละเอียด",
            "trigger_events": ["manual"],
            "trigger_pages": ["contracts"],
            "agent_id": "agent-risk-detector"
        }
    ]
}
```

---

## Output Actions

### 5.1 Output Action Types

```python
class OutputAction(str, enum.Enum):
    """What to do with agent output"""
    SHOW_POPUP = "show_popup"           # Show result in modal/toast
    SAVE_TO_FIELD = "save_to_field"     # Save to specific contract/vendor field
    CREATE_TASK = "create_task"         # Create a task for user
    SEND_EMAIL = "send_email"           # Send email notification
    WEBHOOK = "webhook"                 # Call external webhook
    LOG_ONLY = "log_only"               # Just log the result
```

### 5.2 Output Handler

```python
# backend/app/services/agent/output_handler.py
class OutputHandler:
    def __init__(self):
        self.db = get_db()
    
    def handle_output(self, output: Dict, agent: Agent, execution: AgentExecution):
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
    
    def _show_popup(self, output: Dict, agent: Agent) -> Dict:
        """Show output in popup/modal"""
        return {
            "action": "show_popup",
            "data": output,
            "message": f"Agent {agent.name} completed successfully"
        }
    
    def _save_to_field(self, output: Dict, agent: Agent) -> Dict:
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
    
    def _create_task(self, output: Dict, agent: Agent) -> Dict:
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
    
    def _send_email(self, output: Dict, agent: Agent) -> Dict:
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
    
    def _call_webhook(self, output: Dict, agent: Agent) -> Dict:
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
    
    def _log_only(self, output: Dict, agent: Agent) -> Dict:
        """Log output only"""
        return {
            "action": "log_only",
            "message": "Output logged"
        }
```

---

## Knowledge Integration

### 6.1 Knowledge Base Integration

```python
# backend/app/services/agent/knowledge_integrator.py
class KnowledgeIntegrator:
    def __init__(self):
        self.db = get_db()
        self.rag_service = rag_service
    
    def get_knowledge(self, agent: Agent, input_data: Dict) -> List[Dict]:
        """Get knowledge from knowledge bases"""
        knowledge = []
        
        for kb_id in agent.knowledge_base_ids:
            # Get knowledge base
            kb = self.db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
            if not kb:
                continue
            
            # Query knowledge base
            results = self.rag_service.search_similar(
                input_data.get("query", ""),
                k=kb.max_results or 5
            )
            
            knowledge.extend([
                {
                    "source": kb.name,
                    "text": result["text"],
                    "score": result["score"]
                }
                for result in results
            ])
        
        return knowledge
    
    def build_context(self, knowledge: List[Dict]) -> str:
        """Build context string from knowledge"""
        context_parts = []
        
        for k in knowledge:
            if k["score"] > 0.5:  # Only include high-scoring results
                context_parts.append(f"[{k['source']}] {k['text']}")
        
        return "\n\n".join(context_parts)
```

### 6.2 GraphRAG Integration

```python
# backend/app/services/agent/graphrag_service.py
class GraphRAGService:
    def __init__(self):
        self.neo4j_driver = neo4j.Driver()
    
    def query_graph(self, question: str, k: int = 5) -> List[Dict]:
        """Query knowledge graph for answers"""
        # Convert question to graph query
        query = self._question_to_graph_query(question)
        
        # Execute graph query
        results = self.neo4j_driver.execute(query, limit=k)
        
        return [
            {
                "type": "graph",
                "nodes": result["nodes"],
                "relationships": result["relationships"],
                "score": result["score"]
            }
            for result in results
        ]
    
    def _question_to_graph_query(self, question: str) -> str:
        """Convert natural language question to Cypher query"""
        # Simple implementation - in production, use LLM to generate Cypher
        return f"""
        MATCH (n)-[r]->(m)
        WHERE n.name CONTAINS $question OR m.name CONTAINS $question
        RETURN n, r, m, rand() as score
        LIMIT 5
        """
```

---

## Agent Workflow

### 7.1 Agent Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Agent Workflow                                   │
│                                                                          │
│  1. Trigger Event                                                        │
│       ↓                                                                  │
│  2. Agent Matching                                                       │
│       ↓                                                                  │
│  3. Input Validation                                                     │
│       ↓                                                                  │
│  4. Knowledge Retrieval                                                  │
│       ↓                                                                  │
│  5. Prompt Construction                                                  │
│       ↓                                                                  │
│  6. LLM Execution                                                        │
│       ↓                                                                  │
│  7. Output Processing                                                    │
│       ↓                                                                  │
│  8. Output Action                                                        │
│       ↓                                                                  │
│  9. Execution Logging                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Agent Execution Service

```python
# backend/app/services/agent/trigger_service.py
class AgentTriggerService:
    def execute_agent(self, agent: Agent, input_data: Dict, context: Dict = None) -> AgentExecution:
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
```

---

## Security & Permissions

### 8.1 Agent Permissions

```python
# backend/app/models/ai_models.py
class AIAgent(BaseModel):
    # Permission
    allowed_roles = Column(ARRAY(String), default=[])
    allowed_organizations = Column(ARRAY(String), default=[])
```

### 8.2 Permission Checker

```python
# backend/app/services/agent/permission_service.py
class AgentPermissionService:
    def __init__(self, current_user: User):
        self.current_user = current_user
    
    def can_access_agent(self, agent: AIAgent) -> bool:
        """Check if user can access agent"""
        # System agents are accessible to everyone
        if agent.is_system:
            return True
        
        # Check if user is owner
        if agent.user_id == self.current_user.id:
            return True
        
        # Check roles
        if agent.allowed_roles and self.current_user.role not in agent.allowed_roles:
            return False
        
        # Check organizations
        if agent.allowed_organizations:
            if self.current_user.organization_id not in agent.allowed_organizations:
                return False
        
        return True
    
    def can_execute_agent(self, agent: AIAgent) -> bool:
        """Check if user can execute agent"""
        return self.can_access_agent(agent)
```

---

## Monitoring & Analytics

### 9.1 Execution Tracking

```python
# backend/app/models/ai_models.py
class AgentExecution(BaseModel):
    """Agent execution record"""
    
    __tablename__ = 'agent_executions'
    
    agent_id = Column(String(36), ForeignKey('ai_agents.id'), nullable=False)
    input_data = Column(JSONB, default=dict)
    output_data = Column(JSONB, default=dict)
    status = Column(Enum(ExecutionStatus), default=ExecutionStatus.PENDING)
    execution_time = Column(Float, default=0.0)
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), default=func.now())
```

### 9.2 Analytics Dashboard

```python
# backend/app/api/v1/agents.py
@router.get("/{agent_id}/analytics")
def get_agent_analytics(agent_id: str, db: Session = Depends(get_db)):
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

### B. API Endpoints

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
