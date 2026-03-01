# Gov Contract Platform — Development Status

> Last updated: 2026-03-01

---

## ✅ Completed Features

### Authentication & Identity
- JWT-based login/logout (`POST /api/v1/auth/login`)
- User profile management
- 2FA support (`twofa.py` API)
- Role-based access control (`access_control.py`)

### Organization Management
- Departments & Divisions CRUD
- Org chart component (`OrgChart.tsx`)
- Org structure APIs (`organization.py`)

### Vendor Management
- Vendor CRUD (create, list, detail, edit)
- Vendor document attachments
- Vendor pages: `Vendors.tsx`, `VendorDetail.tsx`, `CreateVendor.tsx`

### Contract Management
- Contract CRUD with soft-delete
- Status workflow: `draft → pending_review → pending_approval → approved → active → completed/terminated/cancelled/expired`
- Contract types: construction, consulting, procurement, service, supply, research, maintenance, software, other
- Classification levels: S1–S5
- Parent/amendment linking (`parent_contract_id`, `is_amendment`)
- Audit log model (`ContractAuditLog`)
- Contract pages: `Contracts.tsx`, `CreateContract.tsx`

### Document Upload (3-step wizard)
- Step 1: Select existing contract or create new inline
- Step 2: Upload file + choose LLM/OCR config → calls `POST /documents/ocr-preview` (MinIO temp storage, no DB write)
- Step 3: Review LLM-extracted fields → "บันทึก" → `POST /documents/confirm` (creates `ContractAttachment`, updates `Contract`, queues async tasks)
- OCR via Tesseract + LLM field extraction (contract number, value, dates, parties)
- `DocumentUpload.tsx` frontend page

### Template Management
- Contract template CRUD
- `CreateTemplate.tsx` / `CreateTemplatePage.tsx`
- Template service (`templateService.ts`)

### AI / RAG Pipeline
- **Vector RAG** — document chunking, embedding, pgvector search via Celery task (`document.py`)
- **GraphRAG (Contracts)** — entity + relationship extraction from contract documents, stored in Neo4j with label `[:Entity:Contracts]`
- Entities: `contract_number`, `money`, `project`, `start_date`, `end_date`, `org`, `person`, `counterparty`, `party`, `unknown`
- Graph visualization at `/graph/contracts/visualization` rendered in `GraphVisualization.tsx`
- AI provider settings (Ollama, OpenAI-compatible) configurable in Settings

### Knowledge Base (KB)
- User-managed Knowledge Bases
- KB document upload + vector indexing (Celery task `kb_document.py`)
- KB GraphRAG — entities stored with label `[:Entity:Kb]`; graph at `/graph/kb/visualization`
- KB document re-process button
- `KnowledgeBases.tsx` frontend page

### Chat / AI Assistant
- Chat sidebar component (`ChatSidebar.tsx`)
- Chat API (`chat.py`) — context-aware conversation against contract + KB embeddings
- Agent config form (`AgentConfigForm.tsx`)
- Agent API (`agents.py`)

### Notification System (In-App)
- `NotificationLog`, `GlobalNotification`, `UserNotificationSetting`, `UserNotificationDigest` models
- SMTP settings model (`SMTPSettings`)
- In-app notification dropdown (`NotificationDropdown.tsx`)
- Notification settings UI (`NotificationSettings.tsx`, `NotificationRecipients.tsx`)
- Notification API (`notifications.py`, `notification_recipients.py`)
- Celery notification task (`notification.py`)
- Trigger management UI (`TriggerManagement.tsx`, `TriggerPresetSelector.tsx`)
- Trigger models (`trigger_models.py`, `trigger_presets.py`)

### Dashboard
- Contract counts by status
- Total contract value
- Expiring-soon alerts
- `Dashboard.tsx`

### Settings
- AI provider configuration
- GraphRAG visualization tab
- SMTP / notification settings
- `Settings.tsx`

---

## 🔄 Partial / In Progress

### Contract Milestones
| Layer | Status |
|-------|--------|
| DB model (`ContractMilestone`) | ✅ Done — `milestone_no`, `title`, `planned_date`, `actual_date`, `percentage`, `amount`, `status` |
| API endpoints | ❌ Not implemented |
| Frontend UI | ❌ Not implemented |

### Contract Payments
| Layer | Status |
|-------|--------|
| DB model (`ContractPayment`) | ✅ Done — `payment_no`, `invoice_no`, `amount_requested/approved/paid`, `withholding_tax`, `vat`, `status`, `paid_date` |
| API endpoints | ❌ Not implemented |
| Frontend UI | ❌ Not implemented |

### Contract Changes / Amendments
| Layer | Status |
|-------|--------|
| DB model (`ContractChange`) | ✅ Done — `change_type`, `value_before/after`, `end_date_before/after`, `approval flow` |
| API endpoints | ❌ Not implemented |
| Frontend UI | ❌ Not implemented |

### Report Export
| Layer | Status |
|-------|--------|
| Celery task stubs (`report.py`) | ✅ Stubbed — `generate_monthly_report`, `export_contract_data` |
| Actual PDF/Excel generation | ❌ TODO comment in code |
| Frontend Reports page | ⚠️ Basic shell (`Reports.tsx`) — no real export |

### Email Notifications
| Layer | Status |
|-------|--------|
| SMTP settings model + API | ✅ Done |
| Notification channel config (in-app / email / both) | ✅ Done |
| Actual email dispatch in Celery task | ⚠️ Partially implemented — check `notification.py` |
| Line notification | ❌ Not started |

---

## ⏳ Planned / Not Started

- **Milestone & Progress UI** — view milestone list per contract, mark milestone complete, record actual date
- **Payment tracking UI** — record invoices, approvals, payment dates per contract
- **Amendment/change workflow UI** — submit change request, approve/reject, update contract value + end date
- **PDF / Excel report export** — monthly summary, per-contract detail, export-to-file button
- **Line Notify integration** — push notifications to LINE for contract expiry / approvals
- **Advanced cross-contract search** — semantic search across all documents via vector similarity
- **Contract approval workflow UI** — multi-level approval steps, approver assignment
- **Audit log viewer** — per-contract timeline of all changes
- **Vendor blacklist enforcement** — block contract creation with blacklisted vendors

---

## Infrastructure Overview

| Service | Tech | Notes |
|---------|------|-------|
| Backend | FastAPI + SQLAlchemy | `gcp-backend` container |
| Worker | Celery + Redis | `gcp-celery-worker` container |
| Database | PostgreSQL | `gcp-postgres`, db: `govplatform` |
| Graph DB | Neo4j 5.15.0 Community | `gcp-neo4j` |
| Object Storage | MinIO | `gcp-minio` |
| Frontend | React + TypeScript (Vite) | `gcp-frontend` container |
| Infra config | Docker Compose | `gov-contract-platform/infra/docker-compose.yml` |
