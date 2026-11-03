"""
LoopBreak AI — FastAPI Application Entry Point
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from app.core.config import settings
from app.core.logging import setup_logging
from app.database import init_db
from app.api import sessions_router, stats_router, files_router, demo_router

setup_logging()
logger = logging.getLogger("loopbreak")

app = FastAPI(
    title="LoopBreak AI",
    description="AI That Learns From What Didn't Work.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS
cors_origins = settings.cors_origins_list
has_wildcard = "*" in cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if has_wildcard else cors_origins,
    allow_credentials=False if has_wildcard else True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global error handler — never expose stack traces
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again."},
    )

# Routers
app.include_router(stats_router, prefix="/api", tags=["stats"])
app.include_router(sessions_router, prefix="/api")
app.include_router(files_router, prefix="/api")
app.include_router(demo_router, prefix="/api")


@app.on_event("startup")
async def startup():
    logger.info("Starting LoopBreak AI backend...")
    init_db()
    logger.info(f"Database initialized. AI mode: {'enabled' if settings.is_ai_enabled else 'demo'}")


@app.get("/")
def root():
    return {
        "name": "LoopBreak AI API",
        "version": "1.0.0",
        "docs": "/api/docs",
        "status": "running"
    }

