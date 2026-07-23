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
    """True for bare yes/true and Buyer COTS options like 'Yes - Active board…'."""
    if isinstance(v, bool):
        return v
    s = _norm(v)
    return s.startswith("yes") or s in ("true", "available", "exists", "defined")


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


def _is_high_stakes(criticality: str) -> bool:
    return any(
        token in criticality
        for token in ("life or death", "major financial", "high", "critical")
    )


def _is_low_or_medium_stakes(criticality: str) -> bool:
    return any(
        token in criticality
        for token in ("low impact", "minimal", "moderate impact", "medium", "low")
    )


def _is_aggressive_appetite(appetite: str) -> bool:
    return (
        "aggressive" in appetite
        or "very high" in appetite
        or appetite.startswith("high")
    )


def _is_conservative_appetite(appetite: str) -> bool:
    return (
        "conservative" in appetite
        or "very low" in appetite
        or appetite.startswith("low")
    )


def _calculate_org_readiness_gap(buyer_payload: dict[str, Any]) -> float:
    risk = 35.0
    digital = _norm(buyer_payload.get("digitalMaturityLevel"))
    # Buyer COTS uses Level 1–5; also accept legacy high/medium/low labels.
    if (
        "level 5" in digital
        or "level 4" in digital
        or "high" in digital
        or "advanced" in digital
    ):
        risk -= 10
    elif "level 3" in digital or "medium" in digital:
        risk -= 4
    elif (
        "level 1" in digital
        or "level 2" in digital
        or "low" in digital
        or "ad-hoc" in digital
    ):
        risk += 10

    governance = _norm(buyer_payload.get("dataGovernanceMaturity"))
    if (
        "optimized" in governance
        or "managed" in governance
        or "mature" in governance
    ):
        risk -= 8
    elif "basic" in governance or "developing" in governance:
        risk += 4
    elif (
        "ad-hoc" in governance
        or "low" in governance
        or "initial" in governance
        or governance.startswith("none")
    ):
        risk += 10

    if not _bool_yes(buyer_payload.get("aiGovernanceBoard")):
        risk += 8
    if not _bool_yes(buyer_payload.get("aiEthicsPolicy")):
        risk += 8

    team = _parse_list(buyer_payload.get("implementationTeamComposition"))
    # "No Team Assigned Yet" is a single list item but means no team.
    team_roles = [t for t in team if "no team" not in _norm(t)]
    if len(team_roles) >= 4:
        risk -= 6
    elif len(team_roles) <= 1:
        risk += 8

    appetite = _norm(buyer_payload.get("riskAppetite"))
    criticality = _norm(buyer_payload.get("criticality"))
    if _is_high_stakes(criticality) and _is_aggressive_appetite(appetite):
        risk += 8
    if _is_low_or_medium_stakes(criticality) and _is_conservative_appetite(appetite):
        risk -= 2
    return _clamp01(risk)


def _calculate_integration_risk(buyer_payload: dict[str, Any]) -> float:
    risk = 25.0
    systems = _parse_list(buyer_payload.get("integrationSystems"))
    # Ignore placeholder "no integrations" entries for system-count risk.
    systems = [
        s
        for s in systems
        if "no integration" not in _norm(s) and _norm(s) != "none"
    ]
    risk += min(30, len(systems) * 6)

    gaps = str(buyer_payload.get("requirementGaps") or "").strip()
    if len(gaps) > 0:
        risk += 12

    rollback = _norm(buyer_payload.get("rollbackCapability"))
    if (
        rollback.startswith("none")
        or "no rollback" in rollback
        or rollback == "no"
    ):
        risk += 12
    elif (
        "manual" in rollback
        or rollback.startswith("moderate")
        or rollback.startswith("limited")
    ):
        risk += 6
    else:
        # Instant / automated / rapid (non-manual) or other capable rollback
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


def _round_half_up(x: float) -> int:
    """Match JavaScript Math.round for non-negative values (half away from zero / toward +inf)."""
    if not math.isfinite(x):
        return 0
    return int(math.floor(float(x) + 0.5))


