"""Regression maps for AI-Q scoring tickets (AIQ-019/020/027/034–043 cluster)."""

from services.sales_risk_formula import (
    budget_for_formula,
    competitor_label_and_build,
    normalize_customization_for_formula,
    normalize_data_sensitivity_for_formula,
    normalize_risk_tolerance_for_formula,
    normalize_sector_for_formula,
    structured_option_list,
    timeline_months_for_formula,
    to_string_list,
)
from services.scoring_service import band_employee_count, band_geographic_regions


def test_employee_count_comma_thousands_does_not_fall_to_1_10():
    assert band_employee_count("1,001-5,000") == "1001-5000"
    assert band_employee_count("1,001–5,000") == "1001-5000"
    assert band_employee_count("10,000+") == "10000+"
    assert band_employee_count("5,001–10,000") == "5001-10000"
    assert band_employee_count("1–10") == "1-10"


def test_global_operating_region_outranks_array_length():
    assert band_geographic_regions(["Global (All regions)"]) == "global"
    assert band_geographic_regions(["Global (all regions)"]) == "global"
    assert band_geographic_regions(["United States", "Europe (EU)"]) == "national"


def test_public_sensitivity_is_low_not_high():
    assert (
        normalize_data_sensitivity_for_formula("Public - No Sensitive Data")
        == "Low (Public or anonymized)"
    )
    assert (
        normalize_data_sensitivity_for_formula(
            "Highly Sensitive - PHI, Financial Records, or PCI Data"
        )
        == "High (PHI, Financial data, PII)"
    )


def test_low_risk_averse_is_not_very_low():
    assert (
        normalize_risk_tolerance_for_formula(
            "Low - Risk-averse, prefers conservative approach"
        )
        == "Conservative"
    )
    assert (
        normalize_risk_tolerance_for_formula(
            "Very Low - Zero tolerance for risk, extensive controls required"
        )
        == "Risk_averse"
    )


def test_unknown_budget_is_conservative_not_enterprise():
    assert budget_for_formula("") == "< $100K"
    assert budget_for_formula("Not Yet Determined") == "< $100K"
    assert budget_for_formula("Not known - estimate only") == "< $100K"
    assert budget_for_formula("$5M - $10M") == "> $5M"
    assert budget_for_formula("Over $10M") == "> $5M"
    assert budget_for_formula("$1M - $5M") == "$1M-$5M"


def test_customization_tiers_are_distinct():
    assert normalize_customization_for_formula(
        "Significant - Custom Model Training Required"
    ) == "Significant (custom model training)"
    assert normalize_customization_for_formula(
        "Extensive - Major Product Modifications"
    ) == "Extensive (significant dev)"
    assert normalize_customization_for_formula("unmatched gibberish") == "Moderate (config + light dev)"


def test_sector_does_not_default_technology():
    assert normalize_sector_for_formula("Energy & Utilities") == "Other"
    assert normalize_sector_for_formula("Financial Services - Banking") == "Financial_Services"
    assert normalize_sector_for_formula("Healthcare - Payers (Insurance)") == "Healthcare"
    assert normalize_sector_for_formula("Autonomous warehouse robots") == "Autonomous_Systems"


def test_none_chips_do_not_count_as_risks():
    assert to_string_list(["None Identified"]) == []
    assert to_string_list(["Data Privacy Concerns", "None Identified"]) == [
        "Data Privacy Concerns"
    ]


def test_key_advantages_do_not_score_comma_prose():
    prose = "Faster deployment, lower TCO, and domain expertise in healthcare"
    assert structured_option_list(prose) == [prose]


def test_rebuild_does_not_trigger_build_vs_buy():
    label, build = competitor_label_and_build("rebuild internal tools")
    assert build is False
    label2, build2 = competitor_label_and_build("build vs buy")
    assert build2 is True
    sole, _ = competitor_label_and_build("sole source")
    assert sole == "0 (sole source)"
    four, _ = competitor_label_and_build("A, B, C, D")
    assert four == "4+ competitors"


def test_exploratory_timeline_is_not_low_pressure_default():
    assert timeline_months_for_formula("Exploratory/No Specific Timeline") == 30
    assert timeline_months_for_formula("unknown") == 8
    assert timeline_months_for_formula("Immediate (< 30 days)") == 1


