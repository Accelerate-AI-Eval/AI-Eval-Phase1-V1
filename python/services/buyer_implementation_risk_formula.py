"""Buyer Implementation Risk Score — ported from buyerImplementationRiskScore.ts."""

from __future__ import annotations

import json
import math
import re
from typing import Any


def _clamp01(v: float) -> float:
    if not math.isfinite(v):
        return 0.0
    return max(0.0, min(100.0, v))


def _norm(v: Any) -> str:
    return str(v if v is not None else "").strip().lower()


def _bool_yes(v: Any) -> bool:
    s = _norm(v)
    return s in ("yes", "true", "available", "exists", "defined")


def _parse_list(v: Any) -> list[str]:
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    if isinstance(v, str):
        t = v.strip()
        if not t:
            return []
        try:
            parsed = json.loads(t)
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
        return [x.strip() for x in re.split(r",|;|\r?\n", t) if x.strip()]
    return []


def _extract_vendor_trust_score(attestation_row: dict[str, Any] | None) -> float:
    if not attestation_row:
        return 50.0
    report = attestation_row.get("generated_profile_report")
    if not isinstance(report, dict):
        report = {}
    trust_score = report.get("trustScore")
    if not isinstance(trust_score, dict):
        trust_score = {}
    formula = report.get("formula")
    if not isinstance(formula, dict):
        formula = {}
    raw = (
        trust_score.get("overallScore")
        if trust_score.get("overallScore") is not None
        else (
            formula.get("vendor_trust_score")
            if formula.get("vendor_trust_score") is not None
            else report.get("vendor_trust_score")
        )
    )
    try:
        n = float(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        n = float("nan")
    return _clamp01(n if math.isfinite(n) else 50.0)


def _calculate_org_readiness_gap(buyer_payload: dict[str, Any]) -> float:
    risk = 35.0
    digital = _norm(buyer_payload.get("digitalMaturityLevel"))
    if "high" in digital or "advanced" in digital:
        risk -= 10
    elif "medium" in digital:
        risk -= 4
    elif "low" in digital or "ad-hoc" in digital:
        risk += 10

    governance = _norm(buyer_payload.get("dataGovernanceMaturity"))
    if "optimized" in governance or "managed" in governance:
        risk -= 8
    elif "basic" in governance:
        risk += 4
    elif "ad-hoc" in governance or "low" in governance:
        risk += 10

    if not _bool_yes(buyer_payload.get("aiGovernanceBoard")):
        risk += 8
    if not _bool_yes(buyer_payload.get("aiEthicsPolicy")):
        risk += 8

    team = _parse_list(buyer_payload.get("implementationTeamComposition"))
    if len(team) >= 4:
        risk -= 6
    elif len(team) <= 1:
        risk += 8

    appetite = _norm(buyer_payload.get("riskAppetite"))
    criticality = _norm(buyer_payload.get("criticality"))
    if (
        ("high" in criticality or "critical" in criticality)
        and "aggressive" in appetite
    ):
        risk += 8
    if (
        ("low" in criticality or "medium" in criticality)
        and "conservative" in appetite
    ):
        risk -= 2
    return _clamp01(risk)


def _calculate_integration_risk(buyer_payload: dict[str, Any]) -> float:
    risk = 25.0
    systems = _parse_list(buyer_payload.get("integrationSystems"))
    risk += min(30, len(systems) * 6)

    gaps = str(buyer_payload.get("requirementGaps") or "").strip()
    if len(gaps) > 0:
        risk += 12

    rollback = _norm(buyer_payload.get("rollbackCapability"))
    if "no" in rollback:
        risk += 12
    elif "manual" in rollback:
        risk += 6
    else:
        risk -= 3

    if not _bool_yes(buyer_payload.get("monitoringDataAvailable")):
        risk += 6
    if not _bool_yes(buyer_payload.get("auditLogsAvailable")):
        risk += 6
    if not _bool_yes(buyer_payload.get("testingResultsAvailable")):
        risk += 6
    return _clamp01(risk)


def _interpret(score: float) -> dict[str, str]:
    s = max(0, min(100, round(float(score))))
    if s >= 76:
        return {
            "grade": "A",
            "classification": "High Readiness",
            "decision": "PROCEED",
            "readiness_profile": "Organization ready; vendor capable; integration straightforward ",
            "recommendedAction": "Proceed with standard implementation timeline.",
        }
    if s >= 51:
        return {
            "grade": "B",
            "classification": "Moderate Readiness",
            "decision": "PROCEED WITH CAUTION",
            "readiness_profile": "Some gaps exist; manageable with planning",
            "recommendedAction": "Proceed with gap mitigation plan; extend timeline 20-30%.",
        }
    if s >= 26:
        return {
            "grade": "C",
            "classification": "Low Readiness",
            "decision": "PROCEED WITH CAUTION",
            "readiness_profile": "Significant gaps; risk of failure if not addressed.",
            "recommendedAction": "Proceed with caution; extend timeline 50-100%; pilot first.",
        }
    return {
        "grade": "D",
        "classification": "Readiness Review Required",
        "decision": "DO NOT PROCEED",
        "readiness_profile": "Major gaps across dimensions; additional preparation needed",
        "recommendedAction": "Do not proceed until critical gaps are resolved; reassess after remediation.",
    }


def buyer_implementation_readiness_grade_from_score(raw_score: float) -> str:
    """Letter grade for a stored IRS (0–100); uses integer rounding (e.g. 45.5 → 46)."""
    return _interpret(raw_score)["grade"]


def calculate_buyer_implementation_risk_score(
    buyer_payload: dict[str, Any],
    attestation_row: dict[str, Any] | None,
    vendor_name: str,
    product_name: str,
) -> dict[str, Any]:
    vendor_trust_score = _extract_vendor_trust_score(attestation_row)
    vendor_risk = _clamp01(100 - vendor_trust_score)
    organizational_readiness_gap = _calculate_org_readiness_gap(buyer_payload)
    integration_risk = _calculate_integration_risk(buyer_payload)
    weighted = 100 - (
        vendor_risk * 0.35
        + organizational_readiness_gap * 0.35
        + integration_risk * 0.3
    )
    implementation_risk_score = round(_clamp01(weighted))
    interpreted = _interpret(implementation_risk_score)

    return {
        "implementationRiskScore": implementation_risk_score,
        "grade": interpreted["grade"],
        "classification": interpreted["classification"],
        "decision": interpreted["decision"],
        "readiness_profile": interpreted["readiness_profile"],
        "recommendedAction": interpreted["recommendedAction"],
        "formula": (
            "IRS = 100 - ((Vendor_Risk × 0.35) + (Organizational_Readiness_Gap × 0.35)"
            " + (Integration_Risk × 0.30))"
        ),
        "breakdown": {
            "vendorRisk": vendor_risk,
            "organizationalReadinessGap": organizational_readiness_gap,
            "integrationRisk": integration_risk,
            "vendorTrustScore": vendor_trust_score,
        },
        "source": {
            "vendorName": vendor_name or "Vendor",
            "productName": product_name or "Product",
            "usedAttestation": attestation_row is not None,
        },
    }


__all__ = [
    "calculate_buyer_implementation_risk_score",
    "buyer_implementation_readiness_grade_from_score",
]
