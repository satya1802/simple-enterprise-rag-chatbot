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
from dataclasses import dataclass


@dataclass
class ChatResult:
    """The result of one chat/generate call: text plus token accounting."""

    text: str
    prompt_tokens: int
    completion_tokens: int


class ModelProvider(ABC):
    """One in-tenant model provider: chat/generate plus embeddings."""

    @abstractmethod
    def chat(self, messages: list[dict[str, str]]) -> ChatResult:
        """Run a chat/generate completion and return text + token usage.

        `messages` is a list of `{"role": ..., "content": ...}` dicts, in
        the order they should be presented to the model.
        """

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Return one embedding vector per input text, in input order."""
