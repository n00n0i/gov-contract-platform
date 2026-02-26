# Gov Contract Platform - System Architecture

## Overview
แพลตฟอร์มบริหารจัดการสัญญาภาครัฐแบบครบวงจร (Enterprise Contract Lifecycle Management)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Web Portal (React)    │   Mobile App    │   Partner API   │   Admin Panel  │
│  - ผู้ใช้งานทั่วไป      │   - เจ้าหน้าที่   │   - e-GP        │   - ผู้ดูแล    │
│  - ผู้บริหาร           │     ภาคสนาม     │   - ธนาคาร      │     ระบบ       │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY (Kong/Nginx)                          │
│  - Rate Limiting  │  Authentication  │  Load Balancing  │  SSL/TLS         │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVICE LAYER (Microservices)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Identity   │  │   Contract   │  │   Document   │  │   Workflow   │   │
│  │   Service    │  │   Service    │  │   Service    │  │   Service    │   │
│  │              │  │              │  │              │  │              │   │
│  │ - Auth/JWT   │  │ - CRUD       │  │ - Storage    │  │ - Approval   │   │
│  │ - Users      │  │ - Search     │  │ - OCR/AI     │  │ - Alerts     │   │
│  │ - RBAC       │  │ - Analytics  │  │ - Version    │  │ - Reminders  │   │
│  │ - Tenants    │  │ - Reports    │  │ - Share      │  │ - Escalation │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Vendor     │  │   Audit      │  │ Notification │  │ Integration  │   │
│  │   Service    │  │   Service    │  │   Service    │  │   Service    │   │
│  │              │  │              │  │              │  │              │   │
│  │ - Directory  │  │ - Logs       │  │ - Email      │  │ - e-GP       │   │
│  │ - Scoring    │  │ - Compliance │  │ - Line       │  │ - ThaiID     │   │
│  │ - Blacklist  │  │ - Reports    │  │ - SMS        │  │ - Banking    │   │
│  │ - History    │  │ - Analytics  │  │ - Push       │  │ - e-Sign     │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  PostgreSQL  │  │ Elasticsearch│  │    Redis     │  │   MinIO/S3   │   │
│  │  (Primary)   │  │   (Search)   │  │   (Cache)    │  │   (Files)    │   │
│  │              │  │              │  │              │  │              │   │
│  │ - Users      │  │ - Contracts  │  │ - Sessions   │  │ - Documents  │   │
│  │ - Contracts  │  │ - Vendors    │  │ - Rate Limit │  │ - Versions   │   │
│  │ - Workflows  │  │ - Analytics  │  │ - Queues     │  │ - Backups    │   │
│  │ - Audit Logs │  │              │  │ - Pub/Sub    │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Module Breakdown

### 1. Identity & Access Management (IAM)
```
┌─────────────────────────────────────────┐
│         IAM Module                      │
├─────────────────────────────────────────┤
│  • Multi-tenant User Management         │
│  • Role-Based Access Control (RBAC)     │
│  • JWT Authentication                   │
│  • Session Management                   │
│  • Audit Trail for Login/Access         │
│  • Organization Hierarchy               │
│  • Department/Unit Management           │
└─────────────────────────────────────────┘
```

### 2. Contract Management Core
```
┌─────────────────────────────────────────┐
│      Contract Module                    │
├─────────────────────────────────────────┤
│  • Contract CRUD Operations             │
│  • Version Control & History            │
│  • Document Attachment Management       │
│  • Advanced Search (Full-text + Vector) │
│  • Bulk Import/Export                   │
│  • Contract Templates                   │
│  • Clause Library                       │
│  • Contract Types & Categories          │
└─────────────────────────────────────────┘
```

### 3. AI & Document Processing
```
┌─────────────────────────────────────────┐
│      Document AI Module                 │
├─────────────────────────────────────────┤
│  • OCR (Typhoon AI + Local)             │
│  • PDF Text Extraction                  │
│  • Smart Data Extraction                │
│  • Contract Classification              │
│  • Risk Detection                       │
│  • Duplicate Detection                  │
│  • Auto-tagging                         │
└─────────────────────────────────────────┘
```

### 4. Workflow Engine
```
┌─────────────────────────────────────────┐
│      Workflow Module                    │
├─────────────────────────────────────────┤
│  • Approval Workflows                   │
│  • Notification Rules                   │
│  • Escalation Policies                  │
│  • Reminder System                      │
│  • Deadline Tracking                    │
│  • Milestone Management                 │
│  • Change Request Workflow              │
└─────────────────────────────────────────┘
```

### 5. Vendor Management
```
┌─────────────────────────────────────────┐
│      Vendor Module                      │
├─────────────────────────────────────────┤
│  • Vendor Directory                     │
│  • Performance Scoring                  │
│  • Blacklist Checking                   │
│  • Contract History per Vendor          │
│  • Risk Assessment                      │
│  • Document Verification                │
└─────────────────────────────────────────┘
```