def _calc_intent_multiplier(p: dict[str, Any]) -> dict[str, Any]:
    """
    Intent multiplier for type 3 (IRS), same bands as VTS / AI Risk Intellect enrichment.
    Intentional increases the risk term (lowers IRS); Unintentional reduces it.
    """
    raw_value = p.get("intent_multiplier_value")
    if raw_value is None:
        raw_value = p.get("intentMultiplierValue")
    if raw_value is not None:
        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            value = 1.0
        if not (0.5 <= value <= 1.5):
            value = 1.0
        profile = str(p.get("intent_profile") or p.get("intentProfile") or "Mixed")
        return {
            "intentional_count": int(p.get("intentionalRiskCount") or 0),
            "unintentional_count": int(p.get("unintentionalRiskCount") or 0),
            "profile": profile,
            "value": value,
        }

    intentional = int(p.get("intentionalRiskCount") or 0)
    unintentional = int(p.get("unintentionalRiskCount") or 0)
    total = intentional + unintentional
    if total == 0:
        return {
            "intentional_count": 0,
            "unintentional_count": 0,
            "profile": "Mixed",
            "value": 1.0,
        }
    intentional_pct = intentional / total
    unintentional_pct = unintentional / total
    if intentional_pct > 0.6:
        value, profile = 1.2, "Intentional"
    elif unintentional_pct > 0.6:
        value, profile = 0.7, "Unintentional"
    else:
        value, profile = 1.0, "Mixed"
    return {
        "intentional_count": intentional,
        "unintentional_count": unintentional,
        "profile": profile,
        "value": value,
    }


def _irs_final_from_parts(
    vendor_risk: float,
    org_gap: float,
    integration_risk: float,
    intent_value: float = 1.0,
) -> tuple[int, float, float, float]:
    """
    Canonical IRS: round each risk component to 2 decimals, then half-up to an int score.
    Intent multiplier scales the composite risk term (from AI Risk Intellect when configured).
    """
    try:
        intent_value = float(intent_value)
    except (TypeError, ValueError):
        intent_value = 1.0
    if not (0.5 <= intent_value <= 1.5):
        intent_value = 1.0
    vr = round(_clamp01(vendor_risk), 2)
    org = round(_clamp01(org_gap), 2)
    integ = round(_clamp01(integration_risk), 2)
    risk_term = (vr * 0.35 + org * 0.35 + integ * 0.30) * intent_value
    weighted = 100.0 - risk_term
    return _round_half_up(_clamp01(weighted)), vr, org, integ


def buyer_implementation_readiness_grade_from_score(raw_score: float) -> str:
    """Letter grade for a stored IRS (0–100); uses integer rounding (e.g. 45.5 → 46)."""
    return _interpret(raw_score)["grade"]


def calculate_buyer_implementation_risk_score(
    buyer_payload: dict[str, Any],
    attestation_row: dict[str, Any] | None,
    vendor_name: str,
    product_name: str,
) -> dict[str, Any]:
    vendor_trust_score = round(_extract_vendor_trust_score(attestation_row), 2)
    vendor_risk_raw = _clamp01(100 - vendor_trust_score)
    org_raw = _calculate_org_readiness_gap(buyer_payload)
    int_raw = _calculate_integration_risk(buyer_payload)
    intent = _calc_intent_multiplier(buyer_payload if isinstance(buyer_payload, dict) else {})
    implementation_risk_score, vendor_risk, organizational_readiness_gap, integration_risk = (
        _irs_final_from_parts(vendor_risk_raw, org_raw, int_raw, float(intent["value"]))
    )
    interpreted = _interpret(implementation_risk_score)

    return {
        "implementationRiskScore": implementation_risk_score,
        "grade": interpreted["grade"],
        "classification": interpreted["classification"],
        "decision": interpreted["decision"],
        "readiness_profile": interpreted["readiness_profile"],
        "recommendedAction": interpreted["recommendedAction"],
        "formula": (
            "IRS = 100 - (((Vendor_Risk × 0.35) + (Organizational_Readiness_Gap × 0.35)"
            " + (Integration_Risk × 0.30)) × Intent)"
        ),
        "breakdown": {
            "vendorRisk": vendor_risk,
            "organizationalReadinessGap": organizational_readiness_gap,
            "integrationRisk": integration_risk,
            "vendorTrustScore": vendor_trust_score,
            "intentMultiplier": intent["value"],
            "intentProfile": intent["profile"],
            "intentionalRiskCount": intent["intentional_count"],
            "unintentionalRiskCount": intent["unintentional_count"],
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
