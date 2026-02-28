# Docker Guide

> คู่มือการใช้งาน Docker สำหรับ Gov Contract Platform

---

## 📋 สารบัญ

1. [ภาพรวม Architecture](#-ภาพรวม-architecture)
2. [Services ทั้งหมด](#-services-ทั้งหมด)
3. [คำสั่งพื้นฐาน](#-คำสั่งพื้นฐาน)
4. [การตั้งค่า Environment](#-การตั้งค่า-environment)
5. [Volume & Data Persistence](#-volume--data-persistence)
6. [การ Backup & Restore](#-การ-backup--restore)
7. [การปรับแต่ง Performance](#-การปรับแต่ง-performance)
8. [แก้ไขปัญหา](#-แก้ไขปัญหา)

---

## 🏗 ภาพรวม Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Compose                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                │
│  │  Nginx   │────→│ Frontend │     │ Backend  │                │
│  │  :80     │     │  :3000   │────→│  :8000   │                │
│  └──────────┘     └──────────┘     └────┬─────┘                │
│                                         │                       │
│           ┌─────────────┬───────────────┼─────────────┐         │
│           ▼             ▼               ▼             ▼         │
│      ┌────────┐   ┌──────────┐   ┌──────────┐   ┌────────┐     │
│      │Postgres│   │  Redis   │   │  Neo4j   │   │ MinIO  │     │
│      │ :5432  │   │  :6379   │   │ :7474    │   │ :9000  │     │
│      └────────┘   └──────────┘   └──────────┘   └────────┘     │
│                                                       │         │
│      ┌──────────┐   ┌──────────┐              ┌───────▼────┐   │
│      │Celery    │   │Celery    │              │Elasticsearch│   │
│      │Worker    │   │Beat      │              │   :9200     │   │
│      └──────────┘   └──────────┘              └────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🐳 Services ทั้งหมด

| Service | Image | Port | คำอธิบาย |
|---------|-------|------|---------|
| **nginx** | nginx:alpine | 80 | Reverse Proxy |
| **frontend** | node:20-alpine | 3000 | React App |
| **backend** | python:3.11 | 8000 | FastAPI |
| **postgres** | ankane/pgvector | 5432 | Database |
| **redis** | redis:7-alpine | 6379 | Cache/Queue |
| **neo4j** | neo4j:5.15-community | 7474, 7687 | Graph DB |
| **minio** | minio/minio:latest | 9000, 9001 | Object Storage |
| **elasticsearch** | elasticsearch:8.11 | 9200 | Search Engine |
| **celery-worker** | python:3.11 | - | Background Worker |
| **celery-beat** | python:3.11 | - | Scheduler |

---

## 📝 คำสั่งพื้นฐาน

### เริ่มต้นระบบ

```bash
cd infra

# รันทั้งหมด (background)
docker compose up -d

# รันพร้อมดู Logs
docker compose up

# รันบาง Service
docker compose up -d backend frontend postgres
```

### หยุดระบบ

```bash
# หยุดทั้งหมด
docker compose down

# หยุดและลบ Volumes (ระวัง! ข้อมูลจะหาย)
docker compose down -v

# หยุดบาง Service
docker compose stop backend
```

### รีสตาร์ท

```bash
# รีสตาร์ททั้งหมด
docker compose restart

# รีสตาร์ทบาง Service
docker compose restart backend celery-worker
```

### ตรวจสอบสถานะ

```bash
# ดูสถานะทั้งหมด
docker compose ps

# ดู Logs
docker compose logs -f

# ดู Logs บาง Service
docker compose logs -f backend

# ดู Logs ย้อนหลัง 100 บรรทัด
docker compose logs --tail 100 backend
```

### เข้าไปใน Container

```bash
# Backend
docker compose exec backend bash

# Database
docker compose exec postgres psql -U postgres -d gov_contract

# Redis
docker compose exec redis redis-cli

# Neo4j
docker compose exec neo4j cypher-shell -u neo4j -p password
```

---

## ⚙️ การตั้งค่า Environment

### ไฟล์ .env

```bash
# สร้างจากตัวอย่าง
cp .env.example .env
```

### ตัวแปรสำคัญ

```env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=gov_contract

# Neo4j
NEO4J_AUTH=neo4j/password

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123

# JWT
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# AI Providers (Optional)
OPENAI_API_KEY=sk-...
TYPHOON_API_KEY=...
```

---

## 💾 Volume & Data Persistence

### Volumes ที่ใช้

```yaml
volumes:
  postgres_data:    # Database
  neo4j_data:       # Graph Database
  minio_data:       # Object Storage
  redis_data:       # Cache
  elasticsearch_data: # Search Index
```

### ตรวจสอบ Volume

```bash
# ดูรายการ Volumes
docker volume ls

# ดูรายละเอียด
docker volume inspect infra_postgres_data
```

### ลบ Volume (ระวัง!)

```bash
# ลบทั้งหมด
docker compose down -v

# ลบบางอัน
docker volume rm infra_postgres_data
```

---

## 💿 การ Backup & Restore

### Backup Database

```bash
# Backup PostgreSQL
docker compose exec postgres pg_dump -U postgres gov_contract > backup.sql

# Backup Neo4j
docker compose exec neo4j neo4j-admin database dump neo4j --to=/backups/neo4j.dump
```

### Restore Database

```bash
# Restore PostgreSQL
docker compose exec -T postgres psql -U postgres gov_contract < backup.sql

# Restore Neo4j
docker compose exec neo4j neo4j-admin database load neo4j --from=/backups/neo4j.dump
```

### Backup ทั้งระบบ

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/$DATE"

mkdir -p $BACKUP_DIR

# Database
docker compose exec postgres pg_dump -U postgres gov_contract > $BACKUP_DIR/database.sql

# MinIO
docker compose exec minio mc mirror local/gov-contract $BACKUP_DIR/minio

# Configs
cp .env $BACKUP_DIR/

# Compress
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
rm -rf $BACKUP_DIR

echo "Backup completed: $BACKUP_DIR.tar.gz"
```

---

## ⚡ การปรับแต่ง Performance

### ปรับ Resources

```yaml
# docker-compose.override.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
  
  postgres:
    deploy:
      resources:
        limits:
          memory: 2G
```

### Scale Celery Workers

```bash
# เพิ่ม Worker
docker compose up -d --scale celery-worker=3
```

### ปรับแต่ง PostgreSQL

```bash
# เพิ่ม shared_buffers
docker compose exec postgres psql -U postgres -c "ALTER SYSTEM SET shared_buffers = '512MB';"
docker compose restart postgres
```

---

## 🔧 แก้ไขปัญหา

### Container ไม่ Start

```bash
# ดู Error
docker compose logs <service-name>

# ตรวจสอบ Port ชน
netstat -tlnp | grep 80

# เปลี่ยน Port
# แก้ docker-compose.yml หรือใช้ .env
```

### Out of Memory

```bash
# ดูการใช้ Memory
docker stats

# เพิ่ม Swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Disk Full

```bash
# ดูการใช้พื้นที่
docker system df

# ลบ Images ที่ไม่ใช้
docker image prune -a

# ลบ Volumes ที่ไม่ใช้ (ระวัง!)
docker volume prune
```

### Network Issues

```bash
# รีสร้าง Network
docker compose down
docker network prune
docker compose up -d
```

---

## 📊 Monitoring

### ดู Resource Usage

```bash
# Real-time
docker stats

# บันทึกไฟล์
docker stats --no-stream > stats.txt
```

### Health Checks

```bash
# Backend
curl http://localhost:8000/health

# Frontend
curl http://localhost:3000

# Database
docker compose exec postgres pg_isready -U postgres
```

---

## 🔒 Security

### อัปเดต Images

```bash
# Pull ใหม่
docker compose pull

# รันใหม่
docker compose up -d
```

### จำกัด Access

```yaml
# ใช้ Network แยก
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # ไม่สามารถเข้าถึงจากภายนอก
```

---

## 📚 อ้างอิง

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Dockerfile Best Practices](https://docs.docker.com/develop/dev-best-practices/)

---

> 🐳 **Docker Ready** - Deploy anywhere, scale anytime!
