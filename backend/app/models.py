"""SQLAlchemy models.

One class per entity in the approved data model. `Base` is already bound to
the engine in `app.database`; `main.py` imports this module before it calls
`Base.metadata.create_all`, which is how these tables get created on the
scaffold's default SQLite file with no migrations yet.

Postgres-specific types (JSONB, TSVECTOR, pgvector's Vector) are declared
with a portable default and a postgresql variant -- the same pattern
`DATABASE_URL` uses in app.database: it creates against the SQLite the
scaffold runs on, and becomes the real type against the RDS + pgvector
instance the architecture names.
"""

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, ForeignKey, Integer, SmallInteger, Text, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

_jsonb = JSON().with_variant(JSONB(), "postgresql")
_tsvector = Text().with_variant(TSVECTOR(), "postgresql")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    idp_subject: Mapped[str] = mapped_column(Text, unique=True)
    display_name: Mapped[str] = mapped_column(Text)
    group_claims: Mapped[list] = mapped_column(_jsonb, default=list)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename: Mapped[str] = mapped_column(Text)
    format: Mapped[str] = mapped_column(Text)
    uploader_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    s3_key: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, default="Processing")
    status_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Set when the document came from Confluence or Jira rather than a direct
    # upload; "upload" otherwise. Populated by the ingest_worker.
    source_type: Mapped[str] = mapped_column(Text, default="upload")
    source_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id"))
    chunk_index: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    # 1024-dim to match the Bedrock embedding model behind model_provider.
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1024), nullable=True)
    content_tsv: Mapped[str | None] = mapped_column(_tsvector, nullable=True)
    # "metadata" is reserved on a declarative model (it already names the
    # table metadata), so the attribute is metadata_ and only the column
    # itself is named "metadata".
    metadata_: Mapped[dict] = mapped_column("metadata", _jsonb, default=dict)


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id"))
    role: Mapped[str] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text)
    not_covered: Mapped[bool] = mapped_column(default=False)
    token_usage: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Citation(Base):
    __tablename__ = "citations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("messages.id"))
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id"))
    source_type: Mapped[str] = mapped_column(Text)
    source_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("messages.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    rating: Mapped[int] = mapped_column(SmallInteger)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(Text)
    document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("documents.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


__all__ = [
    "Base",
    "User",
    "Document",
    "Chunk",
    "Conversation",
    "Message",
    "Citation",
    "Feedback",
    "AuditLog",
]
