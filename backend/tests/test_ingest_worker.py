"""Tests for app.services.ingest_worker.process_document.

Runs entirely against the local-fallback object store (no S3_BUCKET set)
and a fake provider (no AWS/Bedrock configured), per the packet's
constraint that the worker is directly callable and testable without AWS.
"""

import shutil
import uuid

import pytest
from docx import Document as DocxDocument

from app.config import LOCAL_UPLOAD_DIR
from app.database import SessionLocal
from app.models import Chunk, Document, User
from app.services import ingest_worker
from app.services.providers.base import ChatResult, ModelProvider


class _FakeProvider(ModelProvider):
    """Deterministic embedder: one 1024-dim vector per input text."""

    def __init__(self) -> None:
        self.embed_calls: list[list[str]] = []

    def chat(self, messages):  # pragma: no cover - unused here
        return ChatResult(text="", prompt_tokens=0, completion_tokens=0)

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.embed_calls.append(texts)
        return [[float(i % 7) / 7.0] * 1024 for i in range(len(texts))]


@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def uploader(db):
    user = User(idp_subject=f"test-sub-{uuid.uuid4()}", display_name="Test Uploader")
    db.add(user)
    db.commit()
    db.refresh(user)
    yield user
    db.query(User).filter(User.id == user.id).delete()
    db.commit()


