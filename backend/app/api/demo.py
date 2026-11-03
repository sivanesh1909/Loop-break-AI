import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TroubleshootingSession, TroubleshootingAttempt, DiagnosticQuestion
from app.services.demo_engine import demo_engine, DEMO_SCENARIOS

router = APIRouter(prefix="/demo", tags=["demo"])
logger = logging.getLogger("loopbreak.demo")


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


@router.get("/scenarios")
def list_demo_scenarios():
    return {"scenarios": demo_engine.list_scenarios()}


@router.post("/load")
def load_demo_scenario(scenario_key: str, db: Session = Depends(get_db)):
    """Load a pre-built demo scenario with full history."""
    scenario = DEMO_SCENARIOS.get(scenario_key)
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_key}' not found.")

    # Create session
    session = TroubleshootingSession(
        title=scenario["title"],
        description=scenario["description"],
        category=scenario["category"],
        device=scenario.get("device", ""),
        operating_system=scenario.get("operating_system", ""),
        error_message=scenario.get("error_message", ""),
        ai_understanding=scenario.get("understanding", ""),
        symptoms=json.dumps(scenario.get("symptoms", [])),
        is_demo=True,
        status="active",
    )
    db.add(session)
    db.flush()

    # Add questions
    for q_text in scenario.get("questions", []):
        dq = DiagnosticQuestion(
            session_id=session.id,
            question=q_text,
            question_type="text",
        )
        db.add(dq)

    db.commit()
    db.refresh(session)

    return {
        "session_id": session.id,
        "title": session.title,
        "category": session.category,
        "message": f"Demo scenario loaded: {session.title}",
        "mode": "demo",
    }


@router.post("/reset")
def reset_demo_data(db: Session = Depends(get_db)):
    """Delete all demo sessions."""
    deleted = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.is_demo == True
    ).delete()
    db.commit()
    return {"deleted_sessions": deleted, "message": "Demo data cleared."}

