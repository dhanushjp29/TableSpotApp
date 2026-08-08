import Bill from "../models/Bill.js";
import Booking from "../models/Booking.js";
import Food from "../models/food.js";
import Payment from "../models/Payment.js";
import Refund from "../models/Refund.js";
import Restaurant from "../models/Restaurant.js";
import User from "../models/User.js";

import ApiError from "../utils/ApiError.js";
import generateCode from "../utils/generateCode.js";
import { createAuditLog } from "./auditLog.service.js";
import { createRefund, syncBookingRefundStatus } from "./refund.service.js";
import { createNotification } from "./notification.service.js";
import { updateBookingStatus } from "./booking.service.js";
import { getIO } from "../sockets/socket.handler.js";

import {
  BILL_STATUS,
  BOOKING_STATUS,
  CODE_PREFIX,
  DISCOUNT_TYPE,
  getGstRateForCategory,
  ORDER_SOURCE,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  REFUND_REASON,
  REFUND_STATUS,
} from "../utils/constants.js";

const roundAmount = (value) => Math.round(Number(value || 0) * 100) / 100;

/**
 * Detect overpayment on a settled bill (totalPaid > grandTotal) and create a
 * refund record for the excess amount. Idempotent per booking + reason.
 * Returns the refund (or null when there is no excess).
 */
const ensureExcessRefund = async ({ bill, booking, createdBy }) => {
  const totalPaid = roundAmount(bill.payment?.totalPaid || 0);
  const grandTotal = roundAmount(bill.grandTotal || 0);
  const excess = roundAmount(totalPaid - grandTotal);

  if (excess <= 0) {
    if (!booking.refundId) {
      booking.refundStatus = null;
      await booking.save();
    }
    return null;
  }

  const existing = await Refund.findOne({
    bookingId: booking._id,
    reason: REFUND_REASON.EXCESS_ADVANCE_PAYMENT,
    isDeleted: false,
  });

  if (existing) {
    await syncBookingRefundStatus(existing);
    return existing;
  }

  const restaurant = await Restaurant.findById(booking.restaurantId);

  if (!restaurant) {
    return null;
  }

  const refund = await createRefund({
    booking,
    restaurant,
    amount: excess,
    reason: REFUND_REASON.EXCESS_ADVANCE_PAYMENT,
    remarks: `Excess payment after bill settlement (paid ${totalPaid}, bill ${grandTotal}).`,
    createdBy: createdBy || booking.userId,
  });

  if (!booking.refundId) {
    booking.refundStatus = refund.refundStatus;
    booking.refundId = refund._id;
    await booking.save();
  }

  try {
    await createAuditLog({
      eventType: "REFUND_REQUESTED",
      eventAction: "refund_created_on_excess_advance",
      bookingId: booking._id,
      billId: bill._id,
      refundId: refund._id,
      restaurantId: booking.restaurantId,
      userId: booking.userId,
      performedBy: createdBy || booking.userId,
      amount: refund.amount,
      status: REFUND_STATUS.REFUND_PENDING,
      metadata: { refundCode: refund.refundCode, totalPaid, grandTotal },
    });
  } catch (error) {
    console.error("Audit log error on excess refund creation:", error.message);
  }

  return refund;
};

/**
 * Resolve bill line items against the Food model so that food name, unit
 * price and GST rate are always taken from the server, never the client.
 * GST is derived from each item's food category slab (food.gstRate).
 *
 * Scoped to the booking's restaurant so an owner can never add another
 * restaurant's food to a bill, and only available (in-stock) items resolve.
 */
