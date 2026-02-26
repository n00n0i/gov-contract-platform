# 🏛️ Gov Contract Platform

**Enterprise Contract Lifecycle Management for Government**

แพลตฟอร์มบริหารจัดการสัญญาภาครัฐแบบครบวงจร รองรับ Multi-tenancy, AI-powered OCR, Workflow Automation และ Analytics

---

## 🚀 Quick Start

### Requirements
- Docker & Docker Compose
- Git
- 8GB+ RAM (16GB recommended)

### 1. Start the Platform

```bash
cd gov-contract-platform
./start.sh
```

หรือ manual:
```bash
cd infra
docker-compose up -d
```

### 2. Access the Platform

| Service | URL | Credentials |
|---------|-----|-------------|
| API Docs | http://localhost:8000/docs | - |
| API Base | http://localhost:8000 | - |
| Kibana | http://localhost:5601 | - |
| MinIO Console | http://localhost:9001 | minioadmin/minioadmin |

### 3. Verify Installation

```bash
# Check API health
curl http://localhost:8000/health

# Expected response:
# {"status": "healthy", "platform": "Gov Contract Platform", "version": "2.0.0"}
```

---

## 📁 Project Structure

```
gov-contract-platform/
├── 📁 backend/               # FastAPI Backend
│   ├── 📁 app/
│   │   ├── 📁 api/          # API Routes
│   │   ├── 📁 core/         # Config, Security, Logging
│   │   ├── 📁 models/       # Database Models
│   │   ├── 📁 services/     # Business Logic
│   │   ├── 📁 tasks/        # Background Tasks (Celery)
│   │   └── 📁 utils/        # Utilities
│   ├── 📄 main.py           # Application Entry
│   └── 📄 requirements.txt
│
├── 📁 frontend/             # React Frontend (Coming soon)
│
├── 📁 infra/                # Infrastructure
│   ├── 📄 docker-compose.yml
│   └── 📁 nginx/            # Nginx Config
│
├── 📁 docs/                 # Documentation
│
├── 📄 ARCHITECTURE.md       # System Architecture
├── 📄 start.sh             # Quick Start Script
└── 📄 README.md            # This file
```

---

## 🏗️ Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  React Frontend  │  Mobile App  │  Partner APIs             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API GATEWAY                             │
│  Nginx │ Rate Limiting │ Authentication │ SSL                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   MICROSERVICES LAYER                        │
│  Identity │ Contract │ Document │ Workflow │ Vendor         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│  PostgreSQL │ Elasticsearch │ Redis │ MinIO                 │
└─────────────────────────────────────────────────────────────┘
```

---

## ✨ Features

### Core Features
- ✅ **Multi-tenancy** - รองรับหลายหน่วยงานในแพลตฟอร์มเดียว
- ✅ **Contract Management** - CRUD, Version Control, Audit Trail
- ✅ **AI OCR** - ดึงข้อมูลอัตโนมัติจาก PDF/รูปภาพ (Typhoon AI)
- ✅ **Advanced Search** - Full-text + Vector Search (Elasticsearch)
- ✅ **Role-Based Access** - RBAC ระดับหน่วยงาน/กอง/งาน
- ✅ **Workflow Engine** - อนุมัติ, แจ้งเตือน, Escalation
- ✅ **Vendor Management** - ทะเบียนผู้รับจ้าง, ประเมินผล
- ✅ **Analytics Dashboard** - รายงาน, สถิติ, วิเคราะห์

### Coming Soon
- 🤖 **AI Agents** - Legal Agent & Finance Agent
- 📱 **Mobile App** - iOS & Android
- 🔗 **Integrations** - e-GP, ThaiID, e-Signature
- 📊 **Advanced Analytics** - ML-based Risk Prediction

---

## 🔌 API Examples

### Authentication
```bash
# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'
```

### Contract Management
```bash
# Create Contract
curl -X POST http://localhost:8000/api/v1/contracts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "สัญญาจ้างก่อสร้าง",
    "contract_type": "construction",
    "value": 5000000,
    "department_id": "DEPT001"
  }'

# Search Contracts
curl "http://localhost:8000/api/v1/contracts/search?q=ก่อสร้าง&type=construction"

# Upload Document
curl -X POST http://localhost:8000/api/v1/contracts/{id}/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@contract.pdf" \
  -F "type=main_contract"
```

---

## 🛠️ Development

### Setup Local Environment

```bash
# 1. Create virtual environment
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run development server
uvicorn main:app --reload
```

### Environment Variables

```bash
# Create .env file in infra/
cat > infra/.env << EOF
ENVIRONMENT=development
DEBUG=true
SECRET_KEY=your-secret-key

# Database
DB_USER=govuser
DB_PASSWORD=govpass
DB_NAME=govplatform

# AI Services
TYPHOON_API_KEY=your-typhoon-api-key
OPENAI_API_KEY=your-openai-api-key
EOF
```

### Database Migrations

```bash
# Create migration
alembic revision --autogenerate -m "description"

# Run migration
alembic upgrade head

# Rollback
alembic downgrade -1
```

---

## 📊 Monitoring

### Health Checks
- API: http://localhost:8000/health
- PostgreSQL: `docker exec gcp-postgres pg_isready`
- Elasticsearch: http://localhost:9200/_cluster/health
- Redis: `docker exec gcp-redis redis-cli ping`

### Logs
```bash
# All services
docker-compose -f infra/docker-compose.yml logs -f

# Specific service
docker-compose -f infra/docker-compose.yml logs -f backend
docker-compose -f infra/docker-compose.yml logs -f celery-worker
```

### Metrics (Coming soon)
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000

---

## 🧪 Testing

```bash
# Run all tests
pytest

# With coverage
pytest --cov=app --cov-report=html

# Specific module
pytest tests/test_contracts.py
```

---

## 🚢 Deployment

### Production Checklist

- [ ] Change default passwords
- [ ] Set strong SECRET_KEY
- [ ] Configure SSL certificates
- [ ] Set up backup strategy
- [ ] Enable monitoring & alerting
- [ ] Configure firewall rules
- [ ] Set up log aggregation
- [ ] Performance tuning

### Docker Production

```bash
# Production build
docker-compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d

# Scale workers
docker-compose up -d --scale celery-worker=4
```

### Kubernetes (Coming soon)

```bash
# Deploy to k8s
kubectl apply -f k8s/
```

---

## 📚 Documentation

- [Architecture](ARCHITECTURE.md) - System design & tech stack
- [API Docs](http://localhost:8000/docs) - Interactive API documentation
- [Deployment Guide](docs/deployment.md) - Production deployment
- [Development Guide](docs/development.md) - Local development setup

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

## 📄 License

MIT License - สำหรับการใช้งานภายในหน่วยงานรัฐ

---

## 💬 Support

- 📧 Email: support@govcontract-platform.go.th
- 💬 Line: @GovContractPlatform
- 📞 Phone: 02-XXX-XXXX

---

**Built with ❤️ for Thailand Government**
