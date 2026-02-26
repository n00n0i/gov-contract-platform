"""
GraphRAG API Routes - Knowledge graph operations
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.security import get_current_user_id
from app.services.graph.graph_service import get_graph_service
from app.models.graph_models import EntityType, RelationType

router = APIRouter(prefix="/graph", tags=["GraphRAG"])


# ============== Schemas ==============

class EntityCreate(BaseModel):
    name: str
    type: EntityType
    properties: Dict[str, Any] = {}
    source_doc: Optional[str] = None


class EntityResponse(BaseModel):
    id: str
    name: str
    type: str
    properties: Dict[str, Any]
    source_doc: Optional[str]
    confidence: float


class GraphStats(BaseModel):
    total_entities: int
    total_relationships: int
    total_documents: int
    entities_by_type: Dict[str, int]


class GraphSearchRequest(BaseModel):
    query: str
    entity_type: Optional[EntityType] = None
    limit: int = 20


# ============== API Endpoints ==============

@router.get("/stats")
def get_graph_statistics(
    user_id: str = Depends(get_current_user_id)
):
    """Get knowledge graph statistics"""
    graph_service = get_graph_service()
    stats = graph_service.get_graph_stats()
    
    if "error" in stats:
        raise HTTPException(status_code=503, detail=stats["error"])
    
    return {
        "success": True,
        "data": stats
    }


@router.get("/entities/search")
def search_entities(
    q: str = Query(..., description="Search query"),
    entity_type: Optional[EntityType] = None,
    limit: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user_id)
):
    """Search entities in the knowledge graph"""
    graph_service = get_graph_service()
    entities = graph_service.search_entities(q, entity_type, limit)
    
    return {
        "success": True,
        "data": [e.to_dict() for e in entities],
        "count": len(entities)
    }


@router.get("/entities/{entity_id}")
def get_entity(
    entity_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Get entity details by ID"""
    graph_service = get_graph_service()
    entity = graph_service.get_entity(entity_id)
    
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    
    return {
        "success": True,
        "data": entity.to_dict()
    }


@router.get("/entities/{entity_id}/relationships")
def get_entity_relationships(
    entity_id: str,
    direction: str = Query("both", enum=["in", "out", "both"]),
    user_id: str = Depends(get_current_user_id)
):
    """Get relationships for an entity"""
    graph_service = get_graph_service()
    relationships = graph_service.get_entity_relationships(entity_id, direction)
    
    return {
        "success": True,
        "data": relationships
    }


@router.get("/entities/{entity_id}/neighborhood")
def get_entity_neighborhood(
    entity_id: str,
    depth: int = Query(2, ge=1, le=5),
    user_id: str = Depends(get_current_user_id)
):
    """Get entity neighborhood (connected subgraph)"""
    graph_service = get_graph_service()
    neighborhood = graph_service.get_connected_entities(entity_id, depth)
    
    return {
        "success": True,
        "data": neighborhood
    }


@router.post("/entities")
def create_entity(
    entity: EntityCreate,
    user_id: str = Depends(get_current_user_id)
):
    """Create a new entity"""
    import uuid
    from app.models.graph_models import GraphEntity
    
    graph_service = get_graph_service()
    
    new_entity = GraphEntity(
        id=str(uuid.uuid4()),
        name=entity.name,
        type=entity.type,
        properties=entity.properties,
        source_doc=entity.source_doc,
        confidence=1.0
    )
    
    success = graph_service.create_entity(new_entity)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create entity")
    
    return {
        "success": True,
        "message": "Entity created",
        "data": new_entity.to_dict()
    }


@router.get("/visualization")
def get_graph_visualization_data(
    center_entity: Optional[str] = None,
    depth: int = Query(2, ge=1, le=4),
    limit: int = Query(100, ge=10, le=500),
    user_id: str = Depends(get_current_user_id)
):
    """Get graph data for visualization"""
    graph_service = get_graph_service()
    
    try:
        # If center entity specified, get subgraph
        if center_entity:
            data = graph_service.get_subgraph_for_visualization(center_entity, depth, limit)
        else:
            # Otherwise get global graph sample
            data = graph_service.get_global_graph_sample(limit)
        
        return {
            "success": True,
            "data": data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract")
def extract_graph_from_document(
    doc_id: str,
    doc_content: str,
    user_id: str = Depends(get_current_user_id)
):
    """Extract entities and relationships from document using LLM"""
    # This would call LLM service to extract entities
    # For now return mock response
    
    return {
        "success": True,
        "message": "Graph extraction queued",
        "data": {
            "doc_id": doc_id,
            "status": "processing",
            "estimated_entities": 0,
            "estimated_relationships": 0
        }
    }


@router.get("/health")
def check_graph_health():
    """Check Neo4j connection health"""
    try:
        graph_service = get_graph_service()
        stats = graph_service.get_graph_stats()
        
        if "error" in stats:
            return {
                "success": False,
                "status": "unhealthy",
                "error": stats["error"]
            }
        
        return {
            "success": True,
            "status": "healthy",
            "data": {
                "total_entities": stats.get("total_entities", 0),
                "total_relationships": stats.get("total_relationships", 0)
            }
        }
    except Exception as e:
        return {
            "success": False,
            "status": "error",
            "error": str(e)
        }
