"""Shared Bedrock invoke for assessment LLM flows (with optional vector formula context).

Large prompts are map-reduced via the same chunker used for document extraction.
Applies to every Bedrock model (not Opus-specific).
"""

from __future__ import annotations

import json
from config import get_bedrock_model_id, settings
from services.bedrock_client import create_bedrock_runtime_client
from services.llm_usage import record_llm_usage, usage_from_anthropic_result
from services.llm_usage_actor import get_usage_actor
from utils.chunker import chunk_document, count_words

_CHUNK_PARTIAL_INSTRUCTION = (
    "This is PART {part} of {total} of the assessment data. "
    "Analyze only this chunk. Produce partial findings for later merge; "
    "do not claim the report is complete."
)

_CHUNK_MERGE_INSTRUCTION = (
    "Below are partial analyses from chunks of one assessment. "
    "Merge them into a single complete final report. "
    "Resolve contradictions using the most specific evidence; "
    "do not invent facts that are not present in the partials."
)


def _invoke_bedrock_once(
    text: str,
    *,
    max_tokens: int,
    temperature: float,
    model_id: str,
) -> str:
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": int(max_tokens),
        "temperature": float(temperature),
        "messages": [
            {
                "role": "user",
                "content": [{"type": "text", "text": text}],
            }
        ],
    }
    print(
        f"[LLM] assessment invoke using model: {model_id} "
        f"words={count_words(text)}"
    )
    client = create_bedrock_runtime_client()
    response = client.invoke_model(
        modelId=model_id,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(body),
    )
    result = json.loads(response["body"].read())
    inp, out, total = usage_from_anthropic_result(result)
    if inp or out or total:
        actor = get_usage_actor()
        record_llm_usage(
            model_id=model_id,
            input_tokens=inp,
            output_tokens=out,
            total_tokens=total,
            organization_id=actor.get("organization_id"),
            organization_name=actor.get("organization_name"),
            user_id=actor.get("user_id"),
            user_name=actor.get("user_name"),
        )
    content = result.get("content") or []
    if content and isinstance(content[0], dict):
        return str(content[0].get("text") or "")
    return ""


def _should_chunk(total_words: int) -> bool:
    if not bool(getattr(settings, "LLM_CHUNK_ENABLED", True)):
        return False
    threshold = int(getattr(settings, "LLM_PROMPT_CHUNK_THRESHOLD", 2400) or 2400)
    return total_words > max(200, threshold)


def invoke_bedrock_with_chunking(
    *,
    stable_prefix: str,
    payload: str,
    max_tokens: int | None = None,
    temperature: float = 0.3,
    model_id: str | None = None,
) -> str:
    """
    Invoke Bedrock for any model. When prefix+payload is large, chunk the payload
    by word count (RecursiveCharacterTextSplitter + word length), invoke per chunk,
    then merge.
    """
    prefix = (stable_prefix or "").strip()
    data = (payload or "").strip()
    if not prefix and not data:
        return ""

    tokens = int(max_tokens or settings.MAX_TOKENS or 8192)
    temp = float(temperature)
    resolved_model = (model_id or "").strip() or get_bedrock_model_id()
    combined = f"{prefix}\n\n{data}".strip() if prefix and data else (prefix or data)

    if not data or not _should_chunk(count_words(combined)):
        return _invoke_bedrock_once(
            combined,
            max_tokens=tokens,
            temperature=temp,
            model_id=resolved_model,
        )

    chunks = chunk_document(data)
    if len(chunks) <= 1:
        return _invoke_bedrock_once(
            combined,
            max_tokens=tokens,
            temperature=temp,
            model_id=resolved_model,
        )

    total = len(chunks)
    print(
        f"[LLM] chunking enabled model={resolved_model} "
        f"payload_words={count_words(data)} chunks={total}"
    )
    partials: list[str] = []
    for index, chunk in enumerate(chunks, start=1):
        part_header = _CHUNK_PARTIAL_INSTRUCTION.format(part=index, total=total)
        parts = [p for p in (prefix, part_header, chunk) if p]
        part_text = "\n\n".join(parts)
        partial = _invoke_bedrock_once(
            part_text,
            max_tokens=tokens,
            temperature=temp,
            model_id=resolved_model,
        )
        if (partial or "").strip():
            partials.append(f"### Chunk {index}/{total} findings\n{partial.strip()}")

    if not partials:
        return ""
    if len(partials) == 1:
        return partials[0].split("\n", 1)[-1].strip()

    merge_body = "\n\n".join(partials)
    merge_parts = [p for p in (prefix, _CHUNK_MERGE_INSTRUCTION, merge_body) if p]
    return _invoke_bedrock_once(
        "\n\n".join(merge_parts),
        max_tokens=tokens,
        temperature=temp,
        model_id=resolved_model,
    )


def invoke_assessment_llm(
    user_prompt: str,
    *,
    formula_context: str = "",
    max_tokens: int | None = None,
    temperature: float = 0.3,
    model_id: str | None = None,
) -> str:
    """Invoke Bedrock with optional pgvector formula context (chunked when large)."""
    return invoke_bedrock_with_chunking(
        stable_prefix=(formula_context or "").strip(),
        payload=(user_prompt or "").strip(),
        max_tokens=max_tokens,
        temperature=temperature,
        model_id=model_id,
    )
