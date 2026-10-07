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

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth import SessionUser, get_current_user
from app.config import MAX_UPLOAD_BYTES
from app.database import get_db
from app.models import AuditLog, Chunk, Citation, Document, User
from app.schemas import (
    DocumentListResponse,
    DocumentOut,
    DocumentRejection,
    DocumentUploadResponse,
    DocumentUploadResult,
)
from app.services.ingest import enqueue_ingest_job
from app.services.storage import delete_file, read_file, save_file

router = APIRouter(tags=["documents"])

_ALLOWED_FORMATS = ("pdf", "docx", "txt", "md")
_SUPPORTED_FORMATS_TEXT = "pdf, docx, txt and md"

# Content-Type for each accepted format, used by GET /documents/{id}/file.
# Falls back to application/octet-stream for anything unrecognised -- which
# should not happen given _ALLOWED_FORMATS gates what can be uploaded, but a
# document row with an unexpected format must still be downloadable.
_CONTENT_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain; charset=utf-8",
    "md": "text/markdown; charset=utf-8",
}


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
            # The citation panel displays `source_id` as a citation's label
            # (see app.routers.answer._citation_payload / CitationOut). An
            # upload has no independent source-system identifier of its
            # own, so the filename is it -- without this every citation to
            # an uploaded document would render with a blank label.
            source_id=filename,
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
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> DocumentListResponse:
    """List all documents in the shared corpus with filter and pagination.

    The query is identical for every authenticated caller: no per-user or
    per-group filtering, and nothing here narrows the result by uploader
    (AC-089/AC-090) -- every document in the corpus is returned regardless
    of who uploaded it. `status` filters server-side (Processing / Ready /
    No readable text / Failed) so pagination and the reported `total` stay
    correct for the filtered set -- the status dropdown on the knowledge
    base screen would otherwise only ever see whatever happened to land on
    the current page.
    """
    query = db.query(Document, User).join(User, Document.uploader_id == User.id)
    if q:
        query = query.filter(Document.filename.ilike(f"%{q}%"))
    if status_filter:
        query = query.filter(Document.status == status_filter)

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


@router.get("/documents/{document_id}/file")
async def get_document_file(
    document_id: str,
    user: Annotated[SessionUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    """Open or download the stored original file for a citation.

    This is the URL `app.routers.answer._citation_source_url` hands back for
    every uploaded-document citation, so a missing document or a missing
    object in storage are both a 404 -- a citation that cannot be opened is
    indistinguishable from one that was never valid.
    """
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        ) from exc

    document = db.get(Document, doc_uuid)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    try:
        content = read_file(document.s3_key)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document file not found"
        ) from exc

    content_type = _CONTENT_TYPES.get(document.format, "application/octet-stream")
    safe_filename = document.filename.replace('"', "")
    return StreamingResponse(
        iter([content]),
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{safe_filename}"'},
    )


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: str,
    user: Annotated[SessionUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    """Remove document, its S3 file and all chunks/embeddings; write audit entry.

    No visibility/owner-scope check: any authenticated employee may delete
    any document (AC per packet). The DB side -- dependent citation rows,
    chunk rows, the audit entry and the document row -- commits as a
    single transaction so a mid-transaction failure leaves no orphans; the
    object-store delete happens only after that commit succeeds, so a
    failure there never leaves the DB and the stored object out of sync in
    a way that orphans DB rows. Citation rows referencing this document are
    removed outright (Citation.document_id is not nullable) so the
    document delete never trips a foreign-key violation on Postgres. The
    audit entry carries a `document_filename` identity snapshot and a
    nullable, ON DELETE SET NULL document_id, so it survives the document
    row's deletion intact.
    """
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        ) from exc

    document = db.get(Document, doc_uuid)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    s3_key = document.s3_key
    filename = document.filename

    db.query(Citation).filter(Citation.document_id == doc_uuid).delete()
    db.query(Chunk).filter(Chunk.document_id == doc_uuid).delete()
    db.add(
        AuditLog(
            actor_id=uuid.UUID(user.id),
            action="document.delete",
            document_id=doc_uuid,
            document_filename=filename,
        )
    )
    db.delete(document)
    db.commit()

    delete_file(s3_key)

    return Response(status_code=204)
