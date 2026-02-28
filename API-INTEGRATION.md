# API Integration Guide

> คู่มือการเชื่อมต่อ API สำหรับนักพัฒนา

**Version**: 2.0  
**Base URL**: `http://localhost:8000/api/v1`  
**Last Updated**: กุมภาพันธ์ 2026

---

## สารบัญ

1. [เริ่มต้นใช้งาน](#เริ่มต้นใช้งาน)
2. [Authentication](#authentication)
3. [Error Handling](#error-handling)
4. [Pagination](#pagination)
5. [Endpoints Reference](#endpoints-reference)
6. [Examples](#examples)
7. [Rate Limiting](#rate-limiting)

---

## เริ่มต้นใช้งาน

### Base URL

```
http://localhost:8000/api/v1
```

### Headers ที่จำเป็น

```http
Content-Type: application/json
Authorization: Bearer <access_token>
```

### Test API

```bash
curl http://localhost:8000/api/v1/health
```

---

## Authentication

### 1. Login

```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "expires_in": 1800
  }
}
```

### 2. Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### 3. Logout

```http
POST /auth/logout
Authorization: Bearer <access_token>
```

### 4. Get Current User

```http
GET /auth/me
Authorization: Bearer <access_token>
```

---

## Error Handling

### Error Response Format

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

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | ไม่ได้รับอนุญาต |
| `FORBIDDEN` | 403 | ไม่มีสิทธิ์ |
| `NOT_FOUND` | 404 | ไม่พบข้อมูล |
| `VALIDATION_ERROR` | 422 | ข้อมูลไม่ถูกต้อง |
| `INTERNAL_ERROR` | 500 | ข้อผิดพลาดระบบ |
| `RATE_LIMITED` | 429 | เรียก API ถี่เกินไป |

---

## Pagination

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | หน้าที่ต้องการ |
| `page_size` | integer | 20 | จำนวนรายการต่อหน้า (max 100) |

### Response Format

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 156,
    "pages": 8,
    "has_next": true,
    "has_prev": false
  }
}
```

---

## Endpoints Reference

### Contracts

#### List Contracts

```http
GET /contracts?page=1&page_size=20&status=active&search=keyword
```

**Query Parameters**:
- `status`: draft, pending_approval, active, completed, terminated, expired
- `search`: ค้นหาจากชื่อสัญญา, เลขที่สัญญา
- `vendor_id`: กรองตามผู้รับจ้าง
- `start_date_from`, `start_date_to`: ช่วงวันเริ่มสัญญา

#### Get Contract

```http
GET /contracts/{id}
```

#### Create Contract

```http
POST /contracts
Content-Type: application/json
Authorization: Bearer <token>

{
  "contract_number": "64/2566",
  "title": "สัญญาจ้างก่อสร้างอาคาร",
  "description": "รายละเอียดสัญญา...",
  "contract_type": "construction",
  "value_original": 5000000,
  "vat_rate": 7.0,
  "start_date": "2023-01-01",
  "end_date": "2023-12-31",
  "vendor_id": "uuid-of-vendor"
}
```

#### Update Contract

```http
PUT /contracts/{id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "สัญญาจ้างก่อสร้างอาคาร (แก้ไข)",
  "status": "active"
}
```

#### Delete Contract

```http
DELETE /contracts/{id}
Authorization: Bearer <token>
```

#### Get Contract Statistics

```http
GET /contracts/stats/summary
```

**Response**:
```json
{
  "success": true,
  "data": {
    "total_contracts": 156,
    "active_contracts": 89,
    "pending_approval": 12,
    "expiring_soon": 5,
    "total_value": 125000000.00
  }
}
```

---

### Vendors

#### List Vendors

```http
GET /vendors?page=1&page_size=20&status=active&search=keyword
```

#### Create Vendor

```http
POST /vendors
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "บริษัท ก่อสร้างไทย จำกัด",
  "email": "contact@construction.co.th",
  "phone": "02-123-4567",
  "address": "123 ถนนสุขุมวิท...",
  "tax_id": "0123456789012",
  "vendor_type": "company"
}
```

#### Update Vendor

```http
PUT /vendors/{id}
Content-Type: application/json
Authorization: Bearer <token>
```

#### Verify Vendor Email

```http
POST /vendors/{id}/verify-email
Authorization: Bearer <token>
```

#### Blacklist Vendor

```http
POST /vendors/{id}/blacklist
Content-Type: application/json
Authorization: Bearer <token>

{
  "reason": "ไม่ปฏิบัติตามสัญญาหลายครั้ง"
}
```

---

### Documents

#### Upload Document

```http
POST /documents/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
- file: <binary_file>
- contract_id: "uuid-of-contract"
- document_type: "contract"
```

#### Get Document

```http
GET /documents/{id}
```

#### Download Document

```http
GET /documents/{id}/download
Authorization: Bearer <token>
```

#### Trigger OCR

```http
POST /documents/{id}/ocr
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "task_id": "celery-task-id",
    "status": "processing"
  }
}
```

#### Get OCR Result

```http
GET /documents/{id}/ocr-result
```

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "text": "ข้อความที่ถอดความได้...",
    "extracted_data": {
      "contract_number": "64/2566",
      "value": 5000000,
      "start_date": "2023-01-01"
    }
  }
}
```

---

### Knowledge Base

#### List KB Documents

```http
GET /knowledge-base/documents?page=1&page_size=20
```

#### Upload to KB

```http
POST /knowledge-base/documents
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
- file: <binary_file>
- category: "regulations"
- tags: ["purchasing", "2566"]
```

#### Query KB (RAG)

```http
POST /knowledge-base/query
Content-Type: application/json
Authorization: Bearer <token>

{
  "query": "ระเบียบจัดซื้อจัดจ้าง 2566",
  "top_k": 5,
  "filters": {
    "category": "regulations"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "answer": "ตามระเบียบจัดซื้อจัดจ้าง 2566...",
    "sources": [
      {
        "document_id": "uuid",
        "title": "ระเบียบจัดซื้อจัดจ้าง",
        "relevance_score": 0.95
      }
    ]
  }
}
```

#### Chat with KB

```http
POST /knowledge-base/chat
Content-Type: application/json
Authorization: Bearer <token>

{
  "message": "สัญญาประเภทไหนต้องใช้บัญชีรายชื่อ?",
  "conversation_id": "uuid"  // optional
}
```

---

### AI

#### Analyze Contract

```http
POST /ai/analyze-contract
Content-Type: application/json
Authorization: Bearer <token>

{
  "contract_id": "uuid-of-contract",
  "analysis_type": "risk"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "risks": [
      {
        "level": "high",
        "category": "payment",
        "description": "ไม่มีการกำหนดค่าปรับล่าช้า"
      }
    ],
    "suggestions": [
      "ควรเพิ่มเงื่อนไขค่าปรับล่าช้า"
    ]
  }
}
```

#### Extract from Document

```http
POST /ai/extract
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
- file: <binary_file>
```

#### Generate Template

```http
POST /ai/generate-template
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
- file: <binary_file>
```

---

### Notifications

#### List Notifications

```http
GET /notifications?page=1&page_size=20&is_read=false
Authorization: Bearer <token>
```

#### Mark as Read

```http
PUT /notifications/{id}/read
Authorization: Bearer <token>
```

#### Mark All as Read

```http
PUT /notifications/read-all
Authorization: Bearer <token>
```

#### Delete Notification

```http
DELETE /notifications/{id}
Authorization: Bearer <token>
```

---

## Examples

### Complete Workflow: Create Contract with Document

```python
import requests

BASE_URL = "http://localhost:8000/api/v1"

# 1. Login
response = requests.post(f"{BASE_URL}/auth/login", json={
    "username": "admin",
    "password": "admin123"
})
token = response.json()["data"]["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 2. Create Vendor
vendor_response = requests.post(f"{BASE_URL}/vendors", 
    headers=headers,
    json={
        "name": "บริษัท ทดสอบ จำกัด",
        "email": "test@example.com",
        "tax_id": "1234567890123"
    }
)
vendor_id = vendor_response.json()["data"]["id"]

# 3. Create Contract
contract_response = requests.post(f"{BASE_URL}/contracts",
    headers=headers,
    json={
        "contract_number": "65/2567",
        "title": "สัญญาทดสอบ",
        "contract_type": "service",
        "value_original": 100000,
        "start_date": "2024-01-01",
        "end_date": "2024-12-31",
        "vendor_id": vendor_id
    }
)
contract_id = contract_response.json()["data"]["id"]

# 4. Upload Document
with open("contract.pdf", "rb") as f:
    files = {"file": f}
    data = {
        "contract_id": contract_id,
        "document_type": "contract"
    }
    doc_response = requests.post(f"{BASE_URL}/documents/upload",
        headers=headers,
        files=files,
        data=data
    )

document_id = doc_response.json()["data"]["id"]

# 5. Trigger OCR
requests.post(f"{BASE_URL}/documents/{document_id}/ocr", headers=headers)

print(f"Contract created: {contract_id}")
print(f"Document uploaded: {document_id}")
```

---

## Rate Limiting

### Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/*` | 5 requests | 1 minute |
| `/api/*` | 100 requests | 1 minute |
| `/upload` | 10 requests | 1 minute |
| `/ai/*` | 20 requests | 1 minute |

### Response Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699999999
```

### Rate Limit Exceeded

```http
429 Too Many Requests

{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "retry_after": 60
  }
}
```

---

## SDK & Libraries

### Python

```bash
pip install requests
```

### JavaScript/TypeScript

```bash
npm install axios
```

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

---

## Webhooks (Coming Soon)

### Available Events

- `contract.created`
- `contract.updated`
- `contract.status_changed`
- `document.uploaded`
- `vendor.blacklisted`

### Webhook Payload

```json
{
  "event": "contract.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "contract_id": "uuid",
    "contract_number": "65/2567",
    "title": "สัญญาทดสอบ"
  }
}
```

---

**API Version**: 1.0  
**Documentation**: http://localhost:8000/docs  
**Support**: https://github.com/n00n0i/gov-contract-platform/issues