const resolveOrderedItems = async ({ items = [], restaurantId = null }) => {
  const foodIds = items.map((item) => item.foodId).filter(Boolean);

  let foods = [];
  if (foodIds.length > 0) {
    const foodQuery = {
      _id: { $in: foodIds },
      isDeleted: false,
      isAvailable: true,
    };

    if (restaurantId) {
      foodQuery.restaurantId = restaurantId;
    }

    foods = await Food.find(foodQuery).select(
      "_id foodName category gstRate hasVariants variants"
    );
  }

  const foodMap = new Map(foods.map((food) => [String(food._id), food]));

  return items.map((item) => {
    const food = item.foodId ? foodMap.get(String(item.foodId)) : null;

    if (item.foodId && !food) {
      throw new ApiError(
        400,
        "One or more food items are invalid, unavailable, or do not belong to this restaurant."
      );
    }

    const variantName = item.variantName?.trim() || "Regular";
    let unitPrice = Number(item.unitPrice || 0);

    if (food) {
      const variants = food.variants || [];
      const variant = variants.find(
        (v) =>
          String(v.variantName).toLowerCase() === variantName.toLowerCase()
      );
      const selected = variant || variants[0];

      if (selected) {
        unitPrice =
          selected.offerPrice > 0 ? selected.offerPrice : selected.price;
      }
    }

    const quantity = Number(item.quantity);
    const offerPrice = Number(item.offerPrice || 0);

    const gstRate = food
      ? (() => {
          const rate = Number(food.gstRate);
          return rate > 0
            ? rate
            : getGstRateForCategory(food.category || "Other");
        })()
      : getGstRateForCategory("Other");

    return {
      foodId: item.foodId || null,
      foodName: food
        ? food.foodName
        : String(item.foodName || "Item").trim(),
      variantName,
      quantity,
      unitPrice,
      offerPrice,
      totalPrice: roundAmount(
        quantity * Math.max(0, unitPrice - offerPrice)
      ),
      orderSource: item.orderSource || ORDER_SOURCE.SPOT_ORDER,
      gstRate,
    };
  });
};

const calculateSubTotal = (orderedItems = []) =>
  roundAmount(
    orderedItems.reduce(
      (sum, item) => sum + Number(item.totalPrice || 0),
      0
    )
  );

const calculateDiscountAmount = (discount = {}, subTotal = 0) => {
  if (!discount || !discount.type || !discount.value) {
    return 0;
  }

  const value = Number(discount.value || 0);

  if (discount.type === DISCOUNT_TYPE.PERCENTAGE) {
    return roundAmount(Math.min(subTotal, (subTotal * value) / 100));
  }

  return roundAmount(Math.min(subTotal, value));
};

const calculatePaymentSummary = ({
  payment = {},
  grandTotal = 0,
}) => {
  const payments = Array.isArray(payment.payments)
    ? payment.payments
    : [];

  const paymentsTotal = roundAmount(
    payments.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );

  const totalPaid = roundAmount(
    payments.length > 0
      ? paymentsTotal
      : (payment.totalPaid ??
        payment.advancePaid ??
        payment.spotPaid ??
        paymentsTotal)
  );

  const advancePaid = roundAmount(payment.advancePaid || 0);
  const spotPaid = roundAmount(payment.spotPaid || 0);
  const balanceDue = roundAmount(Math.max(0, grandTotal - totalPaid));

  let paymentStatus = PAYMENT_STATUS.PENDING;

  if (totalPaid <= 0) {
    paymentStatus = PAYMENT_STATUS.PENDING;
  } else if (balanceDue <= 0) {
    paymentStatus = PAYMENT_STATUS.PAID;
  } else {
    paymentStatus = PAYMENT_STATUS.PARTIALLY_PAID;
  }

  return {
    totalPaid,
    advancePaid,
    spotPaid,
    balanceDue,
    paymentStatus,
    payments,
  };
};

const getBillOrThrow = async (billId) => {
  const bill = await Bill.findById(billId);

  if (!bill || bill.isDeleted) {
    throw new ApiError(404, "Bill not found.");
  }

  return bill;
};

const getBookingOrThrow = async (bookingId) => {
  const booking = await Booking.findById(bookingId);

  if (!booking || booking.isDeleted) {
    throw new ApiError(404, "Booking not found.");
  }

  return booking;
};

const populateBill = (query) =>
  query
    .populate({
      path: "bookingId",
      populate: [
        {
          path: "userId",
          select: "userCode fullName email phoneNumber role profileImage",
        },
        {
          path: "restaurantId",
          select:
            "restaurantCode restaurantName slug city state country coverImage gstin averageRating",
        },
      ],
    })
    .populate("generatedBy", "userCode fullName email phoneNumber role profileImage");

