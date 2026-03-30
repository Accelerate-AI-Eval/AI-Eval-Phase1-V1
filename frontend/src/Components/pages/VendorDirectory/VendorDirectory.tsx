import { useEffect, useState, useCallback } from "react";
import {
  Building2,
  Cpu,
  Database,
  FileCheck,
  FlaskConical,
  Search,
  ShieldCheck,
  CircleX,
  ChevronRight,
} from "lucide-react";
import "../../../styles/page_tabs.css";
import "./VendorDirectory.css";
import "../ProductProfile/product_profile.css";
import GeneratedProductProfileCards from "../ProductProfile/GeneratedProductProfileCards";
import ClickTooltip from "../../UI/ClickTooltip";
import type { GeneratedProductProfileReport } from "../../../types/generatedProductProfile";

const BASE_URL = import.meta.env.VITE_BASE_URL ?? "http://localhost:5003/api/v1";

const defaultSectionVis = {
  aiGovernance: false,
  securityPosture: false,
  dataPrivacy: false,
  compliance: false,
  modelRisk: false,
  dataPractices: false,
  complianceCertifications: false,
  operationsSupport: false,
  vendorManagement: false,
};

/** Section id 1–9 map to buyer visibility flags (vendor toggles in View Product). Names match card titles: Data Practices, Compliance & Certifications, Operations & Support, Vendor Management. */
const SECTION_ID_TO_VIS_KEY: Record<number, keyof typeof defaultSectionVis> = {
  1: "aiGovernance",
  2: "securityPosture",
  3: "dataPrivacy",
  4: "compliance",
  5: "modelRisk",
  6: "dataPractices",
  7: "complianceCertifications",
  8: "operationsSupport",
  9: "vendorManagement",
};

function parseGeneratedReport(raw: unknown): GeneratedProductProfileReport | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.trustScore == null || typeof o.trustScore !== "object" || !Array.isArray(o.sections)) return null;
  const ts = o.trustScore as Record<string, unknown>;
  if (typeof ts.overallScore !== "number" || typeof ts.summary !== "string") return null;
  return {
    trustScore: {
      overallScore: ts.overallScore as number,
      label: (ts.label as string) ?? "",
      summary: ts.summary as string,
      scoreByCategory: ts.scoreByCategory as Record<string, string | number> | undefined,
    },
    sections: o.sections as GeneratedProductProfileReport["sections"],
  };
}

interface PublicVendor {
  id: string;
  organizationId: string;
  /** Organization name from org id (when provided by API). */
  organizationName?: string | null;
  /** Product names (completed, visible to buyer) from API. */
  productNames?: string[];
  vendorType: string;
  companyWebsite: string;
  companyDescription: string;
  headquartersLocation: string;
  vendorMaturity?: string;
  /** Sector/industry (string or JSON object from API). */
  sector?: string | Record<string, unknown> | null;
}

interface VendorProduct {
  id: string;
  productName: string;
  status: string;
  updated_at: string | null;
  trustScore?: number;
  /** Product target sectors/industries (same format as vendor sector for formatSector). */
  sector?: string | Record<string, unknown> | null;
}

/** One product in the directory grid (product + vendor info for display). */
interface DirectoryProduct {
  productId: string;
  productName: string;
  status: string;
  vendorId: string;
  vendor: PublicVendor;
  /** Product trust score 0–100 from generated profile report (optional). */
  trustScore?: number;
  /** Product target sectors/industries (optional; falls back to vendor sector when missing). */
  sector?: string | Record<string, unknown> | null;
}

function formatVal(val: unknown): string {
  if (val == null || val === "") return "Not specified.";
  if (Array.isArray(val)) return val.length ? val.join(", ") : "Not specified.";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen).trim() + "...";
}

function getProductDescription(detail: Record<string, unknown> | null): string {
  if (!detail) return "";
  const productDesc = detail.product_description;
  const companyDesc = detail.company_description;
  const valueProp = detail.unique_value_proposition;
  const str = (v: unknown) => (v != null && String(v).trim() !== "" ? String(v).trim() : "");
  return str(productDesc) || str(companyDesc) || str(valueProp) || "";
}

function productInitials(name: string): string {
  const s = (name || "Product").trim();
  if (s.length >= 2) return s.slice(0, 2).toUpperCase();
  return s ? s.toUpperCase() : "Pr";
}

const SECTOR_KEYS_ORDER = ["public_sector", "private_sector", "non_profit_sector"] as const;

const MAX_SECTORS_ON_CARD = 2;

type SectorParts =
  | { kind: "empty" }
  | { kind: "plain"; text: string }
  | { kind: "buckets"; buckets: string[][] };

