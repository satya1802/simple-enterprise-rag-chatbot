"""Pydantic request and response models.

One pair per entity in the approved data model, plus the placeholder every
generated route returns until it has been implemented.
"""

from datetime import datetime

from pydantic import BaseModel


class StubResponse(BaseModel):
    """What a generated route returns until someone implements it.

    A stub that returns a typed body rather than raising keeps the service
    startable and its OpenAPI document complete, so the frontend can be built
    against the agreed shape while the handlers are still being written.
    """

    endpoint: str
    status: str = "not_implemented"
    detail: str = "Scaffolded from the approved API spec; no behaviour yet."


# ---------------------------------------------------------------------------
# users
# ---------------------------------------------------------------------------


class UserOut(BaseModel):
    """GET /me response: display name and role derived from group claims."""

    id: str
    display_name: str
    is_admin: bool


# ---------------------------------------------------------------------------
# documents
# ---------------------------------------------------------------------------


class DocumentUploadResult(BaseModel):
    """One entry of the POST /documents response, per accepted file."""

    document_id: str
    filename: str
    status: str


class DocumentRejection(BaseModel):
    """One entry of the POST /documents per-file rejection list."""

    filename: str
    reason: str


class DocumentOut(BaseModel):
    """One row of GET /documents."""

    id: str
    filename: str
    format: str
    uploader: str
    uploaded_at: datetime
    status: str
    status_reason: str | None = None


class DocumentListResponse(BaseModel):
    items: list[DocumentOut]
    total: int


class DocumentUploadResponse(BaseModel):
    """POST /documents response: per-file accepted/rejected outcome.

    Every accepted document joins the shared, company-wide knowledge base --
    answerable to all employees -- so there is deliberately no visibility,
    owner-scope or privacy field here or anywhere else on this shape.
    """

    accepted: list[DocumentUploadResult] = []
    rejected: list[DocumentRejection] = []


# ---------------------------------------------------------------------------
# conversations, messages, citations, feedback
# ---------------------------------------------------------------------------


class CitationOut(BaseModel):
    document_id: str
    source_type: str
    source_id: str | None = None
    source_url: str | None = None


class MessageOut(BaseModel):
    role: str
    content: str
    citations: list[CitationOut] = []


class ConversationSummary(BaseModel):
    """One entry of GET /conversations, and the POST /conversations response."""

    id: str
    title: str | None = None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


class ConversationDetail(BaseModel):
    """GET /conversations/{id} response."""

    id: str
    title: str | None = None
    created_at: datetime
    updated_at: datetime
    messages: list[MessageOut] = []


class FeedbackRequest(BaseModel):
    """POST /messages/{id}/feedback request body."""

    rating: int


# ---------------------------------------------------------------------------
# answer engine
# ---------------------------------------------------------------------------


class AnswerRequest(BaseModel):
    """POST /answer request body."""

    question: str
    conversation_id: str | None = None


class TokenUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int


class AnswerResult(BaseModel):
    """The terminal SSE event's JSON payload on POST /answer.

    `stream_id` is also carried on every preceding `token` event so a
    client can correlate them and call POST /answer/stop. `partial` is set
    when retrieval only partially supports the question (AC-101);
    `time_to_first_token_ms` is the TTFT instrumentation from AC-091.
    """

    stream_id: str
    citations: list[CitationOut] = []
    not_covered: bool
    partial: bool = False
    token_usage: TokenUsage
    time_to_first_token_ms: float | None = None


class StopRequest(BaseModel):
    """POST /answer/stop request body."""

    stream_id: str


class TokenEvent(BaseModel):
    """SSE `token` event payload: zero or more precede the terminal event."""

    stream_id: str
    delta: str


class StoppedEvent(BaseModel):
    """SSE `stopped` terminal event payload (POST /answer/stop took effect)."""

    stream_id: str


class ErrorEvent(BaseModel):
    """SSE `error` terminal event payload (retrieval or generation failure)."""

    stream_id: str
    message: str
