"""
Custom Middleware - Tenant, Audit, and Rate Limiting
"""
import time
import uuid
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class TenantMiddleware(BaseHTTPMiddleware):
    """Extract and validate tenant from request"""
    
    async def dispatch(self, request: Request, call_next):
        # Extract tenant ID from header or subdomain
        tenant_id = request.headers.get("X-Tenant-ID", "default")
        
        # Validate tenant (in production, check against database)
        request.state.tenant_id = tenant_id
        
        response = await call_next(request)
        response.headers["X-Tenant-ID"] = tenant_id
        
        return response


class AuditMiddleware(BaseHTTPMiddleware):
    """Log all requests for audit trail"""
    
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        start_time = time.time()
        
        # Log request
        logger.info(
            "Request started",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "client_ip": request.client.host if request.client else None,
                "tenant_id": getattr(request.state, "tenant_id", "unknown"),
                "user_agent": request.headers.get("User-Agent"),
            }
        )
        
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            
            # Log response
            logger.info(
                "Request completed",
                extra={
                    "request_id": request_id,
                    "status_code": response.status_code,
                    "process_time": process_time,
                    "tenant_id": getattr(request.state, "tenant_id", "unknown"),
                }
            )
            
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = str(process_time)
            
            return response
            
        except Exception as exc:
            process_time = time.time() - start_time
            logger.error(
                "Request failed",
                extra={
                    "request_id": request_id,
                    "error": str(exc),
                    "process_time": process_time,
                    "tenant_id": getattr(request.state, "tenant_id", "unknown"),
                },
                exc_info=True
            )
            raise


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple rate limiting middleware using Redis"""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.rate_limit_minute = settings.RATE_LIMIT_PER_MINUTE
        self.rate_limit_hour = settings.RATE_LIMIT_PER_HOUR
    
    async def dispatch(self, request: Request, call_next):
        # Get client identifier
        client_id = request.headers.get("X-API-Key") or \
                    request.client.host if request.client else "unknown"
        
        # In production, use Redis to track rate limits
        # For now, just pass through
        
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(self.rate_limit_minute)
        response.headers["X-RateLimit-Remaining"] = "unknown"  # Calculate from Redis
        
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        
        return response
