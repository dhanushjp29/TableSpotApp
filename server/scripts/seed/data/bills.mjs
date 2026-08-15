import Bill from "../../../src/models/Bill.js";
import { CODE_PREFIX } from "../../../src/utils/constants.js";
import { codeFor } from "../lib/codes.mjs";
import { upsertOne, roundAmount } from "../lib/helpers.mjs";

const majorityGstRate = (orderedItems) => {
  const sums = new Map();
  for (const item of orderedItems) {
    const rate = Number(item.gstRate) || 0;
    sums.set(rate, (sums.get(rate) || 0) + item.totalPrice);
  }
  let bestRate = 0;
  let bestSum = -1;
  for (const [rate, sum] of sums) {
    if (sum > bestSum) {
      bestSum = sum;
      bestRate = rate;
    }
  }
  return bestRate > 0 ? bestRate : 18;
};

export const seedBills = async (ctx) => {
  const restaurantKeyById = new Map();
  for (const [key, entry] of ctx.restaurants) {
    restaurantKeyById.set(String(entry.doc._id), key);
  }

  let codeIndex = 0;
  let createdCount = 0;

  for (const [bookingKey, entry] of ctx.bookings) {
    const booking = entry.doc;
    const phase = entry.spec.phase;

    if (phase === "no-show") continue;

    codeIndex += 1;
    const billCode = codeFor(CODE_PREFIX.BILL, codeIndex);

    const restaurantKey = restaurantKeyById.get(String(booking.restaurantId));
    const restaurant = ctx.restaurants.get(restaurantKey).doc;
    const owner = ctx.users.get(ctx.ownerByRestaurant.get(restaurantKey)).doc;
    const customer = ctx.users.get(entry.spec.customerKey).doc;
    const built = entry.built;
    const offer = built.offer;
    const offerDiscount = built.offerDiscount;

    const foodById = new Map([...ctx.foods.values()].map((e) => [String(e.doc._id), e.doc]));

    const orderedItems = booking.preOrderedFoods.map((po) => {
      const food = foodById.get(String(po.foodId));
      const unitPrice = po.price;
      return {
        foodId: po.foodId,
        foodName: food ? food.foodName : "Item",
        variantName: po.variantName || "Regular",
        quantity: po.quantity,
        unitPrice,
        offerPrice: 0,
        totalPrice: roundAmount(unitPrice * po.quantity),
        orderSource: "Pre-Order",
        gstRate: food ? Number(food.gstRate) || 0 : 0,
      };
    });

    const subTotal = roundAmount(orderedItems.reduce((s, i) => s + i.totalPrice, 0));
    const manualDiscount = 0;
    const offerDiscountAmount = roundAmount(offerDiscount || 0);
    const taxableAmount = roundAmount(Math.max(0, subTotal - manualDiscount - offerDiscountAmount));
    const taxPercentage = majorityGstRate(orderedItems);
    const taxAmount = roundAmount((taxableAmount * taxPercentage) / 100);
    const serviceCharge = 0;
    const deliveryCharge = 0;
    const grandTotal = roundAmount(Math.max(0, taxableAmount + taxAmount + serviceCharge + deliveryCharge));

    const advancePaid = Number(booking.advanceAmount) || 0;

    let billStatus;
    let totalPaid = 0;
    let spotPaid = 0;
    let balanceDue = grandTotal;
    let paymentStatus = "Pending";
    let generatedAt;
    let paidAt = null;
    const paymentsHistory = [];

    if (phase === "completed") {
      billStatus = "Paid";
      totalPaid = grandTotal;
      spotPaid = roundAmount(Math.max(0, grandTotal - advancePaid));
      balanceDue = 0;
      paymentStatus = "Paid";
      generatedAt = new Date(booking.bookingDateTime);
      paidAt = booking.completedAt;
      paymentsHistory.push({ paymentMethod: "UPI", amount: advancePaid, transactionId: `txn_${billCode}`, notes: "Advance paid", paidAt: new Date(booking.bookingDateTime) });
      if (spotPaid > 0) {
        paymentsHistory.push({ paymentMethod: "Cash", amount: spotPaid, transactionId: `txn_${billCode}_spot`, notes: "Balance at restaurant", paidAt: booking.completedAt });
      }
    } else if (phase === "confirmed") {
      billStatus = "Generated";
      totalPaid = 0;
      spotPaid = 0;
      balanceDue = grandTotal;
      paymentStatus = advancePaid >= grandTotal && grandTotal > 0 ? "Partially Paid" : advancePaid > 0 ? "Partially Paid" : "Pending";
      generatedAt = new Date(booking.bookingDateTime);
    } else if (phase === "pending") {
      billStatus = "Draft";
      generatedAt = new Date(booking.bookingDateTime);
    } else if (phase === "cancelled") {
      billStatus = "Cancelled";
      generatedAt = new Date(booking.bookingDateTime);
    } else {
      billStatus = "Draft";
      generatedAt = new Date(booking.bookingDateTime);
    }

    const offerSnapshot = offer
      ? {
          offerId: offer._id,
          offerCode: offer.offerCode,
          title: offer.title || offer.offerCode,
          discountType: offer.discountType,
          discountValue: offer.discountValue,
          discountAmount: offerDiscountAmount,
          isStackable: false,
          appliedAt: new Date(booking.bookingDateTime),
        }
      : {
          offerId: null,
          offerCode: "",
          title: "",
          discountType: "Amount",
          discountValue: 0,
          discountAmount: 0,
          isStackable: false,
          appliedAt: null,
        };

    const doc = {
      billCode,
      bookingId: booking._id,
      billType: "ONLINE",
      tableId: booking.tableId,
      customerName: customer.fullName,
      customerPhone: customer.phoneNumber || customer.mobileNumber || "",
      customerEmail: customer.email,
      restaurantId: booking.restaurantId,
      orderedItems,
      subTotal,
      discount: { type: "Amount", value: manualDiscount },
      offer: offerSnapshot,
      taxAmount,
      taxPercentage,
      gstRate: taxPercentage,
      taxableAmount,
      taxBreakup:
        taxPercentage > 0
          ? [{ rate: taxPercentage, baseAmount: taxableAmount, taxAmount }]
          : [],
      restaurantGstin: restaurant.gstin || "",
      serviceCharge,
      deliveryCharge,
      grandTotal,
      payment: {
        totalPaid,
        advancePaid: phase === "completed" || phase === "confirmed" ? advancePaid : 0,
        spotPaid,
        balanceDue,
        paymentStatus,
        payments: paymentsHistory,
      },
      billStatus,
      notes: entry.spec.specialRequest || "",
      generatedBy: owner._id,
      generatedAt,
      isActive: true,
    };

    const { created, doc: saved } = await upsertOne(Bill, { billCode }, doc);
    if (created) createdCount += 1;

    ctx.bills.set(bookingKey, {
      doc: saved,
      created,
      math: { subTotal, offerDiscountAmount, grandTotal },
    });
  }

  return { created: createdCount };
};

export default seedBills;
