"""AI Provider Model - Database table for AI providers"""
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base


class AIProvider(Base):
    """AI Provider configuration stored in database"""
    __tablename__ = "ai_providers"
    
    id = Column(String(50), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Display name
    name = Column(String(100), nullable=False)
    
    # Provider type: ollama, openai, gemini, anthropic, etc.
    provider_type = Column(String(50), nullable=False)
    
    # Model name
    model = Column(String(100), nullable=False)
    
    # Connection details
    api_url = Column(String(500), nullable=True)
    api_key = Column(String(500), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    
    # Capabilities: ["chat", "embedding", "vision"]
    capabilities = Column(JSONB, default=list)
    
    # Extra configuration
    config = Column(JSONB, default=dict)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="ai_providers")
    agents = relationship("AIAgent", back_populates="provider")
    
    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": self.id,
            "name": self.name,
            "type": self.provider_type,
            "model": self.model,
            "apiUrl": self.api_url,
            "apiKey": self.api_key,
            "isActive": self.is_active,
            "isDefault": self.is_default,
            "capabilities": self.capabilities or [],
            "config": self.config or {},
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
