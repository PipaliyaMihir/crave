"""
CRAVE Database Migration Script
--------------------------------
This script copies all tables and data from your local pgAdmin PostgreSQL database
(postgresql://postgres:crave123@localhost:5432/crave)
to your live cloud PostgreSQL database on Render.

Usage:
1. Set TARGET_DATABASE_URL to your Render PostgreSQL URL below (or in .env).
2. Run: python migrate_db.py
"""

import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Local pgAdmin source URL
SOURCE_DB_URL = "postgresql://postgres:crave123@localhost:5432/crave"

# Target Cloud DB URL (Set your Render PostgreSQL URL here or via environment variable)
TARGET_DB_URL = os.getenv("TARGET_DATABASE_URL", "").strip()

if not TARGET_DB_URL:
    print("❌ Error: Please set TARGET_DATABASE_URL variable or pass your Render PostgreSQL URL.")
    print("Example: python migrate_db.py 'postgresql://crave_db_user:...@dpg-xxx.singapore-postgres.render.com/crave_db'")
    sys.exit(1)

# Compatibility fix
if TARGET_DB_URL.startswith("postgres://"):
    TARGET_DB_URL = TARGET_DB_URL.replace("postgres://", "postgresql://", 1)

print(f"🔄 Source DB: {SOURCE_DB_URL}")
print(f"🚀 Target DB: {TARGET_DB_URL}")

try:
    from app.db.session import Base
    from app.models.user import User, Restaurant, Favorite
    from app.models.menu import MenuItem
    from app.models.cart import Cart
    from app.models.order import Order, OrderItem
    from app.models.restaurant_request import RestaurantRequest
    from app.models.rider_request import RiderRequest
    from app.models.rider import Rider
    from app.models.contact import ContactInquiry

    source_engine = create_engine(SOURCE_DB_URL)
    target_engine = create_engine(TARGET_DB_URL)

    SourceSession = sessionmaker(bind=source_engine)
    TargetSession = sessionmaker(bind=target_engine)

    src_db = SourceSession()
    tgt_db = TargetSession()

    # 1. Create all tables on target database
    print("📦 Creating schema on target database...")
    Base.metadata.create_all(bind=target_engine)

    # List of models in order of dependency
    models = [User, Restaurant, MenuItem, Favorite, Cart, Order, OrderItem, RestaurantRequest, RiderRequest, Rider, ContactInquiry]

    for model in models:
        table_name = model.__tablename__
        records = src_db.query(model).all()
        print(f"🚚 Migrating {len(records)} records for '{table_name}'...")

        for rec in records:
            # Copy column dictionary
            data = {c.name: getattr(rec, c.name) for c in rec.__table__.columns}
            
            # Check if record already exists in target DB
            pk_col = list(rec.__table__.primary_key.columns)[0].name
            pk_val = data[pk_col]
            existing = tgt_db.query(model).filter(getattr(model, pk_col) == pk_val).first()
            
            if not existing:
                tgt_db.add(model(**data))
        
        tgt_db.commit()

    print("🎉 Migration completed successfully! Your live backend now has all your local pgAdmin real-time data!")

except Exception as e:
    print(f"❌ Migration Error: {e}")
