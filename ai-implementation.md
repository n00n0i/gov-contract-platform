# AI Implementation Guide

> Gov Contract Platform - คู่มือการพัฒนา AI System

**Version**: 2.0  
**Date**: กุมภาพันธ์ 2026  
**Author**: n00n0i

---

## สารบัญ

1. [Quick Start - เริ่มต้นใช้งาน](#quick-start)
2. [OCR Implementation](#ocr-implementation)
3. [RAG Implementation](#rag-implementation)
4. [AI Agent Implementation](#ai-agent-implementation)
5. [LLM Service Implementation](#llm-service-implementation)
6. [Frontend Integration](#frontend-integration)
7. [Testing](#testing)
8. [Deployment](#deployment)

---

## Quick Start

### 1.1 ติดตั้ง Dependencies

```bash
# Backend
pip install python-dotenv
pip install openai
pip install docTR
pip install sentence-transformers
pip install pgvector
pip install redis
pip install celery

# Frontend
npm install @microsoft/fetch-event-source
npm install axios
```

### 1.2 Environment Variables

```env
# AI Configuration
OPENAI_API_KEY=your_openai_api_key
OLLAMA_BASE_URL=http://localhost:11434
ANTHROPIC_API_KEY=your_anthropic_api_key

# OCR Configuration
OCR_ENGINE=tesseract
OCR_LANGUAGE=tha+eng

# Embeddings
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Vector Store
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

### 1.3 Database Setup

```sql
-- Enable pgvector extension
CREATE EXTENSION vector;

-- Create document chunks table
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    embeddings VECTOR(384),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vector index
CREATE INDEX idx_document_chunks_vector 
ON document_chunks 
USING ivfflat (embeddings vector_cosine_ops)
WITH (lists = 100);

-- Create text search index
CREATE INDEX idx_document_chunks_text 
ON document_chunks 
USING GIN (to_tsvector('thai', chunk_text));
```

---

## OCR Implementation

### 2.1 OCR Service

```python
# backend/app/services/document/ocr_service.py
from typing import Dict, List, Optional
from pathlib import Path
import pytesseract
from PIL import Image
import cv2
import numpy as np
import re
from app.core.config import settings

class OCRService:
    def __init__(self):
        self.engine = settings.OCR_ENGINE
        self.language = settings.OCR_LANGUAGE
    
    def extract_text(self, file_path: str) -> Dict:
        """
        Extract text from document (PDF or image)
        """
        if file_path.lower().endswith('.pdf'):
            return self._extract_from_pdf(file_path)
        else:
            return self._extract_from_image(file_path)
    
    def _extract_from_image(self, file_path: str) -> Dict:
        """Extract text from image file"""
        try:
            # Load image
            image = Image.open(file_path)
            
            # Preprocess image
            processed_image = self._preprocess_image(image)
            
            # Extract text
            text = pytesseract.image_to_string(
                processed_image, 
                lang=self.language
            )
            
            # Postprocess text
            cleaned_text = self._postprocess_text(text)
            
            return {
                "success": True,
                "text": cleaned_text,
                "confidence": 0.85,
                "pages": 1
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def _extract_from_pdf(self, file_path: str) -> Dict:
        """Extract text from PDF file"""
        try:
            import pdfplumber
            
            all_text = []
            pages = 0
            
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    pages += 1
                    text = page.extract_text()
                    if text:
                        all_text.append(text)
            
            combined_text = "\n\n".join(all_text)
            cleaned_text = self._postprocess_text(combined_text)
            
            return {
                "success": True,
                "text": cleaned_text,
                "confidence": 0.90,
                "pages": pages
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def _preprocess_image(self, image: Image.Image) -> Image.Image:
        """Preprocess image for better OCR results"""
        # Convert to numpy array
        img_array = np.array(image)
        
        # Convert to grayscale
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        
        # Apply thresholding
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 11, 2
        )
        
        # Convert back to PIL Image
        return Image.fromarray(thresh)
    
    def _postprocess_text(self, text: str) -> str:
        """Postprocess extracted text"""
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Fix Thai characters
        text = self._fix_thai_characters(text)
        
        return text.strip()
    
    def _fix_thai_characters(self, text: str) -> str:
        """Fix common Thai character issues"""
        # Common Thai character replacements
        replacements = {
            'ๆ': 'ะ',  # Replace repeated character marker
            'ฯ': '.',  # Replace abbreviation marker
        }
        
        for old, new in replacements.items():
            text = text.replace(old, new)
        
        return text

# Singleton instance
ocr_service = OCRService()
```

### 2.2 OCR API Endpoint

```python
# backend/app/api/v1/ocr.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.document.ocr_service import ocr_service

router = APIRouter(prefix="/api/v1/ocr", tags=["OCR"])

@router.post("/extract")
async def extract_text(file: UploadFile = File(...)):
    """Extract text from uploaded file"""
    try:
        # Save uploaded file
        file_path = f"/tmp/{file.filename}"
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Extract text
        result = ocr_service.extract_text(file_path)
        
        # Clean up
        import os
        os.remove(file_path)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## RAG Implementation

### 3.1 Embedding Service

```python
# backend/app/services/ai/rag_service.py
from typing import List, Dict, Optional
from sentence_transformers import SentenceTransformer
import numpy as np
from app.db.database import get_db
from app.models.document import DocumentChunk
import pgvector.sqlalchemy

class RAGService:
    def __init__(self):
        self.model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        self.embedding_dimension = 384
    
    def embed_text(self, text: str) -> List[float]:
        """Generate embedding for text"""
        return self.model.encode(text).tolist()
    
    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        return self.model.encode(texts).tolist()
    
    def search_similar(self, query: str, k: int = 5) -> List[Dict]:
        """Search for similar documents"""
        db = get_db()
        
        # Embed query
        query_embedding = self.embed_text(query)
        
        # Search in database
        results = db.query(DocumentChunk).order_by(
            DocumentChunk.embeddings.cosine_distance(query_embedding)
        ).limit(k).all()
        
        return [
            {
                "id": str(chunk.id),
                "document_id": str(chunk.document_id),
                "text": chunk.chunk_text,
                "score": 1 - float(chunk.embeddings.cosine_distance(query_embedding)),
                "metadata": chunk.metadata
            }
            for chunk in results
        ]

rag_service = RAGService()
```

### 3.2 RAG Query Service

```python
# backend/app/services/ai/rag_service.py
class RAGQueryService:
    def __init__(self):
        self.rag_service = rag_service
        self.llm_service = llm_service
    
    def query(self, question: str, context_limit: int = 3) -> Dict:
        """Execute RAG query"""
        # 1. Search for similar documents
        search_results = self.rag_service.search_similar(question, k=context_limit)
        
        # 2. Build context
        context = "\n\n".join([result["text"] for result in search_results])
        
        # 3. Generate answer
        answer = self._generate_answer(question, context)
        
        return {
            "question": question,
            "answer": answer,
            "sources": search_results,
            "confidence": self._calculate_confidence(search_results)
        }
    
    def _generate_answer(self, question: str, context: str) -> str:
        """Generate answer using LLM"""
        prompt = f"""
        คุณเป็นผู้เชี่ยวชาญด้านสัญญาภาครัฐ
        
        ข้อมูลที่ให้มา:
        {context}
        
        คำถาม: {question}
        
        ตอบโดยอ้างอิงจากข้อมูลที่ให้มา ถ้าไม่มีข้อมูลที่เกี่ยวข้อง ให้ตอบว่า "ไม่พบข้อมูลที่เกี่ยวข้อง"
        """
        
        return self.llm_service.generate(prompt)
    
    def _calculate_confidence(self, results: List[Dict]) -> float:
        """Calculate confidence score based on search results"""
        if not results:
            return 0.0
        
        scores = [result["score"] for result in results]
        return sum(scores) / len(scores)

rag_query_service = RAGQueryService()
```

### 3.3 Document Chunking Service

```python
# backend/app/services/document/chunk_service.py
from typing import List
import re

class DocumentChunker:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    
    def chunk_text(self, text: str) -> List[str]:
        """Chunk text into smaller pieces"""
        chunks = []
        current_chunk = ""
        
        # Split by paragraphs first
        paragraphs = text.split('\n\n')
        
        for paragraph in paragraphs:
            # If paragraph is too long, split by sentences
            if len(paragraph) > self.chunk_size:
                sentences = re.split(r'([.!?]\s+)', paragraph)
                
                for sentence in sentences:
                    if len(current_chunk) + len(sentence) <= self.chunk_size:
                        current_chunk += sentence
                    else:
                        if current_chunk:
                            chunks.append(current_chunk.strip())
                        current_chunk = sentence
                
                if current_chunk:
                    chunks.append(current_chunk.strip())
            else:
                if len(current_chunk) + len(paragraph) <= self.chunk_size:
                    current_chunk += paragraph + '\n\n'
                else:
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    current_chunk = paragraph + '\n\n'
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def chunk_with_overlap(self, text: str) -> List[str]:
        """Chunk text with overlap"""
        chunks = self.chunk_text(text)
        overlapped_chunks = []
        
        for i, chunk in enumerate(chunks):
            if i > 0:
                # Add overlap from previous chunk
                overlap = chunks[i-1][-self.chunk_overlap:]
                chunk = overlap + chunk
            
            if i < len(chunks) - 1:
                # Add overlap to next chunk
                overlap = chunks[i+1][:self.chunk_overlap]
                chunk += overlap
            
            overlapped_chunks.append(chunk.strip())
        
        return overlapped_chunks

chunker = DocumentChunker()
```

---

## AI Agent Implementation

### 4.1 Agent Service

```python
# backend/app/services/agent/trigger_service.py
from typing import Dict, List, Optional
from datetime import datetime
from app.models.ai_models import Agent, AgentExecution, TriggerEvent, OutputAction
from app.db.database import get_db
from app.services.ai.llm_service import llm_service
from app.services.ai.rag_service import rag_service

class AgentTriggerService:
    def __init__(self):
        self.db = get_db()
    
    def get_matching_agents(self, event: str, page: str = None) -> List[Agent]:
        """Get agents that match the trigger event"""
        query = self.db.query(Agent).filter(
            Agent.status == "active",
            Agent.trigger_events.contains([event])
        )
        
        if page:
            query = query.filter(
                Agent.trigger_pages.contains([page])
            )
        
        return query.all()
    
    def execute_agent(self, agent: Agent, input_data: Dict, context: Dict = None) -> AgentExecution:
        """Execute an agent"""
        execution = AgentExecution(
            agent_id=agent.id,
            input_data=input_data,
            context=context,
            status="running"
        )
        self.db.add(execution)
        self.db.commit()
        self.db.refresh(execution)
        
        try:
            # Get knowledge if needed
            knowledge = []
            if agent.knowledge_base_ids:
                knowledge = self._get_knowledge(agent.knowledge_base_ids, input_data)
            
            # Build prompt
            prompt = self._build_prompt(agent, input_data, knowledge)
            
            # Execute LLM
            output = llm_service.generate(prompt, agent.model_config)
            
            # Process output
            processed_output = self._process_output(output, agent)
            
            # Execute output action
            self._execute_output_action(processed_output, agent, execution)
            
            # Update execution
            execution.output_data = processed_output
            execution.status = "completed"
            execution.execution_time = (datetime.utcnow() - execution.created_at).total_seconds()
            
        except Exception as e:
            execution.status = "failed"
            execution.error_message = str(e)
        
        self.db.commit()
        self.db.refresh(execution)
        
        return execution
    
    def _get_knowledge(self, kb_ids: List[str], input_data: Dict) -> List[Dict]:
        """Get knowledge from knowledge bases"""
        knowledge = []
        
        for kb_id in kb_ids:
            results = rag_service.search_similar(
                input_data.get("query", ""),
                k=3
            )
            knowledge.extend(results)
        
        return knowledge
    
    def _build_prompt(self, agent: Agent, input_data: Dict, knowledge: List[Dict]) -> str:
        """Build prompt for agent"""
        prompt_parts = []
        
        # System prompt
        if agent.system_prompt:
            prompt_parts.append(agent.system_prompt)
        
        # Knowledge context
        if knowledge:
            prompt_parts.append("\n\nKnowledge Base:")
            for k in knowledge:
                prompt_parts.append(f"- {k['text']}")
        
        # Input data
        prompt_parts.append("\n\nInput Data:")
        prompt_parts.append(str(input_data))
        
        return "\n".join(prompt_parts)
    
    def _process_output(self, output: str, agent: Agent) -> Dict:
        """Process agent output"""
        if agent.output_format == "json":
            try:
                import json
                return json.loads(output)
            except:
                return {"text": output}
        else:
            return {"text": output}
    
    def _execute_output_action(self, output: Dict, agent: Agent, execution: AgentExecution):
        """Execute output action"""
        if agent.output_action == OutputAction.SHOW_POPUP:
            # Show in UI
            pass
        elif agent.output_action == OutputAction.SAVE_TO_FIELD:
            # Save to contract/vendor field
            pass
        elif agent.output_action == OutputAction.CREATE_TASK:
            # Create task
            pass
        elif agent.output_action == OutputAction.SEND_EMAIL:
            # Send email
            pass
        elif agent.output_action == OutputAction.WEBHOOK:
            # Call webhook
            pass

agent_trigger_service = AgentTriggerService()
```

### 4.2 Agent API Endpoints

```python
# backend/app/api/v1/agents.py
from fastapi import APIRouter, HTTPException, Depends
from app.schemas.agent import AgentCreate, AgentUpdate, AgentExecute
from app.models.ai_models import Agent, AgentExecution
from app.db.database import get_db
from app.services.agent.trigger_service import agent_trigger_service

router = APIRouter(prefix="/api/v1/agents", tags=["Agents"])

@router.get("/")
def list_agents(db: Session = Depends(get_db)):
    """List all agents"""
    agents = db.query(Agent).all()
    return {"items": [a.to_dict() for a in agents], "total": len(agents)}

@router.post("/")
def create_agent(agent: AgentCreate, db: Session = Depends(get_db)):
    """Create a new agent"""
    db_agent = Agent(**agent.dict())
    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)
    return db_agent.to_dict()

@router.post("/{agent_id}/execute")
def execute_agent(
    agent_id: str,
    execution: AgentExecute,
    db: Session = Depends(get_db)
):
    """Execute an agent"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    result = agent_trigger_service.execute_agent(
        agent, 
        execution.input, 
        execution.context
    )
    
    return result.to_dict()
```

---

## LLM Service Implementation

### 5.1 LLM Service

```python
# backend/app/services/ai/llm_service.py
from typing import Dict, List, Optional
from openai import OpenAI
import requests
from app.core.config import settings

class LLMService:
    def __init__(self):
        self.providers = {}
        self._init_providers()
    
    def _init_providers(self):
        """Initialize LLM providers"""
        if settings.OPENAI_API_KEY:
            self.providers["openai"] = OpenAIProvider(
                api_key=settings.OPENAI_API_KEY
            )
        
        if settings.OLLAMA_BASE_URL:
            self.providers["ollama"] = OllamaProvider(
                base_url=settings.OLLAMA_BASE_URL
            )
        
        if settings.ANTHROPIC_API_KEY:
            self.providers["anthropic"] = AnthropicProvider(
                api_key=settings.ANTHROPIC_API_KEY
            )
    
    def generate(self, prompt: str, config: Dict = None) -> str:
        """Generate text using default provider"""
        return self.providers["openai"].generate(prompt, config)
    
    def embed(self, text: str) -> List[float]:
        """Generate embedding using default provider"""
        return self.providers["openai"].embed(text)

class OpenAIProvider:
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
        self.model = "gpt-4"
    
    def generate(self, prompt: str, config: Dict = None) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=config.get("temperature", 0.7) if config else 0.7,
            max_tokens=config.get("max_tokens", 4000) if config else 4000
        )
        return response.choices[0].message.content
    
    def embed(self, text: str) -> List[float]:
        response = self.client.embeddings.create(
            model="text-embedding-ada-002",
            input=text
        )
        return response.data[0].embedding

class OllamaProvider:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.model = "llama3.1:8b"
    
    def generate(self, prompt: str, config: Dict = None) -> str:
        response = requests.post(
            f"{self.base_url}/api/generate",
            json={
                "model": self.model,
                "prompt": prompt,
                "temperature": config.get("temperature", 0.7) if config else 0.7,
                "num_predict": config.get("max_tokens", 4000) if config else 4000
            }
        )
        return response.json()["response"]
    
    def embed(self, text: str) -> List[float]:
        response = requests.post(
            f"{self.base_url}/api/embeddings",
            json={
                "model": self.model,
                "prompt": text
            }
        )
        return response.json()["embedding"]

llm_service = LLMService()
```

---

## Frontend Integration

### 6.1 Agent Service

```typescript
// frontend/src/services/agentService.ts
import { executeAgent } from './agentTriggerService';

export async function executeAgent(agentId: string, input: any, context: any = {}) {
  try {
    const response = await fetch(`/api/v1/agents/${agentId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input,
        context
      })
    });
    
    if (!response.ok) {
      throw new Error('Agent execution failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Agent execution error:', error);
    throw error;
  }
}

export async function handleAgentOutput(result: any, handlers: any = {}) {
  const { output } = result;
  
  if (output.text) {
    // Show in modal
    if (handlers.onPopup) {
      handlers.onPopup(output);
    } else {
      alert(output.text);
    }
  }
  
  if (output.action === 'save_to_field' && handlers.onSaveField) {
    handlers.onSaveField(output.field, output.value);
  }
  
  if (output.action === 'create_task' && handlers.onTask) {
    handlers.onTask(output.task_id);
  }
  
  if (output.action === 'send_email' && handlers.onEmail) {
    handlers.onEmail();
  }
}
```

### 6.2 Agent Hook

```typescript
// frontend/src/hooks/useAIAgent.ts
import { useCallback } from 'react';
import { executeAgent, handleAgentOutput } from '../services/agentService';

export function useAIAgent(agentId: string) {
  const execute = useCallback(async (input: any, context: any = {}) => {
    try {
      // Execute agent
      const result = await executeAgent(agentId, input, context);
      
      // Handle output
      await handleAgentOutput(result, {
        onPopup: (data) => openAnalysisModal(data),
        onSaveField: (field, value) => updateFormField(field, value),
        onTask: (taskId) => showNotification('Task created', taskId),
        onEmail: () => showToast('Notification sent')
      });
      
      return result;
    } catch (error) {
      console.error('Agent execution failed:', error);
      throw error;
    }
  }, [agentId]);
  
  return { execute };
}

// Usage in component
function ContractReviewPage({ contractId }: { contractId: string }) {
  const { execute } = useAIAgent('agent-risk-detector');
  
  const handleAnalyze = async () => {
    const result = await execute({
      contract_id: contractId,
      query: 'วิเคราะห์ความเสี่ยงในสัญญานี้'
    });
    
    console.log('Analysis result:', result);
  };
  
  return (
    <button onClick={handleAnalyze}>
      🤖 วิเคราะห์ด้วย AI
    </button>
  );
}
```

### 6.3 Agent Configuration Form

```typescript
// frontend/src/components/AgentConfigForm.tsx
import { useState } from 'react';

interface AgentConfig {
  name: string;
  description: string;
  provider_id: string;
  model_config: {
    temperature: number;
    max_tokens: number;
  };
  system_prompt: string;
  knowledge_base_ids: string[];
  trigger_events: string[];
  output_action: string;
}

export function AgentConfigForm() {
  const [config, setConfig] = useState<AgentConfig>({
    name: '',
    description: '',
    provider_id: 'openai-gpt4',
    model_config: {
      temperature: 0.7,
      max_tokens: 4000
    },
    system_prompt: '',
    knowledge_base_ids: [],
    trigger_events: [],
    output_action: 'show_popup'
  });

  const handleSubmit = async () => {
    try {
      const response = await fetch('/api/v1/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
      });
      
      if (response.ok) {
        alert('Agent created successfully!');
      }
    } catch (error) {
      console.error('Failed to create agent:', error);
    }
  };

  return (
    <div className="agent-config-form">
      <h2>Create AI Agent</h2>
      
      <div className="form-group">
        <label>Name</label>
        <input
          type="text"
          value={config.name}
          onChange={(e) => setConfig({...config, name: e.target.value})}
        />
      </div>
      
      <div className="form-group">
        <label>Description</label>
        <textarea
          value={config.description}
          onChange={(e) => setConfig({...config, description: e.target.value})}
        />
      </div>
      
      <div className="form-group">
        <label>System Prompt</label>
        <textarea
          rows={10}
          value={config.system_prompt}
          onChange={(e) => setConfig({...config, system_prompt: e.target.value})}
          placeholder="คุณเป็นผู้เชี่ยวชาญด้าน..."
        />
      </div>
      
      <div className="form-group">
        <label>Provider</label>
        <select
          value={config.provider_id}
          onChange={(e) => setConfig({...config, provider_id: e.target.value})}
        >
          <option value="openai-gpt4">OpenAI GPT-4</option>
          <option value="openai-gpt3.5">OpenAI GPT-3.5</option>
          <option value="ollama-llama3.1">Ollama Llama3.1</option>
        </select>
      </div>
      
      <button onClick={handleSubmit}>Create Agent</button>
    </div>
  );
}
```

---

## Testing

### 7.1 Unit Tests

```python
# backend/tests/test_ocr_service.py
import pytest
from app.services.document.ocr_service import OCRService

@pytest.fixture
def ocr_service():
    return OCRService()

def test_extract_text_from_image(ocr_service):
    # Create test image
    import tempfile
    from PIL import Image
    
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
        # Create a simple test image
        img = Image.new('RGB', (100, 50), color='white')
        img.save(f.name)
        
        result = ocr_service.extract_text(f.name)
        
        assert result['success'] == True
        assert 'text' in result

def test_extract_text_from_pdf(ocr_service):
    result = ocr_service.extract_text('tests/fixtures/test.pdf')
    
    assert result['success'] == True
    assert 'text' in result
    assert 'pages' in result
```

### 7.2 Integration Tests

```python
# backend/tests/test_rag_service.py
import pytest
from app.services.ai.rag_service import RAGService

@pytest.fixture
def rag_service():
    return RAGService()

def test_embed_text(rag_service):
    text = "นี่คือข้อความทดสอบ"
    embedding = rag_service.embed_text(text)
    
    assert isinstance(embedding, list)
    assert len(embedding) == 384  # Expected dimension

def test_search_similar(rag_service):
    # This test requires database setup
    # In real implementation, use test database
    results = rag_service.search_similar("สัญญาจัดซื้อ", k=5)
    
    assert isinstance(results, list)
```

---

## Deployment

### 8.1 Docker Configuration

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Tesseract
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libtesseract-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 5173

CMD ["npm", "run", "dev"]
```

### 8.2 Docker Compose

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/contractmgmt
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OLLAMA_BASE_URL=http://ollama:11434
    depends_on:
      - db
      - redis
      - ollama

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend

  db:
    image: postgres:14
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=contractmgmt
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6

  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_data:/root/.ollama

volumes:
  postgres_data:
  ollama_data:
```

### 8.3 Environment Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start development server
uvicorn main:app --reload

# Start frontend
cd frontend
npm install
npm run dev
```

---

## Appendix

### A. API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/ocr/extract | Extract text from document |
| GET | /api/v1/rag/search | Search knowledge base |
| POST | /api/v1/agents | Create new agent |
| GET | /api/v1/agents | List all agents |
| POST | /api/v1/agents/{id}/execute | Execute agent |

### B. Configuration Reference

```python
# backend/app/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # AI Configuration
    OPENAI_API_KEY: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    ANTHROPIC_API_KEY: str = ""
    
    # OCR Configuration
    OCR_ENGINE: str = "tesseract"
    OCR_LANGUAGE: str = "tha+eng"
    
    # Embeddings
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    
    # Vector Store
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/db"

settings = Settings()
```

---

*Document Version: 2.0 | Last Updated: กุมภาพันธ์ 2026*
