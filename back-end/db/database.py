import sqlite3
from datetime import datetime

from sqlmodel import Session, SQLModel, create_engine

# Imported so SQLModel.metadata is registered before create_tables() runs
# (db/models.py does not import database.py, so there is no circular import).
from db.models import Job, Keyword  # noqa: F401

DB_FILE = "jobs.db"
DATABASE_URL = f"sqlite:///{DB_FILE}"

# Python 3.12+ deprecates sqlite3's default datetime adapter; register our own
# so timestamps are stored as ISO-8601 strings without DeprecationWarnings.
sqlite3.register_adapter(datetime, lambda dt: dt.isoformat())

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},  # FastAPI runs sync routes in a threadpool
)


def create_tables() -> None:
    """Create all tables defined in models.py (idempotent)."""
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