/**
 * Push a bill update to the restaurant and customer rooms. Payload is
 * deliberately small (billCode, status, totals) so both owner and customer
 * screens can refresh without leaking unrelated data.
 */
const emitBillSocket = ({ bill, booking }) => {
  const payload = {
    billId: bill._id,
    billCode: bill.billCode,
    billStatus: bill.billStatus,
    paymentStatus: bill.payment?.paymentStatus || bill.paymentStatus,
    grandTotal: bill.grandTotal,
    totalPaid: bill.payment?.totalPaid || 0,
    balanceDue: bill.payment?.balanceDue || 0,
    bookingId: bill.bookingId?._id || bill.bookingId,
    bookingCode: booking?.bookingCode || null,
  };

  try {
    const io = getIO();
    io.to(`restaurant_${String(booking?.restaurantId || bill.restaurantId)}`)
      .to(`user_${String(booking?.userId)}`)
      .emit("bill:updated", payload);

    if (bill.billStatus === BILL_STATUS.PAID) {
      io.to(`restaurant_${String(booking?.restaurantId || bill.restaurantId)}`)
        .to(`user_${String(booking?.userId)}`)
        .emit("bill:completed", payload);
    }
  } catch (error) {
    console.error("Socket error on bill update:", error.message);
  }
};

/**
 * Close a fully-reconciled bill (recorded payments cover the grand total):
 * mark the bill PAID and complete the booking. This is the single place where
 * a settled bill moves the booking lifecycle forward — a PAID bill is
 * terminal and can never be edited or paid into again.
 *
 * Idempotent: calling it again on an already PAID bill is a no-op.
 */
const finalizeBillAndCompleteBooking = async ({
  bill,
  performedBy = null,
}) => {
  if (bill.billStatus === BILL_STATUS.PAID) {
    return bill;
  }

  bill.billStatus = BILL_STATUS.PAID;
  bill.payment = bill.payment || {};
  bill.payment.paymentStatus = PAYMENT_STATUS.PAID;
  bill.payment.balanceDue = 0;
  await bill.save();

  const booking = await Booking.findById(bill.bookingId);

  if (booking && booking.bookingStatus !== BOOKING_STATUS.COMPLETED) {
    try {
      await updateBookingStatus({
        bookingId: booking._id,
        bookingStatus: BOOKING_STATUS.COMPLETED,
        performedBy: performedBy || bill.generatedBy,
        performedByRole: "owner",
      });
    } catch (error) {
      // The bill is settled even if the booking cannot complete (e.g. it was
      // already cancelled by a concurrent action). Do not fail the payment.
      console.error("Booking completion failed on bill settlement:", error.message);
    }
  }

  if (booking?.userId) {
    try {
      await createNotification({
        userId: booking.userId,
        title: "Bill Settled",
        message: `Your bill (${bill.billCode}) for booking ${booking.bookingCode || ""} is settled. You can now review your visit.`,
        type: "Bill",
        linkId: bill._id,
        linkModel: "Bill",
      });
    } catch (error) {
      console.error("Notification error on bill settlement:", error.message);
    }
  }

  emitBillSocket({ bill, booking });

  return bill;
};

/**
 * Allocate the taxable base (subTotal - discount) across GST slabs in
 * proportion to each slab's gross share, then compute tax per slab.
 */
const buildTaxBreakup = ({ orderedItems, taxableAmount }) => {
  const subTotal = calculateSubTotal(orderedItems);

  if (subTotal <= 0 || taxableAmount <= 0) return [];

  const breakdown = new Map();

  for (const item of orderedItems) {
    const rate = Number(item.gstRate || 0);
    const gross = Number(item.totalPrice || 0);

    if (rate <= 0 || gross <= 0) continue;

    const entry = breakdown.get(rate) || { rate, baseAmount: 0, taxAmount: 0 };
    entry.baseAmount += gross;
    breakdown.set(rate, entry);
  }

  const result = [];

  for (const entry of breakdown.values()) {
    const baseAmount = roundAmount(
      (entry.baseAmount * taxableAmount) / subTotal
    );
    const taxAmount = roundAmount((baseAmount * entry.rate) / 100);
    result.push({ rate: entry.rate, baseAmount, taxAmount });
  }

  const allocatedBase = roundAmount(
    result.reduce((sum, entry) => sum + entry.baseAmount, 0)
  );
  const residue = roundAmount(taxableAmount - allocatedBase);

  if (residue !== 0 && result.length > 0) {
    const largest = result.reduce((a, b) =>
      b.baseAmount > a.baseAmount ? b : a
    );
    largest.baseAmount = roundAmount(largest.baseAmount + residue);
    largest.taxAmount = roundAmount((largest.baseAmount * largest.rate) / 100);
  }

  return result;
};

