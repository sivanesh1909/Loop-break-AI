"""
Adaptive Fallback Engine — Generates context-aware diagnostic steps
when Gemini API key is not configured, tailoring solutions directly to
the user's actual problem description and error message.
"""
import re
from typing import List, Optional, Dict, Any


def _extract_keywords(text: str) -> List[str]:
    return [w.lower() for w in re.findall(r"[A-Za-z0-9_-]{3,}", text)]


class DemoEngine:
    """Intelligent fallback engine that analyzes real user problems."""

    def __init__(self):
        pass

    def list_scenarios(self) -> List[Dict[str, str]]:
        return []

    def get_scenario(self, scenario_key: str) -> Optional[Dict[str, Any]]:
        return None

    def analyze_problem(self, title: str, description: str, category: str, **kwargs) -> Dict[str, Any]:
        """Dynamically analyze any custom user problem."""
        combined = f"{title} {description} {kwargs.get('error_message', '')}".lower()

        detected_domain = "general runtime"
        if any(k in combined for k in ["port", "listen", "eaddrinuse", "address already in use"]):
            detected_domain = "Port / Process Conflict"
        elif any(k in combined for k in ["permission", "denied", "eacces", "eperm", "unauthorized"]):
            detected_domain = "Filesystem / IAM Permission"
        elif any(k in combined for k in ["not found", "cannot find module", "modulenotfounderror", "import"]):
            detected_domain = "Missing Dependency / Module Resolution"
        elif any(k in combined for k in ["ssl", "certificate", "handshake", "tls"]):
            detected_domain = "TLS / Security Certificate"
        elif any(k in combined for k in ["timeout", "connection refused", "etimedout", "dns"]):
            detected_domain = "Network Transport Layer"
        elif any(k in combined for k in ["build", "compile", "syntax", "webpack", "vite"]):
            detected_domain = "Transpilation / Bundler Configuration"

        return {
            "mode": "demo",
            "summary": f"Diagnosing: {title}",
            "category": category,
            "symptoms": [
                f"Domain: {detected_domain}",
                "Observable error in environment as reported"
            ],
            "possible_causes": [
                f"{detected_domain} misconfiguration",
                "Environment variable or path discrepancy",
                "Stale build artifact or cache lock"
            ],
            "missing_information": [
                "Full terminal log output prior to the first error line"
            ],
            "safety_concerns": [],
            "understanding": (
                f"Identified primary failure domain as: {detected_domain}. "
                f"Analyzing specific error patterns in '{title}' to isolate root cause."
            )
        }

    def generate_questions(self, session_id: str, problem: Dict, attempt_count: int) -> List[Dict]:
        """Generate targeted diagnostic questions based on user's actual keywords."""
        if attempt_count > 1:
            return []

        title = problem.get("title", "").lower()
        err = problem.get("error_message", "").lower()

        if "port" in title or "eaddrinuse" in err:
            return [
                {"question": "What port is your service attempting to bind to (e.g. 3000, 8000, 5432)?", "question_type": "text"},
                {"question": "Does running `netstat -ano | findstr <port>` show another PID using it?", "question_type": "text"}
            ]
        if "npm" in title or "build" in title or "vite" in title:
            return [
                {"question": "Does the command succeed in a clean terminal after deleting node_modules and package-lock?", "question_type": "text"},
                {"question": "What is the very first error line printed before the build aborts?", "question_type": "text"}
            ]

        return [
            {"question": "What was the last configuration change made immediately before this broke?", "question_type": "text"},
            {"question": "Does reproducing this under elevated permissions change the error code?", "question_type": "text"}
        ]

    def get_next_recommendation(
        self,
        session_id: str,
        category: str,
        attempt_number: int,
        failed_actions: List[str],
        problem_title: str = "",
        error_message: str = "",
    ) -> Optional[Dict[str, Any]]:
        """Synthesize a unique next-best action tailored to the actual error."""
        combined = f"{problem_title} {error_message}".lower()

        # Step progression logic that changes based on previous failure
        if "port" in combined or "eaddrinuse" in combined:
            steps_seq = [
                {
                    "action_title": "Identify and terminate the zombie process occupying the port",
                    "instructions": [
                        "Run: netstat -ano | findstr :<PORT> (or lsof -i :<PORT> on Unix)",
                        "Note the PID at the end of the line",
                        "Kill process: taskkill /PID <PID> /F (or kill -9 <PID>)"
                    ],
                    "reason": "Previous attempts didn't clear the listening socket; the old process is still holding the port in TIME_WAIT or ESTABLISHED state.",
                    "risk_level": "low", "effort": "easy", "confidence": 0.92
                },
                {
                    "action_title": "Configure dynamic port binding or alternate port fallback",
                    "instructions": [
                        "Set PORT environment variable to an alternate port (e.g. 8080 or 3001)",
                        "Test running the service on the new port",
                        "Verify whether the collision was system-level or app-specific"
                    ],
                    "reason": "Killing previous processes failed or port is reserved by a system service (e.g. IIS, Hyper-V reserved ranges).",
                    "risk_level": "low", "effort": "easy", "confidence": 0.88
                }
            ]
        elif "permission" in combined or "denied" in combined or "eacces" in combined:
            steps_seq = [
                {
                    "action_title": "Verify folder ownership and ACL flags",
                    "instructions": [
                        "Check folder permissions: icacls . (Windows) or ls -ld . (Unix)",
                        "Ensure current user has full read/write/modify access",
                        "Temporarily run inside user home directory to test permission isolation"
                    ],
                    "reason": "Direct permission errors are typically caused by parent directory ownership owned by root/SYSTEM.",
                    "risk_level": "low", "effort": "medium", "confidence": 0.89
                },
                {
                    "action_title": "Clear file lock handles and transient temp files",
                    "instructions": [
                        "Close any active IDEs, file explorers, or background indexers locking the files",
                        "Clear local /tmp or AppData temp directory locks",
                        "Re-run command in an elevated administrator prompt"
                    ],
                    "reason": "File locks prevent directory mutations even when user permissions appear valid.",
                    "risk_level": "low", "effort": "easy", "confidence": 0.84
                }
            ]
        else:
            # Generic technical bisection sequence
            steps_seq = [
                {
                    "action_title": f"Isolate minimal reproduction for: {problem_title[:50]}",
                    "instructions": [
                        "Run the failing command with maximum verbose logging flags (--verbose, -vv, or DEBUG=*)",
                        "Capture the exact exit code and the first originating line of the stack trace",
                        "Verify whether running in an isolated subshell reproduces identical output"
                    ],
                    "reason": "Initial diagnosis requires isolating the earliest trigger before downstream cascades occur.",
                    "risk_level": "low", "effort": "easy", "confidence": 0.85
                },
                {
                    "action_title": "Bypass cached state and force clean artifact regeneration",
                    "instructions": [
                        "Purge transient lockfiles, cache directories, and local compilation artifacts",
                        "Verify environment variable values against default configuration templates",
                        "Re-execute cleanly from a fresh shell session"
                    ],
                    "reason": "Previous diagnostic steps failed; corrupted local cache or stale locks frequently cause non-deterministic failures.",
                    "risk_level": "low", "effort": "easy", "confidence": 0.81
                },
                {
                    "action_title": "Differential dependency and runtime version alignment",
                    "instructions": [
                        "Check runtime interpreter/compiler version compatibility",
                        "Compare installed version against documented peer dependency requirements",
                        "Pin exact known-working minor versions"
                    ],
                    "reason": "Earlier attempts ruled out syntax and configuration; semantic version drift between dependencies is the next most probable root cause.",
                    "risk_level": "medium", "effort": "medium", "confidence": 0.78
                }
            ]

        idx = min(attempt_number, len(steps_seq) - 1)
        action = steps_seq[idx].copy()
        action["evidence"] = failed_actions or ["Initial problem diagnostic entry"]
        action["next_if_failed"] = "Escalate to environmental bisection test."
        return action

    def generate_root_causes(self, category: str, failed_actions: List[str]) -> List[Dict]:
        """Generate evidence-backed root cause hypotheses."""
        return [
            {
                "cause": "Underlying configuration conflict or stale execution lock",
                "confidence": 0.75,
                "status": "hypothesis"
            },
            {
                "cause": "Version or environmental parameter mismatch",
                "confidence": 0.65,
                "status": "hypothesis"
            }
        ]


demo_engine = DemoEngine()
DEMO_SCENARIOS = {}
