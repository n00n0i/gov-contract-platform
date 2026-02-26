#!/usr/bin/env python3
"""Create access control tables"""
import sys
sys.path.insert(0, '/app')

from app.db.database import engine
from app.models.base import Base
from app.models.access_control import (
    AccessPolicy, KBOrgAccess, KBUserAccess, 
    ContractVisibility, OrgDelegation, AccessLog
)

print('Creating access control tables...')
Base.metadata.create_all(bind=engine, tables=[
    AccessPolicy.__table__,
    KBOrgAccess.__table__,
    KBUserAccess.__table__,
    ContractVisibility.__table__,
    OrgDelegation.__table__,
    AccessLog.__table__
])
print('Done!')
