import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

import ApiError from "../utils/ApiError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolved once at module load so the file is read only once per process.
const LOGO_PATH = path.resolve(__dirname, "../../../client/public/blacklogo.png");

let transporter;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new ApiError(
      500,
      "SMTP configuration is missing. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS."
    );
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: String(SMTP_SECURE).toLowerCase() === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    // Fail fast when the hosting network blocks outbound SMTP. These values
    // make the underlying connection problem observable instead of allowing
    // a transactional flow to hang for several minutes.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  return transporter;
};

const normalizeAttachments = (attachments = []) =>
  attachments
    .filter(Boolean)
    .map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content || attachment.buffer,
      contentType: attachment.contentType || attachment.mimetype,
      path: attachment.path,
      cid: attachment.cid,
      encoding: attachment.encoding,
      contentDisposition: attachment.contentDisposition,
      headers: attachment.headers,
    }))
    .filter(
      (attachment) =>
        attachment.content ||
        attachment.path ||
        attachment.cid
    );

/** Return the transparent PNG as an unnamed inline CID part. */
const buildLogoAttachment = () => {
  try {
    if (!fs.existsSync(LOGO_PATH)) return null;
    return {
      // Explicitly suppress Nodemailer's generated attachment-1.png name.
      // The CID part remains available to the HTML but is not a downloadable
      // logo attachment in clients such as Gmail.
      filename: false,
      content: fs.readFileSync(LOGO_PATH),
      cid: "tablespot-logo",
      contentType: "image/png",
      contentDisposition: "inline",
      headers: { "X-Attachment-Id": "tablespot-logo" },
    };
  } catch {
    return null;
  }
};

/**
 * Email delivery provider switch.
 *
 * Render's free tier blocks outbound SMTP (ports 25/465/587), so production
 * uses Brevo's HTTPS transactional API instead. Set EMAIL_PROVIDER=brevo with
 * BREVO_API_KEY. When EMAIL_PROVIDER is unset (or "smtp"), the legacy
 * nodemailer SMTP path is used and local development keeps working unchanged.
 */

const getEmailProvider = () => {
  const provider = String(process.env.EMAIL_PROVIDER || "smtp").trim().toLowerCase();

  if (provider === "smtp") {
    return null;
  }

  if (provider === "brevo") {
    if (!process.env.BREVO_API_KEY) {
      throw new ApiError(500, "EMAIL_PROVIDER=brevo requires BREVO_API_KEY.");
    }
    return { name: "brevo", apiKey: process.env.BREVO_API_KEY };
  }

  throw new ApiError(
    500,
    `Unsupported EMAIL_PROVIDER "${provider}". Use "smtp" or "brevo".`
  );
};

