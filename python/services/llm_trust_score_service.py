"""
LLM Vendor Trust Score — same Bedrock approach as Node vendorAttestation.ts agent path.

The model produces Overall Trust Score (0–100) + report sections from vendor data.
Uses boto3 InvokeModel (no langchain) so scoring works even when extraction stack is optional.
"""

from __future__ import annotations

import json
import re
from typing import Any

import boto3

from config import get_bedrock_model_id, settings
from prompts.vendor_attestation_prompt import VENDOR_ATTESTATION_PROMPT

SECTION_TITLES = {
    0: "Trust Score",
    1: "Product Information",
    2: "Company Identity",
    3: "AI Models & Technology",
    4: "AI Governance",
    5: "Security Posture",
    6: "Data Practices",
    7: "Compliance & Certifications",
    8: "Operations & Support",
    9: "Vendor Management",
    10: "AI Safety & Testing",
    11: "Evidence & Trust",
    12: "Company Reach",
}

TRUST_SCORE_KNOWN_CATEGORIES = [
    "Security",
    "Compliance",
    "Data Practices",
    "AI Governance",
    "Operations",
    "Company Maturity",
]


def _bedrock_client():
    kwargs: dict[str, Any] = {"region_name": settings.AWS_REGION}
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
        kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    return boto3.client("bedrock-runtime", **kwargs)


def invoke_vendor_attestation_llm(
    vendor_data: str,
    *,
    formula_context: str = "",
) -> str:
    """Invoke Claude on Bedrock with attestation prompt + optional pgvector formula context."""
    # Formula/rubric context from vector DB first, then prompt, then vendor facts.
    user_input = (
        (formula_context or "")
        + VENDOR_ATTESTATION_PROMPT
        + (vendor_data or "")
    )
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": int(settings.MAX_TOKENS or 4096),
        "temperature": 0.3,
        "messages": [
            {
                "role": "user",
                "content": [{"type": "text", "text": user_input}],
            }
        ],
    }
    client = _bedrock_client()
    model_id = get_bedrock_model_id()
    print(f"[LLM] vendor attestation invoke using model: {model_id}")
    response = client.invoke_model(
        modelId=model_id,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(body),
    )
    result = json.loads(response["body"].read())
    content = result.get("content") or []
    if content and isinstance(content[0], dict):
        return str(content[0].get("text") or "")
    return ""


def _parse_bullet_items(text: str) -> dict[str, str]:
    items: dict[str, str] = {}
    bullet_regex = re.compile(
        r"^[-*]\s*\*\*(.+?):\*\*\s*([\s\S]*?)(?=\n\s*[-*]\s*\*\*[A-Za-z][^\n]*:|\n\s*##\s*\d|$)",
        re.MULTILINE,
    )
    for m in bullet_regex.finditer(text):
        label = m.group(1).strip()
        value = re.sub(r"\n", " ", m.group(2)).strip()
        if label and value:
            items[label] = value
    return items


def _parse_category_scores(section_text: str, items: dict[str, str]) -> dict[str, Any] | None:
    score_by_category: dict[str, Any] = {}
    raw = items.get("Score by category") or ""
    if not raw and re.search(r"Score by category", section_text, re.I):
        m = re.search(
            r"\*\*Score by category\*\*:?\s*([\s\S]*?)(?=\n\s*[-*]\s*\*\*|\n\s*##|$)",
            section_text,
            re.I,
        )
        if m:
            raw = m.group(1).strip()
    blob = raw or section_text
    for cat in TRUST_SCORE_KNOWN_CATEGORIES:
        pat = re.compile(
            rf"{re.escape(cat)}\s*[:=]\s*(\d{{1,3}}|Not enough data)",
            re.I,
        )
        m = pat.search(blob)
        if m:
            val = m.group(1)
            if val.isdigit():
                score_by_category[cat] = min(100, max(0, int(val)))
            else:
                score_by_category[cat] = val
    return score_by_category or None


