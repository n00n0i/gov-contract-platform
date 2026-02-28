# Technical Design Document

> เอกสารออกแบบเทคนิค Gov Contract Platform

**Version**: 2.0  
**Date**: กุมภาพันธ์ 2026  
**Author**: n00n0i

---

## 1. สถาปัตยกรรมระบบ

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Web App   │  │  Mobile App │  │   CLI Tool  │             │
│  │   (React)   │  │   (Future)  │  │   (Future)  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                         Gateway Layer                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Nginx (Reverse Proxy) + SSL Termination + Rate Limit   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                       Application Layer                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    FastAPI Backend                       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ Contract │ │  Vendor  │ │ Document │ │   Auth   │  │   │
│  │  │  Module  │ │  Module  │ │  Module  │ │  Module  │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │    AI    │ │ Knowledge│ │  Agent   │ │  Report  │  │   │
│  │  │  Module  │ │  Module  │ │  Module  │ │  Module  │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                        Service Layer                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Celery  │  │  Celery  │  │  Redis   │  │Elasticsearch│      │
│  │  Worker  │  │  Beat    │  │  Queue   │  │   Search    │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                         Data Layer                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │PostgreSQL│  │  Neo4j   │  │  MinIO   │  │  Vector  │         │
│  │  (SQL)   │  │ (Graph)  │  │ (Object) │  │  Store   │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
User Request → Nginx → FastAPI → Service Layer → Database
                    ↓         ↓
               Validation  Business Logic
                    ↓         ↓
               Response    Background Task (Celery)
```

---

## 2. Technology Stack

### 2.1 Frontend

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | React | 18.x | UI Library |
| Language | TypeScript | 5.x | Type Safety |
| Build Tool | Vite | 5.x | Fast Build |
| Styling | Tailwind CSS | 3.x | Utility CSS |
| State Management | React Query | 5.x | Server State |
| Routing | React Router | 6.x | Navigation |
| Icons | Lucide React | 0.x | Icon Library |
| HTTP Client | Axios | 1.x | API Calls |

### 2.2 Backend

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | FastAPI | 0.100+ | API Framework |
| Language | Python | 3.11 | Backend Language |
| ORM | SQLAlchemy | 2.x | Database ORM |
| Migrations | Alembic | 1.x | DB Migrations |
| Auth | JWT | 2.x | Authentication |
| Validation | Pydantic | 2.x | Data Validation |

### 2.3 Database & Storage

| Component | Technology | Purpose |
|-----------|------------|---------|
| Primary DB | PostgreSQL + pgVector | Relational + Vector |
| Graph DB | Neo4j 5.15 | Relationship Data |
| Cache | Redis 7 | Cache & Queue |
| Object Storage | MinIO | File Storage |
| Search | Elasticsearch 8 | Full-text Search |

### 2.4 AI & ML

| Component | Technology | Purpose |
|-----------|------------|---------|
| OCR | Tesseract 5 | Text Extraction |
| Local LLM | Ollama | AI Processing |
| Embeddings | Sentence Transformers | Vector Embeddings |
| AI Framework | LangChain | LLM Orchestration |
| Vector Store | pgVector / Neo4j | Vector Storage |

### 2.5 Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| Container | Docker | Containerization |
| Orchestration | Docker Compose | Local Development |
| Reverse Proxy | Nginx | API Gateway |
| Task Queue | Celery | Background Tasks |
| Scheduler | Celery Beat | Periodic Tasks |

---

## 3. Database Design

### 3.1 Entity Relationship Diagram

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│      users       │     │    contracts     │     │     vendors      │
├──────────────────┤     ├──────────────────┤     ├──────────────────┤
│ id (PK)          │     │ id (PK)          │     │ id (PK)          │
│ username         │────→│ contract_number  │     │ name             │
│ email            │     │ title            │     │ email            │
│ password_hash    │     │ description      │     │ phone            │
│ role             │     │ value            │     │ address          │
│ is_active        │     │ start_date       │     │ tax_id           │
│ created_at       │     │ end_date         │     │ status           │
└──────────────────┘     │ status           │     │ created_at       │
         │               │ vendor_id (FK)   │←────└──────────────────┘
         │               │ created_by (FK)  │
         │               │ created_at       │
         │               └──────────────────┘
         │                        │
         │               ┌──────────────────┐
         │               │    documents     │
         │               ├──────────────────┤
         │               │ id (PK)          │
         │               │ contract_id (FK) │
         │               │ filename         │
         │               │ file_type        │
         │               │ storage_path     │
         │               │ ocr_text         │
         │               │ ocr_data (JSON)  │
         │               │ uploaded_by (FK) │
         │               │ created_at       │
         │               └──────────────────┘
         │
         └────→┌──────────────────┐
               │  notifications   │
               ├──────────────────┤
               │ id (PK)          │
               │ user_id (FK)     │
               │ type             │
               │ title            │
               │ message          │
               │ is_read          │
               │ created_at       │
               └──────────────────┘
```

