# AI Design Document

> Gov Contract Platform - ระบบบริหารจัดการสัญญาภาครัฐ

**Version**: 2.0  
**Date**: กุมภาพันธ์ 2026  
**Author**: n00n0i

---

## สารบัญ

1. [บทนำ](#บทนำ)
2. [AI Architecture Overview](#ai-architecture-overview)
3. [AI Capabilities](#ai-capabilities)
4. [OCR System Design](#ocr-system-design)
5. [RAG System Design](#rag-system-design)
6. [AI Agent Design](#ai-agent-design)
7. [LLM Integration](#llm-integration)
8. [Data Flow](#data-flow)
9. [Security & Privacy](#security--privacy)
10. [Performance Optimization](#performance-optimization)

---

## บทนำ

### 1.1 วัตถุประสงค์

เอกสารนี้อธิบายการออกแบบระบบ AI สำหรับ Gov Contract Platform ซึ่งประกอบด้วย:

- **OCR System**: ถอดความข้อความจากเอกสาร PDF และรูปภาพ
- **RAG System**: ระบบค้นหาเชิงความหมายด้วย Knowledge Base
- **AI Agent**: ตัวแทนอัจฉริยะที่ทำงานอัตโนมัติ
- **LLM Integration**: การเชื่อมต่อกับ Large Language Models

### 1.2 ขอบเขต

ระบบ AI ครอบคลุม:

- OCR สำหรับถอดความเอกสาร
- Text Extraction และ Normalization
- Knowledge Base Management
- Semantic Search และ RAG
- AI Agent Configuration และ Execution
- LLM Provider Integration (OpenAI, Ollama, Anthropic)

---

## AI Architecture Overview

### 2.1 High-Level AI Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AI Service Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │   OCR        │  │   RAG        │  │   Agent      │  │    LLM     │  │
│  │   Service    │  │   Service    │  │   Service    │  │  Service   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        LLM Provider Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │   OpenAI     │  │   Ollama     │  │  Anthropic   │  │   Local    │  │
│  │   GPT-4/3.5  │  │   Llama3.1   │  │   Claude     │  │  Models    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Data Layer                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  PostgreSQL  │  │  pgvector    │  │   MinIO      │  │ Elasticsearch││
│  │  (Vectors)   │  │   (Embeddings│  │  (Documents) │  │  (Search)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │   Document   │  │   Agent      │  │   Knowledge  │  │    Chat    │  │
│  │   Upload     │  │   Config     │  │   Base       │  │    UI      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Application Layer (FastAPI)                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    AI API Endpoints                              │   │
│  │  • /api/v1/ocr/extract                                           │   │
│  │  • /api/v1/rag/search                                            │   │
│  │  • /api/v1/agents/execute                                        │   │
│  │  • /api/v1/knowledge-bases/...                                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Service Layer                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │   OCR        │  │   RAG        │  │   Agent      │  │    LLM     │  │
│  │   Service    │  │   Service    │  │   Service    │  │  Service   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## AI Capabilities

### 3.1 OCR Capabilities

| Feature | Description | Accuracy Target |
|---------|-------------|-----------------|
| PDF Text Extraction | ถอดความข้อความจาก PDF | > 95% |
| Image OCR | ถอดความจากภาพสแกน | > 85% |
| Thai Language | รองรับภาษาไทย | > 80% |
| English Language | รองรับภาษาอังกฤษ | > 95% |
| Table Detection | ตรวจจับและแยกตาราง | > 75% |
| Form Field Extraction | แยกฟิลด์จากแบบฟอร์ม | > 70% |

### 3.2 RAG Capabilities

| Feature | Description |
|---------|-------------|
| Semantic Search | ค้นหาตามความหมาย ไม่ใช่แค่ keyword |
| Vector Embeddings | ใช้ embeddings สำหรับ representation |
| Hybrid Search | ผสม keyword และ semantic search |
| Relevance Ranking | เรียงผลลัพธ์ตามความเกี่ยวข้อง |
| Context Window | รักษา context ในการตอบคำถาม |

### 3.3 Agent Capabilities

| Feature | Description |
|---------|-------------|
| Trigger-based Execution | ทำงานเมื่อมีเหตุการณ์เกิดขึ้น |
| Custom Prompts | กำหนด prompt ตาม use case |
| Knowledge Integration | ใช้ Knowledge Base ในการตอบคำถาม |
| Output Actions | แสดงผล, บันทึก, สร้าง task, ส่ง email |
| Execution Tracking | ติดตาม execution history |

---

## OCR System Design

### 4.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OCR Pipeline                                     │
│                                                                          │
│  Document Upload → Preprocessing → OCR Engine → Postprocessing → Output │
│       ↓               ↓              ↓              ↓              ↓      │
│    MinIO        Image Clean    Tesseract/     Text Clean      PostgreSQL │
│                 Deskew         DocTR          Formatting      + MinIO    │
│                 Denoise                       Structure                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 OCR Engine Options

| Engine | Pros | Cons | Use Case |
|--------|------|------|----------|
| Tesseract | Open source, Thai support | Slower, less accurate | General purpose |
| DocTR | Deep learning, high accuracy | Heavier, slower | High accuracy needed |
| Azure Form Recognizer | High accuracy, forms | Cost, external dependency | Form processing |
| Google Document AI | High accuracy, multi-language | Cost, external dependency | Enterprise use |

### 4.3 Preprocessing Steps

```python
def preprocess_image(image):
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Apply thresholding
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY, 11, 2
    )
    
    # Deskew
    coords = np.column_stack(np.where(thresh > 0))
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
    
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, 
                            borderMode=cv2.BORDER_REPLICATE)
    
    return rotated
```

### 4.4 Postprocessing Steps

```python
def postprocess_text(text):
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    
    # Fix Thai characters
    text = fix_thai_characters(text)
    
    # Extract structured data
    data = extract_structured_data(text)
    
    return {
        "text": text,
        "structured_data": data,
        "confidence": 0.85
    }
```

---

## RAG System Design

### 5.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RAG Pipeline                                     │
│                                                                          │
│  Document → Chunking → Embedding → Vector Store → Query → Retrieval    │
│       ↓         ↓           ↓           ↓              ↓          ↓      │
│   MinIO    Text Split   SentenceBERT  pgvector    User Query   LLM      │
│            (Recursive)                        (Cosine Sim)       Answer   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Chunking Strategy

```python
class RecursiveChunker:
    def __init__(self, chunk_size=1000, chunk_overlap=200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    
    def chunk(self, text):
        # Try to split by paragraphs first
        paragraphs = text.split('\n\n')
        chunks = []
        
        current_chunk = ""
        for paragraph in paragraphs:
            if len(current_chunk) + len(paragraph) <= self.chunk_size:
                current_chunk += paragraph + '\n\n'
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = paragraph
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
```

### 5.3 Embedding Model

| Model | Dimension | Use Case |
|-------|-----------|----------|
| sentence-transformers/all-MiniLM-L6-v2 | 384 | General purpose |
| sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 | 384 | Multi-language |
| thenlper/gte-large | 1024 | High accuracy |
| openai/text-embedding-ada-002 | 1536 | Production grade |

### 5.4 Vector Store

```python
# PostgreSQL with pgvector extension
CREATE EXTENSION vector;

CREATE TABLE document_chunks (
    id UUID PRIMARY KEY,
    document_id UUID,
    chunk_text TEXT,
    chunk_index INTEGER,
    embeddings VECTOR(384),
    metadata JSONB,
    created_at TIMESTAMP
);

CREATE INDEX idx_document_chunks_vector 
ON document_chunks 
USING ivfflat (embeddings vector_cosine_ops)
WITH (lists = 100);
```

### 5.5 Query Processing

```python
def rag_query(query, k=5):
    # 1. Embed the query
    query_embedding = embed(query)
    
    # 2. Retrieve similar chunks
    similar_chunks = vector_search(query_embedding, k)
    
    # 3. Build context
    context = "\n\n".join([chunk.text for chunk in similar_chunks])
    
    # 4. Generate answer
    prompt = f"""
    คุณเป็นผู้เชี่ยวชาญด้านสัญญาภาครัฐ
    
    ข้อมูลที่ให้มา:
    {context}
    
    คำถาม: {query}
    
    ตอบโดยอ้างอิงจากข้อมูลที่ให้มา:
    """
    
    answer = llm.generate(prompt)
    
    return {
        "answer": answer,
        "sources": similar_chunks,
        "confidence": calculate_confidence(similar_chunks)
    }
```

---

## AI Agent Design

### 6.1 Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Agent Engine                                     │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │   Trigger    │  │   Prompt     │  │   Knowledge  │  │   Output   │  │
│  │   Handler    │  │   Manager    │  │   Integrator │  │   Handler  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
│                                    │                                     │
│                                    ▼                                     │
│                         ┌──────────────────┐                            │
│                         │   LLM Execution  │                            │
│                         └──────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Agent Configuration

```json
{
    "id": "agent-risk-detector",
    "name": "Contract Risk Analyzer",
    "description": "วิเคราะห์ความเสี่ยงในสัญญาก่อนอนุมัติ",
    "provider_id": "openai-gpt4",
    "model_config": {
        "temperature": 0.3,
        "max_tokens": 4000
    },
    "system_prompt": "คุณเป็นผู้เชี่ยวชาญด้านความเสี่ยงในสัญญาภาครัฐ...",
    "knowledge_base_ids": ["kb-contract-law", "kb-templates"],
    "use_graphrag": true,
    "trigger_events": ["contract_approve_analyze"],
    "trigger_pages": ["contracts"],
    "input_schema": {
        "contract_data": true,
        "vendor_id": true
    },
    "output_action": "show_popup",
    "output_format": "json",
    "allowed_roles": ["admin", "approver"]
}
```

### 6.3 Trigger System

| Event | Description | Page |
|-------|-------------|------|
| document_upload | เมื่ออัปโหลดเอกสาร | documents |
| contract_create | เมื่อสร้างสัญญาใหม่ | contracts |
| contract_review | เมื่อเปิดดูสัญญา | contracts |
| contract_approve | เมื่ออนุมัติสัญญา | contracts |
| vendor_check | เมื่อตรวจสอบผู้รับจ้าง | vendors |
| manual | ผู้ใช้กดปุ่มเอง | Any |
| scheduled | Cron job | Any |

### 6.4 Output Actions

| Action | Description |
|--------|-------------|
| show_popup | แสดงผลใน modal/toast |
| save_to_field | บันทึกลงฟิลด์ในสัญญา |
| create_task | สร้าง task สำหรับผู้ใช้ |
| send_email | ส่ง email notification |
| webhook | เรียก external webhook |
| log_only | เฉพาะ log ไว้เท่านั้น |

---

## LLM Integration

### 7.1 Supported Providers

| Provider | Models | API Key Required |
|----------|--------|------------------|
| OpenAI | GPT-4, GPT-3.5 | Yes |
| Ollama | Llama3.1, Mistral | No (local) |
| Anthropic | Claude 3 | Yes |
| Local | Custom models | No |

### 7.2 LLM Service Interface

```python
class LLMService:
    def __init__(self, provider_id: str):
        self.provider = self._get_provider(provider_id)
    
    def generate(self, prompt: str, config: dict) -> str:
        return self.provider.generate(prompt, config)
    
    def embed(self, text: str) -> List[float]:
        return self.provider.embed(text)
    
    def _get_provider(self, provider_id: str):
        if provider_id.startswith("openai"):
            return OpenAIProvider(provider_id)
        elif provider_id.startswith("ollama"):
            return OllamaProvider(provider_id)
        elif provider_id.startswith("anthropic"):
            return AnthropicProvider(provider_id)
        else:
            raise ValueError(f"Unknown provider: {provider_id}")
```

### 7.3 Provider Implementations

```python
class OpenAIProvider:
    def __init__(self, model_id: str):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model_id = model_id
    
    def generate(self, prompt: str, config: dict) -> str:
        response = self.client.chat.completions.create(
            model=self.model_id,
            messages=[{"role": "user", "content": prompt}],
            temperature=config.get("temperature", 0.7),
            max_tokens=config.get("max_tokens", 4000)
        )
        return response.choices[0].message.content
    
    def embed(self, text: str) -> List[float]:
        response = self.client.embeddings.create(
            model="text-embedding-ada-002",
            input=text
        )
        return response.data[0].embedding
```

```python
class OllamaProvider:
    def __init__(self, model_id: str):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model_id = model_id
    
    def generate(self, prompt: str, config: dict) -> str:
        response = requests.post(
            f"{self.base_url}/api/generate",
            json={
                "model": self.model_id,
                "prompt": prompt,
                "temperature": config.get("temperature", 0.7),
                "num_predict": config.get("max_tokens", 4000)
            }
        )
        return response.json()["response"]
    
    def embed(self, text: str) -> List[float]:
        response = requests.post(
            f"{self.base_url}/api/embeddings",
            json={
                "model": self.model_id,
                "prompt": text
            }
        )
        return response.json()["embedding"]
```

---

## Data Flow

### 8.1 Document Processing Flow

```
User Upload
    ↓
Document Storage (MinIO)
    ↓
OCR Processing (Async)
    ↓
Text Storage (PostgreSQL)
    ↓
Chunking
    ↓
Embedding Generation
    ↓
Vector Storage (pgvector)
    ↓
Index Update (Elasticsearch)
    ↓
Notification (Success/Failure)
```

### 8.2 Agent Execution Flow

```
Trigger Event
    ↓
Agent Matching
    ↓
Input Validation
    ↓
Knowledge Retrieval (RAG)
    ↓
Prompt Construction
    ↓
LLM Execution
    ↓
Output Processing
    ↓
Output Action
    ↓
Execution Logging
```

### 8.3 RAG Query Flow

```
User Query
    ↓
Query Embedding
    ↓
Vector Search (pgvector)
    ↓
Relevance Filtering
    ↓
Context Building
    ↓
Prompt Construction
    ↓
LLM Answer Generation
    ↓
Response Formatting
    ↓
Return to User
```

---

## Security & Privacy

### 9.1 Data Protection

| Requirement | Implementation |
|-------------|----------------|
| Encryption at rest | AES-256 for documents |
| Encryption in transit | TLS 1.3 |
| API Key Security | Encrypted in database |
| Access Control | RBAC on all endpoints |
| Audit Logging | All AI operations logged |

### 9.2 Compliance

| Standard | Requirement |
|----------|-------------|
| GDPR | Data deletion on request |
| PDPA | Thai data protection |
| ISO 27001 | Information security |

### 9.3 Rate Limiting

```python
# Rate limiting for API endpoints
@app.middleware("http")
async def rate_limit(request: Request, call_next):
    client_ip = request.client.host
    current_time = time.time()
    
    if client_ip not in rate_limits:
        rate_limits[client_ip] = []
    
    # Remove old requests
    rate_limits[client_ip] = [
        t for t in rate_limits[client_ip] 
        if current_time - t < 60
    ]
    
    # Check limit
    if len(rate_limits[client_ip]) > 100:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    rate_limits[client_ip].append(current_time)
    return await call_next(request)
```

---

## Performance Optimization

### 10.1 Caching Strategy

| Cache Type | TTL | Purpose |
|------------|-----|---------|
| Redis Cache | 1 hour | LLM responses |
| PostgreSQL Cache | 24 hours | Embeddings |
| Browser Cache | 1 week | Static assets |

### 10.2 Async Processing

```python
# Celery tasks for async processing
@app.task(bind=True, max_retries=3)
def process_document(self, document_id: str):
    try:
        document = get_document(document_id)
        text = ocr_service.extract_text(document.file_path)
        chunks = chunk_text(text)
        embeddings = generate_embeddings(chunks)
        store_embeddings(embeddings)
        update_document_status(document_id, "processed")
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
```

### 10.3 Database Optimization

```sql
-- Index for vector search
CREATE INDEX idx_document_chunks_vector 
ON document_chunks 
USING ivfflat (embeddings vector_cosine_ops)
WITH (lists = 100);

-- Index for text search
CREATE INDEX idx_document_chunks_text 
ON document_chunks 
USING GIN (to_tsvector('thai', chunk_text));

-- Partitioning for large tables
CREATE TABLE document_chunks_2026 (
    LIKE document_chunks
) PARTITION OF document_chunks
FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
```

---

## Appendix

### A. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/ocr/extract | Extract text from document |
| GET | /api/v1/rag/search | Search knowledge base |
| POST | /api/v1/agents/execute | Execute AI agent |
| GET | /api/v1/llm/models | List available models |

### B. Configuration

```python
# AI Configuration
class AIConfig(BaseSettings):
    # OCR
    OCR_ENGINE: str = "tesseract"
    OCR_LANGUAGE: str = "tha+eng"
    
    # Embeddings
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384
    
    # Vector Store
    VECTOR_STORE: str = "pgvector"
    
    # LLM
    DEFAULT_PROVIDER: str = "openai"
    DEFAULT_MODEL: str = "gpt-4"
    DEFAULT_TEMPERATURE: float = 0.7
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60  # seconds

config = AIConfig()
```

---

*Document Version: 2.0 | Last Updated: กุมภาพันธ์ 2026*
