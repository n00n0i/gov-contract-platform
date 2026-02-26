"""
Platform Configuration - Multi-tenant Enterprise Settings
"""
from pydantic_settings import BaseSettings
from typing import List, Dict, Optional
from functools import lru_cache


class Settings(BaseSettings):
    # Platform Info
    PLATFORM_NAME: str = "Gov Contract Platform"
    PLATFORM_VERSION: str = "2.0.0"
    ENVIRONMENT: str = "development"  # development, staging, production
    DEBUG: bool = True
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4
    
    # Security
    SECRET_KEY: str = "change-this-in-production-secret-key-here"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PASSWORD_MIN_LENGTH: int = 8
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_DURATION_MINUTES: int = 30
    
    # Database - Multi-tenant
    DATABASE_URL: str = "postgresql://govuser:govpass@localhost:5432/govplatform"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_TTL: int = 3600  # 1 hour
    
    # Elasticsearch
    ELASTICSEARCH_URL: str = "http://localhost:9200"
    ELASTICSEARCH_INDEX_PREFIX: str = "govplatform"
    
    # Storage
    STORAGE_TYPE: str = "minio"  # minio, s3, local
    STORAGE_BUCKET: str = "govplatform"
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_SECURE: bool = False
    
    # AI Services
    TYPHOON_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    EMBEDDING_MODEL: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    OLLAMA_URL: str = "http://ollama:11434"
    
    # OCR
    TESSERACT_CMD: str = "/usr/bin/tesseract"
    OCR_LANGUAGE: str = "tha+eng"
    
    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    
    # File Upload
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100 MB
    ALLOWED_EXTENSIONS: List[str] = [
        ".pdf", ".doc", ".docx", ".xls", ".xlsx",
        ".jpg", ".jpeg", ".png", ".tiff", ".tif"
    ]
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    CORS_ALLOW_CREDENTIALS: bool = True
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000
    
    # Audit
    AUDIT_LOG_RETENTION_DAYS: int = 2555  # 7 years
    
    # Notifications
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_TLS: bool = True
    
    # Line Notify
    LINE_NOTIFY_TOKEN: Optional[str] = None
    
    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100
    
    # Cache
    CACHE_TTL_SECONDS: int = 300  # 5 minutes
    
    # Feature Flags
    ENABLE_AI_FEATURES: bool = True
    ENABLE_OCR: bool = True
    ENABLE_NOTIFICATIONS: bool = True
    ENABLE_ANALYTICS: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()
