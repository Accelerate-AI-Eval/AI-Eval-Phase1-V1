/**
 * Vendor Self Attestation – AI Technical Capabilities tab content.
 * Heading, subheading, and icon from step config (Vendor Onboarding UI pattern).
 */
import type { ReactNode } from "react";
import AttestationDynamicStep from "../AttestationDynamicStep";
import type { VendorSelfAttestationPayload } from "../../../../types/vendorSelfAttestation";

export interface TabAITechCapabilitiesProps {
  attestation: VendorSelfAttestationPayload;
  setAttestation: React.Dispatch<React.SetStateAction<VendorSelfAttestationPayload>>;
  data: Record<string, { label: string; placeholder?: string; required?: boolean }>;
  fieldErrors?: Record<string, string>;
  title?: string;
  subTitle?: string;
  icon?: ReactNode;
}

function TabAITechCapabilities({
  attestation,
  setAttestation,
  data,
  fieldErrors,
  title = "AI Technical Capabilities",
  subTitle,
  icon,
}: TabAITechCapabilitiesProps) {
  return (
    <AttestationDynamicStep
      title={title}
      subTitle={subTitle}
      icon={icon}
      sectionKey="ai_technical_capabilities"
      data={data}
      attestation={attestation}
      setAttestation={setAttestation}
      fieldErrors={fieldErrors}
    />
  );
}

export default TabAITechCapabilities;
