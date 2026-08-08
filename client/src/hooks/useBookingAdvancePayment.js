import { useState } from "react";
import toast from "react-hot-toast";
import { paymentApi } from "../api/payment.api.js";
import {
  loadRazorpayCheckoutScript,
  openRazorpayCheckout,
} from "../utils/razorpay.js";

const IS_ORDER_MOCK = import.meta.env.VITE_RAZORPAY_ORDER_MOCK === "true";

const getErrorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.message || fallback;

export const useBookingAdvancePayment = () => {
  const [isPaying, setIsPaying] = useState(false);

  const payAdvance = async ({
    bookingId,
    bookingData,
    idempotencyKey,
    prefill = {},
    onSuccess,
    onDismiss,
    onFailure,
  }) => {
    setIsPaying(true);
    try {
      const response = await paymentApi.createOrder({
        bookingId,
        // Payment-first: when no booking exists yet, the validated draft is
        // sent along and the server creates the booking after capture.
        ...(bookingData ? { bookingData } : {}),
        purpose: "BOOKING_ADVANCE",
        idempotencyKey:
          idempotencyKey ||
          `booking-advance-${bookingId || "draft"}-${Date.now()}`,
      });
      const { order, razorpayKeyId } = response?.data || {};
      if (!order?.id || !razorpayKeyId) {
        throw new Error("Unable to start payment. Please try again.");
      }

      // VITE_RAZORPAY_ORDER_MOCK=true simulates a successful checkout so the
      // full payment-first flow can be exercised without a live gateway. It
      // MUST be removed in production.
      if (IS_ORDER_MOCK) {
        const mockPaymentId = `pay_mock_${order.id}_${Date.now()}`;
        const mockSignature = `sig_mock_${order.id}`;
        try {
          const verifyResponse = await paymentApi.verifyPayment({
            razorpay_order_id: order.id,
            razorpay_payment_id: mockPaymentId,
            razorpay_signature: mockSignature,
            ...(bookingId ? { bookingId } : {}),
          });
          toast.success(
            verifyResponse?.message || "Advance payment successful!"
          );
          onSuccess?.(verifyResponse?.data || {});
        } catch (err) {
          toast.error(
            getErrorMessage(
              err,
              "Payment received but could not be verified. It will be confirmed shortly."
            )
          );
          onDismiss?.();
        }
        return;
      }

      await loadRazorpayCheckoutScript();

      openRazorpayCheckout({
        key: razorpayKeyId,
        amount: order.amount,
        orderId: order.id,
        prefill,
        onSuccess: async (rzpResponse) => {
          try {
            const verifyResponse = await paymentApi.verifyPayment({
              razorpay_order_id: rzpResponse.razorpay_order_id,
              razorpay_payment_id: rzpResponse.razorpay_payment_id,
              razorpay_signature: rzpResponse.razorpay_signature,
              ...(bookingId ? { bookingId } : {}),
            });
            toast.success(
              verifyResponse?.message || "Advance payment successful!"
            );
            onSuccess?.(verifyResponse?.data || {});
          } catch (err) {
            toast.error(
              getErrorMessage(
                err,
                "Payment received but could not be verified. It will be confirmed shortly."
              )
            );
            onDismiss?.();
          }
        },
        onDismiss: () => onDismiss?.(),
        onFailure: (error) => {
          toast.error(getErrorMessage(error, "Payment could not be completed."));
          onFailure?.(error);
        },
      });
    } catch (err) {
      toast.error(getErrorMessage(err, "Unable to start payment."));
      onFailure?.(err);
    } finally {
      setIsPaying(false);
    }
  };

  return { isPaying, payAdvance };
};
