"""Sales Risk Score formula — ported from vendorCotsReportAgent.ts."""

from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any


def _note_degraded(p: dict[str, Any], field: str) -> None:
    notes = p.setdefault("_degraded_fields", [])
    if isinstance(notes, list) and field not in notes:
        notes.append(field)


def _mapped(
    p: dict[str, Any],
    key: str,
    mapping: dict[str, float],
    default: float,
    field: str,
) -> float:
    value = p.get(key)
    if value in mapping:
        return mapping[value]
    _note_degraded(p, field)
    return default


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1 – CUSTOMER FRICTION RISK
# ─────────────────────────────────────────────────────────────────────────────


def calc_regulatory_complexity(p: dict[str, Any]) -> dict[str, Any]:
    sector_multiplier_map: dict[str, float] = {
        "Healthcare": 6,
        "Financial_Services": 5,
        "Government": 5,
        "Autonomous_Systems": 7,
        "E_Commerce": 3,
        "Technology": 2,
        "Other": 3,
    }

    multiplier = sector_multiplier_map.get(p.get("sector"), 2)
    regs = p.get("customerRegulatoryRequirements")
    count = len(regs) if isinstance(regs, list) else 0
    value = count * multiplier

    return {
        "regulatory_requirement_count": count,
        "regulatory_requirements": regs if regs is not None else [],
        "sector_complexity_multiplier": multiplier,
        "value": value,
    }


def calc_data_sensitivity_friction(p: dict[str, Any]) -> dict[str, Any]:
    sensitivity_map: dict[str, float] = {
        "Critical (Life-safety, National security)": 30,
        "High (PHI, Financial data, PII)": 20,
        "Medium (Business confidential)": 10,
        "Low (Public or anonymized)": 5,
    }

    base_points = _mapped(
        p, "customerDataSensitivity", sensitivity_map, 5, "customerDataSensitivity"
    )

    regs = p.get("customerRegulatoryRequirements")
    reg_count = len(regs) if isinstance(regs, list) else 0
    burden_rate = 3 if p.get("sector") in ("Healthcare", "Financial_Services") else 2
    doc_burden = reg_count * burden_rate

    return {
        "data_sensitivity_base_points": base_points,
        "regulatory_count": reg_count,
        "compliance_burden_rate": burden_rate,
        "compliance_documentation_burden": doc_burden,
        "value": base_points + doc_burden,
    }


def calc_risk_tolerance_friction(p: dict[str, Any]) -> dict[str, Any]:
    tolerance_map: dict[str, float] = {
        "Aggressive": 3,
        "Moderate": 8,
        "Conservative": 15,
        "Risk_averse": 20,
    }

    base = _mapped(p, "customerRiskTolerance", tolerance_map, 8, "customerRiskTolerance")

    regs = p.get("customerRegulatoryRequirements")
    reg_count = len(regs) if isinstance(regs, list) else 0
    is_conservative = p.get("customerRiskTolerance") in ("Conservative", "Risk_averse")
    customer_specific_risk_count = p.get("customerSpecificRiskCount", 0)
    if is_conservative:
        proof_burden = customer_specific_risk_count * 2 + reg_count
    else:
        proof_burden = customer_specific_risk_count

    return {
        "tolerance_base_points": base,
        "is_conservative_or_averse": is_conservative,
        "customer_specific_risk_count": customer_specific_risk_count,
        "regulatory_count": reg_count,
        "proof_requirement_burden": proof_burden,
        "value": base + proof_burden,
    }


def calc_customer_specific_risk_friction(p: dict[str, Any]) -> dict[str, Any]:
    risk_weight_map: dict[str, float] = {
        "Enterprise": 12,
        "Mid_market": 10,
        "SMB": 7,
    }

    risk_weight = _mapped(p, "customerType", risk_weight_map, 7, "customerType")

    customer_specific_risk_count = p.get("customerSpecificRiskCount", 0)
    base_contribution = customer_specific_risk_count * risk_weight
    unique_penalty = (
        customer_specific_risk_count * 5 if p.get("customerHasUniqueRequirements") else 0
    )

    return {
        "customer_specific_risk_count": customer_specific_risk_count,
        "customer_type": p.get("customerType"),
        "risk_weight": risk_weight,
        "base_contribution": base_contribution,
        "has_unique_requirements": p.get("customerHasUniqueRequirements"),
        "unique_requirements_list": p.get("uniqueRequirementsList") or [],
        "unique_requirement_penalty": unique_penalty,
        "value": base_contribution + unique_penalty,
    }


def calculate_customer_friction_risk(p: dict[str, Any]) -> dict[str, Any]:
    regulatory = calc_regulatory_complexity(p)
    data_sens = calc_data_sensitivity_friction(p)
    risk_tol = calc_risk_tolerance_friction(p)
    specific = calc_customer_specific_risk_friction(p)

    raw = (
        regulatory["value"]
        + data_sens["value"]
        + risk_tol["value"]
        + specific["value"]
    )
    value = min(100, raw)

    return {
        "regulatory_complexity": regulatory,
        "data_sensitivity_friction": data_sens,
        "risk_tolerance_friction": risk_tol,
        "customer_specific_risk_friction": specific,
        "raw_total": raw,
        "is_capped": raw > 100,
        "value": value,
    }


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2 – IMPLEMENTATION RISK
# ─────────────────────────────────────────────────────────────────────────────


