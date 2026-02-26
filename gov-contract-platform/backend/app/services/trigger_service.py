"""
Trigger Service - ระบบประมวลผล Trigger สำหรับ AI Agents
"""
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Callable
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from celery import Celery

from app.core.logging import get_logger
from app.db.database import SessionLocal
from app.models.trigger_models import (
    AgentTrigger, TriggerExecution, TriggerQueue, TriggerExecutionStatus,
    TriggerStatus, TriggerType
)
from app.models.ai_models import AIAgent
from app.services.ai.llm_service import LLMService

logger = get_logger(__name__)

# Celery app for async processing
celery_app = Celery('triggers')


class TriggerService:
    """บริการจัดการและประมวลผล Triggers"""
    
    def __init__(self, db: Session):
        self.db = db
        self.llm_service = LLMService()
    
    # ============== Trigger Registration & Management ==============
    
    def register_trigger(self, agent_id: str, config: Dict[str, Any]) -> AgentTrigger:
        """ลงทะเบียน Trigger ใหม่"""
        trigger = AgentTrigger(
            id=str(uuid.uuid4()),
            agent_id=agent_id,
            trigger_type=TriggerType(config['trigger_type']),
            name=config['name'],
            description=config.get('description'),
            conditions=config.get('conditions', {}),
            schedule_config=config.get('schedule_config', {}),
            periodic_config=config.get('periodic_config', {}),
            applicable_pages=config.get('applicable_pages', []),
            button_config=config.get('button_config', {}),
            priority=config.get('priority', 0),
            max_executions_per_day=config.get('max_executions_per_day', 1000),
            cooldown_seconds=config.get('cooldown_seconds', 0),
            notification_config=config.get('notification_config', {}),
            status=TriggerStatus.ACTIVE
        )
        
        self.db.add(trigger)
        self.db.commit()
        
        logger.info(f"Registered trigger {trigger.id} for agent {agent_id}")
        
        # Schedule if needed
        if trigger.trigger_type in [TriggerType.SCHEDULED, TriggerType.PERIODIC]:
            self._schedule_trigger(trigger)
        
        return trigger
    
    def _schedule_trigger(self, trigger: AgentTrigger):
        """Schedule trigger with Celery"""
        if trigger.trigger_type == TriggerType.SCHEDULED and trigger.schedule_config:
            cron = trigger.schedule_config.get('cron')
            if cron:
                # Parse cron and schedule
                celery_app.conf.beat_schedule = {
                    f'trigger-{trigger.id}': {
                        'task': 'app.tasks.trigger_tasks.execute_scheduled_trigger',
                        'schedule': celery.schedules.crontab(**self._parse_cron(cron)),
                        'args': (trigger.id,)
                    }
                }
        
        elif trigger.trigger_type == TriggerType.PERIODIC and trigger.periodic_config:
            interval = trigger.periodic_config.get('interval', 3600)
            celery_app.conf.beat_schedule = {
                f'trigger-{trigger.id}': {
                    'task': 'app.tasks.trigger_tasks.execute_scheduled_trigger',
                    'schedule': celery.schedules.schedule(run_every=timedelta(seconds=interval)),
                    'args': (trigger.id,)
                }
            }
    
    def _parse_cron(self, cron: str) -> Dict[str, Any]:
        """Parse cron string to Celery crontab args"""
        parts = cron.split()
        return {
            'minute': parts[0],
            'hour': parts[1],
            'day_of_week': parts[4] if len(parts) > 4 else '*',
        }
    
    # ============== Event Processing ==============
    
    def process_event(self, event_type: TriggerType, event_data: Dict[str, Any], 
                     source_resource_id: str = None, source_resource_type: str = None):
        """ประมวลผล Event และหา Triggers ที่ตรงเงื่อนไข"""
        
        # หา triggers ที่ตรงกับ event type
        triggers = self.db.query(AgentTrigger).filter(
            AgentTrigger.trigger_type == event_type,
            AgentTrigger.status == TriggerStatus.ACTIVE
        ).all()
        
        matching_triggers = []
        
        for trigger in triggers:
            # ตรวจสอบเงื่อนไข
            if self._check_conditions(trigger.conditions, event_data):
                matching_triggers.append(trigger)
        
        # Queue executions
        for trigger in matching_triggers:
            self._queue_trigger_execution(
                trigger=trigger,
                event_data=event_data,
                source_resource_id=source_resource_id,
                source_resource_type=source_resource_type
            )
        
        return len(matching_triggers)
    
    def _check_conditions(self, conditions: Dict[str, Any], event_data: Dict[str, Any]) -> bool:
        """ตรวจสอบว่า event data ตรงกับ conditions หรือไม่"""
        if not conditions:
            return True
        
        for key, expected_value in conditions.items():
            actual_value = event_data.get(key)
            
            if isinstance(expected_value, dict):
                # Range conditions
                if 'min' in expected_value and actual_value < expected_value['min']:
                    return False
                if 'max' in expected_value and actual_value > expected_value['max']:
                    return False
                if 'in' in expected_value and actual_value not in expected_value['in']:
                    return False
            elif isinstance(expected_value, list):
                # List membership
                if actual_value not in expected_value:
                    return False
            else:
                # Exact match
                if actual_value != expected_value:
                    return False
        
        return True
    
    def _queue_trigger_execution(self, trigger: AgentTrigger, event_data: Dict[str, Any],
                                  source_resource_id: str = None, source_resource_type: str = None):
        """เพิ่ม trigger execution เข้าคิว"""
        
        # ตรวจสอบ cooldown
        if trigger.cooldown_seconds > 0 and trigger.last_triggered_at:
            elapsed = (datetime.utcnow() - trigger.last_triggered_at).total_seconds()
            if elapsed < trigger.cooldown_seconds:
                logger.info(f"Trigger {trigger.id} in cooldown, skipping")
                return
        
        # ตรวจสอบ daily limit
        today_count = self.db.query(TriggerExecution).filter(
            TriggerExecution.trigger_id == trigger.id,
            TriggerExecution.created_at >= datetime.utcnow().date()
        ).count()
        
        if today_count >= trigger.max_executions_per_day:
            logger.warning(f"Trigger {trigger.id} reached daily limit")
            return
        
        # Create execution record
        execution = TriggerExecution(
            id=str(uuid.uuid4()),
            trigger_id=trigger.id,
            agent_id=trigger.agent_id,
            status=TriggerExecutionStatus.PENDING,
            source_event=trigger.trigger_type.value,
            source_resource_id=source_resource_id,
            source_resource_type=source_resource_type,
            input_data=event_data,
            context_data=self._build_context_data(event_data)
        )
        
        self.db.add(execution)
        
        # Update trigger stats
        trigger.trigger_count += 1
        trigger.last_triggered_at = datetime.utcnow()
        
        self.db.commit()
        
        # Queue for async processing
        execute_trigger_task.delay(execution.id)
        
        logger.info(f"Queued execution {execution.id} for trigger {trigger.id}")
    
    def _build_context_data(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """สร้าง context data สำหรับ Agent"""
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "triggered_at": datetime.utcnow().isoformat(),
            "session_id": event_data.get('session_id'),
            "user_agent": event_data.get('user_agent'),
            "ip_address": event_data.get('ip_address'),
        }
    
    # ============== Manual Trigger ==============
    
    def manual_trigger(self, trigger_id: str, user_id: str, 
                      input_data: Dict[str, Any] = None) -> TriggerExecution:
        """เรียกใช้ Trigger ด้วยตนเอง"""
        trigger = self.db.query(AgentTrigger).filter(
            AgentTrigger.id == trigger_id,
            AgentTrigger.status == TriggerStatus.ACTIVE
        ).first()
        
        if not trigger:
            raise ValueError("Trigger not found or inactive")
        
        if trigger.trigger_type != TriggerType.MANUAL and trigger.trigger_type != TriggerType.BUTTON_CLICK:
            raise ValueError("This trigger is not manual")
        
        execution = TriggerExecution(
            id=str(uuid.uuid4()),
            trigger_id=trigger.id,
            agent_id=trigger.agent_id,
            status=TriggerExecutionStatus.PENDING,
            triggered_by=user_id,
            source_event=trigger.trigger_type.value,
            input_data=input_data or {},
            context_data=self._build_context_data(input_data or {})
        )
        
        self.db.add(execution)
        trigger.trigger_count += 1
        trigger.last_triggered_at = datetime.utcnow()
        self.db.commit()
        
        # Execute immediately for manual triggers
        execute_trigger_task.delay(execution.id)
        
        return execution
    
    def get_available_manual_triggers(self, page: str, user_id: str) -> List[Dict[str, Any]]:
        """ดึงรายการ manual triggers ที่ใช้ได้ในหน้านั้น"""
        triggers = self.db.query(AgentTrigger).filter(
            AgentTrigger.trigger_type == TriggerType.BUTTON_CLICK,
            AgentTrigger.status == TriggerStatus.ACTIVE,
            AgentTrigger.applicable_pages.contains([page])
        ).all()
        
        return [{
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "button_config": t.button_config,
            "agent_id": t.agent_id
        } for t in triggers]


