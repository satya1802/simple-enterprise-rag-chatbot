"""Environment configuration.

One constant per external dependency the approved architecture names, each
with a safe local default so the service starts with none of them
provisioned -- the same convention `DATABASE_URL` uses in `app.database`.
Point the real environment variable at the managed resource when it exists;
nothing else has to change. No behaviour lives here, only the names of the
knobs the development sprint will need.
"""

import os

# auth: Corporate SSO (OIDC) -- Microsoft Entra ID. Session cookie is signed
# with SESSION_SECRET (see app.auth); the rest configure the Authlib OIDC
# client once the login/callback handlers are implemented for real.
SESSION_SECRET = os.getenv("SESSION_SECRET", "dev-insecure-secret-change-me")
OIDC_ISSUER = os.getenv("OIDC_ISSUER", "")
OIDC_CLIENT_ID = os.getenv("OIDC_CLIENT_ID", "")
OIDC_CLIENT_SECRET = os.getenv("OIDC_CLIENT_SECRET", "")
OIDC_REDIRECT_URI = os.getenv("OIDC_REDIRECT_URI", "http://localhost:8000/auth/callback")
# How long a signed session cookie (and the token inside it) is valid for,
# in seconds. Single source of truth for both the itsdangerous max_age used
# to verify the cookie (app.auth) and the Set-Cookie max_age set on
# /auth/callback -- no 8-hour literal is hard-coded anywhere else.
SESSION_LIFETIME_SECONDS = int(os.getenv("SESSION_LIFETIME_SECONDS", str(8 * 60 * 60)))
# Where GET /auth/callback 302s the browser back to once a session exists.
APP_BASE_URL = os.getenv("APP_BASE_URL", "/")

# object_store: Amazon S3 (private bucket) -- original uploaded files.
S3_BUCKET = os.getenv("S3_BUCKET", "")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
# When S3_BUCKET is unset, uploads fall back to this local directory so the
# upload endpoint works with no AWS account configured, same convention as
# DATABASE_URL defaulting to a local SQLite file.
LOCAL_UPLOAD_DIR = os.getenv("LOCAL_UPLOAD_DIR", "./uploads")
# Largest accepted upload, in bytes. Default is 25 MiB.
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))

# job_queue: Amazon SQS -- decouples upload acceptance from ingestion.
SQS_INGEST_QUEUE_URL = os.getenv("SQS_INGEST_QUEUE_URL", "")

# model_provider: Amazon Bedrock (chat + embedding), behind a provider
# adapter so the model is swappable by config alone. MODEL_PROVIDER selects
# the adapter (see app.services.providers); adding another in-tenant
# provider is one new adapter plus a value here, no API or schema change.
MODEL_PROVIDER = os.getenv("MODEL_PROVIDER", "bedrock")
BEDROCK_CHAT_MODEL_ID = os.getenv("BEDROCK_CHAT_MODEL_ID", "")
BEDROCK_EMBEDDING_MODEL_ID = os.getenv("BEDROCK_EMBEDDING_MODEL_ID", "")
# Optional private VPC endpoint URL for Bedrock; empty means use the regional
# public-AWS (but in-VPC-routed) bedrock-runtime endpoint for AWS_REGION.
BEDROCK_ENDPOINT_URL = os.getenv("BEDROCK_ENDPOINT_URL", "")
# Comma-separated extra hostnames the adapter may initialise against, for a
# private endpoint whose hostname does not match the standard AWS shapes.
MODEL_PROVIDER_ALLOWED_HOSTS = os.getenv("MODEL_PROVIDER_ALLOWED_HOSTS", "")

# answer_engine: retrieval relevance gating (AC-100/AC-101). A candidate
# chunk scoring below RETRIEVAL_RELEVANCE_THRESHOLD is discarded outright
# before generation; if nothing clears it, /answer returns the not-covered
# response instead of grounding on a weak match. When the best surviving
# candidate still scores below RETRIEVAL_PARTIAL_CONFIDENCE_THRESHOLD, the
# question is treated as only partially supported by the corpus and the
# terminal SSE event's `partial` flag is set. Both are configuration, not a
# literal in app.routers.answer or app.services.retrieval.
RETRIEVAL_RELEVANCE_THRESHOLD = float(os.getenv("RETRIEVAL_RELEVANCE_THRESHOLD", "0.25"))
RETRIEVAL_PARTIAL_CONFIDENCE_THRESHOLD = float(
    os.getenv("RETRIEVAL_PARTIAL_CONFIDENCE_THRESHOLD", "0.45")
)
