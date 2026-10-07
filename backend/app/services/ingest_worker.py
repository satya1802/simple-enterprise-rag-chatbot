"""ingest_worker: SQS-driven (and directly callable) document processing.

`POST /documents` enqueues `{"document_id": ...}` onto `SQS_INGEST_QUEUE_URL`
via `app.services.ingest.enqueue_ingest_job`. This module is what drains
that queue: `run_worker()` polls SQS and calls `process_document` for each
message, while `process_document(document_id)` itself is a plain function
with no AWS dependency, so it is directly callable and testable without a
queue, an S3 bucket, or a model provider actually configured.

Text extraction supports pdf, docx, txt and md. Extracted text is split into
overlapping chunks, embedded one vector per chunk through
`app.services.providers.get_provider()` -- the only import of a model
adapter anywhere in this module -- and persisted to `models.Chunk` with
`document_id`, `filename`, `chunk_index` and `source_type`/`source_url`
metadata so the answer engine can retrieve and cite the document. Reading
the stored original back from S3 (or the local fallback directory) mirrors
`app.services.storage.save_file`'s own convention; boto3 here talks to S3
only, never a model endpoint.

Processing is idempotent per document_id: a successful or no-readable-text
outcome replaces any chunks a prior run wrote, rather than duplicating them.
A single document's failure never touches another document's row or chunks.
"""

import json
import logging
import os
import re
import time
import uuid
from io import BytesIO

from app.config import AWS_REGION, LOCAL_UPLOAD_DIR, S3_BUCKET, SQS_INGEST_QUEUE_URL
from app.database import SessionLocal
from app.models import Chunk, Document
from app.services.providers import get_provider

logger = logging.getLogger(__name__)

_VALID_STATUSES = {"Processing", "Ready", "No readable text", "Failed"}

_CHUNK_SIZE = 1200
_CHUNK_OVERLAP = 200

_NO_READABLE_TEXT_REASON = (
    "No readable text could be extracted from this file. Scanned or "
    "image-only PDFs are not read in this release."
)


class _CorruptFileError(Exception):
    """The file could not be parsed into text: corrupt or malformed."""


class _PasswordProtectedError(Exception):
    """The file is password-protected and could not be opened."""


# ---------------------------------------------------------------------------
# object storage read-back
# ---------------------------------------------------------------------------


def _read_stored_file(s3_key: str) -> bytes:
    """Read the original uploaded bytes back from wherever save_file put them.

    Mirrors app.services.storage's S3-vs-local-fallback convention; storage.py
    only exposes writes (save_file/delete_file), so the read side lives here.
    """
    if S3_BUCKET:
        import boto3

        client = boto3.client("s3", region_name=AWS_REGION)
        response = client.get_object(Bucket=S3_BUCKET, Key=s3_key)
        return response["Body"].read()

    path = os.path.join(LOCAL_UPLOAD_DIR, s3_key)
    with open(path, "rb") as f:
        return f.read()


# ---------------------------------------------------------------------------
# text extraction
# ---------------------------------------------------------------------------


def _extract_plain_text(content: bytes) -> str:
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        return content.decode("utf-8", errors="replace")


def _extract_pdf_text(content: bytes) -> str:
    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(content))
    except Exception as exc:  # noqa: BLE001 -- any parse failure is "corrupt"
        raise _CorruptFileError(str(exc)) from exc

    if reader.is_encrypted:
        try:
            result = reader.decrypt("")
        except Exception as exc:  # noqa: BLE001
            raise _PasswordProtectedError(str(exc)) from exc
        if not result:
            raise _PasswordProtectedError("PDF is password-protected")

    try:
        pages_text = [page.extract_text() or "" for page in reader.pages]
    except Exception as exc:  # noqa: BLE001
        raise _CorruptFileError(str(exc)) from exc

    return "\n".join(pages_text)


def _extract_docx_text(content: bytes) -> str:
    try:
        import docx

        document = docx.Document(BytesIO(content))
    except Exception as exc:  # noqa: BLE001
        raise _CorruptFileError(str(exc)) from exc

    return "\n".join(paragraph.text for paragraph in document.paragraphs)


def _extract_text(fmt: str, content: bytes) -> str:
    if fmt == "pdf":
        return _extract_pdf_text(content)
    if fmt == "docx":
        return _extract_docx_text(content)
    if fmt in ("txt", "md"):
        return _extract_plain_text(content)
    raise _CorruptFileError(f"unsupported document format {fmt!r}")


# ---------------------------------------------------------------------------
# chunking
# ---------------------------------------------------------------------------


