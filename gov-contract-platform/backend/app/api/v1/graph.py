"""
GraphRAG API Routes - Dual domain knowledge graph operations

Supports two domains:
1. Contracts (/graph/contracts/*) - With security controls
2. Knowledge Base (/graph/kb/*) - Agent-only access
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.security import get_current_user_id, get_current_user_payload
from app.core.logging import get_logger
from app.services.graph import (
    get_contracts_graph_service,
    get_kb_graph_service,
    ContractsGraphService,
    KBGraphService,
    SecurityLevel
)
from app.models.graph_models import EntityType, RelationType, GraphDomain

router = APIRouter(prefix="/graph", tags=["GraphRAG"])
logger = get_logger(__name__)


# ============== Dependencies ==============

def get_contracts_graph() -> ContractsGraphService:
    """Dependency to get contracts graph service"""
    return get_contracts_graph_service()


def get_kb_graph() -> KBGraphService:
    """Dependency to get KB graph service"""
    return get_kb_graph_service()


def get_user_security_context(user_payload: dict = Depends(get_current_user_payload)) -> Dict[str, Any]:
    """Extract security context from user payload for contracts access"""
    return {
        "user_id": user_payload.get("sub"),
        "tenant_id": user_payload.get("tenant_id", "default"),
        "department_id": user_payload.get("department_id"),
        "security_level": SecurityLevel(user_payload.get("security_level", "public")),
        "permissions": user_payload.get("permissions", []),
        "departments": user_payload.get("departments", [])  # Includes child departments
    }


# ============== Schemas ==============

class EntityResponse(BaseModel):
    id: str
    name: str
    type: str
    domain: str
    properties: Dict[str, Any]
    source_doc: Optional[str]
    confidence: float


class GraphStats(BaseModel):
    total_entities: int
    total_relationships: int
    total_documents: int
    domain: str


class GraphSearchRequest(BaseModel):
    query: str
    entity_type: Optional[EntityType] = None
    limit: int = 20


# ============== Contracts Graph Endpoints (with security) ==============

@router.get("/contracts/stats", response_model=Dict[str, Any])
def get_contracts_graph_statistics(
    graph: ContractsGraphService = Depends(get_contracts_graph),
    user_id: str = Depends(get_current_user_id)
):
    """Get contracts graph statistics"""
    stats = graph.get_stats()
    return {
        "success": True,
        "data": stats
    }


@router.get("/contracts/entities/search")
def search_contracts_entities(
    q: str = Query(..., description="Search query"),
    entity_type: Optional[EntityType] = None,
    limit: int = Query(20, ge=1, le=100),
    graph: ContractsGraphService = Depends(get_contracts_graph),
    security_ctx: Dict[str, Any] = Depends(get_user_security_context),
    user_id: str = Depends(get_current_user_id)
):
    """
    Search entities in contracts graph (with security filtering)
    
    Results are filtered by:
    - User's department (and child departments)
    - User's security clearance level
    """
    entities = graph.search_entities(
        name=q,
        entity_type=entity_type,
        limit=limit,
        tenant_id=security_ctx["tenant_id"],
        department_id=security_ctx["department_id"],
        user_security_level=security_ctx["security_level"],
        user_departments=security_ctx["departments"]
    )
    
    return {
        "success": True,
        "data": [e.to_dict() for e in entities],
        "count": len(entities)
    }


@router.get("/contracts/entities/{entity_id}")
def get_contracts_entity(
    entity_id: str,
    graph: ContractsGraphService = Depends(get_contracts_graph),
    security_ctx: Dict[str, Any] = Depends(get_user_security_context),
    user_id: str = Depends(get_current_user_id)
):
    """Get entity details with its relationships (with security filtering)"""
    entity = graph.get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    
    # Get relationships with security filtering
    relationships = graph.get_entity_relationships(
        entity_id=entity_id,
        direction="both",
        tenant_id=security_ctx["tenant_id"],
        department_id=security_ctx["department_id"],
        user_security_level=security_ctx["security_level"],
        user_departments=security_ctx["departments"]
    )
    
    return {
        "success": True,
        "data": {
            "entity": entity.to_dict(),
            "relationships": relationships
        }
    }


@router.get("/contracts/entities/{entity_id}/relationships")
def get_contracts_entity_relationships(
    entity_id: str,
    direction: str = Query("both", regex="^(in|out|both)$"),
    graph: ContractsGraphService = Depends(get_contracts_graph),
    security_ctx: Dict[str, Any] = Depends(get_user_security_context),
    user_id: str = Depends(get_current_user_id)
):
    """Get relationships for an entity (with security filtering)"""
    relationships = graph.get_entity_relationships(
        entity_id=entity_id,
        direction=direction,
        tenant_id=security_ctx["tenant_id"],
        department_id=security_ctx["department_id"],
        user_security_level=security_ctx["security_level"],
        user_departments=security_ctx["departments"]
    )
    
    return {
        "success": True,
        "data": relationships
    }


@router.get("/contracts/paths")
def find_contracts_paths(
    start_id: str = Query(..., description="Start entity ID"),
    end_id: str = Query(..., description="End entity ID"),
    max_depth: int = Query(4, ge=1, le=6),
    graph: ContractsGraphService = Depends(get_contracts_graph),
    security_ctx: Dict[str, Any] = Depends(get_user_security_context),
    user_id: str = Depends(get_current_user_id)
):
    """Find paths between two entities (with security filtering)"""
    paths = graph.find_paths(
        start_entity_id=start_id,
        end_entity_id=end_id,
        max_depth=max_depth,
        tenant_id=security_ctx["tenant_id"],
        department_id=security_ctx["department_id"],
        user_security_level=security_ctx["security_level"],
        user_departments=security_ctx["departments"]
    )
    
    return {
        "success": True,
        "data": paths
    }


# ============== Knowledge Base Graph Endpoints (agent-only) ==============

@router.get("/kb/stats")
def get_kb_graph_statistics(
    graph: KBGraphService = Depends(get_kb_graph),
    user_id: str = Depends(get_current_user_id)
):
    """Get KB graph statistics"""
    stats = graph.get_stats()
    return {
        "success": True,
        "data": stats
    }


@router.get("/kb/entities/search")
def search_kb_entities(
    q: str = Query(..., description="Search query"),
    entity_type: Optional[EntityType] = None,
    kb_id: Optional[str] = Query(None, description="Filter by knowledge base ID"),
    limit: int = Query(20, ge=1, le=100),
    graph: KBGraphService = Depends(get_kb_graph),
    user_id: str = Depends(get_current_user_id)
):
    """
    Search entities in KB graph (no security filtering - agent use)
    
    This endpoint is intended for AI agents to retrieve context.
    Regular users should use contracts graph instead.
    """
    entities = graph.search_entities(
        name=q,
        entity_type=entity_type,
        limit=limit,
        kb_id=kb_id
    )
    
    return {
        "success": True,
        "data": [e.to_dict() for e in entities],
        "count": len(entities)
    }


@router.get("/kb/entities/{entity_id}")
def get_kb_entity(
    entity_id: str,
    graph: KBGraphService = Depends(get_kb_graph),
    user_id: str = Depends(get_current_user_id)
):
    """Get KB entity details with relationships"""
    entity = graph.get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    
    relationships = graph.get_entity_relationships(entity_id, direction="both")
    
    return {
        "success": True,
        "data": {
            "entity": entity.to_dict(),
            "relationships": relationships
        }
    }


@router.post("/kb/context")
def get_kb_context_for_agent(
    request: GraphSearchRequest,
    kb_id: Optional[str] = Query(None, description="Knowledge base ID"),
    graph: KBGraphService = Depends(get_kb_graph),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get graph context for AI agent (RAG enhancement)
    
    Returns relevant entities and relationships for the query.
    Used by agents for context understanding.
    """
    context = graph.get_context_for_agent(
        query=request.query,
        kb_id=kb_id,
        max_entities=request.limit,
        max_relationships=request.limit * 2
    )
    
    return {
        "success": True,
        "data": context
    }


