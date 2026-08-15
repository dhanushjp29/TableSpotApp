import Payment from "../../../src/models/Payment.js";
import {
  PAYMENT_PURPOSE,
  PAYMENT_TRANSACTION_STATUS,
  PAYMENT_BOOKING_STATUS,
  PAYMENT_ORDER_STATUS,
} from "../../../src/utils/constants.js";
import { upsertOne } from "../lib/helpers.mjs";

const roundAmount = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const seedPayments = async (ctx) => {
  let createdCount = 0;
  let serial = 0;

  const paymentFor = async ({ bookingKey, booking, bill, restaurant, amount, purpose, method, createdAt }) => {
    serial += 1;
    const doc = {
      bookingId: booking._id,
      customerId: booking.userId,
      ownerId: restaurant.ownerId,
      restaurantId: booking.restaurantId,
      billId: bill ? bill._id : null,
      paymentPurpose: purpose,
      idempotencyKey: `seed:${booking.bookingCode}:${purpose}:${Math.round(amount * 100)}`,
      orderCreationStatus: PAYMENT_ORDER_STATUS.CREATED,
      razorpayOrderId: `seed_ord_${String(serial).padStart(4, "0")}`,
      razorpayPaymentId: `seed_pay_${String(serial).padStart(4, "0")}`,
      amount: Math.round(Number(amount) * 100) / 100,
      currency: "INR",
      paymentStatus: PAYMENT_TRANSACTION_STATUS.CAPTURED,
      bookingCreationStatus: PAYMENT_BOOKING_STATUS.SUCCEEDED,
      paymentMethod: method || "Cash",
      createdAt,
    };

    const { created, doc: saved } = await upsertOne(
      Payment,
      { customerId: booking.userId, idempotencyKey: doc.idempotencyKey },
      doc
    );
    if (created) createdCount += 1;
    const type = purpose === PAYMENT_PURPOSE.BOOKING_ADVANCE ? "Advance" : "Bill";
    ctx.payments.push({ doc: saved, bookingKey, type, status: "Captured" });
    return saved;
  };

  for (const [bookingKey, entry] of ctx.bookings) {
    const booking = entry.doc;
    const phase = entry.spec.phase;
    const bill = ctx.bills.get(bookingKey)?.doc || null;
    const advance = Number(booking.advanceAmount) || 0;
    const method = booking.paymentMethod || "Cash";
    const restaurant = ctx.restaurants.get(entry.spec.restaurantKey).doc;

    if (phase === "completed") {
      const grandTotal = bill ? bill.grandTotal : Number(booking.totalAmount) || 0;
      if (advance > 0) {
        await paymentFor({
          bookingKey,
          booking,
          bill,
          restaurant,
          amount: advance,
          purpose: PAYMENT_PURPOSE.BOOKING_ADVANCE,
          method: "UPI",
          createdAt: new Date(booking.bookingDateTime),
        });
      }
      const spot = Math.max(0, roundAmount(grandTotal - advance));
      if (spot > 0) {
        await paymentFor({
          bookingKey,
          booking,
          bill,
          restaurant,
          amount: spot,
          purpose: PAYMENT_PURPOSE.BILL_PAYMENT,
          method: "Cash",
          createdAt: booking.completedAt,
        });
      } else if (grandTotal <= 0) {
        await paymentFor({
          bookingKey,
          booking,
          bill,
          restaurant,
          amount: 0,
          purpose: PAYMENT_PURPOSE.BILL_PAYMENT,
          method,
          createdAt: booking.completedAt,
        });
      }
      continue;
    }

    if (phase === "confirmed" && advance > 0) {
      await paymentFor({
        bookingKey,
        booking,
        bill,
        restaurant,
        amount: advance,
        purpose: PAYMENT_PURPOSE.BOOKING_ADVANCE,
        method,
        createdAt: new Date(booking.bookingDateTime),
      });
      continue;
    }

    if (phase === "cancelled" && advance > 0) {
      await paymentFor({
        bookingKey,
        booking,
        bill,
        restaurant,
        amount: advance,
        purpose: PAYMENT_PURPOSE.BOOKING_ADVANCE,
        method,
        createdAt: new Date(booking.bookingDateTime),
      });
    }
  }

  return { created: createdCount };
};

export default seedPayments;
