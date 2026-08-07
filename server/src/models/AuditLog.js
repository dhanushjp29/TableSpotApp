import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    auditCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    eventType: {
      type: String,
      required: true,
      trim: true,
    },

    eventAction: {
      type: String,
      default: "",
      trim: true,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },

    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
      default: null,
    },

    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },

    refundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Refund",
      default: null,
    },

    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      default: null,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    performedByRole: {
      type: String,
      default: "",
      trim: true,
    },

    entityType: {
      type: String,
      default: "",
      trim: true,
    },

    entityId: {
      type: String,
      default: "",
      trim: true,
    },

    amount: {
      type: Number,
      default: 0,
    },

    currency: {
      type: String,
      default: "INR",
      trim: true,
    },

    status: {
      type: String,
      default: "",
      trim: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ bookingId: 1, createdAt: -1 });

auditLogSchema.index({ restaurantId: 1, createdAt: -1 });

auditLogSchema.index({ eventType: 1, createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
