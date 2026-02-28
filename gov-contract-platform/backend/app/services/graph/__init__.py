"""
Graph Services Package

Provides dual-domain GraphRAG:
- ContractsGraphService: For contract documents with security controls
- KBGraphService: For Knowledge Base (agent-only access)
"""

from app.services.graph.base_graph_service import BaseGraphService
from app.services.graph.contracts_graph_service import (
    ContractsGraphService,
    get_contracts_graph_service,
    can_access_security_level,
    SECURITY_LEVELS_ORDER
)
from app.services.graph.kb_graph_service import (
    KBGraphService,
    get_kb_graph_service
)
from app.models.graph_models import (
    GraphDomain,
    SecurityLevel,
    EntityType,
    RelationType,
    GraphEntity,
    GraphRelationship,
    GraphDocument,
    GraphQuery,
    GraphPath
)

__all__ = [
    # Services
    'BaseGraphService',
    'ContractsGraphService',
    'KBGraphService',
    'get_contracts_graph_service',
    'get_kb_graph_service',
    # Security
    'can_access_security_level',
    'SECURITY_LEVELS_ORDER',
    # Models
    'GraphDomain',
    'SecurityLevel',
    'EntityType',
    'RelationType',
    'GraphEntity',
    'GraphRelationship',
    'GraphDocument',
    'GraphQuery',
    'GraphPath',
]
