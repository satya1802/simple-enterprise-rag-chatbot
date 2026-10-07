"""job_queue: Amazon SQS -- decouples upload acceptance from ingestion.

`POST /documents` calls `enqueue_ingest_job` once per accepted document. When
`SQS_INGEST_QUEUE_URL` is unset this is a logged no-op, so the upload
endpoint still works with no queue provisioned, the same convention the rest
of `app.config`'s dependency knobs use.
"""

import json
import logging

from app.config import SQS_INGEST_QUEUE_URL

logger = logging.getLogger(__name__)


def enqueue_ingest_job(document_id: str) -> None:
    """Enqueue an ingest job for the given document id."""
    if not SQS_INGEST_QUEUE_URL:
        logger.info(
            "SQS_INGEST_QUEUE_URL not configured; skipping ingest enqueue for document %s",
            document_id,
        )
        return

    import boto3

    client = boto3.client("sqs")
    client.send_message(
        QueueUrl=SQS_INGEST_QUEUE_URL,
        MessageBody=json.dumps({"document_id": document_id}),
    )
