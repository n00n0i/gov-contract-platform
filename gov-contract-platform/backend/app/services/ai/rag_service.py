"""
RAG (Retrieval Augmented Generation) Service
"""
from datetime import datetime
from typing import List, Dict, Any, Optional

import httpx
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.ai_models import KnowledgeBase
from app.models.ai_provider import AIProvider
from app.core.logging import get_logger

logger = get_logger(__name__)


class RAGService:
    """Service for Retrieval Augmented Generation"""

    def __init__(self, db: Session):
        self.db = db

    async def retrieve(
        self,
        query: str,
        kb_id: str,
        top_k: int = 5,
        use_graphrag: bool = False,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve relevant documents from knowledge base

        Args:
            query: Search query
            kb_id: Knowledge base ID
            top_k: Number of results to return
            use_graphrag: Whether to use GraphRAG (entity/relationship search)
            filters: Additional filters (date, source, etc.)
        """
        kb = self.db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
        if not kb:
            raise ValueError(f"Knowledge base {kb_id} not found")

        if not kb.is_indexed:
            logger.warning(f"Knowledge base {kb_id} is not indexed")
            return []

        # Generate embedding for query
        query_embedding = await self._generate_embedding(query, kb_id)

        if use_graphrag and kb.vector_store_id:
            return await self._graph_search(query, query_embedding, kb, top_k)
        else:
            return await self._vector_search(query_embedding, kb, top_k, filters)

    async def _get_embedding_provider(self, kb_id: Optional[str] = None) -> Optional[AIProvider]:
        """Get the configured embedding provider for this KB or the active one"""
        # Try to get KB-specific embedding provider from user preferences
        # Fall back to first active embedding provider
        provider = self.db.query(AIProvider).filter(
            AIProvider.capabilities.contains(["embedding"]),
            AIProvider.is_active == True
        ).first()
        return provider

    async def _generate_embedding(self, content: str, kb_id: Optional[str] = None) -> List[float]:
        """Generate embedding vector for text using configured provider"""
        provider = await self._get_embedding_provider(kb_id)

        if provider is None:
            logger.warning("No embedding provider configured, returning zero vector")
            return [0.0] * 768

        try:
            if provider.provider_type == "ollama":
                return await self._ollama_embedding(provider, content)
            elif provider.provider_type in ("openai-compatible", "openai"):
                return await self._openai_embedding(provider, content)
            else:
                logger.warning(f"Unsupported provider type for embedding: {provider.provider_type}")
                return [0.0] * 768
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return [0.0] * 768

    async def _ollama_embedding(self, provider: AIProvider, content: str) -> List[float]:
        """Generate embedding using Ollama"""
        base_url = provider.api_url or "http://ollama:11434"
        model = provider.model or "nomic-embed-text"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{base_url}/api/embeddings",
                json={"model": model, "prompt": content}
            )
            response.raise_for_status()
            data = response.json()
            return data.get("embedding", [0.0] * 768)

    async def _openai_embedding(self, provider: AIProvider, content: str) -> List[float]:
        """Generate embedding using OpenAI-compatible API"""
        base_url = (provider.api_url or "https://api.openai.com/v1").rstrip("/")
        model = provider.model or "text-embedding-3-small"
        api_key = provider.api_key or ""

        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{base_url}/embeddings",
                headers=headers,
                json={"model": model, "input": content}
            )
            response.raise_for_status()
            data = response.json()
            return data["data"][0]["embedding"]

    async def _vector_search(
        self,
        query_embedding: List[float],
        kb: KnowledgeBase,
        top_k: int,
        filters: Optional[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Search by vector similarity using pgvector"""
        try:
            # Check if pgvector extension and chunks table exist
            check = self.db.execute(text(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_name = 'vector_chunks')"
            )).scalar()

            if not check:
                logger.warning("vector_chunks table not found - pgvector not set up")
                return []

            # Build embedding string for pgvector query
            embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

            query = text("""
                SELECT id, content, source_doc, metadata,
                       1 - (embedding <=> :embedding::vector) AS score
                FROM vector_chunks
                WHERE kb_id = :kb_id
                ORDER BY embedding <=> :embedding::vector
                LIMIT :top_k
            """)

            rows = self.db.execute(query, {
                "embedding": embedding_str,
                "kb_id": kb.id,
                "top_k": top_k
            }).fetchall()

            return [
                {
                    "id": str(row.id),
                    "content": row.content,
                    "source": row.source_doc or "unknown",
                    "score": float(row.score),
                    "metadata": row.metadata or {}
                }
                for row in rows
            ]
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []

    async def _graph_search(
        self,
        query: str,
        query_embedding: List[float],
        kb: KnowledgeBase,
        top_k: int
    ) -> List[Dict[str, Any]]:
        """Search using GraphRAG (entities and relationships)"""
        try:
            from app.services.graph.graph_service import get_graph_service
            graph_service = get_graph_service()

            # Search entities matching the query
            entities = graph_service.search_entities(query, limit=top_k)

            results = []
            for entity in entities:
                rels = graph_service.get_entity_relationships(entity.id, direction="both")
                results.append({
                    "id": entity.id,
                    "content": f"Entity: {entity.name} (type: {entity.type.value}). "
                               f"Relationships: {len(rels)}",
                    "source": entity.source_doc or "knowledge_graph",
                    "score": entity.confidence,
                    "entities": [entity.name],
                    "metadata": {"type": "graph_result", "entity_type": entity.type.value}
                })

            return results[:top_k]
        except Exception as e:
            logger.error(f"Graph search failed: {e}")
            return []

    async def add_document(
        self,
        kb_id: str,
        document_id: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Add a document to knowledge base

        Args:
            kb_id: Knowledge base ID
            document_id: Document identifier
            content: Document content
            metadata: Additional metadata
        """
        kb = self.db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
        if not kb:
            raise ValueError(f"Knowledge base {kb_id} not found")

        # Get chunk size and overlap from KB config (or defaults)
        chunk_size = 1000
        chunk_overlap = 200

        chunks = self._chunk_document(content, chunk_size, chunk_overlap)

        # Check if vector_chunks table exists before storing
        try:
            table_exists = self.db.execute(text(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_name = 'vector_chunks')"
            )).scalar()

            if table_exists:
                for i, chunk in enumerate(chunks):
                    embedding = await self._generate_embedding(chunk, kb_id)
                    embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"

                    self.db.execute(text("""
                        INSERT INTO vector_chunks (id, kb_id, document_id, chunk_index,
                            content, embedding, source_doc, metadata)
                        VALUES (gen_random_uuid(), :kb_id, :doc_id, :idx,
                            :content, :embedding::vector, :source_doc, :metadata::jsonb)
                        ON CONFLICT (kb_id, document_id, chunk_index) DO UPDATE
                        SET content = EXCLUDED.content,
                            embedding = EXCLUDED.embedding
                    """), {
                        "kb_id": kb_id,
                        "doc_id": document_id,
                        "idx": i,
                        "content": chunk,
                        "embedding": embedding_str,
                        "source_doc": metadata.get("filename", document_id) if metadata else document_id,
                        "metadata": str(metadata or {})
                    })
        except Exception as e:
            logger.error(f"Failed to store embeddings: {e}")

        # Update KB stats
        if document_id not in (kb.document_ids or []):
            kb.document_ids = (kb.document_ids or []) + [document_id]
        kb.total_chunks = (kb.total_chunks or 0) + len(chunks)
        kb.document_count = len(kb.document_ids)

        self.db.commit()
        return True

    def _chunk_document(
        self,
        content: str,
        chunk_size: int = 1000,
        overlap: int = 200
    ) -> List[str]:
        """Split document into overlapping chunks"""
        if not content:
            return []

        chunks = []
        start = 0

        while start < len(content):
            end = start + chunk_size
            chunk = content[start:end]
            if chunk.strip():
                chunks.append(chunk)
            start = end - overlap
            if start >= len(content):
                break

        return chunks

    async def index_knowledge_base(self, kb_id: str) -> bool:
        """
        Mark knowledge base as indexed after all documents are processed
        """
        kb = self.db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
        if not kb:
            raise ValueError(f"Knowledge base {kb_id} not found")

        kb.is_indexed = True
        kb.last_synced_at = datetime.utcnow()
        self.db.commit()

        logger.info(f"Knowledge base {kb_id} marked as indexed")
        return True
