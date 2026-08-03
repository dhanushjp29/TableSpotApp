import mongoose from "mongoose";

const connectDatabase = async () => {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGODB_URI is not defined in environment variables.");
    }

    await mongoose.connect(uri);
    console.log("MongoDB connected successfully.");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1);
  }
};

export default connectDatabase;