def _chunk_text(
    text: str, chunk_size: int = _CHUNK_SIZE, overlap: int = _CHUNK_OVERLAP
) -> list[str]:
    """Split normalised text into overlapping chunks, in document order."""
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        return []

    chunks: list[str] = []
    length = len(normalized)
    start = 0
    while start < length:
        end = min(start + chunk_size, length)
        piece = normalized[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= length:
            break
        start = max(end - overlap, start + 1)
    return chunks


# ---------------------------------------------------------------------------
# status + chunk persistence
# ---------------------------------------------------------------------------


def _set_status(db, document: Document, status: str, reason: str | None) -> None:
    assert status in _VALID_STATUSES
    document.status = status
    document.status_reason = reason
    db.commit()


def _replace_chunks(db, document_id: uuid.UUID, chunk_rows: list[Chunk]) -> None:
    """Delete any chunks a prior run of this document wrote, then insert new ones.

    Keeps the worker idempotent per document_id: reprocessing replaces prior
    chunks rather than duplicating them.
    """
    db.query(Chunk).filter(Chunk.document_id == document_id).delete()
    for row in chunk_rows:
        db.add(row)
    db.commit()


# ---------------------------------------------------------------------------
# the entry point
# ---------------------------------------------------------------------------


def process_document(document_id: str) -> None:
    """Extract, chunk, embed and persist one document. Drives its status.

    Callable directly (as tests and a synchronous caller do) or from
    `run_worker`'s SQS poll loop. A failure here only ever touches the one
    document row and its own chunks.
    """
    db = SessionLocal()
    try:
        try:
            doc_uuid = uuid.UUID(document_id)
        except ValueError:
            logger.error("ingest: document id %r is not a valid uuid", document_id)
            return

        document = db.get(Document, doc_uuid)
        if document is None:
            logger.error("ingest: document %s not found; nothing to process", document_id)
            return

        try:
            content = _read_stored_file(document.s3_key)
        except Exception:
            logger.exception("ingest: failed to read stored file for document %s", document_id)
            _set_status(
                db, document, "Failed", "The uploaded file could not be retrieved from storage."
            )
            return

        try:
            text = _extract_text(document.format, content)
        except _PasswordProtectedError:
            logger.exception("ingest: document %s is password-protected", document_id)
            _set_status(
                db,
                document,
                "Failed",
                "This file is password-protected and could not be opened for processing.",
            )
            return
        except Exception:
            logger.exception("ingest: failed to extract text for document %s", document_id)
            _set_status(
                db,
                document,
                "Failed",
                "This file appears to be corrupt and could not be processed.",
            )
            return

        chunk_texts = _chunk_text(text)
        if not chunk_texts:
            logger.info("ingest: document %s yielded no meaningful text", document_id)
            _replace_chunks(db, document.id, [])
            _set_status(db, document, "No readable text", _NO_READABLE_TEXT_REASON)
            return

        try:
            provider = get_provider()
            embeddings = provider.embed(chunk_texts)
        except Exception:
            logger.exception("ingest: embedding failed for document %s", document_id)
            _set_status(db, document, "Failed", "Generating embeddings for this file failed.")
            return

        chunk_rows = [
            Chunk(
                document_id=document.id,
                chunk_index=index,
                content=chunk_text,
                embedding=vector,
                # Keyword-index data: a plain-text lexeme list is a valid
                # TSVECTOR literal on Postgres and a usable ILIKE target on
                # the portable SQLite fallback (see app.services.retrieval).
                content_tsv=chunk_text,
                metadata_={
                    "document_id": str(document.id),
                    "filename": document.filename,
                    "chunk_index": index,
                    "source_type": document.source_type,
                    "source_url": document.source_url,
                },
            )
            for index, (chunk_text, vector) in enumerate(zip(chunk_texts, embeddings, strict=True))
        ]
        _replace_chunks(db, document.id, chunk_rows)
        _set_status(db, document, "Ready", None)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# SQS consumer
# ---------------------------------------------------------------------------


def run_worker(
    *,
    max_messages: int = 10,
    wait_time_seconds: int = 10,
    idle_sleep_seconds: float = 1.0,
    run_once: bool = False,
) -> None:
    """Poll SQS_INGEST_QUEUE_URL and call process_document for each job.

    A no-op when SQS_INGEST_QUEUE_URL is unset, the same convention
    app.services.ingest.enqueue_ingest_job uses, so the worker process still
    starts cleanly with no queue provisioned.
    """
    if not SQS_INGEST_QUEUE_URL:
        logger.info("SQS_INGEST_QUEUE_URL not configured; ingest worker has nothing to consume")
        return

    import boto3

    client = boto3.client("sqs", region_name=AWS_REGION)
    while True:
        response = client.receive_message(
            QueueUrl=SQS_INGEST_QUEUE_URL,
            MaxNumberOfMessages=max_messages,
            WaitTimeSeconds=wait_time_seconds,
        )
        messages = response.get("Messages", [])
        for message in messages:
            try:
                body = json.loads(message["Body"])
                process_document(body["document_id"])
            except Exception:
                logger.exception(
                    "ingest worker: failed to process message %s", message.get("MessageId")
                )
                continue
            client.delete_message(
                QueueUrl=SQS_INGEST_QUEUE_URL, ReceiptHandle=message["ReceiptHandle"]
            )

        if run_once:
            return
        if not messages:
            time.sleep(idle_sleep_seconds)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_worker()