def _vts_input(**answers):
    from services.scoring_service import build_formula_input_from_payload

    payload = {"_skipCategoryVector": True, **answers}
    return build_formula_input_from_payload(payload)


def test_aiq019_blank_uptime_does_not_beat_a_real_answer():
    from services.scoring_service import calc_sla_score

    blank = calc_sla_score(_vts_input())
    answered = calc_sla_score(_vts_input(uptime_sla="99.9% (8.8 hrs/year)"))
    no_sla = calc_sla_score(_vts_input(uptime_sla="< 95% or No SLA"))
    assert blank["uptime_points"] == no_sla["uptime_points"] == 3
    assert answered["uptime_points"] > blank["uptime_points"]


def test_aiq021_unanswered_and_no_ethics_do_not_score_as_yes():
    assert _vts_input()["aiEthicsPolicy"] is False
    assert _vts_input(documented_ai_governance_policy="No")["aiEthicsPolicy"] is False
    assert _vts_input(documented_ai_governance_policy="Yes")["aiEthicsPolicy"] is True


def test_aiq022_no_is_not_truthy_for_policy_gates():
    no_payload = _vts_input(
        data_retention_policy="No",
        versions_models="No",
        is_multi_tenant="No",
        privacy_programme_scope="",
        incident_response_plan="",
    )
    assert no_payload["dataRetentionPolicy"] is False
    assert no_payload["modelVersionControl"] is False
    assert no_payload["multiTenancySupport"] is False
    assert no_payload["privacyPolicy"] is False
    assert no_payload["incidentResponsePlan"] is False
    yes_payload = _vts_input(data_retention_policy="Yes")
    assert yes_payload["dataRetentionPolicy"] is True


def test_aiq023_assessment_method_is_not_hardcoded_internal_audit():
    blank = _vts_input()
    assert blank["assessmentMethod"] == "self_reported_unverified"
    mapped = _vts_input(assessment_completion_level="Third-party independent audit")
    assert mapped["assessmentMethod"] == "third_party_audit"


def test_aiq026_yes_on_monitoring_audit_testing_drops_18_integration_points():
    from services.buyer_implementation_risk_formula import calculate_buyer_implementation_risk_score

    missing = calculate_buyer_implementation_risk_score({}, None, "V", "P")
    present = calculate_buyer_implementation_risk_score(
        {
            "monitoringDataAvailable": "Yes",
            "auditLogsAvailable": "Yes",
            "testingResultsAvailable": "Yes",
        },
        None,
        "V",
        "P",
    )
    assert present["implementationRiskScore"] > missing["implementationRiskScore"]
    # 18 raw integration points (6 each for monitoring / audit / testing)
    delta = missing["breakdown"]["integrationRisk"] - present["breakdown"]["integrationRisk"]
    assert abs(delta - 18) < 0.15


