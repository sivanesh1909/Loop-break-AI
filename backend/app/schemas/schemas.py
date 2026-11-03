from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


class SessionStatus(str, Enum):
    active = "active"
    resolved = "resolved"
    escalated = "escalated"
    draft = "draft"
    abandoned = "abandoned"


class ProblemCategory(str, Enum):
    software = "software"
    hardware = "hardware"
    network = "network"
    mobile = "mobile"
    deployment = "deployment"
    education = "education"
    other = "other"


class SessionCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=500)
    description: str = Field(..., min_length=10, max_length=5000)
    category: ProblemCategory = ProblemCategory.other
    device: Optional[str] = Field(None, max_length=200)
    operating_system: Optional[str] = Field(None, max_length=200)
    error_message: Optional[str] = Field(None, max_length=2000)
    previous_attempts_text: Optional[str] = Field(None, max_length=3000)
    is_demo: bool = False


class SessionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=500)
    status: Optional[SessionStatus] = None
    final_solution: Optional[str] = None
    final_cause: Optional[str] = None


class SessionResponse(BaseModel):
    id: str
    title: str
    description: str
    category: str
    device: Optional[str]
    operating_system: Optional[str]
    error_message: Optional[str]
    status: str
    ai_understanding: Optional[str]
    symptoms: Optional[str]
    possible_causes: Optional[str]
    final_solution: Optional[str]
    final_cause: Optional[str]
    is_demo: bool
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]
    attempt_count: int = 0
    failed_count: int = 0

    class Config:
        from_attributes = True


class AttemptCreate(BaseModel):
    action_title: str = Field(..., min_length=3, max_length=500)
    action_details: Optional[List[str]] = None
    reasoning: Optional[str] = None
    expected_outcome: Optional[str] = None
    evidence: Optional[List[str]] = None
    next_if_failed: Optional[str] = None
    risk_level: str = "low"
    effort: str = "easy"
    confidence: float = Field(0.5, ge=0.0, le=1.0)
    requires_confirmation: bool = False


class AttemptResponse(BaseModel):
    id: str
    session_id: str
    attempt_number: int
    action_title: str
    action_details: Optional[str]
    reasoning: Optional[str]
    expected_outcome: Optional[str]
    evidence: Optional[str]
    next_if_failed: Optional[str]
    risk_level: str
    effort: str
    confidence: float
    requires_confirmation: bool
    user_feedback: Optional[str]
    actual_result: Optional[str]
    created_at: datetime
    feedback_at: Optional[datetime]

    class Config:
        from_attributes = True


class FeedbackCreate(BaseModel):
    feedback: str = Field(..., pattern="^(worked|failed|partial|skipped)$")
    actual_result: Optional[str] = Field(None, max_length=2000)


class QuestionCreate(BaseModel):
    question: str = Field(..., min_length=5, max_length=1000)
    question_type: str = "text"
    options: Optional[List[str]] = None


class QuestionAnswer(BaseModel):
    answer: str = Field(..., max_length=2000)


class QuestionResponse(BaseModel):
    id: str
    session_id: str
    question: str
    question_type: str
    options: Optional[str]
    user_answer: Optional[str]
    created_at: datetime
    answered_at: Optional[datetime]

    class Config:
        from_attributes = True


class RootCauseResponse(BaseModel):
    id: str
    cause: str
    supporting_evidence: Optional[str]
    contradicting_evidence: Optional[str]
    confidence: float
    status: str
    verification_method: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class DiagnoseRequest(BaseModel):
    """Request body for the diagnose endpoint."""
    force_demo: bool = False
    answers: Optional[dict] = None  # question_id -> answer


class DiagnoseResponse(BaseModel):
    session_id: str
    ai_mode: str  # "ai" | "demo"
    understanding: Optional[str]
    questions: List[QuestionCreate]
    recommendation: Optional[dict]
    root_causes: List[dict]
    rejected_actions: List[dict] = []
    hypothesis_tree: Optional[dict] = None
    safety_flag: bool = False
    safety_message: Optional[str] = None


class DashboardStats(BaseModel):
    total_sessions: int
    active_sessions: int
    resolved_sessions: int
    total_attempts: int
    failed_attempts: int
    success_rate: float
    avg_attempts_to_resolve: float
    category_distribution: dict
    recent_sessions: List[SessionResponse]


class HealthResponse(BaseModel):
    status: str
    ai_mode: str
    ai_enabled: bool
    version: str = "1.0.0"

