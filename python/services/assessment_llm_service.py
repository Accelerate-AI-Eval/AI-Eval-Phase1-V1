"""Shared Bedrock invoke for assessment LLM flows (with optional vector formula context)."""

from __future__ import annotations

import json
from typing import Any

import boto3

from config import get_bedrock_model_id, settings


def _bedrock_client():
    kwargs: dict[str, Any] = {"region_name": settings.AWS_REGION}
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
        kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    return boto3.client("bedrock-runtime", **kwargs)


def invoke_assessment_llm(
    user_prompt: str,
    *,
    formula_context: str = "",
    max_tokens: int | None = None,
    temperature: float = 0.3,
    model_id: str | None = None,
) -> str:
    """Invoke Claude with optional pgvector formula context prepended."""
    text = ((formula_context or "") + (user_prompt or "")).strip()
    if not text:
        return ""
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": int(max_tokens or settings.MAX_TOKENS or 8192),
        "temperature": float(temperature),
        "messages": [
            {
                "role": "user",
                "content": [{"type": "text", "text": text}],
            }
        ],
    }
    resolved_model = (model_id or "").strip() or get_bedrock_model_id()
    print(f"[LLM] assessment invoke using model: {resolved_model}")
    client = _bedrock_client()
    response = client.invoke_model(
        modelId=resolved_model,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(body),
    )
    result = json.loads(response["body"].read())
    content = result.get("content") or []
    if content and isinstance(content[0], dict):
        return str(content[0].get("text") or "")
    return ""