def test_type03_uses_new_cots_fields_instead_of_hardcoded():
    from services.buyer_implementation_risk_formula import (
        calculate_buyer_implementation_risk_score,
    )

    weak = calculate_buyer_implementation_risk_score(
        {
            "implementationCapacity": "No one assigned yet",
            "currentUsageState": "Not in use - manual process today",
            "humanReviewLevel": "No review - used directly",
            "decisionStakes": "Life or Death - Medical decisions, safety-critical applications",
            "riskAppetite": "Very High - Innovation-first, minimal risk concerns",
            "unavailabilityImpact": "Work stops - no manual alternative",
            "dataSensitivity": "Highly Sensitive - PHI, financial records, or PCI data",
            "integrationSystems": ["EHR / EMR Systems", "ERP (SAP, Oracle, etc.)"],
            "integrationAccessLevels": {"EHR / EMR Systems": "Admin"},
            "pilotStatus": "Not planned",
            "usersInScope": "5,000+",
            "vendorEvidenceReceived": ["Nothing yet"],
            "dataExportCapability": "No - data cannot be exported",
            "aiGovernanceMaturity": "None (No formal AI governance policies)",
            "dataGovernanceMaturity": "Ad-hoc (Minimal or no formal data policies)",
            "aiSkillsAvailability": "None (No AI/ML expertise)",
        },
        None,
        "V",
        "P",
    )
    strong = calculate_buyer_implementation_risk_score(
        {
            "implementationCapacity": "Dedicated team assigned",
            "currentUsageState": "Officially in use, expanding",
            "humanReviewLevel": "Always - reviewed by domain experts",
            "decisionStakes": "Low Impact - Minor inconvenience or rework required",
            "riskAppetite": "Low - Conservative, prefer proven solutions",
            "unavailabilityImpact": "Additive only - nothing depends on it yet",
            "dataSensitivity": "Public - No sensitive data",
            "integrationSystems": ["No Integrations Required"],
            "pilotStatus": "Completed - met criteria",
            "usersInScope": "1-10 (pilot)",
            "vendorEvidenceReceived": [
                "SOC 2 Type 2 report",
                "ISO 27001 certificate",
                "Model or safety testing results",
            ],
            "monitoringDataAvailable": "Yes - Comprehensive analytics and dashboards",
            "auditLogsAvailable": "Yes - Comprehensive audit logs with retention",
            "dataExportCapability": "Yes - full export in standard formats",
            "aiGovernanceMaturity": "Advanced (Comprehensive AI governance with board oversight)",
            "dataGovernanceMaturity": "Optimized (Comprehensive data governance program)",
            "aiSkillsAvailability": "Expert (10+ person AI/ML team)",
        },
        None,
        "V",
        "P",
    )
    assert strong["implementationRiskScore"] > weak["implementationRiskScore"]
    assert strong["breakdown"]["vendorTrustScore"] > 50
    assert weak["breakdown"]["organizationalReadinessGap"] > strong["breakdown"][
        "organizationalReadinessGap"
    ]
    assert weak["breakdown"]["integrationRisk"] > strong["breakdown"]["integrationRisk"]


def test_type03_attestation_fills_rollback_instead_of_hardcoded():
    from services.buyer_implementation_risk_formula import (
        calculate_buyer_implementation_risk_score,
    )

    no_data = calculate_buyer_implementation_risk_score({}, None, "V", "P")
    from_attestation = calculate_buyer_implementation_risk_score(
        {},
        {"rollback_capability": "No rollback capability"},
        "V",
        "P",
    )
    assert (
        from_attestation["breakdown"]["integrationRisk"]
        > no_data["breakdown"]["integrationRisk"]
    )


def test_aiq045_srs_inputs_are_not_hardcoded():
    from services.sales_risk_formula import build_sales_risk_formula_input

    built = build_sales_risk_formula_input(
        {
            "year_founded": 2018,
            "vendorMaturity": "Growth Stage - Scaling customer base",
            "employeeCount": "1,001-5,000",
            "keyAdvantages": ["a", "b", "c"],
        }
    )
    assert built["vendorStage"] == "growth"
    assert built["yearsInCustomerSector"] >= 5
    assert built["productFeatureMatchPct"] != 80 or built["vendorEmployeeCount"] != 250