# ============== Celery Tasks ==============

@celery_app.task
def execute_trigger_task(execution_id: str):
    """ประมวลผล Trigger แบบ async"""
    db = SessionLocal()
    try:
        service = TriggerService(db)
        service._execute_trigger(execution_id)
    finally:
        db.close()


@celery_app.task
def execute_scheduled_trigger(trigger_id: str):
    """ประมวลผล Scheduled Trigger"""
    db = SessionLocal()
    try:
        trigger = db.query(AgentTrigger).filter(AgentTrigger.id == trigger_id).first()
        if trigger and trigger.status == TriggerStatus.ACTIVE:
            service = TriggerService(db)
            service._queue_trigger_execution(
                trigger=trigger,
                event_data={"scheduled": True, "trigger_time": datetime.utcnow().isoformat()}
            )
    finally:
        db.close()


# ============== Trigger Execution Implementation ==============

def execute_trigger(self, execution_id: str):
    """ประมวลผล Trigger Execution (เรียกจาก celery task)"""
    execution = self.db.query(TriggerExecution).filter(
        TriggerExecution.id == execution_id
    ).first()
    
    if not execution:
        logger.error(f"Execution {execution_id} not found")
        return
    
    # Update status
    execution.status = TriggerExecutionStatus.RUNNING
    execution.started_at = datetime.utcnow()
    self.db.commit()
    
    try:
        # Get agent
        agent = self.db.query(AIAgent).filter(AIAgent.id == execution.agent_id).first()
        if not agent:
            raise ValueError(f"Agent {execution.agent_id} not found")
        
        # Prepare input for LLM
        prompt = self._build_agent_prompt(agent, execution.input_data, execution.context_data)
        
        # Call LLM
        start_time = datetime.utcnow()
        response = self.llm_service.generate(
            prompt=prompt,
            system_prompt=agent.system_prompt,
            model=agent.provider_id,
            temperature=agent.model_config.get('temperature', 0.7),
            max_tokens=agent.model_config.get('max_tokens', 2000)
        )
        execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        # Parse output
        output_data = self._parse_agent_output(response, agent.output_format)
        
        # Update execution
        execution.status = TriggerExecutionStatus.COMPLETED
        execution.completed_at = datetime.utcnow()
        execution.execution_time_ms = int(execution_time)
        execution.output_data = output_data
        execution.output_action = agent.output_action
        execution.output_target = agent.output_target
        
        # Execute output action
        self._execute_output_action(agent, output_data, execution)
        
        self.db.commit()
        
        logger.info(f"Execution {execution_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Execution {execution_id} failed: {e}")
        execution.status = TriggerExecutionStatus.FAILED
        execution.error_message = str(e)
        execution.retry_count += 1
        self.db.commit()
        
        # Retry if needed
        if execution.retry_count < 3:
            retry_execution_task.apply_async(args=[execution_id], countdown=60)


