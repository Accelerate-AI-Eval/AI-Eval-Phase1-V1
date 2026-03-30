import type { Request, Response } from "express";
import { db } from "../../database/db.js";
import { createOrganization } from "../../schema/organizations/createOrganization.js";
import { usersTable } from "../../schema/schema.js";
import { eq } from "drizzle-orm";

/** Fetch organizations with hasAdmin flag (each org can have only one admin for invite UI). */
const fetchOrganizations = async (req: Request, res: Response) => {
  try {
    const organizations = await db
      .select()
      .from(createOrganization);

    if (organizations.length === 0) {
      return res.status(200).json({
        message: "Organizations fetched successfully",
        data: organizations.map((o) => ({ ...o, hasAdmin: false })),
      });
    }

    const adminRows = await db
      .select({ organization_id: usersTable.organization_id })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"));

    const orgIdsWithAdmin = new Set(
      adminRows.map((r) => r.organization_id).filter((id): id is number => id != null)
    );

    const data = organizations.map((org) => ({
      ...org,
      hasAdmin: orgIdsWithAdmin.has(org.id),
    }));

    res.status(200).json({
      message: "Organizations fetched successfully",
      data,
    });
  } catch (error) {
    console.error("Error in fetchOrganizations:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Internal server error" });
  }
};

export default fetchOrganizations;
