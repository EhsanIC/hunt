from contextlib import asynccontextmanager

from fastapi import FastAPI

from db.database import create_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()  # TODO Section 2: create tables on app startup
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/")
def health():
    return {"status": "green"}