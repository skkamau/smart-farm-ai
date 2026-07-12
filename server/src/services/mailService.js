import nodemailer from "nodemailer";

export const defaultSupportEmail = "smartfarm005ai@gmail.com";

export function smtpConfigured(env = process.env) {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && (env.SMTP_PASSWORD || env.SMTP_PASS));
}

function transporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS
    }
  });
}

function sender() {
  return process.env.EMAIL_FROM || process.env.SMTP_FROM || `Smart Farm AI <${process.env.SMTP_USER || defaultSupportEmail}>`;
}

function supportEmail() {
  return process.env.SUPPORT_EMAIL || defaultSupportEmail;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function safeHeader(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

export async function sendPasswordResetEmail({ to, resetLink }) {
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[auth] Password reset email skipped because SMTP is not configured", { to });
    } else {
      console.warn("[auth] SMTP is not configured; password reset email was not sent");
    }
    return false;
  }

  await transporter().sendMail({
    from: sender(),
    replyTo: supportEmail(),
    to,
    subject: "Reset your Smart Farm AI password",
    text: `Use this secure link to reset your Smart Farm AI password. It expires in 30 minutes.\n\n${resetLink}\n\nIf you did not request this, ignore this email.`,
    html: `<p>Use this secure link to reset your Smart Farm AI password. It expires in 30 minutes.</p><p><a href="${escapeHtml(resetLink)}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`
  });
  return true;
}

export async function sendPasswordChangedEmail({ to }) {
  if (!smtpConfigured()) return false;

  await transporter().sendMail({
    from: sender(),
    replyTo: supportEmail(),
    to,
    subject: "Your Smart Farm AI password was changed",
    text: "Your Smart Farm AI password was changed. If this was not you, contact your farm administrator immediately.",
    html: "<p>Your Smart Farm AI password was changed.</p><p>If this was not you, contact your farm administrator immediately.</p>"
  });
  return true;
}

export async function sendSupportNotificationEmail({ report, user }) {
  if (!smtpConfigured()) return false;
  const type = escapeHtml(report.reportType);
  const subject = escapeHtml(report.title);
  const description = escapeHtml(report.description).replace(/\n/g, "<br>");
  await transporter().sendMail({
    from: sender(),
    to: supportEmail(),
    replyTo: user.email,
    subject: safeHeader(`[${report.reportType}] ${report.title}`),
    text: `New Smart Farm AI support request\n\nType: ${report.reportType}\nSubject: ${report.title}\nUser: ${user.name}\nEmail: ${user.email}\nFarm: ${user.farmName || "Not set"}\n\n${report.description}`,
    html: `<h2>New Smart Farm AI support request</h2><p><strong>Type:</strong> ${type}</p><p><strong>Subject:</strong> ${subject}</p><p><strong>User:</strong> ${escapeHtml(user.name)}</p><p><strong>Email:</strong> ${escapeHtml(user.email)}</p><p><strong>Farm:</strong> ${escapeHtml(user.farmName || "Not set")}</p><p>${description}</p>`
  });
  return true;
}

export async function sendSupportConfirmationEmail({ report, user }) {
  if (!smtpConfigured()) return false;
  await transporter().sendMail({
    from: sender(),
    to: user.email,
    replyTo: supportEmail(),
    subject: "Smart Farm AI support request received",
    text: `We received your ${report.reportType.toLowerCase()} request: ${report.title}. Our support team will review it.`,
    html: `<p>We received your <strong>${escapeHtml(report.reportType.toLowerCase())}</strong> request:</p><p><strong>${escapeHtml(report.title)}</strong></p><p>Our support team will review it.</p>`
  });
  return true;
}
