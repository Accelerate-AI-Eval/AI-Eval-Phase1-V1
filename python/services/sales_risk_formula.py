"""Sales Risk Score formula — ported from vendorCotsReportAgent.ts."""

from __future__ import annotations

import json
from typing import Any


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

    base_points = sensitivity_map.get(p.get("customerDataSensitivity"))
    if base_points is None:
        raise ValueError(
            f"Unknown customerDataSensitivity: {p.get('customerDataSensitivity')}"
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

    base = tolerance_map.get(p.get("customerRiskTolerance"))
    if base is None:
        raise ValueError(
            f"Unknown customerRiskTolerance: {p.get('customerRiskTolerance')}"
        )

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

    risk_weight = risk_weight_map.get(p.get("customerType"))
    if risk_weight is None:
        raise ValueError(f"Unknown customerType: {p.get('customerType')}")

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
            raise ValueError(f"Unknown systemType: {system_type}")
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
        "Extensive (significant dev)": 25,
        "Custom_build": 40,
    }
    industry_penalty_map: dict[str, float] = {
        "Healthcare": 12,
        "Financial_Services": 10,
        "Government": 8,
        "Other": 5,
    }

    base = cust_map.get(p.get("customizationLevel"))
    if base is None:
        raise ValueError(f"Unknown customizationLevel: {p.get('customizationLevel')}")

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

    return {
        "customer_specific_risk_count": p.get("customerSpecificRiskCount"),
        "avg_mitigations_per_risk": avg_per_risk,
        "required_mitigations": required_mit,
        "proposed_mitigations": proposed_mit,
        "mitigation_gap_count": gap,
        "gap_ratio": float(f"{gap_ratio:.4f}"),
        "max_penalty": max_penalty,
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

    base_competition = competitor_map.get(p.get("competitorCount"))
    if base_competition is None:
        raise ValueError(f"Unknown competitorCount: {p.get('competitorCount')}")

    build_capability_map: dict[str, float] = {
        "Strong (can build)": 20,
        "Moderate (difficult build)": 10,
        "Weak (unlikely to build)": 5,
    }

    build_penalty = 0
    if p.get("customerConsideringBuildVsBuy"):
        cap = build_capability_map.get(p.get("customerTechnicalCapability"))
        if cap is None:
            raise ValueError(
                f"Unknown customerTechnicalCapability: {p.get('customerTechnicalCapability')}"
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

    budget_pts = budget_map.get(p.get("budgetMidpoint"))
    if budget_pts is None:
        raise ValueError(f"Unknown budgetMidpoint: {p.get('budgetMidpoint')}")
    approval_pts = approval_map.get(p.get("approvalLevels"))
    if approval_pts is None:
        raise ValueError(f"Unknown approvalLevels: {p.get('approvalLevels')}")

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
            raise ValueError(f"Unknown advantageType: {advantage_type}")
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
        raise ValueError(f"Unknown vendorStage: {p.get('vendorStage')}")
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


def calculate_sales_risk_score(user_input: dict[str, Any]) -> dict[str, Any]:
    cfr = calculate_customer_friction_risk(user_input)
    ir = calculate_implementation_risk(user_input)
    cr = calculate_competitive_risk(user_input)

    weighted_score = cfr["value"] * 0.35 + ir["value"] * 0.35 + cr["value"] * 0.3
    srs = float(f"{min(100, max(0, weighted_score)):.2f}")
    deal_probability = float(f"{max(0, 100 - srs):.2f}")
    deal_probability_rounded = max(0, min(100, round(deal_probability)))
    interpretation = interpret_sales_risk_score(deal_probability_rounded)

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
        "detail": {
            "customer_friction_risk": cfr,
            "implementation_risk": ir,
            "competitive_risk": cr,
            "final_formula": {
                "expression": "SRS = 100 - ((CFR × 0.35) + (IR × 0.35) + (CR × 0.30))",
                "customer_friction_contribution": float(f"{cfr['value'] * 0.35:.4f}"),
                "implementation_risk_contribution": float(f"{ir['value'] * 0.35:.4f}"),
                "competitive_risk_contribution": float(f"{cr['value'] * 0.3:.4f}"),
                "weighted_sum": float(f"{weighted_score:.4f}"),
            },
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# PAYLOAD NORMALIZERS / FORMULA INPUT BUILDER
# ─────────────────────────────────────────────────────────────────────────────


def to_string_value(v: Any) -> str:
    return str(v if v is not None else "").strip()


def to_string_list(v: Any) -> list[str]:
    if isinstance(v, list):
        return [str(x if x is not None else "").strip() for x in v if str(x if x is not None else "").strip()]
    s = to_string_value(v)
    if not s:
        return []
    return [x.strip() for x in s.split(",") if x.strip()]


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
    if (
        "healthcare" in s
        or "hospital" in s
        or "medical" in s
        or "pharma" in s
    ):
        return "Healthcare"
    if "financial" in s or "bank" in s or "insurance" in s:
        return "Financial_Services"
    if (
        "government" in s
        or "federal" in s
        or "state" in s
        or "local" in s
    ):
        return "Government"
    if "retail" in s or "e-commerce" in s or "ecommerce" in s:
        return "E_Commerce"
    return "Technology"


def normalize_risk_tolerance_for_formula(raw: str) -> str:
    s = raw.lower()
    if "very low" in s or "risk-averse" in s or "zero tolerance" in s:
        return "Risk_averse"
    if "low" in s:
        return "Conservative"
    if "high" in s or "very high" in s:
        return "Aggressive"
    return "Moderate"


def normalize_data_sensitivity_for_formula(raw: str) -> str:
    s = raw.lower()
    if (
        "extremely sensitive" in s
        or "national security" in s
        or "itar" in s
        or "cui" in s
    ):
        return "Critical (Life-safety, National security)"
    if (
        "highly sensitive" in s
        or "sensitive" in s
        or "phi" in s
        or "financial" in s
        or "pii" in s
    ):
        return "High (PHI, Financial data, PII)"
    if "internal" in s or "business confidential" in s:
        return "Medium (Business confidential)"
    return "Low (Public or anonymized)"


def normalize_customization_for_formula(raw: str) -> str:
    s = raw.lower()
    if "none" in s or "as-is" in s:
        return "None (use as-is)"
    if "minimal" in s or "no code" in s:
        return "Minimal (configuration only)"
    if "moderate" in s or "workflow" in s or "integration" in s:
        return "Moderate (config + light dev)"
    if "significant" in s or "extensive" in s or "major" in s:
        return "Extensive (significant dev)"
    return "Custom_build"


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
    return 6


def budget_for_formula(raw: str) -> str:
    s = raw.lower()
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
    return "> $5M"


def customer_type_for_formula(budget_midpoint: str) -> str:
    if budget_midpoint in ("$1M-$5M", "> $5M"):
        return "Enterprise"
    if budget_midpoint in ("$250K-$500K", "$500K-$1M"):
        return "Mid_market"
    return "SMB"


def build_sales_risk_formula_input(payload: dict[str, Any]) -> dict[str, Any]:
    sector = normalize_sector_for_formula(
        to_string_value(payload.get("customer_sector") or payload.get("customerSector"))
    )
    regulatory = regulatory_requirements_to_string_list(
        payload.get("regulatory_requirements")
        if payload.get("regulatory_requirements") is not None
        else payload.get("regulatoryRequirements")
    )
    customer_specific_risks = to_string_list(
        payload.get("customer_specific_risks")
        if payload.get("customer_specific_risks") is not None
        else payload.get("customerSpecificRisks")
    )
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
    customer_type = customer_type_for_formula(budget_midpoint)
    alternatives = to_string_value(
        payload.get("alternatives_considered") or payload.get("alternativesConsidered")
    )
    key_advantages = to_string_list(
        payload.get("key_advantages")
        if payload.get("key_advantages") is not None
        else payload.get("keyAdvantages")
    )

    other_risks = (
        payload.get("customer_specific_risks_other")
        if payload.get("customer_specific_risks_other") is not None
        else payload.get("customerSpecificRisksOther")
    )

    if customer_type == "Enterprise":
        customer_employee_count = 2000
    elif customer_type == "Mid_market":
        customer_employee_count = 500
    else:
        customer_employee_count = 100

    return {
        "customerRegulatoryRequirements": regulatory,
        "sector": sector,
        "customerDataSensitivity": normalize_data_sensitivity_for_formula(
            to_string_value(
                payload.get("data_sensitivity") or payload.get("dataSensitivity")
            )
        ),
        "customerRiskTolerance": normalize_risk_tolerance_for_formula(
            to_string_value(
                payload.get("customer_risk_tolerance")
                or payload.get("customerRiskTolerance")
            )
        ),
        "customerSpecificRiskCount": len(customer_specific_risks),
        "customerType": customer_type,
        "customerHasUniqueRequirements": bool(to_string_value(other_risks)),
        "uniqueRequirementsList": to_string_list(other_risks),
        "integrationPoints": build_integration_points_for_formula(
            to_string_value(
                payload.get("integration_complexity")
                or payload.get("integrationComplexity")
            )
        ),
        "customizationLevel": normalize_customization_for_formula(
            to_string_value(
                payload.get("customization_level") or payload.get("customizationLevel")
            )
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
        "productFeatureMatchPct": 80,
        "missingCriticalFeatures": [],
        "proposedMitigationsCount": len(risk_mitigations),
        "avgMitigationsPerRisk": 4,
        "competitorCount": "2-3 competitors" if alternatives else "1 competitor",
        "customerConsideringBuildVsBuy": "build" in alternatives.lower(),
        "customerTechnicalCapability": "Moderate (difficult build)",
        "budgetMidpoint": budget_midpoint,
        "approvalLevels": "C_suite_single",
        "uniqueDifferentiators": (
            [{"advantageType": "Domain_expertise"} for _ in key_advantages[:3]]
            if key_advantages
            else [{"advantageType": "Faster_deployment"}]
        ),
        "yearsInCustomerSector": 5,
        "vendorStage": "growth",
        "customerExpectsLargerVendorFeatures": customer_type == "Enterprise",
        "customerEmployeeCount": customer_employee_count,
        "vendorEmployeeCount": 250,
    }


__all__ = [
    "build_sales_risk_formula_input",
    "calculate_sales_risk_score",
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
