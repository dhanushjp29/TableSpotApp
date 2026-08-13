const isProductionBuild = import.meta.env.PROD;

const requireProductionUrl = (value, name) => {
  if (value) return value;
  if (isProductionBuild) {
    throw new Error(`${name} must be configured for a production build.`);
  }
  return null;
};

export const API_URL = requireProductionUrl(import.meta.env.VITE_API_URL, "VITE_API_URL") || "http://localhost:5000/api/v1";
export const SOCKET_URL = requireProductionUrl(import.meta.env.VITE_SOCKET_URL, "VITE_SOCKET_URL") || "http://localhost:5000";

const clientOrderMock = String(import.meta.env.VITE_RAZORPAY_ORDER_MOCK || "false").toLowerCase() === "true";
if (isProductionBuild && clientOrderMock) {
  throw new Error("VITE_RAZORPAY_ORDER_MOCK must be false in a production build.");
}
export const IS_RAZORPAY_ORDER_MOCK = clientOrderMock;