const buildBillTotals = ({
  orderedItems,
  discount,
  serviceCharge = 0,
  deliveryCharge = 0,
  payment = {},
}) => {
  const subTotal = calculateSubTotal(orderedItems);
  const discountAmount = calculateDiscountAmount(discount, subTotal);
  const taxableAmount = roundAmount(
    Math.max(0, subTotal - discountAmount)
  );

  const taxBreakup = buildTaxBreakup({
    orderedItems,
    taxableAmount,
  });

  const taxAmount = roundAmount(
    taxBreakup.reduce((sum, entry) => sum + entry.taxAmount, 0)
  );

  const service = roundAmount(serviceCharge);
  const delivery = roundAmount(deliveryCharge);
  const grandTotal = roundAmount(
    Math.max(0, taxableAmount + taxAmount + service + delivery)
  );
  const paymentSummary = calculatePaymentSummary({
    payment,
    grandTotal,
  });

  const gstRate =
    taxableAmount > 0
      ? roundAmount((taxAmount / taxableAmount) * 100)
      : 0;

  return {
    orderedItems,
    subTotal,
    discount: discount || { type: DISCOUNT_TYPE.AMOUNT, value: 0 },
    taxableAmount,
    gstRate,
    taxBreakup,
    taxAmount,
    serviceCharge: service,
    deliveryCharge: delivery,
    grandTotal,
    payment: paymentSummary,
  };
};

