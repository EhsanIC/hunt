from datetime import datetime, timezone
from enum import Enum

from pydantic import ConfigDict
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


class JobRead(SQLModel):
    id: int
    keyword_id: int
    title: str
    company: str
    url: str
    source_site: str
    found_at: datetime
    status: JobStatus


class JobUpdate(SQLModel):
    """PATCH body: the job's new status (applied / rejected / found)."""

    status: JobStatus


class SearchRequest(SQLModel):
    """Filters accepted by JobVision's JobPost/List endpoint.

    The names intentionally match the target API's camelCase payload.  Extra
    fields are allowed so a newly discovered JobVision filter can be forwarded
    without changing this app first.
    """

    model_config = ConfigDict(extra="allow")

    pageSize: int = Field(default=30, ge=1, le=100)
    requestedPage: int = Field(default=1, ge=1)
    sortBy: int = 1
    keyword: str | None = None
    locationWrapper: str | None = None
    jobCategoryUrlTitle: str | None = None
    workExperiences: list[int] | None = None
    isRemote: bool | None = None
    isInternship: bool | None = None
    searchId: str | None = None
    # Internal pagination cap; this is never sent to JobVision.
    maxPages: int = Field(default=5, ge=1, le=20)


class SearchJobRead(SQLModel):
    """Small, stable representation of a JobVision result for the UI."""

    id: int
    title: str
    company: str
    url: str
    source_site: str
    is_remote: bool | None = None
    is_internship: bool | None = None
    location: str | None = None
    work_type: str | None = None
    seniority_level: str | None = None


class SearchResponse(SQLModel):
    currentPage: int
    pageSize: int
    jobPostCount: int
    searchId: str | None = None
    hasSalaryHistogram: bool | None = None
    jobs: list[SearchJobRead]
