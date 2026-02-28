# System Architecture

> สถาปัตยกรรมระบบ Gov Contract Platform

**Version**: 2.0  
**Date**: กุมภาพันธ์ 2026

---

## สารบัญ

1. [ภาพรวมระบบ](#ภาพรวมระบบ)
2. [Layer Architecture](#layer-architecture)
3. [Data Flow](#data-flow)
4. [Component Diagrams](#component-diagrams)
5. [Database Architecture](#database-architecture)
6. [Security Architecture](#security-architecture)
7. [Deployment Architecture](#deployment-architecture)
8. [Scalability & Performance](#scalability--performance)

---

## ภาพรวมระบบ

### System Overview

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

---

## Layer Architecture

### 1. Presentation Layer

#### Web Application (React + TypeScript)
- **Framework**: React 18 with hooks
- **State Management**: React Query + Context API
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Features**:
  - Responsive design
  - Real-time updates
  - File upload with progress
  - Rich text editor

#### Mobile Application (Future)
- Progressive Web App (PWA)
- React Native (Planned)

### 2. Gateway Layer (Nginx)

```nginx
# nginx.conf
server {
    listen 80;
    server_name localhost;
    
    # Frontend
    location / {
        proxy_pass http://frontend:3000;
    }
    
    # API
    location /api/ {
        proxy_pass http://backend:8000/;
        
        # Rate limiting
        limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
        
        # Headers
        add_header 'Access-Control-Allow-Origin' '*';
    }
    
    # Static files
    location /static/ {
        alias /app/static/;
        expires 1d;
    }
}
```

### 3. Application Layer (FastAPI)

```
backend/
├── app/
│   ├── api/                    # API Routes
│   │   ├── v1/
│   │   │   ├── auth.py
│   │   │   ├── contracts.py
│   │   │   ├── vendors.py
│   │   │   ├── documents.py
│   │   │   ├── knowledge_base.py
│   │   │   └── ai.py
│   ├── core/                   # Core Components
│   │   ├── config.py
│   │   ├── security.py
│   │   └── exceptions.py
│   ├── models/                 # Database Models
│   ├── schemas/                # Pydantic Schemas
│   ├── services/               # Business Logic
│   │   ├── contract_service.py
│   │   ├── ocr_service.py
│   │   └── ai_service.py
│   └── db/                     # Database
│       ├── session.py
│       └── base.py
```

### 4. Service Layer

#### Redis
- **Cache**: Session storage, API response caching
- **Queue**: Celery task queue
- **Pub/Sub**: Real-time notifications

#### Celery
- **Workers**: Background task processing
- **Beat**: Scheduled tasks

### 5. Data Layer

#### PostgreSQL (Primary Database)
- Relational data
- ACID transactions
- pgVector extension for vector storage

#### Neo4j (Graph Database)
- Entity relationships
- Knowledge graph
- Graph queries

#### MinIO (Object Storage)
- File storage
- S3-compatible API
- Encrypted storage

#### Elasticsearch
- Full-text search
- Document indexing
- Analytics

---

## Data Flow

### 1. Contract Creation Flow

```
User ──► Frontend ──► API Gateway ──► FastAPI
                                        │
                                        ▼
                                   Validation
                                        │
                                        ▼
                                    Database
                                        │
                                        ▼
                                   Response
                                        │
                                        ▼
                              Background Task (Celery)
                                        │
                                        ▼
                              Index in Elasticsearch
```

### 2. Document Upload & OCR Flow

```
User ──► Upload ──► MinIO ──► Queue OCR Task ──► Celery Worker
                                                  │
                                                  ▼
                                             Tesseract OCR
                                                  │
                                                  ▼
                                            AI Extraction
                                                  │
                                                  ▼
                                             Save Results
                                                  │
                                                  ▼
                                             Update Database
```

### 3. AI Query Flow (RAG)

```
User Query ──► API ──► Embedding Model ──► Vector Search (pgVector)
                                                  │
                                                  ▼
                                        Retrieve Top-K Documents
                                                  │
                                                  ▼
                                           LLM Generation
                                                  │
                                                  ▼
                                             Response
```

---

## Component Diagrams

### Authentication Component

```
┌─────────────────────────────────────────────────────────┐
│                    Authentication                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │    Login     │───►│  JWT Token   │───►│  Access  │  │
│  │              │    │  Generation  │    │  Grant   │  │
│  └──────────────┘    └──────────────┘    └──────────┘  │
│         │                                              │
│         ▼                                              │
│  ┌──────────────┐    ┌──────────────┐                 │
│  │     2FA      │───►│  TOTP Verify │                 │
│  │   (Optional) │    │              │                 │
│  └──────────────┘    └──────────────┘                 │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐                 │
│  │ Role Check   │───►│ Permission   │                 │
│  │              │    │   Validate   │                 │
│  └──────────────┘    └──────────────┘                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### AI/OCR Component

```
┌─────────────────────────────────────────────────────────┐
│                   AI/OCR Pipeline                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Input ──► Preprocessing ──► OCR ──► NER ──► Validation │
│             │                 │        │         │      │
│             ▼                 ▼        ▼         ▼      │
│        ┌─────────┐      ┌─────────┐ ┌──────┐ ┌──────┐  │
│        │ Deskew  │      │Tesseract│ │SpaCy │ │Schema│  │
│        │Enhance  │      │         │ │      │ │      │  │
│        └─────────┘      └─────────┘ └──────┘ └──────┘  │
│                                                          │
│  Output ◄── Structured Data ◄── Entity Extraction      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Database Architecture

### PostgreSQL Schema

```
┌─────────────────────────────────────────────────────────┐
│                   PostgreSQL                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐     ┌─────────────┐     ┌───────────┐ │
│  │    users    │◄────┤  contracts  │────►│  vendors  │ │
│  │             │     │             │     │           │ │
│  └─────────────┘     └──────┬──────┘     └───────────┘ │
│                             │                          │
│                             ▼                          │
│                       ┌─────────────┐                  │
│                       │  documents  │                  │
│                       │             │                  │
│                       └──────┬──────┘                  │
│                              │                         │
│                              ▼                         │
│  ┌─────────────┐     ┌─────────────┐     ┌───────────┐ │
│  │audit_logs   │     │kb_documents │     │notifications│
│  │             │     │(pgVector)   │     │           │ │
│  └─────────────┘     └─────────────┘     └───────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Neo4j Graph Schema

```
(Entity:Contract)-[:HAS_VENDOR]->(Entity:Vendor)
       │
       └─[:HAS_DOCUMENT]->(Entity:Document)
       │
       └─[:RELATED_TO]->(Entity:Contract)
       │
       └─[:MENTIONS]->(Entity:Person/Organization/Location)

(KB_Document)-[:CONTAINS]->(Entity)
       │
       └─[:RELATES_TO]->(KB_Document)
```

---

## Security Architecture

### Security Layers

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Network Security                                │
│ ├── Firewall Rules                                       │
│ ├── VPN Access (Optional)                                │
│ └── DDoS Protection                                      │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Transport Security                              │
│ ├── TLS 1.3                                              │
│ ├── Certificate Management                               │
│ └── HSTS Headers                                         │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Application Security                            │
│ ├── JWT Authentication                                   │
│ ├── RBAC Authorization                                   │
│ ├── Input Validation                                     │
│ └── Rate Limiting                                        │
├─────────────────────────────────────────────────────────┤
│ Layer 4: Data Security                                   │
│ ├── Encryption at Rest (AES-256)                         │
│ ├── Field-level Encryption                               │
│ └── Secure Backup                                        │
├─────────────────────────────────────────────────────────┤
│ Layer 5: Audit & Compliance                              │
│ ├── Audit Logging                                        │
│ ├── Access Logging                                       │
│ └── Data Retention Policy                                │
└─────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

### Docker Compose (Development)

```yaml
version: '3.8'
services:
  nginx:
    ports:
      - "80:80"
    depends_on:
      - frontend
      - backend

  frontend:
    build: ./frontend
    environment:
      - VITE_API_URL=/api/v1

  backend:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  postgres:
    image: ankane/pgvector:latest
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  neo4j:
    image: neo4j:5.15-community
    volumes:
      - neo4j_data:/data

  minio:
    image: minio/minio:latest
    volumes:
      - minio_data:/data

  celery-worker:
    build: ./backend
    command: celery -A app.celery worker
    depends_on:
      - redis
      - postgres
```

### Production Architecture

```
┌─────────────────────────────────────────────────────────┐
│                       Load Balancer                      │
│                      (Cloudflare/ALB)                    │
└─────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  App Server  │  │  App Server  │  │  App Server  │
│     #1       │  │     #2       │  │     #N       │
└──────────────┘  └──────────────┘  └──────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Database Cluster                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │  PostgreSQL Primary ◄──► PostgreSQL Replica    │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Redis Cluster                                   │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐         │   │
│  │  │ Master  │──►│ Slave 1 │──►│ Slave 2 │         │   │
│  │  └─────────┘  └─────────┘  └─────────┘         │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  MinIO Distributed                               │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Scalability & Performance

### Horizontal Scaling

```
                    ┌──────────────┐
                    │ Load Balancer │
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Frontend   │  │   Frontend   │  │   Frontend   │
│   Container  │  │   Container  │  │   Container  │
└──────────────┘  └──────────────┘  └──────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                    ┌──────────────┐
                    │ Load Balancer │
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Backend    │  │   Backend    │  │   Backend    │
│   Container  │  │   Container  │  │   Container  │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Caching Strategy

| Data Type | Cache Layer | TTL | Invalidation |
|-----------|-------------|-----|--------------|
| User Session | Redis | 30 min | On logout |
| API Response | Redis | 5 min | On update |
| Static Assets | Browser/CDN | 1 day | Version hash |
| Search Results | Redis | 1 min | On index update |
| Contract Stats | Redis | 5 min | On data change |

### Database Optimization

```sql
-- Indexes for performance
CREATE INDEX CONCURRENTLY idx_contracts_status ON contracts(status);
CREATE INDEX CONCURRENTLY idx_contracts_dates ON contracts(start_date, end_date);
CREATE INDEX CONCURRENTLY idx_documents_contract ON documents(contract_id);

-- Partitioning for large tables (if needed)
CREATE TABLE audit_logs_2024 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

---

## Monitoring & Observability

### Metrics Collection

```
┌─────────────────────────────────────────────────────────┐
│                    Monitoring Stack                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Prometheus  │  │   Grafana    │  │   Loki       │  │
│  │  (Metrics)   │  │ (Dashboard)  │  │   (Logs)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Elasticsearch│  │    Jaeger    │  │  Alertmanager│  │
│  │   (Logs)     │  │  (Tracing)   │  │  (Alerts)    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

**Document Version**: 2.0  
**Last Updated**: กุมภาพันธ์ 2026
