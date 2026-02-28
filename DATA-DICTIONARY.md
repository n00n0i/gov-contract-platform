# Data Dictionary

> พจนานุกรมข้อมูล Gov Contract Platform

**Version**: 2.0  
**Last Updated**: กุมภาพันธ์ 2026

---

## สารบัญ

1. [Users](#users)
2. [Contracts](#contracts)
3. [Vendors](#vendors)
4. [Documents](#documents)
5. [Notifications](#notifications)
6. [Knowledge Base](#knowledge-base)
7. [AI & OCR](#ai--ocr)
8. [System](#system)

---

## Users

### ตาราง: `users`

ผู้ใช้งานระบบ

| ฟิลด์ | ประเภท | ค่าเริ่มต้น | คำอธิบาย |
|-------|--------|------------|---------|
| id | UUID | gen_random_uuid() | รหัสผู้ใช้ (PK) |
| username | VARCHAR(50) | - | ชื่อผู้ใช้ (Unique) |
| email | VARCHAR(255) | - | อีเมล (Unique) |
| password_hash | VARCHAR(255) | - | รหัสผ่าน (bcrypt hashed) |
| first_name | VARCHAR(100) | NULL | ชื่อ |
| last_name | VARCHAR(100) | NULL | นามสกุล |
| role | VARCHAR(50) | 'user' | บทบาท (admin/manager/user/viewer) |
| department | VARCHAR(100) | NULL | แผนก |
| is_active | BOOLEAN | true | สถานะการใช้งาน |
| is_2fa_enabled | BOOLEAN | false | เปิดใช้ 2FA |
| two_factor_secret | VARCHAR(255) | NULL | Secret key สำหรับ 2FA |
| last_login | TIMESTAMP | NULL | เข้าสู่ระบบล่าสุด |
| created_at | TIMESTAMP | NOW() | วันที่สร้าง |
| updated_at | TIMESTAMP | NOW() | วันที่อัปเดต |

### บทบาทผู้ใช้ (Roles)

| บทบาท | คำอธิบาย | สิทธิ์ |
|-------|---------|--------|
| admin | ผู้ดูแลระบบ | ทั้งหมด |
| manager | ผู้จัดการ | จัดการสัญญา รายงาน |
| user | ผู้ใช้ทั่วไป | สร้าง/แก้ไขสัญญาของตัวเอง |
| viewer | ผู้ดูข้อมูล | ดูได้อย่างเดียว |

---

## Contracts

### ตาราง: `contracts`

สัญญาต่างๆ ในระบบ

| ฟิลด์ | ประเภท | ค่าเริ่มต้น | คำอธิบาย |
|-------|--------|------------|---------|
| id | UUID | gen_random_uuid() | รหัสสัญญา (PK) |
| contract_number | VARCHAR(100) | - | เลขที่สัญญา (Unique) |
| title | VARCHAR(500) | - | ชื่อสัญญา |
| description | TEXT | NULL | รายละเอียดสัญญา |
| contract_type | VARCHAR(100) | NULL | ประเภทสัญญา |
| status | VARCHAR(50) | 'draft' | สถานะ |
| value_original | DECIMAL(15,2) | NULL | มูลค่าต้นฉบับ |
| value_with_vat | DECIMAL(15,2) | NULL | มูลค่ารวม VAT |
| vat_rate | DECIMAL(5,2) | 7.0 | อัตรา VAT |
| start_date | DATE | NULL | วันเริ่มสัญญา |
| end_date | DATE | NULL | วันสิ้นสุดสัญญา |
| duration_months | INTEGER | NULL | ระยะเวลา (เดือน) |
| counterparty | VARCHAR(255) | NULL | คู่สัญญา |
| vendor_id | UUID | NULL | รหัสผู้รับจ้าง (FK) |
| created_by | UUID | NULL | สร้างโดย (FK) |
| is_deleted | BOOLEAN | false | ลบแล้ว (Soft Delete) |
| created_at | TIMESTAMP | NOW() | วันที่สร้าง |
| updated_at | TIMESTAMP | NOW() | วันที่อัปเดต |

### ประเภทสัญญา (Contract Types)

| ค่า | คำอธิบาย |
|-----|---------|
| procurement | จัดซื้อจัดจ้าง |
| construction | เหมาก่อสร้าง |
| service | จ้างบริการ |
| consultant | จ้างที่ปรึกษา |
| rental | เช่าทรัพย์สิน |
| concession | สัมปทาน |
| maintenance | ซ่อมบำรุง |
| training | ฝึกอบรม |
| research | วิจัยและพัฒนา |
| software | พัฒนาซอฟต์แวร์ |
| land_sale | ซื้อขายที่ดิน |
| insurance | ประกันภัย |
| advertising | โฆษณา |
| medical | สาธารณสุข |
| agriculture | เกษตรกรรม |

### สถานะสัญญา (Contract Status)

| ค่า | คำอธิบาย | สี |
|-----|---------|-----|
| draft | ร่าง | เทา |
| pending_approval | รออนุมัติ | เหลือง |
| active | กำลังใช้งาน | เขียว |
| completed | เสร็จสิ้น | น้ำเงิน |
| terminated | ยกเลิก | แดง |
| expired | หมดอายุ | ส้ม |

---

## Vendors

### ตาราง: `vendors`

ผู้รับจ้าง/คู่สัญญา

| ฟิลด์ | ประเภท | ค่าเริ่มต้น | คำอธิบาย |
|-------|--------|------------|---------|
| id | UUID | gen_random_uuid() | รหัสผู้รับจ้าง (PK) |
| name | VARCHAR(255) | - | ชื่อบริษัท/บุคคล |
| email | VARCHAR(255) | NULL | อีเมล |
| phone | VARCHAR(50) | NULL | เบอร์โทรศัพท์ |
| address | TEXT | NULL | ที่อยู่ |
| tax_id | VARCHAR(50) | NULL | เลขประจำตัวผู้เสียภาษี |
| vendor_type | VARCHAR(50) | NULL | ประเภท |
| status | VARCHAR(50) | 'active' | สถานะ |
| is_verified | BOOLEAN | false | ยืนยันแล้ว |
| is_blacklisted | BOOLEAN | false | แบล็คลิสต์ |
| blacklist_reason | TEXT | NULL | เหตุผลแบล็คลิสต์ |
| notes | TEXT | NULL | หมายเหตุ |
| created_at | TIMESTAMP | NOW() | วันที่สร้าง |
| updated_at | TIMESTAMP | NOW() | วันที่อัปเดต |

### ประเภทผู้รับจ้าง (Vendor Types)

| ค่า | คำอธิบาย |
|-----|---------|
| company | บริษัท |
| individual | บุคคลธรรมดา |
| partnership | ห้างหุ้นส่วน |
| cooperative | สหกรณ์ |
| state_enterprise | รัฐวิสาหกิจ |
| other | อื่นๆ |

### สถานะผู้รับจ้าง (Vendor Status)

| ค่า | คำอธิบาย |
|-----|---------|
| active | ใช้งาน |
| inactive | ไม่ใช้งาน |
| pending | รอตรวจสอบ |
| suspended | ระงับชั่วคราว |

---

## Documents

### ตาราง: `documents`

เอกสารแนบ

| ฟิลด์ | ประเภท | ค่าเริ่มต้น | คำอธิบาย |
|-------|--------|------------|---------|
| id | UUID | gen_random_uuid() | รหัสเอกสาร (PK) |
| contract_id | UUID | NULL | รหัสสัญญา (FK) |
| document_type | VARCHAR(100) | NULL | ประเภทเอกสาร |
| original_filename | VARCHAR(500) | - | ชื่อไฟล์ต้นฉบับ |
| storage_filename | VARCHAR(500) | - | ชื่อไฟล์ใน Storage |
| mime_type | VARCHAR(100) | NULL | ประเภท MIME |
| file_size | BIGINT | NULL | ขนาดไฟล์ (bytes) |
| storage_bucket | VARCHAR(100) | - | Bucket ใน MinIO |
| storage_path | VARCHAR(1000) | - | Path ใน Storage |
| ocr_status | VARCHAR(50) | 'pending' | สถานะ OCR |
| ocr_text | TEXT | NULL | ข้อความจาก OCR |
| ocr_data | JSONB | NULL | ข้อมูล OCR (structured) |
| extracted_data | JSONB | NULL | ข้อมูลที่สกัดได้ |
| uploaded_by | UUID | NULL | อัปโหลดโดย (FK) |
| created_at | TIMESTAMP | NOW() | วันที่สร้าง |

### ประเภทเอกสาร (Document Types)

| ค่า | คำอธิบาย |
|-----|---------|
| contract | สัญญาหลัก |
| amendment | สัญญาแก้ไข |
| guarantee | หนังสือค้ำประกัน |
| invoice | ใบแจ้งหนี้ |
| receipt | ใบเสร็จ |
| delivery | ใบส่งมอบ |
| tor | Terms of Reference |
| quotation | ใบเสนอราคา |
| other | เอกสารอื่นๆ |

### สถานะ OCR (OCR Status)

| ค่า | คำอธิบาย |
|-----|---------|
| pending | รอดำเนินการ |
| processing | กำลังประมวลผล |
| completed | เสร็จสิ้น |
| failed | ล้มเหลว |
| skipped | ข้าม (ไม่ต้อง OCR) |

---

## Notifications

### ตาราง: `notifications`

การแจ้งเตือน

| ฟิลด์ | ประเภท | ค่าเริ่มต้น | คำอธิบาย |
|-------|--------|------------|---------|
| id | UUID | gen_random_uuid() | รหัสแจ้งเตือน (PK) |
| user_id | UUID | - | รหัสผู้ใช้ (FK) |
| type | VARCHAR(50) | - | ประเภท |
| title | VARCHAR(255) | - | หัวข้อ |
| message | TEXT | - | ข้อความ |
| data | JSONB | NULL | ข้อมูลเพิ่มเติม |
| is_read | BOOLEAN | false | อ่านแล้ว |
| read_at | TIMESTAMP | NULL | เวลาอ่าน |
| created_at | TIMESTAMP | NOW() | วันที่สร้าง |

### ประเภทการแจ้งเตือน (Notification Types)

| ค่า | คำอธิบาย |
|-----|---------|
| contract_expiring | สัญญาใกล้หมดอายุ |
| contract_created | สร้างสัญญาใหม่ |
| contract_approved | อนุมัติสัญญา |
| document_uploaded | อัปโหลดเอกสาร |
| payment_due | ถึงกำหนดจ่ายเงิน |
| vendor_blacklisted | แบล็คลิสต์ผู้รับจ้าง |
| system | ระบบ |

---

## Knowledge Base

### ตาราง: `kb_documents`

เอกสารใน Knowledge Base

| ฟิลด์ | ประเภท | ค่าเริ่มต้น | คำอธิบาย |
|-------|--------|------------|---------|
| id | UUID | gen_random_uuid() | รหัสเอกสาร (PK) |
| title | VARCHAR(500) | - | ชื่อเอกสาร |
| content | TEXT | - | เนื้อหา |
| content_vector | vector(1536) | NULL | Vector embedding |
| source_type | VARCHAR(100) | - | แหล่งที่มา |
| source_url | VARCHAR(1000) | NULL | URL ต้นฉบับ |
| metadata | JSONB | NULL | ข้อมูลเพิ่มเติม |
| category | VARCHAR(100) | NULL | หมวดหมู่ |
| tags | TEXT[] | NULL | แท็ก |
| is_active | BOOLEAN | true | ใช้งาน |
| created_by | UUID | NULL | สร้างโดย (FK) |
| created_at | TIMESTAMP | NOW() | วันที่สร้าง |
| updated_at | TIMESTAMP | NOW() | วันที่อัปเดต |

### ตาราง: `kb_entities`

เอนติตีที่สกัดจาก Knowledge Base (GraphRAG)

| ฟิลด์ | ประเภท | ค่าเริ่มต้น | คำอธิบาย |
|-------|--------|------------|---------|
| id | VARCHAR(255) | - | รหัสเอนติตี (PK) |
| name | VARCHAR(500) | - | ชื่อ |
| entity_type | VARCHAR(100) | - | ประเภท |
| description | TEXT | NULL | คำอธิบาย |
| source_doc_id | UUID | NULL | รหัสเอกสารต้นทาง |
| metadata | JSONB | NULL | ข้อมูลเพิ่มเติม |
| security_level | VARCHAR(50) | 'public' | ระดับความลับ |
| created_at | TIMESTAMP | NOW() | วันที่สร้าง |

### ตาราง: `kb_relationships`

ความสัมพันธ์ระหว่างเอนติตี (GraphRAG)

| ฟิลด์ | ประเภท | ค่าเริ่มต้น | คำอธิบาย |
|-------|--------|------------|---------|
| id | VARCHAR(255) | - | รหัสความสัมพันธ์ (PK) |
| source_id | VARCHAR(255) | - | รหัสเอนติตีต้นทาง |
| target_id | VARCHAR(255) | - | รหัสเอนติตีปลายทาง |
| relationship_type | VARCHAR(100) | - | ประเภทความสัมพันธ์ |
| description | TEXT | NULL | คำอธิบาย |
| source_doc_id | UUID | NULL | รหัสเอกสารต้นทาง |
| metadata | JSONB | NULL | ข้อมูลเพิ่มเติม |
| security_level | VARCHAR(50) | 'public' | ระดับความลับ |
| created_at | TIMESTAMP | NOW() | วันที่สร้าง |

---

## AI & OCR

### ตาราง: `ai_providers`

การตั้งค่า AI Provider

| ฟิลด์ | ประเภท | ค่าเริ่มต้น | คำอธิบาย |
|-------|--------|------------|---------|
| id | UUID | gen_random_uuid() | รหัส (PK) |
| name | VARCHAR(100) | - | ชื่อ Provider |
| provider_type | VARCHAR(50) | - | ประเภท (ollama/openai/typhoon) |
| api_url | VARCHAR(500) | NULL | URL API |
| api_key | VARCHAR(500) | NULL | API Key (encrypted) |
| model_name | VARCHAR(100) | - | ชื่อโมเดล |
| is_active | BOOLEAN | true | ใช้งาน |
| is_default | BOOLEAN | false | ค่าเริ่มต้น |
| config | JSONB | NULL | การตั้งค่าเพิ่มเติม |
| created_at | TIMESTAMP | NOW() | วันที่สร้าง |

### ตาราง: `ocr_extraction_logs`

บันทึกการ OCR

| ฟิลด์ | ประเภท | ค่าเริ่มต้น | คำอธิบาย |
|-------|--------|------------|---------|
| id | UUID | gen_random_uuid() | รหัส (PK) |
| document_id | UUID | - | รหัสเอกสาร |
| status | VARCHAR(50) | - | สถานะ |
| started_at | TIMESTAMP | NULL | เวลาเริ่ม |
| completed_at | TIMESTAMP | NULL | เวลาเสร็จ |
| error_message | TEXT | NULL | ข้อความ Error |
| processing_time_ms | INTEGER | NULL | เวลาประมวลผล (ms) |
| created_at | TIMESTAMP | NOW() | วันที่สร้าง |

---

## System

### ตาราง: `audit_logs`

บันทึกการกระทำ (Audit Trail)

| ฟิลด์ | ประเภท | ค่าเริ่มต้น | คำอธิบาย |
|-------|--------|------------|---------|
| id | UUID | gen_random_uuid() | รหัส (PK) |
| user_id | UUID | NULL | รหัสผู้ใช้ |
| action | VARCHAR(100) | - | การกระทำ |
| entity_type | VARCHAR(100) | - | ประเภทเอนติตี |
| entity_id | UUID | NULL | รหัสเอนติตี |
| old_values | JSONB | NULL | ค่าเก่า |
| new_values | JSONB | NULL | ค่าใหม่ |
| ip_address | VARCHAR(50) | NULL | IP Address |
| user_agent | TEXT | NULL | User Agent |
| created_at | TIMESTAMP | NOW() | วันที่สร้าง |

### ตาราง: `system_settings`

การตั้งค่าระบบ

| ฟิลด์ | ประเภท | ค่าเริ่มต้น | คำอธิบาย |
|-------|--------|------------|---------|
| id | UUID | gen_random_uuid() | รหัส (PK) |
| key | VARCHAR(100) | - | ชื่อการตั้งค่า (Unique) |
| value | TEXT | NULL | ค่า |
| value_type | VARCHAR(50) | 'string' | ประเภทค่า |
| description | TEXT | NULL | คำอธิบาย |
| is_editable | BOOLEAN | true | แก้ไขได้ |
| category | VARCHAR(100) | 'general' | หมวดหมู่ |
| updated_by | UUID | NULL | แก้ไขโดย |
| updated_at | TIMESTAMP | NOW() | วันที่อัปเดต |

---

## ดัชนี (Indexes)

### Users
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
```

### Contracts
```sql
CREATE INDEX idx_contracts_number ON contracts(contract_number);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_vendor ON contracts(vendor_id);
CREATE INDEX idx_contracts_dates ON contracts(start_date, end_date);
CREATE INDEX idx_contracts_created_by ON contracts(created_by);
CREATE INDEX idx_contracts_is_deleted ON contracts(is_deleted) WHERE is_deleted = false;
```

### Documents
```sql
CREATE INDEX idx_documents_contract ON documents(contract_id);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_ocr_status ON documents(ocr_status);
```

### Knowledge Base
```sql
-- Vector Search (pgVector)
CREATE INDEX idx_kb_documents_vector ON kb_documents USING ivfflat (content_vector vector_cosine_ops);

-- Neo4j Indexes (Cypher)
CREATE INDEX entity_name FOR (e:Entity) ON (e.name);
CREATE INDEX entity_type FOR (e:Entity) ON (e.entity_type);
CREATE INDEX relationship_type FOR ()-[r:RELATES_TO]-() ON (r.relationship_type);
```

---

## Constraints

### Foreign Keys
- `contracts.vendor_id` → `vendors.id`
- `contracts.created_by` → `users.id`
- `documents.contract_id` → `contracts.id`
- `documents.uploaded_by` → `users.id`
- `notifications.user_id` → `users.id`

### Unique Constraints
- `users.username`
- `users.email`
- `contracts.contract_number`
- `vendors.tax_id` (ถ้ามี)
- `system_settings.key`

---

**Document Version**: 2.0  
**Last Updated**: กุมภาพันธ์ 2026
