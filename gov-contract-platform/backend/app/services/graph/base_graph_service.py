"""
Base Graph Service - Common Neo4j operations for both Contracts and KB domains
"""
import os
import uuid
import json
from typing import List, Optional, Dict, Any, Tuple
from abc import ABC, abstractmethod
from neo4j import GraphDatabase, Driver
from neo4j.exceptions import Neo4jError

from app.core.logging import get_logger
from app.models.graph_models import (
    GraphEntity, GraphRelationship, GraphDocument,
    EntityType, RelationType, GraphPath, GraphDomain, SecurityLevel
)

logger = get_logger(__name__)


class BaseGraphService(ABC):
    """Base service for managing knowledge graph in Neo4j"""
    
    def __init__(self, domain: GraphDomain):
        self.domain = domain
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
            logger.info(f"[{self.domain.value}] Connected to Neo4j at {uri}")
        except Exception as e:
            logger.error(f"[{self.domain.value}] Failed to connect to Neo4j: {e}")
            self.driver = None
    
    def _create_indexes(self):
        """Create indexes for better query performance"""
        if not self.driver:
            return
            
        try:
            with self.driver.session() as session:
                # Create indexes with domain-specific labels
                domain_label = self.domain.value.capitalize()
                indexes = [
                    f"CREATE INDEX {self.domain.value}_entity_id_idx IF NOT EXISTS FOR (e:Entity:{domain_label}) ON (e.id)",
                    f"CREATE INDEX {self.domain.value}_entity_type_idx IF NOT EXISTS FOR (e:Entity:{domain_label}) ON (e.type)",
                    f"CREATE INDEX {self.domain.value}_entity_name_idx IF NOT EXISTS FOR (e:Entity:{domain_label}) ON (e.name)",
                    f"CREATE INDEX {self.domain.value}_doc_id_idx IF NOT EXISTS FOR (d:Document:{domain_label}) ON (d.id)",
                    f"CREATE INDEX {self.domain.value}_entity_security_idx IF NOT EXISTS FOR (e:Entity:{domain_label}) ON (e.security_level)",
                    f"CREATE INDEX {self.domain.value}_entity_dept_idx IF NOT EXISTS FOR (e:Entity:{domain_label}) ON (e.department_id)",
                    f"CREATE FULLTEXT INDEX {self.domain.value}_entity_name_fulltext IF NOT EXISTS FOR (e:Entity:{domain_label}) ON EACH [e.name]"
                ]
                
                for index_query in indexes:
                    try:
                        session.run(index_query)
                    except Neo4jError as e:
                        logger.warning(f"[{self.domain.value}] Index creation warning: {e}")
                        
                logger.info(f"[{self.domain.value}] Graph indexes created")
        except Exception as e:
            logger.error(f"[{self.domain.value}] Failed to create indexes: {e}")
    
    def close(self):
        """Close Neo4j connection"""
        if self.driver:
            self.driver.close()
    
    def _get_domain_label(self) -> str:
        """Get Neo4j label for this domain"""
        return self.domain.value.capitalize()
    
    def clear_all_data(self) -> Dict[str, int]:
        """
        Clear all data for this domain from Neo4j.
        Returns counts of deleted entities, documents, and relationships.
        """
        if not self.driver:
            return {"deleted_entities": 0, "deleted_documents": 0, "deleted_relationships": 0}
        
        try:
            with self.driver.session() as session:
                domain_label = self._get_domain_label()
                
                # Step 1: Delete ALL relationships connected to domain nodes
                # First, delete relationships from entities
                rel_from_entity_query = f"""
                MATCH (e:Entity:{domain_label})-[r]->()
                WITH r LIMIT 10000
                DELETE r
                RETURN count(r) as deleted
                """
                
                # Delete relationships to entities
                rel_to_entity_query = f"""
                MATCH ()-[r]->(e:Entity:{domain_label})
                WITH r LIMIT 10000
                DELETE r
                RETURN count(r) as deleted
                """
                
                # Delete relationships from documents
                rel_from_doc_query = f"""
                MATCH (d:Document:{domain_label})-[r]->()
                WITH r LIMIT 10000
                DELETE r
                RETURN count(r) as deleted
                """
                
                # Delete relationships to documents
                rel_to_doc_query = f"""
                MATCH ()-[r]->(d:Document:{domain_label})
                WITH r LIMIT 10000
                DELETE r
                RETURN count(r) as deleted
                """
                
                total_rels = 0
                
                # Delete all relationships in batches
                for query in [rel_from_entity_query, rel_to_entity_query, rel_from_doc_query, rel_to_doc_query]:
                    while True:
                        result = session.run(query)
                        record = result.single()
                        deleted = record["deleted"] if record else 0
                        total_rels += deleted
                        if deleted == 0:
                            break
                
                # Step 2: Delete all entity nodes for this domain
                entity_query = f"""
                MATCH (e:Entity:{domain_label})
                WITH e LIMIT 10000
                DELETE e
                RETURN count(e) as deleted
                """
                
                total_entities = 0
                while True:
                    result = session.run(entity_query)
                    record = result.single()
                    deleted = record["deleted"] if record else 0
                    total_entities += deleted
                    if deleted == 0:
                        break
                
                # Step 3: Delete all document nodes for this domain
                doc_query = f"""
                MATCH (d:Document:{domain_label})
                WITH d LIMIT 10000
                DELETE d
                RETURN count(d) as deleted
                """
                
                total_docs = 0
                while True:
                    result = session.run(doc_query)
                    record = result.single()
                    deleted = record["deleted"] if record else 0
                    total_docs += deleted
                    if deleted == 0:
                        break
                
                logger.warning(f"[{self.domain.value}] Cleared all graph data: {total_entities} entities, {total_docs} documents, {total_rels} relationships")
                
                return {
                    "deleted_entities": total_entities,
                    "deleted_documents": total_docs,
                    "deleted_relationships": total_rels
                }
        except Exception as e:
            logger.error(f"[{self.domain.value}] Failed to clear graph data: {e}")
            return {"deleted_entities": 0, "deleted_documents": 0, "deleted_relationships": 0, "error": str(e)}

    @staticmethod
    def _serialize_props(props: Dict[str, Any]) -> str:
        """Serialize properties dict to JSON string for Neo4j storage"""
        if not props:
            return "{}"
        return json.dumps(props, default=str)

    @staticmethod
    def _deserialize_props(props_str) -> Dict[str, Any]:
        """Deserialize properties from Neo4j node (JSON string or dict)"""
        if not props_str:
            return {}
        if isinstance(props_str, dict):
            return props_str
        try:
            return json.loads(props_str)
        except (json.JSONDecodeError, TypeError):
            return {}
    
    # ============== Entity Operations ==============
    
    def create_entity(self, entity: GraphEntity) -> bool:
        """Create or update an entity node"""
        if not self.driver:
            return False

        # Ensure entity has correct domain
        entity.domain = self.domain

        try:
            with self.driver.session() as session:
                domain_label = self._get_domain_label()
                query = f"""
                MERGE (e:Entity:{domain_label} {{id: $id}})
                SET e.type = $type,
                    e.name = $name,
                    e.domain = $domain,
                    e.properties = $properties,
                    e.source_doc = $source_doc,
                    e.confidence = $confidence,
                    e.tenant_id = $tenant_id,
                    e.department_id = $department_id,
                    e.security_level = $security_level
                RETURN e
                """

                result = session.run(query, {
                    "id": entity.id,
                    "type": entity.type.value,
                    "name": entity.name,
                    "domain": entity.domain.value,
                    "properties": self._serialize_props(entity.properties),
                    "source_doc": entity.source_doc,
                    "confidence": entity.confidence,
                    "tenant_id": entity.tenant_id,
                    "department_id": entity.department_id,
                    "security_level": entity.security_level.value
                })
                result.consume()
                return True
        except Exception as e:
            logger.error(f"[{self.domain.value}] Failed to create entity: {e}")
            return False

    def create_relationship(self, rel: GraphRelationship) -> bool:
        """Create a relationship between two entities"""
        if not self.driver:
            return False

        # Ensure relationship has correct domain
        rel.domain = self.domain

        try:
            with self.driver.session() as session:
                domain_label = self._get_domain_label()
                query = f"""
                MATCH (source:Entity:{domain_label} {{id: $source_id}})
                MATCH (target:Entity:{domain_label} {{id: $target_id}})
                MERGE (source)-[r:RELATES {{id: $id}}]->(target)
                SET r.type = $type,
                    r.domain = $domain,
                    r.properties = $properties,
                    r.source_doc = $source_doc,
                    r.confidence = $confidence,
                    r.tenant_id = $tenant_id,
                    r.department_id = $department_id,
                    r.security_level = $security_level
                RETURN r
                """

                result = session.run(query, {
                    "id": rel.id,
                    "source_id": rel.source_id,
                    "target_id": rel.target_id,
                    "type": rel.type.value,
                    "domain": rel.domain.value,
                    "properties": self._serialize_props(rel.properties),
                    "source_doc": rel.source_doc,
                    "confidence": rel.confidence,
                    "tenant_id": rel.tenant_id,
                    "department_id": rel.department_id,
                    "security_level": rel.security_level.value
                })
                result.consume()
                return True
        except Exception as e:
            logger.error(f"[{self.domain.value}] Failed to create relationship: {e}")
            return False

    def save_graph_document(self, doc: GraphDocument) -> bool:
        """Save a complete graph document with entities and relationships in one session"""
        if not self.driver:
            return False

        # Ensure document has correct domain
        doc.domain = self.domain
        domain_label = self._get_domain_label()

        try:
            with self.driver.session() as session:
                # Create document node
                doc_query = f"""
                MERGE (d:Document:{domain_label} {{id: $doc_id}})
                SET d.doc_type = $doc_type,
                    d.title = $title,
                    d.domain = $domain,
                    d.tenant_id = $tenant_id,
                    d.department_id = $department_id,
                    d.security_level = $security_level
                RETURN d
                """
                session.run(doc_query, {
                    "doc_id": doc.doc_id,
                    "doc_type": doc.doc_type,
                    "title": doc.title,
                    "domain": doc.domain.value,
                    "tenant_id": doc.tenant_id,
                    "department_id": doc.department_id,
                    "security_level": doc.security_level.value
                }).consume()

                # Create all entities in the same session
                entity_query = f"""
                MERGE (e:Entity:{domain_label} {{id: $id}})
                SET e.type = $type,
                    e.name = $name,
                    e.domain = $domain,
                    e.properties = $properties,
                    e.source_doc = $source_doc,
                    e.confidence = $confidence,
                    e.tenant_id = $tenant_id,
                    e.department_id = $department_id,
                    e.security_level = $security_level
                RETURN e.id
                """
                for entity in doc.entities:
                    session.run(entity_query, {
                        "id": entity.id,
                        "type": entity.type.value,
                        "name": entity.name,
                        "domain": doc.domain.value,
                        "properties": self._serialize_props(entity.properties),
                        "source_doc": entity.source_doc or doc.doc_id,
                        "confidence": entity.confidence,
                        "tenant_id": doc.tenant_id,
                        "department_id": doc.department_id,
                        "security_level": doc.security_level.value
                    }).consume()

                # Create all relationships in the same session
                rel_query = f"""
                MATCH (source:Entity:{domain_label} {{id: $source_id}})
                MATCH (target:Entity:{domain_label} {{id: $target_id}})
                MERGE (source)-[r:RELATES {{id: $id}}]->(target)
                SET r.type = $type,
                    r.domain = $domain,
                    r.properties = $properties,
                    r.source_doc = $source_doc,
                    r.confidence = $confidence,
                    r.tenant_id = $tenant_id,
                    r.department_id = $department_id,
                    r.security_level = $security_level
                RETURN r.id
                """
                for rel in doc.relationships:
                    session.run(rel_query, {
                        "id": rel.id,
                        "source_id": rel.source_id,
                        "target_id": rel.target_id,
                        "type": rel.type.value,
                        "domain": doc.domain.value,
                        "properties": self._serialize_props(rel.properties),
                        "source_doc": rel.source_doc or doc.doc_id,
                        "confidence": rel.confidence,
                        "tenant_id": doc.tenant_id,
                        "department_id": doc.department_id,
                        "security_level": doc.security_level.value
                    }).consume()

                logger.info(f"[{self.domain.value}] Saved graph document: {doc.doc_id} with {len(doc.entities)} entities, {len(doc.relationships)} relationships")
                return True

        except Exception as e:
            logger.error(f"[{self.domain.value}] Failed to save graph document: {e}")
            return False
    
    @abstractmethod
    def search_entities(self, name: str, entity_type: Optional[EntityType] = None,
                       limit: int = 20, **filters) -> List[GraphEntity]:
        """Search entities - must be implemented by domain-specific service"""
        pass
    
    @abstractmethod
    def get_entity_relationships(self, entity_id: str, direction: str = "both", 
                                 **filters) -> List[Dict[str, Any]]:
        """Get relationships for an entity - must be implemented by domain-specific service"""
        pass
    
    def get_entity(self, entity_id: str) -> Optional[GraphEntity]:
        """Get entity by ID"""
        if not self.driver:
            return None

        try:
            with self.driver.session() as session:
                domain_label = self._get_domain_label()
                result = session.run(
                    f"MATCH (e:Entity:{domain_label} {{id: $id}}) RETURN e",
                    {"id": entity_id}
                )
                record = result.single()

                if record:
                    node = record["e"]
                    return GraphEntity(
                        id=node["id"],
                        type=EntityType(node["type"]),
                        name=node["name"],
                        domain=GraphDomain(node.get("domain", self.domain.value)),
                        properties=self._deserialize_props(node.get("properties", {})),
                        source_doc=node.get("source_doc"),
                        confidence=node.get("confidence", 1.0),
                        tenant_id=node.get("tenant_id"),
                        department_id=node.get("department_id"),
                        security_level=SecurityLevel(node.get("security_level", "public"))
                    )
                return None
        except Exception as e:
            logger.error(f"[{self.domain.value}] Failed to get entity: {e}")
            return None

    def delete_document_graph(self, doc_id: str) -> bool:
        """Delete all entities and relationships for a document"""
        if not self.driver:
            return False
            
        try:
            with self.driver.session() as session:
                domain_label = self._get_domain_label()
                query = f"""
                MATCH (d:Document:{domain_label} {{id: $doc_id}})
                OPTIONAL MATCH (d)-[:CONTAINS]->(e:Entity:{domain_label})
                OPTIONAL MATCH (e)-[r:RELATES]-()
                DELETE r, e, d
                """
                
                session.run(query, {"doc_id": doc_id})
                logger.info(f"[{self.domain.value}] Deleted graph for document: {doc_id}")
                return True
        except Exception as e:
            logger.error(f"[{self.domain.value}] Failed to delete document graph: {e}")
            return False
    
    def get_visualization_data(self, limit: int = 100, **filters) -> Dict[str, Any]:
        """Get entities and relationships for graph visualization (no security filtering)"""
        if not self.driver:
            return {"nodes": [], "edges": []}

        try:
            with self.driver.session() as session:
                domain_label = self._get_domain_label()

                result = session.run(
                    f"MATCH (e:Entity:{domain_label}) RETURN e LIMIT $limit",
                    {"limit": limit}
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

    def get_stats(self) -> Dict[str, Any]:
        """Get graph statistics"""
        if not self.driver:
            return {"total_entities": 0, "total_relationships": 0, "total_documents": 0}
        
        try:
            with self.driver.session() as session:
                domain_label = self._get_domain_label()
                
                entity_query = f"MATCH (e:Entity:{domain_label}) RETURN count(e) as count"
                rel_query = f"MATCH ()-[r:RELATES]->() WHERE r.domain = $domain RETURN count(r) as count"
                doc_query = f"MATCH (d:Document:{domain_label}) RETURN count(d) as count"
                
                entity_count = session.run(entity_query).single()["count"]
                rel_count = session.run(rel_query, {"domain": self.domain.value}).single()["count"]
                doc_count = session.run(doc_query).single()["count"]
                
                return {
                    "total_entities": entity_count,
                    "total_relationships": rel_count,
                    "total_documents": doc_count,
                    "domain": self.domain.value
                }
        except Exception as e:
            logger.error(f"[{self.domain.value}] Failed to get stats: {e}")
            return {"total_entities": 0, "total_relationships": 0, "total_documents": 0}