@router.get("/kb/{kb_id}/related")
def find_related_knowledge_bases(
    kb_id: str,
    threshold: int = Query(2, ge=1, description="Minimum shared entities"),
    graph: KBGraphService = Depends(get_kb_graph),
    user_id: str = Depends(get_current_user_id)
):
    """
    Find related knowledge bases based on shared entities
    Useful for understanding cross-KB relationships
    """
    related = graph.find_related_kbs(kb_id, threshold)
    
    return {
        "success": True,
        "data": related
    }


# ============== Visualization Endpoints ==============

@router.get("/contracts/visualization")
def get_contracts_graph_visualization(
    center_entity: Optional[str] = Query(None, description="Center entity ID (optional)"),
    depth: int = Query(2, ge=1, le=4, description="Search depth"),
    limit: int = Query(100, ge=10, le=500, description="Max nodes"),
    graph: ContractsGraphService = Depends(get_contracts_graph),
    security_ctx: Dict[str, Any] = Depends(get_user_security_context),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get graph visualization data for contracts
    
    Returns nodes and edges for D3/SVG visualization with security filtering
    """
    try:
        nodes = []
        edges = []

        if center_entity:
            # Get center entity
            center = graph.get_entity(center_entity)
            if center:
                nodes.append({
                    "id": center.id,
                    "name": center.name,
                    "type": center.type.value,
                    "x": 400,
                    "y": 300
                })

            # Get relationships and neighboring nodes
            rels = graph.get_entity_relationships(
                entity_id=center_entity,
                direction="both",
                tenant_id=security_ctx["tenant_id"],
                department_id=security_ctx["department_id"],
                user_security_level=security_ctx["security_level"],
                user_departments=security_ctx["departments"]
            )

            for rel_data in rels:
                rel = rel_data["relationship"]
                from_id = rel_data["from"]["id"]
                to_id = rel_data["to"]["id"]

                # Add neighboring node if not already present
                neighbor_id = to_id if from_id == center_entity else from_id
                if not any(n["id"] == neighbor_id for n in nodes):
                    neighbor_info = rel_data["to"] if from_id == center_entity else rel_data["from"]
                    nodes.append({
                        "id": neighbor_id,
                        "name": neighbor_info.get("name", neighbor_id),
                        "type": neighbor_info.get("type", "unknown"),
                    })

                edges.append({
                    "id": rel.get("id", f"{from_id}-{to_id}"),
                    "source": from_id,
                    "target": to_id,
                    "type": rel.get("type", "relates"),
                })
        else:
            # No center entity - return all entities (with security filtering)
            viz_data = graph.get_visualization_data(
                limit=limit,
                tenant_id=security_ctx["tenant_id"],
                department_id=security_ctx["department_id"],
                user_security_level=security_ctx["security_level"],
                user_departments=security_ctx["departments"]
            )
            nodes = viz_data["nodes"]
            edges = viz_data["edges"]

        return {
            "success": True,
            "data": {
                "nodes": nodes,
                "edges": edges
            }
        }

    except Exception as e:
        logger.error(f"Failed to get graph visualization: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load graph: {str(e)}"
        )


@router.get("/kb/visualization")
def get_kb_graph_visualization(
    kb_id: Optional[str] = Query(None, description="Knowledge base ID"),
    center_entity: Optional[str] = Query(None, description="Center entity ID"),
    depth: int = Query(2, ge=1, le=4),
    limit: int = Query(100, ge=10, le=500),
    graph: KBGraphService = Depends(get_kb_graph),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get graph visualization data for Knowledge Base (agent-only)
    """
    try:
        nodes = []
        edges = []

        if center_entity:
            entity = graph.get_entity(center_entity)
            if entity:
                nodes.append({
                    "id": entity.id,
                    "name": entity.name,
                    "type": entity.type.value,
                    "x": 400,
                    "y": 300
                })

            rels = graph.get_entity_relationships(
                entity_id=center_entity,
                direction="both",
                kb_id=kb_id
            )
            for rel_data in rels:
                rel = rel_data["relationship"]
                from_id = rel_data["from"]["id"]
                to_id = rel_data["to"]["id"]
                neighbor_id = to_id if from_id == center_entity else from_id
                if not any(n["id"] == neighbor_id for n in nodes):
                    neighbor_info = rel_data["to"] if from_id == center_entity else rel_data["from"]
                    nodes.append({
                        "id": neighbor_id,
                        "name": neighbor_info.get("name", neighbor_id),
                        "type": neighbor_info.get("type", "unknown"),
                    })
                edges.append({
                    "id": rel.get("id", f"{from_id}-{to_id}"),
                    "source": from_id,
                    "target": to_id,
                    "type": rel.get("type", "relates"),
                })
        else:
            viz_data = graph.get_visualization_data(limit=limit, kb_id=kb_id)
            nodes = viz_data["nodes"]
            edges = viz_data["edges"]

        return {
            "success": True,
            "data": {
                "nodes": nodes,
                "edges": edges
            }
        }

    except Exception as e:
        logger.error(f"Failed to get KB graph visualization: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load graph: {str(e)}"
        )


# ============== Legacy/Combined Endpoints (for backward compatibility) ==============

@router.get("/stats")
def get_combined_statistics(
    user_id: str = Depends(get_current_user_id)
):
    """
    Get combined statistics for both domains
    
    Returns stats for contracts and KB separately
    """
    contracts_graph = get_contracts_graph_service()
    kb_graph = get_kb_graph_service()
    
    return {
        "success": True,
        "data": {
            "contracts": contracts_graph.get_stats(),
            "knowledge_base": kb_graph.get_stats()
        }
    }
