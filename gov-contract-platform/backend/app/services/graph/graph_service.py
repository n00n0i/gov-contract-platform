"""
GraphRAG Service - Neo4j graph operations for contract documents
"""
import os
import uuid
from typing import List, Optional, Dict, Any, Tuple
from neo4j import GraphDatabase, Driver
from neo4j.exceptions import Neo4jError

from app.core.logging import get_logger
from app.models.graph_models import (
    GraphEntity, GraphRelationship, GraphDocument,
    EntityType, RelationType, GraphPath
)

logger = get_logger(__name__)


class GraphService:
    """Service for managing contract knowledge graph in Neo4j"""
    
    def __init__(self):
        self.driver: Optional[Driver] = None
        self._init_driver()
        self._create_indexes()
    
    def _init_driver(self):
        """Initialize Neo4j connection"""
        try:
            uri = os.getenv("NEO4J_URI", "bolt://neo4j:7687")
            user = os.getenv("NEO4J_USER", "neo4j")
            password = os.getenv("NEO4J_PASSWORD", "graphragpass")
            
            self.driver = GraphDatabase.driver(uri, auth=(user, password))
            logger.info(f"Connected to Neo4j at {uri}")
        except Exception as e:
            logger.error(f"Failed to connect to Neo4j: {e}")
            self.driver = None
    
    def _create_indexes(self):
        """Create indexes for better query performance"""
        if not self.driver:
            return
            
        try:
            with self.driver.session() as session:
                # Create indexes
                indexes = [
                    "CREATE INDEX entity_id_idx IF NOT EXISTS FOR (e:Entity) ON (e.id)",
                    "CREATE INDEX entity_type_idx IF NOT EXISTS FOR (e:Entity) ON (e.type)",
                    "CREATE INDEX entity_name_idx IF NOT EXISTS FOR (e:Entity) ON (e.name)",
                    "CREATE INDEX doc_id_idx IF NOT EXISTS FOR (d:Document) ON (d.id)",
                    "CREATE FULLTEXT INDEX entity_name_fulltext IF NOT EXISTS FOR (e:Entity) ON EACH [e.name]"
                ]
                
                for index_query in indexes:
                    try:
                        session.run(index_query)
                    except Neo4jError as e:
                        logger.warning(f"Index creation warning: {e}")
                        
                logger.info("Graph indexes created")
        except Exception as e:
            logger.error(f"Failed to create indexes: {e}")
    
    def close(self):
        """Close Neo4j connection"""
        if self.driver:
            self.driver.close()
    
    # ============== Entity Operations ==============
    
    def create_entity(self, entity: GraphEntity) -> bool:
        """Create or update an entity node"""
        if not self.driver:
            return False
            
        try:
            with self.driver.session() as session:
                query = """
                MERGE (e:Entity {id: $id})
                SET e.type = $type,
                    e.name = $name,
                    e.properties = $properties,
                    e.source_doc = $source_doc,
                    e.confidence = $confidence,
                    e.created_at = datetime($created_at)
                RETURN e
                """
                
                session.run(query, {
                    "id": entity.id,
                    "type": entity.type.value,
                    "name": entity.name,
                    "properties": entity.properties,
                    "source_doc": entity.source_doc,
                    "confidence": entity.confidence,
                    "created_at": entity.created_at.isoformat() if entity.created_at else None
                })
                
                return True
        except Exception as e:
            logger.error(f"Failed to create entity: {e}")
            return False
    
    def get_entity(self, entity_id: str) -> Optional[GraphEntity]:
        """Get entity by ID"""
        if not self.driver:
            return None
            
        try:
            with self.driver.session() as session:
                result = session.run(
                    "MATCH (e:Entity {id: $id}) RETURN e",
                    {"id": entity_id}
                )
                record = result.single()
                
                if record:
                    node = record["e"]
                    return GraphEntity(
                        id=node["id"],
                        type=EntityType(node["type"]),
                        name=node["name"],
                        properties=dict(node["properties"]),
                        source_doc=node.get("source_doc"),
                        confidence=node.get("confidence", 1.0)
                    )
                return None
        except Exception as e:
            logger.error(f"Failed to get entity: {e}")
            return None
    
    def search_entities(self, name: str, entity_type: Optional[EntityType] = None, 
                       limit: int = 20) -> List[GraphEntity]:
        """Search entities by name (fuzzy search)"""
        if not self.driver:
            return []
            
        try:
            with self.driver.session() as session:
                if entity_type:
                    query = """
                    MATCH (e:Entity)
                    WHERE e.name CONTAINS $name AND e.type = $type
                    RETURN e
                    ORDER BY e.confidence DESC
                    LIMIT $limit
                    """
                    params = {"name": name, "type": entity_type.value, "limit": limit}
                else:
                    query = """
                    CALL db.index.fulltext.queryNodes('entity_name_fulltext', $name)
                    YIELD node as e, score
                    RETURN e
                    ORDER BY score DESC
                    LIMIT $limit
                    """
                    params = {"name": f"*{name}*", "limit": limit}
                
                result = session.run(query, params)
                entities = []
                
                for record in result:
                    node = record["e"]
                    entities.append(GraphEntity(
                        id=node["id"],
                        type=EntityType(node["type"]),
                        name=node["name"],
                        properties=dict(node.get("properties", {})),
                        source_doc=node.get("source_doc"),
                        confidence=node.get("confidence", 1.0)
                    ))
                
                return entities
        except Exception as e:
            logger.error(f"Failed to search entities: {e}")
            return []
    
    def get_entity_relationships(self, entity_id: str, direction: str = "both") -> List[Dict[str, Any]]:
        """Get all relationships for an entity"""
        if not self.driver:
            return []
            
        try:
            with self.driver.session() as session:
                if direction == "out":
                    query = """
                    MATCH (e:Entity {id: $id})-[r:RELATES]->(target:Entity)
                    RETURN e, r, target
                    """
                elif direction == "in":
                    query = """
                    MATCH (source:Entity)-[r:RELATES]->(e:Entity {id: $id})
                    RETURN source, r, e
                    """
                else:
                    query = """
                    MATCH (e:Entity {id: $id})-[r:RELATES]-(other:Entity)
                    RETURN e, r, other
                    """
                
                result = session.run(query, {"id": entity_id})
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
                        rel_data["from"] = {"id": source["id"], "name": source["name"], "type": source["type"]}
                        rel_data["to"] = {"id": entity_id}
                    else:
                        other = record["other"] if "other" in record else record["target"]
                        rel_data["from"] = {"id": entity_id}
                        rel_data["to"] = {"id": other["id"], "name": other["name"], "type": other["type"]}
                    
                    relationships.append(rel_data)
                
                return relationships
        except Exception as e:
            logger.error(f"Failed to get relationships: {e}")
            return []
    
    def get_connected_entities(self, entity_id: str, depth: int = 2) -> Dict[str, Any]:
        """Get entity neighborhood (subgraph)"""
        if not self.driver:
            return {}
            
        try:
            with self.driver.session() as session:
                query = """
                MATCH (center:Entity {id: $id})
                OPTIONAL MATCH (center)-[:RELATES*1..$depth]-(connected:Entity)
                WITH center, collect(DISTINCT connected) as entities
                RETURN center, entities
                """
                
                result = session.run(query, {"id": entity_id, "depth": depth})
                record = result.single()
                
                if record:
                    center = record["center"]
                    return {
                        "center": {
                            "id": center["id"],
                            "name": center["name"],
                            "type": center["type"]
                        },
                        "connected_entities": [
                            {"id": e["id"], "name": e["name"], "type": e["type"]}
                            for e in record["entities"] if e
                        ]
                    }
                return {"center": None, "connected_entities": []}
        except Exception as e:
            logger.error(f"Failed to get connected entities: {e}")
            return {}
    
    def get_subgraph_for_visualization(self, center_entity_id: str, depth: int = 2, limit: int = 100) -> Dict[str, Any]:
        """Get subgraph data for visualization"""
        if not self.driver:
            return {"nodes": [], "edges": []}
            
        try:
            with self.driver.session() as session:
                # Get nodes
                nodes_query = """
                MATCH (center:Entity {id: $id})
                OPTIONAL MATCH (center)-[:RELATES*1..$depth]-(n:Entity)
                WITH center, collect(DISTINCT n) as neighbors
                UNWIND [center] + neighbors as node
                RETURN DISTINCT node.id as id, node.name as name, node.type as type
                LIMIT $limit
                """
                
                nodes_result = session.run(nodes_query, {"id": center_entity_id, "depth": depth, "limit": limit})
                nodes = [{"id": r["id"], "name": r["name"], "type": r["type"]} for r in nodes_result]
                
                # Get edges between these nodes
                node_ids = [n["id"] for n in nodes]
                edges_query = """
                MATCH (a:Entity)-[r:RELATES]->(b:Entity)
                WHERE a.id IN $node_ids AND b.id IN $node_ids
                RETURN r.id as id, a.id as source, b.id as target, r.type as type
                LIMIT $limit
                """
                
                edges_result = session.run(edges_query, {"node_ids": node_ids, "limit": limit})
                edges = [{"id": r["id"], "source": r["source"], "target": r["target"], "type": r["type"]} for r in edges_result]
                
                return {"nodes": nodes, "edges": edges}
        except Exception as e:
            logger.error(f"Failed to get subgraph: {e}")
            return {"nodes": [], "edges": []}
    
    def get_global_graph_sample(self, limit: int = 100) -> Dict[str, Any]:
        """Get a sample of the global graph"""
        if not self.driver:
            return {"nodes": [], "edges": []}
            
        try:
            with self.driver.session() as session:
                # Get random sample of nodes
                nodes_query = """
                MATCH (e:Entity)
                RETURN e.id as id, e.name as name, e.type as type
                LIMIT $limit
                """
                
                nodes_result = session.run(nodes_query, {"limit": limit})
                nodes = [{"id": r["id"], "name": r["name"], "type": r["type"]} for r in nodes_result]
                
                # Get edges between these nodes
                node_ids = [n["id"] for n in nodes]
                edges_query = """
                MATCH (a:Entity)-[r:RELATES]->(b:Entity)
                WHERE a.id IN $node_ids AND b.id IN $node_ids
                RETURN r.id as id, a.id as source, b.id as target, r.type as type
                LIMIT $limit
                """
                
                edges_result = session.run(edges_query, {"node_ids": node_ids, "limit": limit})
                edges = [{"id": r["id"], "source": r["source"], "target": r["target"], "type": r["type"]} for r in edges_result]
                
                return {"nodes": nodes, "edges": edges}
        except Exception as e:
            logger.error(f"Failed to get global graph: {e}")
            return {"nodes": [], "edges": []}
    
    def get_graph_stats(self) -> Dict[str, Any]:
        """Get graph statistics"""
        if not self.driver:
            return {"error": "Neo4j not connected"}
            
        try:
            with self.driver.session() as session:
                # Entity counts by type
                entity_counts = session.run("""
                    MATCH (e:Entity)
                    RETURN e.type as type, count(e) as count
                """).data()
                
                # Total counts
                total_entities = session.run("MATCH (e:Entity) RETURN count(e) as count").single()["count"]
                total_relationships = session.run("MATCH ()-[r:RELATES]->() RETURN count(r) as count").single()["count"]
                total_documents = session.run("MATCH (d:Document) RETURN count(d) as count").single()["count"]
                
                return {
                    "total_entities": total_entities,
                    "total_relationships": total_relationships,
                    "total_documents": total_documents,
                    "entities_by_type": {r["type"]: r["count"] for r in entity_counts}
                }
        except Exception as e:
            logger.error(f"Failed to get graph stats: {e}")
            return {"error": str(e)}


# Global instance
_graph_service: Optional[GraphService] = None


def get_graph_service() -> GraphService:
    """Get or create graph service singleton"""
    global _graph_service
    if _graph_service is None:
        _graph_service = GraphService()
    return _graph_service