function parseSectorStructure(
  sector: string | Record<string, unknown> | null | undefined,
): SectorParts {
  if (sector == null) return { kind: "empty" };
  if (typeof sector === "string") {
    const t = sector.trim();
    if (!t) return { kind: "empty" };
    if (t.startsWith("{") || t.startsWith("[")) {
      try {
        const parsed = JSON.parse(t) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parseSectorStructure(parsed as Record<string, unknown>);
        }
      } catch {
        return { kind: "empty" };
      }
      return { kind: "empty" };
    }
    return { kind: "plain", text: t };
  }
  if (typeof sector === "object" && sector !== null) {
    const buckets: string[][] = [];
    for (const key of SECTOR_KEYS_ORDER) {
      const val = sector[key];
      if (Array.isArray(val) && val.length > 0) {
        const items = val
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.trim())
          .filter(Boolean);
        if (items.length > 0) buckets.push(items);
      }
    }
    if (buckets.length > 0) return { kind: "buckets", buckets };
    const name = (sector.name ?? sector.sectorName ?? sector.industryName) as string | undefined;
    if (typeof name === "string" && name.trim()) return { kind: "plain", text: name.trim() };
  }
  return { kind: "empty" };
}

/** Full sector line for search matching and tooltips (bucket groups joined with " • "). */
function formatSector(sector: string | Record<string, unknown> | null | undefined): string {
  const p = parseSectorStructure(sector);
  if (p.kind === "empty") return "";
  if (p.kind === "plain") return p.text;
  return p.buckets.map((b) => b.join(", ")).filter(Boolean).join(" • ");
}

/** Card line: at most the first {@link MAX_SECTORS_ON_CARD} individual sectors, with "+N more" when truncated. */
function formatSectorCard(sector: string | Record<string, unknown> | null | undefined): string {
  const p = parseSectorStructure(sector);
  if (p.kind === "empty") return "";
  if (p.kind === "plain") {
    const partsList = p.text.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
    if (partsList.length === 0) return "";
    if (partsList.length <= MAX_SECTORS_ON_CARD) return partsList.join(", ");
    return `${partsList.slice(0, MAX_SECTORS_ON_CARD).join(", ")} +${partsList.length - MAX_SECTORS_ON_CARD} more`;
  }
  const flat = p.buckets.flat();
  if (flat.length === 0) return "";
  if (flat.length <= MAX_SECTORS_ON_CARD) return flat.join(", ");
  return `${flat.slice(0, MAX_SECTORS_ON_CARD).join(", ")} +${flat.length - MAX_SECTORS_ON_CARD} more`;
}

type VendorTab = "all" | "listed" | "my";

