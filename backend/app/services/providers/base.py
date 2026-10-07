"""The provider-agnostic interface every model adapter implements.

This is the one abstraction routers, services and workers are allowed to
call for chat/generate and embedding operations (AC-123): no router,
service or worker imports a vendor SDK or calls a model HTTP endpoint
directly. `app.services.providers.get_provider()` resolves which concrete
adapter (`ModelProvider` subclass) backs this interface from configuration;
swapping it is adding one adapter module plus config, with no change to
callers, API schemas or stored document records (AC-124).
"""

from abc import ABC, abstractmethod
from collections.abc import Iterator
from dataclasses import dataclass


@dataclass
class ChatResult:
    """The result of one chat/generate call: text plus token accounting."""

    text: str
    prompt_tokens: int
    completion_tokens: int


@dataclass
class StreamChunk:
    """One event of a streaming chat/generate call.

    A non-final chunk carries one incremental text `delta`. The stream
    ends with exactly one `done=True` chunk carrying the completed
    generation's prompt/completion token counts (no `delta` on it).
    """

    delta: str = ""
    done: bool = False
    prompt_tokens: int = 0
    completion_tokens: int = 0


class ModelProvider(ABC):
    """One in-tenant model provider: chat/generate plus embeddings."""

    @abstractmethod
    def chat(self, messages: list[dict[str, str]]) -> ChatResult:
        """Run a chat/generate completion and return text + token usage.

        `messages` is a list of `{"role": ..., "content": ...}` dicts, in
        the order they should be presented to the model.
        """

    def stream_chat(self, messages: list[dict[str, str]]) -> Iterator[StreamChunk]:
        """Run a chat/generate completion, yielding incremental `StreamChunk`
        token deltas as the provider generates them, ending with one
        `done=True` chunk carrying final token usage.

        Callers (the answer router) must be able to forward each `delta` to
        a client before the full completion exists -- adapters that can
        genuinely stream (see `BedrockProvider`) must override this rather
        than rely on the default below, which calls the non-streaming
        `chat` and yields its whole result as a single chunk. That default
        exists so a minimal/test provider only has to implement `chat` and
        `embed`, same as before streaming existed.
        """
        result = self.chat(messages)
        if result.text:
            yield StreamChunk(delta=result.text)
        yield StreamChunk(
            done=True,
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
        )

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Return one embedding vector per input text, in input order."""
