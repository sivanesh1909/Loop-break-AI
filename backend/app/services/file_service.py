"""
File processing service — PDF, TXT, image extraction.
Falls back gracefully when libraries are unavailable.
"""
import os
import uuid
import logging
import mimetypes
from pathlib import Path
from typing import Optional, Tuple

from app.core.config import settings

logger = logging.getLogger("loopbreak.files")

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_MIME_TYPES = {
    "application/pdf", "text/plain",
    "image/png", "image/jpeg", "image/webp"
}


def validate_file(filename: str, content_type: str, size: int) -> Tuple[bool, str]:
    """Validate uploaded file. Returns (ok, error_message)."""
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"File type '{ext}' is not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
    if content_type and content_type not in ALLOWED_MIME_TYPES:
        return False, f"MIME type '{content_type}' is not allowed."
    if size > settings.max_upload_bytes:
        return False, f"File is too large ({size // 1024 // 1024}MB). Maximum is {settings.MAX_UPLOAD_SIZE_MB}MB."
    return True, ""


def safe_filename(original: str) -> str:
    """Generate a UUID-based safe stored filename."""
    ext = Path(original).suffix.lower()
    return f"{uuid.uuid4().hex}{ext}"


def extract_text(file_path: str, content_type: str) -> Tuple[str, str]:
    """
    Extract text from a file.
    Returns (extracted_text, status)
    status: "success" | "failed" | "unsupported" | "partial"
    """
    path = Path(file_path)
    if not path.exists():
        return "", "failed"

    ext = path.suffix.lower()

    # ── Plain Text ──────────────────────────────────────────
    if ext == ".txt":
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
            return text[:50000], "success"
        except Exception as e:
            logger.warning(f"TXT read error: {e}")
            return "", "failed"

    # ── PDF ─────────────────────────────────────────────────
    if ext == ".pdf":
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(str(path))
            pages = []
            for page in doc:
                pages.append(page.get_text())
            doc.close()
            text = "\n".join(pages)
            if text.strip():
                return text[:50000], "success"
            return "", "failed"
        except ImportError:
            logger.warning("PyMuPDF not available for PDF extraction")
            return "", "unsupported"
        except Exception as e:
            logger.warning(f"PDF extraction error: {e}")
            return "", "failed"

    # ── Images ──────────────────────────────────────────────
    if ext in {".png", ".jpg", ".jpeg", ".webp"}:
        # Try pytesseract OCR
        try:
            import pytesseract
            from PIL import Image
            img = Image.open(str(path))
            text = pytesseract.image_to_string(img)
            if text.strip():
                return text[:20000], "success"
            return "", "partial"
        except ImportError:
            logger.warning("pytesseract/Pillow not available for OCR")
        except Exception as e:
            logger.warning(f"OCR error: {e}")

        # Fallback: no text extraction
        return "", "unsupported"

    return "", "unsupported"


def delete_file(stored_path: str) -> None:
    """Safely delete an uploaded file."""
    try:
        path = Path(stored_path)
        if path.exists():
            path.unlink()
    except Exception as e:
        logger.warning(f"Could not delete file {stored_path}: {e}")

