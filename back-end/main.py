import asyncio
import json
from datetime import datetime, timezone
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from db.database import create_tables, engine
from db.models import (
    Job,
    JobRead,
    JobStatus,
    JobUpdate,
    Keyword,
    SavedSearchUpdate,
    SearchRequest,
    SearchResponse,
    SavedSearchCreate,
    SavedSearchRead,
)
from scraper import search_jobs_with_filters

REQUEST_DELAY_SECONDS = 1.0  # be a good citizen: pause between saved-search requests


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _optional_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in (0, 1):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "yes", "1"}:
            return True
        if normalized in {"false", "no", "0"}:
            return False
    return None


def _job_json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True) if value is not None else None


def _matched_search_ids(existing: Job, search_id: int) -> str:
    try:
        values = json.loads(existing.matched_search_ids_json or "[]")
    except (TypeError, json.JSONDecodeError):
        values = []
    if not isinstance(values, list):
        values = []
    if search_id not in values:
        values.append(search_id)
    return _job_json(values) or "[]"


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()  # TODO Section 2: create tables on app startup
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)


@app.get("/")
def health():
    return {"status": "green"}


# --- Saved JobVision searches ---


def _saved_search_read(saved_search: Keyword) -> SavedSearchRead:
    try:
        filters = json.loads(saved_search.filters_json)
    except (TypeError, json.JSONDecodeError):
        filters = {"keyword": saved_search.text}
    return SavedSearchRead(
        id=saved_search.id,
        text=saved_search.text,
        active=saved_search.active,
        created_at=saved_search.created_at,
        filters=filters,
    )


def _saved_search_name(payload: SavedSearchCreate) -> str:
    return payload.keyword.strip() if payload.keyword and payload.keyword.strip() else "All JobVision jobs"


@app.post("/saved-searches", response_model=SavedSearchRead, status_code=201)
def add_saved_search(payload: SavedSearchCreate):
    """Save a complete custom JobVision search for future scrapes."""
    filters = payload.model_dump(exclude={"maxPages"}, exclude_none=True)
    filters["maxPages"] = payload.maxPages
    name = _saved_search_name(payload)
    with Session(engine) as session:
        existing = session.exec(
            select(Keyword).where(Keyword.filters_json == json.dumps(filters, sort_keys=True))
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="This search is already saved")
        saved_search = Keyword(text=name, filters_json=json.dumps(filters, sort_keys=True))
        session.add(saved_search)
        session.commit()
        session.refresh(saved_search)
        return _saved_search_read(saved_search)


@app.get("/saved-searches", response_model=list[SavedSearchRead])
def list_saved_searches():
    with Session(engine) as session:
        return [_saved_search_read(item) for item in session.exec(select(Keyword).order_by(Keyword.id)).all()]


@app.patch("/saved-searches/{search_id}", response_model=SavedSearchRead)
def set_saved_search_active(search_id: int, update: SavedSearchUpdate | None = None):
    with Session(engine) as session:
        saved_search = session.get(Keyword, search_id)
        if not saved_search:
            raise HTTPException(status_code=404, detail="Saved search not found")
        saved_search.active = update.active if update and update.active is not None else not saved_search.active
        session.add(saved_search)
        session.commit()
        session.refresh(saved_search)
        return _saved_search_read(saved_search)


@app.delete("/saved-searches/{search_id}", status_code=204)
def delete_saved_search(search_id: int):
    with Session(engine) as session:
        saved_search = session.get(Keyword, search_id)
        if not saved_search:
            raise HTTPException(status_code=404, detail="Saved search not found")
        session.delete(saved_search)
        session.commit()