export const createBill = async ({
  bookingId,
  orderedItems = [],
  discount = null,
  serviceCharge = 0,
  deliveryCharge = 0,
  notes = "",
  generatedBy,
  generatedAt = new Date(),
  payment = {},
  allowEmptyItems = false,
}) => {
  if (!bookingId) {
    throw new ApiError(400, "Booking is required.");
  }

  if (!generatedBy) {
    throw new ApiError(400, "Generated by user is required.");
  }

  const user = await User.findById(generatedBy).select("_id isActive isDeleted");
  if (!user || !user.isActive || user.isDeleted) {
    throw new ApiError(404, "Generator user not found.");
  }

  const booking = await getBookingOrThrow(bookingId);

  if (booking.billId) {
    throw new ApiError(409, "A bill already exists for this booking.");
  }

  // Booking-state gate: bills can only be raised for bookings that have
  // reached the restaurant (confirmed) or have finished dining (completed).
  // Pending, cancelled and no-show bookings cannot be billed.
  if (
    ![
      BOOKING_STATUS.CONFIRMED,
      BOOKING_STATUS.COMPLETED,
    ].includes(booking.bookingStatus)
  ) {
    throw new ApiError(
      409,
      "Bills can only be created for confirmed or completed bookings."
    );
  }

  if (
    !Array.isArray(orderedItems) ||
    (orderedItems.length === 0 && !allowEmptyItems)
  ) {
    throw new ApiError(400, "Ordered items are required to create a bill.");
  }

  const restaurant = await Restaurant.findById(booking.restaurantId).select(
    "gstin restaurantName"
  );

  const resolvedItems = await resolveOrderedItems({
    items: orderedItems,
    restaurantId: booking.restaurantId,
  });

  const billCode = await generateCode(
    Bill,
    "billCode",
    CODE_PREFIX.BILL
  );

  const totals = buildBillTotals({
    orderedItems: resolvedItems,
    discount,
    serviceCharge,
    deliveryCharge,
    payment,
  });

  const bill = await Bill.create({
    billCode,
    bookingId: booking._id,
    restaurantId: booking.restaurantId,
    orderedItems: totals.orderedItems,
    subTotal: totals.subTotal,
    discount: totals.discount,
    taxableAmount: totals.taxableAmount,
    gstRate: totals.gstRate,
    taxBreakup: totals.taxBreakup,
    taxAmount: totals.taxAmount,
    serviceCharge: totals.serviceCharge,
    deliveryCharge: totals.deliveryCharge,
    grandTotal: totals.grandTotal,
    payment: totals.payment,
    billStatus: BILL_STATUS.GENERATED,
    restaurantGstin: restaurant?.gstin || "",
    notes: notes.trim(),
    generatedBy,
    generatedAt,
  });

  booking.billId = bill._id;
  booking.totalAmount = totals.grandTotal;
  booking.paymentStatus = totals.payment.paymentStatus;
  booking.paymentMethod = booking.paymentMethod || "Cash";
  await booking.save();

  // A bill that is already fully covered by the carried advance closes
  // immediately (billStatus PAID + booking COMPLETED).
  if (totals.payment.paymentStatus === PAYMENT_STATUS.PAID) {
    try {
      await finalizeBillAndCompleteBooking({
        bill: await Bill.findById(bill._id),
        performedBy: generatedBy,
      });
    } catch (error) {
      console.error("Bill finalization error on creation:", error.message);
    }
  } else {
    emitBillSocket({ bill, booking });
  }

  try {
    await ensureExcessRefund({ bill, booking, createdBy: generatedBy });
  } catch (error) {
    console.error("Excess refund creation error on bill create:", error.message);
  }

  try {
    await createAuditLog({
      eventType: "BILL_CREATED",
      eventAction: "bill_created",
      bookingId: booking._id,
      billId: bill._id,
      restaurantId: booking.restaurantId,
      userId: booking.userId,
      performedBy: generatedBy,
      amount: totals.grandTotal,
      status: BILL_STATUS.GENERATED,
      metadata: {
        billCode: bill.billCode,
        subTotal: totals.subTotal,
        taxableAmount: totals.taxableAmount,
        taxAmount: totals.taxAmount,
        taxBreakup: totals.taxBreakup,
      },
    });
  } catch (error) {
    console.error("Audit log error on bill creation:", error.message);
  }

  return {
    bill: await populateBill(Bill.findById(bill._id)),
    message: "Bill created successfully.",
  };
};

/**
 * Convert a confirmed/checked-in booking into a bill (the payment-first
 * lifecycle). The bill is seeded with the customer's pre-ordered items and
 * the captured advance is carried into the bill ledger so the customer is
 * never charged twice for the same amount.
 */
export const convertBookingToBill = async ({
  bookingId,
  generatedBy,
  notes = "",
}) => {
  if (!generatedBy) {
    throw new ApiError(400, "Generated by user is required.");
  }

  const booking = await getBookingOrThrow(bookingId);

  if (booking.billId) {
    throw new ApiError(409, "A bill already exists for this booking.");
  }

  if (booking.bookingStatus !== BOOKING_STATUS.CONFIRMED) {
    throw new ApiError(
      409,
      "Only confirmed bookings can be converted to a bill."
    );
  }

  // Time gate: an owner can only raise a bill once the booking's scheduled
  // time has arrived. Before that the guest has not dined, so there is
  // nothing to bill.
  if (new Date(booking.bookingDateTime).getTime() > Date.now()) {
    throw new ApiError(
      409,
      "You can only raise a bill once the booking time has arrived."
    );
  }

  // Seed the bill with the customer's pre-ordered items (server prices are
  // re-derived by resolveOrderedItems inside createBill).
  const orderedItems = (booking.preOrderedFoods || []).map((item) => ({
    foodId: item.foodId,
    variantName: item.variantName || "Regular",
    quantity: Number(item.quantity),
    orderSource: ORDER_SOURCE.PRE_ORDER,
  }));

  // Carry the customer's special request onto the bill when the owner did not
  // provide their own notes, so no booking detail is lost in conversion.
  const effectiveNotes =
    String(notes || "").trim() ||
    (booking.specialRequest
      ? `Customer request: ${String(booking.specialRequest).trim()}`
      : "");

  // Carry the advance into the bill ledger only when there are actual items
  // on the bill — an empty bill must never be auto-marked Paid off the
  // advance (that would immediately trigger an excess refund).
  let advancePayments = [];

  if (Number(booking.advanceAmount) > 0 && orderedItems.length > 0) {
    let transactionId = "";

    if (booking.sourcePaymentId) {
      const paymentRecord = await Payment.findById(booking.sourcePaymentId).select(
        "razorpayPaymentId"
      );
      transactionId = paymentRecord?.razorpayPaymentId || "";
    }

    advancePayments.push({
      paymentMethod: booking.paymentMethod || PAYMENT_METHOD.CASH,
      amount: Number(booking.advanceAmount),
      transactionId,
      notes: "Booking advance (online payment)",
    });
  }

  return createBill({
    bookingId,
    orderedItems,
    payment: { payments: advancePayments },
    notes: effectiveNotes,
    generatedBy,
    allowEmptyItems: true,
  });
};