### 6. Analytics & Reporting
```
┌─────────────────────────────────────────┐
│      Analytics Module                   │
├─────────────────────────────────────────┤
│  • Executive Dashboard                  │
│  • Contract Statistics                  │
│  • Budget Analysis                      │
│  • Compliance Reports                   │
│  • Vendor Performance Reports           │
│  • Risk Reports                         │
│  • Custom Report Builder                │
└─────────────────────────────────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Security Layers                        │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Network Security                              │
│    • WAF (Web Application Firewall)                     │
│    • DDoS Protection                                    │
│    • VPN Access for Admin                               │
│                                                         │
│  Layer 2: Application Security                          │
│    • OAuth 2.0 / OpenID Connect                         │
│    • JWT with Refresh Tokens                            │
│    • Rate Limiting & Throttling                         │
│    • Input Validation & Sanitization                    │
│                                                         │
│  Layer 3: Data Security                                 │
│    • Encryption at Rest (AES-256)                       │
│    • Encryption in Transit (TLS 1.3)                    │
│    • Field-level Encryption for PII                     │
│    • Database Row-Level Security                        │
│                                                         │
│  Layer 4: Access Control                                │
│    • RBAC (Role-Based Access Control)                   │
│    • ABAC (Attribute-Based Access Control)              │
│    • Multi-factor Authentication                        │
│    • IP Whitelisting                                    │
└─────────────────────────────────────────────────────────┘
```

## Multi-Tenancy Model

```
┌─────────────────────────────────────────────────────────┐
│                    TENANT A (กรม A)                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │ User A1 │  │ User A2 │  │ User A3 │  │ Admin A │   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘   │
│       └─────────────┴─────────────┴─────────────┘      │
│                        │                                │
│                   ┌────┴────┐                          │
│                   │ Tenant  │  ← Isolated Data         │
│                   │   DB    │                          │
│                   └─────────┘                          │
├─────────────────────────────────────────────────────────┤
│                    TENANT B (กรม B)                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │ User B1 │  │ User B2 │  │ User B3 │  │ Admin B │   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘   │
│       └─────────────┴─────────────┴─────────────┘      │
│                        │                                │
│                   ┌────┴────┐                          │
│                   │ Tenant  │  ← Isolated Data         │
│                   │   DB    │                          │
│                   └─────────┘                          │
└─────────────────────────────────────────────────────────┘
         Shared Infrastructure, Isolated Data
```

## API Design Principles

### RESTful API Standards
```
/api/v1/{resource}/{action}

Examples:
  GET    /api/v1/contracts              # List contracts
  POST   /api/v1/contracts              # Create contract
  GET    /api/v1/contracts/{id}         # Get contract
  PUT    /api/v1/contracts/{id}         # Update contract
  DELETE /api/v1/contracts/{id}         # Delete contract
  POST   /api/v1/contracts/{id}/approve # Approve contract
```

### Response Format
```json
{
  "success": true,
  "code": 200,
  "message": "Operation successful",
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Technology Stack

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL 15+ with pgvector
- **Cache**: Redis 7+
- **Search**: Elasticsearch 8+
- **Storage**: MinIO (S3-compatible)
- **Message Queue**: Redis Streams / RabbitMQ
- **Task Queue**: Celery
- **AI/ML**: Typhoon AI, Transformers, PyTorch

### Frontend
- **Framework**: React 18+ with TypeScript
- **State Management**: Zustand / Redux Toolkit
- **UI Library**: Ant Design / Material-UI
- **Charts**: Apache ECharts / Recharts
- **Build Tool**: Vite

### Infrastructure
- **Container**: Docker + Docker Compose
- **Orchestration**: Kubernetes (Production)
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack
- **CDN**: CloudFlare

## Development Phases

### Phase 1: Foundation (Months 1-2)
- [ ] Core Infrastructure Setup
- [ ] Identity & Access Management
- [ ] Basic Contract CRUD
- [ ] Document Upload & Storage

### Phase 2: Intelligence (Months 3-4)
- [ ] OCR & AI Integration
- [ ] Advanced Search
- [ ] Workflow Engine
- [ ] Notification System

### Phase 3: Scale (Months 5-6)
- [ ] Multi-tenancy
- [ ] Analytics & Reporting
- [ ] Vendor Management
- [ ] Integration APIs

### Phase 4: Optimization (Months 7-8)
- [ ] Performance Tuning
- [ ] Security Hardening
- [ ] Mobile App
- [ ] Advanced Analytics

## Success Metrics

| Metric | Target |
|--------|--------|
| API Response Time | < 200ms (p95) |
| Page Load Time | < 2 seconds |
| OCR Accuracy | > 95% |
| System Uptime | 99.9% |
| Concurrent Users | 10,000+ |
| Data Processing | 1M+ contracts |
