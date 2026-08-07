import mongoose from "mongoose";

const orderedItemSchema = new mongoose.Schema(
  {
    foodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      required: true,
    },

    foodName: {
      type: String,
      required: true,
      trim: true,
    },

    variantName: {
      type: String,
      default: "Regular",
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    offerPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    orderSource: {
      type: String,
      enum: ["Pre-Order", "Spot Order"],
      default: "Spot Order",
    },

    gstRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  { _id: false }
);

const paymentHistorySchema = new mongoose.Schema(
  {
    paymentMethod: {
      type: String,
      enum: ["Cash", "UPI", "Card", "Net Banking", "Wallet"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    transactionId: {
      type: String,
      default: "",
      trim: true,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    paidAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    billCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
    },

    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      default: null,
    },

    orderedItems: {
      type: [orderedItemSchema],
      default: [],
    },

    subTotal: {
      type: Number,
      default: 0,
      min: 0,
    },

    discount: {
      type: {
        type: String,
        enum: ["Amount", "Percentage"],
        default: "Amount",
      },

      value: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    gstRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    taxableAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    taxBreakup: [
      {
        rate: {
          type: Number,
          default: 0,
          min: 0,
          max: 100,
        },

        baseAmount: {
          type: Number,
          default: 0,
          min: 0,
        },

        taxAmount: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    ],

    restaurantGstin: {
      type: String,
      default: "",
      trim: true,
    },

    serviceCharge: {
      type: Number,
      default: 0,
      min: 0,
    },

    deliveryCharge: {
      type: Number,
      default: 0,
      min: 0,
    },

    grandTotal: {
      type: Number,
      default: 0,
      min: 0,
    },

    payment: {
      totalPaid: {
        type: Number,
        default: 0,
        min: 0,
      },

      advancePaid: {
        type: Number,
        default: 0,
        min: 0,
      },

      spotPaid: {
        type: Number,
        default: 0,
        min: 0,
      },

      balanceDue: {
        type: Number,
        default: 0,
        min: 0,
      },

      paymentStatus: {
        type: String,
        enum: [
          "Pending",
          "Partially Paid",
          "Paid",
          "Refunded",
        ],
        default: "Pending",
      },

      payments: {
        type: [paymentHistorySchema],
        default: [],
      },
    },

    billStatus: {
      type: String,
      enum: [
        "Draft",
        "Generated",
        "Paid",
        "Cancelled",
      ],
      default: "Draft",
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    generatedAt: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

billSchema.index({ billStatus: 1, bookingId: 1 });

billSchema.index({ restaurantId: 1, billStatus: 1, createdAt: -1 });

billSchema.index({ generatedBy: 1, createdAt: -1 });

billSchema.index({ "payment.paymentStatus": 1, billStatus: 1 });

const Bill = mongoose.model("Bill", billSchema);

export default Bill;
