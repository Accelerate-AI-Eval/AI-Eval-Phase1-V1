import "dotenv/config";
import { invokeBedrockAnthropicText } from "../../utils/invokeBedrockWithUsage.js";

const IMPLEMENTATION_ROADMAP_PROMPT = `You are an implementation and delivery analyst. Using ONLY the Assessment Analysis Report and Vendor Attestation data provided below, generate an Implementation Roadmap Proposal in this exact format. Use clear headings and bullets. Do not invent data not present in the inputs.

## Target deployment model + high-level architecture summary
- **Deployment model:** [From report or attestation – e.g. SaaS, on-prem, hybrid]
- **Architecture summary:** [High-level description of components, data flow, or topology if mentioned]
- [Additional bullets from inputs]

## Phases (Pilot -> Limited Production -> Full Production) with goals
- **Pilot:** [Goals and scope from report or attestation]
- **Limited Production:** [Goals and scope]
- **Full Production:** [Goals and scope]
- [Use only data from inputs; if not specified, say "To be defined" or "Not specified"]

## Integrations checklist + data flow bullets
- **Integrations:** [List from report or attestation – SSO, SCIM, APIs, etc.]
- **Data flow:** [Key data flows or touchpoints if mentioned]
- [Bullets for each integration or flow]

## Resources (vendor + customer roles and time commitments)
- **Vendor roles:** [From report or attestation]
- **Customer roles:** [From report or attestation]
- **Time commitments:** [If mentioned – e.g. kickoff, UAT, go-live]
- [Bullets per role or phase]

## Risk gates (SSO/SCIM, security review, UAT, data readiness)
- **SSO/SCIM:** [Readiness or requirement from inputs]
- **Security review:** [From inputs]
- **UAT:** [From inputs]
- **Data readiness:** [From inputs]
- [One bullet per gate; use "Not specified" if no data]

## Timeline estimate + assumptions
- **Timeline estimate:** [From report or attestation if available]
- **Assumptions:** [Key assumptions about scope, dependencies, or constraints]
- [Bullets for timeline and assumptions]

Use only the data provided. If a section has no relevant data, say "Not specified" or "To be confirmed."`;

function buildContext(reportJson: Record<string, unknown>, attestationSummary: string): string {
  const reportStr =
    typeof reportJson === "object" && reportJson !== null
      ? JSON.stringify(reportJson, null, 2)
      : String(reportJson);
  return [
    "--- Assessment Analysis Report (for this assessment) ---",
    reportStr.slice(0, 12000),
    "--- End of report ---",
    "",
    "--- Vendor Attestation (product selected) ---",
    attestationSummary.slice(0, 8000),
    "--- End of attestation ---",
  ].join("\n");
}

async function invokeModel(userInput: string): Promise<string> {
  return invokeBedrockAnthropicText({
    prompt: userInput,
    maxTokens: 4096,
    temperature: 0.3,
  });
}

/**
 * Generate Implementation Roadmap Proposal (sections 28–33) from assessment report + vendor attestation.
 */
export async function generateImplementationRoadmapProposal(
  reportJson: Record<string, unknown>,
  attestationSummary: string
): Promise<string> {
  const context = buildContext(reportJson, attestationSummary);
  const userInput = IMPLEMENTATION_ROADMAP_PROMPT + "\n\n" + context;
  return invokeModel(userInput);
}