### 3.2 Core Tables

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    department VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    is_2fa_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Contracts Table
```sql
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    contract_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'draft',
    value_original DECIMAL(15,2),
    value_with_vat DECIMAL(15,2),
    vat_rate DECIMAL(5,2) DEFAULT 7.0,
    start_date DATE,
    end_date DATE,
    duration_months INTEGER,
    counterparty VARCHAR(255),
    vendor_id UUID REFERENCES vendors(id),
    created_by UUID REFERENCES users(id),
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Documents Table
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID REFERENCES contracts(id),
    document_type VARCHAR(100),
    original_filename VARCHAR(500),
    storage_filename VARCHAR(500),
    mime_type VARCHAR(100),
    file_size BIGINT,
    storage_bucket VARCHAR(100),
    storage_path VARCHAR(1000),
    ocr_status VARCHAR(50) DEFAULT 'pending',
    ocr_text TEXT,
    ocr_data JSONB,
    extracted_data JSONB,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 4. API Design

### 4.1 REST API Structure

```
/api/v1/
├── /auth
│   ├── POST /login
│   ├── POST /logout
│   ├── POST /refresh
│   ├── POST /2fa/setup
│   └── POST /2fa/verify
├── /users
│   ├── GET / (list)
│   ├── POST / (create)
│   ├── GET /{id}
│   ├── PUT /{id}
│   └── DELETE /{id}
├── /contracts
│   ├── GET / (list)
│   ├── POST / (create)
│   ├── GET /{id}
│   ├── PUT /{id}
│   ├── DELETE /{id}
│   ├── GET /stats/summary
│   └── POST /{id}/documents
├── /vendors
│   ├── GET / (list)
│   ├── POST / (create)
│   ├── GET /{id}
│   ├── PUT /{id}
│   └── DELETE /{id}
├── /documents
│   ├── GET /{id}
│   ├── POST /upload
│   ├── GET /{id}/download
│   └── POST /{id}/ocr
├── /knowledge-base
│   ├── GET /documents
│   ├── POST /documents
│   ├── POST /query
│   └── POST /chat
├── /agents
│   ├── GET / (list)
│   ├── POST / (create)
│   ├── GET /{id}/logs
│   └── POST /{id}/test
└── /notifications
    ├── GET / (list)
    ├── PUT /{id}/read
    └── DELETE /{id}
```

### 4.2 Response Format

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation successful",
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 100
  }
}
```

Error Response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  }
}
```

---

## 5. AI & OCR Architecture

### 5.1 OCR Pipeline

```
Document Upload → Preprocessing → OCR Extraction → Data Parsing → Validation → Storage
      ↓                ↓               ↓              ↓            ↓          ↓
   PDF/Image    Deskew/Enhance   Tesseract      Regex/LLM     Schema    Database
```

### 5.2 AI Processing Flow

```
User Query → Intent Classification → Context Retrieval → LLM Generation → Response
                  ↓                        ↓
            Classification          RAG/GraphRAG
            Model                   Search
