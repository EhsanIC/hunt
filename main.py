from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from sqlmodel import Session, select

from db.database import create_tables, engine
from db.models import Keyword, KeywordCreate, KeywordRead, KeywordUpdate
from recon_section4 import run_recon


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()  # TODO Section 2: create tables on app startup
    yield


app = FastAPI(lifespan=lifespan)


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


# --- TODO Section 4: Target Site Recon ---


@app.get("/recon/section4", summary="Re-run the Section 4 recon checks against the jobvision API")
def recon_section4():
    """Same checks as recon_section4.py (no-cookies call, keyword param,
    pagination, job URL pattern), returned as JSON.

    Takes a few seconds — it makes several live calls to the target API.
    """
    return run_recon()