"""
Console rationales for assessment scores (Type 1 / 2 / 3).

Keeps the classic VTS RATIONALE layout, with clear plain-language explanations.
"""

from __future__ import annotations

from typing import Any


def _bar(char: str = "=", width: int = 72) -> str:
    return char * width


def _emit(lines: list[str]) -> str:
    """Print rationale lines (flushed) and return the same text for Node/API."""
    text = "\n".join(lines)
    print(text, flush=True)
    return text


def _safe(text: Any, limit: int = 400) -> str:
    s = str(text if text is not None else "").strip()
    s = (
        s.replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u00d7", "x")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )
    if len(s) > limit:
        return s[: limit - 3] + "..."
    return s


def _is_empty(val: Any) -> bool:
    if val is None:
        return True
    if isinstance(val, str) and not val.strip():
        return True
    if isinstance(val, (list, dict)) and len(val) == 0:
        return True
    s = str(val).strip().lower()
    return s in {"", "not specified", "n/a", "na", "none", "null", "undefined"}


def _payload_get(payload: dict[str, Any] | None, keys: tuple[str, ...]) -> Any:
    if not payload:
        return None
    cp = payload.get("companyProfile") if isinstance(payload.get("companyProfile"), dict) else {}
    for k in keys:
        if k in payload and not _is_empty(payload.get(k)):
            return payload.get(k)
        if isinstance(cp, dict) and k in cp and not _is_empty(cp.get(k)):
            return cp.get(k)
    return None


def _bool_yes_local(v: Any) -> bool:
    """True for bare yes/true and Buyer COTS options like 'Yes - Active board…'."""
    if isinstance(v, bool):
        return v
    s = str(v if v is not None else "").strip().lower()
    return s.startswith("yes") or s in ("true", "available", "exists", "defined")


# ---------------------------------------------------------------------------
# Type 1 - Vendor Trust Score (VTS)
# ---------------------------------------------------------------------------

_VTS_KEY_FIELDS: list[tuple[str, tuple[str, ...]]] = [
    ("Security certifications", ("security_certifications", "security_compliance_certificates")),
    ("Incident response plan", ("incident_response_plan",)),
    ("Uptime / SLA", ("uptime_sla", "sla_guarantee")),
    ("PII handling", ("pii_handling", "pii_information")),
    ("Data retention policy", ("data_retention_policy",)),
    ("Data residency", ("data_residency_options",)),
    ("Human oversight", ("human_oversight",)),
    ("AI governance policy", ("documented_ai_governance_policy",)),
    ("Bias testing", ("bias_testing_approach", "bias_ai")),
    ("Security / adversarial testing", ("adversarial_security_testing", "security_testing")),
    ("Training data documentation", ("training_data_documentation", "training_data_document")),
    ("Audit logs", ("audit_logs_available", "audit_logs")),
    ("Audit frequency", ("audit_frequency",)),
    ("Rollback capability", ("rollback_capability", "rollback_deployment_issues")),
    ("Support SLAs", ("support_slas",)),
    ("Decision autonomy", ("decision_autonomy", "ai_autonomy_level")),
    ("Product stage", ("product_stage", "stage_product")),
    ("Assessment completion level", ("assessment_completion_level", "assessment_feedback")),
]


def print_vts_rationale(
    *,
    final_score: float,
    scoring_source: str,
    interpretation: dict[str, str],
    trust_block: dict[str, Any],
    formula: dict[str, Any],
    formula_vts: float,
    llm_score: float | None,
    payload: dict[str, Any] | None,
    llm_error: str | None = None,
    vector_meta: dict[str, Any] | None = None,
) -> str:
    """VENDOR TRUST SCORE (Type 1) - EXPLAINED layout (matches Type 2/3 rationales)."""
    grade = interpretation.get("grade") or "?"
    classification = interpretation.get("classification") or "-"
    action = interpretation.get("recommended_action") or "-"
    categories = trust_block.get("scoreByCategory")
    vector_meta = vector_meta or {}

    pr = float(formula.get("product_risk") or 0)
    gr = float(formula.get("governance_risk") or 0)
    opr = float(formula.get("operational_risk") or 0)
    ranked = sorted(
        [
            ("Product risk", pr, 0.40, "mitigations, domain coverage, evidence quality"),
            ("Governance risk", gr, 0.30, "certs, policies, assessment quality, maturity"),
            ("Operational risk", opr, 0.30, "SLA, incident management, deployment maturity, support"),
        ],
        key=lambda x: x[1] * x[2],
        reverse=True,
    )

    missing = [
        label
        for label, keys in _VTS_KEY_FIELDS
        if _is_empty(_payload_get(payload, keys))
    ]

    weak_cats: list[tuple[str, Any]] = []
    if isinstance(categories, dict):
        for name, raw in categories.items():
            if isinstance(raw, str) and "not enough" in raw.lower():
                weak_cats.append((str(name), raw))
                continue
            try:
                n = float(raw)
            except (TypeError, ValueError):
                continue
            if n < 80:
                weak_cats.append((str(name), n))
        weak_cats.sort(key=lambda x: (999 if isinstance(x[1], str) else float(x[1])))

    trust_rounded = round(final_score)
    lines: list[str] = [
        "VENDOR TRUST SCORE (Type 1) - EXPLAINED",
        _bar(),
        "",
        "RESULT",
        f"  Trust score:   {trust_rounded} / 100   (higher = more trustworthy)",
        f"  Grade:         {grade} - {_safe(classification, 80)}",
        f"  Next step:     {_safe(action, 160)}",
        f"  Source:        {scoring_source}",
    ]

    lines.extend(
        [
            "",
            "KEY DRIVERS (higher risk lowers trust):",
        ]
    )
    for idx, (name, risk, _weight, _tip) in enumerate(ranked, start=1):
        biggest = "  << biggest drag" if idx == 1 else ""
        lines.append(
            f"    {idx}. {name:<22} {risk:5.2f}{biggest}"
        )

    lines.extend(["", "WHAT TO IMPROVE (to raise trust score)"])
    if ranked:
        top_name, top_risk, _w, top_tip = ranked[0]
        lines.append(f"  1. Biggest drag: {top_name} ({top_risk:.1f}) - {top_tip}")
        if len(ranked) > 1:
            name2, risk2, _w2, tip2 = ranked[1]
            lines.append(f"  2. {name2} ({risk2:.1f}) - {tip2}")

    concrete: list[str] = []
    if weak_cats:
        for name, val in weak_cats[:4]:
            if isinstance(val, str):
                concrete.append(f"Strengthen {name}: add concrete evidence in attestation")
            else:
                tip = (
                    "strengthen controls & proof"
                    if float(val) >= 70
                    else "document policies, certs, testing, or SLAs"
                )
                concrete.append(f"Raise {name} ({val}/100) - {tip}")
    if missing:
        for label in missing[:6]:
            concrete.append(f"Complete {label} in the attestation")

    if concrete:
        lines.append("  3. From attestation evidence, prioritize:")
        for item in concrete[:8]:
            lines.append(f"       - {item}")
    elif len(ranked) > 2:
        name3, risk3, _w3, tip3 = ranked[2]
        lines.append(f"  3. {name3} ({risk3:.1f}) - {tip3}")
    else:
        lines.append("  Trust signals look solid - keep evidence current and renew certifications on schedule.")

    lines.append("")
    return _emit(lines)


# ---------------------------------------------------------------------------
# Type 2 - Sales Risk Score (SRS)
# ---------------------------------------------------------------------------

def _subdriver_tips(detail_block: Any) -> list[str]:
    if not isinstance(detail_block, dict):
        return []
    tips: list[tuple[float, str]] = []
    label_map = {
        "regulatory_complexity": "Reduce regulatory friction / clarify compliance path",
        "data_sensitivity_friction": "Address data sensitivity / compliance documentation",
        "risk_tolerance_friction": "Align to customer risk tolerance with clear controls",
        "customer_specific_risk_friction": "Cover customer-specific risks with mitigations",
        "integration_complexity": "Simplify integrations or provide connectors / playbooks",
        "customization_required": "Reduce customization; offer config-first options",
        "timeline_pressure": "Propose a realistic timeline or phased rollout",
        "feature_gap": "Close critical feature gaps or roadmap commitments",
        "mitigation_gap": "Add concrete risk mitigations per customer concern",
        "competitive_alternatives": "Differentiate vs alternatives / build-vs-buy",
        "budget_constraint": "Right-size packaging / ROI story for the budget",
        "competitive_advantage": "Strengthen unique differentiators",
        "vendor_buyer_maturity_gap": "Close maturity / expectation mismatch with buyer",
    }
    for key, tip in label_map.items():
        block = detail_block.get(key)
        if isinstance(block, dict) and block.get("value") is not None:
            try:
                tips.append((float(block["value"]), tip))
            except (TypeError, ValueError):
                continue
    tips.sort(key=lambda x: x[0], reverse=True)
    return [tip for value, tip in tips if value > 0][:3]


def print_srs_rationale(
    *,
    result: dict[str, Any],
    formula_input: dict[str, Any] | None = None,
    payload: dict[str, Any] | None = None,
) -> str:
    """SALES RISK SCORE (Type 2) - EXPLAINED layout (no executive summary)."""
    srs = float(result.get("sales_risk_score") or 0)
    deal = float(result.get("deal_probability_pct") or max(0, 100 - srs))
    grade = str(result.get("grade") or "?")
    classification = str(result.get("classification") or "-")
    deal_chars = _safe(result.get("deal_characteristics") or "", 200)
    actions = _safe(result.get("recommended_actions") or "", 200)

    cfr = float(result.get("customer_friction_risk") or 0)
    ir = float(result.get("implementation_risk") or 0)
    cr = float(result.get("competitive_risk") or 0)
    ranked = sorted(
        [
            ("Customer friction", cfr, 0.35, "Address data sensitivity / compliance documentation"),
            ("Implementation", ir, 0.35, "Add concrete risk mitigations per customer concern"),
            ("Competitive", cr, 0.30, "Differentiate vs alternatives / build-vs-buy"),
        ],
        key=lambda x: x[1] * x[2],
        reverse=True,
    )

    detail = result.get("detail") if isinstance(result.get("detail"), dict) else {}
    improve: list[str] = []
    for idx, (name, risk, _w, focus) in enumerate(ranked, start=1):
        if risk <= 0:
            continue
        block_key = {
            "Customer friction": "customer_friction_risk",
            "Implementation": "implementation_risk",
            "Competitive": "competitive_risk",
        }[name]
        subs = _subdriver_tips(detail.get(block_key))
        tip = subs[0] if subs else focus
        improve.append(f"{idx}. {name} ({risk:.1f}) - {tip}")

    src = formula_input if isinstance(formula_input, dict) else {}
    if not src and isinstance(payload, dict):
        src = payload
    sector = src.get("sector")
    cust = src.get("customerType") or src.get("customer_type")

    lines: list[str] = [
        "SALES RISK SCORE (Type 2) - EXPLAINED",
        _bar(),
        "",
        "RESULT",
        f"  Sales risk:         {srs:.2f} / 100   (higher = harder deal)",
        f"  Deal probability:   ~{round(deal)}%     (roughly 100 - sales risk)",
        f"  Grade:              {grade} - {_safe(classification, 80)}",
    ]
    if deal_chars:
        lines.append(f"  Deal picture:       {deal_chars}")
    if actions:
        lines.append(f"  Recommended move:   {actions}")

    lines.extend(
        [
            "",
            "KEY DRIVERS (higher = more sales risk):",
        ]
    )
    for idx, (name, risk, _weight, _tip) in enumerate(ranked, start=1):
        biggest = "  << biggest drag" if idx == 1 else ""
        lines.append(
            f"    {idx}. {name:<22} {risk:5.2f}{biggest}"
        )
    if sector:
        lines.append(f"  Sector context: {_safe(sector, 40)}")
    if cust:
        lines.append(f"  Customer type: {_safe(cust, 40)}")

    lines.extend(["", "WHAT TO IMPROVE (to lower sales risk / raise deal odds)"])
    if improve:
        for item in improve[:3]:
            lines.append(f"  {item}")
    else:
        lines.append("  Risks look low - keep the standard sales path and reinforce value proof.")
    lines.append("")
    return _emit(lines)


# ---------------------------------------------------------------------------
# Type 3 - Buyer Implementation Readiness Score (IRS)
# ---------------------------------------------------------------------------

def print_irs_rationale(
    *,
    result: dict[str, Any],
    buyer_payload: dict[str, Any] | None = None,
) -> str:
    """IMPLEMENTATION READINESS SCORE (Type 3) - EXPLAINED layout."""
    readiness = float(result.get("implementationRiskScore") or 0)
    grade = str(result.get("grade") or "?")
    classification = str(result.get("classification") or "-")
    decision = str(result.get("decision") or "-")
    profile = _safe(result.get("readiness_profile") or "", 200)
    action = _safe(result.get("recommendedAction") or "", 200)
    breakdown = result.get("breakdown") if isinstance(result.get("breakdown"), dict) else {}
    source = result.get("source") if isinstance(result.get("source"), dict) else {}

    vendor_risk = float(breakdown.get("vendorRisk") or 0)
    org_gap = float(breakdown.get("organizationalReadinessGap") or 0)
    integ = float(breakdown.get("integrationRisk") or 0)
    vts = float(breakdown.get("vendorTrustScore") or 0)

    ranked = sorted(
        [
            (
                "Integration risk",
                integ,
                0.30,
                "Reduce system integrations, close requirement gaps, add rollback/monitoring/testing",
            ),
            (
                "Org readiness gap",
                org_gap,
                0.35,
                "Raise digital/governance maturity, AI board/policy, and implementation team coverage",
            ),
            (
                "Vendor risk",
                vendor_risk,
                0.35,
                "Choose a higher-trust vendor product, or improve vendor attestation evidence",
            ),
        ],
        key=lambda x: x[1] * x[2],
        reverse=True,
    )

    concrete: list[str] = []
    bp = buyer_payload if isinstance(buyer_payload, dict) else {}
    if bp:
        if not _bool_yes_local(bp.get("aiGovernanceBoard")):
            concrete.append("Stand up / confirm an AI governance board")
        if not _bool_yes_local(bp.get("aiEthicsPolicy")):
            concrete.append("Publish an AI ethics / responsible-AI policy")
        team = bp.get("implementationTeamComposition")
        team_n = len(team) if isinstance(team, list) else (1 if str(team or "").strip() else 0)
        if team_n <= 1:
            concrete.append("Expand the implementation team (roles / ownership)")
        systems = bp.get("integrationSystems")
        sys_n = len(systems) if isinstance(systems, list) else 0
        if sys_n >= 3:
            concrete.append(f"Simplify or phase integrations ({sys_n} systems listed)")
        gaps = str(bp.get("requirementGaps") or "").strip()
        if gaps:
            concrete.append("Close documented requirement gaps before full rollout")
        rollback = str(bp.get("rollbackCapability") or "").strip().lower()
        if "no" in rollback:
            concrete.append("Define a rollback plan")
        if not _bool_yes_local(bp.get("monitoringDataAvailable")):
            concrete.append("Ensure monitoring data will be available")
        if not _bool_yes_local(bp.get("testingResultsAvailable")):
            concrete.append("Capture / share testing results")

    vendor_name = _safe(source.get("vendorName") or "Vendor", 40)
    product_name = _safe(source.get("productName") or "Product", 40)
    used_att = bool(source.get("usedAttestation"))

    lines: list[str] = [
        "IMPLEMENTATION READINESS SCORE (Type 3) - EXPLAINED",
        _bar(),
        "",
        "RESULT",
        f"  Readiness:   {round(readiness)} / 100   (higher = more ready to implement)",
        f"  Grade:       {grade} - {_safe(classification, 80)}",
        f"  Decision:    {_safe(decision, 80)}",
    ]
    if profile:
        lines.append(f"  Profile:     {profile}")
    if action:
        lines.append(f"  Next step:   {action}")
    lines.append(f"  Vendor:      {vendor_name} / {product_name}")

    lines.extend(
        [
            "",
            "KEY DRIVERS (higher risk lowers readiness):",
        ]
    )
    for idx, (name, risk, _weight, _tip) in enumerate(ranked, start=1):
        biggest = "  << biggest drag" if idx == 1 else ""
        lines.append(
            f"    {idx}. {name:<22} {risk:5.2f}{biggest}"
        )
    lines.append(
        f"  Vendor trust used: {vts:.0f}/100  "
        f"({'from selected product attestation' if used_att else 'default / limited attestation'})"
    )

    lines.extend(["", "WHAT TO IMPROVE (to raise readiness)"])
    if ranked:
        top_name, top_risk, _w, top_tip = ranked[0]
        lines.append(
            f"  1. Biggest drag: {top_name} ({top_risk:.1f}) - {top_tip}"
        )
        if len(ranked) > 1:
            name2, risk2, _w2, tip2 = ranked[1]
            lines.append(f"  2. {name2} ({risk2:.1f}) - {tip2}")
    if concrete:
        lines.append("  3. From your answers, prioritize:")
        for item in concrete[:8]:
            lines.append(f"       - {item}")
    elif len(ranked) > 2:
        name3, risk3, _w3, tip3 = ranked[2]
        lines.append(f"  3. {name3} ({risk3:.1f}) - {tip3}")
    lines.append("")
    return _emit(lines)
