#!/usr/bin/env python3
"""Create database tables for AI providers, agents, and triggers"""
import sys
sys.path.insert(0, '/app')

from app.db.database import engine
from app.models.base import Base
from app.models.ai_provider import AIProvider
from app.models.ai_models import AIAgent, KnowledgeBase, AgentExecution, AgentWebhook
from app.models.trigger_models import AgentTrigger, TriggerExecution, TriggerTemplate

print('Creating AI tables...')
Base.metadata.create_all(bind=engine, tables=[
    AIProvider.__table__,
    AIAgent.__table__,
    KnowledgeBase.__table__,
    AgentExecution.__table__,
    AgentWebhook.__table__,
    AgentTrigger.__table__,
    TriggerExecution.__table__,
    TriggerTemplate.__table__,
])
print('Done!')
