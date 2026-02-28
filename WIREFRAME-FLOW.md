# Wireframe Flow Document

> เอกสาร Flow การใช้งาน Gov Contract Platform

**Version**: 2.0  
**Last Updated**: กุมภาพันธ์ 2026

---

## สารบัญ

1. [User Flows Overview](#user-flows-overview)
2. [Authentication Flows](#authentication-flows)
3. [Contract Management Flows](#contract-management-flows)
4. [Vendor Management Flows](#vendor-management-flows)
5. [Document Upload Flows](#document-upload-flows)
6. [AI & Automation Flows](#ai--automation-flows)
7. [Admin Flows](#admin-flows)

---

## User Flows Overview

### User Personas

| Persona | Role | Goals |
|---------|------|-------|
| **Admin** | ผู้ดูแลระบบ | จัดการผู้ใช้ ตั้งค่าระบบ |
| **Manager** | ผู้จัดการ | อนุมัติสัญญา ดูรายงาน |
| **Officer** | เจ้าหน้าที่ | สร้าง/แก้ไขสัญญา |
| **Viewer** | ผู้ดูข้อมูล | ดูรายงาน ตรวจสอบ |

---

## Authentication Flows

### Flow 1: Login

```
[Start]
   │
   ▼
[Login Page]
   │
   ├── Enter Credentials ────┐
   │                         │
   ▼                         │
[Validate]                   │
   │                         │
   ├── Valid ──► [2FA?] ─────┤
   │              │          │
   │              ├── Yes ────┤
   │              │    │      │
   │              │    ▼      │
   │              │ [Verify]  │
   │              │    │      │
   │              │    └──►───┤
   │              │           │
   │              └── No ─────┤
   │                         │
   ▼                         │
[Dashboard] ◄────────────────┘
   │
   ▼
[End]

Invalid Credentials Path:
[Validate] ──► [Show Error] ──► [Login Page]
```

### Flow 2: 2FA Setup

```
[Settings Page]
      │
      ▼
[Security Settings]
      │
      ▼
[Enable 2FA]
      │
      ▼
[Generate QR Code]
      │
      ▼
[User Scan with App] ──► [Enter Code]
                              │
                              ▼
                         [Verify Code]
                              │
                    ┌─────────┴─────────┐
                    │                   │
                 Valid              Invalid
                    │                   │
                    ▼                   ▼
            [Save Secret]        [Show Error]
                    │                   │
                    ▼                   │
            [Show Backup Codes] ◄───────┘
                    │
                    ▼
            [Complete]
```

---

## Contract Management Flows

### Flow 3: Create New Contract

```
[Contract List]
      │
      ├── Click [+ New Contract]
      │
      ▼
[Create Contract - Step 1]
      │
      ├── Fill Basic Info
      │   ├── Contract Number
      │   ├── Title
      │   ├── Type
      │   ├── Value
      │   └── Dates
      │
      ▼
[Validation]
      │
      ├── Valid ────────────┐
      │                     │
      ▼                     │
[Create Contract - Step 2]  │
      │                     │
      ├── Select Vendor     │
      │   ├── Search        │
      │   ├── Select Existing
      │   └── Create New    │
      │                     │
      ▼                     │
[Create Contract - Step 3]  │
      │                     │
      ├── Upload Documents  │
      │   ├── Drag & Drop   │
      │   ├── Browse        │
      │   └── OCR Process   │
      │                     │
      ▼                     │
[Review]                    │
      │                     │
      ├── Edit ─────────────┤
      │                     │
      ▼                     │
[Save Contract] ◄───────────┘
      │
      ├── Save as Draft
      │
      └── Submit for Approval
                │
                ▼
         [Notification Sent]
                │
                ▼
         [Contract Created]
```

### Flow 4: Contract Approval Workflow

```
[Contract in Draft]
         │
         ├── Submit for Approval
         │
         ▼
[Pending Approval]
         │
         ├── Manager Notification
         │
         ▼
[Manager Review]
         │
         ├───────────────┬───────────────┐
         │               │               │
      Approve        Reject         Request Changes
         │               │               │
         ▼               ▼               ▼
    [Active]      [Rejected]      [Back to Draft]
         │               │               │
         ▼               ▼               ▼
   [Notify User]  [Notify User]   [Notify User]
         │               │               │
         └───────────────┴───────────────┘
                           │
                           ▼
                    [Update Status]
```

### Flow 5: Contract Search & Filter

```
[Contract List]
      │
      ├────── Enter Search Term
      │            │
      │            ▼
      │      [Real-time Search]
      │            │
      │            ▼
      │      [Filter Results]
      │            │
      ├────────────┤
      │            │
      ├────── Select Filters
      │            │
      │            ├── Status
      │            ├── Type
      │            ├── Date Range
      │            └── Vendor
      │
      ▼
[Apply Filters]
      │
      ▼
[Update Results]
      │
      ▼
[Display Filtered List]
      │
      ├────── Clear Filters ──► [Reset to All]
      │
      └────── Save Search ────► [Saved Searches]
```

### Flow 6: Contract Expiry Alert

```
[System Check Daily]
         │
         ▼
[Scan Active Contracts]
         │
         ├── Find Expiring (< 60 days)
         │
         ▼
[Calculate Days Left]
         │
         ├───────────┬───────────┬───────────┐
         │           │           │           │
       60 days     30 days     14 days    Expired
         │           │           │           │
         ▼           ▼           ▼           ▼
   [Yellow Alert] [Orange Alert] [Red Alert] [Expired]
         │           │           │           │
         └───────────┴───────────┴───────────┘
                           │
                           ▼
                  [Send Notifications]
                           │
              ┌────────────┼────────────┐
              │            │            │
         In-App        Email       Dashboard
              │            │            │
              └────────────┴────────────┘
                           │
                           ▼
                  [Log Notification]
```

---

## Vendor Management Flows

### Flow 7: Vendor Registration

```
[Vendor List]
      │
      ├── Click [+ New Vendor]
      │
      ▼
[Vendor Form]
      │
      ├── Basic Information
      │   ├── Name
      │   ├── Type
      │   ├── Tax ID
      │   └── Registration Number
      │
      ├── Contact Information
      │   ├── Email
      │   ├── Phone
      │   └── Address
      │
      ├── Documents
      │   ├── Company Certificate
      │   ├── ID Card
      │   └── Other Documents
      │
      ▼
[Validation]
      │
      ├── Check Duplicates
      ├── Validate Email Format
      ├── Verify Tax ID
      │
      ▼
[Save Vendor]
      │
      ├── Send Verification Email
      │
      ▼
[Pending Verification]
      │
      ├──────────┬──────────┐
      │          │          │
   Verified   Rejected   Timeout
      │          │          │
      ▼          ▼          ▼
  [Active]  [Rejected]  [Remind]
      │          │          │
      ▼          ▼          ▼
  [Notify]   [Notify]   [Notify]
```

### Flow 8: Vendor Blacklist

```
[Vendor Profile]
      │
      ├── Click [Blacklist]
      │
      ▼
[Blacklist Form]
      │
      ├── Select Reason
      │   ├── Fraud
      │   ├── Contract Breach
      │   ├── Quality Issues
      │   └── Other
      │
      ├── Enter Details
      │   ├── Description
      │   ├── Evidence Upload
      │   └── Date
      │
      ├── Set Duration
      │   ├── Permanent
      │   └── Temporary (Date)
      │
      ▼
[Confirmation]
      │
      ├── Show Impact
      │   ├── Active Contracts
      │   ├── Pending Contracts
      │   └── Affected Users
      │
      ▼
[Confirm Blacklist]
      │
      ▼
[Update Vendor Status]
      │
      ├──────────────┬──────────────┐
      │              │              │
   Suspend        Notify        Update
   Contracts      Related       Search
      │           Parties       Index
      │              │              │
      └──────────────┴──────────────┘
                     │
                     ▼
              [Audit Log]
```

---

## Document Upload Flows

### Flow 9: Document Upload with OCR

```
[Upload Page]
      │
      ├── Select Contract (Existing or New)
      │
      ▼
[Select Document Type]
      │
      ├── Contract
      ├── Amendment
      ├── Guarantee
      ├── Invoice
      ├── Receipt
      └── Other
      │
      ▼
[Upload File]
      │
      ├── Drag & Drop
      │   or
      ├── Browse Files
      │
      ▼
[File Validation]
      │
      ├──────────┬──────────┬──────────┐
      │          │          │          │
   Type      Size       Format     Virus
      │          │          │          │
      ▼          ▼          ▼          ▼
  Check      Check      Check      Scan
      │          │          │          │
      └──────────┴──────────┴──────────┘
                  │
                  ▼
         [Validation Result]
                  │
         ┌────────┴────────┐
         │                 │
      Valid            Invalid
         │                 │
         ▼                 ▼
    [Save to MinIO]   [Show Error]
         │                 │
         ▼                 │
    [Queue OCR Task]      │
         │                │
         ▼                │
    [Processing...]       │
         │                │
         ▼                │
    [OCR Complete]        │
         │                │
         ▼                │
    [Extract Data]        │
         │                │
         ▼                │
    [AI Enhancement]      │
         │                │
         ▼                │
    [Show Results] ◄──────┘
         │
         ├── Review & Edit
         │
         ▼
    [Confirm & Save]
```

### Flow 10: Batch Document Upload

```
[Upload Page]
      │
      ├── Select Multiple Files
      │
      ▼
[File List Display]
      │
      ├────── For Each File
      │            │
      │            ├── Validate
      │            │      │
      │            │   ┌──┴──┐
      │            │   │     │
      │            │ Valid Invalid
      │            │   │     │
      │            │   ▼     ▼
      │            │  [✓]  [✗]
      │            │
      ▼            │
[All Files Validated]
      │
      ▼
[Confirm Upload All]
      │
      ▼
[Upload Progress]
      │
      ├── Show Progress Bar
      ├── File: 1/10 Complete
      ├── Estimated Time
      │
      ▼
[Upload Complete]
      │
      ├────── Options
      │            ├── View Documents
      │            ├── Process OCR All
      │            └── Upload More
      │
      ▼
[Go to Contract]
```

---

## AI & Automation Flows

### Flow 11: AI Contract Analysis

```
[Contract Detail]
      │
      ├── Click [AI Analysis]
      │
      ▼
[Select Analysis Type]
      │
      ├── Risk Assessment
      ├── Compliance Check
      ├── Clause Extraction
      └── Summary Generation
      │
      ▼
[Process Document]
      │
      ├── Load Contract Text
      ├── Preprocess
      │   ├── Tokenize
      │   ├── Clean Text
      │   └── Segment
      │
      ▼
[AI Processing]
      │
      ├── Send to LLM
      │   ├── Context Building
      │   ├── Prompt Engineering
      │   └── API Call
      │
      ▼
[Receive Results]
      │
      ├── Parse Response
      ├── Format Output
      │
      ▼
[Display Analysis]
      │
      ├────── Results
      │            ├── Risk Score
      │            ├── Risk Factors
      │            ├── Suggestions
      │            └── Confidence
      │
      ▼
[User Actions]
      │
      ├── Export Report
      ├── Save to Notes
      ├── Share with Team
      └── Run Another Analysis
```

### Flow 12: Knowledge Base Query (RAG)

```
[Knowledge Base Page]
      │
      ├── Enter Question
      │   Example: "ระเบียบจัดซื้อจัดจ้าง 2566 มีอะไรบ้าง?"
      │
      ▼
[Process Query]
      │
      ├── Generate Embedding
      │   ├── Text Preprocessing
      │   ├── Vector Encoding
      │   └── Query Vector
      │
      ▼
[Vector Search]
      │
      ├── Similarity Search
      │   ├── Top-K Retrieval
      │   ├── Score Threshold
      │   └── Filter by Category
      │
      ▼
[Retrieve Documents]
      │
      ├── Get Context
      │   ├── Document 1 (Score: 0.95)
      │   ├── Document 2 (Score: 0.89)
      │   └── Document 3 (Score: 0.82)
      │
      ▼
[LLM Generation]
      │
      ├── Build Prompt
      │   ├── System Message
      │   ├── Context
      │   └── User Question
      │
      ▼
[Generate Response]
      │
      ▼
[Display Answer]
      │
      ├────── Answer
      │            ├── Main Response
      │            ├── Bullet Points
      │            └── Citations
      │
      ├────── Sources
      │            ├── [Doc 1] Link
      │            ├── [Doc 2] Link
      │            └── [Doc 3] Link
      │
      ▼
[User Actions]
      │
      ├── Ask Follow-up
      ├── Save Response
      ├── Export to PDF
      └── Provide Feedback
```

### Flow 13: Agent Automation Setup

```
[Agent Settings]
      │
      ├── Click [Create Agent]
      │
      ▼
[Agent Configuration]
      │
      ├── Basic Info
      │   ├── Name
      │   ├── Description
      │   └── Status (Active/Inactive)
      │
      ▼
[Select Trigger]
      │
      ├── Contract Created
      ├── Contract Expiring
      ├── Document Uploaded
      ├── Status Changed
      ├── Schedule (Cron)
      └── Custom Event
      │
      ▼
[Configure Trigger]
      │
      ├── Set Conditions
      │   ├── Contract Type = Construction
      │   ├── Value > 1,000,000
      │   └── Days to Expiry < 30
      │
      ▼
[Select Action]
      │
      ├── Send Email
      ├── Create Notification
      ├── Update Status
      ├── Call Webhook
      ├── Generate Report
      └── AI Analysis
      │
      ▼
[Configure Action]
      │
      ├── For Email:
      │   ├── Recipients
      │   ├── Subject Template
      │   ├── Body Template
      │   └── Variables
      │
      ▼
[Test Agent]
      │
      ├──────────┬──────────┐
      │          │          │
    Simulate   Manual     Skip
      │          │          │
      ▼          ▼          │
  [Run Test] [Test Data]   │
      │          │          │
      └──────────┴──────────┘
                  │
                  ▼
         [Review Results]
                  │
         ┌────────┴────────┐
         │                 │
      Success           Failed
         │                 │
         ▼                 ▼
    [Save Agent]     [Debug & Fix]
         │                 │
         ▼                 │
    [Activate] ◄───────────┘
```

---

## Admin Flows

### Flow 14: User Management

```
[Admin Dashboard]
      │
      ├── Users Menu
      │
      ▼
[User List]
      │
      ├────── Filter/Search
      │            ├── By Role
      │            ├── By Department
      │            ├── By Status
      │            └── By Name/Email
      │
      ▼
[User Actions]
      │
      ├────── Create User
      │            │
      │            ├── Fill Form
      │            │   ├── Name
      │            │   ├── Email
      │            │   ├── Role
      │            │   └── Department
      │            │
      │            ├── Generate Password
      │            │
      │            └── Send Welcome Email
      │
      ├────── Edit User
      │            ├── Update Info
      │            ├── Change Role
      │            ├── Reset Password
      │            └── Enable/Disable
      │
      ├────── View User
      │            ├── Profile
      │            ├── Activity Log
      │            ├── Contracts
      │            └── Permissions
      │
      └────── Delete User
                   ├── Soft Delete
                   ├── Transfer Ownership
                   └── Archive Data
```

### Flow 15: System Settings

```
[Settings Page]
      │
      ├── Select Category
      │
      ├────── General Settings
      │            ├── Organization Name
      │            ├── Logo
      │            ├── Timezone
      │            ├── Language
      │            └── Currency
      │
      ├────── Security Settings
      │            ├── Password Policy
      │            ├── Session Timeout
      │            ├── 2FA Requirements
      │            └── IP Whitelist
      │
      ├────── Email Settings
      │            ├── SMTP Configuration
      │            ├── Default Templates
      │            ├── Sender Address
      │            └── Test Email
      │
      ├────── AI Settings
      │            ├── Default Provider
      │            ├── API Keys
      │            ├── Model Selection
      │            └── Usage Limits
      │
      ├────── Notification Settings
      │            ├── Default Channels
      │            ├── Alert Thresholds
      │            └── Escalation Rules
      │
      └────── Backup Settings
                   ├── Schedule
                   ├── Retention
                   ├── Storage
                   └── Test Restore
      │
      ▼
[Save Settings]
      │
      ├── Validation
      │
      ▼
[Apply Changes]
      │
      ├── Update Configuration
      ├── Restart Services (if needed)
      └── Log Changes
```

---

## Error Handling Flows

### Flow 16: Error Recovery

```
[Error Occurred]
      │
      ├── Detect Error
      │   ├── API Error
      │   ├── Validation Error
      │   ├── Network Error
      │   └── System Error
      │
      ▼
[Classify Error]
      │
      ├──────────┬──────────┬──────────┐
      │          │          │          │
  Recoverable  Validation  Network   System
      │          │          │          │
      ▼          ▼          ▼          ▼
   [Retry]   [Show Msg]  [Retry]   [Alert]
      │          │          │          │
      ▼          ▼          ▼          ▼
  Success?   User Fix   Success?   Log Error
      │                     │          │
   ┌──┴──┐               ┌──┴──┐       │
   │     │               │     │       │
  Yes   No              Yes   No       │
   │     │               │     │       │
   ▼     │               ▼     │       │
[Continue]│          [Continue]│       │
   │      │               │     │       │
   └──►───┘               └──►──┘       │
         │                              │
         └──────────────┬───────────────┘
                        │
                        ▼
                 [Show Error Page]
                        │
                        ├── Error Code
                        ├── Description
                        ├── Suggested Actions
                        └── Contact Support
```

---

**Document Version**: 2.0  
**Last Updated**: กุมภาพันธ์ 2026
