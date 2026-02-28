# Government Contract Management System Specification

> เอกสารสเปคระบบจัดการสัญญาภาครัฐ (Gov Contract Platform)

**Version**: 2.0  
**Date**: กุมภาพันธ์ 2567  
**Author**: n00n0i  
**Status**: Production Ready

---

## 1. Executive Summary

### 1.1 วัตถุประสงค์

เอกสารฉบับนี้กำหนดข้อกำหนดและสเปคทางเทคนิคสำหรับระบบบริหารจัดการสัญญาภาครัฐ (Gov Contract Platform) ซึ่งเป็นระบบที่ช่วยให้หน่วยงานราชการสามารถจัดการสัญญาต่างๆ ได้อย่างมีประสิทธิภาพ ครบวงจร และโปร่งใส

### 1.2 ขอบเขตระบบ

ระบบครอบคลุมการจัดการสัญญาตั้งแต่:
- การสร้างและจัดทำสัญญา
- การติดตามความคืบหน้า
- การจัดการเอกสาร
- การจัดการผู้รับจ้าง
- การวิเคราะห์ด้วย AI
- การรายงานและแดชบอร์ด

### 1.3 ผู้มีส่วนได้ส่วนเสีย (Stakeholders)

| กลุ่ม | บทบาท | ความต้องการหลัก |
|-------|-------|----------------|
| เจ้าหน้าที่จัดการสัญญา | ผู้ใช้งานหลัก | สร้างและจัดการสัญญาได้ง่าย |
| ผู้บริหาร | ผู้อนุมัติ | ติดตามสถานะและดูรายงาน |
| ผู้รับจ้าง | คู่สัญญา | เข้าถึงข้อมูลสัญญาได้ |
| ผู้ดูแลระบบ | Admin | จัดการผู้ใช้และตั้งค่าระบบ |
| หน่วยงานตรวจสอบ | Auditor | ตรวจสอบประวัติและ Audit trail |

---

## 2. System Overview

### 2.1 System Context

```
┌─────────────────────────────────────────────────────────────┐
│                    External Systems                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Email   │  │  SMS     │  │  AI/ML   │  │ Gov APIs │   │
│  │ Service  │  │ Gateway  │  │ Services │  │          │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────┼─────────────┼─────────────┼─────────┘
        │             │             │             │
        └─────────────┴──────┬──────┴─────────────┘
                             │
┌────────────────────────────▼──────────────────────────────┐
│              Gov Contract Platform                          │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Web Application (React)                            │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │  │
│  │  │Contract │ │ Vendor  │ │Document │ │Report   │  │  │
│  │  │ Module  │ │ Module  │ │ Module  │ │ Module  │  │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  API Layer (FastAPI)                                │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Data Layer                                         │  │
│  │  PostgreSQL │ Neo4j │ Redis │ MinIO │ Elasticsearch│  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Key Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Contract Management | สร้าง แก้ไข ติดตามสัญญา | Critical |
| Vendor Management | ทะเบียนผู้รับจ้าง | Critical |
| Document Management | จัดการเอกสารแนบ | Critical |
| OCR & AI | ถอดความเอกสารอัตโนมัติ | High |
| Knowledge Base | คลังความรู้และ RAG | High |
| Automation | Agent อัตโนมัติ | Medium |
| Reporting | รายงานและแดชบอร์ด | High |
| Security | ความปลอดภัยและ Audit | Critical |

---

## 3. Functional Requirements

### 3.1 Contract Management Module

#### UC-001: Create Contract
**Actor**: Officer  
**Description**: สร้างสัญญาใหม่ในระบบ

**Preconditions**:
- ผู้ใช้ล็อกอินแล้ว
- มีสิทธิ์สร้างสัญญา

**Main Flow**:
1. ผู้ใช้เลือก "สร้างสัญญาใหม่"
2. ระบบแสดงฟอร์มสร้างสัญญา
3. ผู้ใช้กรอกข้อมูลสัญญา
4. ผู้ใช้เลือกผู้รับจ้าง
5. ผู้ใช้อัปโหลดเอกสาร (ถ้ามี)
6. ระบบบันทึกสัญญา
7. ระบบส่งการแจ้งเตือน

**Postconditions**:
- สัญญาถูกบันทึกในฐานข้อมูล
- สถานะเป็น "Draft"

#### UC-002: Contract Approval Workflow
**Actor**: Manager, Officer  
**Description**: อนุมัติสัญญา

**States**:
```
[Draft] → [Pending Approval] → [Active] → [Completed]
   ↓           ↓                  ↓
