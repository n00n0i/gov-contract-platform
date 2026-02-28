"""
Contracts Graph Service - GraphRAG for contract documents with security controls
Supports: Department hierarchy, security classification, view-relationship permission
"""
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.core.logging import get_logger
from app.models.graph_models import (
    GraphEntity, GraphRelationship, GraphDocument,
    EntityType, RelationType, GraphDomain, SecurityLevel,
    GraphQuery
)
from app.services.graph.base_graph_service import BaseGraphService

logger = get_logger(__name__)


# Security level hierarchy (from lowest to highest)
SECURITY_LEVELS_ORDER = [
    SecurityLevel.PUBLIC,
    SecurityLevel.DEPARTMENT_ONLY,
    SecurityLevel.CONFIDENTIAL,
    SecurityLevel.HIGHLY_CONFIDENTIAL,
    SecurityLevel.TOP_SECRET
]


def can_access_security_level(
    user_level: SecurityLevel,
    document_level: SecurityLevel
) -> bool:
    """Check if user can access document based on security level"""
    user_idx = SECURITY_LEVELS_ORDER.index(user_level)
    doc_idx = SECURITY_LEVELS_ORDER.index(document_level)
    return user_idx >= doc_idx


class ContractsGraphService(BaseGraphService):
    """
    Graph service for contract documents with security controls:
    - Organization structure (department hierarchy)
    - Security classification (public to top secret)
    - view-relationship permission
    """
    
    def __init__(self):
        super().__init__(domain=GraphDomain.CONTRACTS)
    
    def _build_security_filter(self, tenant_id: str, department_id: str,
                               user_security_level: SecurityLevel,
                               user_departments: List[str] = None) -> tuple:
        """
        Build security filter conditions for Neo4j query
        Returns: (where_clause, params)
        """
        # User can see their own department + child departments
        allowed_departments = user_departments or [department_id]
        
        # User can see documents with security level <= their level
        allowed_levels = [
            level.value for level in SECURITY_LEVELS_ORDER
            if can_access_security_level(user_security_level, level)
        ]
        
        where_clause = """
        (e.tenant_id = $tenant_id OR e.tenant_id IS NULL)
        AND (e.department_id IN $allowed_departments OR e.department_id IS NULL OR e.security_level = 'public' OR e.security_level IS NULL)
        AND (e.security_level IN $allowed_levels OR e.security_level IS NULL)
        """
        
        params = {
            "tenant_id": tenant_id,
            "allowed_departments": allowed_departments,
            "allowed_levels": allowed_levels
        }
        
        return where_clause, params
    
    def search_entities(
        self,
        name: str,
        entity_type: Optional[EntityType] = None,
        limit: int = 20,
        tenant_id: str = None,
        department_id: str = None,
        user_security_level: SecurityLevel = SecurityLevel.PUBLIC,
        user_departments: List[str] = None,
        **filters
    ) -> List[GraphEntity]:
        """
        Search entities with security filtering
        
        Args:
            name: Search keyword
            entity_type: Filter by entity type
            limit: Max results
            tenant_id: User's tenant
            department_id: User's department
            user_security_level: User's security clearance
            user_departments: List of departments user can access (including children)
        """
        if not self.driver:
            return []
        
        try:
            with self.driver.session() as session:
                domain_label = self._get_domain_label()
                
                # Build security filter
                security_where, security_params = self._build_security_filter(
                    tenant_id, department_id, user_security_level, user_departments
                )
                
                if entity_type:
                    query = f"""
                    MATCH (e:Entity:{domain_label})
                    WHERE e.name CONTAINS $name 
                      AND e.type = $type
                      AND {security_where}
                    RETURN e
                    ORDER BY e.confidence DESC
                    LIMIT $limit
                    """
                    params = {
                        "name": name,
                        "type": entity_type.value,
                        "limit": limit,
                        **security_params
                    }
                else:
                    query = f"""
                    CALL db.index.fulltext.queryNodes('{self.domain.value}_entity_name_fulltext', $name)
                    YIELD node as e, score
                    WHERE {security_where}
                    RETURN e
                    ORDER BY score DESC
                    LIMIT $limit
                    """
                    params = {
                        "name": f"*{name}*",
                        "limit": limit,
                        **security_params
                    }
                
                result = session.run(query, params)
                entities = []
                
                for record in result:
                    node = record["e"]
                    try:
                        entities.append(GraphEntity(
                            id=node["id"],
                            type=EntityType(node["type"]),
                            name=node["name"],
                            domain=GraphDomain(node.get("domain", "contracts")),
                            properties=self._deserialize_props(node.get("properties", {})),
                            source_doc=node.get("source_doc"),
                            confidence=node.get("confidence", 1.0),
                            tenant_id=node.get("tenant_id"),
                            department_id=node.get("department_id"),
                            security_level=SecurityLevel(node.get("security_level", "public"))
                        ))
                    except Exception as e:
                        logger.warning(f"Failed to parse entity: {e}")
                
                return entities
                
        except Exception as e:
            logger.error(f"[{self.domain.value}] Failed to search entities: {e}")
            return []
    
    def get_entity_relationships(
        self,
        entity_id: str,
        direction: str = "both",
        tenant_id: str = None,
        department_id: str = None,
        user_security_level: SecurityLevel = SecurityLevel.PUBLIC,
        user_departments: List[str] = None,
        **filters
    ) -> List[Dict[str, Any]]:
        """Get relationships for an entity with security filtering"""
        if not self.driver:
            return []
        
        try:
            with self.driver.session() as session:
                domain_label = self._get_domain_label()
                
                # Build security filter for both source and target
                security_where, security_params = self._build_security_filter(
                    tenant_id, department_id, user_security_level, user_departments
                )
                
                if direction == "out":
                    query = f"""
                    MATCH (e:Entity:{domain_label} {{id: $id}})-[r:RELATES]->(target:Entity:{domain_label})
                    WHERE r.domain = $domain
                      AND {security_where.replace('e.', 'target.')}
                    RETURN e, r, target
                    """
                elif direction == "in":
                    query = f"""
                    MATCH (source:Entity:{domain_label})-[r:RELATES]->(e:Entity:{domain_label} {{id: $id}})
                    WHERE r.domain = $domain
                      AND {security_where.replace('e.', 'source.')}
                    RETURN source, r, e
                    """
                else:
                    query = f"""
                    MATCH (e:Entity:{domain_label} {{id: $id}})-[r:RELATES]-(other:Entity:{domain_label})
                    WHERE r.domain = $domain
                      AND ({security_where.replace('e.', 'other.')})
                    RETURN e, r, other
                    """
                
                params = {
                    "id": entity_id,
                    "domain": self.domain.value,
                    **security_params
                }
                
                result = session.run(query, params)
                relationships = []
                
                for record in result:
                    rel_node = record["r"]
                    rel_data = {
                        "relationship": {
                            "id": rel_node["id"],
                            "type": rel_node["type"],
                            "properties": dict(rel_node.get("properties", {}))
                        }
                    }
                    
                    if direction == "in":
                        source = record["source"]
                        rel_data["from"] = {
                            "id": source["id"],
                            "name": source["name"],
                            "type": source["type"]
                        }
                        rel_data["to"] = {"id": entity_id}
                    else:
                        other = record["other"] if "other" in record else record["target"]
                        rel_data["from"] = {"id": entity_id}
                        rel_data["to"] = {
                            "id": other["id"],
                            "name": other["name"],
                            "type": other["type"]
                        }
                    
                    relationships.append(rel_data)
                
                return relationships
                
        except Exception as e:
            logger.error(f"[{self.domain.value}] Failed to get relationships: {e}")
            return []
    
    def get_visualization_data(
        self,
        limit: int = 100,
        tenant_id: str = None,
        department_id: str = None,
        user_security_level: SecurityLevel = SecurityLevel.PUBLIC,
        user_departments: List[str] = None,
        **filters
    ) -> Dict[str, Any]:
        """Get visualization data with security filtering"""
        if not self.driver:
            return {"nodes": [], "edges": []}

        try:
            with self.driver.session() as session:
                domain_label = self._get_domain_label()
                security_where, security_params = self._build_security_filter(
                    tenant_id, department_id, user_security_level, user_departments
                )

                result = session.run(
                    f"""
                    MATCH (e:Entity:{domain_label})
                    WHERE {security_where}
                    RETURN e
                    LIMIT $limit
                    """,
                    {"limit": limit, **security_params}
                )
                nodes = []
                entity_ids = []

                for record in result:
                    node = record["e"]
                    entity_ids.append(node["id"])
                    nodes.append({
                        "id": node["id"],
                        "name": node["name"],
                        "type": node.get("type", "unknown"),
                    })

                edges = []
                if entity_ids:
                    rel_result = session.run(
                        f"""
                        MATCH (s:Entity:{domain_label})-[r:RELATES]->(t:Entity:{domain_label})
                        WHERE s.id IN $ids AND t.id IN $ids AND r.domain = $domain
                        RETURN r.id as rel_id, r.type as rel_type, s.id as source_id, t.id as target_id
                        LIMIT $rel_limit
                        """,
                        {"ids": entity_ids, "domain": self.domain.value, "rel_limit": limit * 2}
                    )
                    for record in rel_result:
                        edges.append({
                            "id": record.get("rel_id") or str(uuid.uuid4()),
                            "source": record["source_id"],
                            "target": record["target_id"],
                            "type": record.get("rel_type") or "relates",
                        })

                return {"nodes": nodes, "edges": edges}
        except Exception as e:
            logger.error(f"[{self.domain.value}] Failed to get visualization data: {e}")
            return {"nodes": [], "edges": []}

    def find_paths(
        self,
        start_entity_id: str,
        end_entity_id: str,
        max_depth: int = 4,
        tenant_id: str = None,
        department_id: str = None,
        user_security_level: SecurityLevel = SecurityLevel.PUBLIC,
        user_departments: List[str] = None
    ) -> List[Dict[str, Any]]:
        """Find paths between two entities with security filtering"""
        if not self.driver:
            return []
        
        try:
            with self.driver.session() as session:
                domain_label = self._get_domain_label()
                
                # Build security filter
                security_where, security_params = self._build_security_filter(
                    tenant_id, department_id, user_security_level, user_departments
                )
                
                query = f"""
                MATCH path = (start:Entity:{domain_label} {{id: $start_id}})-[:RELATES*1..$max_depth]-(end:Entity:{domain_label} {{id: $end_id}})
                WHERE start.domain = $domain AND end.domain = $domain
                  AND ALL(n IN nodes(path) WHERE n.domain = $domain AND ({security_where.replace('e.', 'n.')}) )
                RETURN path
                LIMIT 10
                """
                
                params = {
                    "start_id": start_entity_id,
                    "end_id": end_entity_id,
                    "max_depth": max_depth,
                    "domain": self.domain.value,
                    **security_params
                }
                
                result = session.run(query, params)
                paths = []
                
                for record in result:
                    path = record["path"]
                    paths.append({
                        "length": len(path.relationships),
                        "nodes": [{"id": n["id"], "name": n["name"], "type": n["type"]} 
                                 for n in path.nodes],
                        "relationships": [{"type": r["type"]} for r in path.relationships]
                    })
                
                return paths
                
        except Exception as e:
            logger.error(f"[{self.domain.value}] Failed to find paths: {e}")
            return []


# Singleton instance
_contracts_graph_service = None


def get_contracts_graph_service() -> ContractsGraphService:
    """Get contracts graph service singleton"""
    global _contracts_graph_service
    if _contracts_graph_service is None:
        _contracts_graph_service = ContractsGraphService()
    return _contracts_graph_service
