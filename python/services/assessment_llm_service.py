"""Shared Bedrock invoke for assessment LLM flows (with optional vector formula context).

Large prompts are map-reduced via the same chunker used for document extraction.
Applies to every Bedrock model (not Opus-specific).
"""

from __future__ import annotations

import json
from config import get_bedrock_model_id, settings
from services.bedrock_client import create_bedrock_runtime_client
from services.feature_token_quota import prepare_feature_token_invoke, raise_quota
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

_TRUNCATED_STOP_REASONS = frozenset({"max_tokens", "length", "max_length"})


def _estimate_input_tokens(text: str) -> int:
    return max(1, len(text or "") // 4)


def _generation_hit_quota(
    *,
    capped: bool,
    stop_reason: str,
    output_tokens: int,
    allowed_max: int,
) -> bool:
    """True when this call was cut short because remaining quota ran out."""
    if not capped:
        return False
    reason = (stop_reason or "").strip().lower()
    if reason in _TRUNCATED_STOP_REASONS:
        return True
    return allowed_max > 0 and output_tokens >= allowed_max


def _raise_if_quota_hit(gate: dict, *, total_tokens: int) -> None:
    feature = str(gate.get("feature") or "")
    if not feature:
        return
    balance = dict(gate.get("balance") or {})
    balance["output_exceeded"] = True
    balance["consumed"] = int(balance.get("consumed") or 0) + total_tokens
    raise_quota(feature, balance)


def _invoke_bedrock_once(
    text: str,
    *,
    max_tokens: int,
    temperature: float,
    model_id: str,
    allow_cap: bool = True,
) -> str:
    gate = prepare_feature_token_invoke(
        requested_max_tokens=int(max_tokens),
        estimated_input_tokens=_estimate_input_tokens(text),
        allow_cap=allow_cap,
    )
    allowed_max = int(gate["max_tokens"])
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": allowed_max,
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
        f"words={count_words(text)} max_tokens={allowed_max}"
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
            feature=actor.get("feature"),
        )
    stop_reason = str(result.get("stop_reason") or "")
    if _generation_hit_quota(
        capped=bool(gate.get("capped")),
        stop_reason=stop_reason,
        output_tokens=out,
        allowed_max=allowed_max,
    ):
        _raise_if_quota_hit(gate, total_tokens=total)
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
        # First chunk may use remaining tokens; later chunks stop if quota is short.
        partial = _invoke_bedrock_once(
            part_text,
            max_tokens=tokens,
            temperature=temp,
            model_id=resolved_model,
            allow_cap=(index == 1),
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
        allow_cap=False,
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
