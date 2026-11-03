from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
from typing import List

from app.database import get_db
from app.models import TroubleshootingSession, TroubleshootingAttempt
from app.schemas import DashboardStats, SessionResponse, HealthResponse
from app.services import is_ai_available
from app.core.config import settings

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check():
    ai_mode = "demo"
    if is_ai_available():
        ai_mode = "ai"
    elif settings.AI_MODE == "auto":
        ai_mode = "demo (auto-fallback)"
    return HealthResponse(
        status="ok",
        ai_mode=ai_mode,
        ai_enabled=is_ai_available(),
        version="1.0.0"
    )


@router.get("/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_sessions = db.query(TroubleshootingSession).count()
    active_sessions = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.status == "active"
    ).count()
    resolved_sessions = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.status == "resolved"
    ).count()
    total_attempts = db.query(TroubleshootingAttempt).count()
    failed_attempts = db.query(TroubleshootingAttempt).filter(
        TroubleshootingAttempt.user_feedback == "failed"
    ).count()

    success_rate = (resolved_sessions / total_sessions * 100) if total_sessions > 0 else 0.0

    # Average attempts for resolved sessions
    resolved_with_attempts = db.query(
        TroubleshootingSession.id,
        func.count(TroubleshootingAttempt.id).label("cnt")
    ).join(
        TroubleshootingAttempt, TroubleshootingAttempt.session_id == TroubleshootingSession.id, isouter=True
    ).filter(
        TroubleshootingSession.status == "resolved"
    ).group_by(TroubleshootingSession.id).all()

    avg_attempts = 0.0
    if resolved_with_attempts:
        avg_attempts = sum(r.cnt for r in resolved_with_attempts) / len(resolved_with_attempts)

    # Category distribution
    categories = db.query(
        TroubleshootingSession.category,
        func.count(TroubleshootingSession.id).label("count")
    ).group_by(TroubleshootingSession.category).all()
    category_dist = {c.category: c.count for c in categories}

    # Recent sessions
    recent = db.query(TroubleshootingSession).order_by(
        TroubleshootingSession.created_at.desc()
    ).limit(5).all()

    recent_responses = []
    for s in recent:
        attempt_count = db.query(TroubleshootingAttempt).filter(
            TroubleshootingAttempt.session_id == s.id
        ).count()
        failed_count = db.query(TroubleshootingAttempt).filter(
            TroubleshootingAttempt.session_id == s.id,
            TroubleshootingAttempt.user_feedback == "failed"
        ).count()
        sr = SessionResponse.model_validate(s)
        sr.attempt_count = attempt_count
        sr.failed_count = failed_count
        recent_responses.append(sr)

    return DashboardStats(
        total_sessions=total_sessions,
        active_sessions=active_sessions,
        resolved_sessions=resolved_sessions,
        total_attempts=total_attempts,
        failed_attempts=failed_attempts,
        success_rate=round(success_rate, 1),
        avg_attempts_to_resolve=round(avg_attempts, 1),
        category_distribution=category_dist,
        recent_sessions=recent_responses,
    )

