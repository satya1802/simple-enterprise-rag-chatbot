"""answer_engine: resolving a follow-up question against prior turns.

`POST /answer` grounds retrieval in whatever the caller actually meant, not
only in the literal words of the latest message: a follow-up like "who
approves it?" or "and for contractors?" only makes sense read against the
turns that came before it. `resolve_question` turns the raw question into a
standalone one before `app.services.retrieval.search_chunks` ever sees it
(AC-015/AC-111), using the same in-tenant model provider abstraction
(`app.services.providers`) as generation -- no vendor SDK or direct HTTP
call lives here.

A conversation's first question has no prior turns to resolve against, so
it is returned unchanged with no model call at all (and therefore no risk
of the rewrite step itself introducing a wrong answer). An unrelated
question asked later in the same conversation must come back unbiased by
earlier turns (AC-112): the rewrite prompt instructs the model to return
the question unchanged whenever it is already a complete, self-contained
question or is unrelated to what came before, and any failure to call the
provider at all falls back to the raw question rather than blocking the
turn.
"""

import logging
import uuid

from sqlalchemy.orm import Session

from app.models import Message
from app.services.providers import get_provider

logger = logging.getLogger(__name__)

# Last N messages (user + assistant turns together) considered when
# resolving a follow-up -- bounded so a long-running conversation does not
# grow the resolution prompt without limit, and scoped to one conversation
# id by the query below (always the caller's own: `answer.py` has already
# verified conversation ownership before this is called).
MAX_HISTORY_MESSAGES = 6

_RESOLUTION_SYSTEM_PROMPT = (
    "You rewrite a user's latest question into a fully self-contained, "
    "standalone question, using the prior conversation turns only to "
    "resolve pronouns and ellipsis (e.g. 'who approves it?', 'and for "
    "contractors?'). Preserve the user's intent and wording as closely as "
    "possible; only add what is needed to make the question stand on its "
    "own without the preceding turns. If the latest question is already "
    "standalone, or is unrelated to the prior turns, return it exactly "
    "unchanged. Reply with only the rewritten question and nothing else: "
    "no explanation, no quotes, no preamble."
)


def _recent_history(db: Session, conversation_id: uuid.UUID) -> list[Message]:
    rows = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(MAX_HISTORY_MESSAGES)
        .all()
    )
    rows.reverse()
    return rows


def resolve_question(db: Session, conversation_id: uuid.UUID, question: str) -> str:
    """Return `question`, resolved against this conversation's prior turns.

    A first question (no prior turns persisted yet) is returned unchanged
    with no model call. Any provider failure also falls back to the raw
    question rather than failing the turn -- resolution is a refinement of
    retrieval's input, not a new failure mode for it.
    """
    history = _recent_history(db, conversation_id)
    if not history:
        return question

    transcript = "\n".join(f"{message.role}: {message.content}" for message in history)
    prompt = [
        {"role": "system", "content": _RESOLUTION_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Prior conversation turns:\n{transcript}\n\n"
                f"Latest question: {question}\n\n"
                "Standalone question:"
            ),
        },
    ]

    try:
        provider = get_provider()
        result = provider.chat(prompt)
    except Exception:  # noqa: BLE001 -- resolution is best-effort
        logger.exception("question resolution failed for conversation %s", conversation_id)
        return question

    resolved = (result.text or "").strip()
    return resolved or question


__all__ = ["resolve_question", "MAX_HISTORY_MESSAGES"]
