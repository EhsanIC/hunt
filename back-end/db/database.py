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
    """Create tables and add fields introduced after the initial SQLite schema."""
    SQLModel.metadata.create_all(engine)

    # SQLModel's create_all() does not alter an existing table.  Keep the
    # historical `keyword` table name for the Job.keyword_id foreign key while
    # upgrading old databases to saved-search records.
    with engine.begin() as connection:
        columns = connection.exec_driver_sql("PRAGMA table_info(keyword)").fetchall()
        if columns and not any(column[1] == "filters_json" for column in columns):
            connection.exec_driver_sql(
                "ALTER TABLE keyword ADD COLUMN filters_json TEXT NOT NULL DEFAULT '{}'"
            )
        if columns:
            connection.exec_driver_sql(
                "UPDATE keyword SET filters_json = json_object('keyword', text) "
                "WHERE filters_json = '{}' OR filters_json IS NULL"
            )


def get_session():
    with Session(engine) as session:
        yield session
