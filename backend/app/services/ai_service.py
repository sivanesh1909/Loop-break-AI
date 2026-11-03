"""
Gemini AI Service — Structured troubleshooting intelligence.
Uses google-genai SDK with strict JSON output and first-principles diagnostic reasoning.
"""
import json
import asyncio
import logging
from typing import Dict, List, Any, Optional

from app.core.config import settings
from app.core.logging import logger

# Gemini client (initialized lazily)
_client = None
_client_error: Optional[str] = None


def _get_client():
    global _client, _client_error
    if _client is not None:
        return _client
    if not settings.GEMINI_API_KEY:
        _client_error = "No GEMINI_API_KEY configured."
        return None
    try:
        from google import genai
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
        logger.info(f"Gemini client initialized with model: {settings.GEMINI_MODEL}")
        return _client
    except Exception as e:
        _client_error = str(e)
        logger.error(f"Failed to initialize Gemini client: {e}")
        return None


SAFETY_KEYWORDS = [
    "electrical wiring", "gas line", "gas pipe", "medical diagnosis",
    "prescribe medication", "surgery", "explosive", "dangerous chemical",
    "acid", "unauthorized access", "hack", "bypass security",
    "delete all data", "format drive", "ddos",
]


def _check_safety(text: str) -> tuple[bool, Optional[str]]:
    """Return (is_safe, warning_message)."""
    lower = text.lower()
    for kw in SAFETY_KEYWORDS:
        if kw in lower:
            return False, (
                f"⚠️ Safety Notice: This request involves potentially dangerous operations ({kw}). "
                "LoopBreak AI strictly refuses guidance on hazardous physical systems, medical intervention, "
                "destructive disk wipes, or security exploits. Please escalate to a qualified professional."
            )
    return True, None


def _parse_json_response(text: str) -> Optional[Dict]:
    """Parse JSON from AI response with multiple robust extraction strategies."""
    if not text:
        return None
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    import re
    # Extract from markdown code block ```json ... ```
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Find outermost curly braces
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end+1].strip())
        except json.JSONDecodeError:
            pass

    return None


async def _call_gemini(prompt: str, system: str, max_retries: int = 3) -> Optional[str]:
    """Call Gemini API with exponential backoff retry."""
    client = _get_client()
    if not client:
        return None

    from google.genai import types

    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    temperature=0.25,
                    max_output_tokens=2500,
                ),
            )
            if response and response.text:
                return response.text
        except Exception as e:
            wait = 2 ** attempt
            logger.warning(f"Gemini attempt {attempt+1} failed: {e}. Retrying in {wait}s...")
            if attempt < max_retries - 1:
                await asyncio.sleep(wait)
            else:
                logger.error(f"All Gemini retries exhausted: {e}")
                return None
    return None


# ─── High-Leverage System Prompts ───────────────────────────────────────────

SYSTEM_UNDERSTAND = """You are LoopBreak AI — an elite technical diagnostics specialist and system architect.
Analyze the user's issue with surgical clarity. Identify the failure domain (e.g. Kernel, Network Layer 3/4/7, Auth/IAM, Dependency Resolver, Syntax/Transpiler, Filesystem Permissions, Race Condition).

Return ONLY valid JSON matching this schema:
{
  "summary": "Crisp, technically accurate one-sentence summary of the core failure",
  "category": "software|hardware|network|mobile|deployment|education|other",
  "device": "Identified device or environment",
  "symptoms": ["Observable symptom 1", "Observable symptom 2"],
  "error_indicators": ["Specific error codes or patterns identified"],
  "possible_causes": ["High-probability technical cause 1", "Secondary technical cause 2"],
  "missing_information": ["Critical missing context that would confirm root cause"],
  "safety_concerns": [],
  "understanding": "Clear 2-3 sentence technical analysis explaining the likely mechanism of failure."
}"""

SYSTEM_QUESTIONS = """You are LoopBreak AI. Generate up to 2 high-impact diagnostic questions that bisect the problem space.
Do NOT ask trivial questions like 'Have you restarted?'.
Ask for specific test outcomes, log lines, or environmental constants that immediately rule out 50% of possible root causes.

Return ONLY valid JSON:
{
  "questions": [
    {"question": "Specific, actionable diagnostic question", "question_type": "text"}
  ]
}"""

