import sqlite3
from datetime import datetime
from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine

# Imported so SQLModel.metadata is registered before create_tables() runs
# (db/models.py does not import database.py, so there is no circular import).
from db.models import Job, Keyword  # noqa: F401

DB_FILE = Path(__file__).resolve().parent.parent / "jobs.db"
DATABASE_URL = f"sqlite:///{DB_FILE.as_posix()}"

# Python 3.12+ deprecates sqlite3's default datetime adapter; register our own
# so timestamps are stored as ISO-8601 strings without DeprecationWarnings.
sqlite3.register_adapter(datetime, lambda dt: dt.isoformat())

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},  # FastAPI runs sync routes in a threadpool
)


JOB_MIGRATION_COLUMNS = {
    "source_job_id": "INTEGER",
    "description": "TEXT",
    "responsibilities": "TEXT",
    "requirements": "TEXT",
    "skills_json": "TEXT",
    "salary_min": "REAL",
    "salary_max": "REAL",
    "salary_currency": "TEXT",
    "salary_text": "TEXT",
    "location": "TEXT",
    "is_remote": "BOOLEAN",
    "is_internship": "BOOLEAN",
    "work_type": "TEXT",
    "experience_level": "TEXT",
    "seniority_level": "TEXT",
    "company_logo_url": "TEXT",
    "company_description": "TEXT",
    "company_page_url": "TEXT",
    "posted_at": "TEXT",
    "expires_at": "TEXT",
    "search_id": "TEXT",
    "source_page": "INTEGER",
    "matched_search_ids_json": "TEXT",
    "last_seen_at": "TEXT",
    "raw_data_json": "TEXT",
    "application_notes": "TEXT",
    "rejection_reason": "TEXT",
    "interview_notes": "TEXT",
}


def create_tables() -> None:
    """Create tables and add fields introduced after the initial SQLite schema."""
    SQLModel.metadata.create_all(engine)

    # SQLModel's create_all() does not alter an existing table. Keep the
    # historical `keyword` table name for the Job.keyword_id foreign key while
    # upgrading old databases to saved-search records.
    with engine.begin() as connection:
        keyword_columns = connection.exec_driver_sql("PRAGMA table_info(keyword)").fetchall()
        if keyword_columns and not any(column[1] == "filters_json" for column in keyword_columns):
            connection.exec_driver_sql(
                "ALTER TABLE keyword ADD COLUMN filters_json TEXT NOT NULL DEFAULT '{}'"
            )
        if keyword_columns:
            connection.exec_driver_sql(
                "UPDATE keyword SET filters_json = json_object('keyword', text) "
                "WHERE filters_json = '{}' OR filters_json IS NULL"
            )

        job_columns = connection.exec_driver_sql("PRAGMA table_info(job)").fetchall()
        existing_job_columns = {column[1] for column in job_columns}
        for name, sql_type in JOB_MIGRATION_COLUMNS.items():
            if name not in existing_job_columns:
                connection.exec_driver_sql(f"ALTER TABLE job ADD COLUMN {name} {sql_type}")

        # Existing rows predate last_seen_at. found_at is the closest accurate
        # value available, so use it as a one-time migration fallback.
        if "last_seen_at" in JOB_MIGRATION_COLUMNS:
            connection.exec_driver_sql(
                "UPDATE job SET last_seen_at = found_at "
                "WHERE last_seen_at IS NULL"
            )


def get_session():
    with Session(engine) as session:
        yield session
