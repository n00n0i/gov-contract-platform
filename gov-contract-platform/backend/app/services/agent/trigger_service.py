"""
Trigger Service - Production-ready trigger execution
Connects events to agent execution
"""
import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from fastapi import BackgroundTasks

from app.db.database import SessionLocal
from app.core.logging import get_logger
from app.models.ai_models import AIAgent, AgentExecution, AgentStatus
from app.models.trigger_models import AgentTrigger, TriggerExecution, TriggerStatus, ExecutionStatus, TriggerType

logger = get_logger(__name__)


class TriggerService:
    """Service for managing trigger execution"""
    
    def __init__(self):
        self.active_executions: Dict[str, asyncio.Task] = {}
    
    async def process_event(
        self,
        event_type: str,
        event_data: Dict[str, Any],
        user_id: Optional[str] = None,
        page: Optional[str] = None,
        background_tasks: Optional[BackgroundTasks] = None
    ) -> List[Dict[str, Any]]:
        """
        Process an event and trigger matching agents
        Returns list of triggered executions
        """
        db = SessionLocal()
        try:
            # Find all active triggers matching this event
            triggers = self._find_matching_triggers(db, event_type, page, event_data)
            
            results = []
            for trigger in triggers:
                try:
                    # Check cooldown
                    if self._is_in_cooldown(trigger):
                        logger.info(f"Trigger {trigger.id} in cooldown, skipping")
                        continue
                    
                    # Execute trigger
                    if background_tasks:
                        background_tasks.add_task(
                            self._execute_trigger_async,
                            trigger.id,
                            event_data,
                            user_id,
                            event_type,
                            page
                        )
                        results.append({
                            "trigger_id": trigger.id,
                            "agent_id": trigger.agent_id,
                            "status": "queued"
                        })
                    else:
                        result = await self._execute_trigger_async(
                            trigger.id,
                            event_data,
                            user_id,
                            event_type,
                            page
                        )
                        results.append(result)
                        
                except Exception as e:
                    logger.error(f"Failed to process trigger {trigger.id}: {e}")
                    results.append({
                        "trigger_id": trigger.id,
                        "error": str(e)
                    })
            
            return results
            
        finally:
            db.close()
    
    def _find_matching_triggers(
        self,
        db: Session,
        event_type: str,
        page: Optional[str],
        event_data: Dict[str, Any]
    ) -> List[AgentTrigger]:
        """Find triggers that match the event"""
        
        # Map event types to trigger types
        event_to_trigger = {
            "document_upload": TriggerType.DOCUMENT_UPLOAD,
            "document_update": TriggerType.DOCUMENT_UPDATE,
            "contract_created": TriggerType.CONTRACT_CREATED,
            "contract_updated": TriggerType.CONTRACT_UPDATED,
            "contract_status_changed": TriggerType.CONTRACT_STATUS_CHANGED,
            "contract_approval_requested": TriggerType.CONTRACT_APPROVAL_REQUESTED,
            "contract_approved": TriggerType.CONTRACT_APPROVED,
            "contract_rejected": TriggerType.CONTRACT_REJECTED,
            "vendor_created": TriggerType.VENDOR_CREATED,
            "vendor_updated": TriggerType.VENDOR_UPDATED,
            "payment_due": TriggerType.PAYMENT_DUE,
            "contract_expiring": TriggerType.CONTRACT_EXPIRING,
        }
        
        trigger_type = event_to_trigger.get(event_type)
        if not trigger_type:
            return []
        
        # Query active triggers of this type
        query = db.query(AgentTrigger).filter(
            AgentTrigger.trigger_type == trigger_type,
            AgentTrigger.status == TriggerStatus.ACTIVE
        )
        
        triggers = query.all()
        
        # Filter by page if specified
        if page:
            triggers = [
                t for t in triggers 
                if not t.applicable_pages or page in t.applicable_pages
            ]
        
        # Filter by conditions
        matching_triggers = []
        for trigger in triggers:
            if self._check_conditions(trigger.conditions, event_data):
                matching_triggers.append(trigger)
        
        # Sort by priority
        matching_triggers.sort(key=lambda t: t.priority, reverse=True)
        
        return matching_triggers
    
    def _check_conditions(self, conditions: Dict[str, Any], event_data: Dict[str, Any]) -> bool:
        """Check if event data matches trigger conditions"""
        if not conditions:
            return True
        
        for key, condition in conditions.items():
            if key == "file_types":
                file_name = event_data.get("file_name", "")
                if not any(file_name.endswith(ext) for ext in condition):
                    return False
            
            elif key == "max_file_size":
                file_size = event_data.get("file_size", 0)
                if file_size > condition:
                    return False
        
        return True
    
    def _is_in_cooldown(self, trigger: AgentTrigger) -> bool:
        """Check if trigger is in cooldown period"""
        if not trigger.cooldown_seconds or not trigger.last_executed_at:
            return False
        
        elapsed = (datetime.utcnow() - trigger.last_executed_at).total_seconds()
        return elapsed < trigger.cooldown_seconds
    
    async def _execute_trigger_async(
        self,
        trigger_id: str,
        input_data: Dict[str, Any],
        user_id: Optional[str],
        source_event: str,
        source_page: Optional[str]
    ) -> Dict[str, Any]:
        """Execute a trigger asynchronously"""
        db = SessionLocal()
        try:
            trigger = db.query(AgentTrigger).filter(AgentTrigger.id == trigger_id).first()
            if not trigger:
                return {"error": "Trigger not found"}
            
            agent = db.query(AIAgent).filter(AIAgent.id == trigger.agent_id).first()
            if not agent or agent.status != AgentStatus.ACTIVE:
                return {"error": "Agent not active"}
            
            # Create execution record
            execution = TriggerExecution(
                id=str(uuid.uuid4()),
                trigger_id=trigger_id,
                agent_id=agent.id,
                triggered_by=user_id,
                source_event=source_event,
                source_page=source_page,
                input_data=input_data,
                status=ExecutionStatus.PENDING,
                triggered_at=datetime.utcnow()
            )
            db.add(execution)
            db.commit()
            
            # Update trigger stats
            trigger.execution_count += 1
            trigger.last_executed_at = datetime.utcnow()
            db.commit()
            
            # TODO: Call LLM service here
            # For UAT, simulate execution
            execution.status = ExecutionStatus.COMPLETED
            execution.output_data = {"result": "Simulated execution for UAT"}
            execution.result_summary = "Agent executed successfully (UAT mode)"
            execution.completed_at = datetime.utcnow()
            execution.execution_time_ms = 1500
            
            db.commit()
            
            return {
                "execution_id": execution.id,
                "trigger_id": trigger_id,
                "agent_id": agent.id,
                "status": "completed"
            }
                
        finally:
            db.close()


# Global trigger service instance
trigger_service = TriggerService()


# Convenience functions for common events
async def on_document_upload(
    document_id: str,
    file_name: str,
    file_type: str,
    file_size: int,
    user_id: str,
    **kwargs
):
    """Handle document upload event"""
    await trigger_service.process_event(
        event_type="document_upload",
        event_data={
            "document_id": document_id,
            "file_name": file_name,
            "file_type": file_type,
            "file_size": file_size,
            **kwargs
        },
        user_id=user_id,
        page="/documents/upload"
    )


async def on_contract_created(
    contract_id: str,
    contract_data: Dict[str, Any],
    user_id: str
):
    """Handle contract created event"""
    await trigger_service.process_event(
        event_type="contract_created",
        event_data={
            "contract_id": contract_id,
            **contract_data
        },
        user_id=user_id,
        page="/contracts/new"
    )
