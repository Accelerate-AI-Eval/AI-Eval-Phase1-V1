"""
Type 2 (cots_vendor) and Type 3 (cots_buyer) formula scoring.
Formulas live in Python (same ownership model as VTS /assessment/score).
Node calls these endpoints and persists.
pgvector formula chunks are retrieved for audit/context (deterministic math stays in code).
"""

from __future__ import annotations

import json
import logging
import traceback
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from exceptions.custom_exceptions import raise_http_exception
from services.buyer_implementation_risk_formula import (
    calculate_buyer_implementation_risk_score,
)
from services.sales_risk_formula import (
    build_sales_risk_formula_input,
    calculate_sales_risk_score,
)
from services.score_rationale import print_irs_rationale, print_srs_rationale
from services.vts_vector_retrieval import retrieve_formula_context

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/assessment",
    tags=["Assessment"],
)


class CotsVendorScoreRequest(BaseModel):
    payload: dict[str, Any] | None = None
    formula_input: dict[str, Any] | None = None


class CotsBuyerScoreRequest(BaseModel):
    buyer_payload: dict[str, Any] = Field(default_factory=dict)
    attestation_row: dict[str, Any] | None = None
    vendor_name: str = "Vendor"
    product_name: str = "Product"


def _vector_meta(assessment_type: str, query_text: str) -> dict[str, Any]:
    """Best-effort pgvector formula retrieval; never fails scoring."""
    try:
        retrieved = retrieve_formula_context(assessment_type, query_text)
        return {
            "used": bool(retrieved.get("used")),
            "chunks": retrieved.get("chunks") or [],
            "assessment_type": retrieved.get("assessment_type") or assessment_type,
            "error": retrieved.get("error"),
        }
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Vector formula retrieval (%s) failed: %s", assessment_type, exc)
        return {
            "used": False,
            "chunks": [],
            "assessment_type": assessment_type,
            "error": str(exc),
        }


@router.post("/cots-vendor/score")
async def score_cots_vendor(body: CotsVendorScoreRequest) -> dict[str, Any]:
    """Sales Risk Score (Type 2) — deterministic formula owned by Python."""
    try:
        if body.formula_input and isinstance(body.formula_input, dict):
            formula_input = body.formula_input
        elif body.payload and isinstance(body.payload, dict):
            formula_input = build_sales_risk_formula_input(body.payload)
        else:
            raise_http_exception("payload or formula_input is required", status_code=400)

        result = calculate_sales_risk_score(formula_input)
        srs = float(result.get("sales_risk_score") or 0)
        print(f"srs {srs}", flush=True)
        query_blob = json.dumps(body.payload or formula_input, default=str)[:800]
        vector_meta = _vector_meta("cots_vendor", query_blob)
        rationale = print_srs_rationale(
            result=result,
            formula_input=formula_input,
            payload=body.payload if isinstance(body.payload, dict) else None,
        )
        return {
            **result,
            "scoring_source": "formula+vector" if vector_meta.get("used") else "formula",
            "scoring_version": "srs-1.1",
            "rationale": rationale,
            "vector_retrieval": vector_meta,
        }
    except Exception as exc:
        logger.error("cots-vendor score failed: %s\n%s", exc, traceback.format_exc())
        raise_http_exception(str(exc) or "cots-vendor scoring failed", status_code=500)


@router.post("/cots-buyer/score")
async def score_cots_buyer(body: CotsBuyerScoreRequest) -> dict[str, Any]:
    """Buyer Implementation Risk Score (Type 3) — deterministic formula owned by Python."""
    try:
        buyer_payload = body.buyer_payload if isinstance(body.buyer_payload, dict) else {}
        attestation = body.attestation_row if isinstance(body.attestation_row, dict) else None
        result = calculate_buyer_implementation_risk_score(
            buyer_payload,
            attestation,
            body.vendor_name or "Vendor",
            body.product_name or "Product",
        )
        irs = float(result.get("implementationRiskScore") or 0)
        print(f"irs {irs}", flush=True)
        query_blob = json.dumps(
            {
                "buyer": buyer_payload,
                "vendor": body.vendor_name,
                "product": body.product_name,
            },
            default=str,
        )[:800]
        vector_meta = _vector_meta("cots_buyer", query_blob)
        rationale = print_irs_rationale(result=result, buyer_payload=buyer_payload)
        return {
            **result,
            "scoring_source": "formula+vector" if vector_meta.get("used") else "formula",
            "scoring_version": "irs-1.1",
            "rationale": rationale,
            "vector_retrieval": vector_meta,
        }
    except Exception as exc:
        logger.error("cots-buyer score failed: %s\n%s", exc, traceback.format_exc())
        raise_http_exception(str(exc) or "cots-buyer scoring failed", status_code=500)
