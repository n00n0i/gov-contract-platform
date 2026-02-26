"""
Logging Configuration - Structured Logging with structlog
"""
import logging
import structlog
from pythonjsonlogger import jsonlogger
from app.core.config import settings


def setup_logging():
    """Configure structured logging for the application"""
    
    # Configure standard library logging
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    if settings.ENVIRONMENT == "production":
        # JSON logging for production
        formatter = jsonlogger.JsonFormatter(
            "%(asctime)s %(name)s %(levelname)s %(message)s %(pathname)s %(lineno)d"
        )
    else:
        # Colored console logging for development
        formatter = logging.Formatter(log_format)
    
    # Setup root handler
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.handlers = []
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)
    
    # Configure structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer() if settings.ENVIRONMENT == "production" 
            else structlog.dev.ConsoleRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    # Set third-party log levels
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("celery").setLevel(logging.INFO)
    logging.getLogger("elasticsearch").setLevel(logging.WARNING)


def get_logger(name: str):
    """Get a structured logger instance"""
    return structlog.get_logger(name)
