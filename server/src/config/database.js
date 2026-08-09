import mongoose from "mongoose";

import RestaurantReview from "../models/RestaurantReview.js";
import FoodReview from "../models/FoodReview.js";

const connectDatabase = async () => {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGODB_URI is not defined in environment variables.");
    }

    await mongoose.connect(uri);

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
    process.exit(1);
  }
};

export default connectDatabase;
