# System Specification Document

> Gov Contract Platform - ระบบบริหารจัดการสัญญาภาครัฐ

**Version**: 2.0  
**Date**: กุมภาพันธ์ 2026  
**Author**: n00n0i

---

## สารบัญ

1. [บทนำ](#บทนำ)
2. [ภาพรวมระบบ](#ภาพรวมระบบ)
3. [Functional Requirements](#functional-requirements)
4. [Non-Functional Requirements](#non-functional-requirements)
5. [System Architecture](#system-architecture)
6. [Data Models](#data-models)
7. [API Specifications](#api-specifications)
8. [Security Requirements](#security-requirements)
9. [Deployment](#deployment)

---

## บทนำ

### 1.1 วัตถุประสงค์

เอกสารนี้กำหนด仕仕样 (Specification) ของระบบบริหารจัดการสัญญาภาครัฐ (Gov Contract Management Platform) ซึ่งเป็นระบบแบบครบวงจรที่ช่วยให้หน่วยงานราชการสามารถจัดการสัญญาต่างๆ ได้อย่างมีประสิทธิภาพ ตั้งแต่การสร้างสัญญา การติดตามความคืบหน้า การจัดการเอกสาร ไปจนถึงการวิเคราะห์ด้วย AI

### 1.2 ขอบเขต

ระบบครอบคลุม:

- การจัดการสัญญา (Contract Management)
- การจัดการผู้รับจ้าง (Vendor Management)
- การจัดการเอกสาร (Document Management)
- การจัดการเทมเพลต (Template Management)
- การวิเคราะห์ด้วย AI และ OCR (AI & OCR)
- Knowledge Base และ RAG (Knowledge Base & RAG)
- การแจ้งเตือน (Notifications)
- การรายงาน (Reports)
- การจัดการ Agent (Agent Management)

### 1.3 กลุ่มผู้ใช้งาน

| ผู้ใช้งาน | บทบาท | ความต้องการหลัก |
|-----------|--------|-----------------|
| เจ้าหน้าที่จัดการสัญญา | Contract Manager | สร้าง/แก้ไขสัญญา, ติดตามความคืบหน้า |
| ผู้บริหารหน่วยงาน | Executive | ดูภาพรวม, รายงาน, การอนุมัติ |
| ผู้รับจ้าง/คู่สัญญา | Vendor | ดูข้อมูลสัญญา, อัปโหลดเอกสาร |
| เจ้าหน้าที่ IT | IT Admin | ดูแลระบบ, การตั้งค่า |

---

## ภาพรวมระบบ

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client Layer                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │   Web App    │  │  Mobile App  │  │  Third-Party │  │   CLI      │  │
│  │   (React)    │  │   (Future)   │  │     APIs     │  │  (Future)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Gateway Layer (Nginx)                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  • SSL Termination                                              │   │
│  │  • Rate Limiting                                                │   │
│  │  • Load Balancing                                               │   │
│  │  • Static File Serving                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Application Layer (FastAPI)                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐          │
│  │   Auth     │ │  Contract  │ │   Vendor   │ │  Document  │          │
│  │  Module    │ │  Module    │ │  Module    │ │  Module    │          │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐          │
│  │     AI     │ │    KB      │ │   Agent    │ │  Report    │          │
│  │  Module    │ │  Module    │ │  Module    │ │  Module    │          │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Service Layer                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │    Redis     │  │   Celery     │  │   Celery     │  │    AI      │  │
│  │   (Cache)    │  │   Worker     │  │    Beat      │  │  Services  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Data Layer                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  PostgreSQL  │  │    Neo4j     │  │    MinIO     │  │Elasticsearch│ │
│  │  (Primary)   │  │   (Graph)    │  │  (Object)    │  │  (Search)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
User Request → Nginx → FastAPI → Service Layer → Database
                    ↓         ↓
                Validation  Business Logic
                    ↓         ↓
                Response    Background Task (Celery)
```

---

## Functional Requirements

### 3.1 Contract Management

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| CM-001 | สร้างสัญญาใหม่พร้อมข้อมูลครบถ้วน | Must Have | ✅ |
| CM-002 | แก้ไขและอัปเดตสัญญา | Must Have | ✅ |
| CM-003 | เปลี่ยนสถานะสัญญา (Workflow) | Must Have | ✅ |
| CM-004 | ค้นหาและกรองสัญญา | Must Have | ✅ |
| CM-005 | แจ้งเตือนสัญญาใกล้หมดอายุ | Must Have | ✅ |
| CM-006 | อัปโหลดและจัดการเอกสารแนบ | Must Have | ✅ |
| CM-007 | ติดตามการจ่ายเงิน | Should Have | ✅ |
| CM-008 | Template สัญญาสำเร็จรูป | Should Have | ✅ |
| CM-009 | ประวัติการแก้ไขสัญญา | Nice to Have | ✅ |
| CM-010 | การแก้ไขสัญญา (Amendment) | Nice to Have | 🚧 |

### 3.2 Vendor Management

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| VM-001 | สร้างทะเบียนผู้รับจ้าง | Must Have | ✅ |
| VM-002 | ตรวจสอบและยืนยันอีเมล | Must Have | ✅ |
| VM-003 | ระบบแบล็คลิสต์ | Must Have | ✅ |
| VM-004 | ประวัติการทำสัญญา | Should Have | ✅ |
| VM-005 | คะแนนความน่าเชื่อถือ | Nice to Have | 🚧 |
| VM-006 | เอกสารประกอบผู้รับจ้าง | Should Have | ✅ |

### 3.3 Document Management

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| DM-001 | อัปโหลดเอกสาร (PDF, DOCX, รูปภาพ) | Must Have | ✅ |
| DM-002 | จัดเก็บเอกสารแบบ Encrypted | Must Have | ✅ |
| DM-003 | Preview เอกสารในระบบ | Must Have | ✅ |
| DM-004 | จัดการเวอร์ชันเอกสาร | Should Have | ✅ |
| DM-005 | ค้นหาเอกสาร | Should Have | ✅ |

### 3.4 AI & OCR

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| AI-001 | OCR ถอดความเอกสาร PDF/รูปภาพ | Must Have | ✅ |
| AI-002 | แยกข้อมูลสำคัญอัตโนมัติ | Must Have | ✅ |
| AI-003 | สร้าง Template จากเอกสาร | Should Have | ✅ |
| AI-004 | วิเคราะห์ความเสี่ยงในสัญญา | Nice to Have | ✅ |
| AI-005 | Chatbot ถามตอบเอกสาร | Should Have | ✅ |
| AI-006 | แปลภาษาอัตโนมัติ | Nice to Have | 🚧 |

### 3.5 Knowledge Base & RAG

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| KB-001 | อัปโหลดเอกสารเข้า KB | Must Have | ✅ |
| KB-002 | ค้นหาเชิงความหมาย | Must Have | ✅ |
| KB-003 | Chat Interface | Must Have | ✅ |
| KB-004 | GraphRAG - ความสัมพันธ์ | Should Have | ✅ |
| KB-005 | Entity Extraction | Should Have | ✅ |

### 3.6 Agent Management

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| AG-001 | สร้าง AI Agent แบบกำหนดเอง | Must Have | ✅ |
| AG-002 | ตั้งค่า Trigger Events | Must Have | ✅ |
| AG-003 | กำหนด Output Actions | Must Have | ✅ |
| AG-004 | จัดการ Knowledge Base | Should Have | ✅ |
| AG-005 | ติดตาม Execution Stats | Should Have | ✅ |

### 3.7 Notifications

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| NT-001 | แจ้งเตือนสัญญาใกล้หมดอายุ | Must Have | ✅ |
| NT-002 | แจ้งเตือนการอนุมัติสัญญา | Must Have | ✅ |
| NT-003 | แจ้งเตือนการชำระเงิน | Should Have | ✅ |
| NT-004 | จัดการ Recipients | Should Have | ✅ |
| NT-005 | ประวัติการส่งแจ้งเตือน | Nice to Have | ✅ |

### 3.8 Reports

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| RP-001 | รายงานสรุปภาพรวมสัญญา | Must Have | ✅ |
| RP-002 | รายงานสัญญาใกล้หมดอายุ | Must Have | ✅ |
| RP-003 | รายงานความเสี่ยง | Should Have | ✅ |
| RP-004 | รายงานการใช้งาน AI | Should Have | ✅ |
| RP-005 | Export รายงาน (PDF, Excel) | Nice to Have | ✅ |

---

## Non-Functional Requirements

### 4.1 Performance

| Requirement | Target |
|-------------|--------|
| Response Time (API) | < 200ms (95th percentile) |
| Page Load Time | < 3s |
| Search Response | < 2s |
| Concurrent Users | 1,000+ |
| Database Queries | Optimized with proper indexing |

### 4.2 Security

| Requirement | Description |
|-------------|-------------|
| Authentication | JWT-based authentication |
| Authorization | Role-based access control (RBAC) |
| Data Encryption | AES-256 at rest, TLS 1.3 in transit |
| Audit Logging | All critical operations logged |
| Input Validation | Server-side validation on all inputs |
| SQL Injection Protection | Parameterized queries |
| XSS Protection | Input sanitization, CSP headers |

### 4.3 Availability

| Requirement | Target |
|-------------|--------|
| Uptime | 99.9% |
| Backup | Daily incremental, weekly full |
| Disaster Recovery | RTO: 4h, RPO: 24h |

### 4.4 Scalability

| Requirement | Description |
|-------------|-------------|
| Horizontal Scaling | Stateless application, load balancer ready |
| Database Scaling | Read replicas, connection pooling |
| Caching | Redis for session and query caching |

### 4.5 Usability

| Requirement | Description |
|-------------|-------------|
| Responsive Design | Mobile-first, works on all devices |
| Accessibility | WCAG 2.1 AA compliant |
| Internationalization | Thai and English support |
| Dark Mode | Optional dark theme |

---

## System Architecture

### 5.1 Frontend Architecture

```
React 18 + TypeScript
├── Components
│   ├── Layout (Header, Sidebar, Footer)
│   ├── Contract (List, Detail, Create, Edit)
│   ├── Vendor (List, Detail, Create, Edit)
│   ├── Document (Upload, Preview, List)
│   ├── Agent (Config, List, Execution)
│   ├── Notification (Dropdown, Settings)
│   └── Report (Charts, Tables)
├── Services
│   ├── AuthService
│   ├── ContractService
│   ├── VendorService
│   ├── DocumentService
│   ├── AgentService
│   └── NotificationService
├── Hooks
│   ├── useAuth
│   ├── useContracts
│   ├── useVendor
│   └── useAIAgent
└── State Management
    ├── React Query (Server State)
    ├── Context API (Client State)
    └── LocalStorage (Persistent State)
```

### 5.2 Backend Architecture

```
FastAPI (Python 3.11)
├── API Layer (routers/)
│   ├── auth.py
│   ├── contracts.py
│   ├── vendors.py
│   ├── documents.py
│   ├── agents.py
│   ├── notifications.py
│   ├── reports.py
│   └── settings.py
├── Service Layer (services/)
│   ├── contract_service.py
│   ├── vendor_service.py
│   ├── document_service.py
│   ├── agent/
│   │   └── trigger_service.py
│   ├── ai/
│   │   ├── llm_service.py
│   │   └── rag_service.py
│   └── notification_service.py
├── Models (models/)
│   ├── contract.py
│   ├── vendor.py
│   ├── document.py
│   ├── ai_models.py
│   ├── notification_models.py
│   └── trigger_models.py
├── Database (db/)
│   ├── database.py (SQLAlchemy)
│   └── alembic/ (Migrations)
└── Utils (utils/)
    ├── security.py
    ├── logging.py
    └── helpers.py
```

### 5.3 Database Architecture

```
PostgreSQL (Primary)
├── users
├── organizations
├── contracts
├── contract_versions
├── vendors
├── documents
├── ai_providers
├── ai_agents
├── agent_executions
├── agent_triggers
├── notifications
├── notification_recipients
├── templates
├── knowledge_bases
├── graph_entities
└── graph_relationships

Neo4j (Graph Database)
├── Contract Nodes
├── Vendor Nodes
├── Document Nodes
├── Entity Nodes (Person, Organization)
└── Relationship Types

MinIO (Object Storage)
├── contracts/
├── documents/
├── templates/
└── backups/

Elasticsearch (Search)
├── contract_index
├── document_index
└── vendor_index
```

---

## Data Models

### 6.1 Core Entities

#### User
```python
{
    "id": "uuid",
    "email": "string",
    "password_hash": "string",
    "first_name": "string",
    "last_name": "string",
    "role": "admin|manager|user|vendor",
    "organization_id": "uuid",
    "is_active": "boolean",
    "created_at": "datetime",
    "updated_at": "datetime"
}
```

#### Contract
```python
{
    "id": "uuid",
    "contract_number": "string",
    "title": "string",
    "description": "text",
    "vendor_id": "uuid",
    "status": "draft|pending|active|expired|cancelled",
    "contract_type": "procurement|service|construction|consulting",
    "start_date": "date",
    "end_date": "date",
    "value": "decimal",
    "currency": "string",
    "payment_terms": "text",
    "penalty_terms": "text",
    "termination_terms": "text",
    "governance_terms": "text",
    "documents": "array",
    "created_by": "uuid",
    "created_at": "datetime",
    "updated_at": "datetime"
}
```

#### Vendor
```python
{
    "id": "uuid",
    "name": "string",
    "registration_number": "string",
    "tax_id": "string",
    "address": "text",
    "contact_person": "string",
    "email": "string",
    "phone": "string",
    "bank_account": "string",
    "bank_name": "string",
    "is_blacklisted": "boolean",
    "blacklist_reason": "text",
    "rating": "float",
    "created_at": "datetime",
    "updated_at": "datetime"
}
```

#### Document
```python
{
    "id": "uuid",
    "contract_id": "uuid",
    "file_name": "string",
    "file_path": "string",
    "file_size": "integer",
    "file_type": "string",
    "upload_date": "datetime",
    "uploaded_by": "uuid",
    "version": "integer",
    "is_primary": "boolean"
}
```

### 6.2 AI & Agent Entities

#### AI Provider
```python
{
    "id": "string",
    "name": "string",
    "provider_type": "openai|ollama|anthropic",
    "api_key": "encrypted_string",
    "base_url": "string",
    "is_active": "boolean",
    "created_at": "datetime"
}
```

#### AI Agent
```python
{
    "id": "uuid",
    "name": "string",
    "description": "text",
    "provider_id": "string",
    "model_config": "json",
    "system_prompt": "text",
    "knowledge_base_ids": "array",
    "use_graphrag": "boolean",
    "trigger_events": "array",
    "trigger_pages": "array",
    "input_schema": "json",
    "output_action": "string",
    "output_target": "string",
    "output_format": "string",
    "allowed_roles": "array",
    "status": "active|paused|error",
    "execution_count": "integer",
    "last_executed_at": "datetime",
    "created_by": "uuid",
    "created_at": "datetime"
}
```

#### Agent Execution
```python
{
    "id": "uuid",
    "agent_id": "uuid",
    "input_data": "json",
    "output_data": "json",
    "status": "pending|running|completed|failed",
    "execution_time": "integer",
    "error_message": "text",
    "created_at": "datetime"
}
```

---

## API Specifications

### 7.1 Authentication

#### POST /api/v1/auth/login
```json
Request:
{
    "email": "string",
    "password": "string"
}

Response (200):
{
    "access_token": "string",
    "token_type": "bearer",
    "user": {
        "id": "uuid",
        "email": "string",
        "role": "string"
    }
}
```

#### POST /api/v1/auth/refresh
```json
Response (200):
{
    "access_token": "string",
    "token_type": "bearer"
}
```

### 7.2 Contracts

#### GET /api/v1/contracts
```json
Query Params:
- page: int (default: 1)
- limit: int (default: 20)
- status: string
- vendor_id: uuid
- search: string
- sort_by: string
- sort_order: asc|desc

Response (200):
{
    "items": [],
    "total": 0,
    "page": 1,
    "limit": 20
}
```

#### POST /api/v1/contracts
```json
Request:
{
    "contract_number": "string",
    "title": "string",
    "description": "string",
    "vendor_id": "uuid",
    "status": "draft",
    "contract_type": "procurement",
    "start_date": "2026-02-01",
    "end_date": "2027-02-01",
    "value": 1000000,
    "currency": "THB",
    "payment_terms": "...",
    "documents": []
}

Response (201):
{
    "id": "uuid",
    ...
}
```

### 7.3 AI Agents

#### GET /api/v1/agents
```json
Response (200):
{
    "items": [],
    "total": 0
}
```

#### POST /api/v1/agents
```json
Request:
{
    "name": "string",
    "description": "string",
    "provider_id": "string",
    "model_config": {},
    "system_prompt": "string",
    "knowledge_base_ids": [],
    "trigger_events": [],
    "trigger_pages": [],
    "input_schema": {},
    "output_action": "string",
    "allowed_roles": []
}

Response (201):
{
    "id": "uuid",
    ...
}
```

#### POST /api/v1/agents/{agent_id}/execute
```json
Request:
{
    "input": {},
    "context": {}
}

Response (200):
{
    "execution_id": "uuid",
    "status": "pending|running",
    "output": {}
}
```

### 7.4 Notifications

#### GET /api/v1/notifications
```json
Response (200):
{
    "items": [],
    "unread_count": 0
}
```

#### PUT /api/v1/notifications/{id}/read
```json
Response (200):
{
    "success": true
}
```

---

## Security Requirements

### 8.1 Authentication

- JWT-based authentication with refresh tokens
- Token expiration: 1 hour (access), 7 days (refresh)
- Secure token storage: HTTP-only cookies
- Password hashing: bcrypt with cost factor 12

### 8.2 Authorization

- Role-based access control (RBAC)
- Roles: admin, manager, user, vendor
- Permission checks on all API endpoints
- Organization-level isolation

### 8.3 Data Protection

- AES-256 encryption for sensitive data
- TLS 1.3 for all communications
- Input validation on all endpoints
- SQL injection prevention via parameterized queries
- XSS protection via content sanitization

### 8.4 Audit Logging

- Log all authentication attempts
- Log all data modifications
- Log all API access
- Retention: 1 year

---

## Deployment

### 9.1 Environment Requirements

| Component | Requirement |
|-----------|-------------|
| Python | 3.11+ |
| Node.js | 18+ |
| PostgreSQL | 14+ |
| Redis | 6+ |
| Neo4j | 5+ |
| MinIO | Latest |

### 9.2 Docker Configuration

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=...
      - REDIS_URL=...
    depends_on:
      - postgres
      - redis
  
  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend
  
  postgres:
    image: postgres:14
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:6
    ports:
      - "6379:6379"
  
  neo4j:
    image: neo4j:5
    ports:
      - "7474:7474"
      - "7687:7687"
    volumes:
      - neo4j_data:/data

volumes:
  postgres_data:
  neo4j_data:
```

### 9.3 CI/CD Pipeline

```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Python
        uses: actions/setup-python@v4
      - name: Install dependencies
        run: pip install -r backend/requirements.txt
      - name: Run tests
        run: pytest
  
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker images
        run: docker-compose build
      - name: Push to registry
        run: docker-compose push
```

---

## Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| Contract | ข้อตกลงระหว่างหน่วยงานราชการกับผู้รับจ้าง |
| Vendor | ผู้รับจ้างหรือคู่สัญญา |
| OCR | Optical Character Recognition - ถอดความข้อความจากภาพ |
| RAG | Retrieval-Augmented Generation - ระบบ AI ที่อ้างอิงข้อมูลจากฐานความรู้ |
| Agent | AI Agent - ตัวแทนอัจฉริยะที่ทำงานอัตโนมัติ |
| Trigger | เหตุการณ์ที่ทำให้ Agent ทำงาน |
| Output Action | การกระทำหลังจาก Agent ประมวลผลเสร็จ |

### B. References

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Neo4j Documentation](https://neo4j.com/docs/)

---

*Document Version: 2.0 | Last Updated: กุมภาพันธ์ 2026*
