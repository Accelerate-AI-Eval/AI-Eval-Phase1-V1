import type { Request, Response } from "express";
import { db } from "../../database/db.js";
import { usersTable } from "../../schema/schema.js";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import emailConfig from "../../functions/emailconfig.js";

const RESET_TOKEN_EXPIRY = "1h";
const BASE_URL = process.env.BASE_URL ;

function resetPasswordEmailTemplate(resetLink: string) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reset your password</title>
<style>
  body { font-family: Arial, sans-serif; margin:0; padding:0; background:#f4f6f8; color:#333333; }
  .container { max-width: 600px; margin: 20px auto; padding: 30px; background: #ffffff; border-radius: 8px; color:#333333; }
  h1 { color: #2463eb; }
  p { font-size:16px; line-height:1.5; color:#333333; }
  .button-container { margin:20px 0; }
  .confirm-button { background-color: #2463eb; color:#ffffff; padding:14px 28px; border-radius:6px; text-decoration:none; font-weight:bold; display:inline-block; }
  .footer { font-size:12px; color:#666666; margin-top:20px; text-align:center; }
</style>
</head>
<body style="font-family: Arial, sans-serif; margin:0; padding:0; background:#f4f6f8; color:#333333;">
<div class="container" style="max-width: 600px; margin: 20px auto; padding: 30px; background: #ffffff; border-radius: 8px; color:#333333;">
  <h1 style="color: #2463eb;">Reset your password</h1>
  <p style="font-size:16px; line-height:1.5; color:#333333;">You requested a password reset for your AI Eval account. Click the button below to choose a new password.</p>
  <div class="button-container" style="margin:20px 0;">
    <a href="${resetLink}" class="confirm-button" style="background-color: #2463eb; color:#ffffff; padding:14px 28px; border-radius:6px; text-decoration:none; font-weight:bold; display:inline-block;">Reset Password</a>
  </div>
  <p style="font-size:16px; line-height:1.5; color:#333333;">This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>
  <p style="font-size:16px; line-height:1.5; color:#333333;">Thanks,<br>The AI Eval Team</p>
  <div class="footer" style="font-size:12px; color:#666666; margin-top:20px; text-align:center;">&copy; 2026 AI Eval. All rights reserved.</div>
</div>
</body>
</html>`;
}

const forgotPassword = async (req: Request, res: Response) => {
  const email = req.body?.email?.trim()?.toLowerCase();

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const user = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    // Always return success to avoid leaking whether email exists
    if (user.length === 0) {
      return res.status(200).json({
        message:
          "If an account exists with this email, you will receive a password reset link shortly.",
      });
    }

    const secret = process.env.JWT_SECRET_KEY;
    if (!secret) {
      console.error("Forgot password: JWT_SECRET_KEY is not set");
      return res.status(500).json({
        message: "Something went wrong. Please try again later.",
      });
    }

    const userRow = user[0];
    if (!userRow) {
      return res.status(404).json({ message: "User not found" });
    }
    const resetToken = jwt.sign(
      { email: userRow.email, purpose: "password_reset" },
      secret,
      { expiresIn: RESET_TOKEN_EXPIRY } as jwt.SignOptions,
    );

    const resetLink = `${BASE_URL}/resetPassword?token=${encodeURIComponent(resetToken)}`;

    try {
      const transporter = emailConfig();
      await transporter.sendMail({
        from: {
          name: "AI Eval",
          address: process.env.SENDER_EMAIL_ID || "",
        },
        to: email,
        subject: "Reset your AI Eval password",
        html: resetPasswordEmailTemplate(resetLink),
      });
    } catch (emailErr: unknown) {
      console.error("Forgot password: email send failed", emailErr);
      return res.status(200).json({
        message:
          "If an account exists with this email, you will receive a password reset link shortly.",
      });
    }

    return res.status(200).json({
      message:
        "If an account exists with this email, you will receive a password reset link shortly.",
    });
  } catch (err: unknown) {
    console.error("Forgot password error:", err);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
    });
  }
};

export default forgotPassword;
