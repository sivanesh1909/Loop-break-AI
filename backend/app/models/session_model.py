import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, DateTime, Float, Integer,
    ForeignKey, Enum as SQLEnum, Boolean
)
from sqlalchemy.orm import relationship
from app.database.database import Base
import enum


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def gen_uuid():
    return str(uuid.uuid4())


class SessionStatus(str, enum.Enum):
    active = "active"
    resolved = "resolved"
    escalated = "escalated"
    draft = "draft"
    abandoned = "abandoned"


class ProblemCategory(str, enum.Enum):
    software = "software"
    hardware = "hardware"
    network = "network"
    mobile = "mobile"
    deployment = "deployment"
    education = "education"
    other = "other"


class TroubleshootingSession(Base):
    __tablename__ = "troubleshooting_sessions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), default="other")
    device = Column(String(200), nullable=True)
    operating_system = Column(String(200), nullable=True)
    error_message = Column(Text, nullable=True)
    status = Column(String(20), default="active")
    ai_understanding = Column(Text, nullable=True)
    symptoms = Column(Text, nullable=True)  # JSON string
    possible_causes = Column(Text, nullable=True)  # JSON string
    final_solution = Column(Text, nullable=True)
    final_cause = Column(Text, nullable=True)
    is_demo = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    resolved_at = Column(DateTime, nullable=True)

    attempts = relationship("TroubleshootingAttempt", back_populates="session", cascade="all, delete-orphan", order_by="TroubleshootingAttempt.attempt_number")
    questions = relationship("DiagnosticQuestion", back_populates="session", cascade="all, delete-orphan")
    files = relationship("UploadedFile", back_populates="session", cascade="all, delete-orphan")
    root_causes = relationship("RootCauseHypothesis", back_populates="session", cascade="all, delete-orphan")

