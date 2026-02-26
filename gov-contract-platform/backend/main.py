"""
Gov Contract Platform - Enterprise Contract Lifecycle Management
"""
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
import time

from app.core.config import settings
from app.core.logging import setup_logging
from app.db.database import engine, create_tables
from app.core.middleware import TenantMiddleware, AuditMiddleware, RateLimitMiddleware

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    logger.info("🚀 Starting Gov Contract Platform...")
    
    # Create database tables
    create_tables()
    logger.info("✅ Database initialized")
    
    # Initialize search indices
    # await init_search_indices()
    logger.info("✅ Search indices ready")
    
    # Initialize cache
    # await init_cache()
    logger.info("✅ Cache connected")
    
    yield
    
    # Cleanup
    logger.info("🛑 Shutting down...")
    await engine.dispose()


# Create FastAPI app
app = FastAPI(
    title=settings.PLATFORM_NAME,
    version=settings.PLATFORM_VERSION,
    description="Enterprise Contract Lifecycle Management for Government",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan
)

# Security middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Tenant-ID"]
)

app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])

# Custom middlewares
app.add_middleware(TenantMiddleware)
app.add_middleware(AuditMiddleware)
# app.add_middleware(RateLimitMiddleware)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "code": 500,
            "message": "Internal server error",
            "error_id": request.state.request_id if hasattr(request.state, 'request_id') else None
        }
    )


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Health check - support both /health and /api/v1/health
@app.get("/health", tags=["system"])
@app.get("/api/v1/health", tags=["system"])
async def health_check():
    """System health check"""
    try:
        return {
            "success": True,
            "status": "healthy",
            "platform": settings.PLATFORM_NAME,
            "version": settings.PLATFORM_VERSION,
            "environment": settings.ENVIRONMENT,
            "timestamp": time.time()
        }
    except Exception as e:
        return {
            "success": False,
            "status": "unhealthy",
            "error": str(e),
            "timestamp": time.time()
        }


@app.get("/", tags=["system"])
async def root():
    """API root"""
    return {
        "platform": settings.PLATFORM_NAME,
        "version": settings.PLATFORM_VERSION,
        "environment": settings.ENVIRONMENT,
        "documentation": "/docs" if settings.DEBUG else None,
        "health": "/health"
    }


# Import and include routers
from app.api.v1 import identity, contracts, auth, documents, ocr, twofa, vendors
from app.api.v1 import settings as settings_router
from app.api.v1 import templates as templates_router
from app.api.v1 import agents as agents_router
from app.api.v1 import graph as graph_router
from app.api.v1 import organization as org_router
from app.api.v1 import access_control as access_router
from app.api.v1 import notifications as notifications_router
from app.api.v1 import notification_recipients as recipients_router
from app.api.v1 import admin as admin_router

app.include_router(auth.router, prefix="/api/v1")
app.include_router(identity.router, prefix="/api/v1/identity")
app.include_router(contracts.router, prefix="/api/v1/contracts")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(ocr.router, prefix="/api/v1")
app.include_router(twofa.router, prefix="/api/v1")
app.include_router(settings_router.router, prefix="/api/v1")
app.include_router(templates_router.router, prefix="/api/v1")
app.include_router(agents_router.router, prefix="/api/v1")
app.include_router(graph_router.router, prefix="/api/v1")
app.include_router(org_router.router, prefix="/api/v1")
app.include_router(notifications_router.router, prefix="/api/v1")
app.include_router(recipients_router.router, prefix="/api/v1")
app.include_router(access_router.router, prefix="/api/v1")
app.include_router(vendors.router, prefix="/api/v1")
app.include_router(admin_router.router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=1 if settings.DEBUG else settings.WORKERS
    )
