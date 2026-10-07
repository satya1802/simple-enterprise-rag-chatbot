"""object_store: Amazon S3 (private bucket) -- original uploaded files.

Writes go to the configured S3 bucket when `S3_BUCKET` is set; otherwise they
fall back to a local directory (`LOCAL_UPLOAD_DIR`) so uploads work with no
AWS account configured, the same convention `DATABASE_URL` uses for SQLite.
"""

import logging
import os

from app.config import AWS_REGION, LOCAL_UPLOAD_DIR, S3_BUCKET

logger = logging.getLogger(__name__)


def save_file(key: str, content: bytes) -> None:
    """Write `content` to object storage under `key`."""
    if S3_BUCKET:
        import boto3

        client = boto3.client("s3", region_name=AWS_REGION)
        client.put_object(Bucket=S3_BUCKET, Key=key, Body=content)
        return

    path = os.path.join(LOCAL_UPLOAD_DIR, key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(content)
    logger.info("S3_BUCKET not configured; wrote %s to local fallback storage at %s", key, path)


def delete_file(key: str) -> None:
    """Best-effort removal of the object at `key`, used to clean up partial writes."""
    try:
        if S3_BUCKET:
            import boto3

            client = boto3.client("s3", region_name=AWS_REGION)
            client.delete_object(Bucket=S3_BUCKET, Key=key)
        else:
            path = os.path.join(LOCAL_UPLOAD_DIR, key)
            if os.path.exists(path):
                os.remove(path)
    except Exception:
        logger.exception("Failed to clean up object storage key %s", key)