```

### 5.3 Document Processing

| Stage | Technology | Description |
|-------|------------|-------------|
| Input | PDF2Image / Pillow | Convert to images |
| Preprocessing | OpenCV | Deskew, enhance |
| OCR | Tesseract | Text extraction |
| NER | SpaCy / Regex | Entity extraction |
| Validation | Pydantic | Data validation |
| Storage | MinIO + PostgreSQL | File + Metadata |

---

## 6. Security Architecture

### 6.1 Authentication Flow

```
Login Request → Validate Credentials → Generate JWT → Return Tokens
                      ↓
              Check 2FA (if enabled)
                      ↓
              Verify 2FA Code
```

### 6.2 Authorization

```python
# RBAC Decorator
@require_permissions(['contract:create'])
async def create_contract(...):
    pass

# Role Hierarchy
admin → manager → user → viewer
```

### 6.3 Data Protection

- **At Rest**: AES-256 Encryption
- **In Transit**: TLS 1.3
- **Sensitive Fields**: Field-level encryption
- **Files**: Server-side encryption (MinIO)

---

## 7. Background Processing

### 7.1 Celery Tasks

| Task | Queue | Priority | Schedule |
|------|-------|----------|----------|
| OCR Processing | ocr | Medium | On-demand |
| AI Analysis | ai | Low | On-demand |
| Email Sending | email | High | On-demand |
| Contract Expiry Check | default | Medium | Daily |
| Report Generation | report | Low | Weekly |
| Backup | maintenance | Low | Daily |

### 7.2 Task Flow

```
API Request → Queue Task (Redis) → Celery Worker → Execute → Store Result
                                                    ↓
                                              Retry (if fail)
```

---

## 8. Deployment Architecture

### 8.1 Docker Compose

```yaml
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
  
  frontend:
    build: ./frontend
    environment:
      - VITE_API_URL=/api/v1
  
  backend:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://...
  
  postgres:
    image: ankane/pgvector:latest
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  # ... other services
```

### 8.2 Production Considerations

- Load Balancer (Nginx / HAProxy)
- Database Replication
- Redis Cluster
- MinIO Distributed Mode
- Kubernetes (Optional)

---

## 9. Monitoring & Logging

### 9.1 Logging Strategy

| Level | Destination | Retention |
|-------|-------------|-----------|
| ERROR | File + Alert | 90 days |
| WARN | File | 30 days |
| INFO | File | 14 days |
| DEBUG | File (dev only) | 7 days |

### 9.2 Health Checks

```
/health → Check all services
/health/db → Database only
/health/redis → Redis only
```

---

## 10. Testing Strategy

### 10.1 Test Levels

| Level | Coverage | Tools |
|-------|----------|-------|
| Unit | > 80% | pytest |
| Integration | > 60% | pytest + TestContainers |
| E2E | Critical paths | Playwright |
| Performance | Load testing | Locust |

### 10.2 CI/CD Pipeline

```
Commit → Lint → Test → Build → Security Scan → Deploy
  ↓        ↓      ↓       ↓          ↓          ↓
Git    flake8  pytest  docker   trivy     docker-compose
```

---

## 11. Performance Optimization

### 11.1 Caching Strategy

| Data | Cache | TTL |
|------|-------|-----|
| User Session | Redis | 30 min |
| Contract Stats | Redis | 5 min |
| Static Assets | Browser | 1 day |
| API Response | Redis | 1 min |

### 11.2 Database Optimization

- Indexes on frequently queried columns
- Connection pooling (PgBouncer)
- Query optimization
- Read replicas (if needed)

---

## 12. Appendices

### 12.1 Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123

# AI
OLLAMA_URL=http://ollama:11434
OPENAI_API_KEY=sk-...
TYPHOON_API_KEY=...

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 12.2 API Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| /auth/* | 5 | 1 minute |
| /api/* | 100 | 1 minute |
| /upload | 10 | 1 minute |
| /ai/* | 20 | 1 minute |

---

**Document Version**: 2.0  
**Last Updated**: กุมภาพันธ์ 2026
