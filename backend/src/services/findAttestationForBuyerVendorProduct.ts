import { db } from "../database/db.js";
import { vendors, vendorSelfAttestations, createOrganization } from "../schema/schema.js";
import { and, desc, eq, sql } from "drizzle-orm";

/**
 * Find the vendor's completed buyer-visible attestation row matching directory vendor name + product name.
 */
export async function findAttestationForBuyerVendorProduct(
  vendorName: string,
  productName: string,
): Promise<Record<string, unknown> | null> {
  const vName = (vendorName ?? "").trim();
  const pName = (productName ?? "").trim();
  if (!vName || !pName) return null;

  const joinOrg = sql`${createOrganization.id} = (${vendors.organizationId})::int`;

  const rows = await db
    .select({
      row: vendorSelfAttestations,
    })
    .from(vendors)
    .innerJoin(createOrganization, joinOrg)
    .innerJoin(vendorSelfAttestations, eq(vendorSelfAttestations.user_id, vendors.userId))
    .where(
      and(
        eq(vendors.publicDirectoryListing, true),
        sql`trim(lower(${createOrganization.organizationName})) = trim(lower(${vName}))`,
        sql`trim(lower(coalesce(${vendorSelfAttestations.product_name}, ''))) = trim(lower(${pName}))`,
        sql`upper(trim(coalesce(${vendorSelfAttestations.status}, ''))) = 'COMPLETED'`,
        eq(vendorSelfAttestations.visible_to_buyer, true),
        sql`(${vendorSelfAttestations.expiry_at} IS NULL OR ${vendorSelfAttestations.expiry_at} >= now())`,
      ),
    )
    .orderBy(desc(vendorSelfAttestations.updated_at))
    .limit(1);

  const r = rows[0]?.row;
  if (!r) return null;
  return { ...(r as object) } as Record<string, unknown>;
}
