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


def _is_empty(v: Any) -> bool:
    if v is None:
        return True
    if isinstance(v, (list, dict)) and len(v) == 0:
        return True
    return str(v).strip() in ("", "none", "null", "undefined")


def _first_present(*values: Any) -> Any:
    for v in values:
        if not _is_empty(v):
            return v
    return None


def _parse_list(v: Any) -> list[str]:
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    if isinstance(v, dict):
        out: list[str] = []
        for key, val in v.items():
            if isinstance(val, str) and val.strip():
                out.append(f"{key}:{val.strip()}")
            elif _bool_yes(val) or (not _is_empty(val) and not isinstance(val, bool)):
                out.append(str(key).strip())
        return [x for x in out if x]
    if isinstance(v, str):
        t = v.strip()
        if not t:
            return []
        try:
            parsed = json.loads(t)
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
            if isinstance(parsed, dict):
                return _parse_list(parsed)
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
        return [x.strip() for x in re.split(r",|;|\r?\n", t) if x.strip()]
    return []


def _attestation_get(attestation_row: dict[str, Any] | None, *keys: str) -> Any:
    if not isinstance(attestation_row, dict):
        return None
    lowered = {str(k).strip().lower(): v for k, v in attestation_row.items()}
    for key in keys:
        got = attestation_row.get(key)
        if not _is_empty(got):
            return got
        got = lowered.get(key.lower())
        if not _is_empty(got):
            return got
    for value in attestation_row.values():
        if not isinstance(value, dict):
            continue
        nested_lower = {str(k).strip().lower(): v for k, v in value.items()}
        for key in keys:
            got = value.get(key)
            if not _is_empty(got):
                return got
            got = nested_lower.get(key.lower())
            if not _is_empty(got):
                return got
    return None


def _vts_from_evidence(evidence: Any) -> float | None:
    items = [_norm(x) for x in _parse_list(evidence)]
    if not items or any("nothing yet" in x for x in items):
        return None
    score = 55.0
    blob = " ".join(items)
    if "soc 2" in blob:
        score += 8
    if "iso 27001" in blob:
        score += 6
    if "iso 42001" in blob:
        score += 6
    if "pen-test" in blob or "pen test" in blob:
        score += 4
    if "baa" in blob or "dpa" in blob:
        score += 3
    return _clamp01(min(score, 78.0))


def _extract_vendor_trust_score(
    attestation_row: dict[str, Any] | None,
    evidence: Any = None,
) -> float:
    """
    Same resolution order as Product Profile UI / Node extractVendorTrustScore:
    1) trustScore.overallScore (> 0)
    2) latest_trust_score on attestation (> 0)
    3) formula.vendor_trust_score / report.vendor_trust_score (> 0)
    4) buyer-held vendor evidence (instead of a hardcoded 50)
    5) default 50
    """
    if attestation_row:
        report = attestation_row.get("generated_profile_report")
        if not isinstance(report, dict):
            report = {}
        trust_score = report.get("trustScore")
        if not isinstance(trust_score, dict):
            trust_score = report.get("trust_score") if isinstance(report.get("trust_score"), dict) else {}
        if not isinstance(trust_score, dict):
            trust_score = {}
        formula = report.get("formula")
        if not isinstance(formula, dict):
            formula = {}

        def _positive(raw: Any) -> float | None:
            try:
                n = float(raw)
            except (TypeError, ValueError):
                return None
            if math.isfinite(n) and n > 0:
                return _clamp01(round(n))
            return None

        for candidate in (
            trust_score.get("overallScore"),
            trust_score.get("overall_score"),
            attestation_row.get("latest_trust_score"),
            attestation_row.get("latestTrustScore"),
            formula.get("vendor_trust_score"),
            formula.get("formula_vendor_trust_score"),
            report.get("vendor_trust_score"),
        ):
            got = _positive(candidate)
            if got is not None:
                return got

        for candidate in (
            trust_score.get("overallScore"),
            trust_score.get("overall_score"),
            attestation_row.get("latest_trust_score"),
        ):
            try:
                n = float(candidate)  # type: ignore[arg-type]
            except (TypeError, ValueError):
                continue
            if math.isfinite(n) and n == 0:
                return 0.0

    from_evidence = _vts_from_evidence(evidence)
    if from_evidence is not None:
        return from_evidence
    return 50.0


