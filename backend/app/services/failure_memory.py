"""
Failure Memory Service
Detects repeated or semantically equivalent recommendations.
Falls back to keyword/text matching if embeddings unavailable.
"""
import re
import json
import logging
from typing import List, Optional, Tuple
from app.core.config import settings

logger = logging.getLogger("loopbreak.failure_memory")

# Optional: sentence-transformers
_embedder = None
_embeddings_available = False

if settings.USE_EMBEDDINGS:
    try:
        from sentence_transformers import SentenceTransformer
        import numpy as np
        _embedder = SentenceTransformer(settings.EMBEDDING_MODEL)
        _embeddings_available = True
        logger.info(f"Embedding model loaded: {settings.EMBEDDING_MODEL}")
    except Exception as e:
        logger.warning(f"Sentence-transformers unavailable, using keyword fallback: {e}")


def _normalize(text: str) -> str:
    """Normalize text for comparison."""
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _keyword_similarity(a: str, b: str) -> float:
    """Simple Jaccard-like word-overlap similarity."""
    words_a = set(_normalize(a).split())
    words_b = set(_normalize(b).split())
    if not words_a or not words_b:
        return 0.0
    intersection = words_a & words_b
    union = words_a | words_b
    return len(intersection) / len(union)


def _embedding_similarity(a: str, b: str) -> float:
    """Cosine similarity using sentence-transformers."""
    try:
        import numpy as np
        embeddings = _embedder.encode([a, b])
        cos_sim = float(
            np.dot(embeddings[0], embeddings[1]) /
            (np.linalg.norm(embeddings[0]) * np.linalg.norm(embeddings[1]) + 1e-8)
        )
        return cos_sim
    except Exception as e:
        logger.warning(f"Embedding similarity failed, falling back: {e}")
        return _keyword_similarity(a, b)


def compute_similarity(text_a: str, text_b: str) -> float:
    """Compute similarity between two texts."""
    if _embeddings_available and _embedder is not None:
        return _embedding_similarity(text_a, text_b)
    return _keyword_similarity(text_a, text_b)


# Action synonyms for deterministic duplicate detection
_ACTION_SYNONYMS = [
    {"restart", "reboot", "power cycle", "reset", "turn off and on"},
    {"reinstall", "uninstall and install", "remove and install"},
    {"update", "upgrade", "latest version"},
    {"clear cache", "clear cookies", "delete cache", "empty cache"},
    {"check internet", "test connection", "verify connectivity", "ping"},
    {"run as administrator", "admin privileges", "elevated permissions"},
    {"disable firewall", "turn off firewall", "allow through firewall"},
    {"check logs", "view logs", "inspect logs", "read logs", "examine logs"},
    {"flush dns", "clear dns", "reset dns"},
    {"reinstall drivers", "update drivers", "driver update"},
]


def _has_synonym_match(action_a: str, action_b: str) -> bool:
    """Check if two actions are synonymous using predefined synonym groups."""
    norm_a = _normalize(action_a)
    norm_b = _normalize(action_b)
    for synonym_group in _ACTION_SYNONYMS:
        a_match = any(syn in norm_a for syn in synonym_group)
        b_match = any(syn in norm_b for syn in synonym_group)
        if a_match and b_match:
            return True
    return False


def is_duplicate_action(
    new_action: str,
    previous_actions: List[str],
    threshold: Optional[float] = None,
) -> Tuple[bool, Optional[str], float]:
    """
    Check if new_action is a duplicate of any previous action.

    Returns:
        (is_duplicate, matched_previous_action, similarity_score)
    """
    if not previous_actions:
        return False, None, 0.0

    t = threshold or settings.SIMILARITY_THRESHOLD

    for prev in previous_actions:
        # 1. Exact match
        if _normalize(new_action) == _normalize(prev):
            return True, prev, 1.0

        # 2. Synonym match
        if _has_synonym_match(new_action, prev):
            return True, prev, 0.9

        # 3. Similarity score
        score = compute_similarity(new_action, prev)
        if score >= t:
            return True, prev, score

    return False, None, 0.0


def find_similar_attempts(
    new_action: str,
    previous_actions: List[str],
    top_k: int = 3,
) -> List[Tuple[str, float]]:
    """Return top_k most similar previous actions with scores."""
    results = []
    for prev in previous_actions:
        score = compute_similarity(new_action, prev)
        results.append((prev, score))
    results.sort(key=lambda x: x[1], reverse=True)
    return results[:top_k]


def get_failed_action_titles(attempts: list) -> List[str]:
    """Extract action titles from failed attempts."""
    return [
        a.action_title for a in attempts
        if a.user_feedback in ("failed", "partial")
    ]

