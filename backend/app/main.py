"""AstroVital API — application factory.

Run:  uvicorn app.main:app --reload     (from backend/)
Docs: http://localhost:8000/docs
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .api.routes import ai, data, entries, meta, photos
from .persistence.db import get_engine

DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_engine()  # create the database and tables once, before serving requests
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="AstroVital API", version="2.0.0", lifespan=lifespan,
                  description="Crew health self-monitoring for long-duration spaceflight.")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.getenv("ASTROVITAL_CORS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
        allow_methods=["*"], allow_headers=["*"],
    )
    for r in (meta.router, entries.router, data.router, photos.router, ai.router):
        app.include_router(r)
    _mount_frontend(app)
    return app


def _mount_frontend(app: FastAPI) -> None:
    """Serve the built React app (frontend/dist) when present, so one process runs everything."""
    if not DIST.is_dir():
        return
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = (DIST / path).resolve()
        inside = DIST.resolve() in f.parents
        return FileResponse(f if path and inside and f.is_file() else DIST / "index.html")


app = create_app()
