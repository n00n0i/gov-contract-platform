#!/usr/bin/env python3
"""
Migration: Add trigger tables for comprehensive agent trigger system
"""
import sys
sys.path.insert(0, '/app')

from sqlalchemy import create_engine, text
from app.core.config import settings

def migrate():
    """Create trigger tables"""
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if tables exist
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'agent_triggers'
            )
        """))
        
        if result.scalar():
            print("Trigger tables already exist, skipping migration")
            return
        
        # Create agent_triggers table
        print("Creating agent_triggers table...")
        conn.execute(text("""
            CREATE TABLE agent_triggers (
                id VARCHAR(36) PRIMARY KEY,
                agent_id VARCHAR(36) NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                trigger_type VARCHAR(50) NOT NULL,
                status VARCHAR(20) DEFAULT 'active',
                priority INTEGER DEFAULT 0,
                conditions JSONB DEFAULT '{}',
                schedule_config JSONB DEFAULT '{}',
                periodic_config JSONB DEFAULT '{}',
                applicable_pages JSONB DEFAULT '[]',
                button_config JSONB DEFAULT '{}',
                max_executions_per_day INTEGER DEFAULT 1000,
                cooldown_seconds INTEGER DEFAULT 0,
                notification_config JSONB DEFAULT '{}',
                execution_count INTEGER DEFAULT 0,
                last_executed_at TIMESTAMP WITH TIME ZONE,
                last_error TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                created_by VARCHAR(36) REFERENCES users(id)
            )
        """))
        
        # Create indexes
        conn.execute(text("""
            CREATE INDEX idx_agent_triggers_agent_id ON agent_triggers(agent_id);
            CREATE INDEX idx_agent_triggers_type ON agent_triggers(trigger_type);
            CREATE INDEX idx_agent_triggers_status ON agent_triggers(status);
        """))
        
        # Create trigger_executions table
        print("Creating trigger_executions table...")
        conn.execute(text("""
            CREATE TABLE trigger_executions (
                id VARCHAR(36) PRIMARY KEY,
                trigger_id VARCHAR(36) REFERENCES agent_triggers(id) ON DELETE SET NULL,
                agent_id VARCHAR(36) NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'pending',
                triggered_by VARCHAR(36) REFERENCES users(id),
                source_event VARCHAR(100),
                source_page VARCHAR(100),
                input_data JSONB DEFAULT '{}',
                output_data JSONB DEFAULT '{}',
                context_data JSONB DEFAULT '{}',
                started_at TIMESTAMP WITH TIME ZONE,
                completed_at TIMESTAMP WITH TIME ZONE,
                execution_time_ms FLOAT,
                result_summary TEXT,
                error_message TEXT,
                error_details JSONB DEFAULT '{}',
                triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))
        
        # Create indexes
        conn.execute(text("""
            CREATE INDEX idx_trigger_executions_trigger_id ON trigger_executions(trigger_id);
            CREATE INDEX idx_trigger_executions_agent_id ON trigger_executions(agent_id);
            CREATE INDEX idx_trigger_executions_status ON trigger_executions(status);
            CREATE INDEX idx_trigger_executions_triggered_at ON trigger_executions(triggered_at);
        """))
        
        # Create trigger_templates table
        print("Creating trigger_templates table...")
        conn.execute(text("""
            CREATE TABLE trigger_templates (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                category VARCHAR(50),
                trigger_type VARCHAR(50) NOT NULL,
                default_conditions JSONB DEFAULT '{}',
                default_schedule_config JSONB DEFAULT '{}',
                default_periodic_config JSONB DEFAULT '{}',
                default_button_config JSONB DEFAULT '{}',
                applicable_pages JSONB DEFAULT '[]',
                is_system BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))
        
        conn.execute(text("""
            CREATE INDEX idx_trigger_templates_category ON trigger_templates(category);
            CREATE INDEX idx_trigger_templates_type ON trigger_templates(trigger_type);
        """))
        
        # Insert system templates
        print("Inserting system trigger templates...")
        templates = [
            ('tpl-doc-upload', 'วิเคราะห์เอกสารอัตโนมัติ', 'วิเคราะห์เอกสารทันทีเมื่อมีการอัพโหลด', 
             'document', 'document_upload', 
             '{"file_types": [".pdf", ".doc", ".docx"], "min_file_size": 1024, "max_file_size": 52428800}',
             '["/documents"]', True),
            ('tpl-contract-create', 'ตรวจสอบสัญญาใหม่', 'ตรวจสอบความถูกต้องของสัญญาเมื่อสร้างใหม่',
             'contract', 'contract_created',
             '{"check_compliance": true, "check_risk": true, "check_template": true}',
             '["/contracts/new"]', True),
            ('tpl-contract-approve', 'วิเคราะห์ก่อนอนุมัติ', 'วิเคราะห์ความเสี่ยงและความสอดคล้องก่อนอนุมัติ',
             'contract', 'contract_approval_requested',
             '{"check_risk": true, "check_budget": true, "check_vendor": true}',
             '["/contracts/:id/approve"]', True),
            ('tpl-contract-expiry', 'แจ้งเตือนสัญญาใกล้หมดอายุ', 'ตรวจสอบและแจ้งเตือนสัญญาที่ใกล้หมดอายุ',
             'contract', 'contract_expiring',
             '{"days_before_expiry": 30}', '[]', True),
            ('tpl-vendor-create', 'ตรวจสอบผู้รับจ้างใหม่', 'ตรวจสอบข้อมูลและประวัติผู้รับจ้างใหม่',
             'vendor', 'vendor_created',
             '{"check_blacklist": true, "check_duplicates": true, "verify_documents": true}',
             '["/vendors/new"]', True),
            ('tpl-payment-due', 'แจ้งเตือนการจ่ายเงิน', 'แจ้งเตือนกำหนดการจ่ายเงินใกล้ถึง',
             'system', 'payment_due',
             '{"days_before_due": 7}', '[]', True),
            ('tpl-periodic-report', 'สรุปรายงานประจำสัปดาห์', 'สร้างสรุปรายงานสัญญาประจำสัปดาห์',
             'system', 'scheduled',
             '{}', '[]', True),
        ]
        
        for tid, name, desc, cat, ttype, cond, pages, is_sys in templates:
            conn.execute(text("""
                INSERT INTO trigger_templates 
                (id, name, description, category, trigger_type, default_conditions, applicable_pages, is_system)
                VALUES (:id, :name, :desc, :cat, :ttype, :cond, :pages, :is_sys)
                ON CONFLICT (id) DO NOTHING
            """), {
                'id': tid, 'name': name, 'desc': desc, 'cat': cat, 
                'ttype': ttype, 'cond': cond, 'pages': pages, 'is_sys': is_sys
            })
        
        conn.commit()
        print("Migration completed successfully!")

if __name__ == "__main__":
    migrate()
