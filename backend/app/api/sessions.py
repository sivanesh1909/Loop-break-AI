import json
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TroubleshootingSession, TroubleshootingAttempt, DiagnosticQuestion, RootCauseHypothesis
from app.schemas import (
    SessionCreate, SessionUpdate, SessionResponse,
    AttemptCreate, AttemptResponse, FeedbackCreate,
    QuestionCreate, QuestionAnswer, QuestionResponse,
    RootCauseResponse, DiagnoseRequest, DiagnoseResponse
)
from app.services import (
    understand_problem, generate_questions, generate_recommendation,
    analyze_root_causes, generate_final_summary, is_ai_available,
    is_duplicate_action, get_failed_action_titles, demo_engine
)

router = APIRouter(prefix="/sessions", tags=["sessions"])
logger = logging.getLogger("loopbreak.sessions")


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _session_response(session: TroubleshootingSession, db: Session) -> SessionResponse:
    attempt_count = db.query(TroubleshootingAttempt).filter(
        TroubleshootingAttempt.session_id == session.id
    ).count()
    failed_count = db.query(TroubleshootingAttempt).filter(
        TroubleshootingAttempt.session_id == session.id,
        TroubleshootingAttempt.user_feedback == "failed"
    ).count()
    resp = SessionResponse.model_validate(session)
    resp.attempt_count = attempt_count
    resp.failed_count = failed_count
    return resp


def build_hypothesis_tree(session: TroubleshootingSession, attempts: list, root_causes: list, current_rec: dict | None):
    nodes = [
        {
            "id": "root",
            "type": "root",
            "label": session.title[:50] + ("..." if len(session.title) > 50 else ""),
            "status": "investigating",
            "category": session.category
        }
    ]
    edges = []

    # Explored attempts as nodes
    for att in attempts:
        node_id = f"attempt_{att.id}"
        status = "ruled_out" if att.user_feedback == "failed" else ("confirmed" if att.user_feedback == "worked" else "explored")
        nodes.append({
            "id": node_id,
            "type": "attempt",
            "label": f"#{att.attempt_number}: {att.action_title[:45]}",
            "status": status,
            "feedback": att.user_feedback,
            "result": att.actual_result,
            "reasoning": att.reasoning
        })
        edges.append({"from": "root", "to": node_id, "status": status})

    # Root cause hypotheses
    for rc in root_causes:
        cause_title = rc.get("cause", "")
        rc_id = f"rc_{cause_title[:20]}"
        nodes.append({
            "id": rc_id,
            "type": "hypothesis",
            "label": cause_title[:45],
            "status": rc.get("status", "hypothesis"),
            "confidence": rc.get("confidence", 0.5)
        })
        edges.append({"from": "root", "to": rc_id, "status": rc.get("status", "hypothesis")})

    # Current active recommendation probe
    if current_rec:
        rec_id = "current_probe"
        nodes.append({
            "id": rec_id,
            "type": "active_probe",
            "label": f"Active: {current_rec.get('action_title', '')[:45]}",
            "status": "active",
            "confidence": current_rec.get("confidence", 0.8),
            "risk": current_rec.get("risk_level", "low")
        })
        edges.append({"from": "root", "to": rec_id, "status": "active"})

    return {"nodes": nodes, "edges": edges}


