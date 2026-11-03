from app.api.sessions import router as sessions_router
from app.api.stats import router as stats_router
from app.api.files import router as files_router
from app.api.demo import router as demo_router

__all__ = ["sessions_router", "stats_router", "files_router", "demo_router"]