def parse_trust_score_block(section_text: str) -> dict[str, Any]:
    items = _parse_bullet_items(section_text)
    overall = items.get("Overall Trust Score") or ""

    overall_with_paren = re.search(
        r"\*\*Overall Trust Score\*\*:\s*(\d+)\s*\(([^)]+)\)",
        section_text,
        re.I,
    )
    if overall_with_paren:
        overall = f"{overall_with_paren.group(1)} ({overall_with_paren.group(2).strip()})"
    elif not overall and re.search(r"Overall Trust Score", section_text, re.I):
        direct = re.search(
            r"\*\*Overall Trust Score\*\*:\s*(\d+)\s*[(\[]?\s*([^)\]]*)",
            section_text,
            re.I,
        )
        if direct:
            overall = f"{direct.group(1)} ({(direct.group(2) or '').strip()})".strip()

    match = re.search(r"(\d+)\s*[(\[]?\s*([^)\]]*)", overall)
    overall_score = min(100, max(0, int(match.group(1)))) if match else 0
    label = (match.group(2).strip() if match and match.group(2) else "") or "Not specified"
    if overall_score > 0 and (not label or label == "Not specified") and re.search(r"\([^)]+\)", section_text):
        paren = re.search(
            r"\*\*Overall Trust Score\*\*:\s*\d+\s*\(([^)]+)\)",
            section_text,
            re.I,
        ) or re.search(r"\d+\s*\(([^)]+)\)", section_text)
        if paren:
            label = paren.group(1).strip()

    summary = items.get("Summary") or ""
    if not summary and re.search(r"Summary", section_text, re.I):
        sm = (
            re.search(
                r"\*\*Summary\*\*:\s*([\s\S]*?)(?=\n\s*##|\n\s*[-*]\s*\*\*|$)",
                section_text,
                re.I,
            )
            or re.search(
                r"[-*]\s*\*\*Summary\*\*:\s*([\s\S]*?)(?=\n\s*##|\n\s*[-*]\s*\*\*|$)",
                section_text,
                re.I,
            )
            or re.search(
                r"Summary:\s*([\s\S]*?)(?=\n\s*##|\n\s*[-*]\s*\*\*|$)",
                section_text,
                re.I,
            )
        )
        if sm:
            summary = re.sub(r"\n+", " ", sm.group(1)).strip()

    score_by_category = _parse_category_scores(section_text, items)
    result: dict[str, Any] = {
        "overallScore": overall_score,
        "label": label,
        "summary": summary,
    }
    if score_by_category:
        result["scoreByCategory"] = score_by_category
    return result


def extract_summary_from_raw_reply(raw_reply: str) -> str:
    if not raw_reply:
        return ""

    def clean(s: str) -> str:
        t = re.sub(r"\s*\n\s*", " ", s).strip()
        no_asterisks = re.sub(r"^\*+|\*+$", "", t).strip()
        if no_asterisks and not re.match(r"^\*+$", no_asterisks):
            return no_asterisks
        return t if t and not re.match(r"^\*+$", t) else ""

    primary = re.search(
        r"(?:^|\n)\s*[-*]?\s*\*\*Summary\*\*:?\s*([\s\S]*?)(?=\n\s*[-*]\s*\*\*|\n\s*##\s*\d|$)",
        raw_reply,
        re.I,
    )
    if primary:
        value = clean(primary.group(1))
        if value:
            return value

    split = re.split(r"\*\*Summary\*\*:?\s*", raw_reply, maxsplit=1, flags=re.I)
    if len(split) > 1:
        rest = re.split(r"\n\s*(?:[-*]\s*\*\*|##\s*\d)", split[1], maxsplit=1)[0]
        value = clean(rest)
        if value:
            return value

    line = re.search(r"(?:^|\n)\s*Summary\s*:?\s*(.+)", raw_reply, re.I)
    if line:
        value = clean(line.group(1))
        if value:
            return value
    return ""


