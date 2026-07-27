from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

# Get Database URL from environment
db_url = os.getenv("DATABASE_URL", "").strip()

# If running on Render and DATABASE_URL points to localhost/127.0.0.1 or is empty, use SQLite
is_render = os.getenv("RENDER") is not None or os.getenv("PORT") is not None
if not db_url or (is_render and ("localhost" in db_url or "127.0.0.1" in db_url)):
    db_url = "sqlite:///./sql_app.db"

# PostgreSQL URL compatibility fix (postgres:// -> postgresql://)
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

try:
    engine = create_engine(db_url, connect_args=connect_args, pool_pre_ping=True)
    # Validate connection at startup
    with engine.connect() as conn:
        pass
except Exception as err:
    print(f"[DB Warning] Connection to {db_url} failed: {err}. Falling back to local SQLite database.")
    db_url = "sqlite:///./sql_app.db"
    engine = create_engine(db_url, connect_args={"check_same_thread": False}, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()