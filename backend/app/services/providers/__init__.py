"""The single in-tenant model provider abstraction (AC-123).

Every caller that needs chat/generate or embedding operations -- the
answer router, the ingestion embedding step, anything else -- imports
`get_provider` from here and calls `.chat(...)` / `.embed(...)` on what it
returns. Nothing outside `app.services.providers` imports a vendor SDK
(e.g. `boto3`) or calls a model HTTP endpoint directly.

`get_provider` resolves the configured adapter from `MODEL_PROVIDER` once
and caches it for the life of the process -- the moral equivalent of
resolving it at startup, without requiring a FastAPI startup hook. Adding
another in-tenant provider is one new adapter module plus a branch below;
the API contract, schemas and stored document records do not change
(AC-124).
"""

from functools import lru_cache

from app.config import MODEL_PROVIDER
from app.services.providers.base import ChatResult, ModelProvider

__all__ = ["ChatResult", "ModelProvider", "get_provider"]


@lru_cache(maxsize=1)
def get_provider() -> ModelProvider:
    """Return the process-wide provider adapter chosen by MODEL_PROVIDER."""
    provider_name = (MODEL_PROVIDER or "bedrock").strip().lower()
    if provider_name == "bedrock":
        from app.services.providers.bedrock import BedrockProvider

        return BedrockProvider()
    raise RuntimeError(f"Unknown MODEL_PROVIDER: {provider_name!r}")