def parse_report_sections(raw_reply: str) -> dict[str, Any]:
    sections: list[dict[str, Any]] = []
    trust_score: dict[str, Any] = {
        "overallScore": 0,
        "label": "Not specified",
        "summary": "",
    }

    section_regex = re.compile(r"##\s*(\d+)\.?\s*([^\n]*)\n([\s\S]*?)(?=##\s*\d|$)")
    for m in section_regex.finditer(raw_reply):
        section_id = int(m.group(1))
        title_line = m.group(2).strip()
        body = m.group(3).strip()
        title = SECTION_TITLES.get(section_id) or title_line or f"Section {section_id}"
        subtitle = title_line if title_line and title_line != title else None

        if section_id == 0:
            trust_score = parse_trust_score_block(body)
            continue

        items = _parse_bullet_items(body)
        entry: dict[str, Any] = {"id": section_id, "title": title, "items": items}
        if subtitle:
            entry["subtitle"] = subtitle
        sections.append(entry)

    need_fallback = (
        trust_score["overallScore"] == 0
        or trust_score.get("summary") == ""
        or trust_score.get("label") == "Not specified"
    )
    if need_fallback and re.search(r"Overall Trust Score|Trust Score|Summary", raw_reply, re.I):
        overall_idx = _search(raw_reply, r"\*\*Overall Trust Score\*\*|Overall Trust Score\s*:")
        section_zero_idx = _search(raw_reply, r"##\s*0\.?\s*Trust Score|##\s*Trust Score\b")
        start_idx = (
            overall_idx
            if overall_idx >= 0
            else section_zero_idx
            if section_zero_idx >= 0
            else _search(raw_reply, r"\bTrust Score\b")
        )
        block = ""
        if start_idx >= 0:
            rest = raw_reply[start_idx:]
            end_m = re.search(r"\n\s*##\s*[1-9][.\s]", rest)
            block = rest[: end_m.start()].strip() if end_m else rest.strip()
        if not block and re.search(r"Overall Trust Score", raw_reply, re.I):
            before = re.split(r"\n\s*##\s*1[.\s]", raw_reply, maxsplit=1)[0]
            if before and len(before) < len(raw_reply):
                block = before.strip()
        if block:
            parsed = parse_trust_score_block(block)
            if (
                parsed["overallScore"] > 0
                or parsed.get("summary")
                or (parsed.get("label") and parsed["label"] != "Not specified")
            ):
                trust_score = {
                    "overallScore": parsed["overallScore"] or trust_score["overallScore"],
                    "label": parsed["label"]
                    if parsed.get("label") and parsed["label"] != "Not specified"
                    else trust_score["label"],
                    "summary": parsed.get("summary") or trust_score.get("summary") or "",
                }
                if parsed.get("scoreByCategory"):
                    trust_score["scoreByCategory"] = parsed["scoreByCategory"]

    if re.search(r"Overall Trust Score", raw_reply, re.I):
        with_label = re.search(
            r"\*\*Overall Trust Score\*\*:\s*(\d{1,3})\s*\(([^)]+)\)",
            raw_reply,
            re.I,
        )
        num_only = re.search(
            r"\*\*Overall Trust Score\*\*:\s*(\d{1,3})\b",
            raw_reply,
            re.I,
        ) or re.search(r"Overall Trust Score\s*:\s*(\d{1,3})\b", raw_reply, re.I)
        if with_label:
            n = int(with_label.group(1))
            if 0 <= n <= 100:
                trust_score = {
                    **trust_score,
                    "overallScore": n,
                    "label": (
                        with_label.group(2).strip()
                        if trust_score.get("label") == "Not specified"
                        else trust_score.get("label")
                    )
                    or "Not specified",
                }
        elif trust_score["overallScore"] == 0 and num_only:
            n = int(num_only.group(1))
            if 0 <= n <= 100:
                trust_score = {**trust_score, "overallScore": n}

    if not str(trust_score.get("summary") or "").strip() and (
        re.search(r"\*\*Summary\*\*:", raw_reply, re.I)
        or re.search(r"\*\*Summary\*\*\s*\n", raw_reply, re.I)
    ):
        from_raw = extract_summary_from_raw_reply(raw_reply)
        if from_raw:
            trust_score = {**trust_score, "summary": from_raw}

    return {"trustScore": trust_score, "sections": sections}


def _search(text: str, pattern: str) -> int:
    m = re.search(pattern, text, re.I)
    return m.start() if m else -1


def generate_llm_trust_report(
    vendor_data: str,
    *,
    formula_context: str = "",
    vector_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Call Bedrock (with optional pgvector formula context) and return:
    { trustScore, sections, raw, overall_score, vector }
    """
    raw = invoke_vendor_attestation_llm(
        vendor_data,
        formula_context=formula_context or "",
    )
    if not (raw or "").strip():
        raise RuntimeError("LLM returned empty trust-score response")

    parsed = parse_report_sections(raw)
    trust = parsed["trustScore"]
    overall = int(trust.get("overallScore") or 0)
    if overall <= 0:
        # last-chance numeric hunt
        m = re.search(r"\b(\d{1,3})\s*/\s*100\b", raw) or re.search(
            r"Overall[^0-9]{0,40}(\d{1,3})",
            raw,
            re.I,
        )
        if m:
            n = int(m.group(1))
            if 0 <= n <= 100:
                overall = n
                trust = {**trust, "overallScore": n}

    if overall <= 0:
        raise RuntimeError("LLM response did not include a parseable Overall Trust Score")

    return {
        "trustScore": trust,
        "sections": parsed["sections"],
        "raw": raw,
        "overall_score": overall,
        "vector": vector_meta or {
            "used": bool((formula_context or "").strip()),
            "chunks": [],
        },
    }
