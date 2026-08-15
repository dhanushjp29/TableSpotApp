import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getRazorpayMode } from "./razorpay.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the same environment file used by the server before config modules
// read process.env during ESM module initialization.
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const emailProvider = () =>
  String(process.env.EMAIL_PROVIDER || "smtp").trim().toLowerCase();

// "smtp" (default) needs SMTP credentials. "brevo" replaces them with a
// BREVO_API_KEY and delivers over HTTPS, so SMTP vars are not required then.
const emailVariables = emailProvider() === "brevo"
  ? ["BREVO_API_KEY", "MAIL_FROM"]
  : ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"];

const requiredProductionVariables = [
  "MONGODB_URI",
  "CLIENT_URL",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
  "ACCESS_TOKEN_EXPIRES_IN",
  "REFRESH_TOKEN_EXPIRES_IN",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  ...emailVariables,
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "RAZORPAY_ORDER_MOCK",
  "RAZORPAY_REFUND_MOCK",
  "RAZORPAY_ONBOARDING_MOCK",
];

const isProduction = () => String(process.env.NODE_ENV || "").toLowerCase() === "production";

const isLocalMongoUri = (value) => /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(String(value || ""));

export const assertProductionEnvironment = () => {
  if (!isProduction()) return;

  const missing = requiredProductionVariables.filter((name) => !String(process.env[name] || "").trim());
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }

  if (isLocalMongoUri(process.env.MONGODB_URI)) {
    throw new Error("Production MONGODB_URI must not point to localhost or a loopback address.");
  }

  const frontendUrl = String(process.env.CLIENT_URL).trim();
  let parsedFrontendUrl;
  try {
    parsedFrontendUrl = new URL(frontendUrl);
  } catch {
    throw new Error("Production CLIENT_URL must be a valid absolute URL.");
  }
  if (parsedFrontendUrl.protocol !== "https:") {
    throw new Error("Production CLIENT_URL must use HTTPS.");
  }

  for (const name of ["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"]) {
    if (String(process.env[name]).length < 32) {
      throw new Error(`${name} must be at least 32 characters in production.`);
    }
  }

  const razorpayMode = getRazorpayMode();
  const expectedRazorpayKeyPrefix =
    razorpayMode === "test" ? "rzp_test_" : "rzp_live_";
  if (!String(process.env.RAZORPAY_KEY_ID).startsWith(expectedRazorpayKeyPrefix)) {
    throw new Error(
      razorpayMode === "test"
        ? "Production RAZORPAY_MODE=test requires RAZORPAY_KEY_ID to be a Razorpay test key (rzp_test_...)."
        : 'Production RAZORPAY_KEY_ID must be a live Razorpay key (rzp_live_...) unless RAZORPAY_MODE is set to "test".'
    );
  }

  for (const name of ["RAZORPAY_ORDER_MOCK", "RAZORPAY_REFUND_MOCK", "RAZORPAY_ONBOARDING_MOCK"]) {
    if (String(process.env[name]).trim().toLowerCase() !== "false") {
      throw new Error(`${name} must be explicitly set to false in production.`);
    }
  }
};

export default process.env;
