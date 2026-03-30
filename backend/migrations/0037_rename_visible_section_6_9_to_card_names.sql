-- Rename visible_section_6..9 to card-based names (Data Practices, Compliance & Certifications, Operations & Support, Vendor Management).
ALTER TABLE public.vendor_self_attestations RENAME COLUMN visible_section_6 TO visible_data_practices;
ALTER TABLE public.vendor_self_attestations RENAME COLUMN visible_section_7 TO visible_compliance_certifications;
ALTER TABLE public.vendor_self_attestations RENAME COLUMN visible_section_8 TO visible_operations_support;
ALTER TABLE public.vendor_self_attestations RENAME COLUMN visible_section_9 TO visible_vendor_management;