def calc_integration_complexity(p: dict[str, Any]) -> dict[str, Any]:
    complexity_map: dict[str, float] = {
        "Legacy_mainframe": 35,
        "Legacy_client_server": 28,
        "Modern_monolith": 20,
        "Microservices": 15,
        "Cloud_native_API": 10,
        "SaaS_standard_connector": 5,
    }

    integration_points = p.get("integrationPoints")
    if not integration_points or len(integration_points) == 0:
        return {
            "integration_points": [],
            "integration_point_count": 0,
            "per_point_scores": [],
            "average_complexity": 0,
            "system_count_penalty": 0,
            "value": 0,
        }

    per_point_scores = []
    for pt in integration_points:
        system_type = pt.get("systemType") if isinstance(pt, dict) else None
        score = complexity_map.get(system_type)
        if score is None:
            _note_degraded(p, "systemType")
            score = 8
        per_point_scores.append(
            {"system_type": system_type, "complexity_score": score}
        )

    avg = sum(pt["complexity_score"] for pt in per_point_scores) / len(per_point_scores)
    count_penalty = (
        (len(integration_points) - 3) * 5 if len(integration_points) > 3 else 0
    )

    return {
        "integration_points": per_point_scores,
        "integration_point_count": len(integration_points),
        "average_complexity": float(f"{avg:.4f}"),
        "system_count_penalty": count_penalty,
        "value": float(f"{avg + count_penalty:.4f}"),
    }


def calc_customization_required(p: dict[str, Any]) -> dict[str, Any]:
    cust_map: dict[str, float] = {
        "None (use as-is)": 0,
        "Minimal (configuration only)": 5,
        "Moderate (config + light dev)": 15,
        "Significant (custom model training)": 20,
        "Extensive (significant dev)": 25,
        "Custom_build": 40,
    }
    industry_penalty_map: dict[str, float] = {
        "Healthcare": 12,
        "Financial_Services": 10,
        "Government": 8,
        "Autonomous_Systems": 10,
        "Other": 5,
    }

    base = _mapped(p, "customizationLevel", cust_map, 12, "customizationLevel")

    if p.get("customerRequiresIndustryWorkflows"):
        industry_penalty = industry_penalty_map.get(
            p.get("sector"), industry_penalty_map["Other"]
        )
    else:
        industry_penalty = 0

    business_process_changes = p.get("businessProcessChangesRequired")
    if business_process_changes is None:
        business_process_changes = 0
    workflow_penalty = business_process_changes * 3

    return {
        "base_customization_effort": base,
        "customer_requires_industry_workflows": p.get("customerRequiresIndustryWorkflows"),
        "industry_specific_penalty": industry_penalty,
        "business_process_changes": business_process_changes,
        "workflow_modification_penalty": workflow_penalty,
        "value": base + industry_penalty + workflow_penalty,
    }


def calc_timeline_pressure(p: dict[str, Any]) -> dict[str, Any]:
    months = p.get("implementationTimelineMonths")
    if months < 2:
        base_risk = 30
    elif months < 3:
        base_risk = 20
    elif months < 6:
        base_risk = 10
    elif months < 12:
        base_risk = 5
    else:
        base_risk = 2

    deadline_criticality = 0
    months_until = p.get("monthsUntilDeadline")
    if p.get("regulatoryDeadlineExists") and months_until is not None:
        deadline_criticality = min(15, months_until * -3 + 20)
        deadline_criticality = max(0, deadline_criticality)

    return {
        "implementation_timeline_months": months,
        "base_timeline_risk": base_risk,
        "regulatory_deadline_exists": p.get("regulatoryDeadlineExists"),
        "months_until_deadline": months_until if months_until is not None else None,
        "deadline_criticality_bonus": deadline_criticality,
        "value": base_risk + deadline_criticality,
    }


def calc_feature_gap(p: dict[str, Any]) -> dict[str, Any]:
    base_gap = (100 - p.get("productFeatureMatchPct", 0)) / 2
    missing = p.get("missingCriticalFeatures")
    critical_count = len(missing) if isinstance(missing, list) else 0
    critical_penalty = critical_count * 8

    return {
        "product_feature_match_pct": p.get("productFeatureMatchPct"),
        "feature_gap_base": float(f"{base_gap:.4f}"),
        "missing_critical_features": missing if missing is not None else [],
        "missing_critical_count": critical_count,
        "critical_feature_penalty": critical_penalty,
        "value": float(f"{base_gap + critical_penalty:.4f}"),
    }


def calc_mitigation_gap(p: dict[str, Any]) -> dict[str, Any]:
    avg_per_risk = p.get("avgMitigationsPerRisk")
    if avg_per_risk is None:
        avg_per_risk = 4
    required_mit = p.get("customerSpecificRiskCount", 0) * avg_per_risk
    proposed_mit = p.get("proposedMitigationsCount", 0)
    max_penalty = 40

    gap = max(0, required_mit - proposed_mit)
    gap_ratio = gap / required_mit if required_mit > 0 else 0
    value = float(f"{gap_ratio * max_penalty:.4f}")
    default_no_mitigation = proposed_mit == 0 and required_mit > 0
    if default_no_mitigation:
        value = min(value, 20.0)

    return {
        "customer_specific_risk_count": p.get("customerSpecificRiskCount"),
        "avg_mitigations_per_risk": avg_per_risk,
        "required_mitigations": required_mit,
        "proposed_mitigations": proposed_mit,
        "mitigation_gap_count": gap,
        "gap_ratio": float(f"{gap_ratio:.4f}"),
        "max_penalty": max_penalty,
        "default_no_mitigation_data": default_no_mitigation,
        "note": "default — no mitigation data" if default_no_mitigation else None,
        "value": value,
    }