export const updateBill = async ({
  billId,
  updates = {},
}) => {
  const bill = await getBillOrThrow(billId);

  // Terminal-state guard: a Paid or Cancelled bill is immutable. Never allow
  // an owner to change items, charges or payments on a closed invoice.
  if (
    bill.billStatus === BILL_STATUS.PAID ||
    bill.billStatus === BILL_STATUS.CANCELLED
  ) {
    throw new ApiError(
      409,
      `This bill is already ${bill.billStatus.toLowerCase()} and can no longer be edited.`
    );
  }

  const booking = await Booking.findById(bill.bookingId);

  if (updates.orderedItems !== undefined) {
    bill.orderedItems = await resolveOrderedItems({
      items: updates.orderedItems,
      restaurantId: booking?.restaurantId,
    });
  }

  if (updates.discount !== undefined) {
    bill.discount = updates.discount;
  }

  const numericFields = [
    "serviceCharge",
    "deliveryCharge",
  ];

  for (const field of numericFields) {
    if (updates[field] !== undefined) {
      bill[field] = Number(updates[field]);
    }
  }

  // Client-supplied taxAmount is never trusted; tax is recomputed from the
  // resolved items' GST rates.
  if (updates.notes !== undefined) {
    bill.notes = String(updates.notes).trim();
  }

  // billStatus is NEVER settable via the bill update endpoint — status
  // transitions go exclusively through markBillStatus (with reconciliation).

  if (updates.generatedAt !== undefined) {
    bill.generatedAt = updates.generatedAt ? new Date(updates.generatedAt) : updates.generatedAt;
  }

  if (updates.isActive !== undefined) {
    bill.isActive = Boolean(updates.isActive);
  }

  // Only new payment entries from the client are honoured. The payment
  // summary (totalPaid / advancePaid / spotPaid / balanceDue / paymentStatus)
  // is always recomputed server-side from the payments ledger.
  const paymentUpdates = updates.payment || {};
  const newPayments = Array.isArray(paymentUpdates.payments)
    ? paymentUpdates.payments
    : [];
  const existingPayment = bill.payment?.payments || [];

  const totals = buildBillTotals({
    orderedItems: bill.orderedItems,
    discount: bill.discount,
    serviceCharge: bill.serviceCharge,
    deliveryCharge: bill.deliveryCharge,
    payment: {
      payments: [...existingPayment, ...newPayments],
    },
  });

  bill.orderedItems = totals.orderedItems;
  bill.subTotal = totals.subTotal;
  bill.discount = totals.discount;
  bill.taxableAmount = totals.taxableAmount;
  bill.gstRate = totals.gstRate;
  bill.taxBreakup = totals.taxBreakup;
  bill.taxAmount = totals.taxAmount;
  bill.serviceCharge = totals.serviceCharge;
  bill.deliveryCharge = totals.deliveryCharge;
  bill.grandTotal = totals.grandTotal;
  bill.payment = totals.payment;

  await bill.save();

  if (booking) {
    booking.totalAmount = bill.grandTotal;
    booking.paymentStatus = bill.payment.paymentStatus;
    await booking.save();

    try {
      await ensureExcessRefund({
        bill,
        booking,
        createdBy: bill.generatedBy,
      });
    } catch (error) {
      console.error("Excess refund creation error on bill update:", error.message);
    }
  }

  // Closing the bill (payments now cover the total) also completes the
  // booking — never leave a paid bill on an open reservation.
  if (bill.payment.paymentStatus === PAYMENT_STATUS.PAID) {
    await finalizeBillAndCompleteBooking({
      bill: await Bill.findById(bill._id),
      performedBy: bill.generatedBy,
    });
  } else {
    emitBillSocket({ bill, booking });
  }

  return {
    bill: await populateBill(Bill.findById(bill._id)),
    message: "Bill updated successfully.",
  };
};

