import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db } from "../../database/db.js";
import { eq } from "drizzle-orm";
import { createOrganization, userEditLogs, usersTable } from "../../schema/schema.js";
import emailConfig from "../../functions/emailconfig.js";


/** HTML email for signup confirmation (invite or reactivation). */
function signupConfirmationEmailHtml(
  organizationName: string,
  role: string,
  confirmationLink: string,
) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>AI Eval - Confirm your account</title></head>
<body style="font-family: Arial, sans-serif; margin:0; padding:0; background:#f4f6f8; color:#333333;">
<div style="max-width: 600px; margin: 20px auto; padding: 30px; background: #ffffff; border-radius: 8px; color:#333333;">
  <h1 style="color: #2463eb;">Welcome to AI Eval!</h1>
  <p style="font-size:16px; line-height:1.5;">Your account has been activated. Please confirm your email to access the portal and set your password if needed.</p>
  <p style="font-size:16px; line-height:1.5;">You are registered as <strong>${role}</strong> in <strong>${organizationName}</strong>.</p>
  <div style="margin:20px 0;">
    <a href="${confirmationLink}" style="background-color: #2463eb; color:#ffffff; padding:14px 28px; border-radius:6px; text-decoration:none; font-weight:bold;">Confirm Email</a>
  </div>
  <p style="font-size:16px; line-height:1.5;">Thanks,<br>The AI Eval Team</p>
</div>
</body>
</html>`;
}

const updatesUsers = async (req: Request, res: Response) => {
  const data = req.body;
  const user_Id = Number(req.params.id);

  if (!user_Id) {
    return res.status(400).json({
      success: false,
      message: "Invalid User id",
    });
  }

  try {
    // Email and organization are not editable; load current user for logging and status check only.
    const [currentUserRow] = await db
      .select({
        email: usersTable.email,
        organization_id: usersTable.organization_id,
        userStatus: usersTable.userStatus,
      })
      .from(usersTable)
      .where(eq(usersTable.id, user_Id))
      .limit(1);

    if (!currentUserRow) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const emailLower = currentUserRow.email ?? "";
    const organizationId = Number(currentUserRow.organization_id);
    const previousStatus = String(currentUserRow.userStatus ?? "").trim().toLowerCase();

    const [orgRow] = await db
      .select({ organizationName: createOrganization.organizationName })
      .from(createOrganization)
      .where(eq(createOrganization.id, organizationId))
      .limit(1);
    const organizationNameForLog = orgRow?.organizationName ?? String(organizationId);

    const validOnboardingStatuses = ["completed", "expired", "pending"] as const;
    const raw = data.onboarding_status && String(data.onboarding_status).toLowerCase();
    const onboardingStatus =
      raw && validOnboardingStatuses.includes(raw) ? raw : undefined;

    const systemRoles = [
      "system admin",
      "system user",
      "system manager",
      "system viewer",
      "ai directory curator",
    ];
    const newRole = data.role != null ? String(data.role).toLowerCase().trim() : "";
    const isAiEval = organizationId === 1;
    const platformRoleToSet =
      isAiEval && systemRoles.includes(newRole)
        ? newRole
        : isAiEval
          ? "" // clear platform role when switching to non-system role
          : undefined; // do not change for non-AI-Eval orgs

    // Only update editable fields: role, userStatus, optional onboarding_status, user_platform_role for AI Eval system roles (email and organization are immutable).
    await db
      .update(usersTable)
      .set({
        role: data.role,
        userStatus: data.isStatus,
        ...(onboardingStatus != null && { onboarding_status: onboardingStatus }),
        ...(platformRoleToSet != null && { user_platform_role: platformRoleToSet }),
      })
      .where(eq(usersTable.id, user_Id));

    await db.insert(userEditLogs).values({
      userId: data.userId,
      email: emailLower,
      organizationName: organizationNameForLog,
      userStatus: data.isStatus,
      updated_by: data.userId,
      reason: data.isReason,
    });

    const newStatus = String(data.isStatus ?? "").trim().toLowerCase();
    if (previousStatus === "inactive" && newStatus === "active") {
      const BASE_URL = process.env.BASE_URL;
      const secret = process.env.JWT_SECRET_KEY;
      if (secret && BASE_URL) {
        try {
          const token = jwt.sign({ email: emailLower }, secret, { expiresIn: "7d" } as jwt.SignOptions);
          const confirmationLink = `${BASE_URL}/signup/${token}`;
          const transporter = emailConfig();
          await transporter.sendMail({
            from: {
              name: "AI_Eval",
              address: process.env.SENDER_EMAIL_ID || "",
            },
            to: emailLower,
            subject: "Your AI Eval account has been reactivated – Confirm your email",
            html: signupConfirmationEmailHtml(
              organizationNameForLog,
              data.role ?? "",
              confirmationLink,
            ),
          });
        } catch (emailErr) {
          console.error("Reactivation confirmation email failed:", emailErr);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to update user",
    });
  }
};

export default updatesUsers;