def _is_high_stakes(criticality: str) -> bool:
    return any(
        token in criticality
        for token in (
            "life or death",
            "major financial",
            "high",
            "critical",
            "work stops",
            "mission",
        )
    )


def _is_low_or_medium_stakes(criticality: str) -> bool:
    return any(
        token in criticality
        for token in (
            "low impact",
            "minimal",
            "moderate impact",
            "medium",
            "low",
            "work continues",
            "additive",
            "work degrades",
        )
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


def _digital_from_onboarding(p: dict[str, Any]) -> Any:
    skills = _norm(p.get("aiSkillsAvailability"))
    initiatives = _norm(
        _first_present(p.get("existingAIInitiatives"), p.get("existingAiInitiatives"))
    )
    if (
        "expert" in skills
        or "ai-native" in initiatives
        or "extensive" in initiatives
    ):
        return "Level 5 - Fully digitized, AI-ready infrastructure"
    if "strong" in skills or "moderate" in skills:
        return "Level 4 - Advanced digital capabilities, data-driven"
    if "limited" in skills:
        return "Level 2 - Basic digital systems, limited integration"
    if skills.startswith("none"):
        return "Level 1 - Paper-based or minimal digital systems"
    return None


def _board_from_onboarding(maturity: Any) -> Any:
    s = _norm(maturity)
    if not s:
        return None
    if "board" in s or "oversight committee" in s or "optimized" in s:
        return "Yes - Active board with defined responsibilities"
    if s.startswith("none"):
        return "No - Not currently planned"
    return None


def _ethics_from_onboarding(maturity: Any) -> Any:
    s = _norm(maturity)
    if not s:
        return None
    if s.startswith("none"):
        return "No - Not currently developed"
    if any(token in s for token in ("documented", "basic", "intermediate", "advanced", "optimized")):
        return "Yes - Comprehensive policy actively enforced"
    return None


def _effective_available(value: Any, stance: Any) -> bool:
    if _norm(stance) == "dispute":
        return False
    return _bool_yes(value)


def _has_testing_evidence(evidence: Any) -> bool:
    blob = " ".join(_norm(x) for x in _parse_list(evidence))
    return any(
        token in blob
        for token in ("testing results", "pen-test", "pen test", "model or safety")
    )


def resolve_buyer_irs_inputs(
    buyer_payload: dict[str, Any],
    attestation_row: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Map V2 buyer COTS + onboarding + attestation onto formula inputs."""
    p = buyer_payload if isinstance(buyer_payload, dict) else {}
    a = attestation_row if isinstance(attestation_row, dict) else None

    digital = _first_present(
        p.get("digitalMaturityLevel"),
        p.get("digital_maturity"),
        _digital_from_onboarding(p),
    )
    governance = _first_present(
        p.get("dataGovernanceMaturity"),
        p.get("data_governance_maturity"),
        p.get("governance_maturity"),
    )
    ai_maturity = _first_present(p.get("aiGovernanceMaturity"), p.get("ai_governance_maturity"))
    board = _first_present(
        p.get("aiGovernanceBoard"),
        p.get("ai_governance_board"),
        _board_from_onboarding(ai_maturity),
    )
    ethics = _first_present(
        p.get("aiEthicsPolicy"),
        p.get("ai_ethics_policy"),
        _ethics_from_onboarding(ai_maturity),
    )
    capacity = _first_present(
        p.get("implementationCapacity"),
        p.get("implementation_capacity"),
        p.get("implementationTeamComposition"),
        p.get("team_composition"),
    )
    criticality = _first_present(
        p.get("decisionStakes"),
        p.get("criticality"),
        p.get("unavailabilityImpact"),
        p.get("unavailability_impact"),
    )
    usage = _first_present(
        p.get("currentUsageState"),
        p.get("current_usage_state"),
        p.get("requirementGaps"),
        p.get("gap_requirement_product"),
    )
    rollback = _first_present(
        p.get("rollbackCapability"),
        p.get("rollback_capability"),
        _attestation_get(a, "rollback_capability", "rollbackCapability"),
    )
    monitoring = _first_present(
        p.get("monitoringDataAvailable"),
        p.get("vendor_usage_data"),
        _attestation_get(a, "production_model_monitoring", "monitoring_data_available"),
    )
    audit = _first_present(
        p.get("auditLogsAvailable"),
        p.get("audit_logs"),
        _attestation_get(a, "audit_logs_available", "auditLogsAvailable", "audit_logs"),
    )
    testing = _first_present(
        p.get("testingResultsAvailable"),
        p.get("testing_results"),
        _attestation_get(a, "testing_results_available", "testingResultsAvailable"),
    )
    evidence = _first_present(
        p.get("vendorEvidenceReceived"),
        p.get("vendor_evidence_received"),
        p.get("vendorCertifications"),
    )
    if _is_empty(testing) and _has_testing_evidence(evidence):
        testing = "Yes - Internal testing results provided"

    return {
        "digitalMaturityLevel": digital,
        "dataGovernanceMaturity": governance,
        "aiGovernanceBoard": board,
        "aiEthicsPolicy": ethics,
        "implementationCapacity": capacity,
        "implementationTeamComposition": p.get("implementationTeamComposition")
        if not _is_empty(p.get("implementationTeamComposition"))
        else capacity,
        "riskAppetite": _first_present(p.get("riskAppetite"), p.get("risk_appetite")),
        "criticality": criticality,
        "decisionStakes": p.get("decisionStakes"),
        "unavailabilityImpact": _first_present(
            p.get("unavailabilityImpact"), p.get("unavailability_impact")
        ),
        "integrationSystems": _first_present(
            p.get("integrationSystems"), p.get("integrate_system")
        ),
        "integrationAccessLevels": _first_present(
            p.get("integrationAccessLevels"), p.get("integration_access_levels")
        ),
        "currentUsageState": usage,
        "requirementGaps": usage,
        "rollbackCapability": rollback,
        "monitoringDataAvailable": monitoring,
        "monitoringDataStance": _first_present(
            p.get("monitoringDataStance"), p.get("monitoring_data_stance")
        ),
        "auditLogsAvailable": audit,
        "auditLogsStance": _first_present(p.get("auditLogsStance"), p.get("audit_logs_stance")),
        "testingResultsAvailable": testing,
        "dataSensitivity": _first_present(
            p.get("dataSensitivity"), p.get("data_sensitivity_level")
        ),
        "dataClasses": _first_present(p.get("dataClasses"), p.get("data_classes")),
        "humanReviewLevel": _first_present(
            p.get("humanReviewLevel"), p.get("human_review_level")
        ),
        "outputExposure": _first_present(p.get("outputExposure"), p.get("output_exposure")),
        "trainingUseOfData": _first_present(
            p.get("trainingUseOfData"), p.get("training_use_of_data")
        ),
        "trainingUseOfDataStance": _first_present(
            p.get("trainingUseOfDataStance"), p.get("training_use_of_data_stance")
        ),
        "deploymentModel": _first_present(p.get("deploymentModel"), p.get("deployment_model")),
        "pilotStatus": _first_present(p.get("pilotStatus"), p.get("pilot_status")),
        "usersInScope": _first_present(p.get("usersInScope"), p.get("users_in_scope")),
        "trainingEffort": _first_present(p.get("trainingEffort"), p.get("training_effort")),
        "vendorEvidenceReceived": evidence,
        "dataExportCapability": _first_present(
            p.get("dataExportCapability"), p.get("data_export_capability")
        ),
        "dataExportStance": _first_present(
            p.get("dataExportStance"), p.get("data_export_stance")
        ),
        "contractsInPlace": _first_present(
            p.get("contractsInPlace"), p.get("contracts_in_place")
        ),
        "answerConfidence": _first_present(
            p.get("answerConfidence"), p.get("answer_confidence")
        ),
        "accountableOwnerName": _first_present(
            p.get("accountableOwnerName"), p.get("accountable_owner_name")
        ),
        "useCaseTypes": _first_present(p.get("useCaseTypes"), p.get("use_case_types")),
    }


def _capacity_delta(resolved: dict[str, Any]) -> float:
    capacity = _norm(resolved.get("implementationCapacity"))
    if "dedicated" in capacity:
        return -6.0
    if "named owner" in capacity:
        return 0.0
    if "shared" in capacity:
        return 6.0
    if "no one assigned" in capacity or "no team" in capacity:
        return 8.0

    team = _parse_list(resolved.get("implementationTeamComposition"))
    team_roles = [t for t in team if "no team" not in _norm(t) and "no one assigned" not in _norm(t)]
    if len(team_roles) >= 4:
        return -6.0
    if team_roles and len(team_roles) <= 1:
        # A single named capacity string already handled above; one role is a gap.
        if any("dedicated" in _norm(t) or "named owner" in _norm(t) for t in team_roles):
            return 0.0
        return 8.0
    if not team_roles and not _is_empty(resolved.get("accountableOwnerName")):
        return 0.0
    return 0.0


def _calculate_org_readiness_gap(resolved: dict[str, Any]) -> float:
    risk = 35.0
    digital = _norm(resolved.get("digitalMaturityLevel"))
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

    governance = _norm(resolved.get("dataGovernanceMaturity"))
    if (
        "optimized" in governance
        or "managed" in governance
        or "mature" in governance
        or "excellent" in governance
    ):
        risk -= 8
    elif "basic" in governance or "developing" in governance or "defined" in governance:
        risk += 4
    elif (
        "ad-hoc" in governance
        or "low" in governance
        or "initial" in governance
        or governance.startswith("none")
    ):
        risk += 10

    if not _is_empty(resolved.get("aiGovernanceBoard")) and not _bool_yes(
        resolved.get("aiGovernanceBoard")
    ):
        risk += 8
    if not _is_empty(resolved.get("aiEthicsPolicy")) and not _bool_yes(
        resolved.get("aiEthicsPolicy")
    ):
        risk += 8

    risk += _capacity_delta(resolved)

    appetite = _norm(resolved.get("riskAppetite"))
    criticality = _norm(resolved.get("criticality"))
    if _is_high_stakes(criticality) and _is_aggressive_appetite(appetite):
        risk += 8
    if _is_low_or_medium_stakes(criticality) and _is_conservative_appetite(appetite):
        risk -= 2

    sensitivity = _norm(resolved.get("dataSensitivity"))
    if "extremely" in sensitivity or "highly sensitive" in sensitivity:
        risk += 6
    elif "sensitive" in sensitivity:
        risk += 3

    review = _norm(resolved.get("humanReviewLevel"))
    if "no review" in review:
        risk += 8
    elif "exception" in review:
        risk += 4
    elif review.startswith("always"):
        risk -= 4

    confidence = _norm(resolved.get("answerConfidence"))
    if confidence.startswith("low"):
        risk += 4
    elif confidence.startswith("high"):
        risk -= 2

    return _clamp01(risk)


def _usage_delta(usage: Any) -> float:
    s = _norm(usage)
    if not s:
        return 0.0
    if "officially in use" in s or s.startswith("yes"):
        return -3.0
    if "trial" in s or "poc" in s:
        return 4.0
    if "unsanctioned" in s:
        return 8.0
    if "not in use" in s or s.startswith("no"):
        return 12.0
    return 0.0


def _rollback_delta(rollback: Any, data_export: Any) -> float:
    s = _norm(rollback)
    if s:
        if s.startswith("none") or "no rollback" in s or s == "no":
            return 12.0
        if "manual" in s or s.startswith("moderate") or s.startswith("limited"):
            return 6.0
        return -3.0
    export = _norm(data_export)
    if export.startswith("no"):
        return 12.0
    if export.startswith("yes") and "limited" in export:
        return 6.0
    if export.startswith("yes"):
        return 6.0
    return 0.0


def _access_delta(access_levels: Any) -> float:
    levels = [_norm(x) for x in _parse_list(access_levels)]
    blob = " ".join(levels)
    if "admin" in blob or "delete" in blob:
        return 6.0
    if "write" in blob:
        return 3.0
    return 0.0


def _calculate_integration_risk(resolved: dict[str, Any]) -> float:
    risk = 25.0
    systems = _parse_list(resolved.get("integrationSystems"))
    systems = [
        s
        for s in systems
        if "no integration" not in _norm(s) and _norm(s) != "none"
    ]
    risk += min(30, len(systems) * 6)
    risk += _access_delta(resolved.get("integrationAccessLevels"))
    risk += _usage_delta(resolved.get("currentUsageState"))
    risk += _rollback_delta(
        resolved.get("rollbackCapability"),
        resolved.get("dataExportCapability"),
    )

    if not _effective_available(
        resolved.get("monitoringDataAvailable"),
        resolved.get("monitoringDataStance"),
    ):
        risk += 6
    if not _effective_available(
        resolved.get("auditLogsAvailable"),
        resolved.get("auditLogsStance"),
    ):
        risk += 6
    if not _bool_yes(resolved.get("testingResultsAvailable")):
        risk += 6

    exposure = _norm(resolved.get("outputExposure"))
    if "published directly" in exposure:
        risk += 6
    elif "customer-facing" in exposure:
        risk += 3

    training = _norm(resolved.get("trainingUseOfData"))
    stance = _norm(resolved.get("trainingUseOfDataStance"))
    if stance == "dispute" or training.startswith("yes"):
        risk += 5
    elif "not yet" in training:
        risk += 3

    deployment = _norm(resolved.get("deploymentModel"))
    if "on-premise" in deployment or "private cloud" in deployment:
        risk += 4

    pilot = _norm(resolved.get("pilotStatus"))
    if "did not meet" in pilot:
        risk += 6
    elif "not planned" in pilot:
        risk += 4
    elif "met criteria" in pilot:
        risk -= 4

    users = _norm(resolved.get("usersInScope"))
    if "5,000+" in users or "5000+" in users:
        risk += 4
    elif "1-10" in users:
        risk -= 2

    effort = _norm(resolved.get("trainingEffort"))
    if "multi-day" in effort:
        risk += 3

    contracts = [_norm(x) for x in _parse_list(resolved.get("contractsInPlace"))]
    if contracts and any("nothing signed" in x for x in contracts):
        risk += 4

    use_cases = [_norm(x) for x in _parse_list(resolved.get("useCaseTypes"))]
    if any("automatically" in x for x in use_cases):
        risk += 4

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
    payload = buyer_payload if isinstance(buyer_payload, dict) else {}
    resolved = resolve_buyer_irs_inputs(payload, attestation_row)
    vendor_trust_score = round(
        _extract_vendor_trust_score(attestation_row, resolved.get("vendorEvidenceReceived")),
        2,
    )
    vendor_risk_raw = _clamp01(100 - vendor_trust_score)
    org_raw = _calculate_org_readiness_gap(resolved)
    int_raw = _calculate_integration_risk(resolved)
    intent = _calc_intent_multiplier(payload)
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
            "resolvedInputs": {
                "digitalMaturityLevel": resolved.get("digitalMaturityLevel"),
                "dataGovernanceMaturity": resolved.get("dataGovernanceMaturity"),
                "implementationCapacity": resolved.get("implementationCapacity"),
                "currentUsageState": resolved.get("currentUsageState"),
                "rollbackCapability": resolved.get("rollbackCapability"),
                "humanReviewLevel": resolved.get("humanReviewLevel"),
            },
        },
    }


__all__ = [
    "calculate_buyer_implementation_risk_score",
    "buyer_implementation_readiness_grade_from_score",
    "resolve_buyer_irs_inputs",
]
