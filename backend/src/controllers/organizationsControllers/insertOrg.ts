import { eq, sql } from "drizzle-orm";
import { db } from "../../database/db.js";
import { createOrganization } from "../../schema/schema.js";
import type { Request, Response } from "express";

const insertOrganization = async (req: Request, res: Response) => {
  try {
    const organizationName = req.body.isOrganizationName?.trim();
    const userId = req.body.user;

    if (!organizationName) {
      return res
        .status(400)
        .json({ message: "Organization name is required" });
    }

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Duplicate check: case-insensitive; store and display name exactly as entered (no lowercase/uppercase)
    const organizationDuplicates = await db
      .select()
      .from(createOrganization)
      .where(
        sql`LOWER(TRIM("organizationName")) = LOWER(${organizationName})`
      )
      .limit(1);

    if (organizationDuplicates.length > 0) {
      return res
        .status(409)
        .json({ message: "Organization already exists" });
    }

    const [organization] = await db
      .insert(createOrganization)
      .values({
        organizationName,
        organizationStatus: "active",
        created_by: String(userId),
      })
      .returning();

    return res.status(201).json({
      message: "Organization created successfully",
      organization,
    });
  } catch (error: any) {
    console.error("Error in insertOrganization:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export default insertOrganization;
