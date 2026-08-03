import crypto from "crypto";

const generateOTP = (length = 6) => {
  let otp = "";

  while (otp.length < length) {
    otp += crypto.randomInt(0, 10).toString();
  }

  return otp;
};

export default generateOTP;
