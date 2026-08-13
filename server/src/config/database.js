import mongoose from "mongoose";
import "./env.js";
import "./env.js";

import RestaurantReview from "../models/RestaurantReview.js";
import FoodReview from "../models/FoodReview.js";

const connectDatabase = async () => {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGODB_URI is not defined in environment variables.");
    }

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 10000,
      connectTimeoutMS: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS) || 10000,
    });

    // Keep review indexes in sync with the schemas so the removed
    // one-review-per-restaurant / one-review-per-food unique indexes are
    // dropped from the database.
    await Promise.all([
      RestaurantReview.syncIndexes(),
      FoodReview.syncIndexes(),
    ]);

    console.log("MongoDB connected successfully.");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    throw error;
  }
};

export const closeDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

export default connectDatabase;