const fetchWithTimeout = async (url, options, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

/** Extract `{ name, email }` from "Name <email>" or a plain "email". */
const parseSender = (value) => {
  const text = String(value || "").trim();
  const match = text.match(/^([^<]+)\s*<([^>]+)>/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: "", email: text };
};

/** Brevo recipients expect an array of `{ email }` objects. */
const toRecipients = (value) => {
  const entries = Array.isArray(value) ? value : String(value || "").split(",");
  return entries
    .map((entry) => {
      if (entry && typeof entry === "object" && entry.email) {
        return { email: String(entry.email).trim() };
      }
      const { email } = parseSender(entry);
      return email ? { email } : null;
    })
    .filter(Boolean);
};

const toBase64 = (content) => {
  if (Buffer.isBuffer(content)) return content.toString("base64");
  return Buffer.from(String(content ?? "")).toString("base64");
};

/** Nodemailer allows path-only attachments; Brevo needs the bytes inline. */
const resolveAttachmentContent = (attachment) => {
  if (attachment.content || attachment.buffer) {
    return attachment.content || attachment.buffer;
  }
  if (attachment.path) {
    return fs.readFileSync(attachment.path);
  }
  return null;
};

/** Never let the API key leak into logs or surfaced error messages. */
const redactSecret = (value, secret) => {
  if (!secret) return String(value ?? "");
  return String(value ?? "").split(secret).join("[REDACTED]");
};

const sendViaBrevo = async (apiKey, mailOptions, attachments) => {
  const { from, to, cc, bcc, replyTo, subject, html, text } = mailOptions;

  const sender = parseSender(from);
  const payload = {
    sender: {
      name: sender.name || "TableSpot",
      email: sender.email,
    },
    to: toRecipients(to),
    subject,
  };

  if (html) payload.htmlContent = html;
  if (text) payload.textContent = text;
  if (cc) payload.cc = toRecipients(cc);
  if (bcc) payload.bcc = toRecipients(bcc);
  if (replyTo) payload.replyTo = { email: parseSender(replyTo).email };

  if (attachments.length) {
    payload.attachment = attachments
      .map((attachment) => {
        const content = resolveAttachmentContent(attachment);
        if (!content) return null;
        return {
          content: toBase64(content),
          name:
            attachment.filename ||
            attachment.name ||
            (attachment.cid ? attachment.cid : "attachment"),
          disposition:
            attachment.contentDisposition === "inline" ? "inline" : "attachment",
          cid: attachment.cid || undefined,
        };
      })
      .filter(Boolean);
  }

  let response;
  try {
    response = await fetchWithTimeout("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Brevo email request failed:", redactSecret(error.message, apiKey));
    throw new ApiError(500, "Email provider request failed. The email was not sent.");
  }

  if (!response.ok) {
    const detail = await response.text();
    console.error(`Brevo email API error (${response.status}):`, redactSecret(detail, apiKey));
    throw new ApiError(500, `Brevo API error (${response.status}): ${redactSecret(detail, apiKey)}`);
  }

  let messageId = null;
  try {
    const data = await response.json();
    messageId = data?.messageId || null;
  } catch {
    // Success without a JSON body; messageId stays null.
  }

  return {
    messageId,
    accepted: toRecipients(to),
    response: `Brevo accepted (${response.status})`,
  };
};

export const sendEmail = async ({
  to,
  subject,
  html = "",
  text = "",
  from = process.env.MAIL_FROM || process.env.SMTP_USER,
  cc,
  bcc,
  replyTo,
  attachments = [],
}) => {
  try {
    // Never touch real SMTP transports during automated test runs; the e2e
    // suites only use placeholder recipient addresses (e.g. *.example.test).
    if (process.env.NODE_ENV === "test") {
      return { messageId: "test-noop", accepted: [], rejected: [], response: "test environment: send skipped" };
    }

    const provider = getEmailProvider();

    const mailOptions = {
      from,
      to,
      subject,
      html,
      text,
    };

    if (cc) {
      mailOptions.cc = cc;
    }

    if (bcc) {
      mailOptions.bcc = bcc;
    }

    if (replyTo) {
      mailOptions.replyTo = replyTo;
    }

    const allAttachments = [...attachments];
    if (html.includes("cid:tablespot-logo") && !allAttachments.some((attachment) => attachment?.cid === "tablespot-logo")) {
      const logo = buildLogoAttachment();
      if (logo) allAttachments.push(logo);
    }

    const normalizedAttachments = normalizeAttachments(allAttachments);

    if (provider?.name === "brevo") {
      return await sendViaBrevo(provider.apiKey, mailOptions, normalizedAttachments);
    }

    const transporterInstance = getTransporter();

    if (normalizedAttachments.length > 0) {
      mailOptions.attachments = normalizedAttachments;
    }

    return await transporterInstance.sendMail(mailOptions);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error("Email send failed:", error.message || "Unknown transport error.");
    throw new ApiError(500, `Email send failed${error.code ? ` (${error.code})` : ""}: ${error.message || "Unknown transport error."}`);
  }
};
