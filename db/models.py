from datetime import datetime, timezone
from enum import Enum

from sqlmodel import Field, SQLModel


class JobStatus(str, Enum):
    """Lifecycle of a job listing (TODO Section 2)."""

    FOUND = "found"
    APPLIED = "applied"
    REJECTED = "rejected"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Keyword(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    text: str = Field(index=True)
    active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utcnow)


class Job(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    keyword_id: int = Field(foreign_key="keyword.id", index=True)
    title: str
    company: str
    url: str = Field(index=True)  # indexed: Section 6 dedupes scrapes by url
    source_site: str
    found_at: datetime = Field(default_factory=utcnow)
    status: JobStatus = Field(default=JobStatus.FOUND)


# --- API request/response schemas (not tables) ---


class KeywordCreate(SQLModel):
    text: str


class KeywordUpdate(SQLModel):
    """PATCH body; omit `active` to simply toggle it."""

    active: bool | None = None


class KeywordRead(SQLModel):
    id: int
    text: str
    active: bool
    created_at: datetime
