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

    const transporterInstance = getTransporter();

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

    if (normalizedAttachments.length > 0) {
      mailOptions.attachments = normalizedAttachments;
    }

    return await transporterInstance.sendMail(mailOptions);
  } catch (error) {
    throw new ApiError(500, `SMTP send failed${error.code ? ` (${error.code})` : ""}: ${error.message || "Unknown transport error."}`);
  }
};
