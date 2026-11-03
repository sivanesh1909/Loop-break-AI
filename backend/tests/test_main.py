"""
LoopBreak AI Backend Tests
Run: pytest tests/ -v --tb=short
"""
import pytest
import json
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite:///./test_loopbreak.db"

import os
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["AI_MODE"] = "demo"
os.environ["GEMINI_API_KEY"] = ""

from app.main import app
from app.database.database import Base, get_db, engine as prod_engine

# Create test engine
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Create test database tables."""
    from app.models import session_model, attempt_model  # noqa
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()
    prod_engine.dispose()
    if os.path.exists("./test_loopbreak.db"):
        os.remove("./test_loopbreak.db")


@pytest.fixture
def db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ─── Health Check ────────────────────────────────────────────────────────────

def test_health_check(client):
    """Test health endpoint."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "ai_mode" in data
    assert "ai_enabled" in data


# ─── Database Initialization ─────────────────────────────────────────────────

def test_db_initialization(db):
    """Test that tables exist."""
    from app.models import TroubleshootingSession, TroubleshootingAttempt
    # Should be able to query without error
    count = db.query(TroubleshootingSession).count()
    assert count >= 0


# ─── Session CRUD ────────────────────────────────────────────────────────────

def test_create_session(client):
    """Workflow A & B: Session creation."""
    payload = {
        "title": "Test Problem",
        "description": "This is a test problem description that is long enough.",
        "category": "software",
        "device": "Test PC",
        "operating_system": "Windows 11",
    }
    resp = client.post("/api/sessions", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Test Problem"
    assert data["category"] == "software"
    assert "id" in data
    return data["id"]


def test_create_session_validation_fails(client):
    """Session with too-short description should fail."""
    payload = {"title": "X", "description": "short"}
    resp = client.post("/api/sessions", json=payload)
    assert resp.status_code == 422


def test_get_session(client):
    """Get session by ID."""
    # Create first
    payload = {
        "title": "Get Test",
        "description": "This is a description that is long enough for validation.",
        "category": "network",
    }
    create_resp = client.post("/api/sessions", json=payload)
    session_id = create_resp.json()["id"]

    resp = client.get(f"/api/sessions/{session_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == session_id


def test_get_nonexistent_session(client):
    """404 for missing session."""
    resp = client.get("/api/sessions/nonexistent-id")
    assert resp.status_code == 404


def test_list_sessions(client):
    """List sessions."""
    resp = client.get("/api/sessions")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_delete_session(client):
    """Delete a session."""
    payload = {
        "title": "Delete Me",
        "description": "This session will be deleted during testing.",
        "category": "other",
    }
    create_resp = client.post("/api/sessions", json=payload)
    session_id = create_resp.json()["id"]

    del_resp = client.delete(f"/api/sessions/{session_id}")
    assert del_resp.status_code == 204

    get_resp = client.get(f"/api/sessions/{session_id}")
    assert get_resp.status_code == 404


# ─── Attempt CRUD ────────────────────────────────────────────────────────────

def _create_test_session(client) -> str:
    payload = {
        "title": "Attempt Test Session",
        "description": "Testing attempts workflow for the troubleshooting engine.",
        "category": "software",
    }
    return client.post("/api/sessions", json=payload).json()["id"]


def test_create_attempt(client):
    """Create an attempt for a session."""
    sid = _create_test_session(client)
    payload = {
        "action_title": "Restart the application",
        "action_details": ["Close the app", "Wait 5 seconds", "Open the app"],
        "reasoning": "Restarting clears temporary state.",
        "expected_outcome": "App works after restart.",
        "risk_level": "low",
        "effort": "easy",
        "confidence": 0.7,
    }
    resp = client.post(f"/api/sessions/{sid}/attempts", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["attempt_number"] == 1
    assert data["action_title"] == "Restart the application"
    return sid, data["id"]


def test_attempt_numbering(client):
    """Attempts should increment correctly."""
    sid = _create_test_session(client)
    for i in range(3):
        payload = {
            "action_title": f"Action {i+1}",
            "description": "Test",
            "risk_level": "low",
            "effort": "easy",
            "confidence": 0.5,
        }
        resp = client.post(f"/api/sessions/{sid}/attempts", json=payload)
        assert resp.json()["attempt_number"] == i + 1


def test_submit_feedback_failed(client):
    """Workflow A: Mark attempt as failed."""
    sid = _create_test_session(client)
    attempt_payload = {
        "action_title": "Clear browser cache",
        "risk_level": "low",
        "effort": "easy",
        "confidence": 0.6,
    }
    attempt_resp = client.post(f"/api/sessions/{sid}/attempts", json=attempt_payload)
    attempt_id = attempt_resp.json()["id"]

    feedback_payload = {"feedback": "failed", "actual_result": "Cache cleared but problem persists."}
    resp = client.post(f"/api/sessions/{sid}/attempts/{attempt_id}/feedback", json=feedback_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_feedback"] == "failed"


def test_feedback_submission_is_idempotent(client):
    """Repeating the same feedback is safe if a client retries its request."""
    sid = _create_test_session(client)
    attempt_resp = client.post(f"/api/sessions/{sid}/attempts", json={
        "action_title": "Check application logs",
    })
    attempt_id = attempt_resp.json()["id"]
    feedback_payload = {"feedback": "failed", "actual_result": "The error persists."}

    first_resp = client.post(
        f"/api/sessions/{sid}/attempts/{attempt_id}/feedback",
        json=feedback_payload,
    )
    retry_resp = client.post(
        f"/api/sessions/{sid}/attempts/{attempt_id}/feedback",
        json=feedback_payload,
    )

    assert first_resp.status_code == 200
    assert retry_resp.status_code == 200
    assert retry_resp.json()["feedback_at"] == first_resp.json()["feedback_at"]


def test_feedback_cannot_be_changed_after_submission(client):
    """A submitted attempt outcome remains part of the troubleshooting history."""
    sid = _create_test_session(client)
    attempt_resp = client.post(f"/api/sessions/{sid}/attempts", json={
        "action_title": "Check application logs",
    })
    attempt_id = attempt_resp.json()["id"]
    feedback_url = f"/api/sessions/{sid}/attempts/{attempt_id}/feedback"

    client.post(feedback_url, json={"feedback": "failed"})
    resp = client.post(feedback_url, json={"feedback": "worked"})

    assert resp.status_code == 409


def test_cannot_create_attempt_for_resolved_session(client):
    """Resolved sessions cannot accumulate contradictory new attempts."""
    sid = _create_test_session(client)
    attempt_resp = client.post(f"/api/sessions/{sid}/attempts", json={
        "action_title": "Restart the application",
    })
    attempt_id = attempt_resp.json()["id"]
    client.post(
        f"/api/sessions/{sid}/attempts/{attempt_id}/feedback",
        json={"feedback": "worked"},
    )

    resp = client.post(f"/api/sessions/{sid}/attempts", json={
        "action_title": "Inspect application logs",
    })

    assert resp.status_code == 409


def test_submit_feedback_worked(client):
    """Workflow B: Mark attempt as successful."""
    sid = _create_test_session(client)
    attempt_payload = {
        "action_title": "Update the driver",
        "risk_level": "low",
        "effort": "medium",
        "confidence": 0.8,
    }
    attempt_resp = client.post(f"/api/sessions/{sid}/attempts", json=attempt_payload)
    attempt_id = attempt_resp.json()["id"]

    feedback_payload = {"feedback": "worked", "actual_result": "Driver updated, issue resolved!"}
    resp = client.post(f"/api/sessions/{sid}/attempts/{attempt_id}/feedback", json=feedback_payload)
    assert resp.status_code == 200

    # Session should now be resolved
    session_resp = client.get(f"/api/sessions/{sid}")
    assert session_resp.json()["status"] == "resolved"


def test_attempt_history(client):
    """Get full attempt history."""
    sid = _create_test_session(client)
    for i in range(2):
        client.post(f"/api/sessions/{sid}/attempts", json={
            "action_title": f"Step {i+1}", "risk_level": "low", "effort": "easy", "confidence": 0.5
        })

    resp = client.get(f"/api/sessions/{sid}/history")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


# ─── Failure Memory / Duplicate Detection ────────────────────────────────────

def test_duplicate_detection_exact():
    """Workflow D: Detect exact duplicate action."""
    from app.services.failure_memory import is_duplicate_action
    failed = ["Restart the router", "Clear DNS cache"]
    is_dup, matched, score = is_duplicate_action("Restart the router", failed)
    assert is_dup is True
    assert score == 1.0


def test_duplicate_detection_synonym():
    """Detect synonymous actions."""
    from app.services.failure_memory import is_duplicate_action
    failed = ["Restart the router"]
    is_dup, matched, score = is_duplicate_action("Power cycle your Wi-Fi router", failed)
    assert is_dup is True  # Synonym detection: restart ≈ power cycle


def test_duplicate_detection_different():
    """Different actions should not be flagged as duplicates."""
    from app.services.failure_memory import is_duplicate_action
    failed = ["Restart the router"]
    is_dup, _, _ = is_duplicate_action("Check the firewall settings", failed)
    assert is_dup is False


def test_similarity_score():
    """Test similarity scoring."""
    from app.services.failure_memory import compute_similarity
    score_same = compute_similarity("restart the router", "restart the router")
    score_diff = compute_similarity("restart the router", "check the weather forecast")
    assert score_same > score_diff
    assert score_same >= 0.9


# ─── Demo Mode ───────────────────────────────────────────────────────────────

def test_demo_scenarios_list(client):
    """Workflow C: List demo scenarios."""
    resp = client.get("/api/demo/scenarios")
    assert resp.status_code == 200
    data = resp.json()
    assert "scenarios" in data
    assert len(data["scenarios"]) >= 5


def test_load_demo_scenario(client):
    """Workflow C: Load a demo scenario without API key."""
    resp = client.post("/api/demo/load?scenario_key=wifi_connectivity")
    assert resp.status_code == 200
    data = resp.json()
    assert "session_id" in data
    assert data["mode"] == "demo"


def test_demo_diagnose(client):
    """Workflow C: Run demo diagnosis without API key."""
    # Create a session
    payload = {
        "title": "Wi-Fi not working",
        "description": "My laptop cannot connect to Wi-Fi. Shows no internet access.",
        "category": "network",
        "is_demo": True,
    }
    create_resp = client.post("/api/sessions", json=payload)
    sid = create_resp.json()["id"]

    # Diagnose in demo mode
    diagnose_resp = client.post(f"/api/sessions/{sid}/diagnose", json={"force_demo": True})
    assert diagnose_resp.status_code == 200
    data = diagnose_resp.json()
    assert data["ai_mode"] == "demo"
    assert "understanding" in data


# ─── File Validation ─────────────────────────────────────────────────────────

def test_file_validation_unsupported():
    """Workflow F: Unsupported file type rejected."""
    from app.services.file_service import validate_file
    ok, error = validate_file("malware.exe", "application/octet-stream", 1024)
    assert ok is False
    assert "not supported" in error.lower()


def test_file_validation_too_large():
    """File too large should fail."""
    from app.services.file_service import validate_file
    big_size = 20 * 1024 * 1024  # 20MB
    ok, error = validate_file("log.txt", "text/plain", big_size)
    assert ok is False
    assert "large" in error.lower()


def test_file_validation_ok():
    """Valid file should pass."""
    from app.services.file_service import validate_file
    ok, error = validate_file("log.txt", "text/plain", 1024)
    assert ok is True


# ─── Safety Checks ───────────────────────────────────────────────────────────

def test_safety_check_dangerous():
    """AI safety check blocks dangerous requests."""
    from app.services.ai_service import _check_safety
    is_safe, msg = _check_safety("how to bypass security and hack the system")
    assert is_safe is False
    assert msg is not None


def test_safety_check_normal():
    """Normal technical problems pass safety check."""
    from app.services.ai_service import _check_safety
    is_safe, msg = _check_safety("My npm build is failing with exit code 1")
    assert is_safe is True


# ─── Dashboard Stats ─────────────────────────────────────────────────────────

def test_dashboard_stats(client):
    """Dashboard stats endpoint returns real data."""
    resp = client.get("/api/dashboard/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_sessions" in data
    assert "active_sessions" in data
    assert "resolved_sessions" in data
    assert isinstance(data["category_distribution"], dict)


# ─── Report ──────────────────────────────────────────────────────────────────

def test_json_report(client):
    """Get JSON report for a session."""
    payload = {
        "title": "Report Test Session",
        "description": "Testing the report generation endpoint for this session.",
        "category": "software",
    }
    sid = client.post("/api/sessions", json=payload).json()["id"]
    resp = client.get(f"/api/sessions/{sid}/report")
    assert resp.status_code == 200
    data = resp.json()
    assert "session" in data
    assert "attempts" in data


def test_ai_unavailable_fallback(client):
    """Workflow E: AI unavailable → demo fallback."""
    # Since AI_MODE=demo in tests, this always falls back
    payload = {
        "title": "AI fallback test",
        "description": "Testing that the application gracefully handles missing AI key.",
        "category": "software",
        "is_demo": True,
    }
    sid = client.post("/api/sessions", json=payload).json()["id"]
    resp = client.post(f"/api/sessions/{sid}/diagnose", json={"force_demo": True})
    assert resp.status_code == 200
    data = resp.json()
    # Should return demo mode response, not crash
    assert data["ai_mode"] == "demo"
    assert data["understanding"] is not None


def test_demo_reset(client):
    """Demo reset clears demo sessions."""
    # Load a demo
    client.post("/api/demo/load?scenario_key=python_dependency")
    # Reset
    resp = client.post("/api/demo/reset")
    assert resp.status_code == 200
    assert resp.json()["deleted_sessions"] >= 0
