import Booking from "../models/Booking.js";
import Restaurant from "../models/Restaurant.js";
import Bill from "../models/Bill.js";
import Payment from "../models/Payment.js";
import * as razorpayService from "../services/razorpay.service.js";
import { addBillPayment } from "../services/bill.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { BOOKING_STATUS, PAYMENT_STATUS, PAYMENT_METHOD, PAYMENT_TRANSACTION_STATUS } from "../utils/constants.js";
import { getIO } from "../sockets/socket.handler.js";

/**
 * Initiate a Razorpay payment order for booking
 */
export const createOrder = asyncHandler(async (req, res) => {
    const { bookingId } = req.body;

    if (!bookingId) {
        throw new ApiError(400, "Booking ID is required.");
    }

    const booking = await Booking.findById(bookingId).populate("restaurantId");

    if (!booking || booking.isDeleted) {
        throw new ApiError(404, "Booking not found.");
    }

    // Ensure request is made by the customer of the booking or an owner / admin
    if (req.user.role === "customer" && String(booking.userId) !== String(req.user._id)) {
        throw new ApiError(403, "You can only make payment for your own bookings.");
    }

    if (booking.paymentStatus === PAYMENT_STATUS.PAID) {
        throw new ApiError(400, "This booking has already been paid.");
    }

    // Select amount: Advance amount preferred if set, otherwise total amount
    const amountToCharge = booking.advanceAmount > 0 ? booking.advanceAmount : booking.totalAmount;

    if (amountToCharge <= 0) {
        throw new ApiError(400, "Booking amount must be greater than zero to initiate payment.");
    }

    const restaurant = booking.restaurantId;
    if (!restaurant) {
        throw new ApiError(404, "Restaurant not found for this booking.");
    }

    const razorpayAccountId = restaurant.razorpayAccountId;

    // Create order with Razorpay Service
    const order = await razorpayService.createPaymentOrder({
        bookingId: booking._id,
        amount: amountToCharge,
        razorpayAccountId,
    });

    // Save standalone Payment record in Pending state
    await Payment.create({
        bookingId: booking._id,
        customerId: booking.userId,
        ownerId: restaurant.ownerId,
        restaurantId: restaurant._id,
        razorpayOrderId: order.id,
        amount: amountToCharge,
        currency: "INR",
        paymentStatus: PAYMENT_TRANSACTION_STATUS.PENDING,
    });

    res.status(200).json(
        new ApiResponse(200, "Razorpay payment order generated successfully.", {
            order,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        })
    );
});

/**
 * Verify Razorpay payment signature & update database status
 */
export const verifyPayment = asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) {
        throw new ApiError(400, "All Razorpay payment attributes and booking ID are required.");
    }

    // Fetch Booking
    const booking = await Booking.findById(bookingId);
    if (!booking || booking.isDeleted) {
        throw new ApiError(404, "Booking not found.");
    }

    // Find standalone Payment record
    const paymentRecord = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!paymentRecord) {
        throw new ApiError(404, "Associated payment transaction not found.");
    }

    try {
        // Verify Signature
        razorpayService.verifyPaymentSignature({
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
        });
    } catch (error) {
        // Mark Payment status as Failed on validation crash
        paymentRecord.paymentStatus = PAYMENT_TRANSACTION_STATUS.FAILED;
        await paymentRecord.save();
        throw error;
    }

    // Update standalone Payment record to Captured
    paymentRecord.razorpayPaymentId = razorpay_payment_id;
    paymentRecord.razorpaySignature = razorpay_signature;
    paymentRecord.paymentStatus = PAYMENT_TRANSACTION_STATUS.CAPTURED;
    paymentRecord.paymentMethod = PAYMENT_METHOD.CARD; // Defaulting to Card
    await paymentRecord.save();

    // Calculate new payment metrics
    const paidAmount = booking.advanceAmount > 0 ? booking.advanceAmount : booking.totalAmount;

    // Decide booking payment status
    let finalPaymentStatus = PAYMENT_STATUS.PAID;
    if (booking.advanceAmount > 0 && booking.advanceAmount < booking.totalAmount) {
        finalPaymentStatus = PAYMENT_STATUS.PARTIALLY_PAID;
    }

    booking.paymentStatus = finalPaymentStatus;
    booking.paymentMethod = PAYMENT_METHOD.CARD;

    // Confirm booking if it was pending
    if (booking.bookingStatus === BOOKING_STATUS.PENDING) {
        booking.bookingStatus = BOOKING_STATUS.CONFIRMED;
    }

    await booking.save();

    // If a bill exists, append this payment to the bill history
    if (booking.billId) {
        try {
            await addBillPayment({
                billId: booking.billId,
                paymentMethod: PAYMENT_METHOD.CARD,
                amount: paidAmount,
                transactionId: razorpay_payment_id,
                notes: `Paid via Razorpay. Order ID: ${razorpay_order_id}`,
            });
        } catch (billError) {
            console.error("Failed to automatically update bill payment ledger:", billError.message);
        }
    }

    // Notify restaurant of payment status/confirmation via Sockets
    try {
        const io = getIO();
        io.to(`restaurant_${booking.restaurantId}`).emit("booking:statusUpdated", {
            bookingId: booking._id,
            status: booking.bookingStatus,
            paymentStatus: booking.paymentStatus,
        });
    } catch (socketError) {
        console.error("Socket emit failed on payment verification:", socketError.message);
    }

    res.status(200).json(
        new ApiResponse(200, "Payment verified and booking confirmed successfully.", {
            bookingId: booking._id,
            bookingStatus: booking.bookingStatus,
            paymentStatus: booking.paymentStatus,
            paymentId: paymentRecord._id,
        })
    );
});
