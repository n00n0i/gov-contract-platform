"""
Celery Tasks - Background Task Queue
"""
from celery import Celery
from app.core.config import settings

# Create Celery app
celery_app = Celery(
    "gov_contract_platform",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.document",
        "app.tasks.notification",
        "app.tasks.contract",
        "app.tasks.report",
    ]
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Bangkok",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max runtime
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
)

# Beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    "check-contract-expiry": {
        "task": "app.tasks.contract.check_expiring_contracts",
        "schedule": 86400.0,  # Daily
    },
    "cleanup-old-logs": {
        "task": "app.tasks.report.cleanup_old_logs",
        "schedule": 604800.0,  # Weekly
    },
}
