"""backend_api: document upload, listing, retrieval and deletion.

Owns the S3 object_store and job_queue boundary from the API side -- storing
the original file and enqueueing the ingest job are the development sprint's
work, done by the ingest_worker once a job lands on the queue.
"""

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile

from app.auth import SessionUser, get_current_user
from app.schemas import StubResponse

router = APIRouter(tags=["documents"])


@router.post("/documents", response_model=StubResponse)
async def upload_documents(
    files: list[UploadFile] = File(...),
    user: SessionUser = Depends(get_current_user),
) -> StubResponse:
    """Validate type/size, store in S3, register as Processing, enqueue ingest."""
    return StubResponse(endpoint="POST /documents")


@router.get("/documents", response_model=StubResponse)
async def list_documents(
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: SessionUser = Depends(get_current_user),
) -> StubResponse:
    """List all documents in the shared corpus with filter and pagination."""
    return StubResponse(endpoint="GET /documents")


@router.get("/documents/{document_id}/file", response_model=StubResponse)
async def get_document_file(
    document_id: str,
    user: SessionUser = Depends(get_current_user),
) -> StubResponse:
    """Open or download the stored original file for a citation."""
    return StubResponse(endpoint="GET /documents/{id}/file")


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: str,
    user: SessionUser = Depends(get_current_user),
) -> Response:
    """Remove document, its S3 file and all chunks/embeddings; write audit entry."""
    return Response(status_code=204)
