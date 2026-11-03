import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, Float, Integer, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database.database import Base


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def gen_uuid():
    return str(uuid.uuid4())


class TroubleshootingAttempt(Base):
    __tablename__ = "troubleshooting_attempts"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    session_id = Column(String(36), ForeignKey("troubleshooting_sessions.id", ondelete="CASCADE"), nullable=False)
    attempt_number = Column(Integer, nullable=False)
    action_title = Column(String(500), nullable=False)
    action_details = Column(Text, nullable=True)  # JSON instructions list
    reasoning = Column(Text, nullable=True)
    expected_outcome = Column(Text, nullable=True)
    evidence = Column(Text, nullable=True)  # JSON list
    next_if_failed = Column(Text, nullable=True)
    risk_level = Column(String(20), default="low")
    effort = Column(String(20), default="easy")
    confidence = Column(Float, default=0.5)
    requires_confirmation = Column(Boolean, default=False)
    user_feedback = Column(String(50), nullable=True)  # worked | failed | partial | skipped
    actual_result = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    feedback_at = Column(DateTime, nullable=True)

    session = relationship("TroubleshootingSession", back_populates="attempts")


class DiagnosticQuestion(Base):
    __tablename__ = "diagnostic_questions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    session_id = Column(String(36), ForeignKey("troubleshooting_sessions.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    question_type = Column(String(50), default="text")  # text | yes_no | multiple_choice
    options = Column(Text, nullable=True)  # JSON list for MC
    user_answer = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    answered_at = Column(DateTime, nullable=True)

    session = relationship("TroubleshootingSession", back_populates="questions")


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    session_id = Column(String(36), ForeignKey("troubleshooting_sessions.id", ondelete="CASCADE"), nullable=False)
    original_filename = Column(String(500), nullable=False)
    stored_filename = Column(String(500), nullable=False)
    content_type = Column(String(100), nullable=True)
    file_size = Column(Integer, default=0)
    extracted_text = Column(Text, nullable=True)
    extraction_status = Column(String(50), default="pending")  # pending | success | failed | unsupported
    created_at = Column(DateTime, default=utcnow)

    session = relationship("TroubleshootingSession", back_populates="files")


class RootCauseHypothesis(Base):
    __tablename__ = "root_cause_hypotheses"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    session_id = Column(String(36), ForeignKey("troubleshooting_sessions.id", ondelete="CASCADE"), nullable=False)
    cause = Column(Text, nullable=False)
    supporting_evidence = Column(Text, nullable=True)  # JSON list
    contradicting_evidence = Column(Text, nullable=True)  # JSON list
    confidence = Column(Float, default=0.5)
    status = Column(String(50), default="hypothesis")  # hypothesis | probable | confirmed | ruled_out
    verification_method = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    session = relationship("TroubleshootingSession", back_populates="root_causes")