def calculate_implementation_risk(p: dict[str, Any]) -> dict[str, Any]:
    integration = calc_integration_complexity(p)
    customization = calc_customization_required(p)
    timeline = calc_timeline_pressure(p)
    feature_gap = calc_feature_gap(p)
    mitigation_gap = calc_mitigation_gap(p)

    raw = (
        integration["value"]
        + customization["value"]
        + timeline["value"]
        + feature_gap["value"]
        + mitigation_gap["value"]
    )
    value = float(f"{min(100, raw):.4f}")

    return {
        "integration_complexity": integration,
        "customization_required": customization,
        "timeline_pressure": timeline,
        "feature_gap": feature_gap,
        "mitigation_gap": mitigation_gap,
        "raw_total": float(f"{raw:.4f}"),
        "is_capped": raw > 100,
        "value": value,
    }


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3 – COMPETITIVE RISK
# ─────────────────────────────────────────────────────────────────────────────


def calc_competitive_alternatives(p: dict[str, Any]) -> dict[str, Any]:
    competitor_map: dict[str, float] = {
        "0 (sole source)": 0,
        "1 competitor": 10,
        "2-3 competitors": 20,
        "4+ competitors": 25,
    }

    base_competition = _mapped(p, "competitorCount", competitor_map, 10, "competitorCount")

    build_capability_map: dict[str, float] = {
        "Strong (can build)": 20,
        "Moderate (difficult build)": 10,
        "Weak (unlikely to build)": 5,
    }

    build_penalty = 0
    if p.get("customerConsideringBuildVsBuy"):
        cap = _mapped(
            p,
            "customerTechnicalCapability",
            build_capability_map,
            10,
            "customerTechnicalCapability",
        )
        build_penalty = cap

    return {
        "competitor_count_label": p.get("competitorCount"),
        "base_competition_points": base_competition,
        "customer_considering_build_vs_buy": p.get("customerConsideringBuildVsBuy"),
        "customer_technical_capability": p.get("customerTechnicalCapability"),
        "build_option_penalty": build_penalty,
        "value": base_competition + build_penalty,
    }


def calc_budget_constraint(p: dict[str, Any]) -> dict[str, Any]:
    budget_map: dict[str, float] = {
        "< $100K": 35,
        "$100K-$250K": 25,
        "$250K-$500K": 15,
        "$500K-$1M": 10,
        "$1M-$5M": 5,
        "> $5M": 0,
    }
    approval_map: dict[str, float] = {
        "VP_and_below": 0,
        "C_suite_single": 3,
        "C_suite_multiple": 8,
        "Board_approval": 15,
    }

    budget_pts = _mapped(p, "budgetMidpoint", budget_map, 25, "budgetMidpoint")
    approval_pts = _mapped(p, "approvalLevels", approval_map, 3, "approvalLevels")

    return {
        "budget_midpoint": p.get("budgetMidpoint"),
        "budget_base_points": budget_pts,
        "approval_levels": p.get("approvalLevels"),
        "budget_approval_complexity": approval_pts,
        "value": budget_pts + approval_pts,
    }


def calc_competitive_advantage(p: dict[str, Any]) -> dict[str, Any]:
    differentiator_value_map: dict[str, float] = {
        "Regulatory_certification": 10,
        "Proven_customer_in_sector": 8,
        "Faster_deployment": 5,
        "Lower_TCO": 7,
        "Superior_feature_set": 6,
        "Domain_expertise": 8,
        "Technology_leadership": 5,
    }

    differentiators = p.get("uniqueDifferentiators") or []
    differentiator_breakdown = []
    for d in differentiators:
        advantage_type = d.get("advantageType") if isinstance(d, dict) else None
        val = differentiator_value_map.get(advantage_type)
        if val is None:
            _note_degraded(p, "advantageType")
            continue
        differentiator_breakdown.append(
            {"advantage_type": advantage_type, "value": val}
        )

    differentiator_total = sum(d["value"] for d in differentiator_breakdown)
    years = p.get("yearsInCustomerSector")
    if years is None:
        years = 0
    industry_bonus = -10 if years >= 5 else 0

    value = -differentiator_total + industry_bonus

    return {
        "unique_differentiators": differentiator_breakdown,
        "differentiator_total": differentiator_total,
        "years_in_customer_sector": years,
        "industry_expertise_bonus": industry_bonus,
        "note": "Negative value = competitive advantage (reduces risk)",
        "value": float(f"{value:.4f}"),
    }


def calc_vendor_buyer_maturity_gap(p: dict[str, Any]) -> dict[str, Any]:
    gap_table: dict[str, dict[str, float]] = {
        "startup": {"Enterprise": 25, "Mid_market": 15, "SMB": 5},
        "growth": {"Enterprise": 15, "Mid_market": 5, "SMB": 0},
        "established": {"Enterprise": 5, "Mid_market": 0, "SMB": 0},
        "mature": {"Enterprise": 0, "Mid_market": 0, "SMB": 0},
    }

    stage_row = gap_table.get(p.get("vendorStage"))
    if not stage_row:
        _note_degraded(p, "vendorStage")
        stage_row = gap_table["established"]
    base_gap = stage_row.get(p.get("customerType"), 0)

    mismatch_penalty = 0.0
    if p.get("customerExpectsLargerVendorFeatures"):
        cust_emp = p.get("customerEmployeeCount")
        if cust_emp is None:
            cust_emp = 0
        vend_emp = p.get("vendorEmployeeCount")
        if vend_emp is None:
            vend_emp = 1
        mismatch_penalty = min(15, (cust_emp / vend_emp) * 3)
        mismatch_penalty = float(f"{mismatch_penalty:.4f}")

    return {
        "vendor_stage": p.get("vendorStage"),
        "customer_type": p.get("customerType"),
        "base_maturity_gap": base_gap,
        "customer_expects_larger_vendor_features": p.get(
            "customerExpectsLargerVendorFeatures"
        ),
        "customer_employee_count": (
            p.get("customerEmployeeCount")
            if p.get("customerEmployeeCount") is not None
            else None
        ),
        "vendor_employee_count": (
            p.get("vendorEmployeeCount")
            if p.get("vendorEmployeeCount") is not None
            else None
        ),
        "expectation_mismatch_penalty": mismatch_penalty,
        "value": float(f"{base_gap + mismatch_penalty:.4f}"),
    }


