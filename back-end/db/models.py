from datetime import datetime, timezone
from enum import Enum
from typing import Any

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
    """A saved JobVision search.

    The table keeps its historical name so existing jobs can continue pointing
    at their original saved search records.
    """

    id: int | None = Field(default=None, primary_key=True)
    text: str = Field(index=True)
    active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utcnow)
    filters_json: str = Field(default="{}")


class Job(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    keyword_id: int = Field(foreign_key="keyword.id", index=True)
    title: str
    company: str
    url: str = Field(index=True)  # indexed: Section 6 dedupes scrapes by url
    source_site: str
    found_at: datetime = Field(default_factory=utcnow)
    status: JobStatus = Field(default=JobStatus.FOUND)

    # Normalized listing data. These are nullable because older database rows
    # and some JobVision listings may not contain every field.
    source_job_id: int | None = Field(default=None, index=True)
    description: str | None = None
    responsibilities: str | None = None
    requirements: str | None = None
    skills_json: str | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: str | None = None
    salary_text: str | None = None
    location: str | None = None
    is_remote: bool | None = None
    is_internship: bool | None = None
    work_type: str | None = None
    experience_level: str | None = None
    seniority_level: str | None = None
    company_logo_url: str | None = None
    company_description: str | None = None
    company_page_url: str | None = None
    posted_at: str | None = None
    expires_at: str | None = None

    # Scrape/search provenance and the complete source payload.
    search_id: str | None = None
    source_page: int | None = None
    matched_search_ids_json: str | None = None
    last_seen_at: datetime = Field(default_factory=utcnow)
    raw_data_json: str | None = None

    # User-managed workflow metadata, not supplied by JobVision.
    application_notes: str | None = None
    rejection_reason: str | None = None
    interview_notes: str | None = None


# --- API request/response schemas (not tables) ---


class SavedSearchUpdate(SQLModel):
    """PATCH body; omit `active` to simply toggle it."""

    active: bool | None = None


class SavedSearchCreate(SQLModel):
    """The complete custom JobVision search to save for future scrapes."""

    model_config = ConfigDict(extra="allow")

    pageSize: int = Field(default=30, ge=1, le=100)
    sortBy: int = 1
    keyword: str | None = None
    locationWrapper: str | None = None
    jobCategoryUrlTitle: str | None = None
    workExperiences: list[int] | None = None
    isRemote: bool = False
    isInternship: bool = False
    searchId: str | None = None
    maxPages: int = Field(default=5, ge=1, le=20)


class SavedSearchRead(SQLModel):
    id: int
    text: str
    active: bool
    created_at: datetime
    filters: dict[str, Any]


class JobRead(SQLModel):
    """List response including the fields needed for filtering and display.

    `keyword` is the saved-search text (denormalized from Keyword) so the UI
    can filter/show which search found the row without a second fetch.
    """

    id: int
    keyword_id: int
    keyword: str | None = None
    title: str
    company: str
    url: str
    source_site: str
    found_at: datetime
    status: JobStatus
    is_internship: bool | None = None
    location: str | None = None
    experience_level: str | None = None
    is_remote: bool | None = None
    work_type: str | None = None
    seniority_level: str | None = None


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
