"""Shared Bedrock Runtime client with timeouts suitable for long Claude invokes."""

from __future__ import annotations

from typing import Any

import boto3
from botocore.config import Config

from config import settings


def create_bedrock_runtime_client() -> Any:
    """
    boto3 bedrock-runtime client.

    Default botocore read_timeout is 60s; Claude Opus with large assessment
    prompts + high max_tokens routinely exceeds that and raises ReadTimeoutError.
    """
    read_timeout = int(getattr(settings, "BEDROCK_READ_TIMEOUT", 300) or 300)
    connect_timeout = int(getattr(settings, "BEDROCK_CONNECT_TIMEOUT", 10) or 10)
    kwargs: dict[str, Any] = {
        "region_name": settings.AWS_REGION,
        "config": Config(
            connect_timeout=connect_timeout,
            read_timeout=read_timeout,
            retries={"max_attempts": 2, "mode": "standard"},
        ),
    }
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
        kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
        if (settings.AWS_SESSION_TOKEN or "").strip():
            kwargs["aws_session_token"] = settings.AWS_SESSION_TOKEN
    return boto3.client("bedrock-runtime", **kwargs)