def calculate_competitive_risk(p: dict[str, Any]) -> dict[str, Any]:
    alternatives = calc_competitive_alternatives(p)
    budget = calc_budget_constraint(p)
    advantage = calc_competitive_advantage(p)
    maturity_gap = calc_vendor_buyer_maturity_gap(p)

    raw = (
        alternatives["value"]
        + budget["value"]
        + advantage["value"]
        + maturity_gap["value"]
    )
    value = float(f"{max(0, raw):.4f}")

    return {
        "competitive_alternatives": alternatives,
        "budget_constraint": budget,
        "competitive_advantage": advantage,
        "vendor_buyer_maturity_gap": maturity_gap,
        "raw_total": float(f"{raw:.4f}"),
        "is_floored": raw < 0,
        "value": value,
    }


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4 – FINAL SALES RISK SCORE
# ─────────────────────────────────────────────────────────────────────────────


def interpret_sales_risk_score(deal_probability: float) -> dict[str, str]:
    if deal_probability >= 90:
        return {
            "grade": "A",
            "classification": "High Confidence Deal",
            "deal_characteristics": "Low friction; strong fit; weak competition",
            "recommended_actions": "Standard sales process; focus on value demonstration",
        }
    if deal_probability >= 80:
        return {
            "grade": "B",
            "classification": "Favorable Deal",
            "deal_characteristics": "Minor friction; good fit; manageable competition",
            "recommended_actions": "Standard sales process; executive sponsorship helpful",
        }
    if deal_probability >= 70:
        return {
            "grade": "C",
            "classification": "Moderate Deal",
            "deal_characteristics": "Some friction; gaps present; competitive pressure",
            "recommended_actions": "Extended sales cycle; custom proposal with mitigation roadmap",
        }
    if deal_probability >= 60:
        return {
            "grade": "D",
            "classification": "Review Deal Strategy",
            "deal_characteristics": "Strategy High friction; notable gaps; strong competition",
            "recommended_actions": "Executive engagement required; review resource investment before pursuing",
        }
    return {
        "grade": "F",
        "classification": "Reassess Opportunity",
        "deal_characteristics": "Critical friction; major gaps; intense competition",
        "recommended_actions": "Reassess deal viability; only pursue if strategically critical ",
    }


