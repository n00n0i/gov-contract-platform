"""
Knowledge Base Graph Service - GraphRAG for Knowledge Base (Agent-only access)
No security controls - used internally by agents for context understanding
"""
from typing import List, Optional, Dict, Any

from app.core.logging import get_logger
from app.models.graph_models import (
    GraphEntity, GraphRelationship, GraphDocument,
    EntityType, RelationType, GraphDomain
)
from app.services.graph.base_graph_service import BaseGraphService

logger = get_logger(__name__)


class KBGraphService(BaseGraphService):
    """
    Graph service for Knowledge Base content
    - No security filtering (agent-only access)
    - Used by AI agents for context understanding
    - Separate graph from contracts
    """
    
    def __init__(self):
        super().__init__(domain=GraphDomain.KNOWLEDGE_BASE)
    
    def search_entities(
        self,
        name: str,
        entity_type: Optional[EntityType] = None,
        limit: int = 20,
        kb_id: Optional[str] = None,
        **filters
    ) -> List[GraphEntity]:
        """
        Search entities in KB (no security filtering)
        
        Args:
            name: Search keyword
            entity_type: Filter by entity type
            limit: Max results
            kb_id: Optional knowledge base ID filter
        """
        if not self.driver:
            return []
        
        try:
            with self.driver.session() as session:
                domain_label = self._get_domain_label()
                
                # KB-specific filter
                kb_filter = "AND e.kb_id = $kb_id" if kb_id else ""
                params = {"name": name, "limit": limit}
                if kb_id:
                    params["kb_id"] = kb_id
                
                if entity_type:
                    query = f"""
                    MATCH (e:Entity:{domain_label})
                    WHERE e.name CONTAINS $name 
                      AND e.type = $type
                      {kb_filter}
                    RETURN e
                    ORDER BY e.confidence DESC
                    LIMIT $limit
                    """
                    params["type"] = entity_type.value
                else:
                    query = f"""
                    CALL db.index.fulltext.queryNodes('{self.domain.value}_entity_name_fulltext', $name)
                    YIELD node as e, score
                    WHERE 1=1 {kb_filter}
                    RETURN e
                    ORDER BY score DESC
                    LIMIT $limit
                    """
                
                result = session.run(query, params)
                entities = []
                
                for record in result:
                    node = record["e"]
                    try:
                        entities.append(GraphEntity(
                            id=node["id"],
                            type=EntityType(node["type"]),
                            name=node["name"],
                            domain=GraphDomain.KNOWLEDGE_BASE,
                            properties=dict(node.get("properties", {})),
                            source_doc=node.get("source_doc"),
                            confidence=node.get("confidence", 1.0)
                        ))
                    except Exception as e:
                        logger.warning(f"Failed to parse KB entity: {e}")
                
                return entities
                
        except Exception as e:
            logger.error(f"[{self.domain.value}] Failed to search KB entities: {e}")
            return []
    
    def get_entity_relationships(
        self,
        entity_id: str,
        direction: str = "both",
        kb_id: Optional[str] = None,
        **filters
    ) -> List[Dict[str, Any]]:
        """Get relationships for a KB entity (no security filtering)"""
        if not self.driver:
            return []
        
        try:
            with self.driver.session() as session:
                domain_label = self._get_domain_label()
                
                # KB filter
                kb_filter = "AND (e.kb_id = $kb_id OR other.kb_id = $kb_id)" if kb_id else ""
                params = {"id": entity_id, "domain": self.domain.value}
                if kb_id:
                    params["kb_id"] = kb_id
                
                if direction == "out":
                    query = f"""
                    MATCH (e:Entity:{domain_label} {{id: $id}})-[r:RELATES]->(target:Entity:{domain_label})
                    WHERE r.domain = $domain {kb_filter}
                    RETURN e, r, target
                    """
                elif direction == "in":
                    query = f"""
                    MATCH (source:Entity:{domain_label})-[r:RELATES]->(e:Entity:{domain_label} {{id: $id}})
                    WHERE r.domain = $domain {kb_filter}
                    RETURN source, r, e
                    """
                else:
                    query = f"""
                    MATCH (e:Entity:{domain_label} {{id: $id}})-[r:RELATES]-(other:Entity:{domain_label})
                    WHERE r.domain = $domain {kb_filter}
                    RETURN e, r, other
                    """
                
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
            logger.error(f"[{self.domain.value}] Failed to get KB relationships: {e}")
            return []
    
    def get_context_for_agent(
        self,
        query: str,
        kb_id: Optional[str] = None,
        max_entities: int = 10,
        max_relationships: int = 20
    ) -> Dict[str, Any]:
        """
        Get graph context for AI agent (RAG enhancement)
        
        Returns relevant entities and relationships for the query
        """
        if not self.driver:
            return {"entities": [], "relationships": []}
        
        try:
            # Search relevant entities
            entities = self.search_entities(query, limit=max_entities, kb_id=kb_id)
            
            # Get relationships for these entities
            all_relationships = []
            for entity in entities:
                rels = self.get_entity_relationships(
                    entity.id, 
                    direction="both",
                    kb_id=kb_id
                )
                all_relationships.extend(rels)
            
            # Deduplicate and limit
            seen_rels = set()
            unique_relationships = []
            for rel in all_relationships:
                rel_key = (rel["from"]["id"], rel["to"]["id"], rel["relationship"]["type"])
                if rel_key not in seen_rels and len(unique_relationships) < max_relationships:
                    seen_rels.add(rel_key)
                    unique_relationships.append(rel)
            
            return {
                "entities": [e.to_dict() for e in entities],
                "relationships": unique_relationships,
                "kb_id": kb_id
            }
            
        except Exception as e:
            logger.error(f"[{self.domain.value}] Failed to get agent context: {e}")
            return {"entities": [], "relationships": []}
    
    def find_related_kbs(
        self,
        kb_id: str,
        shared_entities_threshold: int = 2
    ) -> List[Dict[str, Any]]:
        """
        Find related knowledge bases based on shared entities
        Useful for agent to understand cross-KB relationships
        """
        if not self.driver:
            return []
        
        try:
            with self.driver.session() as session:
                domain_label = self._get_domain_label()
                
                query = f"""
                MATCH (e:Entity:{domain_label})-[:RELATES]-(other:Entity:{domain_label})
                WHERE e.kb_id = $kb_id AND other.kb_id <> $kb_id
                WITH other.kb_id as related_kb, count(DISTINCT e) as shared_count
                WHERE shared_count >= $threshold
                RETURN related_kb, shared_count
                ORDER BY shared_count DESC
                """
                
                result = session.run(query, {
                    "kb_id": kb_id,
                    "threshold": shared_entities_threshold
                })
                
                return [
                    {"kb_id": r["related_kb"], "shared_entities": r["shared_count"]}
                    for r in result
                ]
                
        except Exception as e:
            logger.error(f"[{self.domain.value}] Failed to find related KBs: {e}")
            return []


# Singleton instance
_kb_graph_service = None


def get_kb_graph_service() -> KBGraphService:
    """Get KB graph service singleton"""
    global _kb_graph_service
    if _kb_graph_service is None:
        _kb_graph_service = KBGraphService()
    return _kb_graph_service
