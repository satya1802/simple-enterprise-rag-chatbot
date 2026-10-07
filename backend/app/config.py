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
# Where GET /auth/callback 302s the browser back to once a session exists.
APP_BASE_URL = os.getenv("APP_BASE_URL", "/")

# object_store: Amazon S3 (private bucket) -- original uploaded files.
S3_BUCKET = os.getenv("S3_BUCKET", "")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

# job_queue: Amazon SQS -- decouples upload acceptance from ingestion.
SQS_INGEST_QUEUE_URL = os.getenv("SQS_INGEST_QUEUE_URL", "")

# model_provider: Amazon Bedrock (chat + embedding), behind a provider
# adapter so the model is swappable by config alone.
BEDROCK_CHAT_MODEL_ID = os.getenv("BEDROCK_CHAT_MODEL_ID", "")
BEDROCK_EMBEDDING_MODEL_ID = os.getenv("BEDROCK_EMBEDDING_MODEL_ID", "")
