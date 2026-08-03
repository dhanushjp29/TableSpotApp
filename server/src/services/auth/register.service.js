import bcrypt from "bcryptjs";

import User from "../../models/User.js";

import ApiError from "../../utils/ApiError.js";
import generateCode from "../../utils/generateCode.js";

import {
  CODE_PREFIX,
  OTP_PURPOSE,
  SALT_ROUNDS,
} from "../../utils/constants.js";

import { sendOTP } from "../otp.service.js";

export const register = async ({
  fullName,
  email,
  password,
  phoneNumber = "",
  role = "customer",
}) => {
  // Check if email already exists
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    // Already verified
    if (existingUser.isEmailVerified) {
      throw new ApiError(
        409,
        "An account with this email already exists. Please login."
      );
    }

    // Email exists but not verified
    await sendOTP({
      email: existingUser.email,
      purpose: OTP_PURPOSE.EMAIL_VERIFICATION,
      userId: existingUser._id,
    });

    return {
      userId: existingUser._id,
      email: existingUser.email,
      isEmailVerified: false,
      message:
        "Your account is not verified. A new verification OTP has been sent to your email.",
    };
  }

  // Generate User Code
  const userCode = await generateCode(
    User,
    "userCode",
    CODE_PREFIX.USER
  );

  // Hash Password
  const hashedPassword = await bcrypt.hash(
    password,
    SALT_ROUNDS
  );

  // Create User
  const user = await User.create({
    userCode,
    fullName,
    email,
    password: hashedPassword,
    phoneNumber,
    role,
  });

  // Send Verification OTP
  await sendOTP({
    email: user.email,
    purpose: OTP_PURPOSE.EMAIL_VERIFICATION,
    userId: user._id,
  });

  return {
    userId: user._id,
    email: user.email,
    isEmailVerified: false,
    message:
      "Registration successful. Please verify your email.",
  };
};