export const addBillPayment = async ({
  billId,
  paymentMethod,
  amount,
  transactionId = "",
  notes = "",
  paidAt = new Date(),
}) => {
  const bill = await getBillOrThrow(billId);

  // Terminal-state guard: a Paid bill is a closed invoice — the BIL000009 bug.
  // No further payments may ever be recorded against it.
  if (bill.billStatus === BILL_STATUS.PAID) {
    throw new ApiError(409, "This bill is already paid and cannot accept more payments.");
  }

  if (bill.billStatus === BILL_STATUS.CANCELLED) {
    throw new ApiError(409, "Payments cannot be added to a cancelled bill.");
  }

  if (!Object.values(PAYMENT_METHOD).includes(paymentMethod)) {
    throw new ApiError(400, "Invalid payment method.");
  }

  const paymentAmount = Number(amount);

  if (Number.isNaN(paymentAmount) || paymentAmount <= 0) {
    throw new ApiError(400, "Payment amount must be greater than zero.");
  }

  const paymentEntry = {
    paymentMethod,
    amount: paymentAmount,
    transactionId: transactionId.trim(),
    notes: notes.trim(),
    paidAt,
  };

  bill.payment = bill.payment || {};
  bill.payment.payments = bill.payment.payments || [];
  bill.payment.payments.push(paymentEntry);

  const totals = buildBillTotals({
    orderedItems: bill.orderedItems,
    discount: bill.discount,
    taxAmount: bill.taxAmount,
    serviceCharge: bill.serviceCharge,
    deliveryCharge: bill.deliveryCharge,
    payment: bill.payment,
  });

  bill.payment = totals.payment;
  bill.subTotal = totals.subTotal;
  bill.discount = totals.discount;
  bill.taxableAmount = totals.taxableAmount;
  bill.gstRate = totals.gstRate;
  bill.taxBreakup = totals.taxBreakup;
  bill.taxAmount = totals.taxAmount;
  bill.serviceCharge = totals.serviceCharge;
  bill.deliveryCharge = totals.deliveryCharge;
  bill.grandTotal = totals.grandTotal;

  await bill.save();

  const booking = await Booking.findById(bill.bookingId);
  if (booking) {
    booking.paymentStatus = bill.payment.paymentStatus;
    await booking.save();

    try {
      await ensureExcessRefund({
        bill,
        booking,
        createdBy: bill.generatedBy,
      });
    } catch (error) {
      console.error("Excess refund creation error on bill payment:", error.message);
    }
  }

  // Payments now cover the total → close the bill (PAID) and complete the
  // booking in the same pass.
  if (bill.payment.paymentStatus === PAYMENT_STATUS.PAID) {
    await finalizeBillAndCompleteBooking({
      bill: await Bill.findById(bill._id),
      performedBy: bill.generatedBy,
    });
  } else {
    emitBillSocket({ bill, booking });
  }

  return {
    bill: await populateBill(Bill.findById(bill._id)),
    message: "Payment added successfully.",
  };
};

