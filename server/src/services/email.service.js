import nodemailer from "nodemailer";

import ApiError from "../utils/ApiError.js";

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
    }))
    .filter(
      (attachment) =>
        attachment.content ||
        attachment.path ||
        attachment.cid
    );

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

    const normalizedAttachments = normalizeAttachments(attachments);

    if (normalizedAttachments.length > 0) {
      mailOptions.attachments = normalizedAttachments;
    }

    return await transporterInstance.sendMail(mailOptions);
  } catch (error) {
    throw new ApiError(500, error.message || "Failed to send email.");
  }
};