const VendorDirectory = () => {
  useEffect(() => {
    document.title = "AI Eval | Vendor Portal";
  });
  const systemRole = (sessionStorage.getItem("systemRole") ?? "").toLowerCase().trim();
  const isBuyer = systemRole === "buyer";
  const [vendorTab, setVendorTab] = useState<VendorTab>("all");
  const [vendors, setVendors] = useState<PublicVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myProductsTabLoading, setMyProductsTabLoading] = useState(false);
  const [myProductsTabError, setMyProductsTabError] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<PublicVendor | null>(null);
  const [vendorProducts, setVendorProducts] = useState<VendorProduct[]>([]);
  const [vendorProductsLoading, setVendorProductsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; productName: string } | null>(null);
  const [productDetail, setProductDetail] = useState<Record<string, unknown> | null>(null);
  const [productSectionVisibility, setProductSectionVisibility] = useState<{
    aiGovernance: boolean;
    securityPosture: boolean;
    dataPrivacy: boolean;
    compliance: boolean;
    modelRisk: boolean;
    dataPractices?: boolean;
    complianceCertifications?: boolean;
    operationsSupport?: boolean;
    vendorManagement?: boolean;
  } | null>(null);
  const [productDetailLoading, setProductDetailLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  /** Flat list of products for directory grid (one card per product). */
  const [directoryProducts, setDirectoryProducts] = useState<DirectoryProduct[]>([]);
  const [directoryProductsLoading, setDirectoryProductsLoading] = useState(false);

  /** All Vendors: all vendors even if directory listing is off (backend returns all for system admin). */
  const fetchAllVendors = useCallback(async () => {
    const token = sessionStorage.getItem("bearerToken");
    if (!token) {
      setError("Please log in to view the vendor directory.");
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/vendorDirectory?scope=all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Failed to load vendors");
        setVendors([]);
        return;
      }
      setVendors(data?.vendors ?? []);
    } catch {
      setError("Network or server error");
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Listed Vendors: only vendors who have turned on Public Directory Listing. */
  const fetchListedVendors = useCallback(async () => {
    const token = sessionStorage.getItem("bearerToken");
    if (!token) {
      setError("Please log in to view the vendor directory.");
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/vendorDirectory`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Failed to load vendors");
        setVendors([]);
        return;
      }
      setVendors(data?.vendors ?? []);
    } catch {
      setError("Network or server error");
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /** My Products tab: COTS assessments (buyer vendor+product, or vendor assessment product). */
  const fetchMyAssessmentProducts = useCallback(async () => {
    const token = sessionStorage.getItem("bearerToken");
    if (!token) {
      setMyProductsTabError("Please log in to view your assessment products.");
      setDirectoryProducts([]);
      return;
    }
    setMyProductsTabError(null);
    setMyProductsTabLoading(true);
    setDirectoryProducts([]);
    try {
      const res = await fetch(`${BASE_URL}/vendorDirectory/assessment-products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setMyProductsTabError(data?.message ?? "Failed to load assessment products");
        setDirectoryProducts([]);
        return;
      }
      const raw = data?.products as unknown;
      if (!Array.isArray(raw)) {
        setDirectoryProducts([]);
        return;
      }
      const mapped: DirectoryProduct[] = raw.map((item: unknown) => {
        const o = item as Record<string, unknown>;
        const v = o.vendor as Record<string, unknown> | undefined;
        const vendor: PublicVendor = {
          id: String(v?.id ?? ""),
          organizationId: String(v?.organizationId ?? ""),
          organizationName: v?.organizationName != null ? String(v.organizationName) : null,
          vendorType: String(v?.vendorType ?? ""),
          companyWebsite: String(v?.companyWebsite ?? ""),
          companyDescription: String(v?.companyDescription ?? ""),
          headquartersLocation: String(v?.headquartersLocation ?? ""),
          vendorMaturity: v?.vendorMaturity != null ? String(v.vendorMaturity) : undefined,
          sector: (v?.sector as PublicVendor["sector"]) ?? undefined,
        };
        return {
          productId: String(o.productId ?? ""),
          productName: String(o.productName ?? "Product"),
          status: String(o.status ?? ""),
          vendorId: String(o.vendorId ?? vendor.id),
          vendor,
          trustScore: typeof o.trustScore === "number" ? o.trustScore : undefined,
          sector: (o.sector as DirectoryProduct["sector"]) ?? undefined,
        };
      });
      setDirectoryProducts(mapped.filter((dp) => dp.productId && dp.vendorId));
    } catch {
      setMyProductsTabError("Network or server error");
      setDirectoryProducts([]);
    } finally {
      setMyProductsTabLoading(false);
    }
  }, []);

  const fetchVendorProducts = useCallback(async (vendorId: string) => {
    const token = sessionStorage.getItem("bearerToken");
    if (!token) return;
    setVendorProductsLoading(true);
    setVendorProducts([]);
    try {
      const res = await fetch(`${BASE_URL}/vendorDirectory/${vendorId}/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data?.products) setVendorProducts(data.products);
      else setVendorProducts([]);
    } catch {
      setVendorProducts([]);
    } finally {
      setVendorProductsLoading(false);
    }
  }, []);

  const fetchProductDetail = useCallback(async (vendorId: string, productId: string) => {
    const token = sessionStorage.getItem("bearerToken");
    if (!token) return;
    setProductDetailLoading(true);
    setProductDetail(null);
    setProductSectionVisibility(null);
    try {
      const res = await fetch(`${BASE_URL}/vendorDirectory/${vendorId}/products/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data?.attestation) {
        setProductDetail(data.attestation as Record<string, unknown>);
        const vis = data?.sectionVisibility;
        setProductSectionVisibility(vis ? {
          aiGovernance: vis.aiGovernance === true,
          securityPosture: vis.securityPosture === true,
          dataPrivacy: vis.dataPrivacy === true,
          compliance: vis.compliance === true,
          modelRisk: vis.modelRisk === true,
          dataPractices: vis.dataPractices === true,
          complianceCertifications: vis.complianceCertifications === true,
          operationsSupport: vis.operationsSupport === true,
          vendorManagement: vis.vendorManagement === true,
        } : defaultSectionVis);
      } else {
        setProductDetail(null);
        setProductSectionVisibility(null);
      }
    } catch {
      setProductDetail(null);
      setProductSectionVisibility(null);
    } finally {
      setProductDetailLoading(false);
    }
  }, []);

  /** Build flat list of products (one per product) from current vendor list for directory grid. */
  const fetchDirectoryProducts = useCallback(async (vendorList: PublicVendor[]) => {
    const token = sessionStorage.getItem("bearerToken");
    if (!token || vendorList.length === 0) {
      setDirectoryProducts([]);
      return;
    }
    setDirectoryProductsLoading(true);
    try {
      const results = await Promise.all(
        vendorList.map(async (v) => {
          const res = await fetch(`${BASE_URL}/vendorDirectory/${v.id}/products`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          const products: VendorProduct[] = res.ok && data?.products ? data.products : [];
          return products.map((p) => ({
            productId: p.id,
            productName: p.productName,
            status: p.status,
            vendorId: v.id,
            vendor: v,
            trustScore: p.trustScore,
            sector: p.sector,
          }));
        })
      );
      const flat = results.flat();
      setDirectoryProducts(flat);
    } catch {
      setDirectoryProducts([]);
    } finally {
      setDirectoryProductsLoading(false);
    }
  }, []);

  const handleVendorClick = (v: PublicVendor) => {
    setSelectedVendor(v);
    setSelectedProduct(null);
    setProductDetail(null);
    fetchVendorProducts(v.id);
  };

  const handleProductClick = (p: VendorProduct) => {
    if (!selectedVendor) return;
    setSelectedProduct({ id: p.id, productName: p.productName });
    fetchProductDetail(selectedVendor.id, p.id);
  };

  const handleDirectoryProductClick = (dp: DirectoryProduct) => {
    setSelectedVendor(null);
    setVendorProducts([]);
    setSelectedProduct({ id: dp.productId, productName: dp.productName });
    setProductDetail(null);
    fetchProductDetail(dp.vendorId, dp.productId);
  };

  const buildDetailItemsFromAttestation = (att: Record<string, unknown>) => ({
    aiGovernance: [
      ["AI Ethics Policy", formatVal(att.unique_value_proposition) || "Not specified."],
      ["AI Ethics Board", formatVal(att.human_oversight) || "Not specified."],
      ["Human Oversight", formatVal(att.human_oversight) || formatVal(att.decision_autonomy) || "Not specified."],
      ["Model Governance", formatVal(att.model_transparency) || formatVal(att.training_data_documentation) || "Not specified."],
    ],
    security: [
      ["Security Certifications", formatVal(att.security_certifications) || "Not specified."],
      ["Access Controls", formatVal(att.adversarial_security_testing) || "Not specified."],
      ["Vulnerability Management", formatVal(att.adversarial_security_testing) || "Not specified."],
      ["Incident History", formatVal(att.incident_response_plan) || "Not specified."],
    ],
    dataPrivacy: [
      ["Data Types Processed", formatVal(att.pii_handling) || "Not specified."],
      ["Data Retention Policy", formatVal(att.data_retention_policy) || "Not specified."],
      ["Encryption Standards", formatVal(att.data_residency_options) || "Not specified."],
    ],
    compliance: [
      ["Regulatory Frameworks", formatVal(att.security_certifications) || "Not specified."],
      ["Certifications", formatVal(att.security_certifications) || formatVal(att.assessment_completion_level) || "Not specified."],
      ["Audit History", formatVal(att.assessment_completion_level) || "Not specified."],
    ],
    modelRisk: [
      ["Training Data Sources", formatVal(att.training_data_documentation) || "Not specified."],
      ["Model Monitoring", formatVal(att.model_transparency) || formatVal(att.rollback_capability) || "Not specified."],
      ["Bias Testing", formatVal(att.bias_testing_approach) || "Not specified."],
      ["Explainability", formatVal(att.model_transparency) || formatVal(att.decision_autonomy) || "Not specified."],
    ],
  });

  useEffect(() => {
    if (vendorTab === "all") {
      if (isBuyer) fetchListedVendors();
      else fetchAllVendors();
    } else if (vendorTab === "listed") fetchListedVendors();
    else if (vendorTab === "my") fetchMyAssessmentProducts();
  }, [vendorTab, isBuyer, fetchAllVendors, fetchListedVendors, fetchMyAssessmentProducts]);

  /** When vendor list tabs load, build flat product list. My Products tab loads products via assessment API. */
  useEffect(() => {
    if (vendorTab === "my") return;
    if (vendorTab === "all" || vendorTab === "listed") {
      if (vendors.length > 0) fetchDirectoryProducts(vendors);
      else setDirectoryProducts([]);
    }
  }, [vendorTab, vendors, fetchDirectoryProducts]);

  const displayName = (v: PublicVendor) => {
    if (v.organizationName && String(v.organizationName).trim()) return String(v.organizationName).trim();
    if (v.organizationId && v.organizationId !== v.companyWebsite) return v.organizationId;
    try {
      if (v.companyWebsite) {
        const url = new URL(v.companyWebsite.startsWith("http") ? v.companyWebsite : `https://${v.companyWebsite}`);
        return url.hostname.replace(/^www\./, "") || v.organizationId || "Vendor";
      }
    } catch {
      // ignore
    }
    return v.organizationId || "Vendor";
  };

  const matchesProductSearch = (dp: DirectoryProduct, q: string): boolean => {
    if (!q.trim()) return true;
    const lower = q.trim().toLowerCase();
    if (dp.productName.toLowerCase().includes(lower)) return true;
    if (displayName(dp.vendor).toLowerCase().includes(lower)) return true;
    const sectorText = formatSector(dp.sector ?? dp.vendor.sector);
    if (sectorText && sectorText.toLowerCase().includes(lower)) return true;
    return false;
  };

  const filteredDirectoryProducts = directoryProducts.filter((dp) => matchesProductSearch(dp, searchQuery));

  return (
    <div className="vendor_directory_page sec_user_page">
      <div className="vendor_directory_header page_header_align">
        <div className="page_header_row">
          <span className="icon_size_header" aria-hidden>
            <Building2 size={24} className="header_icon_svg"/>
          </span>
          <div className="page_header_title_block">
            <h1 className="page_header_title">AI Vendor Directory</h1>
            <p className="vendor_directory_subtitle page_header_subtitle">
              Browse products from vendors who have turned on Public Directory Listing.
            </p>
          </div>
        </div>
      </div>

      <div className="page_tabs" role="tablist" aria-label="Vendor list type">
        <button
          type="button"
          role="tab"
          aria-selected={vendorTab === "all"}
          aria-controls="vendor-directory-panel-all"
          id="vendor-tab-all"
          className={`page_tab ${vendorTab === "all" ? "page_tab_active" : ""}`}
          onClick={() => setVendorTab("all")}
        >
          All Products
        </button>
        {!isBuyer && (
          <button
            type="button"
            role="tab"
            aria-selected={vendorTab === "listed"}
            aria-controls="vendor-directory-panel-listed"
            id="vendor-tab-listed"
            className={`page_tab ${vendorTab === "listed" ? "page_tab_active" : ""}`}
            onClick={() => setVendorTab("listed")}
          >
            Listed Products
          </button>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={vendorTab === "my"}
          aria-controls="vendor-directory-panel-my"
          id="vendor-tab-my"
          className={`page_tab ${vendorTab === "my" ? "page_tab_active" : ""}`}
          onClick={() => setVendorTab("my")}
        >
          My Products
        </button>
      </div>

      {(vendorTab === "all" || vendorTab === "listed") && (
        <>
          {!loading && !error && (vendors.length > 0 || directoryProducts.length > 0) && (
            <div className="vendor_directory_search_wrap">
              <Search size={18} className="vendor_directory_search_icon" aria-hidden />
              <input
                type="search"
                className="vendor_directory_search_input"
                placeholder="Search by product name and industry"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search by product name and industry"
              />
            </div>
          )}
          {(loading || directoryProductsLoading) && (
            <div className="vendor_directory_loading">
              {loading ? "Loading vendors…" : "Loading products…"}
            </div>
          )}
          {error && (
            <div className="vendor_directory_error">{error}</div>
          )}
          {!loading && !error && vendors.length === 0 && (
            <div className="vendor_directory_empty">
              {vendorTab === "listed" || (vendorTab === "all" && isBuyer)
                ? "No vendors have enabled Public Directory Listing yet."
                : "No vendors have completed onboarding yet."}
            </div>
          )}
          {!loading && !error && vendors.length > 0 && !directoryProductsLoading && directoryProducts.length === 0 && (
            <div className="vendor_directory_empty">
              No products are currently visible from these vendors.
            </div>
          )}
          {!loading && !error && vendors.length > 0 && directoryProducts.length > 0 && filteredDirectoryProducts.length === 0 && (
            <div className="vendor_directory_empty">
              No products match your search.
            </div>
          )}
          {!loading && !error && !directoryProductsLoading && directoryProducts.length > 0 && filteredDirectoryProducts.length > 0 && (
            <div
              className="vendor_directory_grid"
              id={vendorTab === "all" ? "vendor-directory-panel-all" : "vendor-directory-panel-listed"}
              role="tabpanel"
              aria-labelledby={vendorTab === "all" ? "vendor-tab-all" : "vendor-tab-listed"}
            >
              {filteredDirectoryProducts.map((dp) => (
            <article
              key={`${dp.vendorId}-${dp.productId}`}
              className="vendor_directory_card"
            >
              <div className="vendor_directory_card_header">
                <div className="vendor_directory_card_avatar">
                  {productInitials(dp.productName)}
                </div>
                <div className="vendor_directory_card_header_text">
                  <h2 className="vendor_directory_card_name">{dp.productName}</h2>
                  <p className="vendor_directory_card_products">
                    {displayName(dp.vendor)}
                  </p>
                </div>
                <div className="vendor_directory_card_trust_sector_wrap">
                  <div className="product_profile_product_card_trust_badge" aria-label={dp.trustScore != null ? `Trust score ${dp.trustScore}%` : "Trust score not available"}>
                    <span className="product_profile_product_card_trust_label">Trust score</span>
                    <span className="product_profile_product_card_trust_value">{dp.trustScore != null ? `${dp.trustScore}%` : "—"}</span>
                  </div>
                  <ClickTooltip
                    content={formatSector(dp.sector ?? dp.vendor.sector) || "—"}
                    position="top"
                    showOn="hover"
                  >
                    <span className="vendor_directory_card_sector">
                      {formatSectorCard(dp.sector ?? dp.vendor.sector) || "—"}
                    </span>
                  </ClickTooltip>
                </div>
              </div>
              <div className="vendor_directory_card_body">
                {dp.vendor.vendorType && (
                  <p className="vendor_directory_card_type">{dp.vendor.vendorType}</p>
                )}
                {dp.vendor.companyDescription && (
                  <p className="vendor_directory_card_desc">
                    {dp.vendor.companyDescription.slice(0, 200)}
                    {dp.vendor.companyDescription.length > 200 ? "…" : ""}
                  </p>
                )}
              </div>
              <div className="vendor_directory_card_footer">
                <span className="vendor_directory_card_location">
                  {dp.vendor.headquartersLocation || "—"}
                </span>
                <button
                  type="button"
                  className="vendor_directory_card_action vendor_directory_card_action_btn"
                  onClick={(e) => { e.stopPropagation(); handleDirectoryProductClick(dp); }}
                  aria-label={`View details for ${dp.productName}`}
                >
                  View details
                  <ChevronRight size={16} aria-hidden />
                </button>
              </div>
            </article>
          ))}
            </div>
          )}
        </>
      )}

      {vendorTab === "my" && (
        <>
          {!myProductsTabLoading && !myProductsTabError && directoryProducts.length > 0 && (
            <div className="vendor_directory_search_wrap">
              <Search size={18} className="vendor_directory_search_icon" aria-hidden />
              <input
                type="search"
                className="vendor_directory_search_input"
                placeholder="Search by product name and industry"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search by product name and industry"
              />
            </div>
          )}
          {myProductsTabLoading && (
            <div className="vendor_directory_loading">Loading your assessment products…</div>
          )}
          {myProductsTabError && (
            <div className="vendor_directory_error">{myProductsTabError}</div>
          )}
          {!myProductsTabLoading && !myProductsTabError && directoryProducts.length === 0 && (
            <div className="vendor_directory_empty">
              No products found from your assessments yet. Products appear here after you use them in a buyer or vendor COTS assessment.
            </div>
          )}
          {!myProductsTabLoading && !myProductsTabError && directoryProducts.length > 0 && filteredDirectoryProducts.length === 0 && (
            <div className="vendor_directory_empty">
              No products match your search.
            </div>
          )}
          {!myProductsTabLoading && !myProductsTabError && directoryProducts.length > 0 && filteredDirectoryProducts.length > 0 && (
            <div className="vendor_directory_grid" id="vendor-directory-panel-my" role="tabpanel" aria-labelledby="vendor-tab-my">
              {filteredDirectoryProducts.map((dp) => (
            <article
              key={`${dp.vendorId}-${dp.productId}`}
              className="vendor_directory_card"
            >
              <div className="vendor_directory_card_header">
                <div className="vendor_directory_card_avatar">
                  {productInitials(dp.productName)}
                </div>
                <div className="vendor_directory_card_header_text">
                  <h2 className="vendor_directory_card_name">{dp.productName}</h2>
                  <p className="vendor_directory_card_products">
                    {displayName(dp.vendor)}
                  </p>
                </div>
                <div className="vendor_directory_card_trust_sector_wrap">
                  <div className="product_profile_product_card_trust_badge" aria-label={dp.trustScore != null ? `Trust score ${dp.trustScore}%` : "Trust score not available"}>
                    <span className="product_profile_product_card_trust_label">Trust score</span>
                    <span className="product_profile_product_card_trust_value">{dp.trustScore != null ? `${dp.trustScore}%` : "—"}</span>
                  </div>
                  <ClickTooltip
                    content={formatSector(dp.sector ?? dp.vendor.sector) || "—"}
                    position="top"
                    showOn="hover"
                  >
                    <span className="vendor_directory_card_sector">
                      {formatSectorCard(dp.sector ?? dp.vendor.sector) || "—"}
                    </span>
                  </ClickTooltip>
                </div>
              </div>
              <div className="vendor_directory_card_body">
                {dp.vendor.vendorType && (
                  <p className="vendor_directory_card_type">{dp.vendor.vendorType}</p>
                )}
                {dp.vendor.companyDescription && (
                  <p className="vendor_directory_card_desc">
                    {dp.vendor.companyDescription.slice(0, 200)}
                    {dp.vendor.companyDescription.length > 200 ? "…" : ""}
                  </p>
                )}
              </div>
              <div className="vendor_directory_card_footer">
                <span className="vendor_directory_card_location">
                  {dp.vendor.headquartersLocation || "—"}
                </span>
                <button
                  type="button"
                  className="vendor_directory_card_action vendor_directory_card_action_btn"
                  onClick={(e) => { e.stopPropagation(); handleDirectoryProductClick(dp); }}
                  aria-label={`View details for ${dp.productName}`}
                >
                  View details
                  <ChevronRight size={16} aria-hidden />
                </button>
              </div>
            </article>
          ))}
            </div>
          )}
        </>
      )}

      {/* Vendor detail modal: list of products (only those visible to buyers) */}
      {selectedVendor && (
        <div
          className="vendor_directory_modal_overlay"
          onClick={() => { setSelectedVendor(null); setVendorProducts([]); setSelectedProduct(null); setProductDetail(null); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="vendor_detail_modal_title"
        >
          <div className="vendor_directory_modal" onClick={(e) => e.stopPropagation()}>
            <div className="vendor_directory_modal_header">
              <h2 id="vendor_detail_modal_title" className="vendor_directory_modal_title">
                {displayName(selectedVendor)} – Products
              </h2>
              <button
                type="button"
                className="modal_close_btn"
                onClick={() => { setSelectedVendor(null); setVendorProducts([]); setSelectedProduct(null); setProductDetail(null); }}
                aria-label="Close"
              >
                <CircleX size={20} />
              </button>
            </div>
            <div className="vendor_directory_modal_body">
              {vendorProductsLoading && (
                <div className="vendor_directory_loading">Loading products…</div>
              )}
              {!vendorProductsLoading && vendorProducts.length === 0 && (
                <p className="vendor_directory_empty_products">
                  No products are currently visible. The vendor can make products visible from their Product Profile.
                </p>
              )}
              {!vendorProductsLoading && vendorProducts.length > 0 && (
                <div className="vendor_directory_products_grid">
                  {vendorProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="vendor_directory_product_card"
                      onClick={() => handleProductClick(p)}
                      aria-label={`View details for ${p.productName}${p.trustScore != null ? `, Trust score ${p.trustScore}%` : ""}`}
                    >
                      <span className="vendor_directory_product_card_icon" aria-hidden>
                        {productInitials(p.productName)}
                      </span>
                      <div className="vendor_directory_product_card_content">
                        <span className="vendor_directory_product_card_name">{p.productName}</span>
                        <span className="vendor_directory_product_card_status">Completed</span>
                        {formatSectorCard(p.sector) ? (
                          <span
                            className="vendor_directory_product_card_sector"
                            title={formatSector(p.sector) || undefined}
                          >
                            {formatSectorCard(p.sector)}
                          </span>
                        ) : null}
                      </div>
                      {p.trustScore != null && (
                        <div className="vendor_directory_product_card_trust_badge" aria-label={`Trust score ${p.trustScore}%`}>
                          <span className="vendor_directory_product_card_trust_label">Trust score</span>
                          <span className="vendor_directory_product_card_trust_value">{p.trustScore}%</span>
                        </div>
                      )}
                      <ChevronRight size={20} className="vendor_directory_product_card_arrow" aria-hidden />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product detail modal: same detail cards as vendor View Product (no toggle) */}
      {selectedProduct && (
        <div
          className="vendor_directory_modal_overlay vendor_directory_modal_overlay_second"
          onClick={() => { setSelectedProduct(null); setProductDetail(null); setProductSectionVisibility(null); setSelectedVendor(null); setVendorProducts([]); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="product_detail_modal_title"
        >
          <div className="vendor_directory_modal vendor_directory_modal_large" onClick={(e) => e.stopPropagation()}>
            <div className="vendor_directory_modal_header">
              <h2 id="product_detail_modal_title" className="vendor_directory_modal_title">
                {selectedProduct.productName}
              </h2>
              <button
                type="button"
                className="modal_close_btn"
                onClick={() => { setSelectedProduct(null); setProductDetail(null); setProductSectionVisibility(null); setSelectedVendor(null); setVendorProducts([]); }}
                aria-label="Close"
              >
                <CircleX size={20} />
              </button>
            </div>
            <div className="vendor_directory_modal_body">
              {productDetailLoading && (
                <div className="vendor_directory_loading">Loading product details…</div>
              )}
              {!productDetailLoading && productDetail && (
                <>
                  {getProductDescription(productDetail) && (
                    <div className="vendor_directory_product_description">
                      <h3 className="vendor_directory_product_description_heading">Description</h3>
                      <p className="vendor_directory_product_description_text">
                        {getProductDescription(productDetail)}
                      </p>
                    </div>
                  )}
                  {productSectionVisibility && (() => {
                const vis = productSectionVisibility;
                const rawReport = productDetail.generated_profile_report;
                const report = parseGeneratedReport(rawReport);
                if (report) {
                  // Only show sections the vendor has toggled on (visible to buyers) in Product Profile → View Product.
                  const visibleSectionIds = new Set(
                    [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((id) => {
                      const key = SECTION_ID_TO_VIS_KEY[id];
                      return key != null && vis[key] === true;
                    })
                  );
                  const filteredSections = report.sections.filter((sec) => visibleSectionIds.has(sec.id));
                  if (filteredSections.length === 0) {
                    return (
                      <p className="vendor_directory_empty_products">
                        No detail sections are currently visible for this product.
                      </p>
                    );
                  }
                  return (
                    <div className="generated_profile_wrap">
                      <GeneratedProductProfileCards
                        report={{
                          trustScore: report.trustScore,
                          sections: filteredSections,
                        }}
                      />
                    </div>
                  );
                }
                const detail = buildDetailItemsFromAttestation(productDetail);
                const anyVisible =
                  vis.aiGovernance === true ||
                  vis.securityPosture === true ||
                  vis.dataPrivacy === true ||
                  vis.compliance === true ||
                  vis.modelRisk === true;
                const detailItem = (label: string, value: string) => (
                  <li key={label} className="product_profile_detail_item">
                    <span className="product_profile_detail_label">{label}:</span>{" "}
                    <span className="product_profile_detail_value">{truncate(value, 200)}</span>
                  </li>
                );
                if (!anyVisible) {
                  return (
                    <p className="vendor_directory_empty_products">
                      No detail sections are currently visible for this product.
                    </p>
                  );
                }
                return (
                  <div className="product_profile_detail_grid">
                    {vis.aiGovernance && (
                      <div className="product_profile_detail_card">
                        <div className="product_profile_detail_card_header">
                          <FlaskConical className="product_profile_detail_icon product_profile_icon_purple" size={24} aria-hidden />
                          <div>
                            <h3 className="product_profile_detail_title">AI Governance</h3>
                            <p className="product_profile_detail_subtitle">Ethics, oversight, and governance practices.</p>
                          </div>
                        </div>
                        <ul className="product_profile_detail_list">
                          {detail.aiGovernance.map(([l, v]) => detailItem(l, String(v)))}
                        </ul>
                      </div>
                    )}
                    {vis.securityPosture && (
                      <div className="product_profile_detail_card">
                        <div className="product_profile_detail_card_header">
                          <ShieldCheck className="product_profile_detail_icon product_profile_icon_blue" size={24} aria-hidden />
                          <div>
                            <h3 className="product_profile_detail_title">Security Posture</h3>
                            <p className="product_profile_detail_subtitle">Security controls and certifications.</p>
                          </div>
                        </div>
                        <ul className="product_profile_detail_list">
                          {detail.security.map(([l, v]) => detailItem(l, String(v)))}
                        </ul>
                      </div>
                    )}
                    {vis.dataPrivacy && (
                      <div className="product_profile_detail_card">
                        <div className="product_profile_detail_card_header">
                          <Database className="product_profile_detail_icon product_profile_icon_green" size={24} aria-hidden />
                          <div>
                            <h3 className="product_profile_detail_title">Data Privacy</h3>
                            <p className="product_profile_detail_subtitle">Data handling and privacy practices.</p>
                          </div>
                        </div>
                        <ul className="product_profile_detail_list">
                          {detail.dataPrivacy.map(([l, v]) => detailItem(l, String(v)))}
                        </ul>
                      </div>
                    )}
                    {vis.compliance && (
                      <div className="product_profile_detail_card">
                        <div className="product_profile_detail_card_header">
                          <FileCheck className="product_profile_detail_icon product_profile_icon_green" size={24} aria-hidden />
                          <div>
                            <h3 className="product_profile_detail_title">Compliance</h3>
                            <p className="product_profile_detail_subtitle">Regulatory frameworks and certifications.</p>
                          </div>
                        </div>
                        <ul className="product_profile_detail_list">
                          {detail.compliance.map(([l, v]) => detailItem(l, String(v)))}
                        </ul>
                      </div>
                    )}
                    {vis.modelRisk && (
                      <div className="product_profile_detail_card product_profile_detail_card_span_2">
                        <div className="product_profile_detail_card_header">
                          <Cpu className="product_profile_detail_icon product_profile_icon_purple" size={24} aria-hidden />
                          <div>
                            <h3 className="product_profile_detail_title">Model Risk Management</h3>
                            <p className="product_profile_detail_subtitle">AI model governance and risk controls.</p>
                          </div>
                        </div>
                        <div className="product_profile_model_risk_columns">
                          <ul className="product_profile_detail_list">
                            {detail.modelRisk.slice(0, 2).map(([l, v]) => detailItem(l, String(truncate(String(v), 180))))}
                          </ul>
                          <ul className="product_profile_detail_list">
                            {detail.modelRisk.slice(2, 4).map(([l, v]) => detailItem(l, String(truncate(String(v), 180))))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorDirectory;
