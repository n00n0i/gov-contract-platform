# 🔧 AI Implementation Guide - คู่มือการพัฒนา

## สารบัญ

1. [Quick Start - เริ่มต้นใช้งาน](#quick-start)
2. [สร้าง Agent ใหม่](#สร้าง-agent-ใหม่)
3. [Trigger Integration](#trigger-integration)
4. [Output Handler](#output-handler)
5. [ตัวอย่าง Use Cases](#ตัวอย่าง-use-cases)

---

## Quick Start

### 1. สร้าง Agent พื้นฐาน

```python
# backend/app/agents/custom_agents.py
from app.api.v1.agents import AgentCreate, create_agent

# สร้าง Agent วิเคราะห์สัญญา
contract_analyzer = AgentCreate(
    name="Contract Risk Analyzer",
    description="วิเคราะห์ความเสี่ยงในสัญญาก่อนอนุมัติ",
    provider_id="ollama-llama3.1",  # หรือ openai-gpt4
    model_config={
        "temperature": 0.3,
        "max_tokens": 4000
    },
    system_prompt="""คุณเป็นผู้เชี่ยวชาญด้านความเสี่ยงในสัญญาภาครัฐ
    
    หน้าที่:
    1. วิเคราะห์เงื่อนไขที่เสี่ยง
    2. ตรวจสอบความสอดคล้องกฎหมาย
    3. ให้คะแนนความเสี่ยง (1-10)
    
    ตอบในรูปแบบ JSON:
    {
        "risk_score": 7,
        "risk_level": "high",
        "findings": [...],
        "recommendations": [...]
    }""",
    knowledge_base_ids=["kb-contract-law", "kb-templates"],
    use_graphrag=True,
    trigger_events=["contract_approve_analyze"],
    trigger_pages=["contracts"],
    input_schema={
        "contract_data": True,
        "vendor_id": True
    },
    output_action="show_popup",
    output_format="json",
    allowed_roles=["admin", "approver"]
)
```

### 2. Frontend Integration

```typescript
// frontend/src/hooks/useAIAgent.ts
import { useCallback } from 'react';
import { executeAgent, handleAgentOutput } from '../services/agentService';

export function useAIAgent(agentId: string) {
  const execute = useCallback(async (input: any) => {
    try {
      // 1. Execute agent
      const result = await executeAgent(agentId, {
        input,
        context: {
          page: window.location.pathname,
          timestamp: new Date().toISOString()
        }
      });
      
      // 2. Handle output actions
      await handleAgentOutput(result, {
        onPopup: (data) => openAnalysisModal(data),
        onSaveField: (field, value) => updateFormField(field, value),
        onTask: (taskId) => showNotification('Task created', taskId),
        onEmail: () => showToast('Notification sent')
      });
      
      return result;
    } catch (error) {
      console.error('Agent execution failed:', error);
      throw error;
    }
  }, [agentId]);
  
  return { execute };
}

// ใช้ใน Component
function ContractReviewPage({ contractId }: { contractId: string }) {
  const { execute } = useAIAgent('agent-risk-detector');
  
  const handleAnalyze = async () => {
    const result = await execute({
      contract_id: contractId,
      analyze_depth: 'full'
    });
    
    if (result.analysis?.risk_level === 'critical') {
      alert('พบความเสี่ยงสูง กรุณาตรวจสอบ!');
    }
  };
  
  return (
    <button onClick={handleAnalyze}>
      🔍 วิเคราะห์ความเสี่ยง
    </button>
  );
}
```

---

## สร้าง Agent ใหม่

### Step 1: กำหนด Trigger

```typescript
// frontend/src/components/AgentConfigForm.tsx
// ในแท็บ Trigger

const TRIGGER_PRESETS = [
  {
    id: 'custom_contract_review',
    category: 'contract',
    name: 'ตรวจสอบสัญญาก่อนอนุมัติ',
    description: 'ทำงานเมื่อส่งสัญญาเข้าอนุมัติ',
    requires_kb: true,
    requires_graphrag: false
  }
];

// เลือก Triggers ที่ต้องการ
const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
```

### Step 2: กำหนด Input

```typescript
interface InputConfig {
  // เลือกข้อมูลที่ต้องการส่งให้ AI
  document_content?: boolean;  // เนื้อหาเอกสาร (OCR)
  contract_data?: boolean;     // ข้อมูลสัญญาเต็มรูปแบบ
  vendor_history?: boolean;    // ประวัติผู้รับจ้าง
  user_query?: boolean;        // คำถามจากผู้ใช้
}

// ตัวอย่าง: Agent วิเคราะห์ผู้รับจ้าง
const inputConfig: InputConfig = {
  vendor_history: true,    // ดึงประวัติจาก GraphRAG
  contract_data: true,     // ดึงข้อมูลสัญญาเก่า
  user_query: false
};
```

### Step 3: กำหนด Output Action

```typescript
// Output Actions ที่มีให้เลือก
const OUTPUT_ACTIONS = [
  {
    value: 'show_popup',
    label: 'แสดงผลใน Modal',
    description: 'เปิดหน้าต่างแสดงผลการวิเคราะห์',
    needs_target: false
  },
  {
    value: 'save_to_field',
    label: 'บันทึกลงฟิลด์',
    description: 'บันทึกข้อมูลอัตโนมัติในฟอร์ม',
    needs_target: true,  // ต้องระบุชื่อฟิลด์
    target_label: 'ชื่อฟิลด์'
  },
  {
    value: 'create_task',
    label: 'สร้าง Task',
    description: 'สร้างงานติดตามอัตโนมัติ',
    needs_target: false
  },
  {
    value: 'send_email',
    label: 'ส่งอีเมล',
    description: 'แจ้งเตือนทางอีเมล',
    needs_target: true,
    target_label: 'อีเมลผู้รับ'
  },
  {
    value: 'update_status',
    label: 'อัพเดทสถานะ',
    description: 'เปลี่ยนสถานะอัตโนมัติ',
    needs_target: true,
    target_label: 'สถานะใหม่'
  },
  {
    value: 'call_api',
    label: 'เรียก API',
    description: 'เชื่อมต่อระบบภายนอก',
    needs_target: true,
    target_label: 'URL'
  }
];

// ตัวอย่างการใช้
const outputConfig = {
  action: 'show_popup',
  target: '',  // ไม่ต้องระบุสำหรับ popup
  format: 'json'
};

// หรือหลาย Actions
const multiOutputConfig = {
  actions: [
    { type: 'show_popup' },
    { type: 'create_task' },
    { type: 'send_email', target: 'manager@gov.th' }
  ]
};
```

---

## Trigger Integration

### Trigger แบบ Event-Driven

```typescript
// frontend/src/services/triggerService.ts

// 1. Document Upload Trigger
export async function onDocumentUpload(documentId: string, fileType: string) {
  // Trigger: doc_analyze_upload
  const triggerEvent = {
    type: 'document',
    event: 'document_upload',
    payload: { document_id: documentId, file_type: fileType },
    page: 'documents',
    timestamp: new Date().toISOString()
  };
  
  // ส่งไปยัง Trigger Router
  await triggerRouter.process(triggerEvent);
}

// 2. Contract Approval Trigger
export async function onContractSubmitForApproval(contractId: string) {
  // Trigger: contract_approve_analyze
  const triggerEvent = {
    type: 'contract',
    event: 'contract_approve_analyze',
    payload: { contract_id: contractId },
    page: 'contracts',
    timestamp: new Date().toISOString()
  };
  
  await triggerRouter.process(triggerEvent);
}

// 3. Button Click Trigger (Manual)
export async function onAnalyzeButtonClick(contractId: string, agentId: string) {
  // Trigger: contract_analyze_button
  const result = await executeAgent(agentId, {
    input: { contract_id: contractId },
    trigger_event: 'contract_analyze_button',
    trigger_page: 'contracts'
  });
  
  return result;
}
```

### Trigger Router

```typescript
// backend/app/core/trigger_router.py
class TriggerRouter:
    async def process(self, event: TriggerEvent):
        """Route trigger to appropriate agents"""
        
        # 1. หา Agents ที่ match trigger
        agents = await self.find_matching_agents(event)
        
        # 2. ตรวจสอบสิทธิ์
        allowed_agents = [
            agent for agent in agents
            if await self.check_permission(event.user_id, agent)
        ]
        
        # 3. ตรวจสอบ KB requirements
        executable_agents = []
        for agent in allowed_agents:
            if agent.requires_kb and not agent.knowledge_base_ids:
                logger.warning(f"Agent {agent.id} requires KB but none configured")
                continue
            executable_agents.append(agent)
        
        # 4. Execute agents (parallel)
        results = await asyncio.gather(*[
            self.execute_agent(agent, event)
            for agent in executable_agents
        ])
        
        return results
    
    async def find_matching_agents(self, event: TriggerEvent) -> List[Agent]:
        """Find agents that match the trigger event"""
        query = db.query(Agent).filter(
            Agent.status == 'active',
            Agent.trigger_events.contains([event.event])
        )
        
        if event.page:
            query = query.filter(
                or_(
                    Agent.trigger_pages.contains([event.page]),
                    Agent.trigger_pages == []
                )
            )
        
        return query.all()
```

---

## Output Handler

### Handler แบบ Frontend

```typescript
// frontend/src/services/outputHandlers.ts

export const outputHandlers = {
  // 1. Show Popup Handler
  async showPopup(output: AgentOutput, context: any) {
    const { openModal } = useModalStore.getState();
    
    openModal({
      title: output.agent_name,
      width: 800,
      content: (
        <AIResultPanel
          analysis={output.analysis}
          content={output.content}
          actions={output.actions}
          onAction={handleOutputAction}
        />
      )
    });
  },
  
  // 2. Save to Field Handler
  async saveToField(output: AgentOutput, context: any) {
    const action = output.actions?.find(a => a.type === 'save_to_field');
    if (!action?.target) return;
    
    // อัพเดทฟอร์ม
    const form = document.querySelector(`[name="${action.target}"]`);
    if (form) {
      form.value = JSON.stringify(action.payload);
      form.dispatchEvent(new Event('change'));
    }
    
    showToast(`บันทึกข้อมูลลง ${action.target} สำเร็จ`);
  },
  
  // 3. Create Task Handler
  async createTask(output: AgentOutput, context: any) {
    const taskData = {
      title: `[AI] ${output.agent_name}`,
      description: output.analysis?.summary || 'ตรวจสอบผลการวิเคราะห์',
      priority: mapRiskToPriority(output.analysis?.risk_level),
      related_contract: context.contract_id,
      related_vendor: context.vendor_id,
      ai_execution_id: output.execution_id,
      due_date: calculateDueDate(output.analysis?.risk_level)
    };
    
    const task = await createTask(taskData);
    showNotification('สร้างงานติดตามสำเร็จ', task.id);
    
    return task;
  },
  
  // 4. Send Email Handler
  async sendEmail(output: AgentOutput, context: any) {
    const action = output.actions?.find(a => a.type === 'send_email');
    const recipients = action?.target?.split(',') || context.notification_emails;
    
    await sendEmail({
      to: recipients,
      subject: `[AI Alert] ${output.agent_name}`,
      template: 'ai_analysis_result',
      data: {
        agent_name: output.agent_name,
        summary: output.analysis?.summary,
        risk_level: output.analysis?.risk_level,
        findings_count: output.analysis?.findings?.length,
        action_url: `${window.location.origin}/contracts/${context.contract_id}`
      }
    });
    
    showToast('ส่งอีเมลแจ้งเตือนสำเร็จ');
  }
};

// Helper functions
function mapRiskToPriority(risk?: string): string {
  const map: Record<string, string> = {
    low: 'low',
    medium: 'medium', 
    high: 'high',
    critical: 'urgent'
  };
  return map[risk] || 'medium';
}

function calculateDueDate(risk?: string): Date {
  const days = risk === 'critical' ? 1 : risk === 'high' ? 3 : 7;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}
```

### Handler แบบ Backend

```python
# backend/app/core/output_handlers.py
from typing import Dict, Any
from app.models.tasks import Task
from app.services.email import send_email

class OutputHandlerManager:
    def __init__(self):
        self.handlers: Dict[str, OutputHandler] = {
            'show_popup': ShowPopupHandler(),
            'save_to_field': SaveToFieldHandler(),
            'create_task': CreateTaskHandler(),
            'send_email': SendEmailHandler(),
            'update_status': UpdateStatusHandler(),
            'call_api': CallApiHandler()
        }
    
    async def handle(self, action: str, output: AgentOutput, context: Dict[str, Any]):
        handler = self.handlers.get(action)
        if not handler:
            raise ValueError(f"Unknown action: {action}")
        
        return await handler.execute(output, context)

class CreateTaskHandler(OutputHandler):
    async def execute(self, output: AgentOutput, context: Dict[str, Any]):
        task = Task(
            title=f"[AI] {output.agent_name}",
            description=output.analysis.summary if output.analysis else "",
            priority=self._map_risk_to_priority(
                output.analysis.risk_level if output.analysis else None
            ),
            related_contract_id=context.get('contract_id'),
            related_vendor_id=context.get('vendor_id'),
            ai_execution_id=output.execution_id,
            created_by='system'
        )
        
        db.add(task)
        db.commit()
        
        return {"task_id": task.id, "status": "created"}
    
    def _map_risk_to_priority(self, risk: str | None) -> str:
        mapping = {
            'low': 'low',
            'medium': 'medium',
            'high': 'high',
            'critical': 'urgent'
        }
        return mapping.get(risk, 'medium')

class SendEmailHandler(OutputHandler):
    async def execute(self, output: AgentOutput, context: Dict[str, Any]):
        recipients = context.get('notification_emails', [])
        
        await send_email(
            to=recipients,
            subject=f"[AI Alert] {output.agent_name}",
            template='ai_notification',
            data={
                'agent_name': output.agent_name,
                'summary': output.analysis.summary if output.analysis else '',
                'risk_level': output.analysis.risk_level if output.analysis else 'unknown',
                'action_url': context.get('action_url')
            }
        )
        
        return {"recipients": len(recipients), "status": "sent"}
```

---

## ตัวอย่าง Use Cases

### Use Case 1: วิเคราะห์สัญญาก่อนอนุมัติ

```
┌─────────────────────────────────────────────────────────────┐
│  SCENARIO: ผู้ใช้กด "ส่งอนุมัติสัญญา"                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Trigger: contract_approve_analyze                       │
│     └─▶ ดึงข้อมูลสัญญา + ผู้รับจ้าง                         │
│                                                             │
│  2. Input Builder                                           │
│     ├─▶ contract_data: {เลขที่, มูลค่า, ระยะเวลา, เงื่อนไข} │
│     ├─▶ vendor_data: {ประวัติ, คะแนน, สัญญาเก่า}           │
│     ├─▶ KB Query: กฎหมายที่เกี่ยวข้อง                        │
│     └─▶ GraphRAG: ความสัมพันธ์ vendor-contract             │
│                                                             │
│  3. LLM Processing                                          │
│     └─▶ วิเคราะห์ + ให้คะแนนความเสี่ยง                      │
│                                                             │
│  4. Output Actions                                          │
│     ├─▶ show_popup: แสดงผลวิเคราะห์                         │
│     ├─▶ create_task: ถ้า risk > 7                           │
│     └─▶ send_email: แจ้งผู้อนุมัติถ้า critical               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```typescript
// Implementation
function ContractApprovalPage() {
  const handleSubmitForApproval = async () => {
    // 1. Save contract
    await saveContract(contractData);
    
    // 2. Trigger AI analysis
    const result = await executeAgent('agent-risk-detector', {
      input: {
        contract_id: contractId,
        contract_data: contractData,
        vendor_id: vendorId
      },
      trigger_event: 'contract_approve_analyze'
    });
    
    // 3. Show result
    openAnalysisModal(result);
    
    // 4. Auto-actions based on risk
    if (result.analysis?.risk_level === 'critical') {
      await createTask({
        title: 'ตรวจสอบสัญญาด่วน - พบความเสี่ยงสูง',
        priority: 'urgent',
        assigned_to: 'legal_team'
      });
      
      await sendEmail({
        to: 'director@gov.th',
        subject: 'แจ้งเตือน: สัญญาที่ต้องตรวจสอบด่วน',
        body: `พบความเสี่ยงระดับ critical ในสัญญา ${contractId}`
      });
    }
    
    // 5. Proceed with approval flow
    await submitForApproval(contractId);
  };
  
  return (
    <Button onClick={handleSubmitForApproval}>
      ส่งอนุมัติสัญญา
    </Button>
  );
}
```

### Use Case 2: ตรวจสอบผู้รับจ้างใหม่

```
┌─────────────────────────────────────────────────────────────┐
│  SCENARIO: สร้างผู้รับจ้างใหม่                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Trigger: vendor_new_check                               │
│     └─▶ ดึงข้อมูลผู้รับจ้างที่กรอก                          │
│                                                             │
│  2. GraphRAG Query                                          │
│     ├─▶ ค้นหาใน blacklist                                   │
│     ├─▶ ค้นหาประวัติสัญญาเก่า                               │
│     └─▶ ค้นหาความสัมพันธ์กับผู้รับจ้างอื่น                 │
│                                                             │
│  3. LLM Processing                                          │
│     └─▶ วิเคราะห์ความน่าเชื่อถือ                           │
│                                                             │
│  4. Output                                                  │
│     ├─▶ ถ้าพบใน blacklist → block + alert                  │
│     ├─▶ ถ้าประวัติไม่ดี → warning + require approve        │
│     └─▶ ถ้าปกติ → allow create                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```typescript
// Implementation
function VendorCreationPage() {
  const handleCreateVendor = async (vendorData: VendorData) {
    // 1. Trigger AI check
    const result = await executeAgent('agent-vendor-checker', {
      input: {
        vendor_name: vendorData.name,
        tax_id: vendorData.tax_id,
        address: vendorData.address
      },
      trigger_event: 'vendor_new_check'
    });
    
    // 2. Handle based on result
    if (result.analysis?.blacklist_match) {
      alert('ไม่สามารถสร้างได้: พบใน blacklist');
      await createTask({
        title: `พยายามสร้างผู้รับจ้าง blacklist: ${vendorData.name}`,
        priority: 'high'
      });
      return;
    }
    
    if (result.analysis?.risk_score > 7) {
      const confirm = await confirmDialog(
        'ผู้รับจ้างมีประวัติเสี่ยง ต้องการสร้างต่อหรือไม่?'
      );
      if (!confirm) return;
    }
    
    // 3. Create vendor
    await createVendor(vendorData);
    showToast('สร้างผู้รับจ้างสำเร็จ');
  };
  
  return (
    <VendorForm onSubmit={handleCreateVendor} />
  );
}
```

### Use Case 3: แจ้งเตือนอัตโนมัติ (System Agent)

```
┌─────────────────────────────────────────────────────────────┐
│  SCENARIO: Cron Job รายสัปดาห์                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Trigger: system_weekly_report (Cron)                    │
│     └─▶ ทุกวันจันทร์ 08:00                                 │
│                                                             │
│  2. Data Collection                                         │
│     ├─▶ สัญญาใหม่สัปดาห์นี้                                │
│     ├─▶ สัญญาใกล้หมดอายุ                                   │
│     ├─▶ การจ่ายเงินที่กำลังจะถึง                            │
│     └─▶ งานที่ค้าง                                         │
│                                                             │
│  3. LLM: สรุปรายงาน                                        │
│                                                             │
│  4. Output: send_email ถึงผู้บริหาร                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```python
# backend/app/cron/weekly_report.py
from app.api.v1.agents import execute_agent

async def generate_weekly_report():
    """Generate and send weekly summary report"""
    
    # 1. Collect data
    data = {
        'new_contracts': await get_contracts_this_week(),
        'expiring_soon': await get_expiring_contracts(days=30),
        'upcoming_payments': await get_upcoming_payments(days=7),
        'pending_tasks': await get_pending_tasks()
    }
    
    # 2. Execute report agent
    result = await execute_agent(
        agent_id='agent-weekly-reporter',
        input=data,
        trigger_event='system_weekly_report'
    )
    
    # 3. Send email
    await send_email(
        to=['director@gov.th', 'manager@gov.th'],
        subject='รายงานสรุปประจำสัปดาห์',
        body=result.content.data
    )
```

---

## 📝 Checklist การสร้าง Agent

```
□ กำหนดชื่อและรายละเอียด Agent
□ เลือก AI Model (Ollama/OpenAI)
□ เขียน System Prompt ที่ชัดเจน
□ เลือก Knowledge Base ที่ต้องการ
□ เปิดใช้ GraphRAG ถ้าต้องการ (สำหรับ vendor/relationship)
□ เลือก Trigger Events ที่ต้องการ
□ กำหนด Input Schema
□ เลือก Output Action
□ กำหนดสิทธิ์การใช้งาน (Roles)
□ ทดสอบการทำงาน
```

---

**จัดทำโดย:** AI Development Team  
**Version:** 1.0  
**อัพเดทล่าสุด:** 2024-02-25