# ─── CRUD ────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[SessionResponse])
def list_sessions(
    skip: int = 0, limit: int = 50,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(TroubleshootingSession)
    if status:
        q = q.filter(TroubleshootingSession.status == status)
    sessions = q.order_by(TroubleshootingSession.created_at.desc()).offset(skip).limit(limit).all()
    return [_session_response(s, db) for s in sessions]


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(body: SessionCreate, db: Session = Depends(get_db)):
    session = TroubleshootingSession(
        title=body.title,
        description=body.description,
        category=body.category.value,
        device=body.device,
        operating_system=body.operating_system,
        error_message=body.error_message,
        is_demo=body.is_demo,
        status="draft" if not body.is_demo else "active",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_response(session, db)


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return _session_response(session, db)


@router.patch("/{session_id}", response_model=SessionResponse)
def update_session(session_id: str, body: SessionUpdate, db: Session = Depends(get_db)):
    session = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    update_data = body.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        if v is not None:
            setattr(session, k, v.value if hasattr(v, "value") else v)

    if body.status and body.status.value == "resolved" and not session.resolved_at:
        session.resolved_at = utcnow()

    session.updated_at = utcnow()
    db.commit()
    db.refresh(session)
    return _session_response(session, db)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()


# ─── Diagnose ────────────────────────────────────────────────────────────────

@router.post("/{session_id}/diagnose", response_model=DiagnoseResponse)
async def diagnose_session(session_id: str, body: DiagnoseRequest, db: Session = Depends(get_db)):
    session = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    attempts = session.attempts
    questions = session.questions
    failed_actions = get_failed_action_titles(attempts)
    use_ai = is_ai_available() and not body.force_demo

    if use_ai:
        # ── AI Mode ──────────────────────────────────────────
        ai_mode = "ai"
        understanding_data = await understand_problem(
            title=session.title,
            description=session.description,
            category=session.category,
            error_message=session.error_message or "",
            device=session.device or "",
            os_name=session.operating_system or "",
        )

        # Safety check
        if understanding_data.get("safety_flag"):
            return DiagnoseResponse(
                session_id=session_id,
                ai_mode=ai_mode,
                understanding=understanding_data.get("safety_message"),
                questions=[],
                recommendation=None,
                root_causes=[],
                safety_flag=True,
                safety_message=understanding_data.get("safety_message"),
            )

        # Update session AI understanding
        session.ai_understanding = understanding_data.get("understanding", "")
        symptoms = understanding_data.get("symptoms", [])
        session.symptoms = json.dumps(symptoms)
        possible_causes = understanding_data.get("possible_causes", [])
        session.possible_causes = json.dumps(possible_causes)
        if session.status == "draft":
            session.status = "active"
        session.updated_at = utcnow()
        db.commit()

        # Generate questions (only if < 3 attempts)
        answered_q_texts = [q.question for q in questions if q.user_answer]
        new_questions = []
        if len(attempts) < 3:
            new_questions = await generate_questions(
                problem={**understanding_data, "title": session.title, "category": session.category},
                answered_questions=answered_q_texts,
                attempt_count=len(attempts),
            )
            # Store questions
            for q_data in new_questions:
                existing = db.query(DiagnosticQuestion).filter(
                    DiagnosticQuestion.session_id == session_id,
                    DiagnosticQuestion.question == q_data.get("question")
                ).first()
                if not existing:
                    dq = DiagnosticQuestion(
                        session_id=session_id,
                        question=q_data.get("question", ""),
                        question_type=q_data.get("question_type", "text"),
                    )
                    db.add(dq)
            db.commit()

        # Generate recommendation
        attempts_dict = [
            {
                "number": a.attempt_number,
                "action": a.action_title,
                "reasoning": a.reasoning,
                "feedback": a.user_feedback,
                "result": a.actual_result,
            }
            for a in attempts
        ]
        answered_q_dict = [
            {"question": q.question, "user_answer": q.user_answer}
            for q in questions if q.user_answer
        ]
        recommendation = None
        if len(questions) == 0 or any(q.user_answer for q in questions):
            recommendation = await generate_recommendation(
                problem={
                    "summary": session.title,
                    "title": session.title,
                    "category": session.category,
                    "device": session.device,
                    "operating_system": session.operating_system,
                    "error_message": session.error_message,
                },
                attempts=attempts_dict,
                answered_questions=answered_q_dict,
                failed_actions=failed_actions,
            )
            # Duplicate check
            rejected_actions = []
            if recommendation:
                new_title = recommendation.get("action_title", "")
                is_dup, matched, score = is_duplicate_action(new_title, failed_actions)
                if is_dup:
                    logger.warning(f"Duplicate recommendation detected ({score:.2f}): {new_title} ≈ {matched}")
                    rejected_actions.append({
                        "rejected_title": new_title,
                        "matched_with": matched,
                        "similarity_score": round(score, 2),
                        "reason": f"Semantic overlap ({int(score * 100)}%) with a previously failed attempt. Intercepted by Failure Memory."
                    })
                    # Force regeneration with explicit exclusion
                    recommendation = await generate_recommendation(
                        problem={
                            "summary": session.title,
                            "title": session.title,
                            "category": session.category,
                            "device": session.device,
                            "operating_system": session.operating_system,
                            "error_message": session.error_message,
                        },
                        attempts=attempts_dict,
                        answered_questions=answered_q_dict,
                        failed_actions=failed_actions + [new_title],
                    )

        # Root cause analysis
        root_causes_data = []
        if len(attempts) >= 2:
            root_causes_data = await analyze_root_causes(
                problem={"title": session.title, "category": session.category},
                attempts=attempts_dict,
            )
            # Save to DB
            for rc_data in root_causes_data:
                rc = RootCauseHypothesis(
                    session_id=session_id,
                    cause=rc_data.get("cause", ""),
                    supporting_evidence=json.dumps(rc_data.get("supporting_evidence", [])),
                    contradicting_evidence=json.dumps(rc_data.get("contradicting_evidence", [])),
                    confidence=rc_data.get("confidence", 0.5),
                    status=rc_data.get("status", "hypothesis"),
                    verification_method=rc_data.get("verification_method", ""),
                )
                db.add(rc)
            db.commit()

        tree = build_hypothesis_tree(session, attempts, root_causes_data, recommendation)

        return DiagnoseResponse(
            session_id=session_id,
            ai_mode=ai_mode,
            understanding=session.ai_understanding,
            questions=[QuestionCreate(**q) for q in new_questions],
            recommendation=recommendation,
            root_causes=root_causes_data,
            rejected_actions=rejected_actions,
            hypothesis_tree=tree,
        )

    else:
        # ── Demo Mode ────────────────────────────────────────
        ai_mode = "demo"
        problem_dict = {
            "title": session.title,
            "description": session.description,
            "category": session.category,
            "device": session.device,
            "error_message": session.error_message,
        }
        understanding_data = demo_engine.analyze_problem(**problem_dict)
        session.ai_understanding = understanding_data.get("understanding", "")
        session.symptoms = json.dumps(understanding_data.get("symptoms", []))
        session.possible_causes = json.dumps(understanding_data.get("possible_causes", []))
        if session.status == "draft":
            session.status = "active"
        session.updated_at = utcnow()
        db.commit()

        new_questions = demo_engine.generate_questions(session_id, problem_dict, len(attempts))
        for q_data in new_questions:
            existing = db.query(DiagnosticQuestion).filter(
                DiagnosticQuestion.session_id == session_id,
                DiagnosticQuestion.question == q_data.get("question")
            ).first()
            if not existing:
                dq = DiagnosticQuestion(
                    session_id=session_id,
                    question=q_data.get("question", ""),
                    question_type=q_data.get("question_type", "text"),
                )
                db.add(dq)
        db.commit()

        recommendation = demo_engine.get_next_recommendation(
            session_id=session_id,
            category=session.category,
            attempt_number=len(attempts),
            failed_actions=failed_actions,
            problem_title=session.title,
            error_message=session.error_message or "",
        )

        # Duplicate check in fallback mode too
        rejected_actions = []
        if recommendation:
            new_title = recommendation.get("action_title", "")
            is_dup, matched, score = is_duplicate_action(new_title, failed_actions)
            if is_dup:
                rejected_actions.append({
                    "rejected_title": new_title,
                    "matched_with": matched or "Previous failed step",
                    "similarity_score": round(score or 0.85, 2),
                    "reason": "Repeats a failed diagnostic approach. Intercepted by Failure Memory."
                })
                # Advance to next step
                recommendation = demo_engine.get_next_recommendation(
                    session_id=session_id,
                    category=session.category,
                    attempt_number=len(attempts) + 1,
                    failed_actions=failed_actions,
                    problem_title=session.title,
                    error_message=session.error_message or "",
                )

        root_causes_data = demo_engine.generate_root_causes(session.category, failed_actions)
        tree = build_hypothesis_tree(session, attempts, root_causes_data, recommendation)

        return DiagnoseResponse(
            session_id=session_id,
            ai_mode=ai_mode,
            understanding=session.ai_understanding,
            questions=[QuestionCreate(**q) for q in new_questions],
            recommendation=recommendation,
            root_causes=root_causes_data,
            rejected_actions=rejected_actions,
            hypothesis_tree=tree,
        )


# ─── Attempts ────────────────────────────────────────────────────────────────

@router.post("/{session_id}/attempts", response_model=AttemptResponse, status_code=201)
def create_attempt(session_id: str, body: AttemptCreate, db: Session = Depends(get_db)):
    session = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == "resolved":
        raise HTTPException(status_code=409, detail="Cannot add attempts to a resolved session")

    last = db.query(TroubleshootingAttempt).filter(
        TroubleshootingAttempt.session_id == session_id
    ).order_by(TroubleshootingAttempt.attempt_number.desc()).first()
    next_num = (last.attempt_number + 1) if last else 1

    attempt = TroubleshootingAttempt(
        session_id=session_id,
        attempt_number=next_num,
        action_title=body.action_title,
        action_details=json.dumps(body.action_details or []),
        reasoning=body.reasoning,
        expected_outcome=body.expected_outcome,
        evidence=json.dumps(body.evidence or []),
        next_if_failed=body.next_if_failed,
        risk_level=body.risk_level,
        effort=body.effort,
        confidence=body.confidence,
        requires_confirmation=body.requires_confirmation,
    )
    db.add(attempt)
    session.updated_at = utcnow()
    db.commit()
    db.refresh(attempt)
    return AttemptResponse.model_validate(attempt)


@router.post("/{session_id}/attempts/{attempt_id}/feedback", response_model=AttemptResponse)
async def submit_feedback(
    session_id: str, attempt_id: str, body: FeedbackCreate, db: Session = Depends(get_db)
):
    attempt = db.query(TroubleshootingAttempt).filter(
        TroubleshootingAttempt.id == attempt_id,
        TroubleshootingAttempt.session_id == session_id,
    ).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    if attempt.user_feedback is not None:
        if attempt.user_feedback == body.feedback and attempt.actual_result == body.actual_result:
            return AttemptResponse.model_validate(attempt)
        raise HTTPException(status_code=409, detail="Feedback has already been submitted for this attempt")

    attempt.user_feedback = body.feedback
    attempt.actual_result = body.actual_result
    attempt.feedback_at = utcnow()

    session = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.id == session_id
    ).first()

    if body.feedback == "worked":
        session.status = "resolved"
        session.resolved_at = utcnow()
        session.final_solution = f"Resolved by: {attempt.action_title}"
        if body.actual_result:
            session.final_solution += f"\n\nDetails: {body.actual_result}"

    session.updated_at = utcnow()
    db.commit()
    db.refresh(attempt)
    return AttemptResponse.model_validate(attempt)


@router.get("/{session_id}/history", response_model=List[AttemptResponse])
def get_attempt_history(session_id: str, db: Session = Depends(get_db)):
    session = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return [AttemptResponse.model_validate(a) for a in session.attempts]


# ─── Questions ───────────────────────────────────────────────────────────────

@router.post("/{session_id}/questions", status_code=201)
def answer_question(session_id: str, question_id: str, body: QuestionAnswer, db: Session = Depends(get_db)):
    question = db.query(DiagnosticQuestion).filter(
        DiagnosticQuestion.id == question_id,
        DiagnosticQuestion.session_id == session_id,
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    question.user_answer = body.answer
    question.answered_at = utcnow()
    db.commit()
    return {"id": question.id, "answered": True}


@router.get("/{session_id}/questions", response_model=List[QuestionResponse])
def get_questions(session_id: str, db: Session = Depends(get_db)):
    questions = db.query(DiagnosticQuestion).filter(
        DiagnosticQuestion.session_id == session_id
    ).all()
    return [QuestionResponse.model_validate(q) for q in questions]


# ─── Report ──────────────────────────────────────────────────────────────────

@router.get("/{session_id}/report")
def get_session_report(session_id: str, format: str = "json", db: Session = Depends(get_db)):
    from fastapi.responses import Response
    session = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    attempts_data = [
        {
            "attempt_number": a.attempt_number,
            "action_title": a.action_title,
            "reasoning": a.reasoning,
            "user_feedback": a.user_feedback,
            "actual_result": a.actual_result,
            "confidence": a.confidence,
        }
        for a in session.attempts
    ]
    root_causes_data = [
        {
            "cause": rc.cause,
            "confidence": rc.confidence,
            "status": rc.status,
        }
        for rc in session.root_causes
    ]

    if format == "pdf":
        from app.services import generate_report_pdf
        session_dict = {
            "id": session.id,
            "title": session.title,
            "description": session.description,
            "category": session.category,
            "status": session.status,
            "error_message": session.error_message,
            "ai_understanding": session.ai_understanding,
            "final_solution": session.final_solution,
            "final_cause": session.final_cause,
            "created_at": session.created_at,
            "resolved_at": session.resolved_at,
        }
        pdf_bytes = generate_report_pdf(session_dict, attempts_data, root_causes_data)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=loopbreak-report-{session_id[:8]}.pdf"}
        )

    # JSON report
    return {
        "session": _session_response(session, db),
        "attempts": attempts_data,
        "root_causes": root_causes_data,
        "questions": [
            {"question": q.question, "answer": q.user_answer}
            for q in session.questions
        ],
    }
