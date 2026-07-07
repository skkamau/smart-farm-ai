import nodemailer from "nodemailer";

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

export async function sendPasswordResetEmail({ to, resetLink }) {
  if (!hasSmtpConfig()) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[auth] Password reset link generated for development testing", { to, resetLink });
    } else {
      console.warn("[auth] SMTP is not configured; password reset email was not sent", { to });
    }
    return false;
  }

  await transporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "Reset your Smart Farm AI password",
    text: `Use this secure link to reset your Smart Farm AI password. It expires in 30 minutes.\n\n${resetLink}\n\nIf you did not request this, ignore this email.`,
    html: `<p>Use this secure link to reset your Smart Farm AI password. It expires in 30 minutes.</p><p><a href="${resetLink}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`
  });
  return true;
}

export async function sendPasswordChangedEmail({ to }) {
  if (!hasSmtpConfig()) return false;

  await transporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "Your Smart Farm AI password was changed",
    text: "Your Smart Farm AI password was changed. If this was not you, contact your farm administrator immediately.",
    html: "<p>Your Smart Farm AI password was changed.</p><p>If this was not you, contact your farm administrator immediately.</p>"
  });
  return true;
}