@app.post("/search", response_model=SearchResponse)
async def search(payload: SearchRequest):
    """Run one custom JobVision search without storing the results.

    The browser URL and RelatedSearch request are presentation/SEO helpers;
    the listing data comes from JobPost/List and its JSON body.  This endpoint
    exposes that body directly so callers can combine keyword, location,
    category, experience, remote, internship, and future filters.
    """
    filters = payload.model_dump(exclude={"maxPages"}, exclude_none=True)
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            return await search_jobs_with_filters(
                client, filters, max_pages=payload.maxPages
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"JobVision request failed: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/scrape")
async def scrape():
    """Scrape all active keywords and store new jobs (deduped by url).

    Also dedupes within a single run (a job matching two keywords is stored
    once, under the first keyword that found it).
    """
    new_count = 0
    skipped_count = 0
    searches_searched = 0
    errors: list[str] = []
    seen_urls: dict[str, Job] = {}

    with Session(engine) as session:
        active = list(
            session.exec(
                select(Keyword).where(Keyword.active).order_by(Keyword.id)
            ).all()
        )

        if not active:
            return {
                "searches_searched": 0,
                "new_jobs": 0,
                "skipped_existing": 0,
                "errors": [],
                "message": "No active saved searches — save a custom search first.",
            }

        async with httpx.AsyncClient(timeout=20) as client:
            for i, keyword in enumerate(active):
                if i > 0:
                    await asyncio.sleep(REQUEST_DELAY_SECONDS)
                try:
                    try:
                        filters = json.loads(keyword.filters_json)
                    except (TypeError, json.JSONDecodeError):
                        filters = {"keyword": keyword.text}
                    result = await search_jobs_with_filters(
                        client, filters, max_pages=filters.get("maxPages", 5)
                    )
                    jobs = result["jobs"]
                except Exception as exc:  # keep going: one bad search shouldn't kill the run
                    errors.append(f"search {keyword.text!r}: {type(exc).__name__}: {exc}")
                    continue
                searches_searched += 1

                for job in jobs:
                    existing = seen_urls.get(job["url"])
                    if existing is None:
                        existing = session.exec(
                            select(Job).where(Job.url == job["url"])
                        ).first()

                    if existing:
                        # Refresh source metadata while preserving the user's
                        # workflow status and notes. A job can match several
                        # saved searches, so retain all matching search IDs.
                        existing.title = job["title"]
                        existing.company = job["company"]
                        existing.source_job_id = job.get("source_job_id")
                        existing.source_site = job["source_site"]
                        existing.description = job.get("description")
                        existing.responsibilities = job.get("responsibilities")
                        existing.requirements = job.get("requirements")
                        existing.skills_json = _job_json(job.get("skills"))
                        existing.salary_min = job.get("salary_min")
                        existing.salary_max = job.get("salary_max")
                        existing.salary_currency = job.get("salary_currency")
                        existing.salary_text = job.get("salary_text")
                        existing.location = job.get("location")
                        existing.is_remote = _optional_bool(job.get("is_remote"))
                        existing.is_internship = _optional_bool(job.get("is_internship"))
                        existing.work_type = job.get("work_type")
                        existing.experience_level = job.get("experience_level")
                        existing.seniority_level = job.get("seniority_level")
                        existing.company_logo_url = job.get("company_logo_url")
                        existing.company_description = job.get("company_description")
                        existing.company_page_url = job.get("company_page_url")
                        existing.posted_at = job.get("posted_at")
                        existing.expires_at = job.get("expires_at")
                        existing.search_id = job.get("search_id")
                        existing.source_page = job.get("source_page")
                        existing.matched_search_ids_json = _matched_search_ids(existing, keyword.id)
                        existing.last_seen_at = _utcnow()
                        existing.raw_data_json = _job_json(job.get("raw_data"))
                        session.add(existing)
                        skipped_count += 1
                        continue

                    new_job = Job(
                        keyword_id=keyword.id,
                        source_job_id=job.get("source_job_id"),
                        title=job["title"],
                        company=job["company"],
                        url=job["url"],
                        source_site=job["source_site"],
                        status=JobStatus.FOUND,
                        description=job.get("description"),
                        responsibilities=job.get("responsibilities"),
                        requirements=job.get("requirements"),
                        skills_json=_job_json(job.get("skills")),
                        salary_min=job.get("salary_min"),
                        salary_max=job.get("salary_max"),
                        salary_currency=job.get("salary_currency"),
                        salary_text=job.get("salary_text"),
                        location=job.get("location"),
                        is_remote=_optional_bool(job.get("is_remote")),
                        is_internship=_optional_bool(job.get("is_internship")),                            work_type=job.get("work_type"),
                            experience_level=job.get("experience_level"),
                            seniority_level=job.get("seniority_level"),
                        company_logo_url=job.get("company_logo_url"),
                        company_description=job.get("company_description"),
                        company_page_url=job.get("company_page_url"),
                        posted_at=job.get("posted_at"),
                        expires_at=job.get("expires_at"),
                        search_id=job.get("search_id"),
                        source_page=job.get("source_page"),
                        matched_search_ids_json=_job_json([keyword.id]),
                        last_seen_at=_utcnow(),
                        raw_data_json=_job_json(job.get("raw_data")),
                    )
                    session.add(new_job)
                    seen_urls[job["url"]] = new_job
                    new_count += 1

        session.commit()

    return {
        "searches_searched": searches_searched,
        "new_jobs": new_count,
        "skipped_existing": skipped_count,
        "errors": errors,
    }



# --- TODO Section 7: Viewing & Status Updates ---


@app.get("/jobs", response_model=list[JobRead])
def list_jobs(status: JobStatus | None = None):
    """List jobs, optionally filtered by status (found / applied / rejected)."""
    with Session(engine) as session:
        query = select(Job).order_by(Job.id)
        if status is not None:
            query = query.where(Job.status == status)
        return list(session.exec(query).all())


@app.patch("/jobs/{job_id}", response_model=JobRead)
def update_job_status(job_id: int, update: JobUpdate):
    """Update a job's status (mark it as applied or rejected)."""
    with Session(engine) as session:
        job = session.get(Job, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        job.status = update.status
        session.add(job)
        session.commit()
        session.refresh(job)
        return job

