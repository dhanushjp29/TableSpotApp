import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    offerType: {
      type: String,
      enum: ["Percentage", "Flat", "Free Item", "Other"],
      default: "Other",
    },

    offerValue: {
      type: Number,
      default: 0,
    },

    startDate: {
      type: Date,
    },

    endDate: {
      type: Date,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const operatingHourSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
    },

    isOpen: {
      type: Boolean,
      default: true,
    },

    open: {
      type: String,
      default: "",
    },

    close: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const restaurantSchema = new mongoose.Schema(
  {
    restaurantCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    restaurantName: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    contactPerson: {
      type: String,
      required: true,
      trim: true,
    },

    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    state: {
      type: String,
      required: true,
      trim: true,
    },

    country: {
      type: String,
      required: true,
      trim: true,
    },

    pincode: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      latitude: {
        type: Number,
        required: true,
      },

      longitude: {
        type: Number,
        required: true,
      },
    },

    coverImage: {
      type: String,
      required: true,
    },

    galleryImages: {
      type: [String],
      validate: {
        validator: (images) => images.length >= 3 && images.length <= 10,
        message: "Gallery must contain between 3 and 10 images.",
      },
      required: true,
    },

    cuisineTypes: {
      type: [String],
      default: [],
    },

    operatingHours: {
      type: [operatingHourSchema],
      default: [],
    },

    amenities: {
      type: [String],
      default: [],
    },

    services: {
      type: [String],
      default: [],
    },

    currentOffers: {
      type: [offerSchema],
      default: [],
    },

    priceRange: {
      type: String,
      enum: ["₹", "₹₹", "₹₹₹", "₹₹₹₹"],
      default: "₹",
    },

    averageCostForTwo: {
      type: Number,
      default: 0,
    },

    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    totalReviews: {
      type: Number,
      default: 0,
    },

    totalBookings: {
      type: Number,
      default: 0,
    },

    verificationStatus: {
      type: String,
      enum: ["Pending", "Verified", "Rejected"],
      default: "Pending",
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      default: "",
    },

    razorpayAccountId: {
      type: String,
      default: "",
      trim: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
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

const Restaurant = mongoose.model("Restaurant", restaurantSchema);

export default Restaurant;
