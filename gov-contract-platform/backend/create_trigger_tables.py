#!/usr/bin/env python3
"""Create trigger tables"""
import sys
sys.path.insert(0, '/app')

from app.db.database import engine
from app.models.base import Base
from app.models.trigger_models import (
    AgentTrigger, TriggerExecution, TriggerQueue, TriggerTemplate
)

print('Creating trigger tables...')
Base.metadata.create_all(bind=engine, tables=[
    AgentTrigger.__table__,
    TriggerExecution.__table__,
    TriggerQueue.__table__,
    TriggerTemplate.__table__
])
print('Done!')
