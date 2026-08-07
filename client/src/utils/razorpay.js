import { loadScript } from "./loadScript.js";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export const loadRazorpayCheckoutScript = () =>
  loadScript(
    CHECKOUT_SRC,
    () => typeof window !== "undefined" && Boolean(window.Razorpay)
  );

export const openRazorpayCheckout = ({
  key,
  amount,
  orderId,
  prefill = {},
  onSuccess,
  onDismiss,
  onFailure,
}) => {
  if (!window.Razorpay) {
    onFailure?.(new Error("Razorpay checkout script is not loaded."));
    return;
  }

  const options = {
    key,
    amount,
    currency: "INR",
    name: "TableSpot",
    description: "Booking advance payment",
    order_id: orderId,
    prefill: {
      name: prefill.name || "",
      email: prefill.email || "",
      contact: prefill.contact || "",
    },
    theme: { color: "#0f766e" },
    handler: (response) => onSuccess?.(response),
    modal: {
      ondismiss: () => onDismiss?.(),
    },
  };

  const razorpay = new window.Razorpay(options);
  razorpay.on("payment.failed", (response) => {
    onFailure?.(response?.error || new Error("Payment failed."));
  });
  razorpay.open();
};

export default openRazorpayCheckout;
