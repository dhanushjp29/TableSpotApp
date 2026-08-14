import bcrypt from "bcryptjs";

import OTP from "../models/OTP.js";
import User from "../models/User.js";

import ApiError from "../utils/ApiError.js";
import { OTP_EXPIRY_MINUTES, OTP_PURPOSE, SALT_ROUNDS } from "../utils/constants.js";
import generateOTP from "../utils/generateOTP.js";
import { sendEmail } from "./email.service.js";
import { compileTemplate } from "../utils/templateParser.js";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "tablespotapp@gmail.com";
const SUPPORT_PHONE = process.env.SUPPORT_PHONE || "+916374428721";

export const sendOTP = async ({ email, purpose, userId = null }) => {
  // Generate OTP
  const otp = generateOTP();

  // Hash OTP
  const hashedOTP = await bcrypt.hash(otp, SALT_ROUNDS);

  // Delete previous OTP for same email & purpose
  await OTP.findOneAndDelete({
    email,
    purpose,
  });

  // Save new OTP
  await OTP.create({
    userId,
    email,
    otp: hashedOTP,
    purpose,
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000), // 5 Minutes
  });

  // Email Subject
  let subject = "Your OTP";

  switch (purpose) {
    case OTP_PURPOSE.EMAIL_VERIFICATION:
      subject = "Verify Your Email";
      break;

    case OTP_PURPOSE.PASSWORD_RESET:
      subject = "Reset Your Password";
      break;

    case OTP_PURPOSE.CHANGE_EMAIL:
      subject = "Verify Your New Email";
      break;

    case OTP_PURPOSE.LOGIN_VERIFICATION:
      subject = "Login Verification OTP";
      break;
  }

  const user = userId ? await User.findById(userId).select("fullName") : null;
  let html = "";
  const currentYear = new Date().getFullYear();

  if (purpose === OTP_PURPOSE.EMAIL_VERIFICATION) {
    html = compileTemplate("verify-email", {
      NAME: user?.fullName || "User",
      OTP: otp,
      SUPPORT_EMAIL,
      SUPPORT_PHONE,
      CLIENT_URL: process.env.CLIENT_URL || "",
      YEAR: currentYear
    });
  } else if (purpose === OTP_PURPOSE.PASSWORD_RESET) {
    html = compileTemplate("forgot-password", {
      NAME: user?.fullName || "User",
      OTP: otp,
      SUPPORT_EMAIL,
      SUPPORT_PHONE,
      CLIENT_URL: process.env.CLIENT_URL || "",
      YEAR: currentYear
    });
  }

  await sendEmail({
    to: email,
    subject,
    html,
  });

  return {
    success: true,
    message: "OTP sent successfully.",
    expiresIn: 300,
  };
};

export const verifyOTP = async ({
  email,
  otp,
  purpose,
}) => {
  const otpRecord = await OTP.findOne({
    email,
    purpose,
  });

  if (!otpRecord) {
    throw new ApiError(404, "OTP not found.");
  }

  // Expired
  if (new Date() > otpRecord.expiresAt) {
    await OTP.deleteOne({ _id: otpRecord._id });

    throw new ApiError(400, "OTP has expired.");
  }

  // Too many attempts
  if (otpRecord.attemptCount >= 5) {
    await OTP.deleteOne({ _id: otpRecord._id });

    throw new ApiError(
      429,
      "Maximum OTP attempts exceeded."
    );
  }

  const isValid = await bcrypt.compare(
    otp,
    otpRecord.otp
  );

  if (!isValid) {
    otpRecord.attemptCount += 1;

    await otpRecord.save();

    throw new ApiError(400, "Invalid OTP.");
  }

  // Delete OTP after successful verification
  await OTP.deleteOne({
    _id: otpRecord._id,
  });

  return true;
};
