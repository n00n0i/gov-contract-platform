# 🤖 AI Integration Architecture - Gov Contract Platform

เอกสารออกแบบระบบ AI Integration สำหรับระบบบริหารจัดการสัญญาภาครัฐ

---

## 📋 Table of Contents

1. [AI Integration Points - จุดที่ AI ช่วยได้](#1-ai-integration-points)
2. [Trigger-Agent Integration Flow](#2-trigger-agent-integration-flow)
3. [Input/Output Pipeline](#3-inputoutput-pipeline)
4. [Output Action Handlers](#4-output-action-handlers)
5. [Implementation Guide](#5-implementation-guide)

---

## 1. AI Integration Points

### 1.1 Document Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DOCUMENT AI PIPELINE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │   Upload     │───▶│     OCR      │───▶│  AI Extract  │───▶│  Verify  │  │
│  │   Document   │    │  (Tesseract) │    │   (LLM)      │    │  & Save  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────┘  │
│        │                   │                   │                  │        │
│        ▼                   ▼                   ▼                  ▼        │
│   [PDF/Image]        [Raw Text]          [Structured]       [Database]    │
│                                                                             │
│  AI Agents:                                                                 │
│  • OCR Assistant      → แปลงเอกสารสแกนเป็นข้อความ                        │
│  • Document Analyzer  → สกัดข้อมูลสำคัญ (เลขที่, วันที่, มูลค่า)          │
│  • Document Classifier → จำแนกประเภทเอกสาร                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Contract Lifecycle AI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CONTRACT LIFECYCLE AI                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   CREATE          REVIEW           APPROVE          EXECUTE      RENEW     │
│     │                │                │               │            │       │
│     ▼                ▼                ▼               ▼            ▼       │
│  ┌──────┐        ┌──────┐        ┌──────┐       ┌──────┐     ┌──────┐    │
│  │Draft │        │ Risk │        │Compliance    │Payment│     │Expiry│    │
│  │Helper│        │ Check│        │ Check │      │Track │     │Alert │    │
│  └──┬───┘        └──┬───┘        └──┬───┘       └──┬───┘     └──┬───┘    │
│     │               │               │              │            │        │
│     ▼               ▼               ▼              ▼            ▼        │
│  AI DRAFT       AI REVIEW      AI CHECK       AI TRACK      AI ALERT    │
│                                                                             │
│  Agents:                                                                    │
│  • Contract Drafter   → ช่วยร่างสัญญาจาก TOR/Requirements                │
│  • Risk Detector      → ตรวจจับความเสี่ยงก่อนอนุมัติ                      │
│  • Compliance Checker → ตรวจสอบความถูกต้องตาม พรบ. จัดซื้อจัดจ้าง       │
│  • Payment Tracker    → แจ้งเตือนกำหนดการจ่ายเงิน                         │
│  • Expiry Alert       → แจ้งเตือนสัญญาใกล้หมดอายุ 30/60/90 วัน          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Vendor Intelligence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      VENDOR INTELLIGENCE AI                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐           │
│  │  New Vendor    │───▶│  Background    │───▶│  Risk Profile  │           │
│  │  Registration  │    │  Check         │    │  Generation    │           │
│  └────────────────┘    └────────────────┘    └────────────────┘           │
│          │                    │                     │                      │
│          ▼                    ▼                     ▼                      │
│     [Input Data]        [GraphRAG Query]      [Risk Score]                │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────┐       │
│  │                    Knowledge Graph (Neo4j)                      │       │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │       │
│  │  │ Vendor  │───▶│ Contract│───▶│ Payment │───▶│  Issue  │     │       │
│  │  │ Entity  │    │ Entity  │    │ Entity  │    │ Entity  │     │       │
│  │  └─────────┘    └─────────┘    └─────────┘    └─────────┘     │       │
│  └────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  AI Agents:                                                                 │
│  • Vendor Analyzer    → วิเคราะห์ความน่าเชื่อถือจาก GraphRAG             │
│  • Blacklist Checker  → ตรวจสอบรายชื่อ blacklist                          │
│  • Document Verifier  → ตรวจสอบเอกสารผู้รับจ้างครบถ้วน                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.4 Compliance & Risk Monitoring

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLIANCE & RISK MONITORING AI                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   Rule      │  │  Contract   │  │    Risk     │  │   Anomaly   │       │
│  │  Engine     │  │   Check     │  │   Scoring   │  │  Detection  │       │
│  │             │  │             │  │             │  │             │       │
│  │ • ปีงบประมาณ │  │ • วงเงิน     │  │ • ค่าปรับ   │  │ • ราคาผิด   │       │
│  │ • วิธีการจัด │  │ • ระยะเวลา   │  │ • ระยะเวลา  │  │ ปกติ        │       │
│  │   ซื้อจัดจ้าง│  │ • เงื่อนไข   │  │ • เงื่อนไข  │  │ • เงื่อนไข  │       │
│  │ • ขั้นตอน   │  │ • หลักประกัน │  │   ผิดปกติ  │  │   แปลก      │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                │                │                │              │
│         └────────────────┴────────────────┴────────────────┘              │
│                                   │                                        │
│                                   ▼                                        │
│                         ┌─────────────────┐                               │
│                         │  Alert & Report   │                             │
│                         │  • Dashboard      │                             │
│                         │  • Notification   │                             │
│                         │  • Task Create    │                             │
│                         └─────────────────┘                               │
│                                                                             │
│  AI Agents:                                                                 │
│  • Compliance Checker → ตรวจสอบความสอดคล้อง พรบ. จัดซื้อจัดจ้าง         │
│  • Risk Detector      → ประเมินความเสี่ยงสัญญาอัตโนมัติ                   │
│  • Anomaly Detector   → ตรวจจับสัญญาที่ผิดปกติ                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Trigger-Agent Integration Flow

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TRIGGER → AGENT → ACTION FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        TRIGGER LAYER                                 │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ Document │ │ Contract │ │  Vendor  │ │  System  │ │  Button  │  │   │
│  │  │  Upload  │ │  Event   │ │  Event   │ │  Timer   │ │  Click   │  │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │   │
│  │       │            │            │            │            │         │   │
│  │       └────────────┴────────────┴────────────┴────────────┘         │   │
│  │                              │                                       │   │
│  │                              ▼                                       │   │
│  │                    ┌─────────────────┐                               │   │
│  │                    │  Trigger Router   │                               │   │
│  │                    │  (Event Bus)      │                               │   │
│  │                    └────────┬────────┘                               │   │
│  └─────────────────────────────┼──────────────────────────────────────┘   │
│                                │                                           │
│                                ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        AGENT LAYER                                   │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    Agent Matching Engine                     │   │   │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐│   │   │
│  │  │  │ Doc     │ │Contract │ │ Vendor  │ │Compliance│ │ System ││   │   │
│  │  │  │Analyzer │ │Drafter  │ │Analyzer │ │ Checker │ │ Report ││   │   │
│  │  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └───┬────┘│   │   │
│  │  │       │           │           │           │           │     │   │   │
│  │  │       └───────────┴───────────┴───────────┴───────────┘     │   │   │
│  │  │                           │                                 │   │   │
│  │  └───────────────────────────┼─────────────────────────────────┘   │   │
│  └──────────────────────────────┼─────────────────────────────────────┘   │
│                                 │                                          │
│                                 ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      PROCESSING LAYER                                │   │
│  │                                                                     │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │   │
│  │  │   Context    │───▶│    LLM       │───▶│   Output     │          │   │
│  │  │   Builder    │    │  Inference   │    │   Formatter  │          │   │
│  │  └──────────────┘    └──────────────┘    └──────────────┘          │   │
│  │         │                   │                   │                   │   │
│  │         ▼                   ▼                   ▼                   │   │
│  │    [KB Query]          [Generate]          [Validate]              │   │
│  │    [GraphRAG]          [Reasoning]         [Format]                │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                 │                                          │
│                                 ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       ACTION LAYER                                   │   │
│  │                                                                     │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │  Show    │ │  Save    │ │  Create  │ │  Send    │ │  Call    │  │   │
│  │  │  Popup   │ │  to DB   │ │  Task    │ │  Email   │ │  API     │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Trigger Types (15 Presets)

| Category | Trigger Name | Event | Input Data | Required KB |
|----------|-------------|-------|------------|-------------|
| **document** | doc_analyze_upload | อัพโหลดเอกสาร | File, OCR Text | ✅ |
| **document** | doc_ocr_scan | OCR เอกสารสแกน | Image, PDF | ❌ |
| **document** | doc_classify | จำแนกประเภทเอกสาร | Document Content | ✅ |
| **contract** | contract_analyze_button | กดปุ่มวิเคราะห์ | Contract ID | ✅ |
| **contract** | contract_create_check | สร้างสัญญาใหม่ | Contract Data | ✅ |
| **contract** | contract_approve_analyze | อนุมัติสัญญา | Contract ID, Approver | ✅ |
| **contract** | contract_expiry_alert | สัญญาใกล้หมดอายุ | Contract ID, Days Left | ❌ |
| **contract** | contract_draft_helper | ช่วยเขียนร่าง | TOR, Requirements | ✅ |
| **vendor** | vendor_new_check | ผู้รับจ้างใหม่ | Vendor Data | GraphRAG |
| **vendor** | vendor_analyze_button | กดปุ่มวิเคราะห์ | Vendor ID | GraphRAG |
| **compliance** | compliance_auto_check | ตรวจสอบอัตโนมัติ | Contract Data | ✅ |
| **compliance** | compliance_risk_assess | ประเมินความเสี่ยง | Contract Data | ✅+GraphRAG |
| **system** | system_weekly_report | รายงานประจำสัปดาห์ | - | ❌ |
| **system** | system_payment_alert | แจ้งเตือนจ่ายเงิน | Payment Schedule | ❌ |
| **system** | system_anomaly_detect | ตรวจจับความผิดปกติ | All Contracts | GraphRAG |

### 2.3 Trigger Matching Logic

```typescript
// Trigger Router Logic
interface TriggerEvent {
  id: string;
  type: 'document' | 'contract' | 'vendor' | 'compliance' | 'system';
  event: string;
  payload: any;
  timestamp: Date;
  user_id: string;
  page?: string;
}

async function routeTrigger(event: TriggerEvent): Promise<void> {
  // 1. Find matching agents
  const agents = await findAgentsByTrigger(event.type, event.event, event.page);
  
  // 2. Check permissions
  const allowedAgents = agents.filter(agent => 
    checkUserPermission(event.user_id, agent.allowed_roles)
  );
  
  // 3. Check KB requirements
  const executableAgents = allowedAgents.filter(agent => {
    if (agent.requires_kb) {
      return agent.knowledge_base_ids.length > 0;
    }
    return true;
  });
  
  // 4. Execute agents
  for (const agent of executableAgents) {
    await executeAgent(agent, event);
  }
}
```

---

## 3. Input/Output Pipeline

### 3.1 Input Schema Types

```typescript
// Input Schema Definitions
interface InputSchema {
  // Document Input
  document_content?: boolean;    // OCR text from document
  document_file?: boolean;       // File reference
  document_type?: boolean;       // PDF, Image, etc.
  
  // Contract Input
  contract_id?: boolean;         // Contract reference
  contract_data?: boolean;       // Full contract data
  contract_clauses?: boolean;    // Specific clauses
  
  // Vendor Input
  vendor_id?: boolean;           // Vendor reference
  vendor_data?: boolean;         // Full vendor data
  vendor_history?: boolean;      // Past contracts
  
  // Text Input
  text?: boolean;                // Free text input
  requirements?: boolean;        // Requirements/TOR
  
  // System Input
  trigger_context?: boolean;     // Event context
  user_context?: boolean;        // User info
  timestamp?: boolean;           // Event timestamp
}

// Input Builder
class InputBuilder {
  async build(agent: Agent, trigger: TriggerEvent): Promise<AgentInput> {
    const input: AgentInput = {
      system_prompt: agent.system_prompt,
      context: {},
      data: {}
    };
    
    // Build based on input_schema
    if (agent.input_schema.document_content) {
      input.data.document = await this.getDocumentContent(trigger.payload.document_id);
    }
    
    if (agent.input_schema.contract_data) {
      input.data.contract = await this.getContractData(trigger.payload.contract_id);
    }
    
    if (agent.input_schema.vendor_id) {
      input.data.vendor = await this.getVendorData(trigger.payload.vendor_id);
    }
    
    // Add Knowledge Base context
    if (agent.knowledge_base_ids.length > 0) {
      input.context.knowledge = await this.queryKnowledgeBases(
        agent.knowledge_base_ids,
        input.data
      );
    }
    
    // Add GraphRAG context
    if (agent.use_graphrag) {
      input.context.graph = await this.queryGraphRAG(input.data);
    }
    
    return input;
  }
}
```

### 3.2 Output Action Types

| Action | Description | Use Case | Target |
|--------|-------------|----------|--------|
| **show_popup** | แสดงผลใน Modal/Popup | แจ้งเตือน, ผลวิเคราะห์ | Frontend |
| **save_to_field** | บันทึกลงฟิลด์ในฟอร์ม | Auto-fill ข้อมูล | Form Field |
| **create_task** | สร้าง Task/To-do | ติดตามงาน | Task System |
| **send_email** | ส่งอีเมลแจ้งเตือน | แจ้งผู้เกี่ยวข้อง | Email Service |
| **call_api** | เรียก API ภายนอก | Integration | External API |
| **update_status** | อัพเดทสถานะ | เปลี่ยนสถานะอัตโนมัติ | Database |
| **notify_slack** | ส่งข้อความ Slack | แจ้งทีม | Slack API |
| **generate_report** | สร้างรายงาน | สรุปข้อมูล | Report System |

### 3.3 Output Format Standards

```typescript
// Standard Output Format
interface AgentOutput {
  // Metadata
  agent_id: string;
  agent_name: string;
  execution_id: string;
  timestamp: Date;
  duration_ms: number;
  
  // Content
  content: {
    type: 'text' | 'json' | 'markdown' | 'structured';
    data: any;
  };
  
  // Structured Output (for contract analysis)
  analysis?: {
    summary: string;
    findings: Finding[];
    recommendations: string[];
    risk_level?: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
  };
  
  // Actions to perform
  actions?: OutputAction[];
  
  // Debug info
  debug?: {
    prompt_tokens: number;
    completion_tokens: number;
    model: string;
    kb_queries: string[];
  };
}

interface Finding {
  type: 'info' | 'warning' | 'error' | 'critical';
  category: string;
  message: string;
  location?: string;
  suggestion?: string;
}

interface OutputAction {
  type: string;
  target?: string;
  payload: any;
}
```

---

## 4. Output Action Handlers

### 4.1 Handler Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     OUTPUT ACTION HANDLERS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Action Router                                     │   │
│  │                      (output_action)                                 │   │
│  └─────────────────────────────┬───────────────────────────────────────┘   │
│                                │                                           │
│           ┌────────────────────┼────────────────────┐                      │
│           │                    │                    │                      │
│           ▼                    ▼                    ▼                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │
│  │  Frontend       │  │  Backend        │  │  External       │           │
│  │  Handlers       │  │  Handlers       │  │  Services       │           │
│  │                 │  │                 │  │                 │           │
│  │ • show_popup    │  │ • save_to_field │  │ • send_email    │           │
│  │ • show_toast    │  │ • create_task   │  │ • call_api      │           │
│  │ • update_form   │  │ • update_status │  │ • notify_slack  │           │
│  │ • show_modal    │  │ • save_draft    │  │ • webhook       │           │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Handler Implementations

```typescript
// Action Handler Interface
interface ActionHandler {
  name: string;
  validate(output: AgentOutput): boolean;
  execute(output: AgentOutput, context: ActionContext): Promise<ActionResult>;
}

// Handler: show_popup
class ShowPopupHandler implements ActionHandler {
  name = 'show_popup';
  
  validate(output: AgentOutput): boolean {
    return output.content && output.content.data;
  }
  
  async execute(output: AgentOutput, context: ActionContext): Promise<ActionResult> {
    // Open modal with AI result
    return {
      success: true,
      action: 'OPEN_MODAL',
      payload: {
        title: output.agent_name,
        content: output.content,
        analysis: output.analysis,
        actions: this.buildModalActions(output.actions)
      }
    };
  }
}

// Handler: save_to_field
class SaveToFieldHandler implements ActionHandler {
  name = 'save_to_field';
  
  validate(output: AgentOutput): boolean {
    return !!output.actions?.find(a => a.target);
  }
  
  async execute(output: AgentOutput, context: ActionContext): Promise<ActionResult> {
    const action = output.actions?.find(a => a.type === 'save_to_field');
    if (!action?.target) throw new Error('No target field specified');
    
    // Update form field
    return {
      success: true,
      action: 'UPDATE_FIELD',
      payload: {
        field: action.target,
        value: action.payload
      }
    };
  }
}

// Handler: create_task
class CreateTaskHandler implements ActionHandler {
  name = 'create_task';
  
  async execute(output: AgentOutput, context: ActionContext): Promise<ActionResult> {
    const task = await createTask({
      title: `[AI] ${output.agent_name}`,
      description: output.analysis?.summary || output.content.data,
      priority: this.mapRiskToPriority(output.analysis?.risk_level),
      assigned_by: 'system',
      related_contract: context.contract_id,
      related_vendor: context.vendor_id,
      ai_execution_id: output.execution_id
    });
    
    return {
      success: true,
      action: 'TASK_CREATED',
      payload: { task_id: task.id }
    };
  }
  
  private mapRiskToPriority(risk?: string): string {
    const map = { low: 'low', medium: 'medium', high: 'high', critical: 'urgent' };
    return map[risk] || 'medium';
  }
}

// Handler: send_email
class SendEmailHandler implements ActionHandler {
  name = 'send_email';
  
  async execute(output: AgentOutput, context: ActionContext): Promise<ActionResult> {
    const recipients = context.notification_emails || [];
    
    await sendEmail({
      to: recipients,
      subject: `[AI Alert] ${output.agent_name}`,
      template: 'ai_notification',
      data: {
        agent_name: output.agent_name,
        summary: output.analysis?.summary,
        findings: output.analysis?.findings,
        timestamp: output.timestamp,
        action_url: context.action_url
      }
    });
    
    return {
      success: true,
      action: 'EMAIL_SENT',
      payload: { recipients: recipients.length }
    };
  }
}

// Handler: call_api
class CallApiHandler implements ActionHandler {
  name = 'call_api';
  
  async execute(output: AgentOutput, context: ActionContext): Promise<ActionResult> {
    const action = output.actions?.find(a => a.type === 'call_api');
    if (!action?.payload?.url) throw new Error('No API URL specified');
    
    const response = await fetch(action.payload.url, {
      method: action.payload.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...action.payload.headers
      },
      body: JSON.stringify({
        ...action.payload.body,
        ai_output: output.content.data,
        execution_id: output.execution_id
      })
    });
    
    return {
      success: response.ok,
      action: 'API_CALLED',
      payload: { 
        status: response.status,
        response: await response.json().catch(() => null)
      }
    };
  }
}
```

### 4.3 Frontend Integration

```typescript
// Frontend Action Handler
class FrontendActionHandler {
  private handlers: Map<string, ActionHandler> = new Map();
  
  registerHandler(handler: ActionHandler) {
    this.handlers.set(handler.name, handler);
  }
  
  async handleAction(output: AgentOutput, context: ActionContext) {
    const action = output.actions?.[0];
    if (!action) return;
    
    const handler = this.handlers.get(action.type);
    if (!handler) {
      console.warn(`No handler for action: ${action.type}`);
      return;
    }
    
    try {
      const result = await handler.execute(output, context);
      this.dispatchToUI(result);
    } catch (error) {
      this.handleError(error, output);
    }
  }
  
  private dispatchToUI(result: ActionResult) {
    switch (result.action) {
      case 'OPEN_MODAL':
        openModal(result.payload);
        break;
      case 'UPDATE_FIELD':
        updateFormField(result.payload.field, result.payload.value);
        break;
      case 'SHOW_TOAST':
        showToast(result.payload);
        break;
      case 'TASK_CREATED':
        showNotification('Task Created', result.payload.task_id);
        break;
      // ... more actions
    }
  }
}

// Usage in React
function useAIAgent() {
  const handleAgentOutput = async (output: AgentOutput) => {
    const handler = new FrontendActionHandler();
    
    handler.registerHandler(new ShowPopupHandler());
    handler.registerHandler(new SaveToFieldHandler());
    handler.registerHandler(new CreateTaskHandler());
    
    await handler.handleAction(output, {
      contract_id: currentContract?.id,
      vendor_id: currentVendor?.id,
      user_id: currentUser?.id
    });
  };
  
  return { handleAgentOutput };
}
```

---

## 5. Implementation Guide

### 5.1 Database Schema

```sql
-- Agent Execution Log
CREATE TABLE agent_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES ai_agents(id),
    trigger_event VARCHAR(100),
    trigger_page VARCHAR(100),
    input_data JSONB,
    output_data JSONB,
    actions_taken JSONB,
    status VARCHAR(50),
    error_message TEXT,
    duration_ms INTEGER,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Output Action Results
CREATE TABLE action_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES agent_executions(id),
    action_type VARCHAR(100),
    action_target VARCHAR(255),
    payload JSONB,
    result JSONB,
    status VARCHAR(50),
    error_message TEXT,
    executed_at TIMESTAMP DEFAULT NOW()
);

-- Trigger Event Queue
CREATE TABLE trigger_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100),
    event_data JSONB,
    page VARCHAR(100),
    user_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending',
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 5.2 API Endpoints

```typescript
// Agent Execution API
POST   /api/v1/agents/{agent_id}/execute        // Execute agent manually
GET    /api/v1/agents/executions                // List execution history
GET    /api/v1/agents/executions/{execution_id} // Get execution details
POST   /api/v1/agents/triggers/webhook          // Webhook for external triggers
GET    /api/v1/agents/actions/results           // Get action results

// Trigger Management
GET    /api/v1/agents/triggers/templates        // List trigger templates
POST   /api/v1/agents/triggers/register         // Register custom trigger
POST   /api/v1/agents/triggers/test             // Test trigger
```

### 5.3 Configuration Example

```json
{
  "agent": {
    "name": "Contract Risk Analyzer",
    "description": "วิเคราะห์ความเสี่ยงในสัญญาก่อนอนุมัติ",
    "model": "gpt-4",
    "model_config": {
      "temperature": 0.3,
      "max_tokens": 4000
    },
    "system_prompt": "คุณเป็นผู้เชี่ยวชาญด้านความเสี่ยง...",
    "knowledge_base_ids": ["kb-regulations", "kb-templates"],
    "use_graphrag": true,
    "trigger_events": ["contract_approve_analyze"],
    "trigger_pages": ["contracts"],
    "input_schema": {
      "contract_data": true,
      "vendor_id": true
    },
    "output_action": "show_popup",
    "output_format": "json",
    "allowed_roles": ["admin", "contract_manager", "approver"]
  }
}
```

### 5.4 Usage Flow Example

```
1. User อัพโหลดสัญญา PDF
   ↓
2. Trigger: document_upload → doc_analyze_upload
   ↓
3. Agent Router เลือก Agents:
   - Document Analyzer (requires KB)
   - OCR Assistant
   ↓
4. Input Builder รวบรวม:
   - OCR text from PDF
   - Query KB: แม่แบบเอกสาร
   ↓
5. LLM Processing:
   - Analyze content
   - Extract entities
   - Find risks
   ↓
6. Output Handler:
   - show_popup: แสดงผลวิเคราะห์
   - save_to_field: บันทึกข้อมูลที่สกัดได้
   - create_task: สร้างงานตรวจสอบถ้าพบความเสี่ยง
   ↓
7. User ดูผลใน Modal พร้อม Actions:
   - บันทึกข้อมูล
   - แก้ไขสัญญา
   - ส่งให้ผู้อนุมัติ
```

---

## 📎 Appendix

### A. Trigger Preset Full List

| ID | Name | Category | Description | Requires | Output |
|----|------|----------|-------------|----------|--------|
| doc_analyze_upload | วิเคราะห์เอกสารอัตโนมัติ | document | วิเคราะห์เอกสารทันทีเมื่ออัพโหลด | KB | popup |
| doc_ocr_scan | OCR เอกสารสแกน | document | แปลง PDF/รูปภาพเป็นข้อความ | - | save_field |
| doc_classify | จำแนกประเภทเอกสาร | document | จำแนกสัญญา/TOR/ใบเสนอราคา | KB | save_field |
| contract_analyze_button | วิเคราะห์สัญญา (กดปุ่ม) | contract | กดปุ่มวิเคราะห์ในหน้าสัญญา | KB | popup |
| contract_create_check | ตรวจสอบตอนสร้างสัญญา | contract | ตรวจสอบความถูกต้องตอนสร้าง | KB | popup |
| contract_approve_analyze | วิเคราะห์ก่อนอนุมัติ | contract | วิเคราะห์ความเสี่ยงก่อนอนุมัติ | KB+GraphRAG | popup+task |
| contract_expiry_alert | แจ้งเตือนหมดอายุ | contract | แจ้งเตือน 30/60/90 วันก่อนหมด | - | email+task |
| contract_draft_helper | ช่วยเขียนร่างสัญญา | contract | ร่างสัญญาจาก TOR | KB | save_field |
| vendor_new_check | ตรวจสอบผู้รับจ้างใหม่ | vendor | ตรวจ blacklist/ประวัติ | GraphRAG | popup |
| vendor_analyze_button | วิเคราะห์ผู้รับจ้าง | vendor | วิเคราะห์ความน่าเชื่อถือ | GraphRAG | popup |
| compliance_auto_check | ตรวจสอบ compliance | compliance | ตรวจสอบอัตโนมัติ | KB | popup+task |
| compliance_risk_assess | ประเมินความเสี่ยง | compliance | ประเมินและแจ้งเตือน | KB+GraphRAG | task+email |
| system_weekly_report | สรุปรายงานสัปดาห์ | system | ส่งอีเมลสรุปประจำสัปดาห์ | - | email |
| system_payment_alert | แจ้งเตือนจ่ายเงิน | system | แจ้งกำหนดการจ่ายเงิน | - | email+task |
| system_anomaly_detect | ตรวจจับความผิดปกติ | system | ตรวจสัญญาผิดปกติ | GraphRAG | task+email |

### B. Action Priority Matrix

| Risk Level | Action Chain |
|------------|-------------|
| Low | popup → save_field |
| Medium | popup → save_field → create_task |
| High | popup → save_field → create_task → send_email |
| Critical | popup → save_field → create_task → send_email → notify_slack |

---

**จัดทำโดย:** AI Integration Design Team  
**Version:** 1.0  
**Last Updated:** 2024-02-25