def calc_intent_multiplier(p: dict[str, Any]) -> dict[str, Any]:
    """
    Intent multiplier for type 2 (SRS), same bands as VTS / AI Risk Intellect enrichment:
    Intentional (>60%) → 1.2, Unintentional (>60%) → 0.7, Mixed → 1.0.
    Accepts precomputed intent_multiplier_value or intentional/unintentional counts.
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


def calculate_sales_risk_score(user_input: dict[str, Any]) -> dict[str, Any]:
    cfr = calculate_customer_friction_risk(user_input)
    ir = calculate_implementation_risk(user_input)
    cr = calculate_competitive_risk(user_input)
    intent = calc_intent_multiplier(user_input)

    base_weighted = cfr["value"] * 0.35 + ir["value"] * 0.35 + cr["value"] * 0.3
    weighted_score = base_weighted * float(intent["value"])
    srs = float(f"{min(100, max(0, weighted_score)):.2f}")
    deal_probability = float(f"{max(0, 100 - srs):.2f}")
    deal_probability_rounded = max(0, min(100, round(deal_probability)))
    interpretation = interpret_sales_risk_score(deal_probability_rounded)
    degraded = user_input.get("_degraded_fields") if isinstance(user_input.get("_degraded_fields"), list) else []

    return {
        "sales_risk_score": srs,
        "deal_probability_pct": deal_probability,
        "customer_friction_risk": cfr["value"],
        "implementation_risk": ir["value"],
        "competitive_risk": cr["value"],
        "grade": interpretation["grade"],
        "classification": interpretation["classification"],
        "deal_characteristics": interpretation["deal_characteristics"],
        "recommended_actions": interpretation["recommended_actions"],
        "scoring_source": "degraded" if degraded else "formula",
        "degraded_fields": degraded,
        "detail": {
            "customer_friction_risk": cfr,
            "implementation_risk": ir,
            "competitive_risk": cr,
            "intent_multiplier": intent,
            "final_formula": {
                "expression": (
                    "SRS = min(100, ((CFR × 0.35) + (IR × 0.35) + (CR × 0.30)) × Intent)"
                ),
                "customer_friction_contribution": float(f"{cfr['value'] * 0.35:.4f}"),
                "implementation_risk_contribution": float(f"{ir['value'] * 0.35:.4f}"),
                "competitive_risk_contribution": float(f"{cr['value'] * 0.3:.4f}"),
                "base_weighted_sum": float(f"{base_weighted:.4f}"),
                "intent_multiplier": intent["value"],
                "intent_profile": intent["profile"],
                "weighted_sum": float(f"{weighted_score:.4f}"),
            },
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# PAYLOAD NORMALIZERS / FORMULA INPUT BUILDER
# ─────────────────────────────────────────────────────────────────────────────


def to_string_value(v: Any) -> str:
    return str(v if v is not None else "").strip()


def _vendor_stage_for_formula(payload: dict[str, Any]) -> str:
    raw = to_string_value(
        payload.get("vendorStage")
        or payload.get("vendor_stage")
        or payload.get("vendorMaturity")
        or payload.get("vendor_maturity")
        or payload.get("company_stage")
    ).lower()
    if any(t in raw for t in ("startup", "early-stage", "early stage", "seed")):
        return "startup"
    if any(t in raw for t in ("mature", "publicly", "profitable")):
        return "mature"
    if any(t in raw for t in ("established", "late")):
        return "established"
    if any(t in raw for t in ("growth", "scaling")):
        return "growth"
    return "established"


def _years_in_customer_sector(payload: dict[str, Any]) -> int:
    explicit = payload.get("yearsInCustomerSector") or payload.get("years_in_customer_sector")
    n = _safe_int(explicit, -1)
    if n >= 0:
        return n
    founded = payload.get("yearFounded") or payload.get("year_founded")
    year = _safe_int(founded, 0)
    if 1900 <= year <= datetime.now().year:
        return max(0, datetime.now().year - year)
    return 0


def _vendor_employee_count(payload: dict[str, Any]) -> int:
    raw = (
        payload.get("vendorEmployeeCount")
        or payload.get("vendor_employee_count")
        or payload.get("employeeCount")
        or payload.get("no_of_employees")
        or payload.get("employee_count")
    )
    if isinstance(raw, (int, float)) and raw > 0:
        return int(raw)
    from services.scoring_service import band_employee_count

    band = band_employee_count(raw)
    return {
        "1-10": 5,
        "11-50": 30,
        "51-200": 125,
        "201-1000": 500,
        "1001-5000": 3000,
        "5001-10000": 7500,
        "10000+": 15000,
    }.get(band, 50)


def _product_feature_match_pct(payload: dict[str, Any]) -> int:
    explicit = payload.get("productFeatureMatchPct") or payload.get("product_feature_match_pct")
    n = _safe_int(explicit, -1)
    if 0 <= n <= 100:
        return n
    features = to_string_list(
        payload.get("product_features")
        if payload.get("product_features") is not None
        else payload.get("productFeatures")
    )
    if not features:
        return 50
    return min(100, 40 + 8 * min(len(features), 7))


def _safe_normalize(fn, raw: str, fallback: str, payload: dict[str, Any] | None = None, field: str = "") -> str:
    try:
        return fn(raw)
    except Exception:
        if payload is not None and field:
            _note_degraded(payload, field)
        return fallback


def _safe_int(v: Any, default: int = 0) -> int:
    try:
        if v is None or v is False:
            return default
        return int(v)
    except (TypeError, ValueError):
        return default


_NONE_SELECTION = re.compile(r"^none(\b|/|-)", re.I)


def _is_none_selection(s: str) -> bool:
    return bool(_NONE_SELECTION.match(s.strip()))


def to_string_list(v: Any) -> list[str]:
    if isinstance(v, list):
        return [
            str(x if x is not None else "").strip()
            for x in v
            if str(x if x is not None else "").strip()
            and not _is_none_selection(str(x))
        ]
    s = to_string_value(v)
    if not s:
        return []
    if s[0] in ("[", "{"):
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                return to_string_list(parsed)
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
    return [x.strip() for x in s.split(",") if x.strip() and not _is_none_selection(x)]


def structured_option_list(v: Any) -> list[str]:
    """Structured chip values only — do not score comma frequency in prose."""
    if isinstance(v, list):
        return [
            str(x).strip()
            for x in v
            if str(x or "").strip() and not _is_none_selection(str(x))
        ]
    s = to_string_value(v)
    if not s or _is_none_selection(s):
        return []
    if s[0] in ("[", "{"):
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                return structured_option_list(parsed)
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
    return [s]


def regulatory_requirements_to_string_list(v: Any) -> list[str]:
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x if x is not None else "").strip() for x in v if str(x if x is not None else "").strip()]
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return []
        c0 = s[0]
        if c0 in ("[", "{"):
            try:
                parsed = json.loads(s)
                if isinstance(parsed, list):
                    return [
                        str(x if x is not None else "").strip()
                        for x in parsed
                        if str(x if x is not None else "").strip()
                    ]
            except (json.JSONDecodeError, TypeError, ValueError):
                pass
        return [x.strip() for x in s.split(",") if x.strip()]
    return []


def normalize_sector_for_formula(raw: str) -> str:
    s = raw.lower()
    if "autonomous" in s:
        return "Autonomous_Systems"
    healthcare = any(t in s for t in ("healthcare", "hospital", "medical", "pharma"))
    financial = "financial" in s or "bank" in s or ("insurance" in s and "health" not in s)
    government = "government" in s or "federal" in s
    ecommerce = "retail" in s or "e-commerce" in s or "ecommerce" in s
    technology = "technology" in s or "software" in s
    if healthcare:
        return "Healthcare"
    if financial:
        return "Financial_Services"
    if government:
        return "Government"
    if ecommerce:
        return "E_Commerce"
    if technology:
        return "Technology"
    return "Other"


def normalize_risk_tolerance_for_formula(raw: str) -> str:
    s = raw.lower().strip()
    if s.startswith("very low") or "zero tolerance" in s:
        return "Risk_averse"
    if s.startswith("low"):
        return "Conservative"
    if s.startswith("very high") or s.startswith("high"):
        return "Aggressive"
    if s.startswith("moderate"):
        return "Moderate"
    return "Moderate"


def normalize_data_sensitivity_for_formula(raw: str) -> str:
    s = raw.lower()
    if s.startswith("public") or "no sensitive" in s:
        return "Low (Public or anonymized)"
    if (
        "extremely sensitive" in s
        or "national security" in s
        or "itar" in s
        or "cui" in s
    ):
        return "Critical (Life-safety, National security)"
    if "highly sensitive" in s or "phi" in s or "pci" in s:
        return "High (PHI, Financial data, PII)"
    if s.startswith("sensitive") or "pii" in s or "business critical" in s:
        return "High (PHI, Financial data, PII)"
    if "internal" in s or "business confidential" in s:
        return "Medium (Business confidential)"
    return "Low (Public or anonymized)"


def normalize_customization_for_formula(raw: str) -> str:
    s = raw.lower()
    if "none" in s or "as-is" in s or "as is" in s:
        return "None (use as-is)"
    if "minimal" in s or "no code" in s:
        return "Minimal (configuration only)"
    if "moderate" in s:
        return "Moderate (config + light dev)"
    if "significant" in s:
        return "Significant (custom model training)"
    if "extensive" in s or "major" in s:
        return "Extensive (significant dev)"
    if "custom" in s:
        return "Custom_build"
    return "Moderate (config + light dev)"


def build_integration_points_for_formula(raw: str) -> list[dict[str, str]]:
    s = raw.lower()
    if "standalone" in s:
        return [{"systemType": "SaaS_standard_connector"}]
    if "simple" in s:
        return [{"systemType": "Cloud_native_API"}]
    if "moderate" in s:
        return [
            {"systemType": "Microservices"},
            {"systemType": "Modern_monolith"},
        ]
    if "complex" in s and "very" not in s:
        return [
            {"systemType": "Legacy_client_server"},
            {"systemType": "Modern_monolith"},
            {"systemType": "Microservices"},
            {"systemType": "Cloud_native_API"},
        ]
    return [
        {"systemType": "Legacy_mainframe"},
        {"systemType": "Legacy_client_server"},
        {"systemType": "Modern_monolith"},
        {"systemType": "Microservices"},
        {"systemType": "Cloud_native_API"},
    ]


def timeline_months_for_formula(raw: str) -> int:
    s = raw.lower()
    if "exploratory" in s or "no specific" in s:
        return 30
    if "immediate" in s:
        return 1
    if "1-3" in s:
        return 2
    if "3-6" in s:
        return 5
    if "6-12" in s:
        return 9
    if "12-18" in s:
        return 15
    if "18+" in s:
        return 20
    return 8


def budget_for_formula(raw: str) -> str:
    s = raw.lower()
    if not s.strip() or "not yet determined" in s or "undetermined" in s or "not known" in s:
        return "< $100K"
    if "under $50" in s or "$50k - $100k" in s or "$50k-$100k" in s:
        return "< $100K"
    if "$100k - $250k" in s or "$100k-$250k" in s:
        return "$100K-$250K"
    if "$250k - $500k" in s or "$250k-$500k" in s:
        return "$250K-$500K"
    if "$500k - $1m" in s or "$500k-$1m" in s:
        return "$500K-$1M"
    if "$1m - $5m" in s or "$1m-$5m" in s:
        return "$1M-$5M"
    if "$5m - $10m" in s or "$5m-$10m" in s or "over $10" in s or "> $10" in s:
        return "> $5M"
    return "< $100K"


def competitor_label_and_build(raw: str) -> tuple[str, bool]:
    s = (raw or "").strip()
    sl = s.lower()
    considering_build = bool(re.search(r"(?<![a-z])build(?![a-z])", sl))
    if not s:
        return "1 competitor", False
    if "sole" in sl or "no alternative" in sl:
        return "0 (sole source)", considering_build
    parts = [p.strip() for p in re.split(r"[,;\n]| and ", s) if p.strip()]
    n = len(parts)
    if n >= 4:
        return "4+ competitors", considering_build
    if n >= 2:
        return "2-3 competitors", considering_build
    return "1 competitor", considering_build


def _first_present(payload: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key not in payload:
            continue
        v = payload.get(key)
        if v is None:
            continue
        if isinstance(v, str) and not v.strip():
            continue
        if isinstance(v, (list, dict)) and len(v) == 0:
            continue
        return v
    return None


def _parse_jsonish(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, (list, dict)):
        return v
    if isinstance(v, str):
        s = v.strip()
        if s[:1] in ("[", "{"):
            try:
                return json.loads(s)
            except (json.JSONDecodeError, TypeError, ValueError):
                return v
    return v


def _competitor_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    parsed = _parse_jsonish(_first_present(payload, "competitors"))
    if not isinstance(parsed, list):
        return []
    rows: list[dict[str, Any]] = []
    for item in parsed:
        if isinstance(item, dict):
            name = str(item.get("name") or "").strip()
            if name:
                rows.append(item)
        else:
            name = str(item or "").strip()
            if name:
                rows.append({"name": name})
    return rows


def _competitor_label_from_count(n: int) -> str:
    if n <= 0:
        return "0 (sole source)"
    if n == 1:
        return "1 competitor"
    if n <= 3:
        return "2-3 competitors"
    return "4+ competitors"


def _advantage_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    parsed = _parse_jsonish(
        _first_present(payload, "key_advantages_rows", "keyAdvantagesRows")
    )
    if not isinstance(parsed, list):
        return []
    rows: list[dict[str, Any]] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        text = str(item.get("advantage") or item.get("text") or "").strip()
        if not text:
            continue
        rows.append(item)
    return rows


_ADVANTAGE_CATEGORY_MAP = {
    "product": "Superior_feature_set",
    "security": "Technology_leadership",
    "compliance": "Regulatory_certification",
    "price": "Lower_TCO",
    "support": "Faster_deployment",
    "ecosystem": "Proven_customer_in_sector",
}


def _differentiators_from_advantage_rows(rows: list[dict[str, Any]]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for row in rows[:3]:
        cat = str(row.get("category") or "").strip().lower()
        mapped = _ADVANTAGE_CATEGORY_MAP.get(cat, "Domain_expertise")
        out.append({"advantageType": mapped})
    return out


def _headcount_midpoint(raw: Any) -> int | None:
    if raw is None or raw is False:
        return None
    if isinstance(raw, (int, float)) and raw > 0:
        return int(raw)
    compact = re.sub(r"[,\s]", "", str(raw)).replace("–", "-").replace("—", "-").lower()
    if not compact or compact.startswith("not"):
        return None
    table = (
        ("50000+", 75000),
        ("10001-50000", 30000),
        ("5001-10000", 7500),
        ("1001-5000", 3000),
        ("501-1000", 750),
        ("201-500", 350),
        ("51-200", 125),
        ("1-50", 25),
    )
    for key, mid in table:
        if key in compact:
            return mid
    return None


def _customer_type_from_headcount(mid: int) -> str:
    if mid >= 5001:
        return "Enterprise"
    if mid >= 501:
        return "Mid_market"
    return "SMB"


def _years_from_opportunity_type(raw: str) -> int | None:
    s = raw.lower()
    if not s.strip():
        return None
    if "renewal" in s:
        return 5
    if "expansion" in s:
        return 3
    if "new logo" in s or "speculative" in s or "displacement" in s:
        return 0
    return None


def _build_vs_buy_from_signal(raw: str) -> tuple[bool, str] | None:
    s = raw.lower().strip()
    if not s:
        return None
    if s.startswith("yes"):
        return True, "Strong (can build)"
    if s.startswith("possible"):
        return True, "Moderate (difficult build)"
    if s.startswith("no signal"):
        return False, "Weak (unlikely to build)"
    if "not known" in s:
        return False, "Weak (unlikely to build)"
    return None


def _capability_from_eng_headcount(raw: str) -> str | None:
    s = raw.lower()
    if not s.strip() or "not known" in s:
        return None
    if "under 50" in s:
        return "Weak (unlikely to build)"
    if s.startswith("50-") or "50-250" in s:
        return "Moderate (difficult build)"
    return "Strong (can build)"


def _approval_from_ownership(raw: str) -> str | None:
    s = raw.lower()
    if not s.strip() or "not known" in s:
        return None
    if "government" in s or "publicly" in s:
        return "Board_approval"
    if "pe owned" in s or "pe-owned" in s:
        return "C_suite_multiple"
    if "founder" in s or "family" in s:
        return "VP_and_below"
    if "vc" in s or "non-profit" in s or "ngo" in s:
        return "C_suite_single"
    return None


def _integration_band_from_systems(raw: Any) -> str | None:
    systems = to_string_list(raw)
    if raw is None or raw == "":
        return None
    named = [s for s in systems if s]
    n = len(named)
    if n == 0:
        return "Standalone - No Integrations Required"
    if n == 1:
        return "Simple - Single System Integration (e.g., SSO only)"
    if n <= 3:
        return "Moderate - 2-3 System Integrations"
    if n <= 6:
        return "Complex - 4-6 System Integrations"
    return "Very Complex - 7+ System Integrations or Legacy Systems"


def _ai_maturity_evidence_count(payload: dict[str, Any]) -> int | None:
    raw = _first_present(
        payload, "customer_ai_maturity_evidence", "customerAiMaturityEvidence"
    )
    if raw is None:
        return None
    items = to_string_list(raw)
    return len(items)


def customer_type_for_formula(budget_midpoint: str) -> str:
    if budget_midpoint in ("$1M-$5M", "> $5M"):
        return "Enterprise"
    if budget_midpoint in ("$250K-$500K", "$500K-$1M"):
        return "Mid_market"
    return "SMB"


def build_sales_risk_formula_input(payload: dict[str, Any]) -> dict[str, Any]:
    sector = _safe_normalize(
        normalize_sector_for_formula,
        to_string_value(payload.get("customer_sector") or payload.get("customerSector")),
        "Other",
        payload,
        "sector",
    )
    customer_specific_risks = to_string_list(
        payload.get("customer_specific_risks")
        if payload.get("customer_specific_risks") is not None
        else payload.get("customerSpecificRisks")
    )
    regulatory = [
        r for r in regulatory_requirements_to_string_list(
            payload.get("regulatory_requirements")
            if payload.get("regulatory_requirements") is not None
            else payload.get("regulatoryRequirements")
        )
        if not _is_none_selection(r)
    ]
    risk_mitigations = to_string_list(
        payload.get("risk_mitigation")
        if payload.get("risk_mitigation") is not None
        else payload.get("riskMitigation")
    )
    budget_midpoint = budget_for_formula(
        to_string_value(
            payload.get("customer_budget_range") or payload.get("customerBudgetRange")
        )
    )
    customer_emp = _headcount_midpoint(
        _first_present(payload, "customer_employee_count", "customerEmployeeCount")
    )
    if customer_emp is not None:
        customer_type = _customer_type_from_headcount(customer_emp)
        customer_employee_count = customer_emp
    else:
        customer_type = customer_type_for_formula(budget_midpoint)
        if customer_type == "Enterprise":
            customer_employee_count = 2000
        elif customer_type == "Mid_market":
            customer_employee_count = 500
        else:
            customer_employee_count = 100

    competitor_rows = _competitor_rows(payload)
    alternatives = to_string_value(
        payload.get("alternatives_considered") or payload.get("alternativesConsidered")
    )
    if competitor_rows:
        competitor_count = _competitor_label_from_count(len(competitor_rows))
        considering_build = False
    else:
        competitor_count, considering_build = competitor_label_and_build(alternatives)

    build_signal = _build_vs_buy_from_signal(
        to_string_value(
            _first_present(payload, "build_vs_buy_signal", "buildVsBuySignal") or ""
        )
    )
    eng_cap = _capability_from_eng_headcount(
        to_string_value(
            _first_present(payload, "customer_eng_headcount", "customerEngHeadcount") or ""
        )
    )
    if build_signal:
        considering_build, signal_cap = build_signal
        customer_technical_capability = eng_cap or signal_cap
    elif eng_cap:
        customer_technical_capability = eng_cap
    else:
        customer_technical_capability = "Moderate (difficult build)"

    adv_rows = _advantage_rows(payload)
    key_advantages = structured_option_list(
        payload.get("key_advantages")
        if payload.get("key_advantages") is not None
        else payload.get("keyAdvantages")
    )
    if adv_rows:
        unique_differentiators = _differentiators_from_advantage_rows(adv_rows)
    elif key_advantages:
        unique_differentiators = [
            {"advantageType": "Domain_expertise"} for _ in key_advantages[:3]
        ]
    else:
        unique_differentiators = []

    opp_years = _years_from_opportunity_type(
        to_string_value(
            _first_present(payload, "opportunity_type", "opportunityType") or ""
        )
    )
    years_in_sector = (
        opp_years if opp_years is not None else _years_in_customer_sector(payload)
    )

    approval = _approval_from_ownership(
        to_string_value(
            _first_present(payload, "customer_ownership", "customerOwnership") or ""
        )
    )

    systems_raw = _first_present(
        payload, "likely_integration_systems", "likelyIntegrationSystems"
    )
    integration_band = _integration_band_from_systems(systems_raw)
    if integration_band is None:
        integration_band = to_string_value(
            payload.get("integration_complexity") or payload.get("integrationComplexity")
        )

    vendor_emp = _vendor_employee_count(payload)
    expects_larger = customer_employee_count > vendor_emp * 2

    evidence_count = _ai_maturity_evidence_count(payload)
    vendor_stage = _vendor_stage_for_formula(payload)
    if evidence_count is not None and evidence_count >= 3:
        vendor_stage = "mature"

    other_risks = (
        payload.get("customer_specific_risks_other")
        if payload.get("customer_specific_risks_other") is not None
        else payload.get("customerSpecificRisksOther")
    )

    return {
        "customerRegulatoryRequirements": regulatory,
        "sector": sector,
        "customerDataSensitivity": _safe_normalize(
            normalize_data_sensitivity_for_formula,
            to_string_value(
                payload.get("data_sensitivity") or payload.get("dataSensitivity")
            ),
            "Low (Public or anonymized)",
            payload,
            "customerDataSensitivity",
        ),
        "customerRiskTolerance": _safe_normalize(
            normalize_risk_tolerance_for_formula,
            to_string_value(
                payload.get("customer_risk_tolerance")
                or payload.get("customerRiskTolerance")
            ),
            "Moderate",
            payload,
            "customerRiskTolerance",
        ),
        "customerSpecificRiskCount": len(customer_specific_risks),
        "customerType": customer_type,
        "customerHasUniqueRequirements": False,
        "uniqueRequirementsList": to_string_list(other_risks),
        "integrationPoints": build_integration_points_for_formula(integration_band),
        "customizationLevel": _safe_normalize(
            normalize_customization_for_formula,
            to_string_value(
                payload.get("customization_level") or payload.get("customizationLevel")
            ),
            "Moderate (config + light dev)",
            payload,
            "customizationLevel",
        ),
        "customerRequiresIndustryWorkflows": customer_type != "SMB",
        "businessProcessChangesRequired": min(4, max(0, len(customer_specific_risks))),
        "implementationTimelineMonths": timeline_months_for_formula(
            to_string_value(
                payload.get("implementation_timeline")
                or payload.get("implementationTimeline")
            )
        ),
        "regulatoryDeadlineExists": False,
        "monthsUntilDeadline": None,
        "productFeatureMatchPct": _product_feature_match_pct(payload),
        "missingCriticalFeatures": [],
        "proposedMitigationsCount": len(risk_mitigations),
        "avgMitigationsPerRisk": 4 if risk_mitigations else 0,
        "competitorCount": competitor_count,
        "customerConsideringBuildVsBuy": considering_build,
        "customerTechnicalCapability": customer_technical_capability,
        "budgetMidpoint": budget_midpoint,
        "approvalLevels": approval or "C_suite_single",
        "uniqueDifferentiators": unique_differentiators,
        "yearsInCustomerSector": years_in_sector,
        "vendorStage": vendor_stage,
        "customerExpectsLargerVendorFeatures": expects_larger,
        "customerEmployeeCount": customer_employee_count,
        "vendorEmployeeCount": vendor_emp,
        "intentionalRiskCount": _safe_int(payload.get("intentionalRiskCount"), 0),
        "unintentionalRiskCount": _safe_int(payload.get("unintentionalRiskCount"), 0),
        "intent_multiplier_value": payload.get("intent_multiplier_value")
        if payload.get("intent_multiplier_value") is not None
        else payload.get("intentMultiplierValue"),
        "intent_profile": payload.get("intent_profile")
        if payload.get("intent_profile") is not None
        else payload.get("intentProfile"),
        "_degraded_fields": list(payload.get("_degraded_fields") or []),
    }


__all__ = [
    "build_sales_risk_formula_input",
    "calculate_sales_risk_score",
    "calc_intent_multiplier",
    "interpret_sales_risk_score",
    "calc_regulatory_complexity",
    "calc_data_sensitivity_friction",
    "calc_risk_tolerance_friction",
    "calc_customer_specific_risk_friction",
    "calculate_customer_friction_risk",
    "calc_integration_complexity",
    "calc_customization_required",
    "calc_timeline_pressure",
    "calc_feature_gap",
    "calc_mitigation_gap",
    "calculate_implementation_risk",
    "calc_competitive_alternatives",
    "calc_budget_constraint",
    "calc_competitive_advantage",
    "calc_vendor_buyer_maturity_gap",
    "calculate_competitive_risk",
    "to_string_value",
    "to_string_list",
    "regulatory_requirements_to_string_list",
    "normalize_sector_for_formula",
    "normalize_risk_tolerance_for_formula",
    "normalize_data_sensitivity_for_formula",
    "normalize_customization_for_formula",
    "build_integration_points_for_formula",
    "timeline_months_for_formula",
    "budget_for_formula",
    "customer_type_for_formula",
]
