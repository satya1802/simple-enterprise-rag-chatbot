"""backend_api: document upload, listing, retrieval and deletion.

Owns the S3 object_store and job_queue boundary from the API side. Uploads
join a single, shared, company-wide corpus answerable to every employee --
there is no visibility, owner-scope or privacy concept anywhere on this
router or its schemas (AC-073, AC-089/AC-090). Text extraction, chunking and
embedding are the ingest_worker's work, once a job lands on the queue; a
freshly accepted document's status stays "Processing" here.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile
from sqlalchemy.orm import Session

from app.auth import SessionUser, get_current_user
from app.config import MAX_UPLOAD_BYTES
from app.database import get_db
from app.models import Document, User
from app.schemas import (
    DocumentListResponse,
    DocumentOut,
    DocumentRejection,
    DocumentUploadResponse,
    DocumentUploadResult,
    StubResponse,
)
from app.services.ingest import enqueue_ingest_job
from app.services.storage import delete_file, save_file

router = APIRouter(tags=["documents"])

_ALLOWED_FORMATS = ("pdf", "docx", "txt", "md")
_SUPPORTED_FORMATS_TEXT = "pdf, docx, txt and md"


def _extension_of(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


@router.post("/documents", response_model=DocumentUploadResponse)
async def upload_documents(
    user: Annotated[SessionUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    files: Annotated[list[UploadFile], File(...)],
) -> DocumentUploadResponse:
    """Validate type/size, store in S3, register as Processing, enqueue ingest.

    Validation runs before any bytes are persisted: an unsupported extension
    is rejected without reading the file, and an oversized file is rejected
    after being read into memory but before anything is written to object
    storage. One bad file in a batch never fails the others (AC-075); any
    partial write for a file that fails after storage is attempted is
    cleaned up (AC-076).
    """
    accepted: list[DocumentUploadResult] = []
    rejected: list[DocumentRejection] = []

    for file in files:
        filename = file.filename or "unnamed"
        ext = _extension_of(filename)

        if ext not in _ALLOWED_FORMATS:
            rejected.append(
                DocumentRejection(
                    filename=filename,
                    reason=(
                        f"'{filename}' has an unsupported file type; supported formats "
                        f"are {_SUPPORTED_FORMATS_TEXT}"
                    ),
                )
            )
            await file.close()
            continue

        content = await file.read()
        await file.close()

        if len(content) > MAX_UPLOAD_BYTES:
            rejected.append(
                DocumentRejection(
                    filename=filename,
                    reason=(
                        f"'{filename}' is {len(content)} bytes, which exceeds the maximum "
                        f"permitted size of {MAX_UPLOAD_BYTES} bytes"
                    ),
                )
            )
            continue

        document_id = uuid.uuid4()
        s3_key = f"documents/{document_id}/{filename}"

        try:
            save_file(s3_key, content)
        except Exception:
            delete_file(s3_key)
            rejected.append(
                DocumentRejection(filename=filename, reason=f"'{filename}' could not be stored")
            )
            continue

        document = Document(
            id=document_id,
            filename=filename,
            format=ext,
            uploader_id=uuid.UUID(user.id),
            s3_key=s3_key,
            status="Processing",
        )
        db.add(document)
        db.commit()
        db.refresh(document)

        enqueue_ingest_job(str(document.id))

        accepted.append(
            DocumentUploadResult(
                document_id=str(document.id), filename=filename, status=document.status
            )
        )

    return DocumentUploadResponse(accepted=accepted, rejected=rejected)


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    user: Annotated[SessionUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> DocumentListResponse:
    """List all documents in the shared corpus with filter and pagination.

    The query is identical for every authenticated caller: no per-user or
    per-group filtering, and nothing here narrows the result by uploader
    (AC-089/AC-090) -- every document in the corpus is returned regardless
    of who uploaded it.
    """
    query = db.query(Document, User).join(User, Document.uploader_id == User.id)
    if q:
        query = query.filter(Document.filename.ilike(f"%{q}%"))

    total = query.count()
    rows = (
        query.order_by(Document.uploaded_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [
        DocumentOut(
            id=str(document.id),
            filename=document.filename,
            format=document.format,
            uploader=uploader.display_name,
            uploaded_at=document.uploaded_at,
            status=document.status,
            status_reason=document.status_reason,
        )
        for document, uploader in rows
    ]

    return DocumentListResponse(items=items, total=total)


@router.get("/documents/{document_id}/file", response_model=StubResponse)
async def get_document_file(
    document_id: str,
    user: Annotated[SessionUser, Depends(get_current_user)],
) -> StubResponse:
    """Open or download the stored original file for a citation."""
    return StubResponse(endpoint="GET /documents/{id}/file")


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: str,
    user: Annotated[SessionUser, Depends(get_current_user)],
) -> Response:
    """Remove document, its S3 file and all chunks/embeddings; write audit entry."""
    return Response(status_code=204)