export const markBillStatus = async ({
  billId,
  billStatus,
}) => {
  const bill = await getBillOrThrow(billId);

  if (!Object.values(BILL_STATUS).includes(billStatus)) {
    throw new ApiError(400, "Invalid bill status.");
  }

  // Terminal-state guard: a Paid or Cancelled bill can never transition again.
  if (
    bill.billStatus === BILL_STATUS.PAID ||
    bill.billStatus === BILL_STATUS.CANCELLED
  ) {
    if (bill.billStatus === billStatus) {
      // no-op write of the same terminal status is tolerated.
      return {
        bill: await populateBill(Bill.findById(bill._id)),
        message: "Bill status is unchanged.",
      };
    }
    throw new ApiError(
      409,
      `This bill is already ${bill.billStatus.toLowerCase()} and its status cannot be changed.`
    );
  }

  // Bill status state machine + payment reconciliation.
  const currentStatus = bill.billStatus;

  if (currentStatus === billStatus) {
    // no-op write is tolerated
  } else if (
    currentStatus === BILL_STATUS.GENERATED &&
    billStatus === BILL_STATUS.PAID
  ) {
    // A bill may only be marked PAID once the recorded payments actually
    // cover the grand total — never as an unreconciled status flip.
    const totalPaid = roundAmount(bill.payment?.totalPaid || 0);
    const grandTotal = roundAmount(bill.grandTotal || 0);

    if (totalPaid < grandTotal) {
      throw new ApiError(
        409,
        `Bill cannot be marked Paid: recorded payments (${totalPaid}) do not cover the bill total (${grandTotal}). Add a payment first.`
      );
    }
  } else if (
    currentStatus === BILL_STATUS.GENERATED &&
    billStatus === BILL_STATUS.CANCELLED
  ) {
    // Allowed — voiding a generated bill.
  } else {
    throw new ApiError(
      409,
      `Bill cannot transition from "${currentStatus}" to "${billStatus}".`
    );
  }

  bill.billStatus = billStatus;

  if (billStatus === BILL_STATUS.PAID) {
    bill.payment = bill.payment || {};
    bill.payment.paymentStatus = PAYMENT_STATUS.PAID;
    bill.payment.balanceDue = 0;
  }

  if (billStatus === BILL_STATUS.CANCELLED) {
    bill.payment = bill.payment || {};
    bill.payment.paymentStatus = PAYMENT_STATUS.PENDING;
    bill.payment.balanceDue = 0;
  }

  await bill.save();

  const booking = await Booking.findById(bill.bookingId);
  if (booking) {
    booking.paymentStatus = bill.payment?.paymentStatus || booking.paymentStatus;
    await booking.save();

    try {
      await ensureExcessRefund({
        bill,
        booking,
        createdBy: bill.generatedBy,
      });
    } catch (error) {
      console.error("Excess refund creation error on bill status:", error.message);
    }
  }

  if (billStatus === BILL_STATUS.PAID) {
    await finalizeBillAndCompleteBooking({
      bill: await Bill.findById(bill._id),
      performedBy: bill.generatedBy,
    });
  } else {
    emitBillSocket({ bill, booking });
  }

  return {
    bill: await populateBill(Bill.findById(bill._id)),
    message: "Bill status updated successfully.",
  };
};

export const getBillById = async ({
  billId,
}) => {
  const bill = await populateBill(Bill.findById(billId));

  if (!bill || bill.isDeleted) {
    throw new ApiError(404, "Bill not found.");
  }

  return {
    bill,
  };
};

export const getBills = async ({
  page = 1,
  limit = 10,
  bookingId = null,
  billStatus = null,
  paymentStatus = null,
  generatedBy = null,
}) => {
  const query = { isDeleted: false };

  if (bookingId) {
    query.bookingId = bookingId;
  }

  if (billStatus) {
    query.billStatus = billStatus;
  }

  if (paymentStatus) {
    query["payment.paymentStatus"] = paymentStatus;
  }

  if (generatedBy) {
    query.generatedBy = generatedBy;
  }

  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (pageNumber - 1) * pageSize;

  const [bills, total] = await Promise.all([
    Bill.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate("bookingId")
      .populate("generatedBy", "userCode fullName email phoneNumber role profileImage"),
    Bill.countDocuments(query),
  ]);

  return {
    bills,
    meta: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
};
