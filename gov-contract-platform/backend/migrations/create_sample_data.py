#!/usr/bin/env python3
"""
Create sample data for UAT
"""
import sys
sys.path.insert(0, '/app')

from datetime import date, datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.contract import Contract, ContractStatus, ContractType, ClassificationLevel
from app.models.vendor import Vendor, VendorStatus, VendorType
from app.models.organization import OrganizationUnit, OrgLevel, Position
from app.models.ai_models import AIAgent, AgentStatus

# Database connection
engine = create_engine(settings.DATABASE_URL)
Session = sessionmaker(bind=engine)

def create_sample_vendors(session):
    """Create sample vendors"""
    vendors_data = [
        {
            "name": "บริษัท ก่อสร้างดี จำกัด",
            "name_en": "Construction Dee Co., Ltd.",
            "tax_id": "1234567890123",
            "vendor_type": VendorType.COMPANY,
            "email": "contact@constructiondee.co.th",
            "phone": "02-123-4567",
            "address": "123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110",
            "province": "กรุงเทพมหานคร",
            "contact_name": "คุณสมชาย ใจดี",
            "contact_email": "somchai@constructiondee.co.th",
            "contact_phone": "081-234-5678",
        },
        {
            "name": "สำนักงานกฎหมาย ABC",
            "name_en": "ABC Law Office",
            "tax_id": "9876543210987",
            "vendor_type": VendorType.PARTNERSHIP,
            "email": "info@abclaw.co.th",
            "phone": "02-987-6543",
            "address": "456 ถนนสีลม แขวงสีลม เขตบางรัก กรุงเทพฯ 10500",
            "province": "กรุงเทพมหานคร",
            "contact_name": "ทนายสุดา แก้วใส",
            "contact_email": "suda@abclaw.co.th",
            "contact_phone": "089-876-5432",
        },
        {
            "name": "บริษัท IT Solution จำกัด",
            "name_en": "IT Solution Co., Ltd.",
            "tax_id": "5678901234567",
            "vendor_type": VendorType.COMPANY,
            "email": "sales@itsolution.co.th",
            "phone": "02-555-8888",
            "address": "789 ถนนรัชดาภิเษก แขวงดินแดง เขตดินแดง กรุงเทพฯ 10400",
            "province": "กรุงเทพมหานคร",
            "contact_name": "คุณวิชัย เทคโน",
            "contact_email": "wichai@itsolution.co.th",
            "contact_phone": "086-555-9999",
        },
    ]
    
    created = []
    for i, data in enumerate(vendors_data):
        existing = session.query(Vendor).filter(Vendor.tax_id == data["tax_id"]).first()
        if not existing:
            vendor = Vendor(
                id=str(datetime.now().timestamp()) + data["tax_id"][-4:],
                vendor_code=f"VEND-{2024}{i+1:03d}",
                **data,
                status=VendorStatus.ACTIVE,
                created_at=datetime.utcnow(),
            )
            session.add(vendor)
            created.append(vendor.name)
    
    session.commit()
    print(f"Created {len(created)} vendors: {created}")
    return created


def create_sample_org_structure(session):
    """Create organization structure"""
    org_units = [
        {"name": "กระทรวงการคลัง", "name_en": "Ministry of Finance", "level": OrgLevel.MINISTRY, "code": "MOF"},
        {"name": "กรมบัญชีกลาง", "name_en": "Comptroller General's Department", "level": OrgLevel.DEPARTMENT, "code": "CGD", "parent_code": "MOF"},
        {"name": "สำนักงานเลขานุการกรม", "name_en": "Secretariat Office", "level": OrgLevel.BUREAU, "code": "SEC", "parent_code": "CGD"},
        {"name": "กองพัสดุ", "name_en": "Procurement Division", "level": OrgLevel.DIVISION, "code": "PRO", "parent_code": "CGD"},
        {"name": "กองกฎหมาย", "name_en": "Legal Division", "level": OrgLevel.DIVISION, "code": "LEG", "parent_code": "CGD"},
    ]
    
    created = []
    unit_map = {}
    
    for unit in org_units:
        existing = session.query(OrganizationUnit).filter(OrganizationUnit.code == unit["code"]).first()
        if not existing:
            parent_id = unit_map.get(unit.get("parent_code")) if unit.get("parent_code") else None
            org = OrganizationUnit(
                id=str(datetime.now().timestamp()) + unit["code"],
                name=unit["name"],
                name_en=unit["name_en"],
                level=unit["level"],
                code=unit["code"],
                parent_id=parent_id,
                is_active=True,
            )
            session.add(org)
            session.flush()
            unit_map[unit["code"]] = org.id
            created.append(org.name)
    
    session.commit()
    print(f"Created {len(created)} org units: {created}")


def create_sample_agents(session):
    """Create sample AI agents"""
    from app.models.ai_models import OutputAction
    
    agents_data = [
        {
            "name": "ผู้ช่วยวิเคราะห์สัญญา",
            "description": "วิเคราะห์สัญญาและตรวจสอบความเสี่ยง",
            "system_prompt": "คุณเป็นผู้เชี่ยวชาญด้านกฎหมายสัญญา ช่วยวิเคราะห์สัญญาและระบุจุดเสี่ยง",
            "output_action": OutputAction.SHOW_POPUP,
        },
        {
            "name": "ผู้ช่วยตรวจสอบผู้รับจ้าง",
            "description": "ตรวจสอบประวัติและความน่าเชื่อถือของผู้รับจ้าง",
            "system_prompt": "คุณเป็นผู้เชี่ยวชาญด้านการตรวจสอบผู้รับจ้าง ช่วยประเมินความเสี่ยง",
            "output_action": OutputAction.SHOW_POPUP,
        },
        {
            "name": "ผู้ช่วยจัดการเอกสาร",
            "description": "วิเคราะห์และจำแนกประเภทเอกสารอัตโนมัติ",
            "system_prompt": "คุณเป็นผู้เชี่ยวชาญด้านการจัดการเอกสาร ช่วยวิเคราะห์และจำแนกเอกสาร",
            "output_action": OutputAction.SAVE_TO_FIELD,
        },
    ]
    
    created = []
    for data in agents_data:
        existing = session.query(AIAgent).filter(AIAgent.name == data["name"]).first()
        if not existing:
            agent = AIAgent(
                id=str(datetime.now().timestamp()) + data["name"][:5],
                **data,
                status=AgentStatus.ACTIVE,
                user_id="system",
                is_system=True,
                model_config={"temperature": 0.7, "max_tokens": 2000},
                knowledge_base_ids=[],
                use_graphrag=False,
                trigger_events=["manual"],
                trigger_pages=[],
                input_schema={},
                output_format="json",
                allowed_roles=[],
                created_at=datetime.utcnow(),
            )
            session.add(agent)
            created.append(agent.name)
    
    session.commit()
    print(f"Created {len(created)} agents: {created}")


def main():
    session = Session()
    try:
        print("Creating sample data for UAT...")
        create_sample_vendors(session)
        create_sample_org_structure(session)
        create_sample_agents(session)
        print("\n✅ Sample data created successfully!")
    except Exception as e:
        print(f"Error: {e}")
        session.rollback()
    finally:
        session.close()


if __name__ == "__main__":
    main()
