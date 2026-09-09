import asyncio
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
    KeywordCreate,
    KeywordRead,
    KeywordUpdate,
    SearchRequest,
    SearchResponse,
)
from scraper import search_jobs, search_jobs_with_filters

REQUEST_DELAY_SECONDS = 1.0  # be a good citizen: pause between keyword requests


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


# --- TODO Section 3: Keyword Management (CRUD) ---


@app.post("/keywords", response_model=KeywordRead, status_code=201)
def add_keyword(payload: KeywordCreate):
    """Add a keyword to the managed list."""
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Keyword text must not be empty")
    with Session(engine) as session:
        existing = session.exec(select(Keyword).where(Keyword.text == text)).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Keyword already exists (id={existing.id})",
            )
        keyword = Keyword(text=text)
        session.add(keyword)
        session.commit()
        session.refresh(keyword)
        return keyword


@app.get("/keywords", response_model=list[KeywordRead])
def list_keywords():
    """List all keywords."""
    with Session(engine) as session:
        return list(session.exec(select(Keyword).order_by(Keyword.id)).all())


@app.patch("/keywords/{keyword_id}", response_model=KeywordRead)
def set_keyword_active(keyword_id: int, update: KeywordUpdate | None = None):
    """Toggle active/inactive (or set it explicitly with {\"active\": true/false})."""
    with Session(engine) as session:
        keyword = session.get(Keyword, keyword_id)
        if not keyword:
            raise HTTPException(status_code=404, detail="Keyword not found")
        keyword.active = (
            update.active if update and update.active is not None else not keyword.active
        )
        session.add(keyword)
        session.commit()
        session.refresh(keyword)
        return keyword


@app.delete("/keywords/{keyword_id}", status_code=204)
def delete_keyword(keyword_id: int):
    """Remove a keyword."""
    with Session(engine) as session:
        keyword = session.get(Keyword, keyword_id)
        if not keyword:
            raise HTTPException(status_code=404, detail="Keyword not found")
        session.delete(keyword)
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
    keywords_searched = 0
    errors: list[str] = []
    seen_urls: set[str] = set()

    with Session(engine) as session:
        active = list(
            session.exec(
                select(Keyword).where(Keyword.active).order_by(Keyword.id)
            ).all()
        )

        if not active:
            return {
                "keywords_searched": 0,
                "new_jobs": 0,
                "skipped_existing": 0,
                "errors": [],
                "message": "No active keywords — add some via POST /keywords first.",
            }

        async with httpx.AsyncClient(timeout=20) as client:
            for i, keyword in enumerate(active):
                if i > 0:
                    await asyncio.sleep(REQUEST_DELAY_SECONDS)
                try:
                    jobs = await search_jobs(client, keyword.text)
                except Exception as exc:  # keep going: one bad keyword shouldn't kill the run
                    errors.append(f"keyword {keyword.text!r}: {type(exc).__name__}: {exc}")
                    continue
                keywords_searched += 1

                for job in jobs:
                    if job["url"] in seen_urls:
                        continue
                    seen_urls.add(job["url"])
                    existing = session.exec(
                        select(Job).where(Job.url == job["url"])
                    ).first()
                    if existing:
                        skipped_count += 1
                        continue
                    session.add(
                        Job(
                            keyword_id=keyword.id,
                            title=job["title"],
                            company=job["company"],
                            url=job["url"],
                            source_site=job["source_site"],
                            status=JobStatus.FOUND,
                        )
                    )
                    new_count += 1

        session.commit()

    return {
        "keywords_searched": keywords_searched,
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

