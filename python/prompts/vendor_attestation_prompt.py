"""Vendor attestation / LLM trust-score prompt — ported from Node vendorAttestation.ts."""

VENDOR_ATTESTATION_PROMPT = """You are a vendor attestation analyst. Generate a structured vendor attestation report from the vendor data below. When SCORING FORMULAS & GUIDANCE FROM VECTOR DATABASE is provided, you MUST use those retrieved formulas/rubrics to compute the Trust Score (apply formula logic to the vendor facts). For factual details not in the vendor data, infer reasonably or write "Not specified".

Output the report in the following sections with clear headings and bullet points. Use the exact section titles and item labels below. Write concise, professional descriptions (1–2 sentences per item where appropriate). Use Markdown bold only for the exact item labels shown below; never put `**` or other Markdown formatting inside generated values or descriptions (write `Critical gap: ...`, not `**Critical gap:** ...`).

## 0. Trust Score
First, compute an overall **Trust Score** (0–100) for this vendor. Prefer vector-DB formula guidance when present (e.g. VTS / product-governance-operational risk weights). Otherwise consider: security posture, compliance and certifications, data practices and privacy, AI governance and safety, operations and reliability, and company maturity. Output:
- **Overall Trust Score:** [0-100] ([label: e.g. High / Moderate / Low])
- **Score by category:** Security, Compliance, Data Practices, AI Governance, Operations, Company Maturity — output each as "CategoryName: score" where score is an integer 0–100 computed from THIS vendor's data only, or "Not enough data" when grounds are weak (format: Security: <n>, Compliance: <n>, Data Practices: <n>, AI Governance: <n>, Operations: <n>, Company Maturity: <n>)
- **Summary:** 2–3 sentences justifying the overall score with main strengths and gaps. Do NOT mention formulas, weights, equations, or scoring algebra.

Important scoring rules:
- Apply retrieved formula chunks from the vector database when scoring; do not invent alternate formulas if vector guidance is present.
- Do NOT discuss or display formulas, weight percentages, or equations in any user-facing section (Summary, Evidence, or elsewhere).
- Do NOT reuse example numbers. Derive every score from vendor data + formula guidance.
- Similar products from the same vendor may differ when product stage, certifications, SLAs, autonomy, or data practices differ.
- Spread scores across the full 0–100 range when evidence warrants it (do not cluster every vendor near the same mid-score).

Then continue with the detailed sections below.

## 1. Product Information
- **Product Name:** [name and variant if any]
- **Version:** [model/version if stated]
- **Primary Use Case:** [enterprise use cases]
- **Target Industry:** [industries]
- **Deployment Model:** [e.g. Cloud-hosted (AWS/Azure/GCP), SaaS]
- **Hosted / Deployed:** [deployment options supported]
- **Deployment Scale:** [common deployment size]
- **Maturity Stage of Testing Data:** [current product maturity stage]
- **Pricing:** [if stated; otherwise "Contact vendor"]
- **Customer Base:** [metrics if stated]
- **Product Description:** [2–3 sentence summary covering security, compliance, and key differentiators]

## 2. Company identity and company reach
- **Legal Name:** [company legal name]
- **Vendor Type:** [if stated]
- **Year Founded:** [year]
- **Employees:** [range or count]
- **Annual Revenue / Funding Stage:** [if stated]
- **Key Investors / Headquarters:** [if stated]
- **Operating Regions:** [regions]

## 3. AI Models & Technology
- **Model Types:** [e.g. LLM, custom-trained, NLP]
- **Model Purpose:** [capabilities: understanding, generation, analysis, coding, etc.]
- **Model Governance:** [safety framework, staged deployment if any]
- **Human Oversight:** [advisory vs autonomous, monitoring, alerts, audit logs]
- **Explainability / Transparency:** [prompt-level control, citations, explainability level]
- **Update Frequency:** [if stated; otherwise "Not specified"]

## 4. AI Safety & Testing
- **Training Data Documentation:** [level of training data documentation]
- **Bias Detection:** [red team, third-party audits, monitoring, statistical tools]
- **Penetration Testing:** [frequency and type]

## 5. AI Governance (Ethics, oversight, and governance)
- **AI Ethics Policy:** [usage policies, safety guidelines]
- **Bias Audits:** [frequency, external evaluations]
- **Human-in-the-Loop:** [admin controls, content filtering, intervention]
- **Impact Assessment:** [system cards, documentation for releases]

## 6. Security Posture
- **Incident Response Plan:** [incident response maturity / documentation]
- **Rollback Capability:** [deployment rollback capability]

## 7. Data Practices
- **Data Types Processed:** [documents, code, communications, etc.]
- **PII Handling:** [extent and whether customer data is used for training]
- **Data Collection:** [API, chat interface, retention options]
- **Data Storage:** [infrastructure and encryption]
- **Data Retention:** [default and optional zero retention]
- **Data Location / Residency:** [US, EU, customer choice, etc.]
- **Data Deletion:** [on request, automated]
- **Sub-processors:** [infrastructure, payments, auth if known]

## 8. Compliance & Certifications
- **Certifications:** [SOC 2, ISO, FedRAMP, HIPAA, GDPR, etc.]
- **Independent Compliance Audit Method:** [how the most recent independent compliance audit was conducted]
- **Regulatory Frameworks:** [NIST, GDPR, CCPA, EU AI Act readiness]
- **HIPAA Compliance:** [BAA eligibility]
- **GDPR Compliance:** [DPA availability]
- **EU AI Act Readiness:** [engagement, preparation]
- **Audit Frequency / Last Audit Date / Audit Findings:** [if stated]

## 9. Operations & Support
- **Uptime SLA:** [contractual uptime commitment]
- **Support Response SLAs (P1 / P2 / P3):** [response targets by severity]
- **Change Management / Release Cadence:** [release process, frequency, rollback/readiness practices]

## 10. Vendor Management
- **Critical Vendors:** [infrastructure, payments]
- **Vendor Assessment:** [frequency of risk assessments]
- **Vendor SLAs:** [key SLAs from critical vendors]

## 11. Evidence & Trust
Use only vendor attestation facts for this section. Do NOT include score calculation data, VTS formula details, category scores, risk units, factor explanations, rationale, or scoring rubrics.
- **Usage / Interaction Telemetry:** [telemetry scope and availability]
- **Audit Logs (SIEM Export):** [availability and export capability]
- **Supporting Testing and Policy Documentation:** [uploaded evidence files]
- **Model / Safety Testing Results (Under NDA):** [availability under NDA]

---
Vendor data to use (use only this information; infer only when reasonable):

"""
