#!/usr/bin/env python3
"""
Migration: Add missing columns to ai_agents table
"""
import sys
sys.path.insert(0, '/app')

from sqlalchemy import create_engine, text
from app.core.config import settings

def migrate():
    """Add missing columns to ai_agents"""
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if provider_id column exists
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'ai_agents' AND column_name = 'provider_id'
            )
        """))
        
        if not result.scalar():
            print("Adding provider_id column to ai_agents...")
            conn.execute(text("""
                ALTER TABLE ai_agents 
                ADD COLUMN provider_id VARCHAR(50) REFERENCES ai_providers(id)
            """))
        else:
            print("provider_id column already exists")
        
        # Check if enabled_presets column exists
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'ai_agents' AND column_name = 'enabled_presets'
            )
        """))
        
        if not result.scalar():
            print("Adding enabled_presets column to ai_agents...")
            conn.execute(text("""
                ALTER TABLE ai_agents 
                ADD COLUMN enabled_presets VARCHAR(255)[] DEFAULT '{}'
            """))
        else:
            print("enabled_presets column already exists")
        
        conn.commit()
        print("Migration completed!")

if __name__ == "__main__":
    migrate()