def test_type02_uses_new_cots_fields_instead_of_hardcoded():
    from services.sales_risk_formula import (
        build_sales_risk_formula_input,
        calculate_sales_risk_score,
    )

    small = build_sales_risk_formula_input(
        {
            "customer_employee_count": "1-50",
            "opportunity_type": "New logo",
            "competitors": [{"name": "Acme", "incumbent": "No", "basis": "Market inference"}],
            "build_vs_buy_signal": "No signal",
            "key_advantages_rows": [{"advantage": "Faster rollout in healthcare", "category": "Product"}],
            "likely_integration_systems": ["Identity / SSO"],
            "customer_eng_headcount": "Under 50",
            "customer_ownership": "Founder / family owned",
            "customerBudgetRange": "Over $10M",
            "alternatives_considered": "rebuild in-house UiPath",
        }
    )
    large = build_sales_risk_formula_input(
        {
            "customer_employee_count": "50,000+",
            "opportunity_type": "Renewal",
            "competitors": [
                {"name": "A", "incumbent": "Yes", "basis": "Publicly confirmed"},
                {"name": "B", "incumbent": "No", "basis": "Market inference"},
                {"name": "C", "incumbent": "No", "basis": "Market inference"},
                {"name": "D", "incumbent": "No", "basis": "Market inference"},
            ],
            "build_vs_buy_signal": "Yes - public evidence of internal build",
            "key_advantages_rows": [{"advantage": "SOC 2 already in product", "category": "Compliance"}],
            "likely_integration_systems": [
                "Identity / SSO",
                "Code hosting",
                "CI/CD",
                "Ticketing (Jira, ServiceNow)",
                "Data warehouse",
            ],
            "customer_eng_headcount": "5,000+",
            "customer_ownership": "Publicly traded",
            "customer_ai_maturity_evidence": [
                "Named AI/ML leadership in post",
                "AI product shipped publicly",
                "Actively hiring AI/ML roles",
            ],
            "employeeCount": "11-50",
        }
    )

    assert small["customerEmployeeCount"] == 25
    assert large["customerEmployeeCount"] == 75000
    assert small["customerType"] == "SMB"
    assert large["customerType"] == "Enterprise"
    assert small["yearsInCustomerSector"] == 0
    assert large["yearsInCustomerSector"] == 5
    assert small["competitorCount"] == "1 competitor"
    assert large["competitorCount"] == "4+ competitors"
    assert small["customerConsideringBuildVsBuy"] is False
    assert large["customerConsideringBuildVsBuy"] is True
    assert small["customerTechnicalCapability"] == "Weak (unlikely to build)"
    assert large["customerTechnicalCapability"] == "Strong (can build)"
    assert small["uniqueDifferentiators"][0]["advantageType"] == "Superior_feature_set"
    assert large["uniqueDifferentiators"][0]["advantageType"] == "Regulatory_certification"
    assert small["approvalLevels"] == "VP_and_below"
    assert large["approvalLevels"] == "Board_approval"
    assert len(small["integrationPoints"]) == 1
    assert len(large["integrationPoints"]) >= 4
    assert large["vendorStage"] == "mature"
    assert small["avgMitigationsPerRisk"] == 0

    srs_small = calculate_sales_risk_score(small)["sales_risk_score"]
    srs_large = calculate_sales_risk_score(large)["sales_risk_score"]
    assert srs_small != srs_large


def test_type01_nested_sector_maps_to_healthcare_not_technology():
    payload = _vts_input(
        companyProfile={
            "sector": {
                "private_sector": ["Healthcare - Payers (Insurance)"],
                "public_sector": [],
            },
            "operatingRegions": ["United States", "Europe (EU)", "Asia Pacific"],
        },
        pii_handling="Critical (PHI, biometric data, children's data)",
    )
    assert payload["sector"] == "Healthcare"
    assert payload["decisionStakeLevel"] == "Critical"
    assert payload["geographicRegions"] == "multi_national"
    assert payload["supportsHipaaWorkflows"] is True


def test_type01_json_string_sector_and_operate_regions_alias():
    payload = _vts_input(
        target_industries='{"private_sector": ["Financial Services - Banking"]}',
        operate_regions=["Global (All regions)"],
    )
    assert payload["sector"] == "Financial Services"
    assert payload["geographicRegions"] == "global"


def test_aiq048_unknown_formula_enum_is_degraded_not_crash():
    from services.sales_risk_formula import calculate_sales_risk_score

    result = calculate_sales_risk_score(
        {
            "customerType": "not-a-real-type",
            "sector": "???",
            "customerDataSensitivity": "mystery",
            "customerRiskTolerance": "mystery",
            "customizationLevel": "mystery",
            "competitorCount": "mystery",
            "budgetMidpoint": "mystery",
            "approvalLevels": "mystery",
            "vendorStage": "mystery",
            "customerRegulatoryRequirements": [],
            "customerSpecificRiskCount": 0,
            "integrationPoints": [],
            "customerRequiresIndustryWorkflows": False,
            "businessProcessChangesRequired": 0,
            "implementationTimelineMonths": 6,
            "regulatoryDeadlineExists": False,
            "productFeatureMatchPct": 50,
            "missingCriticalFeatures": [],
            "proposedMitigationsCount": 0,
            "avgMitigationsPerRisk": 0,
            "customerConsideringBuildVsBuy": False,
            "uniqueDifferentiators": [],
            "yearsInCustomerSector": 0,
            "customerExpectsLargerVendorFeatures": False,
            "customerEmployeeCount": 100,
            "vendorEmployeeCount": 50,
        }
    )
    assert result["scoring_source"] == "degraded"
    assert 0 <= result["sales_risk_score"] <= 100

