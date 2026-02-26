"""
Base Model with Multi-tenant Support
"""
from sqlalchemy import Column, DateTime, String, Integer, create_engine, event
from sqlalchemy.ext.declarative import declarative_base, declared_attr
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.sql import func
from typing import Optional
import uuid

Base = declarative_base()


class TenantMixin:
    """Mixin for tenant-aware models"""
    
    tenant_id = Column(String(50), nullable=True, index=True)
    
    @declared_attr
    def __tablename__(cls):
        return cls.__name__.lower()


class TimestampMixin:
    """Mixin for timestamp fields"""
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(50))
    updated_by = Column(String(50))


class SoftDeleteMixin:
    """Mixin for soft delete"""
    
    is_deleted = Column(Integer, default=0)
    deleted_at = Column(DateTime(timezone=True))
    deleted_by = Column(String(50))


class AuditMixin:
    """Mixin for audit trail"""
    
    ip_address = Column(String(50))
    user_agent = Column(String(500))


class BaseModel(TenantMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Base model with all common mixins"""
    
    __abstract__ = True
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))


# Database engine factory for multi-tenant
def get_engine(database_url: str):
    return create_engine(
        database_url,
        pool_pre_ping=True,
        pool_size=20,
        max_overflow=10,
        echo=False
    )


# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False)


def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class TenantSpecificSession:
    """Session manager for tenant-specific queries"""
    
    def __init__(self, session: Session, tenant_id: str):
        self.session = session
        self.tenant_id = tenant_id
    
    def query(self, model):
        """Query with automatic tenant filter"""
        return self.session.query(model).filter(
            model.tenant_id == self.tenant_id,
            model.is_deleted == 0
        )
    
    def add(self, obj):
        """Add object with tenant_id"""
        if hasattr(obj, 'tenant_id'):
            obj.tenant_id = self.tenant_id
        self.session.add(obj)
    
    def commit(self):
        self.session.commit()
    
    def rollback(self):
        self.session.rollback()