[Rejected]  [Returned]       [Terminated]
```

#### UC-003: Contract Search
**Actor**: All Users  
**Description**: ค้นหาสัญญา

**Search Criteria**:
- เลขที่สัญญา
- ชื่อสัญญา
- ผู้รับจ้าง
- สถานะ
- ช่วงวันที่
- มูลค่า
- ประเภทสัญญา

### 3.2 Vendor Management Module

#### UC-004: Vendor Registration
**Actor**: Officer  
**Description**: ลงทะเบียนผู้รับจ้างใหม่

**Required Fields**:
- ชื่อบริษัท/บุคคล
- ประเภทผู้รับจ้าง
- เลขประจำตัวผู้เสียภาษี
- ที่อยู่
- อีเมล
- เบอร์โทรศัพท์

**Validation**:
- ตรวจสอบความซ้ำซ้อน
- ตรวจสอบรูปแบบอีเมล
- ตรวจสอบเลขผู้เสียภาษี

#### UC-005: Vendor Blacklist
**Actor**: Manager  
**Description**: แบล็คลิสต์ผู้รับจ้าง

**Requirements**:
- ต้องมีเหตุผลและหลักฐาน
- ระบบแจ้งเตือนสัญญาที่เกี่ยวข้อง
- บันทึกประวัติการแบล็คลิสต์

### 3.3 Document Management Module

#### UC-006: Document Upload
**Actor**: Officer  
**Description**: อัปโหลดเอกสาร

**Supported Formats**:
- PDF
- DOC/DOCX
- JPG/PNG/TIFF
- ขนาดไฟล์สูงสุด: 50MB

**Features**:
- Drag & Drop
- Multiple file upload
- Progress indicator
- OCR processing

#### UC-007: OCR Processing
**Actor**: System  
**Description**: ถอดความเอกสารอัตโนมัติ

**Extracted Fields**:
- เลขที่สัญญา
- วันที่
- คู่สัญญา
- มูลค่า
- ระยะเวลา
- เงื่อนไขสำคัญ

### 3.4 AI & Automation Module

#### UC-008: AI Contract Analysis
**Actor**: Officer  
**Description**: วิเคราะห์สัญญาด้วย AI

**Analysis Types**:
- Risk Assessment
- Compliance Check
- Clause Extraction
- Summary Generation

#### UC-009: Agent Automation
**Actor**: System  
**Description**: ระบบ Automation

**Trigger Types**:
- Time-based (Schedule)
- Event-based (Contract created, etc.)
- Condition-based (Expiry date)

**Action Types**:
- Send Email
- Create Notification
- Update Status
- Generate Report

---

## 4. Non-Functional Requirements

### 4.1 Performance Requirements

| Metric | Requirement | Measurement |
|--------|-------------|-------------|
| Page Load Time | < 3 seconds | Lighthouse |
| API Response Time | < 500ms (p95) | APM |
| OCR Processing | < 30 seconds | Timer |
| AI Response | < 10 seconds | Timer |
| Concurrent Users | 100+ | Load Test |
| Availability | 99.5% Uptime | Monitoring |

### 4.2 Security Requirements

#### Authentication
- JWT-based authentication
- Access token expiry: 30 minutes
- Refresh token expiry: 7 days
- Support 2FA (TOTP)

#### Authorization
- Role-Based Access Control (RBAC)
- Permission-based access
- Resource-level authorization

#### Data Protection
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- Field-level encryption for sensitive data
- Secure password hashing (bcrypt)

#### Audit
- Log all actions
- Immutable audit trail
- User activity tracking
- Data change history

### 4.3 Scalability Requirements

- Horizontal scaling support
- Database read replicas
- Caching layer (Redis)
- CDN for static assets
- Auto-scaling (Kubernetes)

### 4.4 Usability Requirements

- Responsive design (Mobile, Tablet, Desktop)
- Thai language support
- Accessibility (WCAG 2.1 AA)
- Keyboard navigation
- Screen reader support

---

## 5. System Architecture

### 5.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Web App    │  │  Mobile App  │  │   API Client │      │
│  │   (React)    │  │   (Future)   │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Gateway Layer                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Nginx (Load Balancer, SSL, Rate Limiting)          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  FastAPI Backend                     │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐          │    │
│  │  │  REST    │ │  GraphQL │ │ WebSocket│          │    │
│  │  │   API    │ │   API    │ │  (Future)│          │    │
│  │  └──────────┘ └──────────┘ └──────────┘          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  Celery  │ │  Redis   │ │Elasticsearch│ │  AI     │      │
│  │  Worker  │ │  Cache   │ │   Search   │ │Service  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │PostgreSQL│ │  Neo4j   │ │  MinIO   │ │  Vector  │      │
│  │  (SQL)   │ │ (Graph)  │ │ (Object) │ │  Store   │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 18.x |
| Backend | FastAPI | 0.100+ |
| Database | PostgreSQL | 15+ |
| Graph DB | Neo4j | 5.15+ |
| Cache | Redis | 7.x |
| Object Storage | MinIO | Latest |
| Search | Elasticsearch | 8.x |
| AI/ML | Python + LangChain | Latest |
| OCR | Tesseract | 5.x |

---

## 6. Data Requirements

### 6.1 Data Models

See [DATA-DICTIONARY.md](./DATA-DICTIONARY.md) for detailed data dictionary.

### 6.2 Data Retention

| Data Type | Retention Period | Archive Policy |
|-----------|------------------|----------------|
| Active Contracts | 5 years after completion | Move to archive |
| Completed Contracts | 10 years | Keep in main DB |
| Audit Logs | 7 years | Compress after 1 year |
| Session Data | 30 days | Auto delete |
| Temporary Files | 7 days | Auto delete |

### 6.3 Backup Requirements

- Daily full backup
- Hourly incremental backup
- Cross-region backup (for production)
- 30-day retention for backups
- Quarterly backup testing

---

## 7. Interface Requirements

### 7.1 User Interfaces

#### Web Application
- Responsive design
- Support browsers: Chrome, Firefox, Safari, Edge (last 2 versions)
- Minimum resolution: 1280x768

#### Mobile (Future)
- Progressive Web App (PWA)
- iOS 14+ and Android 10+

### 7.2 API Interfaces

See [API-INTEGRATION.md](./API-INTEGRATION.md) for detailed API documentation.

### 7.3 Integration Interfaces

| System | Integration Type | Purpose |
|--------|------------------|---------|
| Government SSO | OAuth 2.0 | Authentication |
| Email Server | SMTP | Notifications |
| SMS Gateway | REST API | Alerts |
| AI Services | REST API | OCR, Analysis |
| Document Storage | S3 API | File storage |

---

## 8. Security Specifications

### 8.1 Authentication Requirements

- Multi-factor authentication (MFA) support
- Password policy: min 8 chars, uppercase, lowercase, number, special char
- Account lockout after 5 failed attempts
- Session timeout: 30 minutes idle
- Concurrent session limit: 3 per user

### 8.2 Authorization Matrix

| Feature | Admin | Manager | Officer | Viewer |
|---------|-------|---------|---------|--------|
| Create Contract | ✓ | ✓ | ✓ | ✗ |
| Approve Contract | ✓ | ✓ | ✗ | ✗ |
| Delete Contract | ✓ | ✗ | ✗ | ✗ |
| Manage Vendors | ✓ | ✓ | ✓ | ✗ |
| Blacklist Vendor | ✓ | ✓ | ✗ | ✗ |
| View Reports | ✓ | ✓ | ✓ | ✓ |
| System Settings | ✓ | ✗ | ✗ | ✗ |
| Manage Users | ✓ | ✗ | ✗ | ✗ |

### 8.3 Security Controls

- Input validation and sanitization
- SQL injection prevention (ORM)
- XSS protection
- CSRF protection
- Rate limiting
- Security headers (HSTS, CSP, X-Frame-Options)
- Regular security scanning

---

## 9. Quality Attributes

### 9.1 Reliability

- MTBF: > 720 hours
- MTTR: < 4 hours
- Automated failover
- Circuit breaker pattern

### 9.2 Maintainability

- Code coverage: > 80%
- Documentation coverage: 100%
- Modular architecture
- Standard coding conventions

### 9.3 Portability

- Docker containerization
- Kubernetes deployment
- Cloud-agnostic design
- Configuration externalization

---

## 10. Compliance Requirements

### 10.1 Legal Compliance

- PDPA (Personal Data Protection Act)
- Government procurement regulations
- Electronic transaction laws
- Archiving requirements

### 10.2 Standards Compliance

- WCAG 2.1 AA (Accessibility)
- ISO 27001 (Security)
- ISO 9001 (Quality)

---

## 11. Testing Requirements

### 11.1 Testing Levels

| Level | Coverage | Tools |
|-------|----------|-------|
| Unit Test | > 80% | pytest |
| Integration Test | Critical paths | pytest + TestContainers |
| E2E Test | Core workflows | Playwright |
| Load Test | 100 concurrent | Locust |
| Security Test | OWASP Top 10 | OWASP ZAP |

### 11.2 Test Environments

- Development
- Testing/QA
- Staging
- Production

---

## 12. Deployment Requirements

### 12.1 Infrastructure Requirements

| Component | Specification |
|-----------|---------------|
| CPU | 4+ cores |
| RAM | 16GB+ |
| Storage | 100GB+ SSD |
| Network | 1Gbps |
| OS | Linux (Ubuntu 22.04 LTS) |

### 12.2 Deployment Environments

| Environment | Purpose | Specs |
|-------------|---------|-------|
| Development | Development | 2 vCPU, 4GB RAM |
| Testing | QA Testing | 2 vCPU, 4GB RAM |
| Staging | Pre-production | 4 vCPU, 8GB RAM |
| Production | Live | 8 vCPU, 16GB RAM |

---

## 13. Documentation Requirements

### 13.1 User Documentation

- User Manual
- Quick Start Guide
- Video Tutorials
- FAQ

### 13.2 Technical Documentation

- System Architecture
- API Documentation
- Deployment Guide
- Troubleshooting Guide

### 13.3 Training Materials

- Training Manual
- Workshop Materials
- Assessment Tests

---

## 14. Acceptance Criteria

### 14.1 Functional Acceptance

- [ ] All use cases implemented and tested
- [ ] All features working as specified
- [ ] Integration with external systems complete
- [ ] Data migration successful

### 14.2 Non-Functional Acceptance

- [ ] Performance meets requirements
- [ ] Security audit passed
- [ ] Accessibility compliance verified
- [ ] Load testing passed

### 14.3 User Acceptance

- [ ] UAT completed
- [ ] User feedback incorporated
- [ ] Training completed
- [ ] Sign-off obtained

---

## 15. Appendices

### Appendix A: Glossary

| Term | Definition |
|------|------------|
| Contract | สัญญาที่ทำระหว่างหน่วยงานราชการกับผู้รับจ้าง |
| Vendor | ผู้รับจ้าง/คู่สัญญา |
| OCR | Optical Character Recognition |
| RAG | Retrieval-Augmented Generation |
| RBAC | Role-Based Access Control |

### Appendix B: References

- [WALKTHROUGH.md](./WALKTHROUGH.md)
- [PRD.md](./PRD.md)
- [TECH-DESIGN.md](./TECH-DESIGN.md)
- [API-INTEGRATION.md](./API-INTEGRATION.md)

### Appendix C: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2023-11-01 | n00n0i | Initial version |
| 2.0 | 2024-02-28 | n00n0i | Updated for v2.0 |

---

**End of Document**