SYSTEM_RECOMMEND = """You are LoopBreak AI — the system that "Learns From What Didn't Work."
Your primary purpose is to formulate the next SINGLE MOST DECISIVE action to solve or isolate the problem.

CRITICAL RULES:
1. ZERO REPEATS: Review every item in FAILED ACTIONS. You are strictly forbidden from recommending the same action, a semantic synonym, or an action belonging to a hypothesis already invalidated by previous failures.
2. NO GENERIC FLUFF: Do NOT say "restart your router", "check your internet", "reinstall node", or "check logs" unless accompanied by the EXACT command, file path, flag, or specific line to inspect.
3. SURGICAL ISOLATION: Prefer an action that conducts an elimination test (proves whether the fault lies in Component A vs Component B in under 60 seconds).
4. REVERSIBLE FIRST: Prioritize non-destructive diagnostic probes before modifying system state.
5. TAILORED COMMANDS: Provide copy-pasteable terminal commands matching the user's specified OS/environment.

Return ONLY valid JSON:
{
  "action_title": "Action title (max 75 chars, imperative, specific)",
  "instructions": [
    "Step 1: Specific command or exact UI path",
    "Step 2: Expected output or what to look for",
    "Step 3: What to note if it fails"
  ],
  "reason": "Explicit justification explaining why this action is selected based on why previous attempts failed.",
  "evidence": [
    "Evidence point from attempt history or error message",
    "Logical deduction ruling out previous failed path"
  ],
  "expected_outcome": "The exact indicator that confirms this worked or pinpointed the cause",
  "risk_level": "low|medium|high",
  "effort": "easy|medium|hard",
  "confidence": 0.85,
  "requires_confirmation": false,
  "next_if_failed": "What specific diagnostic path opens if this step fails",
  "needs_expert": false
}"""

SYSTEM_ROOT_CAUSE = """You are LoopBreak AI. Synthesize the attempt history and formulate grounded root-cause hypotheses.
Never declare an unverified guess as a 'confirmed' fact. Mark statuses accurately:
- 'hypothesis': plausible but untested
- 'probable': supported by multiple failed negative tests
- 'confirmed': verified by positive remediation
- 'ruled_out': definitively disproven by an attempt outcome

Return ONLY valid JSON:
{
  "root_causes": [
    {
      "cause": "Specific technical root cause description",
      "supporting_evidence": ["Evidence 1 from test/error"],
      "contradicting_evidence": [],
      "confidence": 0.80,
      "status": "hypothesis|probable|confirmed|ruled_out",
      "verification_method": "How to definitively verify this cause"
    }
  ]
}"""

SYSTEM_FINAL_SUMMARY = """You are LoopBreak AI. Summarize the successful troubleshooting resolution.
Return ONLY valid JSON:
{
  "final_solution": "Concise statement of the working fix",
  "confirmed_cause": "The verified root cause (or 'Verified via empirical fix' if implied)",
  "lessons_learned": ["Actionable preventive lesson 1", "Lesson 2"],
  "summary": "Brief professional post-mortem explaining how the problem was diagnosed and resolved.",
  "prevention_tips": ["Concrete tip to prevent recurrence"]
}"""


# ─── Public AI Functions ─────────────────────────────────────────────────────

async def understand_problem(
    title: str, description: str, category: str,
    error_message: str = "", device: str = "", os_name: str = ""
) -> Dict[str, Any]:
    """Step 1: Deep problem analysis."""
    is_safe, warning = _check_safety(description + " " + error_message)
    if not is_safe:
        return {"safety_flag": True, "safety_message": warning, "understanding": warning}

    prompt = f"""Problem Title: {title}
Description: {description}
Category: {category}
Device/Host: {device or 'Standard'}
OS: {os_name or 'Unspecified'}
Error Output / Trace: {error_message or 'No direct trace provided'}

Perform an architectural root-cause pre-analysis and return the structured JSON."""

    text = await _call_gemini(prompt, SYSTEM_UNDERSTAND)
    if not text:
        return {
            "summary": title,
            "category": category,
            "symptoms": [description[:250]],
            "possible_causes": ["AI provider unreachable — using local diagnostic heuristic."],
            "understanding": f"Analyzing '{title}' using local diagnostic patterns.",
            "missing_information": [],
            "safety_concerns": [],
            "ai_error": True
        }

    result = _parse_json_response(text)
    if not result:
        return {
            "summary": title,
            "category": category,
            "understanding": text[:500],
            "symptoms": [],
            "possible_causes": [],
            "parse_error": True
        }
    return result


