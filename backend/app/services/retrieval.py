"""answer_engine: hybrid keyword + vector retrieval over one chunk index.

`search_chunks` is the single entry point the answer router calls. It
always produces both a keyword result set (`_keyword_candidates`) and a
vector result set (`_vector_candidates`) and merges them into one ranked
candidate list via reciprocal-rank fusion -- neither path alone determines
what gets returned (AC-105). Both candidate functions query the same
`chunks` table with no filter, branch or separate function keyed on
`Document.source_type`: a Confluence chunk, a Jira chunk and an uploaded-file
chunk are all just rows in one combined index (AC-106).

Keyword matching runs through Postgres's `TSVECTOR`/`ts_rank` against
`Chunk.content_tsv` when the configured database is Postgres, and degrades
to a portable `ILIKE`-per-term fallback on SQLite -- one function,
`_keyword_candidates`, picks the strategy by dialect so callers never see
the difference.

Deleting a document already deletes its chunk rows (see
`app.routers.documents.delete_document`), so a chunk belonging to a deleted
document simply no longer exists in the table these queries scan: there is
no separate "is the document still there" check to get wrong.
"""

from dataclasses import dataclass

import re

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import engine
from app.models import Chunk, Document
from app.services.providers import get_provider

# Reciprocal-rank-fusion constant: a conventional, unremarkable choice that
# just needs to be the same for both candidate lists being merged.
_RRF_K = 60


@dataclass
class ScoredChunk:
    """One merged candidate: the chunk, its document, and its fused score."""

    chunk: Chunk
    document: Document
    score: float


def _is_postgres() -> bool:
    return engine.dialect.name == "postgresql"


def _keyword_terms(question: str) -> list[str]:
    return [term for term in re.findall(r"\w+", question.lower()) if len(term) > 2]


def _keyword_candidates(db: Session, question: str, limit: int) -> list[Chunk]:
    """One combined-index keyword search, Postgres TSVECTOR or portable fallback.

    Runs against every row in `chunks` regardless of the owning document's
    `source_type` -- there is no per-source-type branch here.
    """
    query = db.query(Chunk).join(Document, Chunk.document_id == Document.id)

    if _is_postgres():
        tsquery = func.plainto_tsquery("english", question)
        query = query.filter(Chunk.content_tsv.op("@@")(tsquery))
        query = query.order_by(func.ts_rank(Chunk.content_tsv, tsquery).desc())
        return query.limit(limit).all()

    terms = _keyword_terms(question)
    if not terms:
        return []
    query = query.filter(or_(*(Chunk.content.ilike(f"%{term}%") for term in terms)))
    return query.limit(limit).all()


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _vector_candidates(db: Session, question: str, limit: int) -> list[Chunk]:
    """One combined-index vector search: pgvector distance, or an in-Python
    cosine-similarity fallback when pgvector's operators aren't available.

    Runs against every row in `chunks` regardless of `source_type`, same as
    `_keyword_candidates`.
    """
    provider = get_provider()
    try:
        [query_vector] = provider.embed([question])
    except Exception:  # noqa: BLE001 -- an unconfigured/unreachable provider
        # must not crash retrieval; it degrades to keyword-only candidates.
        return []
    if not query_vector:
        return []

    base_query = (
        db.query(Chunk)
        .join(Document, Chunk.document_id == Document.id)
        .filter(Chunk.embedding.is_not(None))
    )

    if _is_postgres():
        return base_query.order_by(Chunk.embedding.cosine_distance(query_vector)).limit(limit).all()

    candidates = base_query.all()
    candidates.sort(
        key=lambda c: _cosine_similarity(list(c.embedding), query_vector), reverse=True
    )
    return candidates[:limit]


def search_chunks(db: Session, question: str, limit: int = 8) -> list[ScoredChunk]:
    """Hybrid retrieval: keyword + vector, merged via reciprocal rank fusion.

    Both candidate sets are always computed; the merged ranking is what the
    answer router grounds generation in. An empty return means the merged
    candidate set supports no answer.
    """
    keyword_chunks = _keyword_candidates(db, question, limit)
    vector_chunks = _vector_candidates(db, question, limit)

    fused_scores: dict = {}
    chunks_by_id: dict = {}
    for candidate_list in (keyword_chunks, vector_chunks):
        for rank, chunk in enumerate(candidate_list):
            fused_scores[chunk.id] = fused_scores.get(chunk.id, 0.0) + 1.0 / (_RRF_K + rank + 1)
            chunks_by_id[chunk.id] = chunk

    ranked_ids = sorted(fused_scores, key=lambda cid: fused_scores[cid], reverse=True)

    results: list[ScoredChunk] = []
    for chunk_id in ranked_ids[:limit]:
        chunk = chunks_by_id[chunk_id]
        document = db.get(Document, chunk.document_id)
        if document is None:
            # Document deleted between the query and here: never citable.
            continue
        results.append(ScoredChunk(chunk=chunk, document=document, score=fused_scores[chunk_id]))
    return results
