import os
import uuid
import logging
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import UploadedFile as UploadedFileModel, TroubleshootingSession
from app.services import validate_file, safe_filename, extract_text
from app.core.config import settings

router = APIRouter(prefix="/files", tags=["files"])
logger = logging.getLogger("loopbreak.files")


@router.post("/upload")
async def upload_file(
    session_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # Verify session exists
    session = db.query(TroubleshootingSession).filter(
        TroubleshootingSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Read file content
    content = await file.read()
    size = len(content)
    content_type = file.content_type or ""

    # Validate
    ok, error = validate_file(file.filename or "unnamed", content_type, size)
    if not ok:
        raise HTTPException(status_code=400, detail=error)

    # Store with safe filename
    stored_name = safe_filename(file.filename or "upload.bin")
    upload_path = Path(settings.UPLOAD_DIR) / stored_name
    upload_path.parent.mkdir(parents=True, exist_ok=True)

    with open(upload_path, "wb") as f:
        f.write(content)

    # Extract text
    extracted_text, extraction_status = extract_text(str(upload_path), content_type)

    # Save to DB
    db_file = UploadedFileModel(
        session_id=session_id,
        original_filename=file.filename or "upload",
        stored_filename=stored_name,
        content_type=content_type,
        file_size=size,
        extracted_text=extracted_text or None,
        extraction_status=extraction_status,
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    return {
        "id": db_file.id,
        "filename": db_file.original_filename,
        "size": size,
        "content_type": content_type,
        "extraction_status": extraction_status,
        "extracted_length": len(extracted_text) if extracted_text else 0,
        "message": (
            "File uploaded and text extracted successfully."
            if extraction_status == "success"
            else f"File uploaded. Extraction status: {extraction_status}. Please provide relevant content manually if needed."
        )
    }