async def generate_questions(
    problem: Dict, answered_questions: List[str], attempt_count: int
) -> List[Dict]:
    """Step 2: Generate decisive diagnostic questions."""
    if attempt_count > 2:
        return []

    answered_str = "\n".join(f"- {q}" for q in answered_questions) if answered_questions else "None yet"
    prompt = f"""Problem: {problem.get('summary', problem.get('title', 'Unknown'))}
Category: {problem.get('category', 'other')}
Understanding: {problem.get('understanding', 'Not analyzed yet')}
Already Answered:
{answered_str}

Formulate up to 2 high-impact bisection questions."""

    text = await _call_gemini(prompt, SYSTEM_QUESTIONS)
    if not text:
        return []
    result = _parse_json_response(text)
    if result and "questions" in result:
        return result["questions"][:2]
    return []


async def generate_recommendation(
    problem: Dict,
    attempts: List[Dict],
    answered_questions: List[Dict],
    failed_actions: List[str],
) -> Optional[Dict]:
    """Step 4 & 5: Generate next unique best action."""
    failed_str = "\n".join(f"- {a}" for a in failed_actions) if failed_actions else "None yet (Attempt 1)"
    attempts_str = json.dumps(attempts[-4:], indent=2) if attempts else "[]"
    qa_str = "\n".join(
        f"Q: {q.get('question', '')} -> A: {q.get('user_answer', 'Not answered')}"
        for q in answered_questions
    ) if answered_questions else "None"

    prompt = f"""PROBLEM CONTEXT:
Title: {problem.get('title', problem.get('summary', 'Unknown'))}
Category: {problem.get('category', 'other')}
Device/Env: {problem.get('device', 'Unknown')}
OS: {problem.get('operating_system', 'Unknown')}
Error Trace: {problem.get('error_message', 'None provided')}

FAILED ACTIONS (INVALIDATED PATHS — DO NOT SUGGEST OR REPEAT):
{failed_str}

DIAGNOSTIC EVIDENCE COLLECTED:
{qa_str}

PREVIOUS ATTEMPTS:
{attempts_str}

TASK:
Determine what failed hypothesis is now disproven, shift to the next most probable failure layer, and prescribe ONE concrete, unique, actionable next step with copy-paste commands."""

    text = await _call_gemini(prompt, SYSTEM_RECOMMEND)
    if not text:
        return None
    return _parse_json_response(text)


async def analyze_root_causes(problem: Dict, attempts: List[Dict]) -> List[Dict]:
    """Step 7: Root cause analysis based on cumulative evidence."""
    attempts_str = json.dumps(attempts, indent=2) if attempts else "[]"
    prompt = f"""Problem: {problem.get('summary', problem.get('title', 'Unknown'))}
Category: {problem.get('category', 'other')}

Full Attempt History:
{attempts_str}

Analyze which causes are ruled out by the failed attempts and which cause is most probable."""

    text = await _call_gemini(prompt, SYSTEM_ROOT_CAUSE)
    if not text:
        return []
    result = _parse_json_response(text)
    if result and "root_causes" in result:
        return result["root_causes"]
    return []


async def generate_final_summary(problem: Dict, attempts: List[Dict], solution: str) -> Dict:
    """Step 8: Generate resolution post-mortem."""
    attempts_str = json.dumps(attempts, indent=2)
    prompt = f"""Problem: {problem.get('summary', problem.get('title', 'Unknown'))}
Successful Solution: {solution}
Attempt History:
{attempts_str}

Generate final summary."""

    text = await _call_gemini(prompt, SYSTEM_FINAL_SUMMARY)
    if not text:
        return {"final_solution": solution, "summary": f"Problem successfully resolved via: {solution}"}
    result = _parse_json_response(text)
    return result or {"final_solution": solution, "summary": "Problem resolved."}


def is_ai_available() -> bool:
    """Check if AI is available without blocking."""
    return settings.is_ai_enabled and bool(settings.GEMINI_API_KEY)