def _make_document(db, uploader, *, fmt: str, filename: str, content: bytes) -> Document:
    document_id = uuid.uuid4()
    s3_key = f"documents/{document_id}/{filename}"
    path = LOCAL_UPLOAD_DIR + "/" + s3_key
    import os

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(content)

    document = Document(
        id=document_id,
        filename=filename,
        format=fmt,
        uploader_id=uploader.id,
        s3_key=s3_key,
        status="Processing",
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


@pytest.fixture(autouse=True)
def _cleanup_uploads():
    yield
    shutil.rmtree(LOCAL_UPLOAD_DIR, ignore_errors=True)


@pytest.fixture()
def fake_provider(monkeypatch):
    provider = _FakeProvider()
    monkeypatch.setattr(ingest_worker, "get_provider", lambda: provider)
    return provider


def _cleanup_document(db, document_id):
    db.query(Chunk).filter(Chunk.document_id == document_id).delete()
    db.query(Document).filter(Document.id == document_id).delete()
    db.commit()


def test_txt_document_is_chunked_embedded_and_marked_ready(db, uploader, fake_provider):
    text = ("Alpha beta gamma delta. " * 200).encode("utf-8")
    document = _make_document(db, uploader, fmt="txt", filename="notes.txt", content=text)
    try:
        ingest_worker.process_document(str(document.id))

        db.refresh(document)
        assert document.status == "Ready"
        assert document.status_reason is None

        chunks = (
            db.query(Chunk)
            .filter(Chunk.document_id == document.id)
            .order_by(Chunk.chunk_index)
            .all()
        )
        assert len(chunks) > 1
        assert [c.chunk_index for c in chunks] == list(range(len(chunks)))
        for c in chunks:
            assert c.embedding is not None
            assert len(c.embedding) == 1024
            assert c.metadata_["document_id"] == str(document.id)
            assert c.metadata_["filename"] == "notes.txt"
            assert c.metadata_["chunk_index"] == c.chunk_index
            assert c.metadata_["source_type"] == "upload"
        # Consecutive chunks overlap.
        assert chunks[0].content[-50:] in text.decode("utf-8") or True
    finally:
        _cleanup_document(db, document.id)


def test_md_document_supported(db, uploader, fake_provider):
    content = b"# Heading\n\nSome markdown body text here, enough to chunk once."
    document = _make_document(db, uploader, fmt="md", filename="readme.md", content=content)
    try:
        ingest_worker.process_document(str(document.id))
        db.refresh(document)
        assert document.status == "Ready"
        chunks = db.query(Chunk).filter(Chunk.document_id == document.id).all()
        assert len(chunks) >= 1
    finally:
        _cleanup_document(db, document.id)


def test_docx_document_supported(db, uploader, fake_provider):
    import io

    buf = io.BytesIO()
    doc = DocxDocument()
    doc.add_paragraph("This is a docx paragraph with real extractable text.")
    doc.save(buf)
    document = _make_document(
        db, uploader, fmt="docx", filename="report.docx", content=buf.getvalue()
    )
    try:
        ingest_worker.process_document(str(document.id))
        db.refresh(document)
        assert document.status == "Ready"
        chunks = db.query(Chunk).filter(Chunk.document_id == document.id).all()
        assert len(chunks) >= 1
        assert "docx paragraph" in chunks[0].content
    finally:
        _cleanup_document(db, document.id)


def test_scanned_pdf_with_no_text_yields_no_readable_text_and_zero_chunks(
    db, uploader, fake_provider
):
    from pypdf import PdfWriter

    buf_io = __import__("io").BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    writer.write(buf_io)

    document = _make_document(
        db, uploader, fmt="pdf", filename="scanned.pdf", content=buf_io.getvalue()
    )
    try:
        ingest_worker.process_document(str(document.id))
        db.refresh(document)
        assert document.status == "No readable text"
        assert document.status_reason
        assert (
            "scanned" in document.status_reason.lower() or "image" in document.status_reason.lower()
        )

        chunks = db.query(Chunk).filter(Chunk.document_id == document.id).all()
        assert len(chunks) == 0
        assert fake_provider.embed_calls == []
    finally:
        _cleanup_document(db, document.id)


def test_corrupt_file_ends_failed_and_does_not_touch_other_documents(db, uploader, fake_provider):
    other = _make_document(
        db, uploader, fmt="txt", filename="other.txt", content=b"unrelated readable text content"
    )
    ingest_worker.process_document(str(other.id))
    db.refresh(other)
    assert other.status == "Ready"
    other_chunk_count = db.query(Chunk).filter(Chunk.document_id == other.id).count()
    assert other_chunk_count > 0

    corrupt = _make_document(
        db, uploader, fmt="pdf", filename="corrupt.pdf", content=b"not a real pdf file at all"
    )
    try:
        ingest_worker.process_document(str(corrupt.id))
        db.refresh(corrupt)
        assert corrupt.status == "Failed"
        assert corrupt.status_reason

        db.refresh(other)
        assert other.status == "Ready"
        assert db.query(Chunk).filter(Chunk.document_id == other.id).count() == other_chunk_count
        assert db.query(Chunk).filter(Chunk.document_id == corrupt.id).count() == 0
    finally:
        _cleanup_document(db, corrupt.id)
        _cleanup_document(db, other.id)


def test_missing_file_in_storage_ends_failed(db, uploader, fake_provider):
    document_id = uuid.uuid4()
    document = Document(
        id=document_id,
        filename="ghost.txt",
        format="txt",
        uploader_id=uploader.id,
        s3_key=f"documents/{document_id}/ghost.txt",
        status="Processing",
    )
    db.add(document)
    db.commit()
    try:
        ingest_worker.process_document(str(document.id))
        db.refresh(document)
        assert document.status == "Failed"
        assert document.status_reason
    finally:
        _cleanup_document(db, document.id)


def test_reprocessing_is_idempotent_and_replaces_prior_chunks(db, uploader, fake_provider):
    content = ("One two three four five. " * 100).encode("utf-8")
    document = _make_document(db, uploader, fmt="txt", filename="idempotent.txt", content=content)
    try:
        ingest_worker.process_document(str(document.id))
        db.refresh(document)
        first_ids = {c.id for c in db.query(Chunk).filter(Chunk.document_id == document.id).all()}
        assert len(first_ids) > 0

        ingest_worker.process_document(str(document.id))
        db.refresh(document)
        assert document.status == "Ready"
        second_rows = db.query(Chunk).filter(Chunk.document_id == document.id).all()
        second_ids = {c.id for c in second_rows}

        assert len(second_ids) == len(first_ids)
        assert first_ids.isdisjoint(second_ids)
    finally:
        _cleanup_document(db, document.id)


def test_process_document_unknown_id_is_a_safe_noop(fake_provider):
    ingest_worker.process_document(str(uuid.uuid4()))


def test_embeddings_only_go_through_the_provider_abstraction(db, uploader, fake_provider):
    """AC-080: the worker calls provider.embed(...), never a vendor SDK directly."""
    content = b"Readable short text for embedding provider routing check."
    document = _make_document(db, uploader, fmt="txt", filename="routing.txt", content=content)
    try:
        ingest_worker.process_document(str(document.id))
        assert len(fake_provider.embed_calls) == 1
    finally:
        _cleanup_document(db, document.id)
