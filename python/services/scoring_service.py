"""Vendor Trust Score (VTS) formula — ported from TypeScript vendorAttestation.ts."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from exceptions.custom_exceptions import RiskCalculationException
from services.category_coverage_service import resolve_category_coverage_inputs
from services.cert_industry_segment import (
    CERTIFICATIONS_SCORE_CAP,
    get_relevant_certification_framework_set,
    normalize_cert_industry_segment_input,
)
from services.compliance_cert_blobs import (
    certification_form_text_from_getter,
    collect_compliance_upload_file_names,
)

SCORING_VERSION = "vts-1.1"

DOMAIN_WEIGHTS = {
    "Privacy & Security": 1.20,
    "AI System Safety": 1.20,
    "Fairness & Non-discrimination": 1.15,
    "Transparency & Explainability": 1.10,
    "Human Oversight": 1.10,
    "Accountability & Governance": 1.00,
    "Socioeconomic Impact": 0.90,
}

MITIGATION_CATEGORIES = [
    "Data Governance & Privacy Controls",
    "Model Security & Integrity",
    "Access Management & Authentication",
    "Testing & Auditing Procedures",
    "Post-Deployment Monitoring",
    "Incident Response & Recovery",
    "Transparency & Documentation",
    "Human Oversight Mechanisms",
    "Bias Detection & Mitigation",
    "Adversarial Robustness",
    "Supply Chain Security",
    "Compliance & Regulatory Adherence",
    "User Education & Awareness",
]

CERT_EVIDENCE_NEAR_FW = re.compile(
    r"(certif|certificate|audit|report|attestation|third[\s-]?party|external assessment|assessor|aico|\.pdf|\.docx?)",
    re.I,
)

LooseInput = dict[str, Any]


def _pf(value: float, digits: int = 4) -> float:
    return float(f"{value:.{digits}f}")


def _score_list(
    raw: Any,
    default: list[float],
    *,
    lo: float = 1.0,
    hi: float = 5.0,
) -> list[float]:
    """Parse a list of Risk Intellect scores; fall back to hardcoded stubs if empty."""
    if not isinstance(raw, list):
        return list(default)
    out: list[float] = []
    for item in raw:
        try:
            n = float(item)
        except (TypeError, ValueError):
            continue
        if n != n or n <= 0:
            continue
        out.append(max(lo, min(hi, n)))
    return out if out else list(default)


def calculate_likelihood(likelihood_scores: list[float]) -> dict[str, Any]:
    if not likelihood_scores:
        raise RiskCalculationException("likelihoodScores must be a non-empty array")
    value = sum(likelihood_scores) / len(likelihood_scores)
    return {"value": _pf(value), "riskCount": len(likelihood_scores)}


def calculate_impact(impact_scores: list[float]) -> dict[str, Any]:
    if not impact_scores:
        raise RiskCalculationException("impactScores must be a non-empty array")
    value = sum(impact_scores) / len(impact_scores)
    return {"value": _pf(value), "riskCount": len(impact_scores)}


def calculate_severity(severity_scores: list[float]) -> dict[str, Any]:
    if not severity_scores:
        raise RiskCalculationException("severityScores must be a non-empty array")
    value = sum(severity_scores) / len(severity_scores)
    return {"value": _pf(value), "riskCount": len(severity_scores)}


def calc_entity_type_multiplier(p: LooseInput) -> dict[str, Any]:
    base_map = {
        "advisory": 0.8,
        "assisted": 0.9,
        "supervised": 1.0,
        "autonomous": 1.2,
        "fully_autonomous": 1.3,
    }
    stake_map = {
        "Low": -0.1,
        "Moderate": 0.0,
        "High": 0.1,
        "Critical": 0.15,
        "Life-Critical": 0.2,
    }
    base = base_map.get(p.get("decisionAutonomyLevel"))
    if base is None:
        raise RiskCalculationException(f"Unknown decisionAutonomyLevel: {p.get('decisionAutonomyLevel')}")
    stake_adj = stake_map.get(p.get("decisionStakeLevel"))
    if stake_adj is None:
        raise RiskCalculationException(f"Unknown decisionStakeLevel: {p.get('decisionStakeLevel')}")
    return {"et_base": base, "stake_adjustment": stake_adj, "value": _pf(base + stake_adj)}


def calc_timing_multiplier(p: LooseInput) -> dict[str, Any]:
    base_map = {
        "design": 0.75,
        "development": 0.80,
        "testing": 0.85,
        "staging": 0.95,
        "production": 1.30,
    }
    phase_map = {
        "pre_procurement": -0.05,
        "vendor_evaluation": -0.03,
        "pilot": 0.0,
        "scaling": 0.05,
        "mature_deployment": 0.10,
    }
    base = base_map.get(p.get("devStage"))
    if base is None:
        raise RiskCalculationException(f"Unknown devStage: {p.get('devStage')}")
    phase_adj = phase_map.get(p.get("assessmentPhase"))
    if phase_adj is None:
        raise RiskCalculationException(f"Unknown assessmentPhase: {p.get('assessmentPhase')}")
    return {"tm_base": base, "phase_adjustment": phase_adj, "value": _pf(base + phase_adj)}


def calc_architecture_multiplier(p: LooseInput) -> dict[str, Any]:
    base_map = {
        "off_the_shelf": 0.70,
        "lightly_customized": 0.85,
        "moderately_customized": 1.00,
        "heavily_customized": 1.20,
        "fully_custom": 1.40,
    }
    integ_map = {
        "standalone": 0.00,
        "simple_api": 0.05,
        "moderate_integration": 0.10,
        "complex_integration": 0.15,
        "legacy_systems": 0.20,
    }
    host_map = {
        "cloud_hosted": 0.00,
        "on_premise": 0.05,
        "hybrid": 0.08,
        "edge_devices": 0.10,
    }
    base = base_map.get(p.get("customizationLevel"))
    if base is None:
        raise RiskCalculationException(f"Unknown customizationLevel: {p.get('customizationLevel')}")
    integ_adj = integ_map.get(p.get("integrationComplexity"))
    if integ_adj is None:
        raise RiskCalculationException(f"Unknown integrationComplexity: {p.get('integrationComplexity')}")
    host_adj = host_map.get(p.get("hostingType"))
    if host_adj is None:
        raise RiskCalculationException(f"Unknown hostingType: {p.get('hostingType')}")
    return {
        "am_base": base,
        "integration_adj": integ_adj,
        "hosting_adj": host_adj,
        "value": _pf(base + integ_adj + host_adj),
    }


def calc_scale_multiplier(p: LooseInput) -> dict[str, Any]:
    emp_map = {
        "1-10": 0.70,
        "11-50": 0.75,
        "51-200": 0.80,
        "201-1000": 0.90,
        "1001-5000": 1.00,
        "5001-10000": 1.10,
        "10000+": 1.20,
    }
    geo_map = {
        "single_location": 1.00,
        "regional": 1.05,
        "national": 1.10,
        "multi_national": 1.15,
        "global": 1.20,
    }
    data_map = {
        "minimal": 0.00,
        "moderate": 0.03,
        "large": 0.06,
        "very_large": 0.09,
        "petabyte_scale": 0.12,
    }
    emp_base = emp_map.get(p.get("employeeCount"))
    if emp_base is None:
        raise RiskCalculationException(f"Unknown employeeCount: {p.get('employeeCount')}")
    geo_factor = geo_map.get(p.get("geographicRegions"))
    if geo_factor is None:
        raise RiskCalculationException(f"Unknown geographicRegions: {p.get('geographicRegions')}")
    data_adj = data_map.get(p.get("dataVolumeScale"))
    if data_adj is None:
        raise RiskCalculationException(f"Unknown dataVolumeScale: {p.get('dataVolumeScale')}")
    return {
        "employee_base": emp_base,
        "geographic_factor": geo_factor,
        "data_volume_adj": data_adj,
        "value": _pf((emp_base * geo_factor) + data_adj),
    }


def calc_risk_tolerance_multiplier(p: LooseInput) -> dict[str, Any]:
    mapping = {
        "aggressive": 0.85,
        "moderate": 1.00,
        "conservative": 1.15,
        "risk_averse": 1.25,
    }
    value = mapping.get(p.get("aiRiskAppetite"))
    if value is None:
        raise RiskCalculationException(f"Unknown aiRiskAppetite: {p.get('aiRiskAppetite')}")
    return {"value": value}


def calc_intent_multiplier(p: LooseInput) -> dict[str, Any]:
    intentional = int(p.get("intentionalRiskCount") or 0)
    unintentional = int(p.get("unintentionalRiskCount") or 0)
    total = intentional + unintentional
    if total == 0:
        raise RiskCalculationException("Total risk count must be > 0 for intent multiplier")
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
        "intentional_pct": _pf(intentional_pct * 100, 2),
        "unintentional_pct": _pf(unintentional_pct * 100, 2),
        "profile": profile,
        "value": value,
    }


def calculate_combined_contextual_multiplier(params: LooseInput) -> dict[str, Any]:
    et = calc_entity_type_multiplier(params)
    tm = calc_timing_multiplier(params)
    am = calc_architecture_multiplier(params)
    sm = calc_scale_multiplier(params)
    rtm = calc_risk_tolerance_multiplier(params)
    im = calc_intent_multiplier(params)
    value = _pf(et["value"] * tm["value"] * am["value"] * sm["value"] * rtm["value"] * im["value"])
    return {
        "entity_type_multiplier": et,
        "timing_multiplier": tm,
        "architecture_multiplier": am,
        "scale_multiplier": sm,
        "risk_tolerance_multiplier": rtm,
        "intent_multiplier": im,
        "value": value,
    }


def calculate_domain_weight(applicable_domains: list[dict[str, Any]]) -> dict[str, Any]:
    if not applicable_domains:
        raise RiskCalculationException("applicableDomains must be a non-empty array")
    weighted_sum = 0.0
    total_risks = 0
    breakdown = []
    for d in applicable_domains:
        domain = d.get("domain")
        risk_count = int(d.get("riskCount") or 0)
        w = DOMAIN_WEIGHTS.get(str(domain))
        if w is None:
            raise RiskCalculationException(f"Unknown domain: {domain}")
        weighted_sum += w * risk_count
        total_risks += risk_count
        breakdown.append({
            "domain": domain,
            "weight": w,
            "risk_count": risk_count,
            "contribution": _pf(w * risk_count),
        })
    value = _pf(weighted_sum / total_risks)
    return {
        "breakdown": breakdown,
        "weighted_sum": _pf(weighted_sum),
        "total_risks": total_risks,
        "value": value,
    }


def calculate_sector_modifier(p: LooseInput) -> dict[str, Any]:
    sm_base = 0
    use_case_adj = 0
    adj_breakdown: list[dict[str, Any]] = []
    sector = p.get("sector")

    if sector == "Healthcare":
        cap_map = {
            "diagnostic": 8,
            "treatment_recommendation": 8,
            "patient_communication": 6,
            "administrative": 4,
            "research": 3,
        }
        sm_base = cap_map.get(p.get("aiCapabilityType"), 5)
        if p.get("piiHandling") == "critical":
            use_case_adj += 2
            adj_breakdown.append({"reason": "critical PHI handling", "points": 2})
        reg = p.get("regulatoryComplexity") or []
        if isinstance(reg, list) and "FDA_clearance" in reg:
            use_case_adj += 1
            adj_breakdown.append({"reason": "FDA clearance required", "points": 1})
        if p.get("deploymentScale") == "multi_hospital_system":
            use_case_adj += 1
            adj_breakdown.append({"reason": "multi-hospital deployment", "points": 1})
        if p.get("patientDemographic") in ("pediatric", "elderly"):
            use_case_adj += 1
            adj_breakdown.append({"reason": "vulnerable population", "points": 1})
    elif sector == "Financial Services":
        sm_base = 5
    elif sector == "Autonomous Vehicles":
        sm_base = 6
    elif sector == "Government":
        sm_base = 5
    elif sector == "E-Commerce":
        sm_base = 3
    elif sector == "Technology":
        sm_base = 1
    else:
        sm_base = 1

    return {
        "sector": sector,
        "sm_base": sm_base,
        "use_case_adjustment": use_case_adj,
        "adjustment_breakdown": adj_breakdown,
        "value": sm_base + use_case_adj,
    }


def calculate_inherent_risk(*, L: float, I: float, CM: float, DW: float, SM: float) -> dict[str, Any]:
    base_risk = _pf(L * I)
    contextual_risk = _pf(base_risk * CM)
    domain_weighted_risk = _pf(contextual_risk * DW)
    sector_adjusted_risk = _pf(domain_weighted_risk + SM)
    normalized_risk = _pf(sector_adjusted_risk * 4)
    capped_risk = min(100.0, normalized_risk)
    return {
        "base_risk": base_risk,
        "contextual_risk": contextual_risk,
        "domain_weighted_risk": domain_weighted_risk,
        "sector_adjusted_risk": sector_adjusted_risk,
        "normalized_risk": normalized_risk,
        "value": _pf(capped_risk),
    }


def calc_category_coverage(p: LooseInput) -> dict[str, Any]:
    required_categories = list(p.get("requiredCategories") or [])
    implemented_categories = list(p.get("implementedCategories") or [])
    required = set(required_categories)
    implemented = [c for c in implemented_categories if c in required]
    coverage = len(implemented) / len(required) if required else 0.0
    return {
        "required_categories": list(required),
        "required_count": len(required),
        "implemented_categories": implemented,
        "implemented_count": len(implemented),
        "missing_categories": [c for c in required if c not in implemented],
        "value": _pf(coverage),
    }


def calc_evidence_quality(mitigations: list[dict[str, Any]]) -> dict[str, Any]:
    if not mitigations:
        raise RiskCalculationException("mitigations array must be non-empty")
    weighted_sum = 0.0
    total_risk_instances = 0
    breakdown = []
    for m in mitigations:
        risk_count = int(m.get("riskCount") or 0)
        avg_relevance = float(m.get("avgRelevance") or 0)
        contribution = risk_count * avg_relevance
        weighted_sum += contribution
        total_risk_instances += risk_count
        breakdown.append({
            "mitigation_id": m.get("mitigationId"),
            "risk_count": risk_count,
            "avg_relevance": avg_relevance,
            "weighted_contribution": _pf(contribution),
        })
    return {
        "breakdown": breakdown,
        "total_weighted": _pf(weighted_sum),
        "total_risk_instances": total_risk_instances,
        "value": _pf(weighted_sum / total_risk_instances),
    }


def calculate_mitigation_effectiveness(p: LooseInput) -> dict[str, Any]:
    coverage = calc_category_coverage(p)
    quality = calc_evidence_quality(p.get("mitigations") or [])
    value = _pf((coverage["value"] * 0.6) + (quality["value"] * 0.4))
    return {
        "category_coverage": coverage,
        "evidence_quality": quality,
        "coverage_weight": 0.6,
        "quality_weight": 0.4,
        "value": value,
    }


def calculate_confidence_factor(p: LooseInput) -> dict[str, Any]:
    method_map = {
        "third_party_audit": 0.90,
        "third_party_review": 0.93,
        "internal_audit": 0.97,
        "self_reported_verified": 1.00,
        "self_reported_unverified": 1.10,
        "no_formal_assessment": 1.15,
    }
    cadence_map = {
        "continuous": 0.94,
        "quarterly": 0.96,
        "annually": 0.97,
        "ad_hoc": 0.99,
    }
    base = method_map.get(p.get("assessmentMethod"))
    if base is None:
        raise RiskCalculationException(f"Unknown assessmentMethod: {p.get('assessmentMethod')}")
    evidence_adj = []
    factor = base
    if p.get("complianceDocumentationComplete") is True:
        factor *= 0.98
        evidence_adj.append({"reason": "compliance documentation complete", "multiplier": 0.98})
    cadence = str(
        p.get("independentPenTestFrequency")
        or p.get("independent_pen_test_frequency")
        or ""
    ).strip().lower()
    if cadence in cadence_map:
        factor *= cadence_map[cadence]
        evidence_adj.append({
            "reason": f"independent pen-test cadence: {cadence}",
            "multiplier": cadence_map[cadence],
        })
    elif cadence == "none":
        evidence_adj.append({"reason": "independent pen-test cadence: none", "multiplier": 1.0})
    elif p.get("penetrationTestReportAvailable") is True:
        factor *= 0.97
        evidence_adj.append({"reason": "penetration test report available", "multiplier": 0.97})
    if p.get("soc2Type2Current") is True:
        factor *= 0.95
        evidence_adj.append({"reason": "SOC2 Type 2 current", "multiplier": 0.95})
    return {
        "method_base": base,
        "evidence_adjustments": evidence_adj,
        "pen_test_cadence": cadence or None,
        "value": _pf(factor),
    }


def calculate_product_risk(
    *,
    inherent_risk: float,
    mitigation_effectiveness: float,
    confidence_factor: float,
) -> dict[str, Any]:
    residual = inherent_risk * (1 - mitigation_effectiveness)
    value = _pf(residual * confidence_factor)
    return {
        "inherent_risk": inherent_risk,
        "mitigation_effectiveness": mitigation_effectiveness,
        "residual_pre_confidence": _pf(residual),
        "confidence_factor": confidence_factor,
        "value": value,
    }


def _certified_evidence_near_framework(combined: str, fw_regex: re.Pattern[str]) -> bool:
    for m in fw_regex.finditer(combined):
        idx = m.start()
        win_start = max(0, idx - 100)
        win_end = min(len(combined), idx + len(m.group(0)) + 100)
        if CERT_EVIDENCE_NEAR_FW.search(combined[win_start:win_end]):
            return True
    return False


def calc_certifications_score(p: LooseInput) -> dict[str, Any]:
    combined = str(p.get("certificationsSearchBlob") or "").lower()
    u = str(p.get("complianceUploadBlob") or "").lower()
    if not combined.strip():
        legacy = []
        if p.get("soc2Certification") and p.get("soc2Certification") != "None":
            legacy.append(str(p.get("soc2Certification")))
        if p.get("isoCertifications") and p.get("isoCertifications") != "None":
            legacy.append(str(p.get("isoCertifications")))
        if p.get("hipaaCertification") and p.get("hipaaCertification") != "None":
            legacy.append(str(p.get("hipaaCertification")))
        combined = " ".join(legacy).lower()

    breakdown: list[dict[str, Any]] = []

    def add(key: str, pts: float, detail: str | None = None) -> None:
        if pts <= 0:
            return
        row: dict[str, Any] = {"framework": key, "points": pts}
        if detail:
            row["detail"] = detail
        breakdown.append(row)

    soc2_points = 0
    if re.search(r"\bsoc\s*2\b|soc2", combined, re.I):
        if re.search(r"type\s*2|type\s*ii|type2", combined, re.I):
            soc2_points = 15
        elif re.search(r"type\s*1|type\s*i\b|type1", combined, re.I):
            soc2_points = 8
    if soc2_points == 15:
        add("SOC 2 Type 2", 15)
    elif soc2_points == 8:
        add("SOC 2 Type 1", 8)

    if re.search(r"hipaa", combined, re.I) and re.search(r"hitrust", combined, re.I):
        add("HIPAA BAA + HITRUST", 15)
    elif re.search(r"hipaa|\bbaa\b", combined, re.I):
        add("HIPAA BAA only", 10)

    iso27001_re = re.compile(r"\biso\s*27001\b|27001:2022|\b27001\b", re.I)
    if iso27001_re.search(combined):
        upload_hint = bool(re.search(r"27001", u, re.I))
        certified = upload_hint or _certified_evidence_near_framework(combined, iso27001_re)
        pts = 10 if certified else 5
        add("ISO 27001:2022", pts, "certified" if certified else "self-attested")

    iso42001_re = re.compile(r"\biso\s*42001\b|\b42001\b", re.I)
    if iso42001_re.search(combined):
        upload_hint = bool(re.search(r"42001", u, re.I))
        certified = upload_hint or _certified_evidence_near_framework(combined, iso42001_re)
        pts = 8 if certified else 4
        add("ISO 42001", pts, "certified" if certified else "self-attested")

    if re.search(r"nist", combined, re.I) and re.search(
        r"ai\s*rmf|ai\s*risk\s*management(\s*framework)?", combined, re.I
    ):
        add("NIST AI RMF", 5, "self-attested")

    if (
        re.search(r"nist", combined, re.I)
        and re.search(r"(\bcsf\b|cybersecurity\s*framework)", combined, re.I)
        and not re.search(r"800[\s.-]*53", combined)
        and not re.search(r"800[\s.-]*171", combined)
    ):
        add("NIST CSF v2.0", 5, "self-attested")

    n53_re = re.compile(r"800[\s.-]*53\b", re.I)
    if n53_re.search(combined):
        upload_hint = bool(re.search(r"800[\s.-]*53", u, re.I))
        certified = upload_hint or _certified_evidence_near_framework(combined, n53_re)
        add("NIST SP 800-53 Rev 5", 10 if certified else 5, "certified" if certified else "self-attested")

    n171_re = re.compile(r"800[\s.-]*171\b", re.I)
    if n171_re.search(combined):
        upload_hint = bool(re.search(r"800[\s.-]*171", u, re.I))
        certified = upload_hint or _certified_evidence_near_framework(combined, n171_re)
        add("NIST SP 800-171 Rev 3", 10 if certified else 5, "certified" if certified else "self-attested")

    if re.search(r"\bcmmc\b", combined, re.I):
        add("CMMC v2 Level 2+", 12)

    if re.search(r"pci[\s.-]*dss|payment card industry", combined, re.I):
        add("PCI DSS 4.0", 10)

    dora_re = re.compile(r"\bdora\b|digital operational resilience", re.I)
    if dora_re.search(combined):
        upload_hint = bool(re.search(r"\bdora\b", u, re.I) or re.search(r"digital operational resilience", u, re.I))
        certified = upload_hint or _certified_evidence_near_framework(combined, dora_re)
        add("DORA", 8 if certified else 4, "certified" if certified else "self-attested")

    gdpr_re = re.compile(r"\bgdpr\b|general data protection regulation", re.I)
    if gdpr_re.search(combined):
        upload_hint = bool(re.search(r"\bgdpr\b", u, re.I))
        certified = upload_hint or _certified_evidence_near_framework(combined, gdpr_re)
        add("GDPR", 8 if certified else 4, "certified" if certified else "self-attested")

    segment_key = normalize_cert_industry_segment_input(str(p.get("buyerIndustrySegment") or ""))
    relevant_frameworks = get_relevant_certification_framework_set(segment_key)
    all_rows = breakdown
    all_detected_breakdown = [dict(row) for row in all_rows]
    contributing = [row for row in all_rows if row["framework"] in relevant_frameworks]
    excluded_by_segment = [row for row in all_rows if row["framework"] not in relevant_frameworks]
    raw_sum_all = sum(float(row["points"]) for row in all_rows)
    raw_sum = sum(float(row["points"]) for row in contributing)
    value = min(CERTIFICATIONS_SCORE_CAP, raw_sum)

    soc2_contrib = (
        15 if any(r["framework"] == "SOC 2 Type 2" for r in contributing)
        else (8 if any(r["framework"] == "SOC 2 Type 1" for r in contributing) else 0)
    )
    hipaa_contrib = (
        15 if any(r["framework"] == "HIPAA BAA + HITRUST" for r in contributing)
        else (10 if any(r["framework"] == "HIPAA BAA only" for r in contributing) else 0)
    )
    iso27001_contrib = float(next((r["points"] for r in contributing if r["framework"] == "ISO 27001:2022"), 0))
    iso42001_contrib = float(next((r["points"] for r in contributing if r["framework"] == "ISO 42001"), 0))

    return {
        "buyer_industry_segment": segment_key,
        "relevant_framework_keys": sorted(relevant_frameworks),
        "all_detected_breakdown": all_detected_breakdown,
        "framework_breakdown": contributing,
        "excluded_not_relevant_to_buyer_segment": excluded_by_segment,
        "raw_certifications_sum_all_detected": raw_sum_all,
        "raw_certifications_sum": raw_sum,
        "certifications_cap": CERTIFICATIONS_SCORE_CAP,
        "soc2_points": soc2_contrib,
        "hipaa_points": hipaa_contrib,
        "iso_points": iso27001_contrib + iso42001_contrib,
        "iso_27001_points": iso27001_contrib,
        "iso_42001_points": iso42001_contrib,
        "value": value,
    }


def calc_assessment_quality_score(p: LooseInput) -> dict[str, Any]:
    method_map = {
        "third_party_audit": 20,
        "third_party_review": 15,
        "internal_audit": 10,
        "internal_review": 8,
        "self_assessment": 3,
        "none": 0,
    }
    freq_map = {"annual": 5, "bi_annual": 3, "ad_hoc": 0}
    base = method_map.get(p.get("assessmentMethod"), 0)
    is_audit = p.get("assessmentMethod") in ("third_party_audit", "internal_audit")
    freq_bonus = freq_map.get(p.get("auditFrequency"), 0) if is_audit else 0
    return {"method_base": base, "frequency_bonus": freq_bonus, "value": base + freq_bonus}


def calc_policy_score(p: LooseInput) -> dict[str, Any]:
    retention_map = {"documented_and_enforced": 12, "documented_not_enforced": 8, "informal": 3}
    ir_map = {"tested_annually": 15, "documented_not_tested": 10, "basic_runbook": 5}
    privacy_map = {"comprehensive_gdpr_ccpa": 10, "standard": 6, "basic": 3}
    ethics_map = {"board_approved_operationalized": 8, "documented_not_operationalized": 5, "draft": 2}
    retention_points = retention_map.get(p.get("dataRetentionPolicyCompleteness"), 0) if p.get("dataRetentionPolicy") else 0
    ir_points = ir_map.get(p.get("incidentResponsePlanMaturity"), 0) if p.get("incidentResponsePlan") else 0
    privacy_points = privacy_map.get(p.get("privacyPolicyScope"), 0) if p.get("privacyPolicy") else 0
    ethics_points = ethics_map.get(p.get("aiEthicsMaturity"), 0) if p.get("aiEthicsPolicy") else 0
    return {
        "data_retention_points": retention_points,
        "incident_response_points": ir_points,
        "privacy_policy_points": privacy_points,
        "ai_ethics_points": ethics_points,
        "value": retention_points + ir_points + privacy_points + ethics_points,
    }


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _pick(p: LooseInput, *keys: str) -> Any:
    for key in keys:
        if key in p and p.get(key) not in (None, ""):
            return p.get(key)
    return None


def calc_data_protection_score(p: LooseInput) -> dict[str, Any]:
    """Excel: encryption 0-10, TLS 0-8, data-subject rights 0-6."""
    enc_map = {
        "customer_managed_keys": 10,
        "aes_256": 8,
        "platform_managed_keys": 6,
        "aes_128": 4,
    }
    tls_map = {
        "1.3": 8,
        "1.2+": 6,
        "tls 1.2": 4,
        "tls 1.2+": 6,
        "tls 1.3": 8,
        "other": 2,
    }
    rights_set = {
        "access",
        "rectification",
        "erasure",
        "restriction",
        "portability",
        "objection",
    }
    enc_raw = str(_pick(p, "encryptionAtRest", "encryption_at_rest") or "").strip().lower()
    if enc_raw in ("not_disclosed", "not disclosed"):
        enc_raw = ""
    enc_pts = enc_map.get(enc_raw, 0)
    evidence = str(
        _pick(p, "encryptionAtRestEvidenceId", "encryption_at_rest_evidence_id") or ""
    ).strip()
    if enc_pts > 0 and evidence:
        enc_pts = min(10, enc_pts + 2)

    tls_raw = str(_pick(p, "tlsInTransit", "tls_in_transit") or "").strip().lower()
    tls_pts = tls_map.get(tls_raw, 0)

    rights_raw = _pick(p, "dataSubjectRights", "data_subject_rights")
    rights = [
        str(item).strip().lower()
        for item in _as_list(rights_raw)
        if str(item).strip()
    ]
    known = [r for r in rights if r in rights_set]
    role = str(_pick(p, "controllerOrProcessor", "controller_or_processor") or "").strip().lower()
    if role in ("processor", "both"):
        dsr_pts = min(6, len(known))
    elif role == "controller":
        dsr_pts = min(3, int(len(known) * 0.5 + 0.5)) if known else 0
    else:
        dsr_pts = min(6, len(known))
    return {
        "encryption_points": enc_pts,
        "tls_points": tls_pts,
        "data_subject_rights_points": dsr_pts,
        "value": enc_pts + tls_pts + dsr_pts,
    }


def calc_supply_chain_score(p: LooseInput) -> dict[str, Any]:
    """Excel: sub-processors 0-8 (Supply Chain Security)."""
    rows = _as_list(_pick(p, "subProcessors", "sub_processors"))
    named = 0
    detailed = 0
    for item in rows:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        named += 1
        purpose = str(item.get("purpose") or "").strip()
        region = str(item.get("region") or "").strip()
        if purpose and region:
            detailed += 1
    if named <= 0:
        pts = 0
    elif detailed >= 1 and named >= 2:
        pts = 8
    elif detailed >= 1:
        pts = 6
    else:
        pts = 4
    return {
        "named_count": named,
        "detailed_count": detailed,
        "value": pts,
    }


def calc_adversarial_disclosure_score(p: LooseInput) -> dict[str, Any]:
    """Excel: VDP 0-6, bug bounty 0-4 (Adversarial Robustness)."""
    vdp = _as_dict(_pick(p, "vulnerabilityDisclosurePolicy", "vulnerability_disclosure_policy"))
    vdp_status = str(vdp.get("status") or "").strip().lower()
    vdp_url = str(vdp.get("url") or "").strip()
    if vdp_status == "published" and vdp_url:
        vdp_pts = 6
    elif vdp_status == "published":
        vdp_pts = 4
    elif vdp_status == "on_request":
        vdp_pts = 3
    else:
        vdp_pts = 0

    bounty = _as_dict(_pick(p, "bugBounty", "bug_bounty"))
    bounty_status = str(bounty.get("status") or "").strip().lower()
    bounty_url = str(bounty.get("url") or "").strip()
    if bounty_status == "public" and bounty_url:
        bounty_pts = 4
    elif bounty_status == "public":
        bounty_pts = 3
    elif bounty_status == "private":
        bounty_pts = 2
    else:
        bounty_pts = 0
    return {
        "vdp_points": vdp_pts,
        "bug_bounty_points": bounty_pts,
        "value": vdp_pts + bounty_pts,
    }


def calc_dpa_score(p: LooseInput) -> dict[str, Any]:
    """Excel: DPA available 0-4 (Compliance & Regulatory Adherence)."""
    dpa_map = {"publicly_available": 4, "on_request": 2, "none": 0}
    raw = str(_pick(p, "dpaAvailable", "dpa_available") or "").strip().lower()
    pts = dpa_map.get(raw, 0)
    return {"dpa_status": raw or None, "value": pts}


def calc_operational_controls_score(p: LooseInput) -> dict[str, Any]:
    rollback_map = {
        "automated_instant": 15,
        "automated_manual_trigger": 12,
        "manual_documented": 8,
        "manual_undocumented": 3,
        "none": 0,
    }
    oversight_map = {
        "always_in_loop": 12,
        "monitoring_with_intervention": 10,
        "monitoring_only": 6,
        "minimal": 3,
        "none": 0,
    }
    monitor_map = {
        "real_time_alerting": 10,
        "daily_dashboard": 7,
        "weekly_reports": 4,
        "monthly_reviews": 2,
        "none": 0,
    }
    version_map = {"automated_mlops_pipeline": 8, "manual_documented": 5, "basic_tracking": 2}
    rollback_pts = rollback_map.get(p.get("rollbackProcedures"), 0)
    oversight_pts = oversight_map.get(p.get("humanOversightCapabilities"), 0)
    monitor_pts = monitor_map.get(p.get("continuousMonitoring"), 0)
    version_pts = version_map.get(p.get("versioningMaturity"), 0) if p.get("modelVersionControl") else 0
    return {
        "rollback_points": rollback_pts,
        "oversight_points": oversight_pts,
        "monitoring_points": monitor_pts,
        "version_control_points": version_pts,
        "value": rollback_pts + oversight_pts + monitor_pts + version_pts,
    }


def calc_vendor_maturity_adjustment(p: LooseInput) -> dict[str, Any]:
    current_year = datetime.now().year
    age = current_year - int(p.get("yearFounded") or current_year)
    age_map = [
        {"min": 10, "points": 10},
        {"min": 5, "points": 5},
        {"min": 3, "points": 0},
        {"min": 1, "points": -5},
        {"min": 0, "points": -10},
    ]
    age_pts = next((e["points"] for e in age_map if age >= e["min"]), -10)
    size_map = {
        "5001+": 8,
        "1001-5000": 5,
        "201-1000": 2,
        "51-200": 0,
        "11-50": -3,
        "1-10": -5,
    }
    size_pts = size_map.get(p.get("employeeCount"), 0)
    funding_map = {
        "publicly_traded": 7,
        "series_d_plus": 5,
        "series_b_c": 2,
        "series_a": 0,
        "seed_angel": -3,
    }
    if p.get("fundingStatus") == "bootstrapped":
        funding_pts = 3 if p.get("revenueSufficient") else -2
    else:
        funding_pts = funding_map.get(p.get("fundingStatus"), 0)
    ec = int(p.get("enterpriseCustomers") or 0)
    cust_pts = min(10, ec / 2) if ec > 10 else (ec - 5)
    return {
        "company_age_years": age,
        "company_age_factor": age_pts,
        "company_size_factor": size_pts,
        "funding_stability_factor": funding_pts,
        "customer_base_factor": _pf(cust_pts),
        "value": _pf(age_pts + size_pts + funding_pts + cust_pts),
    }


def calculate_governance_risk(p: LooseInput) -> dict[str, Any]:
    cert = calc_certifications_score(p)
    aq = calc_assessment_quality_score(p)
    policy = calc_policy_score(p)
    ops = calc_operational_controls_score(p)
    mat = calc_vendor_maturity_adjustment(p)
    data_protection = calc_data_protection_score(p)
    supply_chain = calc_supply_chain_score(p)
    adversarial = calc_adversarial_disclosure_score(p)
    dpa = calc_dpa_score(p)
    raw_score = (
        cert["value"]
        + aq["value"]
        + policy["value"]
        + ops["value"]
        + mat["value"]
        + data_protection["value"]
        + supply_chain["value"]
        + adversarial["value"]
        + dpa["value"]
    )
    governance_score = min(100.0, raw_score)
    governance_risk = 100 - governance_score
    return {
        "certifications_score": cert,
        "assessment_quality_score": aq,
        "policy_score": policy,
        "operational_controls_score": ops,
        "vendor_maturity_adjustment": mat,
        "data_protection_score": data_protection,
        "supply_chain_score": supply_chain,
        "adversarial_disclosure_score": adversarial,
        "dpa_score": dpa,
        "raw_governance_score": _pf(raw_score),
        "governance_score": _pf(governance_score),
        "value": _pf(governance_risk),
    }


def calc_sla_score(p: LooseInput) -> dict[str, Any]:
    uptime_map = {
        "99.99%+": 25,
        "99.95-99.99%": 22,
        "99.9-99.95%": 20,
        "99.5-99.9%": 15,
        "99.0-99.5%": 12,
        "95.0-99.0%": 8,
        "< 95%": 3,
    }
    response_map = {
        "< 15 minutes": 8,
        "< 1 hour": 6,
        "< 4 hours": 4,
        "< 24 hours": 2,
        "> 24 hours": 0,
    }
    resolution_map = {"< 4 hours": 7, "< 24 hours": 5, "< 72 hours": 3, "> 72 hours": 1}
    uptime_pts = uptime_map.get(p.get("slaUptime"), 0)
    response_pts = response_map.get(p.get("criticalIncidentResponse"), 0)
    resolution_pts = resolution_map.get(p.get("criticalIncidentResolution"), 0)
    return {
        "uptime_points": uptime_pts,
        "response_time_points": response_pts,
        "resolution_time_points": resolution_pts,
        "value": uptime_pts + response_pts + resolution_pts,
    }


def calc_incident_management_score(p: LooseInput) -> dict[str, Any]:
    plan_map = {"quarterly_drills": 12, "annual_test": 10, "documented_untested": 6}
    auto_map = {"automated": 10, "semi_automated": 7, "manual": 3, "none": 0}
    comm_map = {"proactive_status_page": 8, "email_notifications": 5, "reactive_only": 2, "none": 0}
    plan_pts = plan_map.get(p.get("planTesting"), 0) if p.get("incidentResponsePlan") else 0
    auto_pts = auto_map.get(p.get("rollbackProcedures"), 0)
    comm_pts = comm_map.get(p.get("incidentCommunication"), 0)
    return {
        "plan_points": plan_pts,
        "automation_points": auto_pts,
        "communication_points": comm_pts,
        "value": plan_pts + auto_pts + comm_pts,
    }


def calc_deployment_maturity_score(p: LooseInput) -> dict[str, Any]:
    scale_map = {
        "enterprise_multi_tenant": 12,
        "enterprise_single_tenant": 10,
        "mid_market": 7,
        "small_business": 4,
        "pilot": 2,
    }
    readiness_map = {"production_mature": 10, "production_new": 8, "staging": 4, "development": 1}
    iso_map = {"full_instance_isolation": 8, "schema_isolation": 6, "row_level_security": 4}
    scale_pts = scale_map.get(p.get("deploymentScale"), 0)
    readiness_pts = readiness_map.get(p.get("devStage"), 0)
    multi_pts = iso_map.get(p.get("isolationMethod"), 0) if p.get("multiTenancySupport") else 0
    return {
        "scale_points": scale_pts,
        "production_readiness_points": readiness_pts,
        "multi_tenancy_points": multi_pts,
        "value": scale_pts + readiness_pts + multi_pts,
    }


def calc_stability_score(p: LooseInput) -> dict[str, Any]:
    current_year = datetime.now().year
    age = current_year - int(p.get("yearFounded") or current_year)
    age_map = [
        {"min": 10, "pts": 12},
        {"min": 5, "pts": 9},
        {"min": 3, "pts": 6},
        {"min": 1, "pts": 3},
        {"min": 0, "pts": 0},
    ]
    age_pts = next((e["pts"] for e in age_map if age >= e["min"]), 0)
    fin_map = {
        "profitable_3_years": 10,
        "profitable_1_year": 7,
        "break_even": 5,
        "funded_runway_2_years": 4,
        "funded_runway_1_year": 2,
        "uncertain": 0,
    }
    fin_pts = fin_map.get(p.get("financialStatus"), 0)
    rate = p.get("customerRetentionRate")
    if rate is None:
        retention_pts = 3
    elif rate >= 95:
        retention_pts = 8
    elif rate >= 90:
        retention_pts = 6
    elif rate >= 80:
        retention_pts = 4
    elif rate >= 70:
        retention_pts = 2
    else:
        retention_pts = 0
    return {
        "company_age_years": age,
        "company_age_points": age_pts,
        "financial_health_points": fin_pts,
        "customer_retention_points": retention_pts,
        "value": age_pts + fin_pts + retention_pts,
    }


def calc_support_score(p: LooseInput) -> dict[str, Any]:
    tier_map = {
        "24_7_phone_chat_email": 10,
        "business_hours_phone_chat": 7,
        "business_hours_email": 4,
        "email_only": 2,
    }
    tam_map = {"dedicated_tam": 5, "shared_tam": 3, "standard_support": 1}
    tier_pts = tier_map.get(p.get("supportTiers"), 0)
    coverage_pts = 5 if p.get("supportsHipaaWorkflows") else 0
    tam_pts = tam_map.get(p.get("technicalAccountManager"), 0)
    return {
        "support_tier_points": tier_pts,
        "coverage_points": coverage_pts,
        "expertise_points": tam_pts,
        "value": tier_pts + coverage_pts + tam_pts,
    }


def calculate_operational_risk(p: LooseInput) -> dict[str, Any]:
    sla = calc_sla_score(p)
    incident = calc_incident_management_score(p)
    deployment = calc_deployment_maturity_score(p)
    stability = calc_stability_score(p)
    support = calc_support_score(p)
    raw_score = sla["value"] + incident["value"] + deployment["value"] + stability["value"] + support["value"]
    operational_score = min(100.0, raw_score)
    operational_risk = 100 - operational_score
    return {
        "sla_score": sla,
        "incident_management_score": incident,
        "deployment_maturity_score": deployment,
        "stability_score": stability,
        "support_score": support,
        "raw_operational_score": _pf(raw_score),
        "operational_score": _pf(operational_score),
        "value": _pf(operational_risk),
    }


def interpret_trust_score(vts: float) -> dict[str, str]:
    s = max(0, min(100, round(float(vts))))
    if s >= 90:
        return {
            "grade": "A",
            "classification": "Exceptional Vendor",
            "recommended_action": "Fast-track procurement; minimal additional due diligence",
            "vendor_profile": "Market leader; comprehensive controls; proven track record",
        }
    if s >= 80:
        return {
            "grade": "B",
            "classification": "Trusted Vendor",
            "recommended_action": "Standard procurement process; focus on use-case fit",
            "vendor_profile": "Strong capabilities; mature governance; reliable operations",
        }
    if s >= 70:
        return {
            "grade": "C",
            "classification": "Acceptable Vendor",
            "recommended_action": "Enhanced due diligence; require mitigation roadmap",
            "vendor_profile": "Moderate capabilities; some gaps; growing operations",
        }
    if s >= 60:
        return {
            "grade": "D",
            "classification": "Review Recommended",
            "recommended_action": "Extensive validation; consider alternatives; pilot only",
            "vendor_profile": "Significant gaps; immature processes; limited track record",
        }
    return {
        "grade": "F",
        "classification": "Review Required",
        "recommended_action": "Reject; only consider for low-stakes non-production use",
        "vendor_profile": "Critical deficiencies; unproven capabilities; high risk ",
    }


def calculate_vendor_trust_score(user_input: LooseInput) -> dict[str, Any]:
    l_scores = user_input.get("likelihoodScores") or []
    i_scores = user_input.get("impactScores") or []
    l_result = calculate_likelihood(l_scores)
    i_result = calculate_impact(i_scores)
    severity_raw = user_input.get("severityScores") or []
    if severity_raw:
        s_result = calculate_severity(severity_raw)
        s_result["source"] = user_input.get("severity_score_source") or "payload"
    else:
        s_result = {
            "value": _pf(l_result["value"] * i_result["value"]),
            "riskCount": l_result["riskCount"],
            "derived": True,
            "source": "likelihood_x_impact",
        }
    if user_input.get("likelihood_score_source"):
        l_result = {**l_result, "source": user_input.get("likelihood_score_source")}
    if user_input.get("impact_score_source"):
        i_result = {**i_result, "source": user_input.get("impact_score_source")}
    print(
        "[type-01 VTS] likelihood/impact calculation",
        {
            "formula": "L = sum(likelihoodScores)/n, I = sum(impactScores)/n, base_risk = L × I",
            "likelihood_score_source": user_input.get("likelihood_score_source") or "default",
            "impact_score_source": user_input.get("impact_score_source") or "default",
            "likelihoodScores": l_scores,
            "impactScores": i_scores,
            "L": l_result,
            "I": i_result,
            "severityScores": severity_raw,
            "S": s_result,
            "base_risk_LxI": _pf(l_result["value"] * i_result["value"]),
        },
    )
    cm_result = calculate_combined_contextual_multiplier(user_input)
    dw_result = calculate_domain_weight(user_input.get("applicableDomains") or [])
    sm_result = calculate_sector_modifier(user_input)
    ir_result = calculate_inherent_risk(
        L=l_result["value"],
        I=i_result["value"],
        CM=cm_result["value"],
        DW=dw_result["value"],
        SM=sm_result["value"],
    )
    me_result = calculate_mitigation_effectiveness(user_input)
    cf_result = calculate_confidence_factor(user_input)
    pr_result = calculate_product_risk(
        inherent_risk=ir_result["value"],
        mitigation_effectiveness=me_result["value"],
        confidence_factor=cf_result["value"],
    )
    gr_result = calculate_governance_risk(user_input)
    or_result = calculate_operational_risk(user_input)

    weighted_risk = (pr_result["value"] * 0.40) + (gr_result["value"] * 0.30) + (or_result["value"] * 0.30)
    vts = _pf(max(0.0, 100 - weighted_risk), 2)
    interpretation = interpret_trust_score(vts)

    detail: dict[str, Any] = {
        "product_risk": {
            "likelihood": l_result,
            "impact": i_result,
            "severity": s_result,
            "combined_contextual_multiplier": cm_result,
            "domain_weight": dw_result,
            "sector_modifier": sm_result,
            "inherent_risk": ir_result,
            "mitigation_effectiveness": me_result,
            "confidence_factor": cf_result,
            "product_risk": pr_result,
        },
        "governance_risk": gr_result,
        "operational_risk": or_result,
        "final_formula": {
            "expression": "VTS = 100 - [(PR × 0.40) + (GR × 0.30) + (OR × 0.30)]",
            "product_risk_contribution": _pf(pr_result["value"] * 0.40),
            "governance_risk_contribution": _pf(gr_result["value"] * 0.30),
            "operational_risk_contribution": _pf(or_result["value"] * 0.30),
        },
    }
    coverage_meta = user_input.get("_categoryCoverageMeta")
    if isinstance(coverage_meta, dict) and coverage_meta:
        detail["category_coverage_resolution"] = coverage_meta

    return {
        "vendor_trust_score": vts,
        "product_risk": pr_result["value"],
        "governance_risk": gr_result["value"],
        "operational_risk": or_result["value"],
        "weighted_risk": _pf(weighted_risk),
        "grade": interpretation["grade"],
        "classification": interpretation["classification"],
        "recommended_action": interpretation["recommended_action"],
        "detail": detail,
        "scoring_version": SCORING_VERSION,
    }


def build_formula_input_from_payload(payload: dict[str, Any]) -> LooseInput:
    cp = payload.get("companyProfile") if isinstance(payload.get("companyProfile"), dict) else {}

    def get(k: str) -> Any:
        return payload[k] if k in payload and payload[k] is not None else cp.get(k)

    def as_str(v: Any) -> str:
        return str(v or "").strip()

    def lower(v: Any) -> str:
        return as_str(v).lower()

    def in_set(v: str, allowed: list[str], fallback: str) -> str:
        return v if v in allowed else fallback

    def to_num(v: Any, fallback: float) -> float:
        try:
            n = float(v)
            return n if n == n else fallback  # NaN check
        except (TypeError, ValueError):
            return fallback

    text = " ".join([
        lower(get("decision_autonomy")),
        lower(get("ai_autonomy_level")),
        lower(get("assessment_completion_level")),
        lower(get("pii_handling")),
        lower(get("incident_response_plan")),
    ])
    employee_raw = lower(get("employeeCount") if get("employeeCount") is not None else get("no_of_employees"))
    year_founded = int(max(1990, min(datetime.now().year, to_num(get("yearFounded") if get("yearFounded") is not None else get("year_founded"), 2020))))
    regions = get("operatingRegions")
    region_count = len(regions) if isinstance(regions, list) else 1

    if "fully" in text and "autonom" in text:
        decision_autonomy_level = "fully_autonomous"
    elif "autonom" in text:
        decision_autonomy_level = "autonomous"
    elif "assist" in text:
        decision_autonomy_level = "assisted"
    elif "advis" in text:
        decision_autonomy_level = "advisory"
    else:
        decision_autonomy_level = "supervised"

    if "life" in text:
        decision_stake_level = "Life-Critical"
    elif "critical" in text:
        decision_stake_level = "Critical"
    elif "high" in text:
        decision_stake_level = "High"
    elif "moderate" in text:
        decision_stake_level = "Moderate"
    else:
        decision_stake_level = "Low"

    stage_raw = lower(get("product_stage") if get("product_stage") is not None else get("stage_product"))
    dev_stage = in_set(stage_raw, ["design", "development", "testing", "staging", "production"], "development")

    host_raw = lower(get("hosting_deployment") if get("hosting_deployment") is not None else get("solution_hosted"))
    if "hybrid" in host_raw:
        hosting_type = "hybrid"
    elif "prem" in host_raw:
        hosting_type = "on_premise"
    else:
        hosting_type = "cloud_hosted"

    if "10000" in employee_raw:
        employee_count = "10000+"
    elif "5001" in employee_raw:
        employee_count = "5001-10000"
    elif "1001" in employee_raw:
        employee_count = "1001-5000"
    elif "201" in employee_raw:
        employee_count = "201-1000"
    elif "51" in employee_raw:
        employee_count = "51-200"
    elif "11" in employee_raw:
        employee_count = "11-50"
    else:
        employee_count = "1-10"

    if region_count >= 5:
        geographic_regions = "global"
    elif region_count >= 3:
        geographic_regions = "multi_national"
    elif region_count == 2:
        geographic_regions = "national"
    else:
        geographic_regions = "regional"

    compliance_upload_names = collect_compliance_upload_file_names(payload)
    compliance_upload_blob = " ".join(compliance_upload_names).lower()
    cert_form_blob = certification_form_text_from_getter(get).lower()
    certifications_search_blob = f"{cert_form_blob} {compliance_upload_blob}".strip()
    buyer_industry_segment = normalize_cert_industry_segment_input(
        as_str(
            get("buyerIndustrySegment")
            or get("buyer_industry_segment")
            or get("industrySegment")
            or get("industry_segment")
            or get("buyerSegment")
            or ""
        )
    )

    # Category_Coverage: attestation answers + vector document evidence (no hardcoded 4/6)
    use_vector = payload.get("_skipCategoryVector") is not True
    coverage_inputs = resolve_category_coverage_inputs(payload, use_vector=use_vector)

    # Likelihood / impact / severity: prefer AI Risk Intellect values injected by Node.
    likelihood_scores = _score_list(
        get("likelihoodScores") if get("likelihoodScores") is not None else payload.get("likelihoodScores"),
        [3, 3, 3],
        lo=1.0,
        hi=5.0,
    )
    impact_scores = _score_list(
        get("impactScores") if get("impactScores") is not None else payload.get("impactScores"),
        [3, 3, 3],
        lo=1.0,
        hi=5.0,
    )
    severity_scores = _score_list(
        get("severityScores") if get("severityScores") is not None else payload.get("severityScores"),
        [l * i for l, i in zip(likelihood_scores, impact_scores)]
        if len(likelihood_scores) == len(impact_scores)
        else [9, 9, 9],
        lo=1.0,
        hi=25.0,
    )

    try:
        intentional_count = int(
            get("intentionalRiskCount")
            if get("intentionalRiskCount") is not None
            else payload.get("intentionalRiskCount")
            or 1
        )
    except (TypeError, ValueError):
        intentional_count = 1
    try:
        unintentional_count = int(
            get("unintentionalRiskCount")
            if get("unintentionalRiskCount") is not None
            else payload.get("unintentionalRiskCount")
            or 2
        )
    except (TypeError, ValueError):
        unintentional_count = 2
    if intentional_count < 0:
        intentional_count = 1
    if unintentional_count < 0:
        unintentional_count = 2
    if intentional_count + unintentional_count == 0:
        intentional_count, unintentional_count = 1, 2

    return {
        "likelihoodScores": likelihood_scores,
        "impactScores": impact_scores,
        "severityScores": severity_scores,
        "likelihood_score_source": as_str(
            get("likelihood_score_source") or payload.get("likelihood_score_source")
        )
        or "default",
        "impact_score_source": as_str(
            get("impact_score_source") or payload.get("impact_score_source")
        )
        or "default",
        "severity_score_source": as_str(
            get("severity_score_source") or payload.get("severity_score_source")
        )
        or "default",
        "decisionAutonomyLevel": decision_autonomy_level,
        "decisionStakeLevel": decision_stake_level,
        "devStage": dev_stage,
        "assessmentPhase": "vendor_evaluation",
        "customizationLevel": "lightly_customized",
        "integrationComplexity": "moderate_integration",
        "hostingType": hosting_type,
        "employeeCount": employee_count,
        "geographicRegions": geographic_regions,
        "dataVolumeScale": "moderate",
        "aiRiskAppetite": "moderate",
        "intentionalRiskCount": intentional_count,
        "unintentionalRiskCount": unintentional_count,
        "applicableDomains": [
            {"domain": "Privacy & Security", "riskCount": 1},
            {"domain": "AI System Safety", "riskCount": 1},
            {"domain": "Accountability & Governance", "riskCount": 1},
        ],
        "sector": as_str(get("sector")) or "Technology",
        "aiCapabilityType": "administrative",
        "piiHandling": "critical" if "critical" in text else "moderate",
        "regulatoryComplexity": [],
        "deploymentScale": lower(get("deployment_scale")) or "mid_market",
        "patientDemographic": "general",
        "requiredCategories": list(coverage_inputs["requiredCategories"]),
        "implementedCategories": list(coverage_inputs["implementedCategories"]),
        "mitigations": list(coverage_inputs["mitigations"]),
        "_categoryCoverageMeta": coverage_inputs.get("meta") or {},
        "assessmentMethod": "internal_audit",
        "complianceDocumentationComplete": True,
        "encryptionAtRest": as_str(get("encryption_at_rest")),
        "encryptionAtRestEvidenceId": as_str(get("encryption_at_rest_evidence_id")),
        "tlsInTransit": as_str(get("tls_in_transit")),
        "dataSubjectRights": get("data_subject_rights") if isinstance(get("data_subject_rights"), list) else [],
        "controllerOrProcessor": as_str(get("controller_or_processor")),
        "subProcessors": get("sub_processors") if isinstance(get("sub_processors"), list) else [],
        "vulnerabilityDisclosurePolicy": (
            get("vulnerability_disclosure_policy")
            if isinstance(get("vulnerability_disclosure_policy"), dict)
            else {}
        ),
        "bugBounty": get("bug_bounty") if isinstance(get("bug_bounty"), dict) else {},
        "independentPenTestFrequency": as_str(get("independent_pen_test_frequency")),
        "dpaAvailable": as_str(get("dpa_available")),
        "penetrationTestReportAvailable": bool(
            as_str(get("adversarial_security_testing"))
            or (
                as_str(get("independent_pen_test_frequency"))
                not in ("", "none")
            )
        ),
        "soc2Type2Current": bool(
            re.search(r"\bsoc\s*2\b|soc2", certifications_search_blob, re.I)
            and re.search(r"type\s*2|type\s*ii|type2", certifications_search_blob, re.I)
        ),
        "soc2Certification": (
            "Type 2 (current)"
            if re.search(r"type\s*2|type\s*ii|type2", certifications_search_blob, re.I)
            else "None"
        ),
        "isoCertifications": (
            "ISO 27001 only"
            if re.search(r"\biso\s*27001\b|27001", certifications_search_blob, re.I)
            else "None"
        ),
        "hipaaCertification": (
            "HIPAA BAA + HITRUST"
            if re.search(r"hipaa", certifications_search_blob, re.I)
            and re.search(r"hitrust", certifications_search_blob, re.I)
            else (
                "HIPAA BAA only"
                if re.search(r"hipaa|\bbaa\b", certifications_search_blob, re.I)
                else "None"
            )
        ),
        "certificationsSearchBlob": certifications_search_blob,
        "complianceUploadBlob": compliance_upload_blob,
        "buyerIndustrySegment": buyer_industry_segment,
        "yearFounded": year_founded,
        "fundingStatus": "series_a",
        "revenueSufficient": True,
        "enterpriseCustomers": 5,
        "auditFrequency": "annual",
        "dataRetentionPolicy": bool(as_str(get("data_retention_policy"))),
        "dataRetentionPolicyCompleteness": "documented_not_enforced",
        "incidentResponsePlan": bool(as_str(get("incident_response_plan"))),
        "incidentResponsePlanMaturity": "documented_not_tested",
        "privacyPolicy": True,
        "privacyPolicyScope": "standard",
        "aiEthicsPolicy": True,
        "aiEthicsMaturity": "documented_not_operationalized",
        "rollbackProcedures": "manual_documented",
        "humanOversightCapabilities": "monitoring_with_intervention",
        "continuousMonitoring": "daily_dashboard",
        "modelVersionControl": True,
        "versioningMaturity": "manual_documented",
        "slaUptime": as_str(get("uptime_sla") if get("uptime_sla") is not None else get("sla_guarantee")) or "99.5-99.9%",
        "criticalIncidentResponse": "< 4 hours",
        "criticalIncidentResolution": "< 24 hours",
        "planTesting": "annual_test",
        "incidentCommunication": "email_notifications",
        "multiTenancySupport": True,
        "isolationMethod": "schema_isolation",
        "financialStatus": "break_even",
        "customerRetentionRate": 85,
        "supportTiers": "business_hours_email",
        "supportsHipaaWorkflows": "health" in lower(get("sector")),
        "technicalAccountManager": "standard_support",
    }


def score_attestation_payload(payload: dict[str, Any]) -> dict[str, Any]:
    formula_input = build_formula_input_from_payload(payload)
    return calculate_vendor_trust_score(formula_input)
