import type { Request, Response } from "express";
import { eq, and, or } from "drizzle-orm";
import { db } from "../../database/db.js";
import { usersTable } from "../../schema/schema.js";
import { customerRiskAssessmentReports } from "../../schema/assessments/customerRiskAssessmentReports.js";
import { assessments } from "../../schema/assessments/assessments.js";
import { cotsVendorAssessments } from "../../schema/assessments/cotsVendorAssessments.js";
import { vendorSelfAttestations } from "../../schema/assessments/vendorSelfAttestations.js";

/**
 * GET /customerRiskReports/:id
 * Returns a single Analysis Report by id; user must belong to same organization.
 */
const getCustomerRiskReportById = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = req.user as { id?: number } | undefined;
    const userId = payload?.id;
    if (userId == null) {
      res.status(401).json({ success: false, message: "User not authenticated" });
      return;
    }

    const idParam = (req.params as { id?: string }).id;
    const id = idParam != null && String(idParam).trim() !== "" ? String(idParam).trim() : null;
    if (!id) {
      res.status(400).json({ success: false, message: "Report ID required" });
      return;
    }

    const [user] = await db
      .select({
        organization_id: usersTable.organization_id,
        user_platform_role: usersTable.user_platform_role,
      })
      .from(usersTable)
      .where(eq(usersTable.id, Number(userId)))
      .limit(1);
    const orgId = user?.organization_id != null ? String(user.organization_id).trim() : "";
    const platformRole = String((user as { user_platform_role?: string })?.user_platform_role ?? "")
      .trim()
      .toLowerCase()
      .replace(/_/g, " ");
    const isSystemUser =
      platformRole === "system admin" || platformRole === "system manager" || platformRole === "system viewer";
    if (!isSystemUser && !orgId) {
      res.status(403).json({ success: false, message: "User has no organization" });
      return;
    }

    const whereClause = isSystemUser
      ? and(eq(customerRiskAssessmentReports.id, id))
      : and(
          eq(customerRiskAssessmentReports.id, id),
          eq(customerRiskAssessmentReports.organization_id, orgId),
        );

    const [row] = await db
      .select({
        id: customerRiskAssessmentReports.id,
        assessmentId: customerRiskAssessmentReports.assessment_id,
        title: customerRiskAssessmentReports.title,
        report: customerRiskAssessmentReports.report,
        createdAt: customerRiskAssessmentReports.created_at,
        expiryAt: assessments.expiry_at,
        attestationExpiryAt: vendorSelfAttestations.expiry_at,
      })
      .from(customerRiskAssessmentReports)
      .innerJoin(assessments, eq(customerRiskAssessmentReports.assessment_id, assessments.id))
      .leftJoin(cotsVendorAssessments, eq(assessments.id, cotsVendorAssessments.assessment_id))
      .leftJoin(
        vendorSelfAttestations,
        or(
          eq(cotsVendorAssessments.vendor_attestation_id, vendorSelfAttestations.id),
          eq(cotsVendorAssessments.vendor_attestation_id, vendorSelfAttestations.vendor_self_attestation_id),
        ),
      )
      .where(whereClause)
      .limit(1);

    if (!row) {
      res.status(404).json({ success: false, message: "Report not found" });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: row.id,
        assessmentId: row.assessmentId,
        title: row.title,
        report: row.report,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
        expiryAt: row.expiryAt instanceof Date ? row.expiryAt.toISOString() : (row.expiryAt != null ? String(row.expiryAt) : null),
        attestationExpiryAt: row.attestationExpiryAt instanceof Date ? row.attestationExpiryAt.toISOString() : (row.attestationExpiryAt != null ? String(row.attestationExpiryAt) : null),
      },
    });
  } catch (error) {
    console.error("getCustomerRiskReportById error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get report",
    });
  }
};

export default getCustomerRiskReportById;
