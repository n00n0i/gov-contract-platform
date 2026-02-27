"""
Database Configuration - SQLAlchemy with Multi-tenant Support
"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from contextlib import contextmanager
import logging

from app.core.config import settings
from app.models.base import Base

logger = logging.getLogger(__name__)

# Create engine with connection pooling
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_pre_ping=True,      # Verify connections before using (prevents stale connections)
    pool_recycle=604800,     # Recycle connections after 7 days (same as JWT token)
    pool_timeout=60,         # Wait up to 60 seconds for available connection
    echo=settings.DEBUG      # Log SQL queries in debug mode
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """Set connection parameters on connect"""
    # Enable foreign key constraints for SQLite (if used in testing)
    if "sqlite" in settings.DATABASE_URL:
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


@event.listens_for(engine, "checkout")
def ping_connection(dbapi_connection, connection_record, connection_proxy):
    """Verify connection is alive on checkout"""
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("SELECT 1")
    except:
        raise Exception("Connection is invalid")
    finally:
        cursor.close()


def get_db() -> Session:
    """Get database session - for dependency injection"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context():
    """Get database session as context manager"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all database tables"""
    try:
        # Import all models to ensure they're registered
        from app.models import base, identity, contract, vendor, notification_models
        
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        raise


def drop_tables():
    """Drop all database tables - use with caution!"""
    Base.metadata.drop_all(bind=engine)
    logger.warning("All database tables dropped")


def get_tenant_db(tenant_id: str):
    """Get database session with tenant context"""
    db = SessionLocal()
    # Set tenant context for row-level security
    db.execute(f"SET app.current_tenant = '{tenant_id}'")
    try:
        yield db
    finally:
        db.close()
