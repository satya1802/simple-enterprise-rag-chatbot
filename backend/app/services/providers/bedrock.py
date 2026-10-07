"""The Bedrock adapter: the only module that imports boto3's Bedrock client.

Targets exclusively an in-tenant endpoint -- the regional
`bedrock-runtime.<region>.amazonaws.com` endpoint for `AWS_REGION`, a
`*.vpce.amazonaws.com` private VPC endpoint, or an explicitly
allowlisted private endpoint hostname (`MODEL_PROVIDER_ALLOWED_HOSTS`).
Initialisation fails closed against anything else, so there is no code path
through this adapter that can reach a public third-party AI API (AC-122).
No question text, retrieved chunk or document text goes anywhere but this
one, in-tenant, allowlisted host.
"""

import json
from urllib.parse import urlparse

import boto3

from app.config import (
    AWS_REGION,
    BEDROCK_CHAT_MODEL_ID,
    BEDROCK_EMBEDDING_MODEL_ID,
    BEDROCK_ENDPOINT_URL,
    MODEL_PROVIDER_ALLOWED_HOSTS,
)
from app.services.providers.base import ChatResult, ModelProvider


def _is_allowlisted_host(host: str, region: str, extra_allowed: set[str]) -> bool:
    if not host:
        return False
    if host in extra_allowed:
        return True
    if host == f"bedrock-runtime.{region}.amazonaws.com":
        return True
    if host.endswith(".amazonaws.com") and "bedrock-runtime" in host:
        return True
    if host.endswith(".vpce.amazonaws.com") and "bedrock-runtime" in host:
        return True
    return False


def _extract_chat_text(payload: dict) -> str:
    content = payload.get("content")
    if isinstance(content, list) and content:
        first = content[0]
        if isinstance(first, dict) and "text" in first:
            return str(first["text"])
    return str(payload.get("completion", ""))


class BedrockProvider(ModelProvider):
    """In-tenant adapter: Amazon Bedrock chat + embedding models."""

    def __init__(
        self,
        region: str = AWS_REGION,
        chat_model_id: str = BEDROCK_CHAT_MODEL_ID,
        embedding_model_id: str = BEDROCK_EMBEDDING_MODEL_ID,
        endpoint_url: str = BEDROCK_ENDPOINT_URL,
        allowed_hosts: str = MODEL_PROVIDER_ALLOWED_HOSTS,
    ) -> None:
        self._chat_model_id = chat_model_id
        self._embedding_model_id = embedding_model_id

        resolved_endpoint = endpoint_url or f"https://bedrock-runtime.{region}.amazonaws.com"
        host = urlparse(resolved_endpoint).hostname or ""
        extra_allowed = {h.strip() for h in allowed_hosts.split(",") if h.strip()}
        if not _is_allowlisted_host(host, region, extra_allowed):
            raise RuntimeError(
                f"refusing to initialise the Bedrock adapter against non-allowlisted "
                f"host {host!r}"
            )

        self._client = boto3.client(
            "bedrock-runtime", region_name=region, endpoint_url=resolved_endpoint
        )

    def chat(self, messages: list[dict[str, str]]) -> ChatResult:
        if not self._chat_model_id:
            raise RuntimeError("BEDROCK_CHAT_MODEL_ID is not configured")
        body = json.dumps(
            {
                "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
                "max_tokens": 1024,
            }
        )
        response = self._client.invoke_model(modelId=self._chat_model_id, body=body)
        payload = json.loads(response["body"].read())
        usage = payload.get("usage", {})
        return ChatResult(
            text=_extract_chat_text(payload),
            prompt_tokens=int(usage.get("input_tokens", 0)),
            completion_tokens=int(usage.get("output_tokens", 0)),
        )

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not self._embedding_model_id:
            raise RuntimeError("BEDROCK_EMBEDDING_MODEL_ID is not configured")
        vectors: list[list[float]] = []
        for text in texts:
            body = json.dumps({"inputText": text})
            response = self._client.invoke_model(modelId=self._embedding_model_id, body=body)
            payload = json.loads(response["body"].read())
            vectors.append(list(payload.get("embedding", [])))
        return vectors
