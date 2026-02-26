"""
GraphRAG Models - Entity and Relationship models for Neo4j
"""
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class EntityType(str, Enum):
    """Types of entities in contract documents"""
    PERSON = "person"           # บุคคล (ผู้ว่าจ้าง, ผู้รับจ้าง, คู่สัญญา)
    ORGANIZATION = "org"        # องค์กร (บริษัท, หน่วยงานราชการ)
    CONTRACT = "contract"       # สัญญา
    PROJECT = "project"         # โครงการ
    MONEY = "money"             # มูลค่า/เงิน
    DATE = "date"               # วันที่สำคัญ
    TERM = "term"               # เงื่อนไขสัญญา
    CLAUSE = "clause"           # มาตราสัญญา
    SERVICE = "service"         # งาน/บริการ
    ASSET = "asset"             # ทรัพย์สิน
    LOCATION = "location"       # สถานที่
    DOCUMENT = "document"       # เอกสาร


class RelationType(str, Enum):
    """Types of relationships between entities"""
    # Person/Org relationships
    EMPLOYS = "employs"                     # จ้าง/ว่าจ้าง
    CONTRACTS_WITH = "contracts_with"       # ทำสัญญากับ
    REPRESENTS = "represents"               # เป็นตัวแทน
    WORKS_FOR = "works_for"                 # ทำงานให้
    
    # Contract relationships
    HAS_CONTRACTOR = "has_contractor"       # มีผู้รับจ้าง
    HAS_EMPLOYER = "has_employer"           # มีผู้ว่าจ้าง
    HAS_VALUE = "has_value"                 # มีมูลค่า
    HAS_START_DATE = "has_start_date"       # มีวันเริ่ม
    HAS_END_DATE = "has_end_date"           # มีวันสิ้นสุด
    HAS_TERM = "has_term"                   # มีเงื่อนไข
    CONTAINS_CLAUSE = "contains_clause"     # มีมาตรา
    REQUIRES_SERVICE = "requires_service"   # ต้องการงาน/บริการ
    
    # Document relationships
    MENTIONS = "mentions"                   # อ้างอิงถึง
    BASED_ON = "based_on"                   # อ้างอิงจาก
    AMENDS = "amends"                       # แก้ไข
    SUPERSEDES = "supersedes"               # ยกเลิก/แทนที่
    
    # Project relationships
    PART_OF = "part_of"                     # เป็นส่วนหนึ่งของ
    LOCATED_AT = "located_at"               # ตั้งอยู่ที่
    USES_ASSET = "uses_asset"               # ใช้ทรัพย์สิน


@dataclass
class GraphEntity:
    """Entity node in the graph"""
    id: str
    type: EntityType
    name: str
    properties: Dict[str, Any] = field(default_factory=dict)
    source_doc: Optional[str] = None  # Document ID where this entity was found
    confidence: float = 1.0
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type.value,
            "name": self.name,
            "properties": self.properties,
            "source_doc": self.source_doc,
            "confidence": self.confidence,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


@dataclass
class GraphRelationship:
    """Relationship edge in the graph"""
    id: str
    type: RelationType
    source_id: str      # Source entity ID
    target_id: str      # Target entity ID
    properties: Dict[str, Any] = field(default_factory=dict)
    source_doc: Optional[str] = None
    confidence: float = 1.0
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type.value,
            "source_id": self.source_id,
            "target_id": self.target_id,
            "properties": self.properties,
            "source_doc": self.source_doc,
            "confidence": self.confidence,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


@dataclass
class GraphDocument:
    """A document with its extracted graph data"""
    doc_id: str
    doc_type: str       # contract, document, template
    title: str
    entities: List[GraphEntity] = field(default_factory=list)
    relationships: List[GraphRelationship] = field(default_factory=list)
    extracted_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "doc_id": self.doc_id,
            "doc_type": self.doc_type,
            "title": self.title,
            "entities": [e.to_dict() for e in self.entities],
            "relationships": [r.to_dict() for r in self.relationships],
            "entity_count": len(self.entities),
            "relationship_count": len(self.relationships),
            "extracted_at": self.extracted_at.isoformat() if self.extracted_at else None
        }


@dataclass
class GraphQuery:
    """Query parameters for graph search"""
    entity_types: Optional[List[EntityType]] = None
    relation_types: Optional[List[RelationType]] = None
    entity_name: Optional[str] = None
    min_confidence: float = 0.5
    limit: int = 50
    
    
@dataclass
class GraphPath:
    """Path between two entities in the graph"""
    start_node: GraphEntity
    end_node: GraphEntity
    path_length: int
    relationships: List[GraphRelationship]
    path_score: float = 0.0