def _build_agent_prompt(self, agent: AIAgent, input_data: Dict, context_data: Dict) -> str:
    """สร้าง prompt สำหรับ Agent"""
    prompt_parts = []
    
    # Add context
    if context_data:
        prompt_parts.append(f"Context: {json.dumps(context_data, ensure_ascii=False)}")
    
    # Add input data
    if input_data:
        prompt_parts.append(f"Input: {json.dumps(input_data, ensure_ascii=False)}")
    
    # Add specific instructions based on trigger type
    if agent.trigger_events:
        prompt_parts.append(f"Trigger Events: {', '.join(agent.trigger_events)}")
    
    return "\n\n".join(prompt_parts)


def _parse_agent_output(self, response: str, output_format: str) -> Dict[str, Any]:
    """แปลง output จาก Agent"""
    if output_format == "json":
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {"text": response, "parsed": False}
    elif output_format == "markdown":
        return {"markdown": response}
    else:
        return {"text": response}


def _execute_output_action(self, agent: AIAgent, output_data: Dict, execution: TriggerExecution):
    """Execute the output action"""
    action = agent.output_action
    
    if action == "show_popup":
        # Send to WebSocket or notification system
        pass
    elif action == "save_to_field":
        # Save to database field
        pass
    elif action == "create_task":
        # Create task for user
        pass
    elif action == "send_email":
        # Send email notification
        pass
    elif action == "webhook":
        # Call webhook
        pass


@celery_app.task
def retry_execution_task(execution_id: str):
    """Retry failed execution"""
    db = SessionLocal()
    try:
        service = TriggerService(db)
        service._execute_trigger(execution_id)
    finally:
        db.close()


# Add methods to TriggerService
TriggerService._execute_trigger = execute_trigger
TriggerService._build_agent_prompt = _build_agent_prompt
TriggerService._parse_agent_output = _parse_agent_output
TriggerService._execute_output_action = _execute_output_action
